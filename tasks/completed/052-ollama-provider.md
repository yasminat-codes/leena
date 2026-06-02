---
id: "052"
title: "Ollama provider implementation"
type: feature
status: completed
priority: high
complexity: L
estimated_tokens: 22000
dependencies: ["002", "001", "000"]
context_files:
  - src/providers/base-provider.js
  - src/providers/index.js
  - src/providers/types.js
skills: []
tags: [phase-2, providers, ollama, offline]
attempts: 1
claim_started: "2026-06-02T20:58:09Z"
completed_at: "2026-06-02T21:17:18Z"
created_at: "2026-06-01"
---

## Objective
Implement the Ollama provider for full offline capability — local chat, embeddings, and optional TTS/STT via locally running Ollama models, with graceful degradation when Ollama is not installed or running.

## Why This Matters
Ollama is the offline escape hatch. No API keys, no internet, no cost. Users with capable hardware get a fully private assistant. The provider must be resilient: Ollama may not be installed, may not be running, or may lack specific models. Every failure path must degrade gracefully, never crash.

## Steps
1. Create `src/providers/ollama-provider.js` extending BaseProvider. Default base URL: `http://localhost:11434`. Capabilities determined dynamically at registration by probing available models.
2. Implement `healthCheck()` — GET `/api/tags`. Returns `{ ok, models[] }`. On ECONNREFUSED: `{ ok: false, error: 'Ollama not running' }`. On timeout (2s): `{ ok: false, error: 'Ollama timeout' }`. This is called at registration to set dynamic capabilities.
3. Implement `chat(messages, options)` — POST `/api/chat` with `{ model, messages, stream: true }`. Ollama streaming format differs from OpenAI: newline-delimited JSON objects with `{ message: { content }, done }`. Convert to unified async iterator yielding `{ delta: { content } }` matching OpenAI shape. Use `withRetry` for transient errors.
4. Implement `embed(texts, options)` — POST `/api/embeddings` with `{ model, prompt }`. Ollama takes one prompt at a time; batch by sequential calls. Default model: `nomic-embed-text` or first available embedding model. Returns array of float arrays matching OpenAI embed shape.
5. Implement model management: `getModels()` — GET `/api/tags`, parse + tag each model with inferred capabilities (chat: 'llama'/'mistral'/'phi'; embedding: 'embed'/'nomic'), cache 5 min. AND `pullModel(name, onProgress)` — POST `/api/pull` with `{ name, stream: true }`, parse the NDJSON progress stream (`{ status, completed, total }`), invoke `onProgress({ pct, status })` per chunk, resolve when `status: 'success'`. This lets the user download ANY new model on demand (chat OR embedding) and have it appear in the selector. `listRunning()` optional via `/api/ps`.
6. Implement TTS stub: `tts(text, options)` — check if an outetts-compatible model is pulled. If available, POST `/api/generate` with TTS prompt and audio generation. If no TTS model: throw `ProviderError('TTS model not available — pull an outetts model')` with `code: 'MODEL_MISSING'`. STT stub: `stt(audioBuffer, options)` — check for whisper model. If available, use Ollama whisper. If not: throw with `code: 'MODEL_MISSING'`.
7. Register in provider index with factory `createOllamaProvider(config)` taking `{ baseUrl? }`. At registration, run `healthCheck()` — if Ollama unreachable, register with all capabilities false and log warning. Re-check on `testConnection()` call from settings UI.

## Acceptance Criteria
- [x] `OllamaProvider` extends `BaseProvider` with dynamically determined capabilities
- [x] `healthCheck()` handles: running + models, running + no models, not running, timeout
- [x] `chat()` converts Ollama streaming format to unified async iterator shape
- [x] `embed()` handles single and batch inputs, falls back to sequential calls
- [x] `getModels()` tags models with inferred capabilities
- [x] `pullModel(name, onProgress)` downloads any new model, streams progress %, resolves on success (chat + embedding models alike, independently)
- [x] TTS/STT methods throw descriptive `ProviderError` with `MODEL_MISSING` code when models absent
- [x] Provider registers with capabilities=false when Ollama unreachable (no crash)
- [x] All network calls use `withRetry` for transient errors
- [x] Base URL configurable (user might run Ollama on a different port or remote machine)

