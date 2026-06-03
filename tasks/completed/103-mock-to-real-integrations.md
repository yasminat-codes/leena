---
id: "103"
title: "Integrations screen: mock to real data"
type: feature
status: completed
priority: high
complexity: M
estimated_tokens: 15000
dependencies: ["016", "084"]
context_files:
  - src/renderer/index.html
  - src/renderer/renderer.js
  - src/mcp/server-store.js
skills: []
tags: [phase-7, ui, wire-live, integrations, mcp]
attempts: 1
claim_started: "2026-06-03T04:02:39Z"
completed_at: "2026-06-03T04:24:04Z"
created_at: "2026-06-01"
---

## Objective
Replace the Integrations screen's mock tile grid with live MCP server data, showing real connection status and wiring add/remove/connect buttons to MCP IPC channels.

## Why This Matters
MCP is Leena's extensibility surface — users add tools by connecting MCP servers. A broken or mock-only integrations screen means users can't configure the most powerful feature.

## Steps
1. Remove fixture tiles from the Integrations screen; replace with `async loadIntegrations()` calling `window.leena.mcp.listServers()`.
2. Render each server as a tile with: name, transport badge (HTTP/stdio), connection status indicator (green=connected, yellow=connecting, red=disconnected/error), and tool count.
3. Wire the "Add Server" button to open an add-server dialog that collects name, transport type, URL or command, and calls `window.leena.mcp.addServer(config)`.
4. Wire per-tile "Connect"/"Disconnect" toggle to `window.leena.mcp.connect(id)` / `window.leena.mcp.disconnect(id)`.
5. Wire per-tile "Remove" button (with confirmation) to `window.leena.mcp.removeServer(id)`.
6. Subscribe to connection state push events through `window.leena.mcp.onStatusChanged()` and reconcile `mcp:changed` where available to update tiles in real time without polling.

## Acceptance Criteria
- [x] Integrations screen shows real MCP servers from server store
- [x] Connection status updates live when servers connect/disconnect
- [x] Add server dialog validates input (URL for HTTP, command for stdio)
- [x] Remove server requires confirmation before deletion
- [x] Connect/disconnect toggles work per server
- [x] No fixture data remains in Integrations screen code

## Tests Required
- `test/integrations-screen-data.test.js` — mock IPC, verify tile rendering, add/remove flows, status update handling

## Outputs
- Modified `src/renderer/screens/integrations.js` (or equivalent)
- New `test/integrations-screen-data.test.js`

## Interface Contracts
- Depends on current `window.leena.mcp` preload methods backed by task 084 IPC channels: `listServers`, `addServer`, `removeServer`, `connect`, `disconnect`, `getStatus`
- Depends on `window.leena.mcp.onStatusChanged()` push events and reconciles `mcp:changed` when exposed
- Downstream: task 104 (Settings) may reference provider integrations

## Handoff Notes
- 2026-06-03T04:18:18Z: Replaced the static fixture tile array in `src/renderer/screens/integrations.js` with live MCP loading via current `window.leena.mcp` APIs: `listServers()`, `getStatus()`, `addServer()`, `connect()`, `disconnect()`, `removeServer()`, and `onStatusChanged()`.
- `renderIntegrations()` still returns mountable HTML and now schedules hydration when a renderer bridge is present, avoiding shared `src/renderer/shell.js`/`src/preload.js` edits while the parent integration owns those files.
- Live tiles render server name, HTTP/stdio transport, connected/connecting/disconnected/error state, endpoint/command, and tool count. Add-server validation requires a valid `http(s)` URL for HTTP servers and a non-empty command for stdio servers.
- Added `test/integrations-screen-data.test.js` for mocked MCP bridge loading, add/remove/connect/disconnect flows, validation, and `mcp:status-changed`/`mcp:changed` reconciliation. Updated stale `test/integrations-screen.test.js` because it imported the removed fixture export and blocked full `node --test`.
- Verification passed: `npm run check`; `node --test test/integrations-screen-data.test.js`; `node --test test/integrations-screen-data.test.js test/integrations-screen.test.js`; full `node --test` (436/436).

## Errors Encountered
- Initial full `node --test` failed only because stale `test/integrations-screen.test.js` still imported `MOCK_INTEGRATIONS_DATA`; updated that test to the live MCP contract.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Status indicator stuck on "connecting" | user report or timeout | >10s in connecting state | Add connection timeout; flip to error after 10s |
| Add server accepts invalid config | test failure | 1 occurrence | Add client-side URL/command validation before IPC call |
| Remove deletes without confirm | test or user report | 1 occurrence | Verify confirm dialog is blocking before IPC call |
