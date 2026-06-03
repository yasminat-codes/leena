---
id: "110"
title: "Resizable panel window with persistence"
type: feature
status: completed
priority: medium
complexity: S
estimated_tokens: 8000
dependencies: ["038"]
context_files:
  - src/main.js
  - src/settings-store.js
skills: []
tags: [phase-7, window, persistence]
attempts: 1
claim_started: "2026-06-03T02:05:04Z"
completed_at: "2026-06-03T02:38:02Z"
created_at: "2026-06-01"
---

## Objective
Allow the panel-mode window to be resized within defined bounds, and persist window size and position across sessions via the settings store.

## Why This Matters
Fixed-size windows feel rigid. Users expect to resize and have the app remember their preference — a basic desktop app affordance that signals polish.

## Steps
1. In `main.js` window creation for panel mode, set `resizable: true` with `minWidth: 380`, `maxWidth: 1280`, `minHeight: 500`, `maxHeight: 1200`.
2. Create a `WindowStateStore` utility (or extend settings store) that saves `{ x, y, width, height }` on window `resize` and `move` events (debounced 500ms to avoid write spam).
3. On panel window creation, read saved state from settings store; if exists, use those bounds; if not, use defaults from current `main.js` panel config.
4. Handle edge case: saved position is off-screen (monitor changed) — detect via `screen.getDisplayMatching(bounds)` and reset to centered on primary display if no match.
5. Add IPC channel `window:get-state` and `window:set-state` for renderer access if needed.

## Acceptance Criteria
- [x] Panel window helper exports resizable min/max bounds (`380..1280`, `500..1200`)
- [x] Window size and position helpers persist through the settings-store interface
- [x] Off-screen saved position resets to centered defaults on the primary display
- [x] Orb and call mode options remain fixed-size while panel is resizable
- [x] Resize/move persistence helper debounces writes and exposes `flush()` for quit

## Tests Required
- `test/window-state.test.js` — mock settings store, verify save/load, verify off-screen detection resets to defaults, verify debounce

## Outputs
- New `src/window-state.js`
- New `test/window-state.test.js`
- Deferred shared `src/main.js` runtime wiring to the serialized integration pass

## Interface Contracts
- Depends on settings store (task 038) for persistence
- No downstream dependencies

## Handoff Notes
- Implemented `src/window-state.js` as a task-owned, Electron-free helper module.
- `PANEL_WINDOW_CONSTRAINTS` exports the panel limits: `minWidth: 380`, `maxWidth: 1280`, `minHeight: 500`, `maxHeight: 1200`.
- `getWindowModeOptions(mode, modeConfig)` returns fixed exact bounds for `orb` and `call`, and resizable panel bounds for `panel`.
- `loadPanelWindowBounds()` / `savePanelWindowBounds()` read and write `window:panel:bounds` through the task 038 settings-store contract.
- `normalizeWindowBounds()` rounds finite `{ x, y, width, height }` values and clamps panel dimensions into the panel constraints.
- `resolvePanelWindowBounds({ savedBounds, defaultBounds, displays })` reuses visible saved bounds, uses defaults when no saved bounds exist, and resets off-screen saved bounds to centered defaults on the primary display.
- `createPanelWindowStatePersistence()` provides `scheduleSave()`, `saveNow()`, `flush()`, `cancel()`, and `hasPending()` with the mandated 500ms debounce.
- Exact `src/main.js` integration handoff when shared claims are clear:
  1. Replace the old position-only import from `src/realtime/tools/window-state-store.js` with imports from `./window-state.js`.
  2. Create one `panelWindowState = createPanelWindowStatePersistence()` after the database user-data path is initialized.
  3. Load `userWindowBounds = panelWindowState.load()` in `initializeDataStore()` instead of loading only `{ x, y }`.
  4. Build the `BrowserWindow` panel options from `getWindowModeOptions("panel", windowModes.panel)` and set `resizable: true`; keep `orb` and `call` fixed via `getWindowModeOptions(mode, windowModes[mode])`.
  5. In `getWindowBoundsForMode()`, compute the existing anchored panel default, then call `resolvePanelWindowBounds({ savedBounds: userWindowBounds, defaultBounds, displays: screen.getAllDisplays() })` for panel mode.
  6. Change `handleWindowMove` and the panel `resize` handler to call `panelWindowState.scheduleSave(mainWindow.getBounds())` only when `windowMode === "panel"` and the move/resize is not programmatic.
  7. Change `enforceModeBounds()` so it still snaps `orb` and `call` to exact size, but skips the fixed-size snap for `panel`.
  8. Call `panelWindowState.flush()` from `app.on("before-quit")` so a quick quit persists the last pending move/resize.
  9. Add `window:get-state` and `window:set-state` IPC over `loadPanelWindowBounds()` / `savePanelWindowBounds()` if renderer access is still desired.
- Reviewer fix 2026-06-03T03:12:59Z: preserved the existing `windowModes.panel.width` contract at `1060` and raised the helper max width to `1280` so resizing does not clamp the approved desktop shell to 800px. Updated `test/window-state.test.js` with the corrected default and clamp behavior.
- Verification passed: `node --check src/window-state.js`, `node --check test/window-state.test.js`, `node --test test/window-state.test.js`, `npm run check`, and full `node --test` with 390 passing.

## Errors Encountered
- First focused test run had incorrect expected center-position math in `test/window-state.test.js`; fixed the assertions and reran the focused test successfully.
- Focused Biome check reported formatting/import-order changes in the new helper/test; applied Biome fixes and reran successfully.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Window opens at wrong size after update | version migration issue | 1 occurrence | Add schema version to saved state; reset on mismatch |
| Debounce too slow — state lost on quick quit | missing save | 1 occurrence | Add flush on `before-quit` event |
| Off-screen detection fails for multi-monitor | window opens invisible | 1 occurrence | Check all displays, not just primary |
