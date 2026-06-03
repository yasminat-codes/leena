---
id: "121"
title: "UI baseline proof harness"
type: test
status: completed
completed_at: "2026-06-03T21:27:08Z"
wave: 17
priority: critical
complexity: S
estimated_tokens: 8000
dependencies: []
context_files:
  - src/renderer/index.html
  - src/renderer/leena.css
  - src/renderer/screens/home.js
  - src/renderer/screens/settings.js
  - test/design-system-audit.test.js
skills: []
tags: [ui, screenshots, regression, proof]
attempts: 1
claim_started: "2026-06-03T21:08:47Z"
created_at: "2026-06-03"
---

## Objective
Add a repeatable UI proof harness that captures current Home, Settings, Integrations, and voice dock states before visual changes begin.

## Why This Matters
The screenshots show overlap, raw controls, and unpolished shadows. Later UI tasks need objective before/after proof, not subjective memory.

## Steps
1. Run kencode-search for lightweight Electron or Playwright screenshot smoke patterns.
2. Add a script or test helper that can open the renderer shell at the approved panel size.
3. Capture baseline screenshots for Home, Settings, Integrations, and the voice dock/start state.
4. Add a pixel/nonblank check so blank or clipped screenshots fail.
5. Store baseline artifacts under `tasks/artifacts/post-mvp-ui-baseline/`.
6. Document exact commands in the task handoff.

## Acceptance Criteria
- [x] Baseline screenshots exist for the key screens and states.
- [x] Harness fails if the app surface is blank.
- [x] Harness records viewport/window size.
- [x] No implementation styling is changed in this task.

## Tests Required
- Focused screenshot harness command.
- `npm run check`
- `node --test` if a test helper is added.

## Outputs
- `tasks/artifacts/post-mvp-ui-baseline/`
- Optional `test/ui-baseline-smoke.test.js` or equivalent helper.

## Interface Contracts
Later UI tasks must refresh screenshots with the same harness and compare against the baseline.

## Handoff Notes
- kencode-search query used: `searchCode("page.screenshot({ path:")`, `searchCode("page.screenshot(")`, `searchCode("_electron.launch(")`, `searchCode("toHaveScreenshot(")`, and `referenceSources("Playwright Electron screenshot smoke test")`. No usable ready-made snippet came back, so the harness uses the repo's existing Playwright dependency directly.
- Harness command: `node --test test/ui-baseline-smoke.test.js`.
- Harness behavior: serves `src/` through a temporary `127.0.0.1` HTTP server, opens `/renderer/index.html` at `1060x712` with `deviceScaleFactor: 1`, injects deterministic `window.leena` data, freezes `Date` to `2026-06-03T21:08:47.000Z`, and captures Home, Settings, Integrations, and voice dock/start.
- Failure checks: page console/page errors, missing readiness selectors, required selectors outside the viewport, PNG visible-pixel ratio at or below `0.05`, PNG luminance range at or below `12`, or PNG color buckets at or below `12`.
- Screenshot artifacts: `home.png`, `settings.png`, `integrations.png`, `voice-dock-start.png`.
- Manifest artifact: `manifest.json` records viewport/window size, device scale factor, fixed time, command names, and per-screenshot nonblank stats.
- Verification passed: `node --test test/ui-baseline-smoke.test.js` (1/1), `npm run check`, and `node --test` (542/542).

## Errors Encountered
- Chromium blocked direct `file://` module loading during the dry run, so the committed harness uses a temporary local HTTP server.
- The first Settings selector contract was too strict for the long provider block; it was tightened to visible above-the-fold Settings anchors without changing production UI.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Screenshot blank | Pixel variance | 0 or near 0 | Fix launch/wait condition before proceeding |
| Screen clipped | Expected selector outside viewport | Any key selector missing | Adjust harness viewport, not product CSS |
| Flaky timing | Intermittent blank captures | 2 failures | Add readiness selector wait |
