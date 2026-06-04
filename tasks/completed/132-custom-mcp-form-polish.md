---
id: "132"
title: "Custom MCP form polish"
type: ui
status: completed
wave: 19
priority: high
complexity: S
estimated_tokens: 9000
dependencies: ["131"]
context_files:
  - src/renderer/screens/integrations.js
  - src/mcp/server-store.js
  - test/integrations-screen.test.js
  - test/mcp-ipc-handlers.test.js
skills: []
tags: [mcp, integrations, form]
attempts: 1
claim_started: "2026-06-04T00:04:46Z"
completed_at: "2026-06-04T00:37:29Z"
created_at: "2026-06-03"
---

## Objective
Move the manual MCP HTTP/stdio setup into a polished Custom MCP detail with validation, test connection, and clear status.

## Why This Matters
MCP add is necessary, but the default raw form currently looks unfinished and confusing.

## Steps
1. Run kencode-search for MCP client/server management UI examples.
2. Put Name, Transport, URL, Command, Args, and optional headers into styled field rows.
3. Show only fields relevant to the selected transport.
4. Add inline validation and "Test connection" before Add when possible.
5. Preserve existing `addServer`, `connect`, `disconnect`, and `remove` behavior.
6. Add tests for validation and field visibility.

## Acceptance Criteria
- [x] HTTP and stdio fields are mutually focused.
- [x] Validation errors are visible and non-overlapping.
- [x] Add/Cancel/Test actions are styled consistently.
- [x] Existing MCP persistence and IPC tests pass.

## Tests Required
- `node --test test/integrations-screen.test.js test/mcp-ipc-handlers.test.js test/e2e-mcp-connect.test.js`
- `npm run check`

## Outputs
- `src/renderer/screens/integrations.js`
- Integration/MCP tests as needed.

## Interface Contracts
Transport values remain `http` and `stdio`, matching current MCP store and IPC handlers.

## Handoff Notes
- Changed `src/renderer/screens/integrations.js` and `test/integrations-screen.test.js`.
- Custom MCP detail now uses dense styled field rows for Name, Transport, HTTP URL, optional HTTP headers, stdio Command, and Args.
- Transport visibility is centralized through `getMCPSetupFieldVisibility`; HTTP shows URL/headers while stdio shows Command/Args.
- Added inline per-field validation plus form summary status, with parsed optional HTTP headers and preserved normal add payloads when headers are empty.
- Added a `Test connection` action before Add that validates the draft and calls `window.leena.mcp.testConnection` when available; Add/connect/disconnect/remove flows remain on the existing bridge methods.
- Gates passed:
  - `node --check src/renderer/screens/integrations.js`
  - `node --check test/integrations-screen.test.js`
  - `node --test test/integrations-screen.test.js test/mcp-ipc-handlers.test.js test/e2e-mcp-connect.test.js` (20/20)
  - `node --test test/integrations-screen-data.test.js` (8/8)

- 2026-06-04T00:37:29Z parent verification: Custom MCP form polish completed with HTTP/stdio field visibility, inline validation, optional header parsing, test connection, and preserved add/connect/disconnect/remove contracts. Gates passed: `npm run check`, `node --test test/integrations-screen.test.js test/integrations-screen-data.test.js test/mcp-ipc-handlers.test.js test/e2e-mcp-connect.test.js`, full `node --test` (596/596), and output existence checks.
- 2026-06-04T00:52:20Z reviewer fix: preserved optional Custom MCP HTTP headers through MCP IPC normalization, server-store persistence, temporary test connections, and HTTP transport E2E coverage; switching to stdio clears headers. Focused reviewer-fix gate passed (33/33).
- 2026-06-04T01:14:30Z final reviewer fix: direct MCP IPC/store header validation now mirrors the renderer's HTTP token rule, so invalid names such as spaces or colons are rejected before persistence or connect. Gates passed: focused reviewer-fix tests (39/39), `npm run check`, and full `node --test` (605/605).
- 2026-06-04T01:31:47Z terminal reviewer fix: direct MCP IPC/store header validation now rejects blank header values, direct `mcp:list-tools` errors are sanitized before renderer IPC, and MCP tool execution error text redacts secret header values. Gates passed: focused Calendar/MCP gate (38/38), `npm run check`, and full `node --test` (607/607).

## Errors Encountered
- Earlier worker-local Settings/UI smoke failures were resolved by the parent Wave 19 integration and terminal reviewer fixes. Current terminal gates pass: focused Calendar/MCP gate (38/38), `npm run check`, and full `node --test` (607/607).

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Wrong field visible | Transport change test | Any mismatch | Fix visibility mapper |
| Invalid server saved | Validation bypassed | Any occurrence | Block submit |
| Existing MCP breaks | IPC tests fail | Any failure | Preserve payload shape |
