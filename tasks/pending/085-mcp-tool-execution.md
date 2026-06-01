---
id: "085"
title: "Wire MCP tools into realtime tool dispatch"
type: feature
status: pending
priority: high
complexity: M
estimated_tokens: 16000
dependencies: ["080", "082", "083"]
context_files:
  - src/realtime/tools/index.js
  - src/realtime/tool-permissions.js
  - src/realtime/tools/tool-schemas.js
skills: []
tags: [phase-5, mcp, tool-dispatch]
attempts: 0
created_at: "2026-06-01"
---

## Objective
Extend the realtime tool dispatch pipeline so that MCP tools from connected servers are offered to the AI model and their invocations are routed through the permission gate to the correct MCP server.

## Why This Matters
This is the integration point — where MCP tools become usable by the AI during voice conversations. Without this wiring, MCP servers can connect but their tools sit idle. The dispatch must handle namespaced tool names, permission checks, error isolation, and result formatting without breaking existing built-in tool execution.

## Steps
1. Modify `getRealtimeToolDefinitions` in `src/realtime/tools/tool-schemas.js` (or create a wrapper) to accept an optional `mcpClientManager` parameter. When provided, call `getMergedToolDefinitions(staticTools, mcpClientManager)` from task 082 to return the combined tool list. When not provided (backward compat), return only static tools.
2. Modify `executeRealtimeTool` in `src/realtime/tools/index.js`: after all existing module checks return falsy, check if the tool name matches the MCP namespace pattern using `parseMCPToolName(name)` from task 082. If it matches, extract `{ serverId, toolName }`.
3. Before executing: call `shouldAutoApproveMCPTool(name, args, serverConfig)` from task 083. If false, call `getMCPToolPermissionRequest(name, args, serverConfig)` and yield the permission request to the caller (via the `options.requestPermission` callback or return a permission-pending result). If the user denies, return `createPermissionDeniedResult(request)`.
4. If approved: call `mcpClientManager.callTool(serverId, toolName, args)`. Parse the MCP response content array — extract text content, concatenate if multiple parts. Format into the result object shape expected by the realtime handler: `{ status: "ok", result: contentText }`.
5. Wrap the callTool invocation in try/catch: on `MCPError`, return `{ status: "error", message: "MCP tool failed: {error.message}" }`. Never let an MCP tool error crash the realtime session. Log the error via the diagnostics channel.
6. Pass the `mcpClientManager` reference into `executeRealtimeTool` via the existing `options` parameter: `options.mcp = { clientManager, getServerConfig }`. Update the call site in the renderer/realtime handler to pass it.

## Acceptance Criteria
- [ ] `getRealtimeToolDefinitions(mcpClientManager)` returns static + MCP tools merged
- [ ] MCP-namespaced tool names are recognized and routed to the correct server
- [ ] Permission gate runs before every MCP tool call
- [ ] Permission denied returns standard denial result (does not crash session)
- [ ] Successful MCP tool call returns `{ status: "ok", result: contentText }`
- [ ] MCP tool errors return `{ status: "error", message }` without crashing the session
- [ ] Existing built-in tool dispatch is unchanged (no regressions)
- [ ] When no MCP manager is provided, behavior is identical to pre-MCP (backward compat)

## Tests Required
- `test/mcp-tool-execution.test.js` — mock MCPClientManager and permission functions. Test: MCP tool recognized by namespace; permission auto-approved → callTool invoked; permission denied → denial result returned; callTool error → error result returned gracefully; non-MCP tool still dispatched to existing modules; merged tool list includes both static and MCP tools; backward compat with no mcpClientManager.

## Outputs
- Updated `src/realtime/tools/index.js` — MCP tool routing added to `executeRealtimeTool`
- Updated `src/realtime/tools/tool-schemas.js` — merged tool definitions support
- Updated realtime session handler call site — passes `options.mcp`

## Interface Contracts
- **Task 087** (test suite) validates end-to-end MCP tool flow
- **Phase 6 UI** shows MCP tool calls in activity feed (relies on existing activity logging in tool dispatch)

## Handoff Notes
[Filled after completion]

## Errors Encountered
[Filled if errors occur]

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| MCP tool errors crashing session | unhandled exception in realtime handler | any | Verify try/catch wraps ALL MCP paths; add integration test |
| Built-in tool regression | existing tool tests fail after MCP wiring | any | Run full test suite before marking complete |
| Permission callback not wired | permission check skipped silently | any | Add assertion that permission function was called in test |
