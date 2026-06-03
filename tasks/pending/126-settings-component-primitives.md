---
id: "126"
title: "Settings component primitives"
type: ui
status: pending
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
attempts: 0
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
- [ ] Raw browser-default inputs/selects are not visible in Settings.
- [ ] Controls have stable dimensions and accessible labels.
- [ ] Primitives are reusable by Theme, Providers, Updates, and Mac Access details.
- [ ] Existing settings persistence tests still pass.

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
To be filled by executor.

## Errors Encountered
To be filled if errors occur.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Browser-default control visible | Screenshot/manual check | Any default select/input chrome | Restyle primitive |
| Layout shift | Control changes size on state | Any shift | Set stable dimensions |
| Bridge regression | Persistence tests fail | Any failure | Preserve existing data attributes |
