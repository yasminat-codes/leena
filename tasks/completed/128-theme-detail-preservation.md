---
id: "128"
title: "Theme detail preservation"
type: ui
status: completed
wave: 20
priority: high
complexity: S
estimated_tokens: 9000
dependencies: ["125", "127"]
context_files:
  - src/renderer/screens/settings.js
  - src/renderer/leena.css
  - test/theme-persistence.test.js
  - test/settings-screen.test.js
skills: []
tags: [theme, settings, preservation]
attempts: 1
claim_started: "2026-06-04T02:05:17Z"
completed_at: "2026-06-04T02:36:08Z"
created_at: "2026-06-03"
---

## Objective
Move theme, treatment, and density controls into the Theme detail while preserving all existing values and persistence behavior.

## Why This Matters
The user explicitly chose to preserve the built theme system. This task polishes the presentation without rebranding or removing options.

## Steps
1. Run kencode-search for compact theme picker UI patterns.
2. Render existing Theme values: Workspace, Light, Dark, Vercel Dark.
3. Render existing Treatment values: Workspace, Aurora, Coral, Iris.
4. Render existing Density values: Compact, Comfortable.
5. Add small theme/orb previews without changing stored values.
6. Preserve localStorage and settings-store sync behavior.
7. Add regression tests for exact value names.

## Acceptance Criteria
- [x] All existing theme/treatment/density values remain selectable.
- [x] Theme detail contains only theme-related controls.
- [x] Clicks update `#app-shell.leena` immediately.
- [x] Selection persists across reload.

## Tests Required
- `node --test test/theme-persistence.test.js test/settings-screen.test.js`
- UI screenshot harness from task 121.
- `npm run check`

## Outputs
- `src/renderer/screens/settings.js`
- `src/renderer/leena.css`
- Theme tests as needed.

## Outputs Actuals
- `src/renderer/screens/settings.js`: Theme detail segmented buttons now include preview swatches generated from the existing appearance option data; storage keys and values are unchanged.
- `src/renderer/leena.css`: Added scoped preview styling for theme, treatment, and density options plus label overflow handling.
- `test/settings-screen.test.js`: Added exact appearance value/detail-scope/preview regression coverage.
- `test/theme-persistence.test.js`: Added all-value persistence coverage for exact `leena-theme`, `leena-treatment`, and `leena-density` keys.

## Interface Contracts
Appearance keys remain `leena-theme`, `leena-treatment`, and `leena-density`.

## Handoff Notes
- Ran required MCP-backed kencode-search before editing; no exact public `#app-shell.leena` snippet was found, so implementation followed local contracts.
- Preserved the existing `SETTINGS_MOCK_DATA.appearance` values and defaults: theme `workspace`, treatment `workspace`, density `comfortable`.
- Appearance writes still apply through `applyAppearancePreference()` to the exact `#app-shell.leena` wrapper and persist localStorage keys `leena-theme`, `leena-treatment`, and `leena-density`.
- Parent verification passed after combined Wave 20 integration and reviewer fix: `npm run check`, full `node --test` (623/623), `node --test test/ui-baseline-smoke.test.js`, changed-file `node --check`, and `git diff --check`.

## Errors Encountered
- Initial focused settings test failed because the legacy assertion expected `Workspace` as direct button text; updated it to account for the new preview + label span markup.
- Initial `npm run check` failed on formatting for the new density preview gradients; fixed the formatting and reran successfully.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Value removed | Test exact enum | Any missing value | Restore option |
| Detail polluted | Non-theme controls visible | Any occurrence | Move control to proper detail |
| Preview lies | Orb preview differs from applied token | Any visible mismatch | Bind preview to same tokens |
