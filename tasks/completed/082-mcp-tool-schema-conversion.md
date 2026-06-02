---
id: "082"
title: "Convert MCP tool schemas to OpenAI function format"
type: feature
status: completed
priority: high
complexity: M
estimated_tokens: 15000
dependencies: ["080"]
context_files:
  - src/realtime/tools/tool-schemas.js
  - src/realtime/tools/index.js
skills: []
tags: [phase-5, mcp, schema]
attempts: 1
claim_started: "2026-06-02T22:04:44Z"
completed_at: "2026-06-02T22:18:40Z"
created_at: "2026-06-01"
---

## Objective
Create a schema converter that transforms MCP tool definitions (JSON Schema-based) into OpenAI Realtime API function definitions, and merge MCP-sourced tools into the existing static tool list.

## Why This Matters
The OpenAI Realtime API expects tools in `{ type: "function", name, description, parameters }` format while MCP servers expose tools with standard JSON Schema `inputSchema`. Without accurate conversion, MCP tools cannot be offered to the AI model during realtime sessions, breaking the entire MCP integration.

## Steps
1. Create `src/mcp/schema-converter.js`. Export `mcpToolToOpenAI(mcpTool)` that takes `{ name: string, description: string, inputSchema: object }` and returns `{ type: "function", name: string, description: string, parameters: object }`. The `parameters` field is the `inputSchema` directly (both are JSON Schema), but strip any `$schema` or `$id` meta-properties that OpenAI rejects.
2. Add `sanitizeSchema(schema)` helper: recursively remove `$schema`, `$id`, `$comment`, `examples`, `default` keys from the schema tree. Ensure `type` is present at root (default to `"object"` if missing). Ensure `properties` exists (default to `{}` if missing). Preserve `required`, `enum`, `items`, `anyOf`, `oneOf`, `allOf`.
3. Add `namespaceMCPTool(serverId, toolName)` — prefix tool name with server ID to avoid collisions with built-in tools: `mcp__{serverId}__{toolName}`. Export a `parseMCPToolName(namespacedName)` to reverse it — returns `{ serverId, toolName }` or null if not an MCP tool.
4. Export `getMergedToolDefinitions(staticTools, mcpClientManager)` — takes the static tool array from `getRealtimeToolDefinitions()` and the MCPClientManager instance. For each connected server, call `listTools(serverId)`, convert each via `mcpToolToOpenAI`, namespace the name, and append to the static list. Return the merged array. Handle server errors gracefully (skip that server's tools, log warning).
5. Add validation: reject tools with empty names, truncate descriptions longer than 1024 chars (OpenAI limit), and truncate schemas deeper than 5 levels with `additionalProperties: true` at the cutoff.

## Acceptance Criteria
- [x] `mcpToolToOpenAI` converts a standard MCP tool definition to valid OpenAI function format
- [x] `sanitizeSchema` removes `$schema`, `$id`, `$comment`, `examples`, `default` keys recursively
- [x] `sanitizeSchema` adds `type: "object"` and `properties: {}` when missing from root
- [x] `namespaceMCPTool` produces `mcp__{serverId}__{toolName}` format
- [x] `parseMCPToolName` correctly reverses namespaced names; returns null for non-MCP names
- [x] `getMergedToolDefinitions` merges static + MCP tools with no name collisions
- [x] Disconnected or errored servers are skipped gracefully (their tools not included)
- [x] Nested schemas deeper than 5 levels are truncated safely

## Tests Required
- `test/mcp-schema-converter.test.js` — test `mcpToolToOpenAI` with: simple schema, nested objects, arrays with items, enums, required fields, missing type, $schema/$id stripping. Test `namespaceMCPTool` and `parseMCPToolName` round-trip. Test `sanitizeSchema` edge cases. Test `getMergedToolDefinitions` with mock static tools + mock MCPClientManager returning 3 tools from 2 servers.

## Outputs
- `src/mcp/schema-converter.js` — mcpToolToOpenAI, sanitizeSchema, namespaceMCPTool, parseMCPToolName, getMergedToolDefinitions
- `test/mcp-schema-converter.test.js` — converter, sanitization, namespace, merge, and depth-truncation tests
- Verification: `node --test test/mcp-schema-converter.test.js`, focused Wave 08 tests, full `npm run check`, and full `node --test`

## Interface Contracts
- **Task 083** depends on `parseMCPToolName` to identify MCP tools needing permission checks
- **Task 085** depends on `parseMCPToolName` to route MCP tool calls and `getMergedToolDefinitions` for session tool list
- Namespacing format `mcp__{serverId}__{toolName}` is a public contract — tasks 083, 085 rely on it

## Handoff Notes
`src/mcp/schema-converter.js` is intentionally not wired into the realtime tool list yet. Task 083 can use `parseMCPToolName()` for permission detection, and task 085 should call `getMergedToolDefinitions(getRealtimeToolDefinitions(), mcpClientManager)` when MCP execution routing is available.

## Errors Encountered
None.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Schema conversion silently drops required fields | diff between MCP schema keys and output keys | any required field missing | Add validation assertion in converter |
| Name collision between MCP and built-in tools | duplicate names in merged list | any | Enforce namespace prefix check; warn on collision |
| Deep nesting truncation causes tool failure | tool call errors from model due to truncated schema | >2 occurrences | Raise nesting limit or use $ref flattening |
