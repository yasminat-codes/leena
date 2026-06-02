---
id: "020"
title: "Live theme/treatment/density switching wired end-to-end"
type: ui
status: pending
priority: high
complexity: S
estimated_tokens: 8000
dependencies: ["017", "010"]
context_files:
  - src/renderer/screens/settings.js
  - src/renderer/shell.js
  - src/renderer/leena.css
skills: []
tags: [phase-0, theme, persistence]
attempts: 0
created_at: "2026-06-01"
---

## Objective
Ensure the theme/treatment/density controls in Settings actually change `.leena` attributes globally, persist to localStorage, restore on app reload, and that ALL screens + components (including Command Center and orb) respond correctly to the change.

## Why This Matters
This is the live proof that the design system works. If theme switching breaks on any screen, it means tokens aren't properly scoped. This task is the integration test for the entire CSS token system.

## Steps
1. In `shell.js` init, read `localStorage` keys (`leena-theme`, `leena-treatment`, `leena-density`) and set `.leena` wrapper `data-*` attributes BEFORE first screen render. Default: `dark` / `aurora` / `comfortable`.
2. Verify `settings.js` click handlers correctly update the `.leena` wrapper attributes AND write to localStorage on every change.
3. Test that wallpaper (`--wall`) transitions when theme changes — `light` shows full gradient wallpaper, `dark` shows darker version, `vercel-dark` shows near-flat black with faint glow.
4. Test that orb colors change when treatment switches — Aurora (purple/peach), Coral (warm orange/purple), Iris (cool blue).
5. Test that padding/gap changes when density toggles between compact and comfortable.
6. Add a CSS transition on the `.leena` element for `background` (200ms) so theme switches cross-fade smoothly instead of snapping.

## Acceptance Criteria
- [ ] App restores saved theme/treatment/density on launch from localStorage
- [ ] Switching theme in Settings immediately changes ALL colors across ALL screens
- [ ] Switching treatment changes gradients, accents, and orb colors
- [ ] Switching density changes padding and gap spacing
- [ ] Wallpaper gradient visibly changes per theme
- [ ] Transitions are smooth (200ms cross-fade for colors)
- [ ] Settings UI correctly highlights the active selection
- [ ] `npm run check` passes

## Tests Required
- `test/theme-persistence.test.js`: Mock localStorage, test that shell init reads saved values. Test that write/read round-trip works for all 3 preferences. Test defaults when no localStorage values exist.

## Outputs
- `src/renderer/shell.js` — updated with localStorage init
- `test/theme-persistence.test.js`

## Interface Contracts
- All components that use `leena.css` tokens automatically respond to attribute changes
- Settings screen is the only UI that writes theme preferences
- Shell init is the only code that reads + applies preferences on startup
- Phase 1 (settings store) will migrate from localStorage to the SQLite settings table

## Handoff Notes
_Filled after completion._

## Errors Encountered
_Filled if errors occur._

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Screen doesn't respond to theme change | Switch theme, check each screen | Any screen shows old colors | Verify that screen's HTML uses token-based classes, not inline styles |
| localStorage values lost | Close and reopen app | Theme reverts to default | Check localStorage write timing (before window close?) |
