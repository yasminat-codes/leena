---
id: "015"
title: "Tasks/planner screen with mock data"
type: ui
status: pending
priority: high
complexity: S
estimated_tokens: 10000
dependencies: ["012"]
context_files:
  - design-system/Leena Design System.md
  - src/renderer/shell.js
  - src/renderer/leena.css
  - src/realtime/tools/planner-tools.js
skills: []
tags: [phase-0, screen, tasks, planner]
attempts: 0
created_at: "2026-06-01"
---

## Objective
Build the Tasks screen showing a planner task list and upcoming calendar events, using mock data and design system tokens.

## Why This Matters
The planner is a core feature of Leena — users manage tasks and calendar via voice. The Tasks screen validates that list rendering, status chips, and the task/calendar layout work visually before wiring to the real planner backend.

## Steps
1. Create `src/renderer/screens/tasks.js` exporting `renderTasks()`.
2. Build a two-section layout: "Tasks" section (`.card`) with 5-6 mock task rows. Each row: checkbox circle (empty = pending, filled green = done), task title (`.lx-body` 500), due date chip (`.chip`), and optional priority chip (`.chip` with accent color for high priority).
3. Build "Up Next" section (`.card`) with 3-4 mock calendar entries. Each entry: `.tooldot` (calendar icon gradient), event title, time range (`.lx-sm --text-dim`), and location/link text.
4. Wire `renderTasks()` into `shell.js` for the Tasks nav item.
5. Add `MOCK_TASKS_DATA` and `MOCK_CALENDAR_DATA` arrays matching the existing `tasks` and `calendar_items` SQLite table schemas from the planner.

## Acceptance Criteria
- [ ] Tasks screen renders when Tasks nav item is selected
- [ ] Task list shows 5+ items with checkbox, title, due date chip, priority
- [ ] Calendar section shows 3+ upcoming events with time and location
- [ ] Chips use correct token colors (green for completed, accent for high priority)
- [ ] All styling from leena.css tokens
- [ ] `npm run check` passes

## Tests Required
- `test/tasks-screen.test.js`: Verify `renderTasks()` returns HTML containing `.row` elements for tasks and calendar items. Verify mock data shape matches planner schema.

## Outputs
- `src/renderer/screens/tasks.js`
- `test/tasks-screen.test.js`

## Interface Contracts
- `renderTasks()` returns HTML mountable in `.content`
- Mock data shape matches existing `tasks` and `calendar_items` table schemas
- Phase 6 replaces mock data with live planner queries

## Handoff Notes
_Filled after completion._

## Errors Encountered
_Filled if errors occur._

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Mock task shape diverges from planner schema | Diff mock vs database.js schema | Any column mismatch | Align mock to real schema |
| Checkbox interaction missing | Click test | No visual toggle | Add click handler even if mock (toggle CSS class) |
