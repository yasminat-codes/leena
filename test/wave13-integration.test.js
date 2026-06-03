import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readProjectFile(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("Wave 13 main process wires chat and memory-aware realtime sessions", () => {
  const mainSource = readProjectFile("src/main.js");

  assert.ok(mainSource.includes('import { registerChatHandlers } from "./ipc/chat-handlers.js";'));
  assert.ok(mainSource.includes('import { SQLiteMemoryStore } from "./memory/index.js";'));
  assert.ok(
    mainSource.includes('import { createMemoryMiddleware } from "./memory/memory-middleware.js";'),
  );
  assert.match(
    mainSource,
    /const memories = await getMemoryMiddleware\(\)\.onSessionStart\(profile\);/,
  );
  assert.match(mainSource, /const activePersona = personaEngine\.getActive\(\);/);
  assert.match(mainSource, /const tools = await getRealtimeToolDefinitions\(mcpClientManager\);/);
  assert.match(
    mainSource,
    /buildRealtimeInstructions\(\{ profile, memories, persona: activePersona, tools \}\)/,
  );
  assert.match(mainSource, /ipcMain\.handle\("realtime:create-persona-session-update"/);
  assert.match(mainSource, /resolveRealtimeVoicePreference\(profile, activePersona\)/);
  assert.match(mainSource, /registerMemoryHandlers\(\{ ipcMain, store: getMemoryStore\(\) \}\);/);
  assert.match(mainSource, /registerChatHandlers\(\{\s*ipcMain,\s*registry: getRegistry\(\),/s);
  assert.match(mainSource, /executeTool: \(name, args\) => executeRealtimeToolWithAudit/);
  assert.match(
    mainSource,
    /getToolDefinitions: \(\) => getRealtimeToolDefinitions\(mcpClientManager\)/,
  );
});

test("Wave 13 preload bridge exposes text chat send and chunk listeners", () => {
  const preloadSource = readProjectFile("src/preload.js");

  assert.ok(preloadSource.includes('send: (payload) => ipcRenderer.invoke("chat:send", payload)'));
  assert.ok(
    preloadSource.includes('sendChat: (payload) => ipcRenderer.invoke("chat:send", payload)'),
  );
  assert.ok(preloadSource.includes('onChatChunk: (callback) => onIpc("chat:chunk", callback)'));
  assert.ok(preloadSource.includes('offChatChunk: (listener) => offIpc("chat:chunk", listener)'));
  assert.ok(
    preloadSource.includes(
      'getEpisodes: (options) => ipcRenderer.invoke("memory:get-episodes", options)',
    ),
  );
});

test("Wave 13 renderer enables live text chat and records realtime memories", () => {
  const rendererSource = readProjectFile("src/renderer/renderer.js");

  assert.ok(rendererSource.includes("chat: { bridge: window.leena, eventSource: window.leena }"));
  assert.ok(rendererSource.includes("realtimeConversationId = createRealtimeConversationId();"));
  assert.ok(rendererSource.includes("void rememberRealtimeExchange(event);"));
  assert.ok(rendererSource.includes("await window.leena.memory.remember(exchange.content"));
  assert.ok(rendererSource.includes("maybeConsolidateRealtimeMemory(conversationId)"));
  assert.ok(rendererSource.includes("window.leena.onDataChanged?.(handleDataChanged);"));
  assert.ok(rendererSource.includes("void handleAgentRuntimeConfigChanged(null);"));
  assert.match(
    rendererSource,
    /Array\.isArray\(episodes\) && episodes\.length <= 10[\s\S]*return null;/,
  );
});
