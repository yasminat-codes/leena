---
id: "050"
title: "OpenAI provider implementation"
type: feature
status: pending
priority: high
complexity: M
estimated_tokens: 18000
dependencies: ["002", "001", "000"]
context_files:
  - src/providers/base-provider.js
  - src/providers/index.js
  - src/providers/types.js
  - src/main.js
skills: []
tags: [phase-2, providers, openai]
attempts: 0
created_at: "2026-06-01"
---

## Objective
Implement the OpenAI provider as the first concrete provider in the universal provider layer, wrapping all existing OpenAI API calls (chat, embeddings, realtime, TTS, STT) behind the BaseProvider interface.

## Why This Matters
OpenAI is the primary and most feature-complete provider. Every capability Leena offers today flows through raw OpenAI fetch calls scattered in main.js. Centralizing them behind the provider interface means all future providers share the same contract, and switching/fallback becomes trivial.

## Steps
1. Create `src/providers/openai-provider.js` extending BaseProvider. Declare capabilities: `{ chat: true, embeddings: true, realtime: true, tts: true, stt: true }`.
2. Implement `chat(messages, options)` — wraps `POST https://api.openai.com/v1/chat/completions` with streaming support. Uses `withRetry` from `src/utils/retry.js` for transient failures. Returns an async iterator for streaming or a resolved message for non-streaming.
3. Implement `embed(texts, options)` — wraps `POST https://api.openai.com/v1/embeddings` with model defaulting to `text-embedding-3-small`. Accepts single string or array. Returns array of float arrays.
4. Implement `createRealtimeSession(options)` — wraps the existing `createRealtimeClientSecret` logic from main.js (POST to `/v1/realtime/client_secrets` then `/v1/realtime/sessions`). Accepts model and voice overrides. Returns session config object.
5. Implement `tts(text, options)` — wraps `POST https://api.openai.com/v1/audio/speech`. Options: model (tts-1/tts-1-hd), voice, response_format. Returns audio buffer.
6. Implement `stt(audioBuffer, options)` — wraps `POST https://api.openai.com/v1/audio/transcriptions` (Whisper). Options: model, language, prompt. Returns transcription text.
7. Register provider in `src/providers/index.js` default registry initialization. Export a factory `createOpenAIProvider(config)` that takes `{ apiKey, orgId? }`.

## Acceptance Criteria
- [ ] `OpenAIProvider` extends `BaseProvider` and declares all 5 capabilities as true
- [ ] `chat()` sends correct headers (Authorization, Content-Type) and handles streaming via async iterator
- [ ] `embed()` returns correctly shaped float arrays for single and batch inputs
- [ ] `createRealtimeSession()` produces a valid session config identical to current main.js behavior
- [ ] `tts()` returns audio buffer in requested format
- [ ] `stt()` returns transcription string from audio buffer
- [ ] All methods use `withRetry` for transient errors (429, 5xx, ECONNRESET)
- [ ] All methods throw `ProviderError` (from task 000) with provider name and original error

## Tests Required
- `test/provider-openai.test.js`:
  - Mock HTTP responses for each endpoint (chat, embed, realtime, tts, stt)
  - Verify correct URL, headers, and body for each capability
  - Verify retry on 429 and 5xx
  - Verify streaming chat returns async iterator yielding delta chunks
  - Verify ProviderError thrown on 401 (not retried) and network failure (retried then thrown)
  - Verify capabilities declaration matches expected shape

## Outputs
- `src/providers/openai-provider.js` — full OpenAI provider implementation
- Updated `src/providers/index.js` — registers OpenAI provider by default
- `test/provider-openai.test.js` — comprehensive unit tests with mocked HTTP

## Interface Contracts
- **Downstream tasks depend on:** `OpenAIProvider` being registered in the default registry so that `registry.getForCapability('chat')` returns it when configured
- **Task 055 depends on:** `createRealtimeSession()` method matching the existing behavior in main.js so the realtime engine can switch to using the provider layer
- **Task 054 depends on:** `getModels()` method returning available model IDs for the settings UI dropdown

## Handoff Notes
_Filled after completion._

## Errors Encountered
_Filled if errors occur._

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Direct OpenAI fetch calls remain in main.js | grep -c "api.openai.com" src/main.js | >0 after task 055 completes | File issue to migrate remaining direct calls |
| Retry not triggered in production | Log count of retry events | 0 after 1 week usage | Verify retry wiring; may need to broaden error matching |
| Streaming chat drops chunks | Test with large response (>4k tokens) | Any dropped delta | Add backpressure handling to async iterator |
