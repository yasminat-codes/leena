# Phase 5 — Wake Word

Complexity: L  
Depends on: Phase 1 (tray, hotkey, onboarding), Phase 4 (session management)

---

## Goal

"Hey Lena" starts a hands-free realtime session from any app without touching the keyboard. The wake engine runs entirely on-device in the always-on orb renderer window. Audio never leaves the machine until the session starts. False-accept and false-reject rates are within targets validated in a spike before full implementation begins. Mute/pause is always available via tray or hotkey.

## Exit criteria

- Saying "Hey Lena" (from any foreground app, mic live) triggers a realtime session within 1.5 s of detection.
- False-accept rate: < 1 per hour in ambient home/office audio.
- False-reject rate: < 10% over 50 clean utterances at normal speaking distance.
- Mute: when muted, wake engine pauses mic sampling, macOS mic indicator extinguishes, tray icon reflects muted state, and no detection events fire.
- Hotkey (Phase 1 `globalShortcut`) continues to work as a summon path independent of wake state.
- Model load failure falls back gracefully to hotkey-only mode; user is notified in tray.
- All audio processing is on-device; no bytes sent to any server until session starts.

---

## Architecture

### WakeEngine interface

All wake implementations satisfy this interface. The renderer holds exactly one instance; swapping the engine (for a future Porcupine or OS-speech backend per ADR-5) requires only changing the constructor call.

```ts
interface WakeEngine {
  /** Start listening. Calls onDetect with a confidence score on each trigger. */
  start(onDetect: (confidence: number) => void): Promise<void>;
  /** Tear down and release the mic stream acquired for wake listening. */
  stop(): Promise<void>;
  /** Suspend sampling without releasing resources; mic indicator extinguishes. */
  pause(): Promise<void>;
  /** Resume from paused state. */
  resume(): Promise<void>;
  /** Convenience wrapper: muted=true ↔ pause(), muted=false ↔ resume(). */
  setMuted(muted: boolean): Promise<void>;
  /** True once WASM runtime and ONNX model are loaded and ready. */
  readonly engineReady: boolean;
}
```

This interface is the only thing the renderer's wake-wiring code imports. The openWakeWord implementation (`src/wake/openwakeword-engine.js`) is instantiated once at orb-window init and passed through to the detection coordinator.

### openWakeWord implementation

- **Runtime:** `onnxruntime-web` (WASM backend; no native node addon required; no `asarUnpack` entry needed).
- **Model:** custom "Hey Lena" ONNX model (~200 KB) trained via `openwakeword-trainer` Colab notebook using synthetic data generation. Model asset ships in `src/wake/models/hey-lena.onnx` and is bundled into the asar normally.
- **Mic capture:** `WakeEngine.start()` calls `navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, sampleRate: 16000 } })` — a separate, narrow stream used only for inference. This stream is distinct from the full-quality stream acquired by `acquireMicrophoneStream()` in `renderer.js` when a realtime session starts. The wake stream is stopped when the engine stops/pauses.
- **Inference loop:** WebAudio `ScriptProcessorNode` (or `AudioWorklet`) feeds 10 ms frames to the onnxruntime-web session. The model scores each frame; a ring-buffer accumulates the last 40 frames (~400 ms). Detection fires when the max score over the window exceeds `DETECTION_THRESHOLD` (default 0.5; tunable via settings).
- **Processing location:** Runs entirely in the orb renderer's JS main thread (or a dedicated AudioWorklet thread for the audio path). No IPC required for the inference itself; IPC fires only on confirmed detection.

File layout:

```
src/wake/
  index.js                  — exports { WakeEngine, createWakeEngine }
  openwakeword-engine.js    — OpenWakeWordEngine implements WakeEngine
  wake-coordinator.js       — debounce, cooldown, mute state, fires IPC
  models/
    hey-lena.onnx           — trained model asset (~200 KB)
```

---

## Spike first (R-3)

Before implementing two-stage gating or wiring the UI, run this spike to de-risk accuracy:

