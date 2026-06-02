# Lena — Non-Functional Requirements Spec

**Scope:** Personal/small-share macOS desktop app. Single primary user; up to ~5 invited users each running their own installation with their own credentials. Not a public SaaS product.

---

## 1. Performance

### 1.1 Wake-word detection (Phase 5)

| Metric | Target | Rationale |
|---|---|---|
| CPU overhead (always-on) | ≤2% on a single P-core at idle (≤5% burst on detection) | openWakeWord runs as ONNX WASM in the always-on `orb` renderer; must not drain laptop battery noticeably |
| Memory footprint (wake engine) | ≤80 MB renderer heap | openWakeWord ONNX model is small; stay inside a reasonable Electron renderer budget |
| False-accept rate | ≤2 per hour in a typical home/office acoustic environment | Measured in Phase 5 spike; tune threshold; hotkey is always the fallback |
| False-reject rate | ≤5% at 1 m from mic, normal speech level | Same Phase 5 spike gate |
| Latency: detection → session start | ≤800 ms (perceived) | Two-stage gate: local detect → start paid realtime session; user should feel immediate response |

### 1.2 Memory recall (Phase 2)

| Metric | Target | Rationale |
|---|---|---|
| Brute-force cosine recall (≤1k memories) | ≤5 ms wall time (synchronous JS, main or worker thread) | Confirmed feasible at personal scale; R-4 explicitly states <5 ms target |
| Recall at 5k memories | ≤20 ms | Acceptable degradation; still sub-perceptible before injection into session |
| Recall at 10k+ memories | Trigger migration: replace `node:sqlite` + JS cosine with `better-sqlite3` + `sqlite-vec` via `asarUnpack` | R-4 mitigation threshold; same pattern as `@nut-tree-fork` |
| Memory injection into session instructions | ≤50 ms end-to-end (retrieve top-k + format) | Done before session reconnect; adds to cold-start only, not voice latency |

### 1.3 Embedding model (Phase 2)

| Metric | Target |
|---|---|
| First-load time (model not cached) | ≤8 s on M-series Mac (download ~23 MB `Xenova/all-MiniLM-L6-v2`, write to `userData` cache) |
| Subsequent warm loads (cached) | ≤1.5 s (read from disk, initialize ONNX runtime) |
| Per-embedding inference | ≤50 ms on M-series Mac (384-dim output, done post-conversation, non-blocking) |
| Cache location | `<userData>/hf-cache/` — never re-downloaded unless explicitly cleared |

### 1.4 Realtime voice round-trip

| Metric | Target | Notes |
|---|---|---|
| Perceived end-to-end latency (speech in → first audio token out) | ≤1.2 s under normal broadband | Dominated by OpenAI Realtime API; local processing (wake detect, permission check, tool dispatch) must not add >100 ms |
| Tool execution overhead | ≤200 ms for local tools (planner, screenshot, settings); network tools limited by external service | Measured per-tool in `createToolLogger` |

### 1.5 App cold start

| Metric | Target |
|---|---|
| Time from dock click → `orb` window visible | ≤2.5 s on M-series Mac with a warm filesystem cache |
| Time from login-item launch → tray icon visible (background start) | ≤3 s |
| Diagnostics log rotation check | ≤50 ms (stat + conditional rename; non-blocking to main window) |

---

## 2. Privacy

### 2.1 Microphone and audio

- **Always-on local mic:** Audio captured for wake-word detection **never leaves the device** until a realtime session is explicitly started (user said "Hey Lena" or pressed hotkey). Audio bytes are consumed by the WASM runtime in the renderer process only. (R-6 mitigation; ADR-5 rationale.)
- **Session audio:** Once a realtime session starts, audio is streamed to OpenAI Realtime API over an encrypted WebRTC connection. This is disclosed in onboarding consent.
- **No background recording:** The two-stage gate (local detect → session start) ensures OpenAI never receives audio from idle listening periods.
- **Mute/pause:** One-click mute in the tray immediately stops all mic capture (both wake and session streams). Muted state is visible in the tray icon and the orb window. (R-6 mitigation.)
- **Onboarding consent:** Explicit first-run consent screen explains always-on mic behavior before any audio is captured.

### 2.2 Memory and embeddings

- **Episodic and semantic memory are local-only.** All memory rows live in `lena.db` (SQLite, `<userData>`). They are never synced to a cloud service unless the user explicitly enables the Mem0 cloud adapter (which will be clearly labeled "cloud sync").
- **Embeddings are computed locally.** `Xenova/all-MiniLM-L6-v2` runs in-process via `@huggingface/transformers`. Raw text and embedding vectors never leave the device for the memory subsystem. (ADR-2.)
- **Mem0 adapter:** If enabled, uses Mem0 in **vector-only mode** (no Neo4j / graph mode). Any cloud API call from the Mem0 adapter is user-initiated and requires a user-supplied Mem0 key.

