---
id: "127"
title: "Settings overview detail router"
type: ui
status: completed
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
attempts: 1
claim_started: "2026-06-04T00:04:46Z"
completed_at: "2026-06-04T00:37:29Z"
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
- [x] Settings default render is Overview.
- [x] Clicking a card opens the correct detail in place.
- [x] Detail panel has a clear back/close affordance.
- [x] No unrelated settings appear inside a focused detail.

## Tests Required
- `node --test test/settings-screen.test.js test/shell-rendering.test.js`
- UI screenshot harness from task 121.
- `npm run check`

## Outputs
- `src/renderer/screens/settings.js`
- `test/settings-screen.test.js`
- `src/renderer/leena.css` parent integration for detail layout and hidden-section viewport behavior.

## Interface Contracts
No new main-sidebar entries are added for Settings detail views.

## Handoff Notes
- Ran required kencode-search before code. The shell binary was not on PATH, so used the available MCP kencode-search tool: `searchCode("data-settings-detail-target")` and `searchCode("SettingsOverview")`; both returned no reusable public snippets, so implementation followed the local IA contract and existing Settings primitives.
- Changed files owned by task 127: `src/renderer/screens/settings.js`, `test/settings-screen.test.js`, and this task file.
- Settings now renders an Overview first with cards for General, Theme, Providers, Updates, Mac Access, and Integrations Health. Detail sections remain in the DOM for existing bind/load behavior but are hidden until selected. Overview cards are keyboard-focusable buttons by role, support Enter/Space, set `aria-pressed`, and detail sections expose Back and Close controls.
- Existing settings bridge paths were preserved: appearance storage keys, hotkey controls, update controls, wake controls, general toggles, and provider/model selectors still use the same data hooks.
- Gates passed: `node --check src/renderer/screens/settings.js`, `node --check test/settings-screen.test.js`, `npm run check`, `node --test test/settings-screen.test.js test/shell-rendering.test.js` (14/14), and `git diff --check`.
- Full `node --test` ran 587 tests with 586 passing; the only failure was the task 121 UI baseline timeout noted below.

- 2026-06-04T00:37:29Z parent verification: Settings Overview/detail router completed with the parent-owned CSS integration. Inactive settings details now explicitly honor `hidden` so overview/detail sections do not consume grid height, detail screens use a full-width track, and UI baseline captures `settings.png`, `settings-general.png`, and `settings-theme.png`. Gates passed: `npm run check`, `node --test test/settings-screen.test.js test/shell-rendering.test.js`, `node --test test/ui-baseline-smoke.test.js`, full `node --test` (596/596), and output existence checks.

## Errors Encountered
- `node --test test/ui-baseline-smoke.test.js` failed before reaching Settings: timeout waiting for `#app-shell[data-onboarding='complete']`. Browser diagnostics showed CSP blocking renderer loads of `node:fs`, `node:fs/promises`, `node:os`, and `node:path` from out-of-scope `src/os-permissions.js`, imported by concurrent Integrations work. Did not edit those files because they are claimed by other tasks.
- Full `node --test` failed for the same UI baseline timeout and otherwise passed.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Too many tabs | Settings tab count | More than Overview/detail | Collapse to cards |
| Detail loses state | Back returns blank | Any occurrence | Preserve local state |
| Controls unbound | Existing setting no longer saves | Any regression | Restore bind selector |
