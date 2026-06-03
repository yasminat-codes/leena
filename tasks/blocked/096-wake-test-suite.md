---
id: "096"
title: "Wake word comprehensive test suite"
type: test
status: blocked
priority: high
complexity: M
estimated_tokens: 16000
dependencies: ["092", "093", "094"]
context_files:
  - src/wake/index.js
  - src/wake/openwakeword-engine.js
  - src/wake/wake-coordinator.js
  - test/wake-engine.test.js
skills: []
tags: [phase-6, wake-word, testing]
attempts: 1
claim_started: "2026-06-03T04:02:39Z"
blocked_at: "2026-06-03T04:02:39Z"
created_at: "2026-06-01"
---

## Objective
Write comprehensive tests covering the full wake word stack: engine interface compliance, coordinator logic, IPC flow, and end-to-end detection-to-session-start integration.

## Why This Matters
Wake word is always-on and privacy-sensitive. A bug here means either false activations annoying the user or missed detections making the feature useless. The coordinator's debounce/mute logic is the critical gate between raw detections and user-visible actions. Thorough tests prevent regressions in this safety-critical path.

## Steps
1. Create `test/wake-engine-compliance.test.js`: verify that `OpenWakeWordEngine` satisfies the full `WakeEngine` interface — all methods exist, return types match, start/stop transitions update status correctly, double-start is idempotent, double-stop is safe.
2. Create `test/wake-coordinator-timing.test.js`: use mock `Date.now()` to test timing-dependent behavior — rapid detections within 3s cooldown produce exactly 1 confirmed callback; detection at 3001ms produces second callback; 10 rapid detections produce exactly 1; cooldown resets after confirmed detection.
3. Create `test/wake-coordinator-guards.test.js`: test all guard paths — muted suppresses all, disabled suppresses all, session-active suppresses all, combinations (muted + session-active), guard state changes mid-stream (unmute during cooldown).
4. Create `test/wake-integration.test.js`: mock the full stack — engine emits detection → coordinator filters → IPC `wake:detected` fires → main handler shows window + starts session. Verify the complete chain with mock IPC. Also test: detection while session already active → no duplicate session.
5. Add edge case tests: engine start failure (mic denied) → status reflects `engineReady: false` and no detections fire; model load failure → `WakeError` thrown; audio context suspended → engine reports not listening.
6. Run full suite: `node --test test/wake-*.test.js`. Verify all pass. Run `npm run check` for lint.

## Acceptance Criteria
- [ ] `test/wake-engine-compliance.test.js` — interface contract fully verified
- [ ] `test/wake-coordinator-timing.test.js` — all timing scenarios pass with mocked clock
- [ ] `test/wake-coordinator-guards.test.js` — all guard combinations verified
- [ ] `test/wake-integration.test.js` — full detection-to-session chain verified
- [ ] Edge cases covered: mic denied, model load failure, audio context suspended
- [ ] All wake test files pass with `node --test`
- [ ] `npm run check` clean
- [ ] No test uses real mic or real ONNX model (all mocked)

## Tests Required
- `test/wake-engine-compliance.test.js` — interface shape, lifecycle transitions, idempotency
- `test/wake-coordinator-timing.test.js` — cooldown, debounce, rate limiting with mock clock
- `test/wake-coordinator-guards.test.js` — mute, disable, session-active guards
- `test/wake-integration.test.js` — full stack mock: detection → IPC → session start

## Outputs
- `test/wake-engine-compliance.test.js`
- `test/wake-coordinator-timing.test.js`
- `test/wake-coordinator-guards.test.js`
- `test/wake-integration.test.js`

## Interface Contracts
- Tests validate contracts defined in tasks 090, 092, 093, 094
- Test mocks establish the expected shapes that downstream UI code can rely on

## Handoff Notes
- Blocked in Wave 12 because dependencies `092`, `093`, and `094` are blocked. Comprehensive wake tests cannot honestly validate an absent openWakeWord engine, coordinator, or IPC path without real wake assets/metrics or an explicit fallback decision.

## Errors Encountered
- Dependency chain blocked: no trained wake model, selected threshold, real audio corpus, coordinator implementation, or IPC implementation exists.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Tests pass but real detection broken | Manual QA finds bug not caught by tests | Any occurrence | Add regression test for specific scenario; review mock fidelity |
| Mock clock drift from real behavior | Coordinator works in test, fails in real timing | Any occurrence | Add real-time smoke test with short cooldown |
| Test suite too slow | Wake test runtime | > 5s total | Profile; likely over-mocking or unnecessary delays |
