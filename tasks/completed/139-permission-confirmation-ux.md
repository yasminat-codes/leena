---
id: "139"
title: "Permission confirmation UX"
type: ui
status: completed
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
attempts: 1
claim_started: "2026-06-04T04:04:04Z"
completed_at: "2026-06-04T04:24:15Z"
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
- [x] Read/search tools do not nag after permission is granted.
- [x] Write/delete/control tools ask before execution by default.
- [x] Unknown tool metadata is blocked.
- [x] Confirmation UI does not overlap the voice dock.

## Tests Required
- `node --test test/tool-permissions.test.js test/realtime-tool-handler.test.js test/session-state-manager.test.js`
- UI screenshot harness from task 121.
- `npm run check`

## Outputs
- Tool permission UI/path updates.
- Tests as needed.
- Actual: added central confirmation-state modeling for allowed/confirm/blocked permission UX, including scoped `Trust this integration` and `Allow trusted write actions` affordance metadata.
- Actual: classified `cancel_computer_use` in the central permission map, preserved read/no-prompt behavior, and made unknown/stale metadata return a model-visible blocked denial with the original permission request.
- Actual: preserved Apple Calendar trust-source metadata on Apple Calendar write/delete requests so confirmation affordances can name the trusted integration correctly.
- Actual: normalized permission results in the realtime handler and Command Center so voice-dock snapshots and chat tool-result chunks render confirmation or blocked copy without importing Node-adjacent permission code into the renderer.
- Actual: added focused coverage for read/no prompt, write prompt, destructive/control prompt, integration/file affordance visibility, unknown/stale blocked metadata, realtime permission state propagation, and compact voice-dock dimensions.

## Interface Contracts
No integration may bypass the central permission request path.

## Handoff Notes
- Re-read `tasks/artifacts/mac-access-trust-contract.md` before implementation; no exact public kencode-search snippet matched `Trust this integration`, so the implementation follows the local trust contract and existing central permission path.
- No CSS, screenshot harness, screenshot artifact, `src/main.js`, or `src/preload.js` edits were made. Confirmation copy uses existing Command Center transcript/preview and chat bubble surfaces to avoid overlap with the voice dock.
- MCP stale metadata now reports `Leena blocked ... because its permission metadata is unknown or stale` and includes the unknown permission request; `test/mcp-tool-execution.test.js` was updated to match the stricter blocked-state contract.
- Parent verification added the Apple Calendar trust-source regression after a local audit found the worker implementation did not preserve the Apple Calendar source on confirmation state.
- Final proof: `npm run check` passed; focused permission suite passed 37/37; task 144 UI screenshot harness passed 2/2; full `node --test` passed 631/631.

## Errors Encountered
- Initial `npm run check` failed on Biome formatting/import ordering in changed files; fixed with `npx biome check --write ...`.
- First full `node --test` run failed 629/630 on the older stale-MCP generic denial expectation; updated the expectation to the new blocked metadata result and reran the affected MCP test plus the full suite successfully.
- Parent audit found Apple Calendar write requests lacked the integration source in confirmation state; fixed source normalization and added regression coverage before completion.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Prompt bypass | Tool executes before approval | Any high-power tool | Block and test |
| Prompt overload | Read tool prompts repeatedly | More than once after grant | Adjust level mapping |
| UI overlap | Confirmation hidden/clipped | Any screenshot issue | Move into stable dock/detail |
