---
id: "092"
title: "openWakeWord engine implementation"
type: feature
status: blocked
priority: high
complexity: L
estimated_tokens: 22000
dependencies: ["090", "091"]
context_files:
  - src/wake/index.js
  - src/wake/models/hey-lena.onnx
  - plans/spike-results-wake.md
skills: []
tags: [phase-6, wake-word, onnx, wasm]
attempts: 1
claim_started: "2026-06-02T23:02:41Z"
blocked_at: "2026-06-02T23:28:44Z"
created_at: "2026-06-01"
---

## Objective
Implement the openWakeWord engine as a concrete WakeEngine, loading the trained ONNX model via onnxruntime-web WASM and capturing mic audio through WebAudio API in the renderer process.

## Why This Matters
This is the actual wake word detection runtime. It turns the abstract WakeEngine interface into a working "Hey Leena" detector that runs continuously in the always-on orb renderer window (ADR-8). Without this, wake word is just an interface with no implementation.

## Steps
1. Install `onnxruntime-web` as a dependency (`npm install onnxruntime-web`). Verify WASM backend loads in Electron renderer context.
2. Create `src/wake/openwakeword-engine.js` exporting `OpenWakeWordEngine` class implementing WakeEngine interface from task 090.
3. Implement `start()`: request mic via `navigator.mediaDevices.getUserMedia({ audio: true })`, create AudioContext at 16kHz sample rate, connect ScriptProcessorNode (or AudioWorkletNode) to capture PCM frames into a sliding buffer.
4. Implement inference loop: on each buffer fill (e.g., 1280 samples = 80ms at 16kHz), run `onnxruntime.InferenceSession.run()` with the audio tensor. Compare output confidence against `DETECTION_THRESHOLD` from spike results. If above threshold, fire registered `onDetection` callbacks with `{ confidence, timestamp: Date.now(), model: 'hey-lena' }`.
5. Implement `stop()`: disconnect audio nodes, close AudioContext, release mic stream tracks. Implement `setThreshold(n)`: update the comparison threshold. Implement `getStatus()`: return current WakeStatus reflecting actual engine state.
6. Handle errors: mic permission denied → set `engineReady: false`, emit error event. ONNX load failure → throw `WakeError` with code `MODEL_LOAD_FAILED`. Audio context suspension (browser policy) → auto-resume on user gesture.
7. Write `test/openwakeword-engine.test.js`: mock `navigator.mediaDevices` and `onnxruntime`, verify start/stop lifecycle, threshold updates, detection callback firing, error handling for denied mic.

## Acceptance Criteria
- [ ] `OpenWakeWordEngine` implements all WakeEngine interface methods
- [ ] ONNX model loads via onnxruntime-web WASM backend without errors
- [ ] Audio capture runs at 16kHz with sliding buffer feeding inference
- [ ] Detection fires callback when confidence > threshold
- [ ] `stop()` fully releases mic and audio resources (no dangling streams)
- [ ] Mic denial handled gracefully — no crash, status reflects `engineReady: false`
- [ ] `test/openwakeword-engine.test.js` passes with `node --test`
- [ ] `npm run check` clean

## Tests Required
- `test/openwakeword-engine.test.js` — mocked audio/ONNX: start/stop lifecycle (status transitions), threshold setting, detection callback firing on high-confidence mock output, error paths (mic denied, model load failure), resource cleanup on stop

## Outputs
- `src/wake/openwakeword-engine.js` — openWakeWord WakeEngine implementation

## Interface Contracts
- Consumed by **task 093** (wake-coordinator) via `onDetection` callback
- Consumed by **task 094** (wake IPC) via `start`, `stop`, `getStatus`, `setThreshold`
- Requires `src/wake/models/hey-lena.onnx` from task 091
- `onnxruntime-web` added to package.json dependencies

## Handoff Notes
Blocked by dependency `091`. The required trained `src/wake/models/hey-lena.onnx` file is absent, `plans/spike-results-wake.md` records no selected threshold, no FA/hr, no FR%, no model size, and no latency because no real ambient/positive corpus exists. Implementing `OpenWakeWordEngine` now would fabricate the safety gate. Task can resume only after a real model plus one-hour ambient and 50-positive utterance corpus are measured, or after a product decision switches to the documented Porcupine/hotkey fallback.

## Errors Encountered
- `src/wake/models/hey-lena.onnx` does not exist.
- No one-hour ambient corpus or 50-positive "Hey Leena" corpus exists.
- `plans/spike-results-wake.md` explicitly says Task 092 should stay blocked until real model/corpus measurement is available.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| High CPU in renderer | CPU % during idle listening | > 15% sustained | Reduce inference frequency or use AudioWorklet offload |
| Memory leak on start/stop cycles | Heap growth per cycle | > 5MB per cycle | Audit AudioContext and ONNX session disposal |
| ScriptProcessorNode deprecated warnings | Console warnings | Any | Migrate to AudioWorkletNode |