### 2.3 Credentials and secrets

- All credentials (OpenAI token/API key, Composio key, Mem0 key) are stored exclusively via `safeStorage.encryptString` (Electron keychain integration). Credentials are never written to disk as plaintext. (ADR-7; existing implementation.)
- No credentials are shipped in the built app or committed to source control. Each user supplies their own keys during the onboarding flow. (ADR-7.)
- OAuth callback uses a local HTTP server on port 1455; the authorization code is consumed in memory and never persisted to disk.

### 2.4 Diagnostics log redaction

- `sanitizeDiagnosticValue()` (already implemented in `main.js`) strips values matching `SECRET_KEY` patterns and redacts query strings from URLs before writing to `diagnostics.log`.
- `diagnostics.log` is capped at a rotation threshold; when exceeded, the current file is renamed to `diagnostics.log.prev` (single backup copy only — no unbounded accumulation).
- The log is stored in `<userData>/diagnostics.log` — not accessible to other OS users on a shared machine without elevated privileges.
- `diagnostics:privacy` IPC handler surfaces what is being logged so users can inspect it.

---

## 3. Security

### 3.1 Renderer isolation

- `contextIsolation: true` on all `BrowserWindow` instances (existing). The renderer has no direct access to Node.js APIs; all main-process capabilities are exposed only through the named `window.brah` preload bridge (`preload.js`).
- No `nodeIntegration: true` in any window. Any new window added must maintain this constraint.

### 3.2 MCP / dynamic tool gating (ADR-6)

- MCP tools (external, dynamically discovered) default to `write`/`destructive` permission level — explicit user confirmation is required before execution.
- Approved MCP servers are stored in an allowlist. Tool schema hashes are recorded at approval time; any schema drift triggers a re-confirmation prompt.
- Tool descriptions are sanitized and truncated before injection into the realtime system prompt to mitigate prompt injection via tool metadata (ADR-6, R-5).
- Maximum enabled MCP tools: **20** (enforced to prevent realtime tool-set bloat and OpenAI strict-mode schema failures — R-10).

### 3.3 Code signing and notarization (ADR-7, R-7)

- Production builds must be signed with an Apple Developer ID certificate (hardened runtime already configured in `build/`).
- All native addons (`@nut-tree-fork`, openWakeWord native bits, embedding native bits) must be individually signed and listed in `asarUnpack`.
- The build pipeline must notarize the `.dmg`/`.zip` via Apple's notarization service before distribution.
- Until a Developer ID cert is obtained: document the one-time Gatekeeper bypass (`xattr -cr`) for invited users. Do not silently distribute unsigned builds without this notice.

### 3.4 No shipped secrets

- The built app artifact contains zero credentials, tokens, or API keys. Verified by CI step: scan build output for known secret patterns before packaging. (ADR-7.)

### 3.5 Auto-update integrity

- Electron auto-updater verifies code signature before applying any update. Unsigned update packages are rejected.

---

## 4. Reliability and Availability

### 4.1 Always-ready session policy (ADR-8, R-8)

- The app keeps a realtime session alive (or ready to reconnect within ≤800 ms) as long as the user is active.
- **Idle timeout:** Configurable via settings (default: 5 minutes of no voice or text input). After timeout, the session is gracefully ended to stop accruing OpenAI realtime minutes. The next wake/hotkey event reconnects transparently.
- Cost transparency: onboarding and settings surface the cost model (realtime minutes billed during active sessions only; idle periods after timeout are free).
- Phase 6 text-chat mode uses a non-realtime model when the user types, not speaks — a lower-cost fallback that also satisfies ADR-8's "cheaper text mode" option.

### 4.2 Realtime reconnect

- On WebRTC disconnect (network blip, idle timeout, server error): automatic reconnect with ≤3 retry attempts, exponential back-off (1s, 2s, 4s).
- Visual indicator in the orb window and tray distinguishes: connected / reconnecting / disconnected.
- Session state (current conversation context, injected memory) is preserved in the renderer and re-injected on reconnect.

### 4.3 Crash recovery

- `app.setLoginItemSettings({ openAtLogin: true })` ensures Lena relaunches after a system restart.
- Electron's unhandled-rejection and uncaughtException handlers log to `diagnostics.log` before the process exits, providing a crash breadcrumb.
- SQLite WAL mode (`PRAGMA journal_mode = WAL`) ensures `lena.db` is never left in a corrupt state after a crash (existing in `database.js`).
- If `lena.db` fails to open on startup (corrupt/locked), the app logs the error, alerts the user, and offers to reset the database rather than silently losing data.

### 4.4 Auto-update

- `electron-updater` checks for updates on startup and after a configurable interval (default: 24 hours).
- Update download happens in the background; user is notified and prompted to restart — not forced.
- Failed update downloads do not affect app operation.

---

## 5. Accessibility

### 5.1 Primary modality: voice

