---
id: "055"
title: "Wire realtime engine to provider layer"
type: refactor
status: completed
priority: high
complexity: M
estimated_tokens: 16000
dependencies: ["050", "002"]
context_files:
  - src/main.js
  - src/realtime/prompts.js
  - src/realtime/tools/index.js
  - src/providers/openai-provider.js
  - src/providers/index.js
skills: []
tags: [phase-2, providers, realtime, refactor]
attempts: 1
claim_started: "2026-06-02T22:04:44Z"
completed_at: "2026-06-02T22:18:40Z"
created_at: "2026-06-01"
---

## Objective
Refactor the existing realtime voice engine to obtain credentials and session config from the provider layer instead of making direct OpenAI API calls, making the realtime path provider-aware without breaking current behavior.

## Why This Matters
The realtime engine currently hardcodes OpenAI endpoints in main.js (createRealtimeClientSecret, the realtimeDefaults config). After this refactor, the realtime engine asks the provider registry "give me the provider with realtime capability" and uses its methods. Today that's always OpenAI, but the abstraction means a future provider with realtime support slots in without touching the engine.

## Steps
1. In `src/main.js`, replace the inline `createRealtimeClientSecret` function with a call to `registry.getForCapability('realtime').createRealtimeSession(options)`. Import the provider registry. Keep the existing function as a fallback if no realtime provider is registered (defensive).
2. Replace the hardcoded `realtimeDefaults` object with values from the realtime provider's config: `{ model: provider.getDefaultModel('realtime'), voice: settings.get('realtime.voice') || 'verse' }`.
3. Update the `openai:create-realtime-secret` IPC handler to use the provider method. Rename channel to `realtime:create-session` (old channel kept as deprecated alias for one version).
4. Update `src/preload.js` to expose `realtime:create-session` alongside the deprecated `openai:create-realtime-secret`.
5. Add fallback logic: if `registry.getForCapability('realtime')` returns null (no provider configured with realtime), return a structured error `{ error: 'NO_REALTIME_PROVIDER', message: 'Configure an OpenAI API key to use voice mode' }` instead of crashing.
6. Verify existing realtime flow still works end-to-end: voice session creates, tools dispatch, audio plays back. This is a refactor — behavior must be identical.

## Acceptance Criteria
- [x] `createRealtimeClientSecret` logic moved into `OpenAIProvider.createRealtimeSession()`
- [x] `realtimeDefaults` replaced with provider-sourced defaults
- [x] New IPC channel `realtime:create-session` works identically to old `openai:create-realtime-secret`
- [x] Old channel `openai:create-realtime-secret` still works (deprecated alias)
- [x] No realtime provider registered → structured error returned, no crash
- [x] All existing realtime tests still pass without modification
- [x] No direct `api.openai.com` calls remain in the main-process realtime session creation path

## Tests Required
- `test/realtime-provider-integration.test.js`:
  - Mock provider registry with OpenAI provider: verify `realtime:create-session` returns valid session config
  - Mock provider registry with no realtime provider: verify structured error response
  - Verify deprecated `openai:create-realtime-secret` channel still works
  - Verify provider-sourced defaults (model, voice) are used in session creation
  - Verify existing realtime tests in `test/` still pass (regression check)

## Outputs
- Updated `src/main.js` — realtime path uses provider layer
- Updated `src/preload.js` — new + deprecated IPC channels
- Updated `src/providers/openai-provider.js` — `getDefaultModel(capability)` helper
- `test/realtime-provider-integration.test.js` — integration tests
- Verification: `node --test test/realtime-provider-integration.test.js`, focused Wave 08 tests, full `npm run check`, and full `node --test`

## Interface Contracts
- **Renderer depends on:** `realtime:create-session` IPC channel for starting voice sessions
- **Phase 7 (text chat) depends on:** fallback logic returning NO_REALTIME_PROVIDER so the UI can show text-only mode
- **Existing tool dispatch depends on:** session config shape being unchanged (model, voice, session object)

## Handoff Notes
`realtime:create-session` and deprecated `openai:create-realtime-secret` now share the same main-process provider-backed session handler. The handler resolves the default realtime-capable provider, injects the stored OpenAI credential into a fresh OpenAI provider instance, and keeps the response shape consumed by the renderer (`{ value, expiresAt, raw }`). Missing credentials/provider returns `{ error: "NO_REALTIME_PROVIDER", message: "Configure an OpenAI API key to use voice mode" }`.

## Errors Encountered
None.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Realtime session creation fails after refactor | Error rate in realtime:create-session | Any increase vs. pre-refactor | Revert to direct call; debug provider path offline |
| Deprecated channel still heavily used | Call count on openai:create-realtime-secret | >0 after Phase 7 | Remove deprecated channel; update all renderer call sites |
| Voice quality regression | User-reported latency or audio issues | Any after this task | Compare network traces pre/post refactor; isolate provider overhead |
