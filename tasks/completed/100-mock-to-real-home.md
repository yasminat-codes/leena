---
id: "100"
title: "Home screen: mock to real data"
type: feature
status: completed
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
attempts: 1
claim_started: "2026-06-03T05:05:41Z"
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
- [x] Home screen shows real activity entries from the database when entries exist
- [x] Home screen shows real planner items in up-next when items exist
- [x] Empty state renders cleanly when no data exists
- [x] Loading skeleton displays during fetch
- [x] No fixture/mock user data remains in the Home screen live code path
- [x] Periodic refresh updates data without full page reload

## Tests Required
- `test/home-screen-data.test.js` — mock IPC responses, verify loadHomeData returns correct structure; verify empty-state branch triggers when no records

## Outputs
- Modified `src/renderer/screens/home.js`
  - Added `loadHomeData()`, `normalizeHomeData()`, `renderHomeData()`, `refreshHomeScreen()`, `updateHomeScreen()`, `scheduleHomeHydration()`, and `startHomeAutoRefresh()`.
  - Added `bindHomeDomReady()` as a guarded DOMContentLoaded hook that hydrates only when Home is mounted.
  - Replaced static recent/up-next rows with loading, empty, memory/activity, and planner render branches.
  - Kept the legacy `MOCK_HOME_DATA` export as loading-state compatibility for the existing shell test only; it no longer contains static user activity or planner fixture rows.
- Added `test/home-screen-data.test.js`
  - Covers preferred IPC channels, fallback preload adapters, normalization, loading state, empty state, escaping, and legacy fixture-string absence.

## Interface Contracts
- Recent activity: prefers `window.leena.invoke("activity:get-recent", { limit: 5 })`; falls back to existing `window.leena.getActivity()` when the new channel is unavailable.
- Memory: uses `window.leena.memory.recall(query, limit)` and also supports generic `window.leena.invoke("memory:recall", { query, limit })` if needed.
- Planner up-next: prefers `window.leena.invoke("planner:get-upcoming", { limit: 3 })`; falls back to existing `window.leena.getCalendarItems()` and then `window.leena.getPlannerTasks()`.
- Settings: optionally reads `home:user-name` and `home:brief-prompt` through `window.leena.getSetting(key, fallback)`.
- Downstream: task 108 (proactive nudges) will add nudge cards to this same screen

## Handoff Notes
- `renderHome()` stays synchronous for the existing shell route contract and returns a loading state immediately.
- Hydration is scheduled inside `home.js` with `queueMicrotask` plus a guarded DOMContentLoaded helper, then updates the existing Home DOM lists in place without touching shared `renderer.js`, `main.js`, `preload.js`, or `shell.js`.
- Auto-refresh runs every 60s while a `.home-screen` exists; it disposes itself when Home is no longer mounted.
- Recent rows combine activity-table entries and memory recall results, sort by newest known timestamp, and cap at five.
- Up-next rows render up to three planner/calendar items with title, time, detail, and type badge.
- Loading/empty rows preserve existing Home CSS classes and density.
- Verification run:
  - `node --check src/renderer/screens/home.js` passed
  - `node --check test/home-screen-data.test.js` passed
  - `npx biome check src/renderer/screens/home.js test/home-screen-data.test.js` passed
  - `node --test test/home-screen.test.js test/home-screen-data.test.js` passed
  - Final parent `npm run check` passed
  - Final parent `node --test` passed 474/474
  - Final parent `git diff --check` passed

## Errors Encountered
- Required kencode-search was run before editing; public code search had no hits for the local `"activity:get-recent"` channel.
- Earlier worker-scope full gates were blocked by active task `106` files; task `106` and the parent integration resolved those blockers. Final parent gates are green.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| IPC call failures on Home load | error count in diagnostics log | >2 failures in 10 loads | Add retry with fallback to cached last-known data |
| Home screen load time | time from DOMContentLoaded to render complete | >500ms | Profile IPC round-trips; batch into single call |
| Empty state shown despite data existing | user report or test failure | 1 occurrence | Verify IPC channel names match between renderer and main |
