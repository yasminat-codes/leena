---
id: "126"
title: "Settings component primitives"
type: ui
status: completed
wave: 18
priority: high
complexity: M
estimated_tokens: 13000
dependencies: ["123"]
context_files:
  - src/renderer/screens/settings.js
  - src/renderer/leena.css
  - test/settings-screen.test.js
  - test/settings-screen-data.test.js
skills: []
tags: [settings, components, forms]
attempts: 1
claim_started: "2026-06-03T22:05:26Z"
completed_at: "2026-06-03T22:27:04Z"
created_at: "2026-06-03"
---

## Objective
Replace raw settings form presentation with reusable polished primitives for overview cards, detail rows, segmented controls, inputs, selects, toggles, and action buttons.

## Why This Matters
The current settings UI shows raw form controls and inconsistent spacing. Later detail screens need shared primitives so the UI does not fragment.

## Steps
1. Run kencode-search for production settings/form primitive patterns.
2. Add renderer helpers for Settings overview cards, detail sections, field rows, segmented controls, and status callouts.
3. Style primitives in `leena.css` using existing tokens.
4. Keep behavior wiring compatible with existing `bindSettingsControls`.
5. Add unit tests for rendered primitive classes and data attributes.
6. Confirm no controls overflow at the approved shell size.

## Acceptance Criteria
- [x] Raw browser-default inputs/selects are not visible in Settings.
- [x] Controls have stable dimensions and accessible labels.
- [x] Primitives are reusable by Theme, Providers, Updates, and Mac Access details.
- [x] Existing settings persistence tests still pass.

## Tests Required
- `node --test test/settings-screen.test.js test/settings-screen-data.test.js`
- UI screenshot harness from task 121.
- `npm run check`

## Outputs
- `src/renderer/screens/settings.js`
- `src/renderer/leena.css`
- Settings tests as needed.

## Interface Contracts
Settings behavior remains driven by existing settings bridge methods and appearance storage keys.

## Handoff Notes
- Ran kencode-search before editing; used production UI/form primitive references and literal control-pattern searches.
- Added renderer-level primitives for overview cards, detail sections, field rows, segmented controls, inputs, selects, toggles, action buttons, and status callouts in `src/renderer/screens/settings.js`.
- Preserved existing behavior hooks used by `bindSettingsControls`, including appearance values/storage keys, hotkey controls, provider selectors, update actions, wake toggles, and settings toggles.
- Added focused render assertions that every generated Settings input/select/action/toggle/segmented button carries primitive classes/data attributes and accessibility labels.
- Visual proof: `node --test` regenerated `tasks/artifacts/post-mvp-ui-baseline/settings.png`; inspected the approved shell-size screenshot and fixed overview-card text overflow without editing CSS.
- Deferred CSS integration: `src/renderer/leena.css` remains untouched because task 125 owns the file. Future CSS can target the new `data-settings-primitive` hooks plus `settings-detail-section`, `settings-detail-row`, `settings-control`, and `settings-action-button`.
- Verification passed: `node --test test/settings-screen.test.js test/settings-screen-data.test.js` (16/16), `npm run check`, and full `node --test` (558/558).

## Errors Encountered
- First `npm run check` failed on Biome formatting for the select helper signature; formatted it and reran green.
- An initial patch attempt targeted the primary checkout instead of this worktree; the accidental primary `settings.js` diff was fully reversed before applying the scoped worktree patch.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Browser-default control visible | Screenshot/manual check | Any default select/input chrome | Restyle primitive |
| Layout shift | Control changes size on state | Any shift | Set stable dimensions |
| Bridge regression | Persistence tests fail | Any failure | Preserve existing data attributes |
