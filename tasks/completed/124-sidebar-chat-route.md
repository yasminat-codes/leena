---
id: "124"
title: "Sidebar Chat route"
type: ui
status: completed
wave: 18
priority: high
complexity: S
estimated_tokens: 9000
dependencies: ["123"]
context_files:
  - src/renderer/index.html
  - src/renderer/shell.js
  - src/renderer/components/command-center.js
  - test/shell-navigation.test.js
  - test/shell-rendering.test.js
skills: []
tags: [chat, sidebar, navigation]
attempts: 1
claim_started: "2026-06-03T22:05:26Z"
completed_at: "2026-06-03T22:27:04Z"
created_at: "2026-06-03"
---

## Objective
Add Chat back as a first-class sidebar screen without breaking existing Home, Activity, Tasks, Integrations, or Settings routes.

## Why This Matters
Chat exists in components and IPC, but the sidebar cannot open a conversation workspace. This task unblocks the full Chat workspace tasks.

## Steps
1. Run kencode-search for polished app sidebar/chat route patterns.
2. Add a Chat nav item with a recognizable chat icon and accessible label.
3. Add `Chat` to shell screen routing.
4. Create a minimal `renderChat()` screen placeholder that mounts cleanly.
5. Add or update shell tests for route normalization, active state, and screen rendering.
6. Verify existing routes still pass.

## Acceptance Criteria
- [x] Sidebar order is Home, Chat, Activity, Tasks, Integrations, Settings.
- [x] Chat route renders a non-empty screen.
- [x] Active state and `aria-current` work for Chat.
- [x] Existing shell tests pass.

## Tests Required
- `node --test test/shell-navigation.test.js test/shell-rendering.test.js`
- `npm run check`

## Outputs
- `src/renderer/index.html`
- `src/renderer/shell.js`
- `src/renderer/screens/chat.js`
- Shell tests as needed.

## Interface Contracts
Chat screen is the destination for text and voice conversation work, while the global voice dock remains available outside Chat.

## Handoff Notes
- Added Chat as the second sidebar item after Home with a recognizable message icon.
- Registered `Chat` in shell routing and added `src/renderer/screens/chat.js` with a minimal non-empty screen.
- Extended shell tests to cover approved sidebar order, static markup order, Chat normalization, screen rendering, active class, and `aria-current`.
- Verification passed:
  - `node --test test/shell-navigation.test.js test/shell-rendering.test.js`
  - `npm run check`
  - `node --test`

## Errors Encountered
- Initial `npm run check` failed on Biome formatting in `test/shell-navigation.test.js`; the formatting was corrected and the check passed.
- A later `npm run check` rerun failed on out-of-scope concurrent edits in `src/providers/provider-settings.js`; targeted Biome for the task 124 files still passed.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Route missing | Shell cannot set Chat | Any failure | Fix screen registry |
| Sidebar crowded | Labels overflow at 1060px | Any overlap | Use icon-first responsive label rules |
| Existing route regresses | Shell tests fail | Any failure | Restore route contract |
