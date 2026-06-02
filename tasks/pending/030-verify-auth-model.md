---
id: "030"
title: "R-1 BLOCKER: Verify auth model for second accounts"
type: research
status: pending
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
attempts: 0
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
- [ ] R-1 entry in `plans/risk-register.md` updated with test outcome and date
- [ ] Decision on primary auth path documented (OAuth primary or API-key primary)
- [ ] If FAILED/UNTESTED: ADR added to `plans/decision-log.md`

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
<!-- Filled after completion -->

## Errors Encountered
<!-- Filled if errors occur -->

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Auth assumption wrong | OAuth fails for 2nd account | 1 failure | Pivot all downstream tasks to API-key primary |
| Test skipped | UNTESTED status | Any | Default to safest path (API-key primary) |
| Decision not propagated | Tasks 031/037 don't reference outcome | Post-task check | Update dependent task context_files |
