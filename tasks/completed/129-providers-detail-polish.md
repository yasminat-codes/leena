---
id: "129"
title: "Providers detail polish"
type: ui
status: completed
wave: 20
priority: high
complexity: M
estimated_tokens: 12000
dependencies: ["126", "127"]
context_files:
  - src/renderer/screens/settings.js
  - src/providers/index.js
  - test/provider-model-selector.test.js
  - test/settings-screen.test.js
skills: []
tags: [providers, settings, models]
attempts: 1
claim_started: "2026-06-04T02:05:17Z"
completed_at: "2026-06-04T02:36:08Z"
created_at: "2026-06-03"
---

## Objective
Make Providers a focused settings detail with clean provider cards, capability defaults, model refresh, and no overlap.

## Why This Matters
The screenshot shows provider cards clipped and overlapped by the voice dock. Provider health is core to both chat and voice reliability.

## Steps
1. Run kencode-search for provider/settings card UI references.
2. Move provider selector UI into the Providers detail.
3. Redesign provider cards for OpenAI, OpenRouter, and Ollama with stable card widths.
4. Keep capability default selectors and model refresh actions functional.
5. Add empty/error/loading states that fit the detail panel.
6. Add tests for provider data rendering and model selector wiring.

## Acceptance Criteria
- [x] Provider cards do not overlap the voice dock at approved size.
- [x] Capabilities are readable and not clipped.
- [x] Refresh Models buttons remain bound.
- [x] Provider configuration save/test flow still works.

## Tests Required
- `node --test test/provider-model-selector.test.js test/settings-screen.test.js test/provider-integration.test.js`
- UI screenshot harness from task 121.
- `npm run check`

## Outputs
- `src/renderer/screens/settings.js`
- `src/renderer/leena.css`
- Provider tests as needed.

## Outputs Actual
- `src/renderer/screens/settings.js`: Providers detail now groups provider cards, capability defaults, and Ollama pull controls with empty/error/loading states preserved.
- `src/renderer/leena.css`: Added compact Providers detail sizing, stable provider card rows, capability-row compression, and desktop voice-dock clearance.
- `test/provider-model-selector.test.js`: Added refresh/default assertions, including no default persistence during load or refresh.
- `test/settings-screen.test.js`: Locked the Providers detail structure in the Settings render assertions.
- `test/ui-baseline-smoke.test.js`: Added a Providers detail screenshot state and explicit non-overlap assertions against `.command-center-mount`.
- `tasks/artifacts/post-mvp-ui-baseline/settings-providers.png`: Captured Providers detail proof from the task 121 harness.

## Interface Contracts
Provider defaults remain stored under `provider:default:{capability}`.

## Handoff Notes
- Ran kencode-search first for `provider:default:`; no public exact snippet was found, so implementation followed local contracts.
- Provider defaults continue to persist only through `provider:default:{capability}` when the user selects a provider/model; list load and model refresh do not write defaults.
- The visible refresh button text is shortened to `Refresh` with an `aria-label` of `Refresh {Provider} models`; bindings remain `data-provider-refresh="{providerId}"`.
- UI baseline manifest now includes `settings-providers.png` and overlap checks for provider cards, capability rows, and the Ollama pull panel.
- Parent verification passed after combined Wave 20 integration and reviewer fix: `npm run check`, full `node --test` (623/623), `node --test test/ui-baseline-smoke.test.js`, changed-file `node --check`, and `git diff --check`.

## Errors Encountered
- Initial UI smoke caught the Providers detail exceeding the approved viewport height; fixed by removing extra subsection copy and compacting rows/cards.
- Second UI smoke caught the Ollama pull panel overlapping the 480px command center; fixed by constraining that desktop panel width.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Card clipping | Screenshot bounds | Any clipped text/control | Adjust grid/minmax |
| Default lost | Saved provider missing | Any regression | Preserve setting keys |
| Refresh broken | Models not loaded | Any failure | Fix bridge call path |
