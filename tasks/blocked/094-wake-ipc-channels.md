---
id: "094"
title: "Wake word IPC channels"
type: feature
status: blocked
priority: high
complexity: M
estimated_tokens: 15000
dependencies: ["093", "038"]
context_files:
  - src/main.js
  - src/preload.js
  - src/wake/wake-coordinator.js
skills: []
tags: [phase-6, wake-word, ipc]
attempts: 1
claim_started: "2026-06-03T02:05:04Z"
blocked_at: "2026-06-03T02:54:10Z"
created_at: "2026-06-01"
---

## Objective
Wire wake word engine controls and detection events through Electron IPC, adding channels to main.js and exposing them via preload.js on the `window.leena` API.

## Why This Matters
The wake engine runs in the renderer (WASM + WebAudio), but session start, window surfacing, and tray updates happen in main. IPC bridges the gap. Without these channels, the renderer has no way to signal a detection or let the user control wake state from settings/tray.

## Steps
1. Add IPC handlers in `src/main.js` for invoke channels: `wake:set-enabled` (args: `{ enabled: boolean }`, returns `{ enabled }`), `wake:mute` (args: `{ muted: boolean }`, returns `{ muted }`), `wake:get-status` (no args, returns `WakeStatus`).
2. Implement `wake:set-enabled` handler: persist to settings store (key `wakeEnabled`), send `wake:state-changed` push to renderer to start/stop engine. Return new state.
3. Implement `wake:mute` handler: persist to settings store (key `wakeMuted`), send `wake:state-changed` push to renderer. Clear any buffered audio state. Return new state.
4. Add renderer → main channel `wake:detected`: renderer fires this on confirmed detection from coordinator. Main handler: show/focus window (set mode to `call`), initiate realtime session start, push `wake:detection` event back to renderer for UI update.
5. Add main → renderer push events via `webContents.send`: `wake:state-changed` (payload: `WakeStatus`), `wake:detection` (payload: `DetectionEvent`).
6. Extend `src/preload.js` `window.leena` (or `window.brah` pre-rename) API: `wake.setEnabled(bool)`, `wake.mute(bool)`, `wake.getStatus()`, `wake.onStateChanged(callback)`, `wake.onDetection(callback)`.
7. Write `test/wake-ipc.test.js`: mock ipcMain/ipcRenderer, verify set-enabled persists and pushes, mute persists and pushes, detected triggers window show + session start, status returns correct shape.

## Acceptance Criteria
- [ ] `wake:set-enabled` persists state and pushes `wake:state-changed` to renderer
- [ ] `wake:mute` persists state and pushes `wake:state-changed` to renderer
- [ ] `wake:detected` from renderer triggers window show and realtime session start in main
- [ ] `wake:get-status` returns all 4 WakeStatus fields
- [ ] `window.leena.wake.*` API exposed via preload with all 5 methods
- [ ] Push events (`wake:state-changed`, `wake:detection`) received by renderer listeners
- [ ] `test/wake-ipc.test.js` passes with `node --test`
- [ ] `npm run check` clean

## Tests Required
- `test/wake-ipc.test.js` — mock Electron IPC: set-enabled round-trip, mute round-trip, detected → window show mock, status shape validation, push event delivery

## Outputs
- Blocked; no wake IPC implementation was written because dependency task `093` is blocked.

## Interface Contracts
- **Task 095** (consent/tray) reads wake status via these IPC channels
- **Task 096** (test suite) uses these channels for integration testing
- Renderer code (Phase 7 UI wiring) uses `window.leena.wake.*` to drive wake UI

## Handoff Notes
- Blocked by task `093`, which is blocked by task `092` and task `091`: no `src/wake/wake-coordinator.js`, no `src/wake/openwakeword-engine.js`, no `src/wake/models/hey-lena.onnx`, no selected threshold, and no measured FA/hr, FR%, model size, or latency.
- Resume only after real wake coordinator outputs backed by engine/model/threshold/metrics exist, or after an explicit Porcupine/hotkey-only fallback decision.

## Errors Encountered
- Dependency `093` is terminal-blocked; implementing IPC now would fabricate a working wake stack over absent coordinator/model/metrics.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| IPC channel name mismatch | Channel not found errors in console | Any occurrence | Audit channel name consistency between main/preload/renderer |
| State desync between main and renderer | Settings say enabled but renderer says disabled | Any occurrence | Add state reconciliation on window focus |
| Detection → session start latency | Time from wake:detected to session audio | > 1500ms | Profile IPC overhead; consider direct renderer session init |
