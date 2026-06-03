---
id: "125"
title: "Visual token and orb polish"
type: ui
status: completed
wave: 18
priority: critical
complexity: M
estimated_tokens: 14000
dependencies: ["121"]
context_files:
  - src/renderer/leena.css
  - src/renderer/components/orb.js
  - src/renderer/components/command-center.css
  - test/leena-css-tokens.test.js
  - test/orb-waveform.test.js
skills: []
tags: [ui-polish, orb, theme, light-mode]
attempts: 1
claim_started: "2026-06-03T22:05:26Z"
completed_at: "2026-06-03T22:27:04Z"
created_at: "2026-06-03"
---

## Objective
Refine the orb, shadows, traffic-light treatment, and theme-specific visual tokens so light mode looks premium and stable.

## Why This Matters
The screenshots show a heavy green orb shadow, weak lights, and inconsistent glass. This task establishes the visual foundation for all later UI sections.

## Steps
1. Run kencode-search for refined orb/glass/shadow CSS references.
2. Reduce green-dominant shadows and move orb glow into theme-aware tokens.
3. Make each treatment (`workspace`, `aurora`, `coral`, `iris`) produce a distinct but restrained orb.
4. Polish traffic-light styling so the lights are representative and not toy-like.
5. Keep existing theme and treatment values unchanged.
6. Add/update CSS token tests and orb visual contract tests.
7. Refresh screenshot proof with task 121 harness.

## Acceptance Criteria
- [x] No oversized green shadow behind the home orb in light/workspace mode.
- [x] Theme/treatment values are preserved exactly.
- [x] Traffic lights are visually distinct and aligned.
- [x] Screenshots show no overlapping chrome.
- [x] Token tests prevent one-note purple/green regressions.

## Tests Required
- `node --test test/leena-css-tokens.test.js test/orb-waveform.test.js`
- UI screenshot harness from task 121.
- `npm run check`

## Outputs
- `src/renderer/leena.css`
- Optional component/test updates.
- Refreshed screenshots under `tasks/artifacts/`.

## Interface Contracts
Appearance still applies through `#app-shell.leena` data attributes only.

## Handoff Notes
Implemented theme-scoped orb, command shadow, home surface, orb well, and traffic-light tokens in `src/renderer/leena.css`; routed the floating Command Center through `--command-shadow`; and added focused CSS/orb regressions. The refreshed task 121 baseline screenshots under `tasks/artifacts/post-mvp-ui-baseline/` show the workspace Home orb without the oversized green halo and the Suggested/Recent Home row collision repaired.

Task-local gates are green: owned-file Biome check, focused CSS/orb tests, and the UI baseline harness. Repo-wide `npm run check` and full `node --test` are blocked by concurrent task 126 Settings changes outside task 125 scope.

## Errors Encountered
- `npm run check` fails only on unowned `src/renderer/screens/settings.js` formatting at `renderSettingsSelectField(...)`.
- Full `node --test` passes 553/554; the lone failure is `test/settings-screen.test.js` expecting `class="panel-glass settings-identity"` while the concurrent Settings implementation renders `class="panel-glass settings-identity settings-detail-section"`.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Heavy glow | Shadow blur/opacity dominates orb | Visible halo larger than orb | Reduce token intensity |
| Theme drift | Existing values renamed | Any occurrence | Revert naming |
| One-note palette | CSS scan dominated by one hue | Any visible dominance | Balance surfaces and accents |
