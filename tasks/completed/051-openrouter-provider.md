---
id: "051"
title: "OpenRouter provider implementation"
type: feature
status: completed
priority: high
complexity: M
estimated_tokens: 16000
dependencies: ["002", "001", "000"]
context_files:
  - src/providers/base-provider.js
  - src/providers/index.js
  - src/providers/types.js
skills: []
tags: [phase-2, providers, openrouter]
attempts: 1
claim_started: "2026-06-02T20:58:09Z"
completed_at: "2026-06-02T21:17:18Z"
created_at: "2026-06-01"
---

## Objective
Implement the OpenRouter provider, giving Leena access to 200+ models (Claude, Llama, Gemini, Mistral, etc.) via OpenRouter's OpenAI-compatible API with the required custom headers.

## Why This Matters
OpenRouter is the universal model gateway — one API key unlocks every major model family. Users who don't want to pay for OpenAI directly, or who prefer Claude/Llama for certain tasks, get full access. The OpenAI-compatible format means minimal new code — mainly header differences and model list fetching.

## Steps
1. Create `src/providers/openrouter-provider.js` extending BaseProvider. Declare capabilities: `{ chat: true, embeddings: true, realtime: false, tts: false, stt: false }`.
2. Implement `chat(messages, options)` — POST to `https://openrouter.ai/api/v1/chat/completions`. Must include headers: `Authorization: Bearer <key>`, `HTTP-Referer: https://leena.app`, `X-Title: Leena`. Supports streaming via SSE (same format as OpenAI). Uses `withRetry` for transient errors.
3. Implement `embed(texts, options)` — POST to `https://openrouter.ai/api/v1/embeddings`. Same header requirements. Model defaults to a free/cheap embedding model available on OpenRouter.
4. Implement `getModels()` — GET `https://openrouter.ai/api/v1/models`. Parse response to extract model IDs, names, pricing, and context lengths. Cache for 1 hour (in-memory). Filter to models supporting chat completion.
5. Implement `testConnection()` — call `getModels()` and verify at least one model returned. Return `{ ok: true, modelCount: N }` or `{ ok: false, error: string }`.
6. Add `getModelInfo(modelId)` helper — returns pricing, context length, and capability flags for a specific model from the cached model list.
7. Register in provider index with factory `createOpenRouterProvider(config)` taking `{ apiKey, siteUrl?, siteName? }`. siteUrl defaults to `https://leena.app`, siteName to `Leena`.

## Acceptance Criteria
- [x] `OpenRouterProvider` extends `BaseProvider` with chat and embeddings capabilities
- [x] Chat requests include all 3 required headers (Authorization, HTTP-Referer, X-Title)
- [x] Streaming chat works identically to OpenAI format (SSE with `data: {...}` lines)
- [x] `getModels()` fetches and caches the model list for 1 hour
- [x] `testConnection()` returns structured ok/error result
- [x] `embed()` works with OpenRouter-supported embedding models
- [x] All methods use `withRetry` for transient failures
- [x] All methods throw `ProviderError` on auth failure (402 = insufficient credits, 401 = bad key)

## Tests Required
- `test/provider-openrouter.test.js`:
  - Mock HTTP: verify chat request has HTTP-Referer and X-Title headers
  - Verify streaming chat yields delta chunks via async iterator
  - Mock model list response: verify caching (second call within 1hr returns cached)
  - Verify testConnection returns ok:true with valid mock, ok:false with error mock
  - Verify embed sends correct model and returns float arrays
  - Verify ProviderError on 401 and 402 responses
  - Verify retry on 429 and 5xx

## Outputs
- `src/providers/openrouter-provider.js` — full OpenRouter provider
- Updated `src/providers/index.js` — registers OpenRouter provider
- `test/provider-openrouter.test.js` — unit tests with mocked HTTP

## Interface Contracts
- **Task 054 depends on:** `getModels()` returning model list for the settings UI model picker
- **Task 053 depends on:** provider being registerable with API key from settings store
- **Chat consumers depend on:** `chat()` returning the same async iterator / message shape as OpenAI provider (unified interface)

## Handoff Notes
- Added `src/providers/openrouter-provider.js` with `OpenRouterProvider` and `createOpenRouterProvider(config)`.
- `src/providers/index.js` was intentionally not edited because Wave 07 orchestration reserved shared integration for another worker.
- Chat uses `POST https://openrouter.ai/api/v1/chat/completions` with `Authorization`, `HTTP-Referer`, and `X-Title`; non-streaming responses normalize content/model/usage and streaming responses return an async iterator over unified SSE chunks shaped as `{ content, delta, model, finishReason?, usage? }`.
- Embeddings use `POST https://openrouter.ai/api/v1/embeddings` with default model `qwen/qwen3-embedding-0.6b`.
- Models use `GET https://openrouter.ai/api/v1/models`, filter text-output chat models, normalize pricing/context/capabilities, and cache in memory for 1 hour.
- `testConnection()` returns `{ ok: true, modelCount }` or `{ ok: false, error, code }`; `getModelInfo(modelId)` returns pricing/context/capabilities or `null`.
- Verification: `node --test test/provider-openrouter.test.js` passed 9/9; owned-file Biome check `npx biome check src/providers/openrouter-provider.js test/provider-openrouter.test.js` passed; full orchestrator `node --test` passed 266/266 after advisor-fix tests were added.
- Advisor-fix focused gate: `node --test test/provider-openai.test.js test/provider-openrouter.test.js test/provider-ollama.test.js test/provider-registry.test.js` passed, 47/47.

## Errors Encountered
- Concurrent formatting drift in `test/provider-openai.test.js` was fixed before completion; final orchestrator `npm run check` passed.
- Advisor flagged provider streaming-shape drift across OpenAI/OpenRouter/Ollama; OpenRouter already used the target shape, and tests now assert both `content` and `delta` strings.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Model list stale | Cache age check | >24hr without refresh | Add background refresh on app focus |
| 402 errors frequent | Error log count | >3 in session | Surface "low credits" warning in UI |
| Header missing in requests | Integration test | Any request without HTTP-Referer | Harden header injection in base fetch wrapper |