1. Train the "Hey Lena" model using the `openwakeword-trainer` Colab with 500–1000 synthetic utterances (TTS-generated, varied pitch/speed). Export to ONNX.
2. Load the model in a minimal Electron renderer window (not the main app) using `onnxruntime-web` WASM. Pipe the system mic through the inference loop.
3. Measure FA/hr: run 1 hour of ambient audio (podcast, background speech), count triggers.
4. Measure FR%: speak "Hey Lena" 50 times at normal distance, count misses.
5. Tune `DETECTION_THRESHOLD`. If FA > 2/hr at any threshold that keeps FR < 10%, add a two-pass verifier: a second, slightly larger ONNX model that re-scores the buffered audio when the first model triggers (raises bar without hurting latency meaningfully).
6. Record threshold, FA/hr, FR%, and verifier decision in a spike-results note before proceeding.

Spike output gates Task 3 (full implementation). If neither threshold tuning nor a verifier can hit targets, revisit ADR-5 alternatives (Whisper-based keyword spotting, OS-level speech recognition via `NSUserActivity` / Web Speech API).

---

## Two-stage gating

Detection in the renderer triggers the existing session-start path — no new code for the realtime session itself.

```
[wake engine fires onDetect(confidence)]
       │
       ▼
wake-coordinator.js
  • ignore if muted
  • ignore if isCallActive (session already running)
  • ignore if within cooldown window (default 3 s after last trigger)
  • debounce: require two consecutive frames above threshold
       │
       ▼
window.brah.wakeDetected(confidence)   ← R→M invoke (new channel)
       │
       ▼
main.js handler
  • calls setMainWindowMode("orb")     ← bring orb to front
  • mainWindow.show() + focus()
  • calls mainWindow.webContents.send("wake:detected", { confidence })
       │
       ▼
renderer.js  (existing wake:detected listener, M→R push)
  • guards: isOpenAIConnected && !isCallActive
  • calls startCall()                  ← existing path, unchanged
```

`startCall()` already handles `setMode("connecting")`, `acquireMicrophoneStream()`, RTCPeerConnection setup, and the orb→call window-mode transition. The wake path reuses all of it with zero modification to the session logic.

Cooldown: after a detection fires (whether the call starts or was already active), the coordinator ignores further detections for 3 s. This prevents double-triggers from echo or reverberation. Cooldown duration is not user-configurable in Phase 5 (hardcoded constant).

Re-arm: when `stopCall()` runs (session ends, idle timeout, user hangup), the wake coordinator is still running — it simply re-enables detection automatically because `isCallActive` goes back to `false`.

---

## Consent and control (R-6)

### Onboarding consent

The Phase 1 onboarding flow gains a new screen (inserted before the permissions walkthrough):

- Heading: "Always-listening wake word"
- Body: explains that "Hey Lena" detection runs on-device, mic audio is never sent anywhere until you speak the wake phrase, and macOS will show a mic indicator in the menu bar while detection is active.
- Two buttons: "Enable wake word" (default) / "Use hotkey only".
- Choice persisted to settings as `wakeEnabled: boolean` (default `true`).
- If the user chooses hotkey-only, `WakeEngine.start()` is never called; IPC channels still exist but `wake:get-status` returns `{ enabled: false }`.

### Tray integration (Phase 1 tray)

The tray menu gains a "Wake word" submenu (or a top-level toggle item if the tray is minimal):

```
● Listening for "Hey Lena"   ← status label, not clickable
  Mute wake word             ← toggles mute; label flips to "Unmute wake word"
```

Tray icon updates: the existing idle/listening/speaking/muted states gain a "muted-wake" variant when wake is muted but no session is active.

### One-click mute

- Tray "Mute wake word" → `wake:mute({ muted: true })` → `WakeEngine.setMuted(true)` → mic stream stopped → macOS mic indicator off.
- Same action available from the panel settings pane (Phase 6 may formalize a settings page; Phase 5 adds a toggle to the existing permissions/settings area).
- Mute state persists in settings (`wakeMuted: boolean`); restored on app restart.

### Clear state when muted

When `muted = true`:
- `WakeEngine.pause()` is called; the audio stream is released (not just silenced).
- `wake-coordinator.js` sets an internal `isMuted` flag; `onDetect` callbacks are no-ops even if inference somehow continues.
- `wake:get-status` returns `{ listening: false, muted: true }`.

