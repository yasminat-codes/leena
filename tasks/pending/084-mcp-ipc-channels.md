---
id: "084"
title: "MCP IPC channels for renderer"
type: feature
status: pending
priority: high
complexity: M
estimated_tokens: 14000
dependencies: ["080", "081"]
context_files:
  - src/main.js
  - src/preload.js
skills: []
tags: [phase-5, mcp, ipc]
attempts: 0
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
- [ ] `mcp:list-servers` returns array of all configured server records
- [ ] `mcp:add-server` creates a server record and returns it with generated id
- [ ] `mcp:add-server` rejects invalid configs with descriptive error
- [ ] `mcp:remove-server` disconnects (if connected) then deletes server record
- [ ] `mcp:connect` and `mcp:disconnect` manage live connections
- [ ] `mcp:list-tools` returns tool definitions from a connected server
- [ ] `mcp:test-connection` performs a probe and returns reachability + latency
- [ ] `mcp:get-status` returns connection status for all servers
- [ ] All channels exposed in preload under `window.leena.mcp` (or `window.brah.mcp`)
- [ ] Input validation rejects bad configs before hitting the store

## Tests Required
- `test/mcp-ipc-handlers.test.js` — test each handler function in isolation (mock serverStore + mcpClientManager). Verify add validates transport+url/command. Verify remove disconnects before deleting. Verify test-connection timeout. Verify error propagation from client manager.

## Outputs
- `src/ipc/mcp-handlers.js` (or additions to `src/main.js`) — IPC handler registrations
- Updated `src/preload.js` — `window.leena.mcp` API surface

## Interface Contracts
- **Phase 6 UI** depends on `window.leena.mcp.*` methods for the Integrations screen
- **Task 086** depends on `mcp:connect` handler being registered before auto-connect runs

## Handoff Notes
[Filled after completion]

## Errors Encountered
[Filled if errors occur]

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| IPC channel not registered at call time | "No handler registered" error | any | Ensure handler registration runs in main.js before window load |
| Preload API out of sync with handlers | method exists in preload but no handler | any | Add integration test that calls each preload method |
| test-connection hangs | no response within 10s | any | Verify timeout is enforced; add AbortController |
