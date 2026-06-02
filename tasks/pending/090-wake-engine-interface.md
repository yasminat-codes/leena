---
id: "090"
title: "WakeEngine abstract interface"
type: feature
status: pending
priority: high
complexity: S
estimated_tokens: 8000
dependencies: ["000"]
context_files:
  - plans/phases/phase-5-wake-word.md
  - src/realtime/tools/index.js
skills: []
tags: [phase-6, wake-word, interface]
attempts: 0
created_at: "2026-06-01"
---

## Objective
Define the engine-agnostic WakeEngine interface and factory so wake word detection can swap implementations without touching callers.

## Why This Matters
ADR-5 mandates an engine-agnostic interface. openWakeWord is the first backend but Porcupine, OS-level speech, or Whisper-keyword may replace it. The interface decouples consumers from the detection engine, keeping Phase 6 tasks composable.

## Steps
1. Create `src/wake/index.js` exporting `createWakeEngine(settings)` factory function and the `WakeEngine` class/typedef.
2. Define `WakeEngine` with methods: `start()` → Promise<void>, `stop()` → Promise<void>, `setThreshold(n: number)` → void, `onDetection(callback: (event: DetectionEvent) => void)` → void, `getStatus()` → WakeStatus.
3. Define `WakeStatus` type: `{ enabled: boolean, muted: boolean, listening: boolean, engineReady: boolean }`.
4. Define `DetectionEvent` type: `{ confidence: number, timestamp: number, model: string }`.
5. Implement `createWakeEngine(settings)` that reads `settings.engine` (default `'openwakeword'`) and dynamically imports the matching engine module, throwing `WakeError` (from task 000) if engine not found.
6. Write `test/wake-engine.test.js` verifying: factory throws on unknown engine, interface shape matches typedef, status defaults are correct.

## Acceptance Criteria
- [ ] `src/wake/index.js` exports `createWakeEngine`, `WakeEngine` typedef, `WakeStatus` type, `DetectionEvent` type
- [ ] Factory throws `WakeError` with code `ENGINE_NOT_FOUND` for unknown engine names
- [ ] `getStatus()` returns all 4 boolean fields with correct defaults (all false before start)
- [ ] `onDetection` accepts a callback and does not throw when called before `start()`
- [ ] `test/wake-engine.test.js` passes with `node --test`
- [ ] `npm run check` clean

## Tests Required
- `test/wake-engine.test.js` — factory behavior (unknown engine → error, known engine → instance), interface shape (all methods exist and are functions), default status values, onDetection callback registration

## Outputs
- `src/wake/index.js` — WakeEngine interface + factory

## Interface Contracts
- **Task 092** (openwakeword-engine) implements this interface
- **Task 093** (wake-coordinator) consumes `onDetection` and `getStatus`
- **Task 094** (wake IPC) calls `start`, `stop`, `setThreshold`, `getStatus`
- Factory pattern allows future engines (Porcupine, Whisper) to register without changing callers

## Handoff Notes
[Filled after completion]

## Errors Encountered
[Filled if errors occur]

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Interface method missing | Consumer task hits undefined method | Any occurrence | Add method to interface + backfill implementation |
| Factory never called with alt engine | grep createWakeEngine calls | Only 'openwakeword' after Phase 6 done | Verify interface isn't over-engineered; simplify if single impl |
| DetectionEvent shape inadequate | Coordinator needs fields not in type | Any field addition | Update typedef, bump downstream tasks |
