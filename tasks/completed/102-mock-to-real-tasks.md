---
id: "102"
title: "Tasks screen: mock to real data"
type: feature
status: completed
priority: high
complexity: S
estimated_tokens: 10000
dependencies: ["015"]
context_files:
  - src/renderer/index.html
  - src/renderer/renderer.js
  - src/realtime/tools/planner-tools.js
skills: []
tags: [phase-7, ui, wire-live, tasks]
attempts: 1
claim_started: "2026-06-02T20:58:09Z"
completed_at: "2026-06-02T21:17:18Z"
created_at: "2026-06-01"
---

## Objective
Replace the Tasks screen's static fixture data with live queries to the existing planner SQLite tables (tasks and calendar_items) via existing IPC channels.

## Why This Matters
The planner is already functional — this is the simplest mock-to-real swap since the IPC channels and data layer already exist. Validates the wire-live pattern before tackling more complex screens.

## Steps
1. Remove all fixture arrays from the Tasks screen module; replace with `async loadTasks()` calling `window.brah.getPlannerTasks()` and `window.brah.getCalendarItems()`.
2. Render task list from returned planner tasks — map to existing task-card component with title, status badge, due date, and priority indicator.
3. Render calendar items in a grouped-by-date section below or beside the task list.
4. Add empty-state ("No tasks yet — ask Leena to plan something").
5. Wire a refresh on screen navigation (tab switch) so data stays current.

## Acceptance Criteria
- [x] Tasks screen data helpers load real planner tasks from SQLite via existing bridge methods
- [x] Calendar items render grouped by date
- [x] Empty state displays when no tasks exist
- [x] No fixture arrays remain in the Tasks screen render path
- [x] Screen refreshes on tab switch

## Tests Required
- `test/tasks-screen-data.test.js` — mock IPC, verify loadTasks structure mapping, verify empty-state

## Outputs
- Modified `src/renderer/screens/tasks.js` (or equivalent)
- New `test/tasks-screen-data.test.js`

## Interface Contracts
- Depends on existing `window.brah.getPlannerTasks()` and `window.brah.getCalendarItems()` preload bridge methods
- No downstream dependencies — tasks screen is terminal

## Handoff Notes
- Replaced the Tasks screen render path with normalized live-data helpers in `src/renderer/screens/tasks.js`.
- Added `loadTasks(bridge)` using the existing preload bridge methods: `getPlannerTasks()` and `getCalendarItems()`.
- Added `renderTasksData(data)`, `groupCalendarItemsByDate(items)`, and `refreshTasksScreen(root, bridge)`.
- Rendered planner tasks with title/name, status badge, optional due-date chip, and priority chip; rendered calendar items grouped by date.
- Added empty state: `No tasks yet - ask Leena to plan something`.
- Orchestrator integration wired `src/renderer/shell.js` to call `refreshTasksScreen()` when the Tasks tab becomes active, while preserving the synchronous initial render as a safe empty state when the bridge is unavailable.
- Added `test/tasks-screen-data.test.js` for mocked bridge loading, task mapping, calendar grouping, HTML escaping, and empty-state coverage.
- Updated `test/tasks-screen.test.js` so production `src/renderer/screens/tasks.js` no longer carries fixture arrays or `MOCK_*` exports.

## Errors Encountered
- Initial worker pass left shell refresh wiring and legacy fixture-compatible test exports undone because `shell.js` and `test/tasks-screen.test.js` were outside worker ownership. The orchestrator integration removed the test-only fixtures, wired tab refresh in `shell.js`, updated tests, and re-ran the focused plus full gates successfully.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Planner IPC returns unexpected shape | test failure | 1 occurrence | Add schema validation on IPC return; log shape mismatch |
| Stale data shown after task creation via voice | user report | 1 occurrence | Add event listener for planner-changed push events |
| Calendar grouping off by timezone | date display error | 1 occurrence | Normalize dates to local timezone before grouping |