---

## Always-ready tie-in (ADR-8)

Wake word and hotkey are the two summon paths. They are symmetric: both call `startCall()` in the renderer, both respect `isOpenAIConnected` and `isCallActive` guards.

Session lifecycle with wake:

```
App launches
  → wake engine starts (if enabled + not muted)
  → orb window idle, mic sampling in background

User says "Hey Lena"
  → wake detects, coordinator fires
  → window surfaces, startCall() runs
  → session active (call mode)

Session ends (idle timeout or user hangup)
  → stopCall() runs → setMode("idle")
  → wake coordinator re-arms automatically (no explicit re-arm call needed)
  → wake engine continues sampling
```

Idle timeout (per ADR-8) is configured in settings (`idleTimeout` ms). When it fires, `requestHangup()` is called on the existing path. Wake re-arms immediately after `stopCall()` completes.

---

## File-level changes

### New files

| File | Purpose |
|---|---|
| `src/wake/index.js` | Public API: exports `createWakeEngine(settings)`, `WakeEngine` typedef |
| `src/wake/openwakeword-engine.js` | `OpenWakeWordEngine` — onnxruntime-web WASM inference, WebAudio mic capture |
| `src/wake/wake-coordinator.js` | Debounce, cooldown, mute guard, IPC dispatch |
| `src/wake/models/hey-lena.onnx` | Trained model asset (produced by spike; ~200 KB) |

### Modified files

| File | Change |
|---|---|
| `src/renderer/renderer.js` | On DOM ready: instantiate `WakeCoordinator`; add `ipcRenderer.on("wake:detected", ...)` listener (via `window.brah.onWakeDetected`) to call `startCall()`; expose mute toggle in settings area |
| `src/main.js` | Add `ipcMain.handle("wake:detected", ...)` — shows/focuses window, sends `wake:detected` push to renderer; add `ipcMain.handle("wake:set-enabled", ...)`, `"wake:mute"`, `"wake:get-status"`; update tray menu to include mute toggle |
| `src/preload.js` | Add `wakeDetected`, `setWakeEnabled`, `setWakeMuted`, `getWakeStatus`, `onWakeDetected` to `window.brah` |
| `package.json` | Add `onnxruntime-web` to `dependencies` |

No `asarUnpack` additions: `onnxruntime-web` is pure JS/WASM and runs from the asar normally.

---

## IPC additions

All new channels follow the existing pattern in `src/preload.js` and `src/main.js`.

### Renderer → Main (invoke)

| Channel | Args | Returns | Notes |
|---|---|---|---|
| `wake:detected` | `{ confidence: number }` | `void` | Renderer fires on confirmed detection; main shows window and pushes back |
| `wake:set-enabled` | `{ enabled: boolean }` | `{ enabled: boolean }` | Persists to settings; starts/stops engine |
| `wake:mute` | `{ muted: boolean }` | `{ muted: boolean }` | Persists `wakeMuted`; pauses/resumes engine |
| `wake:get-status` | — | `WakeStatus` | Snapshot of engine state |

`WakeStatus` shape:
```ts
{
  enabled: boolean,
  muted: boolean,
  listening: boolean,    // true when engine is actively sampling
  engineReady: boolean   // false until WASM + model loaded
}
```

### Main → Renderer (push via `webContents.send`)

| Channel | Payload | Notes |
|---|---|---|
| `wake:detected` | `{ confidence: number }` | Main sends back after showing window; renderer calls `startCall()` |
| `wake:status` | `WakeStatus` | Sent when state changes (mute, enable, engine ready); renderer updates tray label and settings toggle |

### `window.brah` additions (preload)

```js
wakeDetected: (confidence) => ipcRenderer.invoke("wake:detected", { confidence }),
setWakeEnabled: (enabled) => ipcRenderer.invoke("wake:set-enabled", { enabled }),
setWakeMuted: (muted) => ipcRenderer.invoke("wake:mute", { muted }),
getWakeStatus: () => ipcRenderer.invoke("wake:get-status"),
onWakeDetected: (cb) => ipcRenderer.on("wake:detected", (_e, payload) => cb(payload)),
onWakeStatus: (cb) => ipcRenderer.on("wake:status", (_e, payload) => cb(payload)),
```

