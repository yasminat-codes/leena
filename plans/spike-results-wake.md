# Wake Word Accuracy Spike Results

Task: `091`
Run timestamp: `2026-06-02T22:11:22Z`
Phrase/model target: `hey-lena` for "Hey Lena" / "Hey Leena"
Status: **blocked; not validated**

## Decision

The custom openWakeWord model was **not trained or validated** in this unattended run. `src/wake/models/hey-lena.onnx` does not exist, there is no one-hour ambient audio corpus, and there are no 50 real "Hey Lena" utterance recordings in the worktree. Because FA/hr and FR% require real audio measurement, Task 092 should stay blocked from implementing wake activation against openWakeWord until a real model and corpus are produced and measured.

Hotkey-only summon remains the safe fallback path for the MVP/final DMG path because wake-word work is explicitly decoupled from the deliverable critical path.

## Required Metrics

| Field | Result |
|---|---|
| Model path | `src/wake/models/hey-lena.onnx` missing |
| Selected threshold | Not selected; no trained model/corpus available |
| False accepts per hour | Not measured; no one-hour ambient corpus |
| False reject percent | Not measured; no 50-utterance positive corpus |
| Model size | Not measured; model absent |
| Inference latency | Not measured; model absent |
| Verifier used | None; verifier could not be evaluated without a base model |
| Acceptance status | Blocked, not pass/fail |

## Source Anchors Checked

- `dscripka/openWakeWord`: current Python API uses `from openwakeword.model import Model`; custom ONNX/TFLite models are loaded with `Model(wakeword_models=[...], inference_framework="onnx")`; predictions are returned by `Model.predict(...)`.
- `dscripka/openWakeWord`: the model class supports `threshold`, `patience`, `debounce_time`, `vad_threshold`, and optional `custom_verifier_models` for second-pass scoring.
- `rhasspy/wyoming-openwakeword`: runtime converts audio to mono 16 kHz, applies a probability threshold, and requires `trigger_level` consecutive hits before emitting detection.
- `lgpearson1771/openwakeword-trainer`: maintained custom training pipeline; README states WSL2/Linux plus NVIDIA CUDA is expected, with about 15 GB temporary disk use, about 1-2 hours on GPU, and 12-24 hours CPU-only. It exports `.onnx` plus `.onnx.data` files that must stay together.

## Exact Unblock Probes Made

1. Ran the required `kencode-search` pass before writing. Confirmed the openWakeWord `Model` import/API, threshold/verifier hooks, Wyoming 16 kHz threshold/trigger-level runtime behavior, and the maintained `openwakeword-trainer` repository.
2. Checked the local wave worktree. `src/wake/index.js` and `test/wake-engine.test.js` exist from Task 090, but `src/wake/models/hey-lena.onnx`, `plans/spike-results-wake.md`, and `test/spike/` were absent before this task.
3. Searched the wave worktree for existing `*.onnx`, `*.onnx.data`, or `*hey*lena*` model files; none were present.
4. Searched `test/`, `plans/`, and `src/` for candidate audio corpora. Only UI sound effects (`click.mp3`, `waiting.mp3`) exist; no ambient or positive wake-word WAV corpus exists.
5. Checked local runtime feasibility:
   - Host: Darwin arm64 (`Yasmines-Mac-mini.local`).
   - Default Python: `Python 3.14.3`.
   - Homebrew Python 3.11 is available at `/opt/homebrew/bin/python3.11`.
   - Global `openwakeword` package: not installed.
   - Global `onnxruntime` package: not installed.
   - Global `sounddevice` package: not installed.
   - `nvidia-smi`: not found.
   - `onnxruntime-web`: not installed in `package.json` dependencies.
6. Created a temporary Python 3.11 venv at `/tmp/leena-oww-spike-venv` and ran `pip install --dry-run openwakeword`. The dry run resolved `openwakeword==0.6.0` and `onnxruntime==1.26.0` wheels for macOS arm64, so validation dependencies are installable in a temp venv. This does not solve training because the maintained trainer expects Linux/WSL plus CUDA for practical runtime.
7. Checked whether macOS `say` could unblock positive utterance generation. It is available, but synthetic TTS positives would not satisfy the required 50 real utterance false-reject measurement at normal distance.
8. Re-ran repository discovery for `openwakeword trainer custom wake word onnx cuda`; the maintained custom trainer result still points to `lgpearson1771/openwakeword-trainer`, documented as WSL2/Linux plus CUDA.
9. Did **not** start custom training. The available maintained trainer expects Linux/WSL plus CUDA and large downloads; CPU-only training is documented as 12-24 hours. That is outside this unattended wave run, and there are no real positive/ambient audio assets to validate the result.
10. Did **not** run FA/FR measurement. There is no trained model, no one-hour ambient corpus, and no 50-utterance positive corpus. Metrics would be fabricated if reported. Added `test/spike/wake_openwakeword_eval.py`, a real measurement harness that can compute threshold sweep results once the model and 16 kHz WAV corpora are supplied.

## Harness

Use the harness only after a real model and real audio fixtures exist:

```bash
/opt/homebrew/bin/python3.11 -m venv /tmp/leena-oww-eval
source /tmp/leena-oww-eval/bin/activate
python -m pip install --upgrade pip
python -m pip install openwakeword

python test/spike/wake_openwakeword_eval.py \
  --model src/wake/models/hey-lena.onnx \
  --ambient-dir test/spike/audio/ambient \
  --positive-dir test/spike/audio/positive \
  --thresholds 0.3:0.9:0.05 \
  --output plans/spike-results-wake-run.md
```

Audio requirements:

- Ambient corpus: at least 3600 seconds total, 16 kHz mono PCM WAV, no "Hey Lena" positives.
- Positive corpus: at least 50 files, each containing one clean "Hey Lena" / "Hey Leena" utterance at normal distance.
- The harness refuses compressed or resampled-by-assumption input; convert audio explicitly before measurement.

## Alternative Recommendation

Block Task 092 until one of these happens:

1. **Preferred openWakeWord path:** train `hey-lena` externally on a Linux/WSL CUDA machine using `lgpearson1771/openwakeword-trainer`, include both `hey-lena.onnx` and `hey-lena.onnx.data` if external weights are generated, then run the harness on the required real audio corpus. Use target phrases `["hey lena", "hey leena"]` and hard negatives such as `["lena", "leena", "hey lina", "hey lenaa", "hey"]`.
2. **Commercial fallback:** evaluate Picovoice Porcupine custom wake word if licensing/budget are acceptable. This is the lowest engineering-risk path for reliable always-on wake activation.
3. **Product fallback:** ship hotkey-only summon and keep wake disabled behind a settings/experimental flag until a measured local model passes FA/FR targets.

Do not implement automatic wake session start from openWakeWord until a report contains real threshold, FA/hr, FR%, model size, inference latency, and verifier decision.
