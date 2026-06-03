import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ACTIVE_PERSONA_ID_SETTING_KEY,
  DEFAULT_LEENA_PERSONA,
  DEFAULT_PERSONA_ID,
  PERSONAS_SETTING_KEY,
  PersonaEngine,
} from "../src/identity/persona-engine.js";
import { AGENT_PERSONAS, DEFAULT_VOICE } from "../src/realtime/prompts.js";
import { closeDatabase } from "../src/realtime/tools/database.js";
import { getJSON, getSetting, getString, setSetting } from "../src/settings-store.js";

async function withPersonaDb(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), "leena-personas-"));
  const filePath = path.join(directory, "lena.db");
  try {
    await callback({
      engine: new PersonaEngine({ settingsStore: createStore(filePath) }),
      filePath,
    });
  } finally {
    closeDatabase(filePath);
    await rm(directory, { force: true, recursive: true });
  }
}

function createStore(filePath) {
  return {
    getJSON: (key, defaultValue) => getJSON(key, defaultValue, filePath),
    getSetting: (key, defaultValue) => getSetting(key, defaultValue, filePath),
    getString: (key, defaultValue) => getString(key, defaultValue, filePath),
    setSetting: (key, value) => setSetting(key, value, filePath),
  };
}

test("first run seeds default Leena and legacy AGENT_PERSONAS", async () => {
  await withPersonaDb(({ engine, filePath }) => {
    const personas = engine.getAll();

    assert.deepEqual(
      personas.map((persona) => persona.id),
      ["default", "therapist", "explainer", "coach", "honest"],
    );
    assert.deepEqual(personas[0], DEFAULT_LEENA_PERSONA);
    assert.equal(personas[0].voicePreference, DEFAULT_VOICE);

    const therapist = personas.find((persona) => persona.id === "therapist");
    assert.equal(therapist.name, AGENT_PERSONAS.therapist.label);
    assert.equal(therapist.systemPrompt, AGENT_PERSONAS.therapist.prompt);
    assert.match(therapist.instructions, /Lead with empathy/);

    const stored = getJSON(PERSONAS_SETTING_KEY, null, filePath);
    assert.equal(stored.length, personas.length);
  });
});

test("create, update, and delete custom personas persist through the settings store", async () => {
  await withPersonaDb(({ engine, filePath }) => {
    const created = engine.create({
      name: "Research Partner",
      tone: "curious and precise",
      instructions: "Ask sharp questions before recommending a path.",
      systemPrompt: "Prefer evidence and cite uncertainty.",
      voicePreference: "cedar",
      responseStyle: "structured",
    });
    const duplicate = engine.create({
      name: "Research Partner",
      tone: "playful",
    });

    assert.equal(created.id, "research-partner");
    assert.equal(duplicate.id, "research-partner-2");
    assert.equal(created.isDefault, false);
    assert.match(created.createdAt, /^\d{4}-\d{2}-\d{2}T/);

    const updated = engine.update(created.id, {
      tone: "calm and analytical",
      responseStyle: "numbered",
    });
    assert.equal(updated.id, created.id);
    assert.equal(updated.tone, "calm and analytical");
    assert.equal(updated.responseStyle, "numbered");

    assert.equal(engine.delete(duplicate.id), true);

    const restarted = new PersonaEngine({ settingsStore: createStore(filePath) });
    const persisted = restarted.getAll().find((persona) => persona.id === created.id);
    assert.equal(persisted.tone, "calm and analytical");
    assert.equal(
      restarted.getAll().some((persona) => persona.id === duplicate.id),
      false,
    );
  });
});

test("active persona switches persist and fall back to Leena when removed", async () => {
  await withPersonaDb(({ engine, filePath }) => {
    const custom = engine.create({
      name: "Focused Coach",
      tone: "direct and practical",
    });

    assert.equal(engine.getActive().id, DEFAULT_PERSONA_ID);
    assert.equal(engine.setActive(custom.id).id, custom.id);

    const restarted = new PersonaEngine({ settingsStore: createStore(filePath) });
    assert.equal(restarted.getActive().id, custom.id);

    restarted.delete(custom.id);
    assert.equal(restarted.getActive().id, DEFAULT_PERSONA_ID);
    assert.equal(getString(ACTIVE_PERSONA_ID_SETTING_KEY, null, filePath), DEFAULT_PERSONA_ID);
  });
});

test("default Leena persona is repaired and protected", async () => {
  await withPersonaDb(({ engine, filePath }) => {
    setSetting(
      PERSONAS_SETTING_KEY,
      [{ id: "custom", name: "Custom", tone: "dry", isDefault: false }],
      filePath,
    );

    const personas = engine.getAll();
    assert.equal(personas[0].id, DEFAULT_PERSONA_ID);
    assert.equal(personas[0].name, "Leena");
    assert.equal(personas.find((persona) => persona.id === "custom").tone, "dry");

    assert.throws(() => engine.delete(DEFAULT_PERSONA_ID), /default Leena persona/i);
    assert.throws(() => engine.update(DEFAULT_PERSONA_ID, { tone: "different" }), /default Leena/i);

    const stored = getJSON(PERSONAS_SETTING_KEY, null, filePath);
    assert.equal(
      stored.some((persona) => persona.id === DEFAULT_PERSONA_ID),
      true,
    );
  });
});

test("persona validation rejects missing required fields and unknown ids", async () => {
  await withPersonaDb(({ engine }) => {
    assert.throws(() => engine.create({ tone: "quiet" }), /Persona name/);
    assert.throws(() => engine.create({ name: "Quiet" }), /Persona tone/);
    assert.throws(() => engine.setActive("missing"), /Unknown persona/);
    assert.throws(() => engine.update("missing", { tone: "plain" }), /Unknown persona/);
    assert.throws(() => engine.delete("missing"), /Unknown persona/);
  });
});
