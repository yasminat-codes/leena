---
id: "128"
title: "Theme detail preservation"
type: ui
status: pending
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
attempts: 0
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
- [ ] All existing theme/treatment/density values remain selectable.
- [ ] Theme detail contains only theme-related controls.
- [ ] Clicks update `#app-shell.leena` immediately.
- [ ] Selection persists across reload.

## Tests Required
- `node --test test/theme-persistence.test.js test/settings-screen.test.js`
- UI screenshot harness from task 121.
- `npm run check`

## Outputs
- `src/renderer/screens/settings.js`
- `src/renderer/leena.css`
- Theme tests as needed.

## Interface Contracts
Appearance keys remain `leena-theme`, `leena-treatment`, and `leena-density`.

## Handoff Notes
To be filled by executor.

## Errors Encountered
To be filled if errors occur.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Value removed | Test exact enum | Any missing value | Restore option |
| Detail polluted | Non-theme controls visible | Any occurrence | Move control to proper detail |
| Preview lies | Orb preview differs from applied token | Any visible mismatch | Bind preview to same tokens |
