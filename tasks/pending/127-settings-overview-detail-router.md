---
id: "127"
title: "Settings overview detail router"
type: ui
status: pending
wave: 19
priority: high
complexity: M
estimated_tokens: 12000
dependencies: ["126"]
context_files:
  - src/renderer/screens/settings.js
  - src/renderer/shell.js
  - test/settings-screen.test.js
skills: []
tags: [settings, overview, detail-panel]
attempts: 0
created_at: "2026-06-03"
---

## Objective
Make Settings open to a compact Overview with in-place detail panels instead of showing every setting at once.

## Why This Matters
The approved UX is dashboard-like and focused. This task removes the current mixed surface and unblocks individual detail sections.

## Steps
1. Run kencode-search for in-place settings detail panel patterns.
2. Render Overview cards for General, Theme, Providers, Updates, Mac Access, and Integrations health.
3. Add internal state for opening and closing a detail panel without adding top-level tabs.
4. Preserve existing bind/load calls for settings, hotkey, updates, wake, and providers.
5. Add tests for overview card presence and detail selection.
6. Verify keyboard and screen-reader labels for detail navigation.

## Acceptance Criteria
- [ ] Settings default render is Overview.
- [ ] Clicking a card opens the correct detail in place.
- [ ] Detail panel has a clear back/close affordance.
- [ ] No unrelated settings appear inside a focused detail.

## Tests Required
- `node --test test/settings-screen.test.js test/shell-rendering.test.js`
- UI screenshot harness from task 121.
- `npm run check`

## Outputs
- `src/renderer/screens/settings.js`
- `src/renderer/leena.css`
- Settings tests as needed.

## Interface Contracts
No new main-sidebar entries are added for Settings detail views.

## Handoff Notes
To be filled by executor.

## Errors Encountered
To be filled if errors occur.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Too many tabs | Settings tab count | More than Overview/detail | Collapse to cards |
| Detail loses state | Back returns blank | Any occurrence | Preserve local state |
| Controls unbound | Existing setting no longer saves | Any regression | Restore bind selector |
