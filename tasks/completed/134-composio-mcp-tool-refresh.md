---
id: "134"
title: "Composio MCP tool refresh"
type: integration
status: completed
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
attempts: 1
claim_started: "2026-06-04T00:04:46Z"
completed_at: "2026-06-04T00:37:29Z"
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
- [x] Composio appears as configured when credential exists.
- [x] Refresh Tools updates tool count/status.
- [x] No Composio tool bypasses MCP namespacing or permissions.
- [x] Missing/stale metadata fails closed.

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
- 2026-06-04T00:21:27Z worker handoff: added `src/mcp/composio-integration.js` with a Composio Actions Hub service and IPC helper exports. The service reads the existing safeStorage-backed credential, requires explicit selected toolkits before refresh, creates/updates a normal HTTP MCP server entry, connects through `MCPClientManager` with in-memory Composio MCP headers, records non-secret refresh metadata, and exposes `getPermissionServerConfig()` that fails closed when metadata is missing/stale or the MCP server is disconnected.
- Current Composio API verification: re-read `tasks/artifacts/post-mvp-reference-brief.md`; ran Kencode against `ComposioHQ/composio` for `session.mcp.url`, `session.authorize(`, `connectedAccounts.link`, `new Composio({`, and `create(userId`; checked official docs for ToolRouterSession/session/MCP and v3.1 Tool Router link/session endpoints; checked `npm view @composio/core version main module types exports --json` showing latest `0.10.0`.
- Added mocked coverage in `test/composio-integration.test.js` for refresh, redaction/no persisted credential or MCP header leakage, explicit toolkit selection, stale/disconnected metadata fail-closed behavior, and IPC handler registration/error serialization. Added `test/mcp-integration.test.js` coverage proving a Composio refresh feeds the existing MCP namespace, schema merge, permission request, and `callTool` execution path.
- Changed files owned by this worker: `src/mcp/composio-integration.js`, `test/composio-integration.test.js`, `test/mcp-integration.test.js`, `tasks/in-progress/134-composio-mcp-tool-refresh.md`.
- Parent serialized integration completed: `src/main.js` registers the shared Composio service with `safeStorage`, `mcpServerStore`, `mcpClientManager`, and `shell.openExternal`; provider handlers skip the legacy `composio:test-connection` stub in the live app; `src/preload.js` exposes integration status, refresh, toolkit/app list, and auth-link APIs; and permission metadata routes through `service.getPermissionServerConfig(serverId)` before generic MCP fallback.
- Gates passed for task 134 files: `node --check src/mcp/composio-integration.js`; `node --check test/composio-integration.test.js`; `node --check test/mcp-integration.test.js`; `node --test test/composio-integration.test.js`; `node --test test/mcp-integration.test.js`; `node --test test/mcp-integration.test.js test/mcp-permission-gate.test.js test/mcp-schema-converter.test.js test/composio-integration.test.js` (23/23); `git diff --check -- src/mcp/composio-integration.js test/composio-integration.test.js test/mcp-integration.test.js tasks/in-progress/134-composio-mcp-tool-refresh.md`.
- Parent rerun `npm run check` passed after serialized main/preload integration.

- 2026-06-04T00:37:29Z parent verification: Composio Actions Hub service is now wired through `src/main.js` and `src/preload.js`. Provider settings still own credential save/status/clear, while the integration service owns live `composio:test-connection`, refresh/list/auth channels, and Composio server permission metadata before the generic MCP fallback. Gates passed: `npm run check`, `node --test test/composio-integration.test.js test/mcp-integration.test.js test/wave18-integration.test.js test/wave19-integration.test.js test/provider-settings-ipc.test.js`, full `node --test` (596/596), and redaction/output checks.

## Errors Encountered
- Earlier worker-local UI smoke and formatting failures were resolved by the serialized parent integration and terminal reviewer fixes. Current terminal gates pass: focused Calendar/MCP gate (38/38), `npm run check`, and full `node --test` (607/607).

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Tool flood | Enabled tool count | More than approved cap | Require toolkit scoping |
| Permission bypass | Tool executes without gate | Any write/destructive action | Fail test and block |
| SDK drift | API missing | Any runtime mismatch | Update against official docs before coding |
