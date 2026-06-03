---
id: "035"
title: "System tray / menubar icon"
type: feature
status: completed
priority: high
complexity: M
estimated_tokens: 14000
dependencies: ["032"]
context_files:
  - src/main.js
  - src/preload.js
  - src/renderer/index.html
skills: []
tags: [phase-1, tray, menubar, macos]
attempts: 1
claim_started: "2026-06-03T01:04:37Z"
completed_at: "2026-06-03T01:24:00Z"
created_at: "2026-06-01"
---

## Objective
Add a macOS menubar tray icon for Leena with a context menu (Show/Hide, Mute, Settings, Quit), state-dependent icon variants, and close-to-tray behavior so the app persists in the background.

## Why This Matters
Desktop assistants must be always-available. The tray icon provides persistent access without a Dock presence, shows assistant state at a glance, and allows close-to-tray behavior so the window can be dismissed without killing the app.

## Steps
1. Create tray icon assets: `build/tray/iconTemplate.png` and `build/tray/iconTemplate@2x.png` (16×16 and 32×32, macOS Template image format — single channel, the OS handles dark/light). Create variants: `iconTemplate-muted.png` / `@2x` for muted state, `iconTemplate-active.png` / `@2x` for listening/speaking state.
2. In `src/main.js`, after `app.whenReady()`, create a `Tray` instance with the idle icon. Build a context menu with `Menu.buildFromTemplate`: "Show Leena" (toggles window visibility), separator, "Mute" (toggles mute state), "Settings" (opens panel mode to settings), separator, "Quit Leena" (`app.quit()`).
3. Add tray icon state management: export a `setTrayState(state)` function that accepts `'idle' | 'listening' | 'speaking' | 'muted'` and swaps the tray icon + updates the "Mute"/"Unmute" label. Wire this to existing session state changes in main.js.
4. Implement close-to-tray: intercept the window `close` event — if tray exists and the quit flag is not set, call `event.preventDefault()` and `mainWindow.hide()` instead. Set a `isQuitting` flag in `app.on('before-quit')` so Cmd+Q actually quits.
5. Add IPC event `tray:state-changed` that the renderer can listen to, and `window.leena.onTrayAction(callback)` in preload for tray menu actions that affect the renderer (e.g., mute toggled from tray).
6. Write `test/tray.test.js`: mock Tray/Menu classes, verify context menu has expected items, verify `setTrayState` switches icons, verify close-to-tray behavior (window hidden, not destroyed).

## Acceptance Criteria
- [ ] Tray icon appears in macOS menubar on app launch
- [ ] Context menu has: Show/Hide Leena, Mute/Unmute, Settings, Quit Leena
- [ ] Tray icon changes for idle, listening, speaking, muted states
- [ ] Closing the window hides to tray (not quit) — Cmd+Q quits
- [ ] "Show Leena" tray action makes window visible and focused
- [ ] Test passes

## Tests Required
- `test/tray.test.js` — mock Electron Tray/Menu, verify menu items, state switching, close-to-tray logic

## Outputs
- New: `build/tray/iconTemplate.png`, `iconTemplate@2x.png`, `-muted` variants, `-active` variants
- Modified: `src/main.js` (tray creation, close-to-tray, state management)
- Modified: `src/preload.js` (tray action listener)
- Modified: `src/renderer/renderer.js` (runtime tray state updates from listening/speaking/idle modes)
- New: `src/tray.js`
- New: `test/tray.test.js`
- New: `test/wave10-integration.test.js`

## Interface Contracts
- Task 037 (onboarding): "Settings" tray action opens settings view
- Task 036 (hotkey): hotkey toggles window, must coordinate with tray show/hide
- Phase 6 (wake word): tray gains "Wake word" submenu items
- Phase 6 (UI wire): tray state driven by real session events

## Handoff Notes
- `src/tray.js` owns the injectable tray controller. `src/main.js` wires it with Electron `Tray`, `Menu`, `nativeImage`, `app`, the current `mainWindow`, and `setMainWindowMode`.
- Close-to-tray is active through `wireWindowCloseToTray()`. `before-quit` marks real shutdown, so Cmd+Q and "Quit Leena" still quit.
- Preload exposes `setTrayState`, `getTrayState`, `onTrayAction`, `offTrayAction`, `onTrayStateChanged`, and `offTrayStateChanged`.
- Renderer calls `setTrayState()` for `listening`, `speaking`, and `idle` modes. Main preserves `muted` when runtime state updates arrive so tray mute is not accidentally cleared by renderer activity.
- `test/tray.test.js` verifies menu labels/actions, state icon switching, renderer IPC payloads, and close-to-tray behavior. `test/wave10-integration.test.js` verifies main/preload wiring and packaging config.
- Final parent gates passed: `npm run check`, `node --test` (329/329), changed JS syntax checks, `git diff --check`, dir build, DMG/ZIP build, mounted DMG layout check, and packaged tray asset check.

## Errors Encountered
- Initial `npm run check` caught Biome import/format issues in `test/tray.test.js`; fixed with Biome on the tray helper/test files. No new LEARNINGS rule needed.
- Repo-wide gates were temporarily blocked by other Wave 10 slices while workers were still running. Parent integration re-ran `npm run check` and `node --test` successfully.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Tray icon not visible | Tray not rendering on macOS | Any | Check Template image format, ensure @2x exists |
| Close-to-tray not working | Window destroyed instead of hidden | Any | Check isQuitting flag logic, verify close event interception |
| Icon state not updating | setTrayState called but icon unchanged | Any | Check image paths, verify Tray.setImage works with nativeImage |
