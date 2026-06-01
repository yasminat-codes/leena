---
id: "031"
title: "Implement API key authentication path"
type: feature
status: pending
priority: critical
complexity: M
estimated_tokens: 15000
dependencies: ["030"]
context_files:
  - src/main.js
  - src/preload.js
  - plans/auth-matrix.md
  - plans/env-secrets.md
skills: []
tags: [phase-1, auth, api-key]
attempts: 0
created_at: "2026-06-01"
---

## Objective
Add an API-key authentication path so users can paste an OpenAI API key instead of (or in addition to) using the ChatGPT OAuth flow, storing it securely via Electron safeStorage.

## Why This Matters
R-1 may make OAuth unusable for non-owner accounts. Even if OAuth works, ADR-7 mandates an API-key path for users who prefer direct keys. This unblocks onboarding (037) and all realtime session creation for distributed builds.

## Steps
1. In `src/main.js`, locate the `saveOpenAICredentials` / `getFreshOpenAICredentials` / `createRealtimeClientSecret` functions. Understand the current credential shape stored via safeStorage.
2. Add a new IPC handler `openai:save-api-key` that accepts `{ apiKey: string }`, validates it's non-empty, and calls `saveOpenAICredentials` with a synthetic credential object: `{ accessToken: apiKey, refreshToken: null, expiresAt: Infinity }`.
3. Modify `getFreshOpenAICredentials` to detect the API-key case: when `refreshToken === null` and `expiresAt === Infinity` (or `expiresAt > Date.now() + 86400000 * 365`), skip the token refresh cycle entirely and return the stored credentials as-is.
4. Verify `createRealtimeClientSecret` works unchanged — it already passes `Authorization: Bearer ${accessToken}` which accepts both OAuth tokens and API keys.
5. Add a new IPC handler `openai:get-auth-type` that returns `"oauth" | "api-key" | "none"` by inspecting the stored credentials shape (refreshToken null = api-key, refreshToken present = oauth, no creds = none).
6. Expose `saveApiKey` and `getAuthType` in `src/preload.js` under `window.brah` (will become `window.leena` after rename task 032).
7. Write tests in `test/auth-paths.test.js`: (a) API key round-trip via synthetic credentials, (b) getFreshOpenAICredentials skips refresh for API key shape, (c) getAuthType returns correct type for each case.

## Acceptance Criteria
- [ ] `openai:save-api-key` IPC handler stores key via safeStorage
- [ ] `getFreshOpenAICredentials` returns stored key without refresh when refreshToken is null
- [ ] `createRealtimeClientSecret` succeeds with an API key (manual verification with real key)
- [ ] `openai:get-auth-type` returns correct auth type for oauth, api-key, and none states
- [ ] Preload exposes `saveApiKey` and `getAuthType`
- [ ] `test/auth-paths.test.js` passes with all 3 test cases

## Tests Required
- `test/auth-paths.test.js` — synthetic credential storage, refresh skip logic, auth type detection
- Manual: paste a real API key → create realtime session → verify voice works

## Outputs
- Modified `src/main.js` — new IPC handlers, modified getFreshOpenAICredentials
- Modified `src/preload.js` — new API surface
- New `test/auth-paths.test.js`

## Interface Contracts
- Task 032 (rename): will rename `window.brah.saveApiKey` → `window.leena.saveApiKey`
- Task 037 (onboarding): uses `saveApiKey` and `getAuthType` to present correct auth step
- Task 038 (settings): uses `getAuthType` to show current auth method in settings

## Handoff Notes
<!-- Filled after completion -->

## Errors Encountered
<!-- Filled if errors occur -->

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| API key rejected by realtime endpoint | HTTP 401 from /v1/realtime/sessions | 1 occurrence | Check key format, verify endpoint accepts API keys |
| Refresh logic still runs for API keys | getFreshOpenAICredentials makes HTTP call when refreshToken is null | Any | Guard condition not working, fix null check |
| safeStorage unavailable | Encryption fails on some systems | 1 occurrence | Add plaintext fallback with warning |
