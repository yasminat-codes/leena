---
id: "139"
title: "Permission confirmation UX"
type: ui
status: pending
wave: 21
priority: critical
complexity: M
estimated_tokens: 14000
dependencies: ["122", "136", "137", "138"]
context_files:
  - src/realtime/tool-permissions.js
  - src/renderer/realtime-tool-handler.js
  - src/renderer/components/command-center.js
  - test/tool-permissions.test.js
  - test/realtime-tool-handler.test.js
skills: []
tags: [permissions, confirmation, tools, safety]
attempts: 0
created_at: "2026-06-03"
---

## Objective
Add polished confirmation UX for write, destructive, and OS-control actions across chat, voice, MCP, Composio, Apple Calendar, and file tools.

## Why This Matters
Leena can become independent only if high-power actions are visible, confirmable, and auditable.

## Steps
1. Re-read task 122 trust contract and downstream adapter handoffs.
2. Audit current tool permission request display path.
3. Add confirmation states that fit the voice dock and Chat screen.
4. Add `Trust this integration` and `Allow trusted write actions` affordances only where allowed.
5. Ensure unknown/stale metadata shows a safe blocked state.
6. Add tests for read/no prompt, write prompt, destructive prompt, and unknown blocked.

## Acceptance Criteria
- [ ] Read/search tools do not nag after permission is granted.
- [ ] Write/delete/control tools ask before execution by default.
- [ ] Unknown tool metadata is blocked.
- [ ] Confirmation UI does not overlap the voice dock.

## Tests Required
- `node --test test/tool-permissions.test.js test/realtime-tool-handler.test.js test/session-state-manager.test.js`
- UI screenshot harness from task 121.
- `npm run check`

## Outputs
- Tool permission UI/path updates.
- Tests as needed.

## Interface Contracts
No integration may bypass the central permission request path.

## Handoff Notes
To be filled by executor.

## Errors Encountered
To be filled if errors occur.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Prompt bypass | Tool executes before approval | Any high-power tool | Block and test |
| Prompt overload | Read tool prompts repeatedly | More than once after grant | Adjust level mapping |
| UI overlap | Confirmation hidden/clipped | Any screenshot issue | Move into stable dock/detail |