## Tests Required
- `test/provider-ollama.test.js`:
  - Mock HTTP: verify chat streaming format conversion (Ollama NDJSON → unified delta shape)
  - Mock healthCheck: ok with models, ok with empty models, ECONNREFUSED, timeout
  - Verify embed batches single inputs correctly
  - Verify getModels tags chat vs embedding models
  - Verify TTS/STT throws MODEL_MISSING when model not in list
  - Verify provider registers with capabilities=false when Ollama down
  - Verify retry on transient errors, no retry on MODEL_MISSING
  - Mock `/api/pull` NDJSON stream: verify `pullModel` reports incremental progress and resolves on `status: success`; verify a chat model and an embedding model can each be pulled independently

## Outputs
- `src/providers/ollama-provider.js` — full Ollama provider with dynamic capabilities
- Updated `src/providers/index.js` — registers Ollama provider
- `test/provider-ollama.test.js` — unit tests with mocked HTTP

## Interface Contracts
- **Task 054 depends on:** `getModels()` returning tagged model list + `pullModel(name, onProgress)` for the "download new model" affordance in the settings selector
- **Task 053 depends on:** `pullModel` being exposed via an IPC channel (`ollama:pull-model`) with progress events for the renderer
- **Task 053 depends on:** provider registerable with base URL from settings
- **Offline consumers depend on:** `chat()` and `embed()` working without internet when Ollama is running locally
- **R-12 mitigation:** graceful fallback when Ollama not installed — never crashes, surfaces actionable error

## Handoff Notes
- 2026-06-02T21:11:39Z: Implemented `src/providers/ollama-provider.js` with `OllamaProvider` and `createOllamaProvider(config)`.
- Default base URL is `http://localhost:11434`; configurable via `baseUrl`.
- `healthCheck()` probes `GET /api/tags`, applies a 2s timeout, updates dynamic capabilities from discovered models, and returns structured unavailable states for ECONNREFUSED and timeout without throwing.
- `chat()` posts streaming `/api/chat` requests and converts Ollama NDJSON chunks into unified `{ content, delta, model }` events matching OpenAI/OpenRouter streaming consumers.
- `embed()` posts sequential `/api/embeddings` requests for single or batch input, defaulting to `nomic-embed-text` unless a model is provided or an embedding model is discovered.
- `getModels()` tags executable chat and embedding capabilities and caches results for 5 minutes; speech models are not advertised as provider capabilities until executable Ollama speech support exists. `pullModel(name, onProgress)` parses streaming `/api/pull` progress and invalidates the model cache on success.
- `speak()`/`transcribe()` plus `tts()`/`stt()` aliases throw `ProviderError` with `code: "MODEL_MISSING"` when required local speech models are absent.
- Orchestrator integration registered Ollama in `src/providers/index.js` and added a registry-level dynamic-provider hook so `getForCapability("chat")` includes Ollama as a candidate before the async model probe, while `supports()` still reflects last known health/model state.
- Verification: `npx biome check src/providers/ollama-provider.js test/provider-ollama.test.js` passed (owned files clean).
- Verification: `node --test test/provider-ollama.test.js` passed (12 tests, 12 pass, 0 fail).
- Verification: full orchestrator `node --test` passed (266 tests, 266 pass, 0 fail) after advisor-fix tests were added.
- Verification: full orchestrator `npm run check` passed.
- Advisor-fix focused gate: `node --test test/provider-openai.test.js test/provider-openrouter.test.js test/provider-ollama.test.js test/provider-registry.test.js` passed, 47/47.

## Errors Encountered
- kencode-search returned no public snippets for the Ollama endpoint anchors (`/api/chat`, `/api/pull`, `/api/embeddings`, `nomic-embed-text`), so implementation followed the task's API contract and local provider interfaces.
- Reviewer found Ollama was not visible in synchronous registry capability lookup before model probing. Fixed with `BaseProvider.canProvide()` plus an Ollama override for dynamic candidates; `supports()` remains tied to discovered capabilities.
- Advisor found Ollama advertised TTS/STT before those methods can execute. Fixed by keeping Ollama speech out of `canProvide()`, `supports()`, and inferred model capabilities until executable support lands.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Ollama unreachable at startup | healthCheck fail count | >0 on first launch | Show "Install Ollama" prompt in settings, not error toast |
| Stream format mismatch | Chat test failures | Any delta shape mismatch | Update NDJSON parser for new Ollama response format |
| Embedding model missing | embed() MODEL_MISSING count | >0 in session | Auto-suggest `ollama pull nomic-embed-text` in settings UI |
