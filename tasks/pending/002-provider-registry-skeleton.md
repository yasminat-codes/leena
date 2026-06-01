---
id: "002"
title: "Provider abstraction layer skeleton"
type: infrastructure
status: pending
priority: critical
complexity: S
estimated_tokens: 10000
dependencies: ["000"]
context_files:
  - src/utils/errors.js
  - src/realtime/tools/index.js
skills: []
tags: [infrastructure, providers, abstraction]
attempts: 0
created_at: "2026-06-01"
---

## Objective

Create the universal provider abstraction layer — a registry, base class, and type definitions — so every concrete provider (OpenAI, OpenRouter, Ollama) plugs into a single interface for chat, embeddings, TTS, STT, and realtime capabilities.

## Why This Matters

The user wants OpenAI, OpenRouter, and Ollama as interchangeable providers. Without a shared interface, each provider becomes bespoke glue code. The registry pattern lets settings UI query "which providers support embeddings?" and lets the memory system call `registry.getForCapability('embeddings')` without knowing which provider is configured. This is the architectural backbone every feature phase builds on.

## Steps

1. Create `src/providers/types.js` defining capability constants (`CHAT`, `EMBEDDINGS`, `REALTIME`, `TTS`, `STT`) and JSDoc typedefs: `ProviderCapabilities` (object mapping capability → boolean), `ChatMessage` (`{ role, content, name? }`), `ChatRequest` (`{ messages, model?, temperature?, maxTokens?, signal? }`), `ChatResponse` (`{ content, model, usage: { promptTokens, completionTokens } }`), `EmbeddingRequest` (`{ input: string | string[], model? }`), `EmbeddingResponse` (`{ embeddings: number[][], model, usage }`).
2. Create `src/providers/base-provider.js` exporting `BaseProvider` class with: constructor takes `{ name, displayName, capabilities, models }`, abstract methods `async chat(request)`, `async embed(request)`, `async speak(text, options)` (TTS), `async transcribe(audioBuffer, options)` (STT), `createRealtimeSession(config)` (returns event emitter or stream). Each abstract method throws `ProviderError` with code `NOT_IMPLEMENTED` if the provider doesn't support that capability. Add `supports(capability)` method that checks `this.capabilities[capability]`.
3. Create `src/providers/index.js` exporting `ProviderRegistry` class: `register(provider)` — validates provider extends `BaseProvider`, adds to internal map keyed by `provider.name`; `get(name)` — returns provider or throws `ProviderError` with code `PROVIDER_NOT_FOUND`; `list()` — returns array of `{ name, displayName, capabilities }` for all registered providers; `getForCapability(capability)` — returns array of providers that support the given capability; `getDefault(capability)` — returns the provider set as default for that capability (stored in settings, falls back to first registered); `setDefault(capability, providerName)` — persists default to settings store.
4. Create `src/providers/provider-settings.js` exporting functions to load/save provider defaults and API keys from the existing settings store (`src/realtime/tools/database.js` `settings` table). Keys: `provider:default:chat`, `provider:default:embeddings`, `provider:default:tts`, `provider:default:stt`, `provider:default:realtime`, `provider:apikey:openrouter`, `provider:apikey:openai`. Ollama has no key (just base URL: `provider:ollama:baseUrl`).
5. Wire `ProviderRegistry` as a singleton — export a `getRegistry()` function that lazy-initializes one instance. Do NOT register any concrete providers yet (that's tasks 003–005).
6. Write `test/provider-registry.test.js` covering: (a) register a mock provider, retrieve by name, (b) `getForCapability` filters correctly, (c) `get` throws `ProviderError` for unknown name, (d) abstract methods on `BaseProvider` throw `NOT_IMPLEMENTED`, (e) `list()` returns capability summaries for all registered, (f) `setDefault`/`getDefault` round-trip through settings store (use temp db).

## Acceptance Criteria

- [ ] `src/providers/types.js` exports capability constants and JSDoc typedefs
- [ ] `BaseProvider` in `src/providers/base-provider.js` with abstract methods that throw `ProviderError`
- [ ] `ProviderRegistry` in `src/providers/index.js` with `register`, `get`, `list`, `getForCapability`, `getDefault`, `setDefault`
- [ ] `src/providers/provider-settings.js` reads/writes provider config from SQLite settings store
- [ ] `getRegistry()` returns singleton instance
- [ ] `test/provider-registry.test.js` passes with `node --test`
- [ ] `npm run check` passes

## Tests Required

- `test/provider-registry.test.js`
  - Register mock provider → `get(name)` returns it
  - `getForCapability('chat')` returns only providers with `chat: true`
  - `get('nonexistent')` throws `ProviderError` with code `PROVIDER_NOT_FOUND`
  - `BaseProvider` abstract methods throw `ProviderError` with code `NOT_IMPLEMENTED`
  - `list()` returns `[{ name, displayName, capabilities }]` for all registered
  - `setDefault('chat', 'mock')` → `getDefault('chat')` returns `'mock'` (temp db via `withTempDir` pattern)

## Outputs

- `src/providers/types.js` — capability constants and type definitions
- `src/providers/base-provider.js` — abstract base provider class
- `src/providers/index.js` — provider registry (register, get, list, capabilities query)
- `src/providers/provider-settings.js` — settings persistence for provider defaults and keys
- `test/provider-registry.test.js` — test suite

## Interface Contracts

- Tasks 003 (OpenAI provider), 004 (OpenRouter provider), 005 (Ollama provider) each `extend BaseProvider` and call `registry.register()`
- Memory tasks call `registry.getForCapability('embeddings')` to get the configured embedding provider
- Realtime engine calls `registry.getForCapability('realtime')` for voice sessions
- Settings UI calls `registry.list()` to populate provider/model dropdowns
- `provider-settings.js` is the single source of truth for which provider handles which capability

## Handoff Notes

_Filled after completion._

## Errors Encountered

_Filled if errors occur._

## Self-Annealing Contract

| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| No concrete providers registered | `registry.list().length` at runtime | 0 after Wave 2 | Verify provider tasks import and register |
| Settings not persisting | `getDefault` returns null after `setDefault` | Any occurrence | Check settings store path and key format |
| BaseProvider subclass missing method override | `NOT_IMPLEMENTED` error in diagnostics | > 0 after provider tasks | Audit concrete provider for missing method |
