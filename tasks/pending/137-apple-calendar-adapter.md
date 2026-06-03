---
id: "137"
title: "Apple Calendar adapter"
type: integration
status: pending
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
attempts: 0
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
- [ ] Adapter choice is documented with tradeoffs.
- [ ] Calendar read/search can be enabled after permission grant.
- [ ] Calendar create/delete requires confirmation unless trusted write mode is on.
- [ ] Local planner calendar behavior does not regress.

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
To be filled by executor.

## Errors Encountered
To be filled if errors occur.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Native path brittle | Tests require real calendar | Any occurrence | Mock adapter boundary |
| Write ungated | Permission request missing | Any create/delete | Block execution |
| Local planner regresses | Existing planner tests fail | Any failure | Restore local path |
