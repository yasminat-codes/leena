---
id: "083"
title: "MCP tool permission gating (ADR-6)"
type: feature
status: pending
priority: high
complexity: M
estimated_tokens: 14000
dependencies: ["080", "082"]
context_files:
  - src/realtime/tool-permissions.js
  - plans/auth-matrix.md
skills: []
tags: [phase-5, mcp, security, permissions]
attempts: 0
created_at: "2026-06-01"
---

## Objective
Extend the existing tool permission system to handle dynamic MCP tools with a default-deny policy (ADR-6), allowing per-server permission level overrides configured by the user.

## Why This Matters
MCP tools come from external, potentially untrusted servers. Unlike built-in tools with hardcoded permission levels, MCP tools must default to "needs confirmation" and respect the per-server permission level the user sets. Without this gate, any connected MCP server could execute destructive actions without user awareness — a critical security boundary.

## Steps
1. Extend `src/realtime/tool-permissions.js`: add a `getMCPToolPermissionRequest(namespacedName, args, serverConfig)` function. Use `parseMCPToolName` from task 082 to extract serverId and toolName. Look up the server's `permission_level` from its config.
2. Define MCP permission level mapping: `"auto"` → auto-approve read/low tools, confirm write/destructive/network; `"confirm"` (default) → confirm ALL tool calls regardless of inferred level; `"trust"` → auto-approve everything (user explicitly trusts this server). The `permission_level` field comes from the `mcp_servers` table (task 081).
3. Implement tool-level risk inference: analyze the MCP tool's `inputSchema` — if it has properties named `path`, `file`, `url`, `command`, `query`, `delete`, or `write`, infer higher risk. Tools with no risky property names default to `"low"`. This is heuristic; the server-level permission overrides it.
4. Build the permission request object: `{ toolName: namespacedName, label: tool.description (truncated to 60 chars), level: resolvedLevel, description: "MCP tool from {serverName}: {tool.description}", summary: summarizeMCPArgs(args) }`. The `summarizeMCPArgs` function formats the first 3 arg key-value pairs, truncated to 140 chars each.
5. Export `shouldAutoApproveMCPTool(namespacedName, args, serverConfig)` — returns `true` if the resolved level + server permission policy allows auto-approval, `false` if confirmation is needed. This is called by the tool execution path (task 085) before invoking `callTool`.

## Acceptance Criteria
- [ ] All MCP tools default to "confirm" permission level when server has no override
- [ ] Server permission_level="auto" auto-approves read/low tools, confirms write/destructive
- [ ] Server permission_level="confirm" requires confirmation for ALL MCP tool calls
- [ ] Server permission_level="trust" auto-approves all tool calls from that server
- [ ] Risk inference flags tools with `path`, `file`, `url`, `command`, `delete`, `write` schema properties as higher risk
- [ ] Permission request object includes server name and tool description for user-facing prompt
- [ ] `shouldAutoApproveMCPTool` returns correct boolean for all permission level × risk level combos

## Tests Required
- `test/mcp-permission-gate.test.js` — test all 3 server permission levels × 3 risk levels (9 combos). Test risk inference from schema property names. Test `getMCPToolPermissionRequest` output shape. Test `shouldAutoApproveMCPTool` boolean results. Test with missing/malformed server config (should default to confirm-all).

## Outputs
- Updated `src/realtime/tool-permissions.js` — new exports: `getMCPToolPermissionRequest`, `shouldAutoApproveMCPTool`

## Interface Contracts
- **Task 085** depends on `shouldAutoApproveMCPTool` to decide whether to prompt user or auto-execute
- **Task 085** depends on `getMCPToolPermissionRequest` to build the confirmation prompt
- **Task 084** exposes server `permission_level` through IPC for the settings UI

## Handoff Notes
[Filled after completion]

## Errors Encountered
[Filled if errors occur]

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| User overwhelmed by confirmations | confirm prompts per minute | >5/min | Suggest "auto" or "trust" for that server in UI |
| Risk inference false negatives | destructive tool auto-approved | any | Add more risky property patterns; review MCP tool schemas periodically |
| Permission bypass via malformed name | tool name not matching namespace pattern | any | Fail-closed: unrecognized names always require confirmation |
