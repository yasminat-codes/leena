---
id: "001"
title: "Retry with exponential backoff utility"
type: infrastructure
status: completed
priority: critical
complexity: S
estimated_tokens: 7000
dependencies: ["000"]
context_files:
  - src/utils/errors.js
skills: []
tags: [infrastructure, retry, resilience]
attempts: 2
claim_started: "2026-06-02T00:13:31Z"
completed_at: "2026-06-02T00:28:53Z"
created_at: "2026-06-01"
---

## Objective

Create a `withRetry` utility that wraps any async function with configurable exponential backoff, jitter, and abort support — used by every provider and MCP client for transient failure recovery.

## Why This Matters

OpenAI, OpenRouter, and Ollama APIs all experience transient failures (network blips, 429 rate limits, 502/503 errors). Without retry logic, a single dropped packet kills a voice session or memory write. Building this before provider tasks means every API call gets retry for free.

## Steps

1. Create `src/utils/retry.js` exporting `withRetry(fn, options)` where `options` = `{ maxAttempts: 3, baseDelay: 1000, maxDelay: 30000, backoff: 'exponential', jitter: true, retryOn: (error) => boolean, signal: AbortSignal | null }`. Returns the result of `fn()` on success or throws `RetryExhaustedError` (from `src/utils/errors.js`) wrapping the last error after all attempts fail.
2. Implement exponential backoff: delay = `min(baseDelay * 2^attempt, maxDelay)` with optional jitter (±25% randomization). Respect `signal` — if aborted between retries, throw `AbortError` immediately without further attempts.
3. Default `retryOn` predicate: retry on network errors (`ECONNRESET`, `ECONNREFUSED`, `ETIMEDOUT`, `EPIPE`, `fetch` network errors), HTTP 429 (rate limit — respect `Retry-After` header if present in error), HTTP 500/502/503/504. Do NOT retry on 400/401/403/404 (client errors are not transient).
4. Add a convenience export `withRetryDefaults` that returns `withRetry` pre-bound with `{ maxAttempts: 3, baseDelay: 1000, maxDelay: 30000, backoff: 'exponential', jitter: true }` — one-liner usage for provider calls.
5. Write `test/retry.test.js` covering: (a) succeeds on first try — no delay, (b) succeeds on retry after transient failure, (c) throws `RetryExhaustedError` after max attempts with correct `attempts` and `lastError`, (d) respects `retryOn` predicate (skips retry for 401), (e) respects `AbortSignal` mid-retry, (f) backoff delays increase exponentially (mock timers).

## Acceptance Criteria

- [ ] `withRetry` and `withRetryDefaults` exported from `src/utils/retry.js`
- [ ] Exponential backoff with jitter implemented correctly
- [ ] `RetryExhaustedError` thrown after all attempts, wrapping last error with `attempts` count
- [ ] AbortSignal support — aborts between retries without additional attempts
- [ ] Default predicate retries 429/5xx/network errors, skips 4xx client errors
- [ ] `test/retry.test.js` passes with `node --test`
- [ ] `npm run check` passes

## Tests Required

- `test/retry.test.js`
  - First-try success: fn called once, result returned, no delay
  - Retry on transient: fn fails twice with ECONNRESET then succeeds — result returned
  - Exhaustion: fn fails 3 times — throws `RetryExhaustedError` with `.attempts === 3` and `.lastError` set
  - Predicate skip: fn throws 401 error — `RetryExhaustedError` thrown after 1 attempt (no retry)
  - AbortSignal: signal aborted after first failure — throws AbortError, fn not called again
  - Backoff timing: with mock timers, verify delay between attempt 1→2 is ~baseDelay, 2→3 is ~baseDelay*2

## Outputs

- `src/utils/retry.js` — retry utility with exponential backoff
- `test/retry.test.js` — test suite

## Interface Contracts

- `withRetry` used by: `openai-provider.js`, `openrouter-provider.js`, `ollama-provider.js` for all API calls
- `withRetry` used by: MCP client for server connection and tool invocation
- `RetryExhaustedError` from task 000 — this task consumes it; downstream tasks catch it for fallback decisions
- `withRetryDefaults` is the recommended one-liner for typical API wrapping

## Handoff Notes

- Added `src/utils/retry.js` with `withRetry` and `withRetryDefaults`.
- Default retry detection covers common network error codes, fetch network `TypeError`s, HTTP 429, and HTTP 500/502/503/504 while skipping client-error statuses without retrying.
- Non-retryable failures still resolve through the retry contract by throwing `RetryExhaustedError` with `attempts: 1` and `lastError` set; aborts continue to throw `AbortError` directly.
- `Retry-After` is honored for HTTP 429, with numeric seconds and HTTP-date support capped by `maxDelay`.
- Verified independently with `npm run check`, `node --test` (134 tests in the task branch), and `node --check` on changed JS files.

## Errors Encountered

- Independent verification found that the first implementation rethrew non-retryable HTTP 401 errors directly. Fixed by wrapping skipped retries in `RetryExhaustedError` and adding focused test coverage.

## Self-Annealing Contract

| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Retry not wrapping API calls | `grep -r "withRetry\|withRetryDefaults" src/providers/ src/mcp/ \| wc -l` | < 3 after provider tasks complete | Audit provider implementations for bare fetch/axios calls |
| RetryExhaustedError not caught | Uncaught `RetryExhaustedError` in diagnostics log | > 0 after Wave 3 | Add catch handler in calling module |
| Rate limit 429 still crashing sessions | 429 errors in diagnostics without retry | > 0 in any session | Verify retryOn predicate matches actual error shape from provider SDK |
