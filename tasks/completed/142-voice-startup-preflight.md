---
id: "142"
title: "Voice startup preflight"
type: integration
status: completed
wave: 18
priority: critical
complexity: M
estimated_tokens: 14000
dependencies: ["122"]
context_files:
  - src/renderer/renderer.js
  - src/main.js
  - src/realtime/prompts.js
  - test/realtime-provider-integration.test.js
  - test/microphone-store.test.js
skills: []
tags: [voice, realtime, microphone, state]
attempts: 1
claim_started: "2026-06-03T22:05:26Z"
completed_at: "2026-06-03T22:27:04Z"
created_at: "2026-06-03"
---

## Objective
Add a stable voice startup preflight so the plus button shows Starting, checks provider/mic/session readiness, and surfaces actionable errors instead of disappearing.

## Why This Matters
The user reports the orb appears, cannot talk, then disappears. This is a core trust break in the voice experience.

## Steps
1. Run kencode-search for WebRTC/realtime voice startup state-machine patterns.
2. Split call startup into preflight states: provider, secret, microphone, peer connection, listening.
3. Keep the voice dock/orb visible during startup and failure.
4. Add actionable error actions: Retry, Open Settings, Configure Provider.
5. Do not shrink/tear down the UI until the state transition is intentional.
6. Add tests for provider missing, mic denied, secret failure, and successful transition.

## Acceptance Criteria
- [x] Plus click shows stable Starting state.
- [x] Failure keeps a visible dock with error and action.
- [x] Successful path transitions to Listening.
- [x] Existing realtime tests still pass.

## Tests Required
- `node --test test/realtime-provider-integration.test.js test/microphone-store.test.js test/session-state-manager.test.js`
- UI screenshot harness from task 121.
- `npm run check`

## Outputs
- `src/renderer/renderer.js`
- Optional session-state helper/test updates.

## Interface Contracts
Voice state transitions must emit existing session state events so tray/command center stay synchronized.

## Handoff Notes
- Added `src/renderer/voice-startup-preflight.js` for staged provider, secret, microphone, and peer checks with actionable failure classification.
- Updated `src/renderer/renderer.js` so startup uses generation guards, keeps the call dock visible on pre-listening failure, maps the call-stage action to Retry/Open Settings/Configure Provider, and only tears down the dock on an intentional stop/configure action.
- Added focused coverage in `test/realtime-provider-integration.test.js` for provider-missing, secret-failure, mic-denied, and successful preflight resource handoff.
- Verification passed: `node --check src/renderer/voice-startup-preflight.js && node --check src/renderer/renderer.js && node --check test/realtime-provider-integration.test.js`; `node --test test/realtime-provider-integration.test.js test/microphone-store.test.js test/session-state-manager.test.js` (16/16); `node --test test/ui-baseline-smoke.test.js` (1/1); `node --test` (558/558); `npm run check`.

## Errors Encountered
- Initial syntax check exposed an accidental patch target in the primary checkout; those accidental primary edits were removed, and the scoped changes were reapplied to this wave worktree before verification.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Orb disappears on failure | Failure screenshot | Any disappearance | Keep failure dock mounted |
| Error vague | Message lacks action | Any failure state | Add action mapping |
| State desync | Tray/dock mismatch | Any occurrence | Emit session event |