- Voice is the first-class interaction mode. All core actions (ask question, trigger tools, manage planner) are reachable by voice alone.
- Wake-word or global hotkey summons the session from any app — no mouse required.

### 5.2 Text-chat fallback (Phase 6)

- The expandable panel provides a full text-chat interface sharing the same tool and memory backend.
- Text input does not require a realtime session (uses cheaper non-realtime model path per ADR-8).
- This covers users in quiet environments, those who cannot use a microphone, or situations where voice is impractical.

### 5.3 Listening/mute state visibility

- The tray icon changes appearance to reflect: idle (wake listening), active (in realtime session), muted, error/disconnected.
- The orb window shows a visible listening animation and a mute toggle button at all times during a session.
- State changes are reflected within ≤200 ms of the underlying event.

### 5.4 System accessibility

- The app does not override system font scaling or display contrast settings.
- Keyboard navigation must reach all settings-panel controls (tab order, focus rings).

---

## 6. Observability

### 6.1 Diagnostics log (existing + extended)

- **Location:** `<userData>/diagnostics.log` (path exposed via `diagnostics:get-log-path` IPC).
- **Rotation:** Single-backup rotation when file exceeds threshold (existing in `main.js`). Target threshold: 5 MB.
- **Redaction:** `sanitizeDiagnosticValue()` applied to all entries written via `writeDiagnosticLog` and `diagnostics:write` IPC.
- **Session header:** Each app launch writes a session header (version, platform, display count) so log readers can identify session boundaries.

### 6.2 Additional log events (to add in relevant phases)

| Event | Phase | Log key |
|---|---|---|
| Wake-word detection (positive only; no audio data) | 5 | `wake.detected` |
| Wake-word engine start/stop/mute | 5 | `wake.engine.{start,stop,mute}` |
| Memory recall (query hash, top-k count, latency ms; no raw text) | 2 | `memory.recall` |
| Memory extraction after session (count added; no content) | 2 | `memory.extract` |
| Embedding model load (cold vs warm, latency ms) | 2 | `embedding.load` |
| MCP tool approved / rejected / schema-drift detected | 4 | `mcp.tool.{approved,rejected,drift}` |
| Realtime session start / end / reconnect | existing + extend | `session.{start,end,reconnect}` |
| Idle timeout triggered | 5+ | `session.idle_timeout` |

All log events: timestamp (ISO 8601), event key, details object (redacted per `sanitizeDiagnosticValue`). No raw audio, no raw memory text, no credentials in any log entry.

### 6.3 Privacy diagnostics

- `diagnostics:privacy` IPC handler (existing) returns a snapshot of what is being collected so users can inspect it on demand from settings.

---

## 7. Scale Envelope

These requirements are calibrated for the following operating envelope. Requirements do not need to hold outside it.

| Dimension | Envelope |
|---|---|
| Users | 1 primary + up to ~5 invited (each a separate installation) |
| Memories (episodic + semantic combined) | Designed for thousands; performance targets stated at 1k and 5k; migration threshold at 10k |
| Active MCP tools | ≤20 (hard cap, enforced to prevent tool-set bloat — R-10) |
| Concurrent sessions | 1 per installation (single-user desktop app) |
| Platforms | macOS (arm64 primary; x64 secondary). Windows not a current target. |
| DB size | `lena.db` expected <100 MB over the lifetime of a typical user |

---

## 8. Requirement Traceability

| NFR | Source |
|---|---|
| Wake CPU ≤2% | ADR-5, R-3 |
| Memory recall <5ms at 1k | R-4, ADR-2 |
| 10k memory migration trigger | R-4 |
| Embedding ~23MB cached in userData | Master plan stack (Xenova/all-MiniLM-L6-v2) |
| Audio stays local until session start | R-6, ADR-5 |
| Local embeddings (no cloud for vectors) | ADR-2 |
| safeStorage / no plaintext credentials | ADR-7, existing impl |
| Diagnostics redaction | Existing `sanitizeDiagnosticValue` in main.js |
| MCP default-deny + allowlist + drift check | ADR-6, R-5 |
| ≤20 MCP tools | R-10 |
| Code signing + notarization | ADR-7, R-7 |
| No shipped secrets | ADR-7 |
| contextIsolation preload model | Existing main.js (line 124) |
| Always-ready + configurable idle timeout | ADR-8, R-8 |
| Auto-update | ADR-1 (electron-updater wired) |
| Crash recovery (WAL, login-item relaunch) | database.js (WAL), ADR-1 |
| Realtime reconnect | ADR-8 |
| Voice-first + text-chat fallback | Phase 6, ADR-8 |
| Tray listening/mute state | R-6, master plan phase 1 |
| diagnostics.log rotation + redaction | main.js existing + extension |
| Memory/MCP/wake event logging | This spec (Phase 2, 4, 5 work) |
| Single-user, thousands of memories, <20 MCP tools | Master plan target user + R-10 |
