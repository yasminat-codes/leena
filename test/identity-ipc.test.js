import assert from "node:assert/strict";
import test from "node:test";
import {
  createAgentProfileIdentityAdapters,
  createIdentityIpcHandlers,
  IDENTITY_DEFAULT_PERSONA_PROTECTED,
  IDENTITY_IPC_CHANNELS,
  registerIdentityHandlers,
  stripIdentityProfileFields,
} from "../src/ipc/identity-handlers.js";

const DEFAULT_PERSONA = Object.freeze({
  id: "default",
  name: "Leena",
  tone: "warm",
  instructions: "Be direct and helpful.",
  isDefault: true,
});

const COACH_PERSONA = Object.freeze({
  id: "coach",
  name: "Coach",
  tone: "focused",
  instructions: "Keep the next step clear.",
  isDefault: false,
});

function createMockPersonaEngine() {
  const calls = {
    getAll: 0,
    getActive: 0,
    setActive: [],
    create: [],
    update: [],
    delete: [],
  };
  const personas = [DEFAULT_PERSONA, COACH_PERSONA].map((persona) => ({ ...persona }));
  let activeId = DEFAULT_PERSONA.id;

  return {
    calls,
    getAll() {
      calls.getAll += 1;
      return personas.map((persona) => ({ ...persona }));
    },
    getActive() {
      calls.getActive += 1;
      return { ...personas.find((persona) => persona.id === activeId) };
    },
    setActive(personaId) {
      calls.setActive.push(personaId);
      const persona = personas.find((item) => item.id === personaId);
      if (!persona) {
        throw new RangeError(`Unknown persona: ${personaId}`);
      }
      activeId = persona.id;
      return { ...persona };
    },
    create(personaData) {
      calls.create.push(personaData);
      const persona = {
        id: "researcher",
        name: personaData.name,
        tone: personaData.tone,
        instructions: personaData.instructions ?? "",
        isDefault: false,
      };
      personas.push(persona);
      return { ...persona };
    },
    update(id, changes) {
      calls.update.push({ id, changes });
      const persona = personas.find((item) => item.id === id);
      Object.assign(persona, changes);
      return { ...persona };
    },
    delete(id) {
      calls.delete.push(id);
      if (id === DEFAULT_PERSONA.id) {
        throw new Error("The default Leena persona cannot be deleted.");
      }
      return true;
    },
  };
}

test("registerIdentityHandlers wires every identity channel", () => {
  const registered = new Map();
  const ipcMain = {
    handle(channel, handler) {
      registered.set(channel, handler);
    },
  };

  const { channels, handlers } = registerIdentityHandlers({
    ipcMain,
    personaEngine: createMockPersonaEngine(),
  });

  assert.deepEqual(channels, IDENTITY_IPC_CHANNELS);
  assert.deepEqual([...registered.keys()], Object.values(IDENTITY_IPC_CHANNELS));
  assert.equal(registered.get(IDENTITY_IPC_CHANNELS.listPersonas), handlers.listPersonas);
  assert.equal(registered.get(IDENTITY_IPC_CHANNELS.switchPersona), handlers.switchPersona);
  assert.equal(registered.get(IDENTITY_IPC_CHANNELS.createPersona), handlers.createPersona);
  assert.equal(registered.get(IDENTITY_IPC_CHANNELS.updatePersona), handlers.updatePersona);
  assert.equal(registered.get(IDENTITY_IPC_CHANNELS.deletePersona), handlers.deletePersona);
});

