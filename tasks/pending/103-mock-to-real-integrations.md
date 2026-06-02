---
id: "103"
title: "Integrations screen: mock to real data"
type: feature
status: pending
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
attempts: 0
created_at: "2026-06-01"
---

## Objective
Replace the Integrations screen's mock tile grid with live MCP server data, showing real connection status and wiring add/remove/connect buttons to MCP IPC channels.

## Why This Matters
MCP is Leena's extensibility surface — users add tools by connecting MCP servers. A broken or mock-only integrations screen means users can't configure the most powerful feature.

## Steps
1. Remove fixture tiles from the Integrations screen; replace with `async loadIntegrations()` calling `window.leena.invoke('mcp:list-servers')`.
2. Render each server as a tile with: name, transport badge (HTTP/stdio), connection status indicator (green=connected, yellow=connecting, red=disconnected/error), and tool count.
3. Wire the "Add Server" button to open an add-server dialog that collects name, transport type, URL or command, and calls `window.leena.invoke('mcp:add-server', config)`.
4. Wire per-tile "Connect"/"Disconnect" toggle to `window.leena.invoke('mcp:connect', { id })` / `mcp:disconnect`.
5. Wire per-tile "Remove" button (with confirmation) to `window.leena.invoke('mcp:remove-server', { id })`.
6. Subscribe to connection state push events (`mcp:status-changed`) to update tiles in real-time without polling.

## Acceptance Criteria
- [ ] Integrations screen shows real MCP servers from server store
- [ ] Connection status updates live when servers connect/disconnect
- [ ] Add server dialog validates input (URL for HTTP, command for stdio)
- [ ] Remove server requires confirmation before deletion
- [ ] Connect/disconnect toggles work per server
- [ ] No fixture data remains in Integrations screen code

## Tests Required
- `test/integrations-screen-data.test.js` — mock IPC, verify tile rendering, add/remove flows, status update handling

## Outputs
- Modified `src/renderer/screens/integrations.js` (or equivalent)
- New `test/integrations-screen-data.test.js`

## Interface Contracts
- Depends on `mcp:list-servers`, `mcp:add-server`, `mcp:remove-server`, `mcp:connect`, `mcp:disconnect` IPC channels (task 084)
- Depends on `mcp:status-changed` push event from main process
- Downstream: task 104 (Settings) may reference provider integrations

## Handoff Notes
[Filled after completion]

## Errors Encountered
[Filled if errors occur]

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Status indicator stuck on "connecting" | user report or timeout | >10s in connecting state | Add connection timeout; flip to error after 10s |
| Add server accepts invalid config | test failure | 1 occurrence | Add client-side URL/command validation before IPC call |
| Remove deletes without confirm | test or user report | 1 occurrence | Verify confirm dialog is blocking before IPC call |
