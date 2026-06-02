---
id: "108"
title: "Proactive nudges (opt-in)"
type: feature
status: pending
priority: medium
complexity: M
estimated_tokens: 16000
dependencies: ["100", "064"]
context_files:
  - src/renderer/screens/home.js
  - src/memory/sqlite-memory-store.js
  - src/realtime/tools/planner-tools.js
skills: []
tags: [phase-7, ui, nudges, memory, planner]
attempts: 0
created_at: "2026-06-01"
---

## Objective
Surface proactive nudges on the Home screen — planner-based reminders and memory-based follow-up suggestions — opt-in, in-shell only (no OS notifications).

## Why This Matters
Proactive nudges transform Leena from reactive assistant to proactive partner. "You mentioned following up with Alex last Tuesday" demonstrates memory in action without the user asking.

## Steps
1. Create `src/nudges/nudge-engine.js` with a `generateNudges()` function that queries both planner (upcoming tasks/events within 24h) and memory (semantic entries with follow-up keywords, last_seen > 3 days ago).
2. Define nudge types: `upcoming-task` (planner), `upcoming-event` (calendar), `follow-up` (memory), `reminder` (memory + time trigger).
3. Render nudges as dismissible cards in a "Suggested" section on the Home screen, between the hero and recent activity. Max 3 nudges visible; excess accessible via "See all" link.
4. Add dismiss action per nudge — dismissed nudges are tracked (nudge id + timestamp) to avoid re-surfacing the same nudge within 7 days.
5. Wire the nudge opt-in toggle in Settings (task 104) — when disabled, hide the Suggested section entirely and stop generating nudges.
6. Schedule nudge generation: on app launch + every 30 minutes while app is running (use setInterval in main process, push to renderer).

## Acceptance Criteria
- [ ] Planner-based nudges appear for tasks/events within 24h
- [ ] Memory-based nudges appear for stale follow-ups (>3 days)
- [ ] Nudges are dismissible and don't re-appear within 7 days
- [ ] Opt-in toggle hides/shows the entire nudge section
- [ ] No OS-level notifications — in-shell only
- [ ] Max 3 nudges visible at once

## Tests Required
- `test/nudge-engine.test.js` — mock planner + memory data, verify nudge generation, verify dismiss tracking, verify opt-in gate, verify dedup within 7 days

## Outputs
- New `src/nudges/nudge-engine.js`
- Modified Home screen to include Suggested section
- New `test/nudge-engine.test.js`

## Interface Contracts
- Depends on `memory:recall` for follow-up detection (task 064)
- Depends on `planner:get-upcoming` for task/event nudges
- Depends on `settings:get('nudgesEnabled')` for opt-in gate (task 038)
- No downstream dependencies

## Handoff Notes
[Filled after completion]

## Errors Encountered
[Filled if errors occur]

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Nudges re-appear after dismissal | user report | 1 occurrence | Verify dismiss tracker writes to persistent store, not in-memory |
| Too many irrelevant memory nudges | user dismisses >80% | 5 consecutive dismissals | Raise last_seen threshold; add relevance scoring |
| Nudge generation blocks app launch | startup time regression | >200ms added | Move nudge generation to post-launch async task |
