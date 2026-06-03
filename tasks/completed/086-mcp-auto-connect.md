---
id: "086"
title: "Auto-connect MCP servers on app launch"
type: feature
status: completed
priority: medium
complexity: S
estimated_tokens: 8000
dependencies: ["080", "081", "035"]
context_files:
  - src/main.js
skills: []
tags: [phase-5, mcp, lifecycle]
attempts: 1
claim_started: "2026-06-03T02:05:04Z"
completed_at: "2026-06-03T02:54:10Z"
created_at: "2026-06-01"
---

## Objective
On app startup, automatically connect to MCP servers that have `auto_connect` enabled, running connections in the background without blocking the main window from appearing.

## Why This Matters
Users expect their configured MCP tools to be available as soon as Leena launches. Manual reconnection after every restart would be friction that discourages MCP adoption. Background connection ensures the UI loads instantly while tools become available within seconds.

## Steps
1. In `src/main.js` (or `src/ipc/mcp-handlers.js`), add an `initMCPAutoConnect()` function. Call it after the main window is created and IPC handlers are registered — NOT in the critical path before window.show().
2. Inside `initMCPAutoConnect`: call `serverStore.getAutoConnectServers()` to get all servers with `auto_connect=1 AND enabled=1`. For each, call `mcpClientManager.connect(serverConfig)` wrapped in try/catch. Use `Promise.allSettled()` so one failed server doesn't block others.
3. For each connection result: if fulfilled, log success to diagnostics (`mcp:auto-connect:ok:{serverName}`). If rejected, log the error (`mcp:auto-connect:fail:{serverName}:{error.message}`) and schedule a retry using the retry utility (task 001) with max 3 attempts, 5-second base delay.
4. After all initial connections settle, emit an IPC event `mcp:status-changed` to the renderer so the tray/UI can update connection indicators. Include `{ connected: [...ids], failed: [...ids] }`.
5. Register `app.on('before-quit')` handler that calls `mcpClientManager.disconnectAll()` for clean shutdown. Ensure stdio child processes are killed.

## Acceptance Criteria
- [ ] Servers with `auto_connect=1 AND enabled=1` are connected on app launch
- [ ] Main window appears before MCP connections are established (non-blocking)
- [ ] Failed auto-connections are retried up to 3 times with backoff
- [ ] Failed connections after retries are logged but don't crash the app
- [ ] `mcp:status-changed` event sent to renderer after connections settle
- [ ] `before-quit` handler disconnects all MCP servers cleanly
- [ ] stdio child processes are killed on app quit (no orphans)

## Tests Required
- `test/mcp-auto-connect.test.js` — mock serverStore returning 3 servers (2 succeed, 1 fails). Verify all 3 attempted. Verify failed server retried. Verify status event emitted. Verify disconnectAll called on quit signal.

## Outputs
- `initMCPAutoConnect()` function in main process
- `before-quit` cleanup handler for MCP connections

## Interface Contracts
- **Phase 6 UI** listens for `mcp:status-changed` to update tray icon / integrations screen indicators
- Tray from **task 035** may show MCP connection count or indicator

## Handoff Notes
- 2026-06-03T02:25:19Z: Added `src/mcp/auto-connect.js` with `initMCPAutoConnect()`, `registerMCPAutoConnectCleanup()`, `cleanupMCPConnections()`, and `MCP_STATUS_CHANGED_CHANNEL`.
- `initMCPAutoConnect()` is intentionally non-blocking: it starts a background `completion` promise, loads `serverStore.getAutoConnectServers()`, connects every server through `Promise.allSettled()`, wraps each connect in `withRetry()` with default `{ maxAttempts: 3, baseDelay: 5000, maxDelay: 30000 }`, logs per-server diagnostics, and emits `mcp:status-changed` with `{ connected, failed }`.
- Failure isolation is covered for individual server failures, exhausted retry failures, logger failures, status emit failures, and `getAutoConnectServers()` store failures; none throw through startup once initialization has begun.
- `registerMCPAutoConnectCleanup()` wires `app.on("before-quit")` to `mcpClientManager.disconnectAll()`. Stdio process cleanup remains delegated to the task 080 `MCPClientManager.disconnectAll()` / `disconnect()` lifecycle.
- Added `test/mcp-auto-connect.test.js` covering the required 3-server case, retry attempts, non-blocking startup, status IPC emission, store-failure isolation, and before-quit cleanup/dispose behavior.
- Integration handoff: once shared `src/main.js` / task 084 IPC claims clear, import `ServerStore` plus the auto-connect helpers, create a `ServerStore`, call `initMCPAutoConnect({ serverStore, mcpClientManager, webContents: mainWindow.webContents, logger: writeDiagnosticLog })` after `createMainWindow()` and after MCP IPC handlers are registered, and call `registerMCPAutoConnectCleanup({ app, mcpClientManager, logger: writeDiagnosticLog })` once during app startup.

- Parent integration 2026-06-03T02:54:10Z: `src/main.js` now registers MCP handlers and starts non-blocking MCP auto-connect after window creation; cleanup is wired on `before-quit`.

## Errors Encountered
- Initial `npm run check` attempts were blocked by concurrently claimed formatting/lint issues outside task 086. After those workers resolved their files, final verification passed: `npm run check`, full `node --test` (382/382), focused Biome, changed JS syntax checks, focused auto-connect tests, `git diff --check`, and task-artifact path scan.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Auto-connect delays app startup | time from app launch to window.show | >500ms added | Verify async; move further after window.show |
| Orphan stdio processes after quit | child processes surviving app exit | any | Add process.on('exit') fallback kill |
| Retry storm on unreachable server | retry attempts per minute for offline server | >10/min | Cap retries at 3 total, then stop until next launch |
