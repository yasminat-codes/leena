---
id: "137"
title: "Apple Calendar adapter"
type: integration
status: completed
wave: 19
priority: high
complexity: M
estimated_tokens: 15000
dependencies: ["122", "135"]
context_files:
  - src/realtime/tools/planner-tools.js
  - src/realtime/tools/tool-schemas.js
  - src/realtime/tool-permissions.js
  - test/planner-store.test.js
  - test/tool-permissions.test.js
skills: []
tags: [apple-calendar, macos, tools]
attempts: 1
claim_started: "2026-06-04T00:04:46Z"
completed_at: "2026-06-04T00:37:29Z"
created_at: "2026-06-03"
---

## Objective
Plan and implement a minimal Apple Calendar adapter path that can read calendar items safely and gate create/delete actions.

## Why This Matters
The user specifically wants Apple Calendar access. Current planner calendar items are local, not real Apple Calendar integration.

## Steps
1. Re-read task 120 reference brief and run kencode-search for production Apple Calendar integration patterns on macOS.
2. Choose the safest MVP path: EventKit helper, AppleScript bridge, or Composio-backed calendar if native access is not practical.
3. Add read/list adapter behind a narrow interface.
4. Add write/delete methods only behind permission confirmation.
5. Wire tool schemas only after permission levels are defined.
6. Add mocked tests for read success, permission denied, and write confirmation required.

## Acceptance Criteria
- [x] Adapter choice is documented with tradeoffs.
- [x] Calendar read/search can be enabled after permission grant.
- [x] Calendar create/delete requires confirmation unless trusted write mode is on.
- [x] Local planner calendar behavior does not regress.

## Tests Required
- `node --test test/planner-store.test.js test/tool-permissions.test.js`
- New Apple Calendar adapter tests with mocks.
- `npm run check`

## Outputs
- Apple Calendar adapter module.
- Tool schema/permission updates if included.
- Focused tests.

## Interface Contracts
Native Apple Calendar is optional at runtime; unavailable permission or platform must degrade to guided setup, not crash.

## Handoff Notes
- Implemented MVP Apple Calendar adapter in `src/apple-calendar-adapter.js`.
- Adapter choice: optional `osascript -l JavaScript` / JXA bridge over native EventKit for this slice. Tradeoff: EventKit `requestFullAccessToEvents` is the stronger signed-native future path, but Leena has no Swift helper/native entitlement flow yet; JXA fits current Electron/Node and degrades safely when platform/permission is unavailable. Access mode is declared as `full-access`; EventKit write-only is not treated as read-capable.
- Existing `list_calendar_items`, `add_calendar_item`, and `delete_calendar_item` now support `source: "apple"` through injected planner options while preserving local planner default behavior when source is omitted.
- Apple Calendar reads/searches require host-provided `permissionStatus: "granted"` before running the script bridge. Unknown/denied/unsupported returns guided setup instead of launching Calendar access.
- Apple Calendar create/delete require host-provided `confirmed: true` or `trustedWriteMode: true`; model-provided confirmation fields are ignored.
- Tool schema updates are additive on the existing calendar tools. Permission summaries include `source`, Apple date window fields, and Apple query fields while preserving write/destructive classifications.
- kencode-search requirement satisfied through MCP-backed `mcp__kencode_search`: searched `requestFullAccessToEvents`, `Application("Calendar")`, `events.whose`, `Calendar.calendars.byId`, and `Application("Calendar").Event` before coding. The shell `kencode-search` binary was not on PATH.
- Current docs/patterns checked before coding: task 120 reference brief, task 122 Mac Access trust contract, Apple EventKit `requestFullAccessToEvents`, Apple Apple Events automation entitlement, Electron `systemPreferences`, and Electron `shell.openExternal`.
- Changed task-owned files: `src/apple-calendar-adapter.js`, `src/realtime/tools/planner-tools.js`, `src/realtime/tools/tool-schemas.js`, `src/realtime/tool-permissions.js`, `test/apple-calendar-adapter.test.js`, `test/tool-permissions.test.js`, `tasks/in-progress/137-apple-calendar-adapter.md`.
- Mandated learning appended to `tasks/LEARNINGS.md`.
- Gates passed:
  - `node --check src/apple-calendar-adapter.js src/realtime/tools/planner-tools.js src/realtime/tools/tool-schemas.js src/realtime/tool-permissions.js test/apple-calendar-adapter.test.js test/tool-permissions.test.js`
  - `node --test test/apple-calendar-adapter.test.js test/planner-store.test.js test/tool-permissions.test.js` (17/17)
  - `node --test test/tool-schemas.test.js test/all-tools-functional.test.js test/text-chat.test.js` (21/21)
  - `git diff --check`

- 2026-06-04T00:37:29Z parent verification: Apple Calendar adapter completed with optional JXA bridge, host-supplied read grants, host-supplied write/delete confirmation or trusted mode, additive schema fields, permission summaries, and preserved local planner defaults. Gates passed: `npm run check`, `node --test test/apple-calendar-adapter.test.js test/planner-store.test.js test/tool-permissions.test.js test/tool-schemas.test.js test/all-tools-functional.test.js`, full `node --test` (596/596), and output existence checks.
- 2026-06-04T00:41:28Z advisor fix: loosened the shared `add_calendar_item` schema to require only `title` so the Apple Calendar path can use `startDate`/`endDate` without fake local `date`/`time` labels; local planner-specific required fields remain enforced by runtime validation. Added focused schema and planner dispatch regression coverage.
- 2026-06-04T00:52:20Z reviewer fix: wired Apple Calendar live runtime through `src/main.js` by adding Calendar-specific TCC status detection, including Apple Calendar in permission snapshots, and passing `appleCalendar.permissionStatus` into realtime tool execution. Write/delete still require host confirmation or trusted mode.
- 2026-06-04T01:14:30Z final reviewer fix: Calendar permission detection moved to the main-only permission helper and now checks both the user TCC database and system TCC database with mocked coverage; unreadable databases fail closed, and write-only Calendar grants remain `restricted` rather than read-capable. Gates passed: focused reviewer-fix tests (39/39), `npm run check`, and full `node --test` (605/605).
- 2026-06-04T01:31:47Z terminal reviewer fix: Calendar TCC detection now lets any read-capable denial from the user or system database beat a later grant row, so conflicting TCC state fails closed. Gates passed: focused Calendar/MCP gate (38/38), `npm run check`, and full `node --test` (607/607).

## Errors Encountered
- Earlier worker-local Settings/UI smoke failures and the stale task-artifact path note were resolved by parent integration and privacy cleanup. The CLI `kencode-search` binary was unavailable, so the required pre-code search was satisfied through the MCP-backed kencode-search tool. Current terminal gates pass: focused Calendar/MCP gate (38/38), `npm run check`, full `node --test` (607/607), and task-artifact privacy scan.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Native path brittle | Tests require real calendar | Any occurrence | Mock adapter boundary |
| Write ungated | Permission request missing | Any create/delete | Block execution |
| Local planner regresses | Existing planner tests fail | Any failure | Restore local path |
