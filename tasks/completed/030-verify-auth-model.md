---
id: "030"
title: "R-1 BLOCKER: Verify auth model for second accounts"
type: research
status: completed
priority: critical
complexity: S
estimated_tokens: 5000
dependencies: []
context_files:
  - src/main.js
  - plans/risk-register.md
  - plans/auth-matrix.md
skills: []
tags: [phase-1, auth, blocker, r-1]
attempts: 1
claim_started: "2026-06-02T20:58:09Z"
completed_at: "2026-06-02T21:17:18Z"
created_at: "2026-06-01"
---

## Objective
Determine whether the existing ChatGPT OAuth flow (`clientId: app_EMoamEEZ73f0CkXaXp7hrann`) works for OpenAI accounts other than the registering account, and document the outcome to unblock all downstream auth work.

## Why This Matters
Every auth-related task (031, 037) depends on knowing whether OAuth is viable for distribution. If it fails, API-key becomes the sole path and onboarding simplifies. Blocking this wastes the entire Phase 1 timeline.

## Steps
1. Read `src/main.js` lines 69-77 to extract the full OAuth config (clientId, authorizeUrl, tokenUrl, scope, redirect).
2. In a separate browser profile or incognito, navigate to the OAuth authorize URL with all required params (client_id, response_type=code, redirect_uri, scope, code_challenge, code_challenge_method=S256).
3. Sign in with a second OpenAI account that has ChatGPT Plus. Observe whether the authorization page loads and completes the redirect to `http://localhost:1455/auth/callback`.
4. If redirect succeeds: exchange the auth code for tokens via POST to `tokenUrl`, then call `POST /v1/realtime/sessions` with the access token to verify a realtime client secret can be created.
5. Document the result in `plans/risk-register.md` under R-1: either "VERIFIED — OAuth works for second accounts" or "FAILED — reason". If testing is impossible (no second account available), document "UNTESTED — defaulting to API-key primary path."
6. If FAILED or UNTESTED: update `plans/decision-log.md` with a new ADR noting API-key is now the primary auth path, OAuth is optional/deprecated.

## Acceptance Criteria
- [x] R-1 entry in `plans/risk-register.md` updated with test outcome and date
- [x] Decision on primary auth path documented (OAuth primary or API-key primary)
- [x] If FAILED/UNTESTED: ADR added to `plans/decision-log.md`

## Tests Required
- No automated tests — this is a manual verification task
- Output is documentation, not code

## Outputs
- Updated `plans/risk-register.md` (R-1 status)
- Potentially updated `plans/decision-log.md` (new ADR)
- Auth path decision: `{primary: "api-key" | "oauth", fallback: "oauth" | "api-key" | null}`

## Interface Contracts
- Task 031 reads the auth path decision to know whether to implement API-key as primary or fallback
- Task 037 (onboarding) reads the decision to know which auth step to present first

## Handoff Notes
- Read `src/main.js` OAuth config: `clientId: app_EMoamEEZ73f0CkXaXp7hrann`, `authorizeUrl: https://auth.openai.com/oauth/authorize`, `tokenUrl: https://auth.openai.com/oauth/token`, `scope: openid profile email offline_access api.connectors.read api.connectors.invoke`, callback `http://localhost:1455/auth/callback`.
- kencode-search was called before edits, per mandate. It found public Codex-style OAuth examples using the same authorize host/client shape, but that does not verify this app's second-account distribution behavior.
- Could not complete manual second-account verification unattended because no second ChatGPT Plus account/session was available. Per task contract, documented R-1 as `UNTESTED` on 2026-06-02.
- Auth path decision is `{primary: "api-key", fallback: "oauth"}`.
- Updated `plans/risk-register.md` R-1, added ADR-9 to `plans/decision-log.md`, and updated `plans/auth-matrix.md` so Task 031 implements API-key auth as primary and Task 037 presents API-key onboarding first.

## Errors Encountered
- Manual OAuth verification could not be performed unattended without a second ChatGPT Plus account. This is recorded as `UNTESTED`, not `VERIFIED`.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Auth assumption wrong | OAuth fails for 2nd account | 1 failure | Pivot all downstream tasks to API-key primary |
| Test skipped | UNTESTED status | Any | Default to safest path (API-key primary) |
| Decision not propagated | Tasks 031/037 don't reference outcome | Post-task check | Update dependent task context_files |
