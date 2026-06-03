import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readProjectFile(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("Wave 12 memory and identity handlers are registered in main", () => {
  const mainSource = readProjectFile("src/main.js");

  assert.ok(mainSource.includes('import { PersonaEngine } from "./identity/persona-engine.js";'));
  assert.ok(
    mainSource.includes('import { registerMemoryHandlers } from "./ipc/memory-handlers.js";'),
  );
  assert.ok(mainSource.includes("createAgentProfileIdentityAdapters"));
  assert.ok(mainSource.includes("registerIdentityHandlers"));
  assert.match(mainSource, /registerMemoryHandlers\(\{ ipcMain, store: getMemoryStore\(\) \}\);/);
  assert.match(mainSource, /new SQLiteMemoryStore\(\{\s*providerRegistry: getRegistry\(\),\s*\}\)/);
  assert.match(mainSource, /new PersonaEngine\(\{ settingsStore: settingsStoreBridge \}\)/);
  assert.match(mainSource, /registerIdentityHandlers\(\{ ipcMain, personaEngine \}\);/);
});

test("Wave 12 preload bridge exposes memory and identity APIs", () => {
  const preloadSource = readProjectFile("src/preload.js");

  for (const channel of [
    "memory:remember",
    "memory:recall",
    "memory:get-conversation",
    "memory:consolidate",
    "memory:stats",
    "identity:list-personas",
    "identity:switch-persona",
    "identity:create-persona",
    "identity:update-persona",
    "identity:delete-persona",
  ]) {
    assert.ok(preloadSource.includes(`ipcRenderer.invoke("${channel}"`), `missing ${channel}`);
  }

  assert.ok(preloadSource.includes("\n  memory: {"));
  assert.ok(preloadSource.includes("\n  identity: {"));
});
