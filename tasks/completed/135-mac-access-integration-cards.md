---
id: "135"
title: "Mac access integration cards"
type: ui
status: completed
wave: 18
priority: high
complexity: S
estimated_tokens: 9000
dependencies: ["122", "131"]
context_files:
  - src/renderer/screens/integrations.js
  - src/os-permissions.js
  - src/renderer/onboarding.js
  - test/os-permissions.test.js
  - test/integrations-screen.test.js
skills: []
tags: [mac-access, integrations, apple]
attempts: 1
claim_started: "2026-06-03T22:45:12Z"
completed_at: "2026-06-03T23:00:43Z"
created_at: "2026-06-03"
---

## Objective
Add polished Mac Access integration cards for Microphone, Screen Recording, Accessibility, Full Disk Access, Apple Calendar, and Files.

## Why This Matters
The user wants Apple-related integrations and broad Mac access. The app must show capability status clearly and guide permission setup.

## Steps
1. Run kencode-search for macOS permission UI patterns in Electron apps.
2. Extend integration card data for Mac Access capabilities.
3. Show granted/needs setup/unsupported statuses.
4. Add action buttons for Request, Open Settings, and Learn more where appropriate.
5. Avoid promising silent permission grants.
6. Add rendering tests for each Mac access card state.

## Acceptance Criteria
- [x] Full Disk Access appears as a distinct high-power capability.
- [x] Apple Calendar and Files appear as day-one integration cards.
- [x] Status labels fit without overlap.
- [x] Request/Open Settings actions are visible and scoped.

## Tests Required
- `node --test test/integrations-screen.test.js test/os-permissions.test.js`
- UI screenshot harness from task 121.
- `npm run check`

## Outputs
- `src/renderer/screens/integrations.js`
- `src/os-permissions.js`
- `src/renderer/onboarding.js`
- `src/renderer/leena.css`
- `test/os-permissions.test.js`
- `test/integrations-screen.test.js`
- `test/integrations-screen-data.test.js`
- `test/onboarding-flow.test.js`

## Interface Contracts
Permission cards reflect detected status; setup actions open OS settings or trigger approved request APIs.

## Handoff Notes
- Ran required kencode-search before code through the MCP-backed `mcp__kencode_search` tools. Public source searches did not return a directly reusable Electron permission-card implementation, so implementation followed task 122's trust contract and current Leena source/tests.
- Added OS permission definitions for Full Disk Access, Apple Calendar, and Files, kept existing Microphone/Screen Recording/Accessibility ids stable, added `stale` status support, and mapped macOS privacy URLs.
- Extended Integrations from five cards to nine cards: Composio, Custom MCP, Microphone, Screen Recording, Accessibility, Full Disk Access, Apple Calendar, Files, and Provider Health.
- Mac Access detail panels show detected/granted/needs setup/needs settings/restricted/stale/unsupported states, scoped Request/Open Settings actions, and Learn more affordances without claiming silent grants.
- Kept Custom MCP add-server and live MCP server list/refresh/connect/disconnect/remove behavior intact.
- Added a parent fix after the first UI baseline failure: the nine-card marketplace now uses a single-row horizontal strip so `[data-integrations-list]` remains inside the baseline viewport.
- Verification passed: changed-file `node --check`, `npm run check`, focused integration/onboarding/permission tests (28/28), UI baseline harness (1/1), `git diff --check`, and full `node --test` (565/565).

## Errors Encountered
- Initial UI baseline failed because the expanded nine-card marketplace wrapped to multiple rows and pushed `[data-integrations-list]` below the 1060x712 proof viewport. Fixed by making `.integrations-marketplace` a horizontal grid strip with overflow-x auto and adding CSS regression assertions.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Misleading grant copy | Copy audit | Any "grant automatically" text | Replace with "open settings" wording |
| Card overlap | Screenshot bounds | Any overlap | Adjust grid/detail layout |
| Unsupported platform confused | Non-mac status | Any wrong label | Show unsupported/guide state |