---

## Edge cases and failure modes

| Scenario | Behavior |
|---|---|
| Mic permission denied at OS level | `getUserMedia` rejects; `WakeEngine.start()` catches, sets `engineReady = false`, emits status `{ listening: false }`; tray shows "Wake word unavailable — mic denied"; hotkey still works |
| ONNX model fails to load (corrupt asset, WASM unsupported) | `engineReady = false`; log diagnostic via `writeDiagnosticLog("wake.model.load_failed")`; tray shows "Wake word unavailable"; no crash |
| False trigger while call is already active | `wake-coordinator.js` guards `isCallActive`; trigger is silently dropped |
| Rapid successive triggers (echo, reverb) | 3 s cooldown in coordinator; only the first trigger fires |
| Multiple displays / wake fires while app is behind another window | `mainWindow.show()` + `mainWindow.focus()` in main handler brings window to front regardless of display; `alwaysOnTop` is not set for orb (per existing `windowModes` definition) so it respects normal window z-order |
| Mic device unplugged while wake engine is running | `devicechange` event on `navigator.mediaDevices`; coordinator calls `engine.stop()` then `engine.start()` to re-acquire on the new default device; logs `"wake.mic.device_changed"` |
| App launched with `wakeEnabled = false` (user chose hotkey-only) | `createWakeEngine()` returns a no-op stub that satisfies the interface but never requests mic access; all IPC channels still respond |
| User mutes then quits and relaunches | `wakeMuted` setting persists; engine starts in paused state; tray reflects muted; macOS mic indicator never appears |

---

## Definition of done

- [ ] Spike complete: FA/hr and FR% measured, threshold chosen, results documented.
- [ ] `WakeEngine` interface defined in `src/wake/index.js`; `OpenWakeWordEngine` passes unit tests.
- [ ] Model loads in the orb renderer without blocking startup (async init, `engineReady` flag).
- [ ] Saying "Hey Lena" to a running orb window triggers `startCall()` via the two-stage gating path.
- [ ] Mute via tray stops mic sampling (macOS mic indicator extinguishes within 1 s).
- [ ] Hotkey summon works independently of wake state (both enabled, wake muted, wake disabled).
- [ ] Onboarding consent screen shown on first run; `wakeEnabled` preference respected.
- [ ] All IPC channels respond correctly to `wake:get-status`, `wake:mute`, `wake:set-enabled`.
- [ ] Model load failure and mic permission denial produce a tray notification and a diagnostic log entry, not a crash.
- [ ] `npm test` passes (no regressions in existing test suites; new wake unit tests pass).

## Test cases

These reference the project's `node --test` harness in `test/`.

### WakeEngine unit tests (`test/wake-engine.test.js`)

1. `createWakeEngine({ enabled: false })` returns a stub; `engineReady === false`; `start()` resolves without requesting mic.
2. `OpenWakeWordEngine`: mock `onnxruntime-web` to return a fixed score array; call the internal `_onFrame(frames)` method with score > threshold; assert `onDetect` fires.
3. `OpenWakeWordEngine`: score below threshold → `onDetect` does not fire.
4. `engine.setMuted(true)` while running → `pause()` called; subsequent `_onFrame` calls do not invoke `onDetect`.
5. `engine.setMuted(false)` → `resume()` called; `_onFrame` resumes firing.

### WakeCoordinator unit tests (`test/wake-coordinator.test.js`)

1. Detection fires once; within cooldown window (< 3 s) a second detection is suppressed.
2. After cooldown expires, next detection fires normally.
3. `isCallActive = true` → coordinator drops detection, does not call `wakeDetected` IPC.
4. `isMuted = true` → coordinator drops detection even if engine calls `onDetect`.
5. Two consecutive frames above threshold required; single frame below threshold between two above threshold does not trigger.

### Integration smoke test (manual, documented in spike results)

Run the app in dev mode (`npm start`), enable wake, speak "Hey Lena" → assert session starts within 1.5 s, window surfaces, mode transitions `idle → connecting → listening`.
