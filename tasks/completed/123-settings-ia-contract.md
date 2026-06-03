---
id: "123"
title: "Settings information architecture contract"
type: ui
status: completed
completed_at: "2026-06-03T21:27:08Z"
wave: 17
priority: critical
complexity: S
estimated_tokens: 7000
dependencies: []
context_files:
  - src/renderer/shell.js
  - src/renderer/screens/settings.js
  - src/renderer/screens/integrations.js
  - test/settings-screen.test.js
skills: []
tags: [settings, navigation, ia, dashboard]
attempts: 1
claim_started: "2026-06-03T21:08:47Z"
created_at: "2026-06-03"
---

## Objective
Write the accepted Settings and Integrations information architecture contract before UI implementation starts.

## Why This Matters
The user approved a lean sidebar and in-place detail panels. This task prevents later agents from adding too many tabs or mixing unrelated settings again.

## Steps
1. Record the approved main sidebar: Home, Chat, Activity, Tasks, Integrations, Settings.
2. Record Settings default view: compact Overview cards that open details in place.
3. Define Settings details: General, Theme, Providers, Updates, Mac Access.
4. Define Integrations detail cards: Composio, MCP, Apple Calendar, Files/Full Disk Access, provider health.
5. Define "not a tab explosion" rules for nested navigation.
6. Save the contract at `tasks/artifacts/settings-ia-contract.md`.

## Acceptance Criteria
- [x] Contract preserves existing theme choices and treatment options.
- [x] Contract makes Chat a top-level sidebar screen.
- [x] Contract keeps Composio as a first-class Actions Hub integration.
- [x] Contract states MCP manual setup belongs under Custom MCP or advanced detail.
- [x] Contract states Settings opens to Overview.

## Tests Required
No automated tests. Downstream UI tasks must add navigation and rendering tests.

## Outputs
- `tasks/artifacts/settings-ia-contract.md`

## Interface Contracts
All Settings/Integrations UI tasks must cite this contract in handoff notes.

## Handoff Notes
- Output written to `tasks/artifacts/settings-ia-contract.md`.
- kencode-search ran for settings/integrations/sidebar information-architecture references, but no usable direct anchor was found before quota/rate limits; the contract is grounded in the owner-approved post-MVP spec plus current Leena Settings/Integrations source and tests.
- Contract preserves sidebar order `Home, Chat, Activity, Tasks, Integrations, Settings`; Settings opens to Overview with General/Theme/Providers/Updates/Mac Access details; Integrations opens to Overview with Composio, Custom MCP, Apple Calendar, Files/Full Disk Access, and Provider Health cards/details.
- Independent orchestrator verification passed: artifact exists, content checks for sidebar order, Overview, theme/treatment/density preservation, Composio, Custom MCP, and no-tab-explosion rules passed, privacy scan clean, `npm run check` passed, focused UI harness passed, full `node --test` passed 542/542, and `git diff --check` passed.

## Errors Encountered
- Direct kencode reference searches for this exact IA shape did not return a reusable implementation; downstream UI tasks should cite this contract plus task 120's broader UI references.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Too many tabs | Top-level sidebar count | More than 6 | Move to detail panel |
| Settings mixed | Detail shows unrelated controls | Any occurrence | Split into focused detail view |
| Theme changed | Theme options removed/renamed | Any occurrence | Restore existing values |
