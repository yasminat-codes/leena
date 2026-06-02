---
id: "091"
title: "openWakeWord accuracy spike"
type: research
status: pending
priority: critical
complexity: L
estimated_tokens: 25000
dependencies: ["090"]
context_files:
  - plans/phases/phase-5-wake-word.md
  - plans/risk-register.md
skills: []
tags: [phase-6, wake-word, spike, risk-r3]
attempts: 0
created_at: "2026-06-01"
---

## Objective
Train a custom "Hey Leena" ONNX model with openWakeWord, measure false-accept and false-reject rates, and gate Phase 6 implementation on acceptable accuracy.

## Why This Matters
Risk R-3: openWakeWord accuracy is unproven for a custom wake phrase. If FA/hr > 2 or FR% > 10% at any usable threshold, the entire wake word feature needs re-architecture (Whisper keyword spotting, OS speech API, or Porcupine). This spike prevents building on an unvalidated foundation.

## Steps
1. Install `openwakeword` Python package and training dependencies. Use the openwakeword-trainer Colab notebook or local equivalent to generate 500–1000 synthetic "Hey Leena" utterances via TTS (varied pitch, speed, accent).
2. Train the custom model using openwakeword's training pipeline. Export to ONNX format. Place output at `src/wake/models/hey-lena.onnx`.
3. Create a minimal Electron test harness: single BrowserWindow loading `onnxruntime-web` WASM, piping system mic through the model's inference loop at 16kHz sample rate.
4. **False Accept test**: play 1 hour of ambient audio (podcast, background speech, music) through the mic or as a virtual audio device. Count triggers. Target: FA < 2/hr.
5. **False Reject test**: speak "Hey Leena" 50 times at normal conversational distance (~1m from mic). Count misses. Target: FR < 10% (≤5 misses out of 50).
6. If targets not met: tune `DETECTION_THRESHOLD` (sweep 0.3–0.9 in 0.05 increments). If still failing, implement a two-pass verifier (second larger ONNX model re-scores buffered audio on first-model trigger). Re-test with verifier.
7. Record all results (threshold, FA/hr, FR%, verifier used, model size, inference latency) in `plans/spike-results-wake.md`. If no configuration meets targets, document alternatives and flag task 092 as blocked.

## Acceptance Criteria
- [ ] Trained ONNX model exists at `src/wake/models/hey-lena.onnx`
- [ ] `plans/spike-results-wake.md` contains: threshold value, FA/hr, FR%, model size (KB), inference latency (ms), whether verifier was needed
- [ ] FA/hr ≤ 2 AND FR% ≤ 10% at chosen threshold — OR — clear documentation of failure with alternative recommendation
- [ ] Minimal test harness runs without crashes in Electron renderer with onnxruntime-web WASM
- [ ] Model loads and produces confidence scores in < 100ms per inference window

## Tests Required
- No automated tests — this is a measurement spike. Results documented in `plans/spike-results-wake.md`.
- The test harness itself (minimal Electron window) serves as the validation tool.

## Outputs
- `src/wake/models/hey-lena.onnx` — trained wake word model
- `plans/spike-results-wake.md` — spike results with all metrics
- Spike test harness code (can be temporary, in `test/spike/` or discarded)

## Interface Contracts
- **Task 092** depends on this: if spike passes, 092 proceeds with the model and threshold. If spike fails, 092 is blocked until alternative is chosen.
- The chosen `DETECTION_THRESHOLD` value is consumed by task 092's implementation.
- Model file path `src/wake/models/hey-lena.onnx` is hardcoded in 092.

## Handoff Notes
[Filled after completion]

## Errors Encountered
[Filled if errors occur]

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Spike skipped or rushed | spike-results-wake.md missing metrics | Any blank metric | Re-run spike; never proceed without measured FA/FR |
| Model too large for renderer | ONNX file size | > 5MB | Retrain with smaller architecture or quantize |
| Inference too slow | Per-window latency | > 200ms | Switch to quantized model or reduce window size |
