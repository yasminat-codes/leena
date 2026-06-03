---
id: "144"
title: "UI screenshot regression suite"
type: test
status: pending
wave: 21
priority: critical
complexity: M
estimated_tokens: 14000
dependencies: ["125", "127", "128", "129", "130", "131", "132", "140", "141", "142", "143"]
context_files:
  - test/design-system-audit.test.js
  - test/shell-rendering.test.js
  - src/renderer/leena.css
skills: []
tags: [ui, screenshots, regression]
attempts: 0
created_at: "2026-06-03"
---

## Objective
Turn the post-MVP UI proof harness into a regression suite covering Home, Chat, Settings details, Integrations details, and voice states.

## Why This Matters
The user asked for meticulous UI with no mistakes. Screenshot proof is the only honest way to catch overlap and scale errors.

## Steps
1. Reuse task 121 harness and refresh it after UI implementation tasks.
2. Capture Home, Chat, Settings Overview, Theme, Providers, Updates, Integrations, Composio, MCP, Mac Access, Starting Voice, Listening, and Error states.
3. Add nonblank, no-horizontal-overflow, and key-selector visibility checks.
4. Add mobile/narrow or minimum panel-size checks only if supported by current Electron bounds.
5. Save artifacts under `tasks/artifacts/post-mvp-ui-regression/`.
6. Document manual review findings in handoff.

## Acceptance Criteria
- [ ] Every major new surface has screenshot proof.
- [ ] Harness fails on blank screens or missing key selectors.
- [ ] No visible overlap in captured approved-size screenshots.
- [ ] Artifacts are recorded for owner review.

## Tests Required
- UI screenshot regression command.
- `npm run check`
- `node --test` for any helper tests.

## Outputs
- `tasks/artifacts/post-mvp-ui-regression/`
- Screenshot helper/tests as needed.

## Interface Contracts
This suite is a release gate for post-MVP UI polish waves.

## Handoff Notes
To be filled by executor.

## Errors Encountered
To be filled if errors occur.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Hidden overlap | Screenshot review | Any incoherent overlap | Reopen owning UI task |
| Blank state | Pixel check | Blank/near blank | Fix readiness wait |
| Missing state | Required screenshot absent | Any absence | Block release task |
