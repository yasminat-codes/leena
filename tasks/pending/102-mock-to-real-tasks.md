---
id: "102"
title: "Tasks screen: mock to real data"
type: feature
status: pending
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
attempts: 0
created_at: "2026-06-01"
---

## Objective
Replace the Tasks screen's static fixture data with live queries to the existing planner SQLite tables (tasks and calendar_items) via existing IPC channels.

## Why This Matters
The planner is already functional — this is the simplest mock-to-real swap since the IPC channels and data layer already exist. Validates the wire-live pattern before tackling more complex screens.

## Steps
1. Remove all fixture arrays from the Tasks screen module; replace with `async loadTasks()` calling `window.leena.invoke('planner:get-tasks')` and `window.leena.invoke('planner:get-calendar')`.
2. Render task list from returned planner tasks — map to existing task-card component with title, status badge, due date, and priority indicator.
3. Render calendar items in a grouped-by-date section below or beside the task list.
4. Add empty-state ("No tasks yet — ask Leena to plan something").
5. Wire a refresh on screen navigation (tab switch) so data stays current.

## Acceptance Criteria
- [ ] Tasks screen shows real planner tasks from SQLite
- [ ] Calendar items render grouped by date
- [ ] Empty state displays when no tasks exist
- [ ] No fixture data remains in Tasks screen code
- [ ] Screen refreshes on tab switch

## Tests Required
- `test/tasks-screen-data.test.js` — mock IPC, verify loadTasks structure mapping, verify empty-state

## Outputs
- Modified `src/renderer/screens/tasks.js` (or equivalent)
- New `test/tasks-screen-data.test.js`

## Interface Contracts
- Depends on existing `planner:get-tasks` and `planner:get-calendar` IPC channels
- No downstream dependencies — tasks screen is terminal

## Handoff Notes
[Filled after completion]

## Errors Encountered
[Filled if errors occur]

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Planner IPC returns unexpected shape | test failure | 1 occurrence | Add schema validation on IPC return; log shape mismatch |
| Stale data shown after task creation via voice | user report | 1 occurrence | Add event listener for planner-changed push events |
| Calendar grouping off by timezone | date display error | 1 occurrence | Normalize dates to local timezone before grouping |
