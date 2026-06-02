---
id: "014"
title: "Activity screen with mock data"
type: ui
status: completed
priority: high
complexity: S
estimated_tokens: 10000
dependencies: ["012"]
context_files:
  - design-system/Leena Design System.md
  - src/renderer/shell.js
  - src/renderer/leena.css
skills: []
tags: [phase-0, screen, activity]
attempts: 1
claim_started: "2026-06-02T02:05:14Z"
completed_at: "2026-06-02T02:19:22Z"
created_at: "2026-06-01"
---

## Objective
Build the Activity screen showing a conversation history list with a search box at the top, using mock conversation entries and design system tokens.

## Why This Matters
Activity is the conversation log — where users review past interactions. Validating the list layout, search input styling, and scrollable content area ensures the shell handles real data volumes correctly.

## Steps
1. Create `src/renderer/screens/activity.js` exporting `renderActivity()`.
2. Build the header area: `.lx-h2` title "Activity" + a search input (`.btn--ghost` style, rounded, with magnifying glass icon placeholder and "Search conversations..." placeholder text).
3. Build the conversation list: a scrollable `.card` container with 8-10 mock `.row` entries. Each row has a `.tooldot` (message icon, gradient), conversation summary text (`.lx-body` weight 500 for title, `.lx-sm --text-dim` for preview snippet), and a `.lx-mono --text-faint` timestamp (e.g., "Today · 2:41 PM", "Yesterday", "May 30").
4. Wire `renderActivity()` into `shell.js` for the Activity nav item.
5. Add `MOCK_ACTIVITY_DATA` array at top of file with conversation entries matching the shape that episodic memory (Phase 3) will produce: `{ id, title, preview, timestamp, icon }`.

## Acceptance Criteria
- [ ] Activity screen renders when Activity nav item is selected
- [ ] Search input renders with correct styling at top
- [ ] 8+ mock conversation rows display with icon, title, preview, timestamp
- [ ] List is scrollable if content exceeds viewport
- [ ] All styling from leena.css tokens
- [ ] `npm run check` passes

## Tests Required
- `test/activity-screen.test.js`: Verify `renderActivity()` returns HTML containing search input and expected number of `.row` elements.

## Outputs
- `src/renderer/screens/activity.js`
- `test/activity-screen.test.js`
- `src/renderer/shell.js` — integrated Activity route into `#shell-content`
- `src/renderer/leena.css` — responsive Activity header/search/list styles

## Interface Contracts
- `renderActivity()` returns HTML mountable in `.content`
- Phase 6 replaces mock data with episodic memory queries
- Search box is visual-only in Phase 0; Phase 6 wires it to FTS5 search

## Handoff Notes
- `renderActivity()` returns an HTML string and is routed by `setActiveScreen("Activity")`.
- Parent verification passed `npm run check`, `node --test` (186 tests), `node --check` on changed JS/test files, `git diff --check`, output existence checks, and an Electron startup smoke.

## Errors Encountered
- Initial worker test expected inline title styling. Parent integration moved the weight to `.screen-text-strong` in `leena.css` and updated the test.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Scroll container clips content | Visual test with many items | Any clipped text | Check overflow-y:auto + max-height on list |
| Mock data shape differs from episodic memory | Compare with data-model.md memories_episodic | >1 field mismatch | Align mock shape |
