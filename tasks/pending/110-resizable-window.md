---
id: "110"
title: "Resizable panel window with persistence"
type: feature
status: pending
priority: medium
complexity: S
estimated_tokens: 8000
dependencies: ["038"]
context_files:
  - src/main.js
  - src/settings-store.js
skills: []
tags: [phase-7, window, persistence]
attempts: 0
created_at: "2026-06-01"
---

## Objective
Allow the panel-mode window to be resized within defined bounds, and persist window size and position across sessions via the settings store.

## Why This Matters
Fixed-size windows feel rigid. Users expect to resize and have the app remember their preference — a basic desktop app affordance that signals polish.

## Steps
1. In `main.js` window creation for panel mode, set `resizable: true` with `minWidth: 380`, `maxWidth: 800`, `minHeight: 500`, `maxHeight: 1200`.
2. Create a `WindowStateStore` utility (or extend settings store) that saves `{ x, y, width, height }` on window `resize` and `move` events (debounced 500ms to avoid write spam).
3. On panel window creation, read saved state from settings store; if exists, use those bounds; if not, use defaults from current `main.js` panel config.
4. Handle edge case: saved position is off-screen (monitor changed) — detect via `screen.getDisplayMatching(bounds)` and reset to centered on primary display if no match.
5. Add IPC channel `window:get-state` and `window:set-state` for renderer access if needed.

## Acceptance Criteria
- [ ] Panel window is resizable between min/max bounds
- [ ] Window size and position persist across app restarts
- [ ] Off-screen saved position resets to centered on primary display
- [ ] Orb and call modes remain fixed-size (only panel is resizable)
- [ ] Resize/move events are debounced (no write spam)

## Tests Required
- `test/window-state.test.js` — mock settings store, verify save/load, verify off-screen detection resets to defaults, verify debounce

## Outputs
- Modified `src/main.js` (panel window config)
- New window state persistence logic (inline in main.js or new `src/window-state-store.js`)
- New `test/window-state.test.js`

## Interface Contracts
- Depends on settings store (task 038) for persistence
- No downstream dependencies

## Handoff Notes
[Filled after completion]

## Errors Encountered
[Filled if errors occur]

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Window opens at wrong size after update | version migration issue | 1 occurrence | Add schema version to saved state; reset on mismatch |
| Debounce too slow — state lost on quick quit | missing save | 1 occurrence | Add flush on `before-quit` event |
| Off-screen detection fails for multi-monitor | window opens invisible | 1 occurrence | Check all displays, not just primary |
