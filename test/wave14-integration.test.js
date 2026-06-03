import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readProjectFile(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("Wave 14 main process avoids stale nudge cache during forced refreshes", () => {
  const mainSource = readProjectFile("src/main.js");

  assert.match(mainSource, /if \(nudgeRefreshPromise\?\.force\) \{/);
  assert.match(mainSource, /return nudgeRefreshPromise\.promise;/);
  assert.match(mainSource, /latestNudgePayload = createStaleNudgePayload\(\);/);
  assert.match(mainSource, /nudgeRefreshPromise = \{ force, generation, promise \};/);
});

test("Wave 14 main process broadcasts identity changes for realtime secret invalidation", () => {
  const mainSource = readProjectFile("src/main.js");

  assert.match(mainSource, /onChanged: broadcastIdentityChanged/);
  assert.match(
    mainSource,
    /registerIdentityHandlers\(\{ ipcMain, onChanged: broadcastIdentityChanged/,
  );
  assert.match(mainSource, /function broadcastIdentityChanged\(details = \{\}\) \{/);
  assert.match(
    mainSource,
    /broadcastDataChanged\("identity", \{ type: "identity", \.\.\.details \}\);/,
  );
});

test("Wave 14 renderer applies persona changes to live realtime sessions", () => {
  const rendererSource = readProjectFile("src/renderer/renderer.js");
  const settingsSource = readProjectFile("src/renderer/screens/settings.js");

  assert.match(settingsSource, /emitPersonaChanged\(root, \{/);
  assert.match(settingsSource, /"leena:persona-changed"/);
  assert.match(rendererSource, /window\.addEventListener\("leena:persona-changed"/);
  assert.match(rendererSource, /window\.leena\.onDataChanged\?\.\(handleDataChanged\);/);
  assert.match(rendererSource, /void handleAgentRuntimeConfigChanged\(null\);/);
  assert.match(rendererSource, /invalidatePrefetchedSecret\(\);[\s\S]*prefetchRealtimeSecret\(\);/);
  assert.match(rendererSource, /createPersonaSessionUpdate\(\)/);
  assert.match(rendererSource, /generation !== secretPrefetchGeneration/);
  assert.match(rendererSource, /type: "session\.update"/);
  assert.match(rendererSource, /secretPrefetchGeneration \+= 1;/);
});

test("Wave 14 persona session updates refresh realtime tool definitions", () => {
  const mainSource = readProjectFile("src/main.js");

  assert.match(
    mainSource,
    /const \{ activePersona, session, tools \} = await createRealtimeSessionConfig\(\);/,
  );
  assert.match(mainSource, /return \{ activePersona, session: \{ \.\.\.session, tools \} \};/);
});