test("identity handlers delegate to PersonaEngine methods", async () => {
  const personaEngine = createMockPersonaEngine();
  const changes = [];
  const handlers = createIdentityIpcHandlers({
    onChanged: (change) => changes.push(change),
    personaEngine,
  });

  assert.deepEqual(await handlers.listPersonas(), [DEFAULT_PERSONA, COACH_PERSONA]);
  assert.equal(personaEngine.calls.getAll, 1);

  assert.deepEqual(await handlers.switchPersona(null, { personaId: "coach" }), COACH_PERSONA);
  assert.deepEqual(personaEngine.calls.setActive, ["coach"]);

  const created = await handlers.createPersona(null, {
    name: "Researcher",
    tone: "precise",
    instructions: "Cite uncertainty.",
  });
  assert.equal(created.id, "researcher");
  assert.deepEqual(personaEngine.calls.create, [
    {
      name: "Researcher",
      tone: "precise",
      instructions: "Cite uncertainty.",
    },
  ]);

  assert.equal(
    (
      await handlers.updatePersona(null, {
        id: "researcher",
        changes: { tone: "curious" },
      })
    ).tone,
    "curious",
  );
  assert.deepEqual(personaEngine.calls.update, [
    {
      id: "researcher",
      changes: { tone: "curious" },
    },
  ]);

  assert.deepEqual(await handlers.deletePersona(null, { id: "researcher" }), {
    ok: true,
    id: "researcher",
    deleted: true,
  });
  assert.deepEqual(personaEngine.calls.delete, ["researcher"]);
  assert.deepEqual(changes, [
    { action: "switch-persona", personaId: "coach", type: "identity" },
    { action: "create-persona", personaId: "researcher", type: "identity" },
    { action: "update-persona", personaId: "researcher", type: "identity" },
    { action: "delete-persona", personaId: "researcher", type: "identity" },
  ]);
});

test("delete default persona returns structured identity error", async () => {
  const personaEngine = createMockPersonaEngine();
  const handlers = createIdentityIpcHandlers({ personaEngine });

  const response = await handlers.deletePersona(null, { id: "default" });

  assert.equal(response.ok, false);
  assert.equal(response.id, "default");
  assert.equal(response.error.code, IDENTITY_DEFAULT_PERSONA_PROTECTED);
  assert.match(response.error.message, /default Leena persona cannot be deleted/i);
  assert.deepEqual(personaEngine.calls.delete, ["default"]);
});

test("agent profile adapters preserve legacy profile shape and expose active persona", async () => {
  const personaEngine = createMockPersonaEngine();
  const savedProfiles = [];
  const changes = [];
  const adapters = createAgentProfileIdentityAdapters({
    onChanged: (change) => changes.push(change),
    personaEngine,
    loadAgentProfile() {
      return {
        name: "Ken",
        goals: ["Ship Leena"],
        about: "Likes direct answers.",
        voice: "marin",
        persona: "honest",
      };
    },
    saveAgentProfile(profile) {
      savedProfiles.push(profile);
      return {
        name: profile.name.trim(),
        goals: profile.goals,
        about: profile.about,
        voice: profile.voice,
        persona: profile.persona ?? "default",
      };
    },
  });

  const loaded = await adapters.getAgentProfile();

  assert.equal(loaded.name, "Ken");
  assert.deepEqual(loaded.goals, ["Ship Leena"]);
  assert.equal(loaded.persona, "default");
  assert.equal(loaded.personaId, "default");
  assert.deepEqual(loaded.activePersona, DEFAULT_PERSONA);
  assert.equal(loaded.legacyPersona, "honest");

  const saved = await adapters.setAgentProfile(null, {
    name: "  Ken  ",
    goals: ["Ship Leena"],
    about: "Likes direct answers.",
    voice: "cedar",
    personaId: "coach",
  });

  assert.deepEqual(personaEngine.calls.setActive, ["coach"]);
  assert.deepEqual(savedProfiles, [
    {
      name: "  Ken  ",
      goals: ["Ship Leena"],
      about: "Likes direct answers.",
      voice: "cedar",
    },
  ]);
  assert.equal(saved.persona, "coach");
  assert.equal(saved.personaId, "coach");
  assert.deepEqual(saved.activePersona, COACH_PERSONA);
  assert.deepEqual(changes, [{ action: "set-profile", personaId: "coach", type: "identity" }]);
});

test("profile compatibility helpers strip identity-only fields before legacy persistence", () => {
  assert.deepEqual(
    stripIdentityProfileFields({
      name: "Ken",
      goals: [],
      about: "",
      voice: "marin",
      persona: { id: "coach" },
      personaId: "coach",
      activePersona: COACH_PERSONA,
      legacyPersona: "honest",
    }),
    {
      name: "Ken",
      goals: [],
      about: "",
      voice: "marin",
    },
  );

  assert.deepEqual(
    stripIdentityProfileFields({
      name: "Ken",
      goals: [],
      about: "",
      voice: "marin",
      persona: "coach",
    }),
    {
      name: "Ken",
      goals: [],
      about: "",
      voice: "marin",
      persona: "coach",
    },
  );
});
