---
id: "124"
title: "Sidebar Chat route"
type: ui
status: pending
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
attempts: 0
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
- [ ] Sidebar order is Home, Chat, Activity, Tasks, Integrations, Settings.
- [ ] Chat route renders a non-empty screen.
- [ ] Active state and `aria-current` work for Chat.
- [ ] Existing shell tests pass.

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
To be filled by executor.

## Errors Encountered
To be filled if errors occur.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Route missing | Shell cannot set Chat | Any failure | Fix screen registry |
| Sidebar crowded | Labels overflow at 1060px | Any overlap | Use icon-first responsive label rules |
| Existing route regresses | Shell tests fail | Any failure | Restore route contract |
