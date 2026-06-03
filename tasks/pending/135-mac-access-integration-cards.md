---
id: "135"
title: "Mac access integration cards"
type: ui
status: pending
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
attempts: 0
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
- [ ] Full Disk Access appears as a distinct high-power capability.
- [ ] Apple Calendar and Files appear as day-one integration cards.
- [ ] Status labels fit without overlap.
- [ ] Request/Open Settings actions are visible and scoped.

## Tests Required
- `node --test test/integrations-screen.test.js test/os-permissions.test.js`
- UI screenshot harness from task 121.
- `npm run check`

## Outputs
- `src/renderer/screens/integrations.js`
- `src/os-permissions.js` if new definitions are needed.
- Tests as needed.

## Interface Contracts
Permission cards reflect detected status; setup actions open OS settings or trigger approved request APIs.

## Handoff Notes
To be filled by executor.

## Errors Encountered
To be filled if errors occur.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Misleading grant copy | Copy audit | Any "grant automatically" text | Replace with "open settings" wording |
| Card overlap | Screenshot bounds | Any overlap | Adjust grid/detail layout |
| Unsupported platform confused | Non-mac status | Any wrong label | Show unsupported/guide state |
