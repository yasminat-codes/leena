---
id: "134"
title: "Composio MCP tool refresh"
type: integration
status: pending
wave: 19
priority: critical
complexity: M
estimated_tokens: 15000
dependencies: ["133"]
context_files:
  - src/mcp/client-manager.js
  - src/mcp/server-store.js
  - src/mcp/schema-converter.js
  - src/realtime/tools/index.js
  - test/mcp-integration.test.js
skills: []
tags: [composio, mcp, tools, integrations]
attempts: 0
created_at: "2026-06-03"
---

## Objective
Connect Composio as an Actions Hub integration that can test credentials, refresh available tools, and expose approved tools through the existing MCP schema/permission path.

## Why This Matters
Composio should be first-class, but it must not bypass MCP safety, schema conversion, or permission gates.

## Steps
1. Re-read task 120 reference brief and verify current Composio SDK/MCP endpoint APIs.
2. Add a Composio integration service that creates or refreshes the configured MCP server entry.
3. Add IPC/preload methods for test connection, refresh tools, list connected apps/toolkits, and open app auth when supported.
4. Route Composio tool definitions through existing `mcpToolToOpenAI` and permission gate logic.
5. Limit enabled toolkits to explicit user selection.
6. Add tests for refresh, redaction, and fail-closed tool exposure.

## Acceptance Criteria
- [ ] Composio appears as configured when credential exists.
- [ ] Refresh Tools updates tool count/status.
- [ ] No Composio tool bypasses MCP namespacing or permissions.
- [ ] Missing/stale metadata fails closed.

## Tests Required
- `node --test test/mcp-integration.test.js test/mcp-permission-gate.test.js test/mcp-schema-converter.test.js`
- New Composio integration tests with mocked SDK/HTTP.
- `npm run check`

## Outputs
- Composio integration service/IPC files.
- `src/preload.js`
- `src/main.js` serialized integration handoff.
- Focused tests.

## Interface Contracts
Composio is an integration source; execution still uses the MCP and realtime tool permission contracts.

## Handoff Notes
To be filled by executor.

## Errors Encountered
To be filled if errors occur.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Tool flood | Enabled tool count | More than approved cap | Require toolkit scoping |
| Permission bypass | Tool executes without gate | Any write/destructive action | Fail test and block |
| SDK drift | API missing | Any runtime mismatch | Update against official docs before coding |
