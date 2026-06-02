---
id: "017"
title: "Settings screen with mock data and functional theme/density switcher"
type: ui
status: completed
priority: high
complexity: M
estimated_tokens: 14000
dependencies: ["012"]
context_files:
  - design-system/Leena Design System.md
  - src/renderer/shell.js
  - src/renderer/leena.css
skills: []
tags: [phase-0, screen, settings, theme]
attempts: 3
claim_started: "2026-06-02T02:05:14Z"
review_fix_started: "2026-06-02T02:24:00Z"
review_rereview_fix_started: "2026-06-02T02:37:14Z"
completed_at: "2026-06-02T02:37:14Z"
created_at: "2026-06-01"
---

## Objective
Build the Settings screen with identity section, FUNCTIONAL theme/treatment/density switcher (actually changes CSS attributes on `.leena` wrapper), provider selection mockup (OpenAI/OpenRouter/Ollama), and feature toggles — using mock data where needed.

## Why This Matters
Settings is the control center for personalization and configuration. The theme/treatment/density switcher MUST work in Phase 0 (it's the live demo of the design system). The provider selection mockup establishes the UI pattern for the universal provider layer added in Phase 2.

## Steps
1. Create `src/renderer/screens/settings.js` exporting `renderSettings()`.
2. Build the Identity section: avatar placeholder (64px circle with gradient), name field (`.lx-h2` "Yasmine"), email field (`.lx-sm --text-dim`), and an "Edit" `.btn--ghost`.
3. Build the Appearance section: three-segment radio groups — Theme (Light / Dark / Vercel Dark), Treatment (Aurora / Coral / Iris), Density (Compact / Comfortable). Each uses `.chip` styling, active state = `.chip` with accent background. On click, update `data-theme`, `data-treatment`, or `data-density` attribute on the `.leena` wrapper element. Persist selection to `localStorage` keys `leena-theme`, `leena-treatment`, `leena-density`.
4. Build the Providers section (mock): three provider rows — OpenAI (active, green chip), OpenRouter (available, accent chip), Ollama (available, accent chip). Each row shows provider name, status, and a model selector dropdown placeholder. This section is purely visual in Phase 0.
5. Build the Features section: toggle switches for Wake Word (off), Always Listening (off), Launch on Login (off), Notifications (on). Each toggle is a styled checkbox with `.chip` background.
6. Wire `renderSettings()` into `shell.js`. On screen mount, read `localStorage` values and set `.leena` wrapper attributes accordingly (initialize defaults: dark/aurora/comfortable).
7. Load saved theme preferences on app start (in `shell.js` init, before first render).

## Acceptance Criteria
- [ ] Settings screen renders when Settings nav item is selected
- [ ] Identity section shows avatar placeholder, name, email
- [ ] Theme switcher WORKS: clicking Light/Dark/Vercel Dark changes `data-theme` attribute and all colors update
- [ ] Treatment switcher WORKS: clicking Aurora/Coral/Iris changes gradient treatment globally
- [ ] Density switcher WORKS: clicking Compact/Comfortable changes padding/gap
- [ ] Provider section shows 3 providers with correct status chips
- [ ] Feature toggles render as styled switches
- [ ] Selection persists to localStorage and restores on reload
- [ ] `npm run check` passes

## Tests Required
- `test/settings-screen.test.js`: Test that theme/treatment/density state management functions correctly set attributes. Test localStorage round-trip (save + load). Verify `renderSettings()` returns HTML with all expected sections.

## Outputs
- `src/renderer/screens/settings.js`
- `test/settings-screen.test.js`
- `src/renderer/shell.js` — integrated Settings route plus appearance preference load/bind
- `src/renderer/leena.css` — responsive settings layout, segmented active states, avatar, and chip styles

## Interface Contracts
- Theme/treatment/density changes apply globally via `.leena` wrapper `data-*` attributes
- `localStorage` keys: `leena-theme`, `leena-treatment`, `leena-density`
- Phase 2 (providers) will wire provider selection to real provider registry
- Phase 1 will wire feature toggles to real settings store

## Handoff Notes
- Appearance keys are exactly `leena-theme`, `leena-treatment`, and `leena-density`; settings controls update `#app-shell.leena` data attributes.
- Reviewer fix tightened appearance writes to the exact `#app-shell.leena` wrapper; loose `.leena` or `#app-shell` fallbacks are intentionally rejected.
- Parent verification after reviewer re-review fix passed `npm run check`, `node --test` (189 tests), `node --check` on changed JS/test files, `git diff --check`, output existence checks, and an Electron startup smoke.

## Errors Encountered
- Initial worker markup used an inline avatar size. Parent integration moved sizing to `.settings-avatar` in `leena.css` and updated the test.
- Reviewer found the appearance helper could target loose fallback selectors. Fixed `resolveAppearanceRoot()` to require exact `#app-shell.leena` and added regression coverage.
- Reviewer re-review found direct loose roots still passed because the helper accepted `id` OR class. Fixed the helper to require exact `#app-shell.leena`, changed missing-storage default theme to `dark`, and added direct-root/default regression coverage.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Theme switch doesn't update all tokens | Visual check across screens after switch | Any element retains old theme | Check CSS specificity; ensure all tokens scoped to data-theme |
| localStorage not persisting | Reload app, check theme | Reverts to default | Verify save on click + load on init timing |
| Provider section layout breaks | Visual check with 3 rows | Any overflow/misalign | Fix grid/flex layout in provider cards |
