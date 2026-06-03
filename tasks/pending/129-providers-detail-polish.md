---
id: "129"
title: "Providers detail polish"
type: ui
status: pending
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
attempts: 0
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
- [ ] Provider cards do not overlap the voice dock at approved size.
- [ ] Capabilities are readable and not clipped.
- [ ] Refresh Models buttons remain bound.
- [ ] Provider configuration save/test flow still works.

## Tests Required
- `node --test test/provider-model-selector.test.js test/settings-screen.test.js test/provider-integration.test.js`
- UI screenshot harness from task 121.
- `npm run check`

## Outputs
- `src/renderer/screens/settings.js`
- `src/renderer/leena.css`
- Provider tests as needed.

## Interface Contracts
Provider defaults remain stored under `provider:default:{capability}`.

## Handoff Notes
To be filled by executor.

## Errors Encountered
To be filled if errors occur.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Card clipping | Screenshot bounds | Any clipped text/control | Adjust grid/minmax |
| Default lost | Saved provider missing | Any regression | Preserve setting keys |
| Refresh broken | Models not loaded | Any failure | Fix bridge call path |
