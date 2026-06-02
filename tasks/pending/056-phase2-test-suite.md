---
id: "056"
title: "Provider layer comprehensive test suite"
type: test
status: pending
priority: high
complexity: M
estimated_tokens: 18000
dependencies: ["050", "051", "052", "053"]
context_files:
  - test/provider-openai.test.js
  - test/provider-openrouter.test.js
  - test/provider-ollama.test.js
  - src/providers/index.js
  - src/providers/base-provider.js
skills: []
tags: [phase-2, providers, testing]
attempts: 0
created_at: "2026-06-01"
---

## Objective
Write the integration test suite that exercises the full provider layer end-to-end: registry with all 3 providers, capability routing, provider switching, fallback chains, and cross-provider behavioral consistency.

## Why This Matters
Individual provider tests (written in tasks 050-052) verify each provider in isolation. This suite tests them working together — the registry dispatching to the right provider for each capability, fallback when a provider goes down, and behavioral consistency (all providers' `chat()` returns the same shape). Without this, provider switching in production will have subtle shape mismatches.

## Steps
1. Create `test/provider-integration.test.js`. Set up a test registry with all 3 providers registered (OpenAI with mock key, OpenRouter with mock key, Ollama with mock server URL).
2. Test capability routing: `getForCapability('chat')` returns the user-configured default chat provider. `getForCapability('realtime')` returns only OpenAI. `getForCapability('embeddings')` returns user's default embedding provider.
3. Test provider switching: change default chat provider from OpenAI to OpenRouter via registry config. Verify `getForCapability('chat')` now returns OpenRouter. Verify chat response shape is identical between providers (same fields, same iterator protocol for streaming).
4. Test fallback chain: configure Ollama as default chat provider. Mock Ollama as unreachable. Verify registry falls back to next available chat provider (OpenRouter or OpenAI) when `fallback: true` option is passed.
5. Test cross-provider response shape consistency: call `chat()` on all 3 providers with identical input. Verify all return objects have same top-level fields. Verify all streaming iterators yield objects with same `delta.content` shape.
6. Test error consistency: trigger auth error on each provider. Verify all throw `ProviderError` with `provider` field set to correct provider name, and `code` field set to recognizable error code.
7. Create `test/provider-stress.test.js` (lightweight): register/unregister providers rapidly. Verify registry state is consistent. Verify no provider leaks event listeners or connections.

## Acceptance Criteria
- [ ] Integration test exercises all 3 providers through the shared registry
- [ ] Capability routing returns correct provider for each capability
- [ ] Provider switching updates routing immediately
- [ ] Fallback chain works when primary provider is unreachable
- [ ] Response shapes are consistent across providers (chat, embed)
- [ ] Error shapes are consistent across providers (ProviderError with provider name)
- [ ] Stress test passes without listener leaks
- [ ] All tests use mocked HTTP (no real API calls)
- [ ] `npm test` passes with all new + existing tests

## Tests Required
- `test/provider-integration.test.js` — 6 test groups as described above
- `test/provider-stress.test.js` — register/unregister stability tests

## Outputs
- `test/provider-integration.test.js` — end-to-end provider layer tests
- `test/provider-stress.test.js` — stability tests

## Interface Contracts
- **All downstream phases depend on:** these tests passing as proof that the provider layer is reliable before building memory (Phase 3), identity (Phase 4), and MCP (Phase 5) on top of it
- **CI/CD depends on:** `npm test` including these tests in the standard run

## Handoff Notes
_Filled after completion._

## Errors Encountered
_Filled if errors occur._

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Test flakiness | Test pass rate across 10 runs | <100% | Identify timing-dependent tests; add deterministic mocks |
| Shape mismatch discovered in production | Runtime type errors in consumers | Any occurrence | Add shape assertion to provider base class; re-run integration tests |
| Fallback not tested with real provider failure | Coverage of fallback paths | <100% of registered fallback chains | Add chaos-style tests that randomly fail providers |
