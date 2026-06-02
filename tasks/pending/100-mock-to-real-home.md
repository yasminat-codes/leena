---
id: "100"
title: "Home screen: mock to real data"
type: feature
status: pending
priority: high
complexity: M
estimated_tokens: 15000
dependencies: ["013", "063", "038"]
context_files:
  - src/renderer/index.html
  - src/renderer/renderer.js
  - src/realtime/tools/database.js
skills: []
tags: [phase-7, ui, wire-live, home]
attempts: 0
created_at: "2026-06-01"
---

## Objective
Replace the Home screen's static fixture data with live queries to the activity table, episodic memory, and planner calendar so the dashboard reflects real user state.

## Why This Matters
The Home screen is the first thing users see — showing stale mock data after all backend work is done would undermine trust. This task is the bridge between "looks good" and "works for real."

## Steps
1. In the Home screen renderer module, remove all hardcoded fixture arrays (recent items, up-next items) and replace with IPC calls to `memory:recall` and `planner:get-upcoming`.
2. Add an `async loadHomeData()` function that fetches recent activity via `window.leena.invoke('activity:get-recent', { limit: 5 })` and upcoming items via `window.leena.invoke('planner:get-upcoming', { limit: 3 })`.
3. Render the recent-activity list from the returned episodic memory entries — map each entry to the existing card component with timestamp, summary, and icon.
4. Render the up-next section from planner calendar_items — map each to the existing up-next card with title, time, and type badge.
5. Add a loading skeleton state while data fetches are in-flight; show an empty-state message ("No recent activity yet") when results are empty.
6. Wire a `DOMContentLoaded` listener plus a periodic refresh (every 60s) to keep the Home screen current while visible.

## Acceptance Criteria
- [ ] Home screen shows real activity entries from the database when entries exist
- [ ] Home screen shows real planner items in up-next when items exist
- [ ] Empty state renders cleanly when no data exists
- [ ] Loading skeleton displays during fetch
- [ ] No fixture/mock data remains in the Home screen code path
- [ ] Periodic refresh updates data without full page reload

## Tests Required
- `test/home-screen-data.test.js` — mock IPC responses, verify loadHomeData returns correct structure; verify empty-state branch triggers when no records

## Outputs
- Modified `src/renderer/screens/home.js` (or equivalent Home screen module)
- New `test/home-screen-data.test.js`

## Interface Contracts
- Depends on `memory:recall` IPC channel (task 063) returning `{ entries: [...] }`
- Depends on `planner:get-upcoming` IPC channel returning `{ items: [...] }`
- Depends on `settings:get` IPC channel (task 038) for any user preferences affecting display
- Downstream: task 108 (proactive nudges) will add nudge cards to this same screen

## Handoff Notes
[Filled after completion]

## Errors Encountered
[Filled if errors occur]

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| IPC call failures on Home load | error count in diagnostics log | >2 failures in 10 loads | Add retry with fallback to cached last-known data |
| Home screen load time | time from DOMContentLoaded to render complete | >500ms | Profile IPC round-trips; batch into single call |
| Empty state shown despite data existing | user report or test failure | 1 occurrence | Verify IPC channel names match between renderer and main |
