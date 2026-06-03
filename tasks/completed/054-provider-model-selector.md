---
id: "054"
title: "Provider model selector UI component"
type: ui
status: completed
priority: medium
complexity: M
estimated_tokens: 15000
dependencies: ["053", "050", "051", "052"]
context_files:
  - src/renderer/index.html
  - src/renderer/renderer.js
  - src/renderer/styles.css
  - src/preload.js
skills: []
tags: [phase-2, providers, ui, settings]
attempts: 1
claim_started: "2026-06-03T04:02:39Z"
completed_at: "2026-06-03T04:24:04Z"
created_at: "2026-06-01"
---

## Objective
Build the Settings UI component that lets users pick a default provider and model for each capability (chat, embeddings, TTS, STT), with real-time model lists fetched from the provider layer.

## Why This Matters
The universal provider layer is useless without a way to configure it. Users need to see which providers are available, enter API keys, test connections, and pick which model handles each capability. This is the user-facing control surface for the entire provider abstraction.

## Steps
1. Create a "Providers" section in the Settings screen with a card per provider (OpenAI, OpenRouter, Ollama). Each card shows: name, connection status indicator (green/yellow/red), Configure button.
2. Build provider configuration modal: API key input (masked, with show/hide toggle), base URL input (for Ollama), "Test Connection" button that calls `providers:test-connection` and shows latency + model count result.
3. Build capability-to-model mapping UI: for each capability (Chat, Embeddings, TTS, STT), show a row with: capability label, provider dropdown (filtered to providers supporting this capability), model dropdown (populated from `providers:get-models` for selected provider).
4. Wire "Save" to call `providers:set-config` for each modified provider. Show success/error toast. Persist selections immediately.
5. Add "Refresh Models" button per provider that re-fetches model list. For **Ollama specifically**, add a "Download model" affordance: a text input (or searchable combo) where the user types ANY model name (e.g. `llama3.2`, `qwen2.5`, `nomic-embed-text`) and clicks Download → calls `ollama:pull-model` (IPC from task 053) and shows a live progress bar driven by the `ollama:pull-progress` push events. On success the model auto-appears in the relevant capability dropdown and is immediately selectable. Embedding models download the same way, independently of chat models.
6. Style using leena.css design tokens only — no hardcoded colors. Responsive within the settings panel width.

## Acceptance Criteria
- [x] Provider cards show accurate connection status (calls `providers:list` on mount)
- [x] API key input masks by default, toggle reveals
- [x] Test Connection shows latency and model count on success, error message on failure
- [x] Capability dropdowns filter providers by declared capability
- [x] Model dropdown populated dynamically from provider's model list
- [x] Save persists all selections and shows confirmation
- [x] Refresh Models updates the dropdown without page reload
- [x] Ollama "Download model": typing any model name + Download pulls it, shows live progress %, and the model becomes selectable on success (chat AND embedding models, independently)
- [x] All styling uses CSS custom properties from leena.css

## Tests Required
- `test/provider-model-selector.test.js`:
  - Verify provider list rendering with mock IPC responses
  - Verify capability filtering (e.g., realtime dropdown only shows OpenAI)
  - Verify model dropdown population from mock getModels response
  - Verify API key masking (input type=password, toggle switches to text)
  - Verify test-connection displays latency on success
  - Verify save calls set-config with correct payload
  - Verify Ollama "Download model": entering a model name + Download calls `ollama:pull-model`, the progress bar advances on `ollama:pull-progress` events, and the model appears selectable on success

## Outputs
- Updated Settings screen in `src/renderer/` — new Providers section
- Provider configuration modal component
- Capability-to-model mapping UI
- `test/provider-model-selector.test.js` — UI component tests

## Interface Contracts
- **Consumers depend on:** saved provider/model selections being available via settings store for all downstream features (memory embeddings, text chat, TTS, STT)
- **Task 055 depends on:** realtime provider selection being persisted so the realtime engine knows which provider to use
- **Phase 7 (UI wire) depends on:** this component being functional and styled correctly

## Handoff Notes
- Implemented provider selector in `src/renderer/screens/settings.js`.
  - `bindSettingsControls()` now hydrates a provider selector through `window.leena.providers.*`.
  - Provider cards render OpenAI/OpenRouter/Ollama status, configure/test/refresh actions, and capability chips.
  - Capability rows include chat, realtime, embeddings, TTS, and STT; provider dropdowns are capability filtered.
  - Model dropdowns load from `providers:get-models` for the selected provider/capability.
  - Provider/default selections persist through `settings:set` keys plus `providers:set-config` defaultModels payloads.
  - Config modal supports masked API key, show/hide toggle, base URL, test connection latency/model count, and save confirmation.
  - Ollama download calls `window.leena.ollama.pullModel`, listens to `onPullProgress`, uses a CSP-safe native progress element, and adds completed chat/embedding models to the relevant dropdowns.
- Added token-only responsive styling in `src/renderer/leena.css`.
- Added `test/provider-model-selector.test.js` covering render, realtime filtering, model population, mask toggle, test connection success, save payload, and Ollama chat/embedding download progress/success.
- Required pre-code `kencode-search` was called for `providers:get-models`; no public literal matches were found, so implementation used local context from Settings, preload provider APIs, IPC handlers, provider modules, CSS tokens, and renderer tests.
- Changed files for this task:
  - `src/renderer/screens/settings.js`
  - `src/renderer/leena.css`
  - `test/provider-model-selector.test.js`
  - `tasks/in-progress/054-provider-model-selector.md`

## Errors Encountered
- Early worker gates saw concurrent Wave 12 integration/test drift while task `103` was still in progress. Parent verification later resolved the integration test mismatch and passed full `npm run check` plus `node --test`.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Users skip provider setup | Onboarding completion without any provider configured | >50% of sessions | Add provider setup to onboarding wizard (task 037) |
| Model dropdown empty | getModels returns 0 results | Any occurrence | Show "No models found — check connection" message |
| Capability mismatch | User selects provider for capability it doesn't support | Any occurrence | Harden dropdown filter; disable unsupported options |
