---
id: "053"
title: "Provider settings IPC channels"
type: feature
status: pending
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
attempts: 0
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
- [ ] `providers:list` returns all registered providers with correct status flags
- [ ] `providers:get-config` never exposes full API keys across IPC (redacted to last 4 chars)
- [ ] `providers:set-config` encrypts API keys via safeStorage before storing
- [ ] `providers:test-connection` returns structured result with latency measurement
- [ ] `providers:get-models` returns filtered model list for requested capability
- [ ] `ollama:pull-model` downloads a new model and streams `ollama:pull-progress` events to the renderer; resolves on success
- [ ] All channels registered in main.js with `ipcMain.handle`
- [ ] All channels exposed in preload.js via contextBridge
- [ ] Error responses are serialized `ProviderError` objects (from task 000)

## Tests Required
- `test/provider-settings-ipc.test.js`:
  - Mock ipcMain.handle registration: verify all 5 channels registered
  - Verify get-config redacts API keys (returns last 4 chars, not full key)
  - Verify set-config calls safeStorage.encryptString on API key
  - Verify test-connection returns latency measurement
  - Verify get-models filters by capability correctly
  - Verify error serialization across IPC boundary

## Outputs
- Updated `src/main.js` — 5 new ipcMain.handle registrations
- Updated `src/preload.js` — 5 new contextBridge channels
- `test/provider-settings-ipc.test.js` — IPC channel tests

## Interface Contracts
- **Task 054 depends on:** `providers:get-models` returning model lists for the UI dropdown
- **Task 054 depends on:** `providers:set-config` persisting model selections
- **Task 037 (onboarding) depends on:** `providers:test-connection` for validating API key during setup
- **Settings screen depends on:** `providers:list` for rendering provider cards with status
- **Task 054 depends on:** `ollama:pull-model` + `ollama:pull-progress` for the "download new model" affordance with a progress bar

## Handoff Notes
_Filled after completion._

## Errors Encountered
_Filled if errors occur._

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| API key leaked in renderer logs | Grep renderer console logs for key patterns | Any full key in logs | Audit all IPC return paths; add redaction middleware |
| test-connection timeout | Timeout count in error logs | >2 per session | Increase timeout or add progress indicator |
| set-config fails silently | Settings not persisting after restart | Any occurrence | Add write-then-read verification in set-config handler |
