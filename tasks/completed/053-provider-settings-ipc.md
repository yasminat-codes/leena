---
id: "053"
title: "Provider settings IPC channels"
type: feature
status: completed
priority: high
complexity: M
estimated_tokens: 14000
dependencies: ["002", "038"]
context_files:
  - src/providers/index.js
  - src/main.js
  - src/preload.js
  - src/settings-store.js
skills: []
tags: [phase-2, providers, ipc, settings]
attempts: 1
claim_started: "2026-06-03T02:05:04Z"
completed_at: "2026-06-03T02:17:52Z"
created_at: "2026-06-01"
---

## Objective
Add IPC channels that let the renderer query, configure, and test provider connections, bridging the provider registry (main process) with the settings UI (renderer process).

## Why This Matters
Providers live in the main process (they make HTTP calls, hold API keys). The renderer needs to list available providers, show their status, let the user enter API keys, pick default models, and test connections. These IPC channels are the only bridge.

## Steps
1. Add IPC handler `providers:list` — returns array of `{ id, name, capabilities, configured, connected }` for each registered provider. `configured` = has required credentials in settings store. `connected` = last testConnection succeeded.
2. Add IPC handler `providers:get-config` — given provider ID, returns `{ apiKey: '[REDACTED]', baseUrl, defaultModels: { chat, embeddings, tts, stt } }`. API keys are redacted in transit (show last 4 chars only). Full key never crosses IPC.
3. Add IPC handler `providers:set-config` — given provider ID + config object, stores API key (encrypted via safeStorage), base URL, and default model selections in settings store. Re-initializes the provider instance with new config.
4. Add IPC handler `providers:test-connection` — given provider ID, calls `provider.testConnection()`. Returns `{ ok, latencyMs, error?, modelCount? }`. Runs with a 10s timeout.
5. Add IPC handler `providers:get-models` — given provider ID + capability, returns filtered model list for that capability (uses provider's `getModels()` + capability tag filter).
6. Add IPC handler `ollama:pull-model` — given `{ model }`, calls the Ollama provider's `pullModel(name, onProgress)`; streams progress to the renderer via `webContents.send('ollama:pull-progress', { model, pct, status })`; resolves `{ ok }` on success. Lets the user download any new Ollama model (chat or embedding) on demand.
7. Update `src/preload.js` to expose all channels via `window.leena.providers.*` plus `window.leena.ollama.pullModel(model)` and an `onPullProgress(cb)` subscription (use whatever the current API namespace is if rename hasn't run yet).

## Acceptance Criteria
- [x] `providers:list` returns all registered providers with correct status flags
- [x] `providers:get-config` never exposes full API keys across IPC (redacted to last 4 chars)
- [x] `providers:set-config` encrypts API keys via safeStorage before storing
- [x] `providers:test-connection` returns structured result with latency measurement
- [x] `providers:get-models` returns filtered model list for requested capability
- [x] `ollama:pull-model` downloads a new model and streams `ollama:pull-progress` events to the renderer; resolves on success
- [ ] All channels registered in main.js with `ipcMain.handle` — deferred to shared integration pass
- [ ] All channels exposed in preload.js via contextBridge — deferred to shared integration pass
- [x] Error responses are serialized `ProviderError` objects (from task 000)

## Tests Required
- `test/provider-settings-ipc.test.js`:
  - Mock ipcMain.handle registration: verify all 5 channels registered
  - Verify get-config redacts API keys (returns last 4 chars, not full key)
  - Verify set-config calls safeStorage.encryptString on API key
  - Verify test-connection returns latency measurement
  - Verify get-models filters by capability correctly
  - Verify error serialization across IPC boundary

## Outputs
- New `src/ipc/provider-handlers.js` — task-owned provider IPC registration module with injectable registry, settings store, safeStorage codec, provider reconfiguration, timeout, and progress sender dependencies.
- New `test/provider-settings-ipc.test.js` — IPC channel tests for registration, API-key redaction/encryption, test-connection latency/timeout, model filtering, serialized errors, and Ollama pull progress.
- Deferred `src/main.js` / `src/preload.js` wiring to the shared integration pass; this module exports `registerProviderHandlers()`, `createProviderIpcHandlers()`, and `createSafeStorageSecretCodec()` for that handoff.

## Interface Contracts
- **Task 054 depends on:** `providers:get-models` returning model lists for the UI dropdown
- **Task 054 depends on:** `providers:set-config` persisting model selections
- **Task 037 (onboarding) depends on:** `providers:test-connection` for validating API key during setup
- **Settings screen depends on:** `providers:list` for rendering provider cards with status
- **Task 054 depends on:** `ollama:pull-model` + `ollama:pull-progress` for the "download new model" affordance with a progress bar

## Handoff Notes
- Implemented provider settings IPC as a task-owned module in `src/ipc/provider-handlers.js`.
- `registerProviderHandlers(ipcMain, options)` registers `providers:list`, `providers:get-config`, `providers:set-config`, `providers:test-connection`, `providers:get-models`, and `ollama:pull-model`.
- `createSafeStorageSecretCodec(safeStorage)` adapts Electron `safeStorage.encryptString()` / `decryptString()` to the existing protected provider API-key storage contract. Full API keys do not cross IPC; `get-config` returns only `[REDACTED]` plus the last four characters.
- `providers:set-config` saves API keys, base URLs, and per-provider default model selections, then calls an injectable reconfiguration hook. The default hook recreates known OpenAI/OpenRouter/Ollama providers in the registry.
- `providers:test-connection` measures latency and enforces the 10s default timeout. Failures and unsupported operations serialize through `serializeError(..., { redactSecrets: true })`.
- `providers:get-models` normalizes provider model rows and filters by capability tags.
- `ollama:pull-model` sends `ollama:pull-progress` through the IPC event sender or an injected progress sender.
- Main/preload handoff: import `registerProviderHandlers` and `createSafeStorageSecretCodec` in `src/main.js`, call `registerProviderHandlers(ipcMain, { secretCodec: createSafeStorageSecretCodec(safeStorage) })`, then expose renderer bridge methods in `src/preload.js` under `window.leena.providers.*` plus `window.leena.ollama.pullModel()` / pull-progress subscription when those shared files are claim-free.
- Verification: `npm run check`, `node --test` (354 passing), focused `node --test test/provider-settings-ipc.test.js`, and `node --check src/ipc/provider-handlers.js test/provider-settings-ipc.test.js`.

## Errors Encountered
- Focused tests caught the first timeout helper using an unref'd timer, which left the timeout promise pending under `node:test`. Removed the unref so timeout behavior settles deterministically.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| API key leaked in renderer logs | Grep renderer console logs for key patterns | Any full key in logs | Audit all IPC return paths; add redaction middleware |
| test-connection timeout | Timeout count in error logs | >2 per session | Increase timeout or add progress indicator |
| set-config fails silently | Settings not persisting after restart | Any occurrence | Add write-then-read verification in set-config handler |
