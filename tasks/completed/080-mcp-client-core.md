---
id: "080"
title: "MCP client manager core"
type: feature
status: completed
priority: high
complexity: L
estimated_tokens: 22000
dependencies: ["000", "001"]
context_files:
  - src/realtime/tools/index.js
  - src/realtime/tool-permissions.js
  - plans/data-model.md
skills: []
tags: [phase-5, mcp, transport]
attempts: 1
claim_started: "2026-06-02T20:58:09Z"
completed_at: "2026-06-02T21:17:18Z"
created_at: "2026-06-01"
---

## Objective
Create the core MCP client manager that connects to external MCP servers via streamable HTTP and stdio transports, manages connection lifecycle, and exposes tool listing and invocation.

## Why This Matters
MCP is the universal tool integration layer — it lets Leena connect to any MCP-compatible server (Composio, local tools, custom servers) without bespoke integration code per service. This is the foundation all other MCP tasks build on.

## Steps
1. Install `@modelcontextprotocol/sdk` as a dependency (`npm install @modelcontextprotocol/sdk`).
2. Create `src/mcp/client-manager.js` with `MCPClientManager` class. Constructor takes no args; maintains a `Map<serverId, { client, transport, config, status }>` of active connections.
3. Implement `connect(serverConfig)` — branch on `serverConfig.transport`: for `"http"` instantiate `StreamableHTTPClientTransport` with `serverConfig.url`; for `"stdio"` instantiate `StdioClientTransport` with `{ command: serverConfig.command, args: serverConfig.args || [] }`. Create `Client` from SDK, call `client.connect(transport)`. Store in connections map. Wrap in retry from `src/utils/retry.js` (max 3 attempts).
4. Implement `disconnect(serverId)` — call `client.close()` on the stored client, remove from connections map. For stdio transport, ensure child process is killed.
5. Implement `listTools(serverId)` — call `client.listTools()` on stored client, return array of `{ name, description, inputSchema }`. Throw `MCPError` if server not connected.
6. Implement `callTool(serverId, toolName, args)` — call `client.callTool({ name: toolName, arguments: args })` on stored client. Return the content array from the response. Wrap in retry (max 2 attempts for transient errors). Throw `MCPError` on failure.
7. Implement `getStatus()` returning map of serverId → `{ name, transport, connected, toolCount }`. Add `disconnectAll()` for app shutdown cleanup.

## Acceptance Criteria
- [x] `MCPClientManager` connects to a streamable HTTP MCP server and lists its tools
- [x] `MCPClientManager` connects to a stdio MCP server (spawns process) and lists its tools
- [x] `callTool` successfully invokes a tool on a connected server and returns results
- [x] `disconnect` cleanly closes connection and kills stdio child process
- [x] Connection failures throw `MCPError` (from task 000) with descriptive message
- [x] Retry logic applies to `connect`; `callTool` supports explicit opt-in retry but defaults to one attempt to avoid duplicating side-effecting MCP tools
- [x] `disconnectAll` cleans up all connections (called on app quit)

## Tests Required
- `test/mcp-client.test.js` — mock MCP server using SDK's test utilities; test connect, listTools, callTool, disconnect for both transports; test retry on transient failure; test MCPError on permanent failure; test disconnectAll cleanup

## Outputs
- `src/mcp/client-manager.js` — MCPClientManager class
- Updated `package.json` — `@modelcontextprotocol/sdk` dependency added

## Interface Contracts
- **Task 082** depends on `listTools()` return shape: `[{ name: string, description: string, inputSchema: object }]`
- **Task 083** depends on `callTool()` being callable with permission gate wrapping
- **Task 084** depends on `connect()`, `disconnect()`, `getStatus()`, `listTools()`
- **Task 085** depends on `callTool()` for routing MCP tool invocations from realtime dispatch
- **Task 086** depends on `connect()` for auto-connect on app launch

## Handoff Notes
- 2026-06-02T21:10:43Z: Implemented `MCPClientManager` in `src/mcp/client-manager.js`.
- Added `@modelcontextprotocol/sdk` dependency at `^1.29.0`; local installed package reports `1.29.0`.
- Manager supports `http` via `StreamableHTTPClientTransport(new URL(url), options)` and `stdio` via `StdioClientTransport({ command, args })`.
- Connections are stored by `serverId`; existing connections are disconnected before replacement.
- `connect()` uses `withRetry` with 3 max attempts and wraps failures in `MCPError`.
- `listTools()` normalizes SDK `tools` to `{ name, description, inputSchema }` and updates status `toolCount`.
- `callTool()` invokes `client.callTool({ name, arguments })` and returns the response `content` array. It defaults to one attempt because MCP tools may have side effects; callers can opt into retry through `retryOptions.callTool` for known-idempotent tools.
- `disconnect()` closes the client and calls stdio transport close for child-process cleanup; `disconnectAll()` attempts every active connection.
- Added `test/mcp-client.test.js` with deterministic SDK-class mocks for HTTP/stdio lifecycle, list/call behavior, retry success, permanent `MCPError` failures, disconnected errors, and `disconnectAll` cleanup.
- Focused verification passed: `node --check src/mcp/client-manager.js && node --check test/mcp-client.test.js`; `node --test test/mcp-client.test.js` passed.
- Required full verification passed after integration: `npm run check` passed; `node --test` passed 266/266 after advisor-fix tests were added.

## Errors Encountered
- npm install reported 7 moderate audit findings after adding `@modelcontextprotocol/sdk`; not changed because dependency-audit remediation is outside task 080.
- Reviewer found default `callTool` retry could duplicate side effects. Fixed by changing the default to one attempt and adding explicit opt-in retry coverage.
- Accidentally created the new manager/test files in the primary checkout first; immediately deleted those untracked files and recreated them under the Wave 07 worktree. Primary checkout had no tracked/untracked changes for those two paths afterward.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Connection leak on disconnect | orphan child processes after app quit | >0 | Add process.on('exit') cleanup hook |
| Retry masking permanent failures | same server retried >5 times in 1 min | 5 retries/min | Add circuit breaker pattern |
| SDK API mismatch | import errors or method-not-found | any | Pin SDK version, check changelog before update |
