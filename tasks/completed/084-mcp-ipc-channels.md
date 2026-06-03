---
id: "084"
title: "MCP IPC channels for renderer"
type: feature
status: completed
priority: high
complexity: M
estimated_tokens: 14000
dependencies: ["080", "081"]
context_files:
  - src/main.js
  - src/preload.js
skills: []
tags: [phase-5, mcp, ipc]
attempts: 1
claim_started: "2026-06-03T02:05:04Z"
completed_at: "2026-06-03T02:26:41Z"
created_at: "2026-06-01"
---

## Objective
Wire MCP server management operations through Electron IPC channels so the renderer (settings UI) can list, add, remove, connect, disconnect, and inspect MCP servers.

## Why This Matters
The renderer process cannot access Node.js APIs directly (context isolation). IPC channels bridge the gap, letting the Integrations settings screen manage MCP servers through the secure preload bridge. Without these channels, MCP configuration is code-only with no user-facing management.

## Steps
1. Add IPC handlers in `src/main.js` (or a new `src/ipc/mcp-handlers.js` if main.js is too large). Register handlers for: `mcp:list-servers`, `mcp:add-server`, `mcp:remove-server`, `mcp:update-server`, `mcp:connect`, `mcp:disconnect`, `mcp:list-tools`, `mcp:test-connection`, `mcp:get-status`.
2. Implement each handler: `mcp:list-servers` → calls `serverStore.listServers()`; `mcp:add-server` → validates input, calls `serverStore.addServer(config)`, optionally calls `mcpClientManager.connect()` if `auto_connect`; `mcp:remove-server` → calls `mcpClientManager.disconnect(id)` then `serverStore.removeServer(id)`; `mcp:update-server` → calls `serverStore.updateServer(id, updates)`.
3. Implement connection handlers: `mcp:connect` → calls `mcpClientManager.connect(serverConfig)`, returns `{ connected: true, toolCount }` or throws; `mcp:disconnect` → calls `mcpClientManager.disconnect(id)`; `mcp:list-tools` → calls `mcpClientManager.listTools(id)`, returns tool array; `mcp:get-status` → calls `mcpClientManager.getStatus()`.
4. Implement `mcp:test-connection` → creates a temporary connection to the server, calls `listTools`, disconnects, returns `{ reachable: true, toolCount, latencyMs }` or `{ reachable: false, error: message }`. Wraps in a 10-second timeout.
5. Expose all channels in `src/preload.js` under `window.leena.mcp` (or `window.brah.mcp` pre-rename): `listServers()`, `addServer(config)`, `removeServer(id)`, `updateServer(id, updates)`, `connect(id)`, `disconnect(id)`, `listTools(id)`, `testConnection(config)`, `getStatus()`. All return Promises via `ipcRenderer.invoke`.
6. Add input validation in each handler: `add-server` requires `name` (string, non-empty) and `transport` ("http" or "stdio"); http requires `url` (valid URL); stdio requires `command` (string, non-empty). Return structured errors for invalid input.

## Acceptance Criteria
- [x] `mcp:list-servers` returns array of all configured server records
- [x] `mcp:add-server` creates a server record and returns it with generated id
- [x] `mcp:add-server` rejects invalid configs with descriptive error
- [x] `mcp:remove-server` disconnects (if connected) then deletes server record
- [x] `mcp:connect` and `mcp:disconnect` manage live connections
- [x] `mcp:list-tools` returns tool definitions from a connected server
- [x] `mcp:test-connection` performs a probe and returns reachability + latency
- [x] `mcp:get-status` returns connection status for all servers
- [ ] All channels exposed in preload under `window.leena.mcp` (or `window.brah.mcp`) — deferred to shared integration pass
- [x] Input validation rejects bad configs before hitting the store

## Tests Required
- `test/mcp-ipc-handlers.test.js` — test each handler function in isolation (mock serverStore + mcpClientManager). Verify add validates transport+url/command. Verify remove disconnects before deleting. Verify test-connection timeout. Verify error propagation from client manager.

## Outputs
- `src/ipc/mcp-handlers.js` — task-owned MCP IPC channel constants, handler registration, injectable handler factory, validation, timeout probe, status merge, and serialized MCP error helper.
- `test/mcp-ipc-handlers.test.js` — focused IPC handler tests for registration, CRUD validation, disconnect-before-delete ordering, connection lifecycle, status merging, test-connection success/failure/timeout, and error serialization.
- Deferred `src/main.js` / `src/preload.js` wiring to the shared integration pass because those files were not task-owned in this worker slice.

