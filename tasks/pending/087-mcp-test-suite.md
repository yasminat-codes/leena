---
id: "087"
title: "MCP comprehensive test suite"
type: test
status: pending
priority: high
complexity: M
estimated_tokens: 18000
dependencies: ["080", "082", "083", "085"]
context_files:
  - test/planner-tools.test.js
  - test/web-tools.test.js
skills: []
tags: [phase-5, mcp, testing]
attempts: 0
created_at: "2026-06-01"
---

## Objective
Write comprehensive tests for the entire MCP integration layer — client manager, schema conversion, permission gating, tool execution routing, and server store — ensuring all paths work correctly and MCP failures never crash the app.

## Why This Matters
MCP is a security-critical external integration. Untested schema conversion silently breaks tool definitions. Untested permission gating could auto-approve destructive operations. Untested error handling lets MCP server crashes kill voice sessions. This test suite is the safety net for all of it.

## Steps
1. Create `test/mcp-client.test.js`: mock an MCP server using `@modelcontextprotocol/sdk` test utilities (or manual mock). Test `MCPClientManager.connect()` for both HTTP and stdio transports (mock the transport layer). Test `listTools()` returns expected tool array. Test `callTool()` returns content. Test `disconnect()` cleans up. Test retry on transient connection failure. Test `MCPError` thrown on permanent failure. Test `disconnectAll()` cleans all connections.
2. Create `test/mcp-schema-converter.test.js`: test `mcpToolToOpenAI` with: simple flat schema, nested object properties, array with items, enum values, required fields array, schema with `$schema`/`$id` (should be stripped), missing `type` (should default to object), empty properties. Test `namespaceMCPTool` / `parseMCPToolName` round-trip. Test `getMergedToolDefinitions` with mock static tools + mock manager returning tools from 2 servers.
3. Create `test/mcp-permission-gate.test.js`: test all 9 combos of server permission level (auto/confirm/trust) × inferred risk level (low/write/destructive). Test `getMCPToolPermissionRequest` returns correct shape with server name. Test `shouldAutoApproveMCPTool` returns correct boolean for each combo. Test default behavior when server config is missing (should require confirmation). Test risk inference from schema property names containing `path`, `file`, `url`, `delete`.
4. Create `test/mcp-integration.test.js`: test end-to-end flow: add mock server config to ServerStore, connect via ClientManager, verify tools appear in merged definitions, call `executeRealtimeTool` with an MCP-namespaced tool name, verify permission check runs, verify callTool called on correct server with correct un-namespaced tool name, verify result formatted correctly. Test disconnect: after server disconnects, merged tool list drops those tools. Test non-MCP tool still routes to built-in modules (no regression).
5. Verify all tests pass with `node --test test/mcp-*.test.js`. Fix any failures. Ensure existing test suite (`npm test`) still passes with no regressions.

## Acceptance Criteria
- [ ] `test/mcp-client.test.js` covers connect, listTools, callTool, disconnect, retry, error for both transports
- [ ] `test/mcp-schema-converter.test.js` covers all schema variations and edge cases
- [ ] `test/mcp-permission-gate.test.js` covers all 9 permission × risk combos + defaults
- [ ] `test/mcp-integration.test.js` covers end-to-end tool dispatch through MCP
- [ ] All MCP tests pass: `node --test test/mcp-*.test.js` exits 0
- [ ] Existing tests unaffected: `npm test` exits 0 (no regressions)
- [ ] Error paths tested: MCP server crash, malformed response, timeout — none crash the test runner

## Tests Required
- This task IS the test suite. Files listed in Steps 1-4.

## Outputs
- `test/mcp-client.test.js`
- `test/mcp-schema-converter.test.js`
- `test/mcp-permission-gate.test.js`
- `test/mcp-integration.test.js`

## Interface Contracts
- These tests serve as living documentation for the MCP public API surface
- Future MCP changes must keep these tests passing or update them deliberately

## Handoff Notes
[Filled after completion]

## Errors Encountered
[Filled if errors occur]

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Tests pass but MCP broken in real app | production MCP error not caught by tests | any | Add test case for the specific failure scenario |
| Mock drift from real SDK behavior | SDK update breaks real connections but tests pass | any | Pin SDK version in tests; update mocks when SDK updates |
| Missing edge case | MCP error in production not covered by any test | any | Add test + learning entry immediately |
