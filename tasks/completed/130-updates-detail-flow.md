---
id: "130"
title: "Updates detail flow"
type: ui
status: completed
wave: 20
priority: high
complexity: S
estimated_tokens: 9000
dependencies: ["126", "127"]
context_files:
  - src/renderer/screens/settings.js
  - src/main.js
  - src/preload.js
  - test/settings-screen.test.js
skills: []
tags: [updates, settings, electron-updater]
attempts: 1
claim_started: "2026-06-04T02:05:17Z"
completed_at: "2026-06-04T02:36:08Z"
created_at: "2026-06-03"
---

## Objective
Make Updates a focused detail that clearly shows available update state, download progress, and a separate restart-to-install action.

## Why This Matters
The user wants "Pull the latest update" to collect/apply updates, but not surprise-restart the app. This task makes the flow understandable.

## Steps
1. Run kencode-search for Electron updater UI state patterns.
2. Move update controls into the Updates detail.
3. Rename primary action to match state: Check, Download, or Restart to finish update.
4. Keep download/install IPC channels unchanged unless tests prove a gap.
5. Show current version, available version, progress, and last error.
6. Add tests for status-to-button-state mapping.

## Acceptance Criteria
- [x] Updates detail states are clear: idle, checking, available, downloading, downloaded, installing, error.
- [x] Download does not immediately restart the app.
- [x] Restart action appears only after download completes.
- [x] Version and available update text are visible.

## Tests Required
- `node --test test/settings-screen.test.js`
- Focused update-state unit tests if added.
- `npm run check`

## Outputs
- `src/renderer/screens/settings.js`
- `test/settings-screen.test.js`

## Interface Contracts
`window.leena.updates.download()` downloads only; `window.leena.updates.install()` restarts/installs.

## Handoff Notes
- Ran required kencode-search first; no exact public snippet for `window.leena.updates.download` was found, so implementation followed local bridge contracts.
- Updates detail now renders explicit state, app version, available update version, progress, status, and last-error targets.
- Renderer update state mapper covers `idle`, `checking`, `available`, `downloading`, `downloaded`, `installing`, and `error`, while preserving existing `current` and `development` states from main.
- `window.leena.updates.download()` and `window.leena.updates.install()` remain separate renderer calls; main/preload were not changed.
- Added focused settings tests for state-to-button mapping and for download/install bridge separation.
- Parent verification passed after combined Wave 20 integration and reviewer fix: `npm run check`, full `node --test` (623/623), `node --test test/ui-baseline-smoke.test.js`, changed-file `node --check`, and `git diff --check`.

## Errors Encountered
- Early worker-local `npm run check` was blocked by concurrent Wave 20 edits; parent integration resolved the combined diff and terminal `npm run check` passed.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Surprise restart | Download calls install | Any occurrence | Split actions |
| Status unclear | Button label mismatches state | Any state | Fix state mapper |
| Error hidden | Error state lacks text | Any occurrence | Surface message |
