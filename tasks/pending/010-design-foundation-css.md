---
id: "010"
title: "Design foundation CSS — create leena.css with all design tokens"
type: ui
status: pending
priority: critical
complexity: M
estimated_tokens: 18000
dependencies: []
context_files:
  - design-system/Leena Design System.md
  - src/renderer/styles.css
  - src/renderer/index.html
skills: []
tags: [phase-0, design-system, css, tokens]
attempts: 0
created_at: "2026-06-01"
---

## Objective
Create `src/renderer/leena.css` containing every CSS custom property, component class, and utility from the Leena Design System — the single runtime source of truth for all visual styling.

## Why This Matters
Every downstream UI task (screens, command center, orb, theme switching) depends on these tokens. Without `leena.css`, no component can be styled correctly. This is the design system's translation from spec to code.

## Steps
1. Create `src/renderer/leena.css` with `:root` block containing brand colors (`--cream`, `--peach`, `--violet`, `--indigo`), font families (`--font-display`, `--font-body`, `--font-mono`), radius tokens (`--r-inner`, `--r-win`, `--r-card`, `--r-panel`, `--r-pill`).
2. Add `[data-treatment="aurora|coral|iris"]` selector blocks on `.leena` setting `--grad-1`, `--grad-2`, `--grad-hi`, `--accent`, `--accent-soft`, `--accent-dk`, `--orb-a`, `--orb-b`, `--orb-c` per the design system §1.2 table.
3. Add `[data-theme="light|dark|vercel-dark"]` selector blocks on `.leena` setting all surface/text/glass/shadow tokens per §1.3, §1.3b, and §1.7 (`--wall` gradient wallpaper definitions for each theme).
4. Add `[data-density="compact|comfortable"]` selector blocks on `.leena` setting `--pad`, `--gap`, `--row` per §1.4.
5. Add component classes: `.card` and `.panel-glass` (§1.6 glassmorphism), `.btn`/`.btn--primary`/`.btn--ghost`/`.btn--grad` (§4.1), `.chip`/`.dot` (§4.2), `.nav-item`/`.nav-item--active`/`.badge` (§4.3), `.kbd` (§4.4), `.tooldot`/`.row`/`.row__txt` (§4.5), `.grad` accent block (§4.8), `.icon-btn` (§5.1).
6. Add type scale classes: `.lx-display`, `.lx-h1`, `.lx-h2`, `.lx-h3`, `.lx-body`, `.lx-sm`, `.lx-mono` per §2.3.
7. Add motion tokens as CSS custom properties and `prefers-reduced-motion` media query that disables animations/transitions.

## Acceptance Criteria
- [ ] `src/renderer/leena.css` exists and is valid CSS (no syntax errors)
- [ ] All 3 treatments (aurora/coral/iris) define all gradient + orb + accent tokens
- [ ] All 3 themes (light/dark/vercel-dark) define all surface/text/glass/shadow/wall tokens
- [ ] Both density values (compact/comfortable) set --pad, --gap, --row
- [ ] All component classes from §4 present with correct properties
- [ ] All type scale classes from §2.3 present
- [ ] `prefers-reduced-motion` media query reduces/removes animations
- [ ] No hardcoded hex colors outside of token definitions
- [ ] `npm run check` passes (Biome lint/format clean)

## Tests Required
- `test/leena-css-tokens.test.js`: Parse `leena.css` as text; verify all expected custom property names are present for each theme/treatment/density combo. Verify component class names exist. Verify no `#` hex values appear outside of `:root` and `[data-*]` selector blocks (ensuring no hardcoded colors in component rules).

## Outputs
- `src/renderer/leena.css` — complete design token stylesheet (~400-600 lines)
- `test/leena-css-tokens.test.js` — token completeness test

## Interface Contracts
- All Phase 0 tasks (011–021) depend on `leena.css` being importable and all tokens being defined
- `index.html` will import `leena.css` before `styles.css`
- The `.leena` wrapper div with `data-theme`, `data-treatment`, `data-density` attributes must be the outermost app container
- Treatment, theme, and density tokens are the ONLY way to control colors/spacing — no inline hex

## Handoff Notes
_Filled after completion._

## Errors Encountered
_Filled if errors occur._

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Token referenced but undefined | grep for `var(--` in all CSS/HTML vs defined props | Any undefined var | Add missing token to leena.css |
| Hardcoded color in component CSS | grep for `#[0-9a-f]` outside token blocks | >0 matches | Replace with token reference |
| Theme not fully covered | count tokens per theme selector | <20 tokens in any theme | Complete the theme definition |
