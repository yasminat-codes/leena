import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  loadProviderApiKey,
  PROVIDER_API_KEY_KEYS,
  saveProviderApiKey,
} from "../src/providers/provider-settings.js";
import { closeDatabase, getDatabase } from "../src/realtime/tools/database.js";
import { getAllSettings, getString, setSetting } from "../src/settings-store.js";

const SECRET_CODEC = Object.freeze({
  protect(secret) {
    return `protected:${Buffer.from(secret, "utf8").toString("base64")}`;
  },
  reveal(payload) {
    return Buffer.from(payload.replace(/^protected:/, ""), "base64").toString("utf8");
  },
});

test("settings values and protected provider secrets persist across database reopen", async () => {
  await withSettingsDb(async (storePath) => {
    const openAiKey = "sk-e2e-settings-secret-1234567890";

    setSetting("theme", "workspace", storePath);
    setSetting("defaultProvider", "openrouter", storePath);
    setSetting("hotkey", "CommandOrControl+Alt+Space", storePath);
    const protectedPayload = saveProviderApiKey("openai", openAiKey, storePath, SECRET_CODEC);

    assert.notEqual(protectedPayload, openAiKey);
    closeDatabase(storePath);

    assert.equal(getString("theme", "dark", storePath), "workspace");
    assert.equal(getString("defaultProvider", "openai", storePath), "openrouter");
    assert.equal(getString("hotkey", "", storePath), "CommandOrControl+Alt+Space");

    const settings = getAllSettings(storePath);
    assert.equal(settings.theme, "workspace");
    assert.equal(settings.defaultProvider, "openrouter");
    assert.equal(settings.hotkey, "CommandOrControl+Alt+Space");

    const storedSecret = getDatabase(storePath)
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get(PROVIDER_API_KEY_KEYS.openai).value;
    assert.equal(storedSecret.includes(openAiKey), false);
    assert.equal(loadProviderApiKey("openai", storePath, SECRET_CODEC), openAiKey);
  });
});

async function withSettingsDb(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), "leena-e2e-settings-"));
  const storePath = path.join(directory, "lena.db");
  try {
    await callback(storePath);
  } finally {
    closeDatabase(storePath);
    await rm(directory, { force: true, recursive: true });
  }
}