## Interface Contracts
- **Phase 6 UI** depends on `window.leena.mcp.*` methods for the Integrations screen
- **Task 086** depends on `mcp:connect` handler being registered before auto-connect runs

## Handoff Notes
- Implemented `registerMCPHandlers({ ipcMain, serverStore, mcpClientManager, createTempClientManager, webContents, timeoutMs, now })` in `src/ipc/mcp-handlers.js`.
- `registerMCPHandlers()` registers `mcp:list-servers`, `mcp:add-server`, `mcp:remove-server`, `mcp:update-server`, `mcp:connect`, `mcp:disconnect`, `mcp:list-tools`, `mcp:test-connection`, and `mcp:get-status`.
- `createMCPHandlers()` exposes the same handlers without Electron for isolated tests.
- Add/update validation is fail-closed before mutation: `name` required for add, transport must be `http` or `stdio`, HTTP requires valid `http(s)` URL, stdio requires a non-empty command, args must be string arrays without null bytes, booleans must be booleans, invalid permission levels normalize to `confirm`.
- `mcp:remove-server` attempts `mcpClientManager.disconnect(id)` before `serverStore.removeServer(id)`, but disconnect cleanup is best-effort so a stale/disconnected live client cannot block deletion of the saved server row.
- `mcp:connect` loads the stored server config, connects with `serverId`, immediately lists tools, returns `{ serverId, name, transport, connected: true, toolCount }`, and disconnects again if post-connect tool listing fails.
- `mcp:test-connection` uses an injectable temporary client manager, defaults to a 10-second timeout, accepts unsaved test configs, returns `{ reachable: true, toolCount, latencyMs }` on success, and returns `{ reachable: false, error, latencyMs }` on probe failure or timeout.
- `mcp:get-status` returns an object keyed by server id, merging all configured servers with live `mcpClientManager.getStatus()` entries so configured-but-disconnected servers are explicit.
- Main integration API when `src/main.js` is claim-free:
  ```js
  import { registerMCPHandlers } from "./ipc/mcp-handlers.js";
  import { ServerStore } from "./mcp/server-store.js";

  registerMCPHandlers({
    ipcMain,
    serverStore: new ServerStore(),
    mcpClientManager,
    webContents: mainWindow?.webContents,
  });
  ```
- Preload integration API when `src/preload.js` is claim-free:
  ```js
  mcp: {
    listServers: () => ipcRenderer.invoke("mcp:list-servers"),
    addServer: (config) => ipcRenderer.invoke("mcp:add-server", config),
    removeServer: (id) => ipcRenderer.invoke("mcp:remove-server", id),
    updateServer: (id, updates) => ipcRenderer.invoke("mcp:update-server", id, updates),
    connect: (id) => ipcRenderer.invoke("mcp:connect", id),
    disconnect: (id) => ipcRenderer.invoke("mcp:disconnect", id),
    listTools: (id) => ipcRenderer.invoke("mcp:list-tools", id),
    testConnection: (config) => ipcRenderer.invoke("mcp:test-connection", config),
    getStatus: () => ipcRenderer.invoke("mcp:get-status"),
  }
  ```
- Verification passed: `npx biome check src/ipc/mcp-handlers.js test/mcp-ipc-handlers.test.js`, `node --check src/ipc/mcp-handlers.js && node --check test/mcp-ipc-handlers.test.js`, `node --test test/mcp-ipc-handlers.test.js`, focused MCP suite (`test/mcp-ipc-handlers.test.js test/mcp-client.test.js test/mcp-server-store.test.js test/mcp-tool-execution.test.js test/mcp-permission-gate.test.js test/mcp-schema-converter.test.js`) with 47 passing, `npm run check`, and full `node --test` with 374 passing.

## Errors Encountered
- Initial focused Biome check found two formatting-only changes in the new handler/test files; applied the exact formatter adjustments and reran the focused checks successfully.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| IPC channel not registered at call time | "No handler registered" error | any | Ensure handler registration runs in main.js before window load |
| Preload API out of sync with handlers | method exists in preload but no handler | any | Add integration test that calls each preload method |
| test-connection hangs | no response within 10s | any | Verify timeout is enforced; add AbortController |
