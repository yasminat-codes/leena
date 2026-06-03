---
id: "036"
title: "Global hotkey to summon Leena"
type: feature
status: completed
priority: high
complexity: S
estimated_tokens: 8000
dependencies: ["032", "038"]
context_files:
  - src/main.js
  - src/preload.js
skills: []
tags: [phase-1, hotkey, shortcut, macos]
attempts: 1
claim_started: "2026-06-03T02:05:04Z"
completed_at: "2026-06-03T02:54:10Z"
created_at: "2026-06-01"
---

## Objective
Register a global keyboard shortcut (default: Cmd+Shift+L) that toggles Leena's window visibility and optionally starts/stops a voice session, with the key combo configurable via settings.

## Why This Matters
A voice assistant must be instantly summable from any context. The global hotkey is the primary invocation method — faster than clicking the tray, works when Leena is hidden or behind other windows.

## Steps
1. In `src/main.js`, after `app.whenReady()`, read the configured hotkey from the settings store (default: `CommandOrControl+Shift+L`). Register it via `globalShortcut.register(accelerator, callback)`.
2. The callback toggles window state: if hidden → show + focus + send `hotkey:activated` to renderer; if visible and focused → hide; if visible but unfocused → focus.
3. Add an IPC handler `settings:set-hotkey` that accepts a new accelerator string, unregisters the old shortcut, validates the new one with `globalShortcut.register` (catch failure = conflict), persists to settings store, and returns `{ success: boolean, error?: string }`.
4. On `app.will-quit`, call `globalShortcut.unregisterAll()` to clean up.
5. Expose `setHotkey(accelerator)` and `getHotkey()` in preload under `window.leena`. Add `onHotkeyActivated(callback)` that listens for the `hotkey:activated` IPC event.
6. Write `test/hotkey.test.js`: mock `globalShortcut.register` / `unregister`, verify registration with default key, verify re-registration on change, verify conflict detection returns error.

## Acceptance Criteria
- [ ] Cmd+Shift+L toggles Leena window from any app
- [ ] Hotkey configurable via settings (persisted across restarts)
- [ ] Conflict detection: if shortcut already taken, returns error (does not crash)
- [ ] Shortcuts cleaned up on quit
- [ ] Preload exposes `setHotkey`, `getHotkey`, `onHotkeyActivated`
- [ ] Test passes

## Tests Required
- `test/hotkey.test.js` — mock globalShortcut, verify register/unregister/conflict

## Outputs
- Modified: `src/main.js` (hotkey registration, toggle logic)
- Modified: `src/preload.js` (hotkey API)
- New: `test/hotkey.test.js`

## Interface Contracts
- Task 035 (tray): hotkey and tray both toggle window — shared show/hide logic
- Task 037 (onboarding): displays configured hotkey, optionally lets user customize
- Task 038 (settings store): persists hotkey accelerator string

## Handoff Notes
- 2026-06-03T02:46:23Z helper slice complete: added `src/ipc/hotkey.js` with injectable `createHotkeyController()` and `registerHotkeyHandlers()` exports.
- Helper defaults to `CommandOrControl+Shift+L`, reads/writes the existing `hotkey` settings key, registers `settings:get-hotkey` / `settings:set-hotkey`, emits `hotkey:activated`, and wires `app.on("will-quit")` cleanup through `globalShortcut.unregisterAll()`.
- Reconfiguration unregisters the old accelerator, attempts the new registration, returns `{ success: false, error: "Hotkey is already in use." }` on conflict without throwing, and restores the prior shortcut without persisting the failed value.
- Activation behavior is covered with mocks: hidden/minimized windows restore/show/focus, visible focused windows hide, and visible unfocused windows focus.
- Serialized integration handoff: import `globalShortcut` plus `createHotkeyController` / `registerHotkeyHandlers` in `src/main.js`, create the controller after `createMainWindow()`, call `registerConfiguredHotkey()`, register the IPC handlers, and send the helper's `hotkey:activated` event through the main window. In `src/preload.js`, expose `getHotkey()`, `setHotkey(accelerator)`, and `onHotkeyActivated(callback)` on `window.leena`.
- Verification for this helper slice: `node --test test/hotkey.test.js`, `node --check src/ipc/hotkey.js && node --check test/hotkey.test.js`, `npm run check`, `node --test` (398 tests), and `git diff --check` all passed.

- Parent integration 2026-06-03T02:54:10Z: `src/main.js` now registers the configured global hotkey with Electron `globalShortcut`; `src/preload.js` exposes hotkey get/set and activation listeners.

## Errors Encountered
<!-- Filled if errors occur -->

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Hotkey conflict on default key | globalShortcut.register returns false | Any | Try fallback key (Cmd+Shift+;), surface in settings |
| Hotkey stops working after sleep | globalShortcut unregistered by OS | Any | Re-register on powerMonitor 'resume' event |
| Window focus race | Toggle fires twice rapidly | >1 per 500ms | Add debounce on callback |
