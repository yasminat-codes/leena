---
id: "093"
title: "Wake coordinator with debounce and dispatch"
type: feature
status: blocked
priority: high
complexity: M
estimated_tokens: 15000
dependencies: ["092"]
context_files:
  - src/wake/index.js
  - src/wake/openwakeword-engine.js
skills: []
tags: [phase-6, wake-word, coordinator]
attempts: 1
claim_started: "2026-06-03T01:04:37Z"
blocked_at: "2026-06-03T01:24:00Z"
created_at: "2026-06-01"
---

## Objective
Build the wake coordinator that sits between the WakeEngine and the IPC layer, applying debounce, cooldown, mute guard, and rate limiting before dispatching confirmed detections.

## Why This Matters
Raw engine detections are noisy — multiple triggers for a single utterance, triggers while already in a session, triggers while muted. The coordinator filters these into a clean signal, preventing duplicate session starts and respecting user privacy controls. Without it, the app would spam session creation on every detection cluster.

## Steps
1. Create `src/wake/wake-coordinator.js` exporting `WakeCoordinator` class. Constructor takes `{ engine: WakeEngine, settings: SettingsStore, onConfirmedDetection: Function }`.
2. Implement debounce logic: after a detection fires, ignore all subsequent detections within a configurable cooldown window (default 3000ms). Use a simple timestamp comparison — `Date.now() - lastDetectionTime < cooldownMs`.
3. Implement mute guard: check `settings.getBool('wakeMuted')` before processing any detection. If muted, discard silently. Also check `settings.getBool('wakeEnabled')` — if disabled, discard.
4. Implement session-active guard: if a realtime session is already active (tracked via a `sessionActive` flag set externally), suppress detections. No point waking when already awake.
5. Implement rate limiter: max 1 confirmed detection per cooldown period. Log suppressed detections at debug level for diagnostics.
6. On confirmed detection (passes all guards): call `onConfirmedDetection({ confidence, timestamp, model })`. This callback is where IPC dispatch and window surfacing happen (wired in task 094).
7. Write `test/wake-coordinator.test.js`: test debounce (rapid detections → only first fires), mute guard (muted → none fire), session-active guard, cooldown expiry (detection after cooldown → fires), rate limiting.

## Acceptance Criteria
- [ ] Rapid detections within cooldown window produce exactly 1 confirmed detection
- [ ] Muted state suppresses all detections with zero side effects
- [ ] Disabled state suppresses all detections
- [ ] Active session suppresses detections
- [ ] Detection after cooldown expires fires normally
- [ ] `setSessionActive(bool)` correctly gates detections
- [ ] `test/wake-coordinator.test.js` passes with `node --test`
- [ ] `npm run check` clean

## Tests Required
- `test/wake-coordinator.test.js` — debounce timing (mock Date.now), mute guard on/off, session-active guard, cooldown expiry, rate limiting, callback invocation count verification

## Outputs
- Blocked; no coordinator implementation was written because dependency `092` is terminal-blocked.

## Interface Contracts
- **Task 094** (wake IPC) wires `onConfirmedDetection` to IPC dispatch + window surfacing
- **Task 095** (consent controls) calls `setSessionActive` when realtime session starts/stops
- Coordinator reads settings keys: `wakeMuted`, `wakeEnabled`, `wakeCooldownMs`

## Handoff Notes
- Task `092` remains blocked: `src/wake/openwakeword-engine.js` is absent, `src/wake/models/hey-lena.onnx` is absent, and `plans/spike-results-wake.md` has no selected threshold, FA/hr, FR%, model size, or latency measurement.
- Resume only after task `092` has a real engine/model/threshold/metrics or after an explicit Porcupine/hotkey fallback decision.
- Wake work remains decoupled from the DMG path; Wave 10 non-wake tasks completed normally.

## Errors Encountered
- Dependency `092` is blocked by missing wake model/audio corpus/metrics, so implementing a coordinator now would fabricate a working wake stack.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Duplicate session starts | Session create count per single utterance | > 1 | Tighten cooldown or add dedup by timestamp range |
| Detections silently lost | Confirmed detection count vs engine detection count ratio | < 0.5 over normal use | Review guard conditions for over-suppression |
| Cooldown too aggressive | User says "Hey Leena" twice intentionally, second ignored | User report | Make cooldown configurable in settings UI |
