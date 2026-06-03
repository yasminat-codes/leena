---
id: "130"
title: "Updates detail flow"
type: ui
status: pending
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
attempts: 0
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
- [ ] Updates detail states are clear: idle, checking, available, downloading, downloaded, installing, error.
- [ ] Download does not immediately restart the app.
- [ ] Restart action appears only after download completes.
- [ ] Version and available update text are visible.

## Tests Required
- `node --test test/settings-screen.test.js`
- Focused update-state unit tests if added.
- `npm run check`

## Outputs
- `src/renderer/screens/settings.js`
- Optional update status helper/test.

## Interface Contracts
`window.leena.updates.download()` downloads only; `window.leena.updates.install()` restarts/installs.

## Handoff Notes
To be filled by executor.

## Errors Encountered
To be filled if errors occur.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Surprise restart | Download calls install | Any occurrence | Split actions |
| Status unclear | Button label mismatches state | Any state | Fix state mapper |
| Error hidden | Error state lacks text | Any occurrence | Surface message |
