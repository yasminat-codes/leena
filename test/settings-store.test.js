import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { closeDatabase, getDatabase } from "../src/realtime/tools/database.js";
import {
  DEFAULT_SETTINGS,
  deleteSetting,
  getAllSettings,
  getBool,
  getJSON,
  getNumber,
  getSetting,
  getString,
  setSetting,
} from "../src/settings-store.js";

async function withSettingsDb(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), "leena-settings-"));
  const filePath = path.join(directory, "lena.db");
  try {
    await callback(filePath);
  } finally {
    closeDatabase(filePath);
    await rm(directory, { force: true, recursive: true });
  }
}

function readStoredValue(filePath, key) {
  const row = getDatabase(filePath).prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row?.value ?? null;
}

test("string settings round-trip through typed and generic reads", async () => {
  await withSettingsDb((filePath) => {
    assert.equal(setSetting("theme", "light", filePath), "light");

    assert.equal(readStoredValue(filePath, "theme"), JSON.stringify("light"));
    assert.equal(getSetting("theme", undefined, filePath), "light");
    assert.equal(getString("theme", "dark", filePath), "light");
  });
});

test("boolean settings round-trip through getBool", async () => {
  await withSettingsDb((filePath) => {
    assert.equal(setSetting("launchOnLogin", true, filePath), true);

    assert.equal(getSetting("launchOnLogin", false, filePath), true);
    assert.equal(getBool("launchOnLogin", false, filePath), true);
  });
});

test("number settings round-trip through getNumber", async () => {
  await withSettingsDb((filePath) => {
    assert.equal(setSetting("volume", 0.75, filePath), 0.75);

    assert.equal(getSetting("volume", 0, filePath), 0.75);
    assert.equal(getNumber("volume", 0, filePath), 0.75);
  });
});

test("JSON object and array settings round-trip through getJSON", async () => {
  await withSettingsDb((filePath) => {
    const objectValue = { enabled: true, providers: ["openai", "ollama"] };
    const arrayValue = [{ name: "daily" }, { name: "weekly" }];

    assert.deepEqual(setSetting("customConfig", objectValue, filePath), objectValue);
    assert.deepEqual(setSetting("savedViews", arrayValue, filePath), arrayValue);

    assert.deepEqual(getSetting("customConfig", {}, filePath), objectValue);
    assert.deepEqual(getJSON("customConfig", {}, filePath), objectValue);
    assert.deepEqual(getJSON("savedViews", [], filePath), arrayValue);
  });
});

test("missing keys use explicit defaults or the built-in settings map", async () => {
  await withSettingsDb((filePath) => {
    assert.equal(getSetting("missing", "fallback", filePath), "fallback");
    assert.equal(getSetting("theme", undefined, filePath), DEFAULT_SETTINGS.theme);
    assert.equal(getBool("launchOnLogin", undefined, filePath), DEFAULT_SETTINGS.launchOnLogin);
    assert.equal(getString("hotkey", undefined, filePath), DEFAULT_SETTINGS.hotkey);
    assert.equal(getNumber("missingNumber", 42, filePath), 42);
    assert.deepEqual(getJSON("missingJson", { fallback: true }, filePath), { fallback: true });
  });
});

test("deleteSetting removes custom rows and getAllSettings returns defaults plus saved values", async () => {
  await withSettingsDb((filePath) => {
    setSetting("theme", "light", filePath);
    setSetting("customConfig", { enabled: true }, filePath);
    setSetting("transient", "remove-me", filePath);

    assert.equal(deleteSetting("transient", filePath), true);
    assert.equal(deleteSetting("transient", filePath), false);

    const allSettings = getAllSettings(filePath);
    assert.equal(allSettings.theme, "light");
    assert.equal(allSettings.transient, undefined);
    assert.deepEqual(allSettings.customConfig, { enabled: true });
    assert.equal(allSettings.treatment, DEFAULT_SETTINGS.treatment);
    assert.equal(allSettings.defaultEmbeddingModel, DEFAULT_SETTINGS.defaultEmbeddingModel);
  });
});

test("overwrites existing values and typed helpers fall back on type mismatch", async () => {
  await withSettingsDb((filePath) => {
    setSetting("density", "comfortable", filePath);
    setSetting("density", "compact", filePath);
    setSetting("wakeMuted", "not-a-boolean", filePath);

    assert.equal(getSetting("density", undefined, filePath), "compact");
    assert.equal(getBool("wakeMuted", false, filePath), false);
  });
});

test("legacy raw string rows remain readable from the shared settings table", async () => {
  await withSettingsDb((filePath) => {
    getDatabase(filePath)
      .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
      .run("provider:default:chat", "openai");

    assert.equal(getSetting("provider:default:chat", null, filePath), "openai");
    assert.equal(getString("provider:default:chat", null, filePath), "openai");
  });
});
