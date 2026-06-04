---
id: "144"
title: "UI screenshot regression suite"
type: test
status: completed
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
attempts: 1
claim_started: "2026-06-04T04:04:04Z"
completed_at: "2026-06-04T04:24:15Z"
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
- [x] Every major new surface has screenshot proof.
- [x] Harness fails on blank screens or missing key selectors.
- [x] No visible overlap in captured approved-size screenshots.
- [x] Artifacts are recorded for owner review.

## Tests Required
- UI screenshot regression command.
- `npm run check`
- `node --test` for any helper tests.

## Outputs
- `tasks/artifacts/post-mvp-ui-regression/`
- Screenshot helper/tests as needed.

## Outputs Actual
- `test/ui-baseline-smoke.test.js`
- `tasks/artifacts/post-mvp-ui-regression/manifest.json`
- `tasks/artifacts/post-mvp-ui-regression/home.png`
- `tasks/artifacts/post-mvp-ui-regression/chat.png`
- `tasks/artifacts/post-mvp-ui-regression/settings-overview.png`
- `tasks/artifacts/post-mvp-ui-regression/settings-general.png`
- `tasks/artifacts/post-mvp-ui-regression/settings-theme.png`
- `tasks/artifacts/post-mvp-ui-regression/settings-providers.png`
- `tasks/artifacts/post-mvp-ui-regression/settings-updates.png`
- `tasks/artifacts/post-mvp-ui-regression/settings-mac-access.png`
- `tasks/artifacts/post-mvp-ui-regression/settings-integrations-health.png`
- `tasks/artifacts/post-mvp-ui-regression/integrations.png`
- `tasks/artifacts/post-mvp-ui-regression/integrations-composio.png`
- `tasks/artifacts/post-mvp-ui-regression/integrations-mcp.png`
- `tasks/artifacts/post-mvp-ui-regression/integrations-mac-access.png`
- `tasks/artifacts/post-mvp-ui-regression/voice-starting.png`
- `tasks/artifacts/post-mvp-ui-regression/voice-listening.png`
- `tasks/artifacts/post-mvp-ui-regression/voice-error.png`

## Interface Contracts
This suite is a release gate for post-MVP UI polish waves.

## Handoff Notes
- Reused and expanded the task 121 Playwright/static-renderer harness into a post-MVP regression suite. The suite now writes to `tasks/artifacts/post-mvp-ui-regression/`, cleans stale screenshots before capture, and records selector/PNG stats in `manifest.json`.
- Coverage now includes Home, Chat, Settings overview/general/theme/providers/updates/mac-access/integrations-health, Integrations overview/Composio/Custom MCP/Full Disk Access, and voice starting/listening/error dock states.
- Added release-gate assertions for nonblank PNGs, key-selector visibility, no horizontal overflow, selected non-overlap checks, and the supported 720px narrow Chat layout.
- Voice starting uses `#app-shell.leena[data-orb-state="starting"]` with the command-center visual state mapped to `thinking`; the command-center component itself does not expose a literal `starting` state. This mapping is documented in the artifact manifest.
- Parent visual inspection spot-checked Home, Settings Providers, Chat, and voice Listening artifacts; captures were legible and nonblank, with no key control covered by the dock. Custom MCP uses above-the-fold field checks because the full add form is taller than the approved viewport. Full Disk Access uses a minimal scroll hook so the Open Settings action is included in the screenshot.
- Did not edit task-139-owned permission runtime files. Permission-prompt-specific screenshot states remain outside this suite unless a later task requests dedicated prompt captures.
- Final proof: `node --test test/ui-baseline-smoke.test.js` passed 2/2; `node --test test/design-system-audit.test.js test/shell-rendering.test.js test/ui-baseline-smoke.test.js` passed 10/10; full `node --test` passed 631/631; `npm run check` passed.

## Errors Encountered
- `mcp__kencode_search.searchCode` found no public exact snippet for the `page.screenshot(` test anchor; followed local task 121 harness contracts.
- Focused screenshot suite initially caught over-broad Home/dock overlap, ambiguous Settings status selector, and below-viewport MCP/Mac Access controls. Fixed inside the harness by scoping selectors, checking the Home Suggested/Recent boundary directly, checking visible MCP fields, and scrolling the Full Disk Access action into view.
- During parallel worker verification, `npm run check` and full `node --test` were temporarily red in task-139-owned permission files; task 139 and parent verification resolved those failures before completion.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Hidden overlap | Screenshot review | Any incoherent overlap | Reopen owning UI task |
| Blank state | Pixel check | Blank/near blank | Fix readiness wait |
| Missing state | Required screenshot absent | Any absence | Block release task |
