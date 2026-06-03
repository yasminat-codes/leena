---
id: "131"
title: "Integrations detail shell"
type: ui
status: completed
wave: 18
priority: high
complexity: M
estimated_tokens: 11000
dependencies: ["123", "126"]
context_files:
  - src/renderer/screens/integrations.js
  - src/renderer/leena.css
  - test/integrations-screen.test.js
  - test/integrations-screen-data.test.js
skills: []
tags: [integrations, mcp, composio, apple]
attempts: 1
claim_started: "2026-06-03T22:27:04Z"
completed_at: "2026-06-03T22:42:25Z"
created_at: "2026-06-03"
---

## Objective
Refactor Integrations into polished cards with in-place detail panels for Composio, Custom MCP, Apple Calendar, Files, and provider health.

## Why This Matters
The current MCP add form is raw and takes over the screen. The approved UX needs a mature integrations workspace.

## Steps
1. Run kencode-search for integration marketplace/detail panel UI patterns.
2. Add integration cards for Composio, Custom MCP, Apple Calendar, Files/Full Disk Access, and Provider Health.
3. Add an in-place detail panel shell shared by every integration.
4. Keep existing MCP server list and connection summary visible.
5. Add empty/loading/error states that use the same card system.
6. Update integration rendering tests.

## Acceptance Criteria
- [x] Integrations screen no longer opens directly into raw MCP form fields.
- [x] Composio is first-class and visible.
- [x] Custom MCP remains available for advanced setup.
- [x] Existing MCP server list still renders and refreshes.

## Tests Required
- `node --test test/integrations-screen.test.js test/integrations-screen-data.test.js`
- UI screenshot harness from task 121.
- `npm run check`

## Outputs
- `src/renderer/screens/integrations.js`
- `src/renderer/leena.css`
- Integration tests as needed.

## Interface Contracts
Integrations detail panels reuse existing `window.leena.mcp` bridge until new Composio/Mac APIs are added.

## Handoff Notes
- Ran the required task-local kencode-search pass before editing. The shell `kencode-search` wrapper was not on PATH, so the MCP-backed `mcp__kencode_search` tools were used directly; no reusable exact reference matched this shell, so implementation followed Wave 17 contracts and local Leena source/tests.
- Added a Composio-first overview card row for Composio, Custom MCP, Apple Calendar, Files/Full Disk Access, and Provider Health.
- Added a shared in-place detail shell. Initial Integrations now opens to the Composio Actions Hub detail and does not include Custom MCP form inputs/selects until the Custom MCP detail is selected.
- Kept live MCP summary, server list, refresh, connect/disconnect, remove, and add-server bridge behavior on the existing `window.leena.mcp` contract.
- Added Provider Health metrics from normalized MCP server status and kept loading/empty/error states on the same card system.
- Updated focused integration render/data tests and inspected the refreshed Integrations UI baseline screenshot.
- Verification passed: `node --test test/integrations-screen.test.js test/integrations-screen-data.test.js` (10/10), `node --test test/ui-baseline-smoke.test.js` (1/1), `npm run check`, and full `node --test` (561/561).

## Errors Encountered
- The shell command `kencode-search` was not installed on PATH (`zsh: command not found: kencode-search`); MCP-backed kencode-search tools were available and used before edits.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Raw form visible by default | Initial screenshot | Any raw MCP form fields | Hide under Custom MCP detail |
| MCP list lost | Existing list test fails | Any failure | Preserve server list mount |
| Detail special-cased | Composio-only layout | Any duplicate shell | Extract shared detail shell |
