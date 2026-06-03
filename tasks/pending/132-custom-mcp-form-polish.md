---
id: "132"
title: "Custom MCP form polish"
type: ui
status: pending
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
attempts: 0
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
- [ ] HTTP and stdio fields are mutually focused.
- [ ] Validation errors are visible and non-overlapping.
- [ ] Add/Cancel/Test actions are styled consistently.
- [ ] Existing MCP persistence and IPC tests pass.

## Tests Required
- `node --test test/integrations-screen.test.js test/mcp-ipc-handlers.test.js test/e2e-mcp-connect.test.js`
- `npm run check`

## Outputs
- `src/renderer/screens/integrations.js`
- Integration/MCP tests as needed.

## Interface Contracts
Transport values remain `http` and `stdio`, matching current MCP store and IPC handlers.

## Handoff Notes
To be filled by executor.

## Errors Encountered
To be filled if errors occur.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Wrong field visible | Transport change test | Any mismatch | Fix visibility mapper |
| Invalid server saved | Validation bypassed | Any occurrence | Block submit |
| Existing MCP breaks | IPC tests fail | Any failure | Preserve payload shape |
