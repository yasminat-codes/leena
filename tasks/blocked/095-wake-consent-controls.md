---
id: "095"
title: "Wake word consent and tray integration"
type: feature
status: blocked
priority: high
complexity: M
estimated_tokens: 14000
dependencies: ["093", "094", "035", "037"]
context_files:
  - src/main.js
  - plans/phases/phase-5-wake-word.md
skills: []
tags: [phase-6, wake-word, privacy, consent, tray]
attempts: 1
claim_started: "2026-06-03T04:02:39Z"
blocked_at: "2026-06-03T04:02:39Z"
created_at: "2026-06-01"
---

## Objective
Add wake word consent to the onboarding flow, integrate wake controls into the system tray menu, and ensure privacy safeguards (buffer clearing on mute, clear state indicators).

## Why This Matters
Always-on mic listening is a significant privacy surface (R-6). Users must explicitly opt in during onboarding, have clear mute controls accessible from the tray, and trust that muting actually stops audio processing. Without consent + visible controls, the feature is a liability regardless of technical quality.

## Steps
1. Add a "Wake Word" consent step to the onboarding wizard (task 037's flow). Screen shows: explanation of always-on listening, what audio is processed (local only, never sent to cloud unless session active), toggle to enable, mute shortcut hint. Default: disabled. User must explicitly enable.
2. Extend the system tray context menu (task 035) with a "Wake Word" section: status label ("● Listening for Hey Leena" or "○ Wake word off"), "Mute wake word" / "Unmute wake word" toggle item. Wire to `wake:mute` IPC channel.
3. Add tray icon variant: `muted-wake` state — distinct from session-muted. Show when wake is muted but no active session. Use a different tray icon asset (e.g., icon with small slash overlay).
4. Implement audio buffer clearing: when `wake:mute` is called, coordinator clears any buffered PCM frames and the engine stops feeding audio to inference. No audio data retained in memory while muted.
5. Persist consent decision in settings store (key `wakeConsentGiven`). Wake engine refuses to start if consent not given, even if `wakeEnabled` is true. UI shows "Enable in Settings > Wake Word" prompt.
6. Write assertions in `test/wake-consent.test.js`: consent not given → engine won't start, consent given + enabled → engine starts, mute clears buffer flag, tray menu items reflect current state.

## Acceptance Criteria
- [ ] Onboarding includes wake word consent step with clear privacy explanation
- [ ] Wake engine will not start without explicit consent (`wakeConsentGiven` = true)
- [ ] Tray menu shows wake status and mute toggle
- [ ] Tray icon changes to muted-wake variant when wake is muted
- [ ] Muting clears audio buffers immediately — no retained audio data
- [ ] Unmuting resumes listening from fresh state (no stale buffer processing)
- [ ] `test/wake-consent.test.js` passes with `node --test`
- [ ] `npm run check` clean

## Tests Required
- `test/wake-consent.test.js` — consent gate (no consent → start rejected), consent + enabled → start succeeds, mute → buffer cleared flag, settings persistence of consent state

## Outputs
- Modified onboarding flow (task 037's files) — wake consent step
- Modified tray setup (task 035's files) — wake menu items
- Tray icon assets for muted-wake state
- `test/wake-consent.test.js`

## Interface Contracts
- Depends on task 037 onboarding flow structure for adding the consent step
- Depends on task 035 tray menu for adding wake items
- Reads/writes settings keys: `wakeConsentGiven`, `wakeMuted`, `wakeEnabled`
- Phase 7 UI wiring will show wake status in the command center

## Handoff Notes
- Blocked in Wave 12 because dependencies `093` and `094` are blocked by the missing wake coordinator/IPC chain over absent openWakeWord assets and metrics. Do not implement consent/tray controls over a nonexistent wake runtime without real wake evidence or an explicit fallback decision.

## Errors Encountered
- Dependency chain blocked: `091` lacks a trained `hey-lena.onnx`, ambient/positive corpora, and measured FA/hr/FR/latency; `092`, `093`, and `094` are blocked from that missing evidence.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Users skip consent without understanding | Consent step completion rate vs wake usage rate | Large gap | Improve consent copy; consider re-prompt after update |
| Mute state not visible enough | User thinks mic is off when it isn't | Any UX report | Add persistent notification or menu bar indicator |
| Buffer clear incomplete | Audio data found in memory after mute | Any occurrence | Audit all buffer references; zero-fill on mute |
