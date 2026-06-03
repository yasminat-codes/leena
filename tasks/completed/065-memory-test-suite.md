---
id: "065"
title: "Memory comprehensive test suite"
type: test
status: completed
priority: high
complexity: M
estimated_tokens: 18000
dependencies: ["062", "064"]
context_files:
  - test/planner-store.test.js
  - src/memory/sqlite-memory-store.js
  - src/memory/memory-middleware.js
skills: []
tags: [phase-3, memory, testing]
attempts: 1
claim_started: "2026-06-03T08:05:33Z"
created_at: "2026-06-01"
---

## Objective

Write the comprehensive memory test suite covering the headline success criterion: a fact stated in session 1 is recalled in session 2. Includes unit tests for SQLite implementation, integration tests for cross-session recall, and consolidation correctness tests.

## Why This Matters

Memory is the highest-risk subsystem. Without thorough tests, silent regressions could make Leena forget — the single worst UX failure for a personal assistant. The cross-session integration test is the gold standard proving memory actually works end-to-end.

## Steps

1. Create `test/memory-cross-session.integration.test.js` using the `withTempDir` + `closeDatabase` pattern from existing tests. Test: (a) open store at path P, call `remember('User likes espresso', { conversationId: 'sess-1', role: 'user' })`, close DB. (b) Open fresh store at same path P, call `recall('coffee preference', 1)` — assert top result contains 'espresso'. (c) Verify episodic row count persists across open/close.
2. Create `test/memory-consolidation.test.js`: store 15 episodic entries from a mock conversation, call `consolidate()`, verify at least one semantic entry is created, verify `source_episode_ids` links back to episodic rows, verify consolidated fact is recallable.
3. Expand `test/memory-sqlite.test.js` (from task 062) with edge cases: recall on empty DB returns empty array (no crash), remember with empty embedding provider gracefully degrades, concurrent remember calls don't clobber, large content (10KB text) stores and retrieves correctly.
4. Create a mock provider helper `test/helpers/mock-provider.js` exporting a `createMockProviderRegistry()` that returns a registry with a fake embeddings provider (returns deterministic Float32Array based on input hash) and a fake chat provider (returns a fixed summary string). All memory tests use this — no real API calls.
5. Run `npm run check` and `node --test test/memory-*.test.js` — all pass, zero failures.

## Acceptance Criteria

- [x] Cross-session integration test passes: fact from session 1 recalled in session 2
- [x] Consolidation test passes: episodic → semantic pipeline produces valid facts
- [x] Edge cases covered: empty DB, no embeddings, concurrent writes, large content
- [x] Mock provider helper is reusable across all memory tests
- [x] No real API calls in any test (all providers mocked)
- [x] All existing tests still pass (`node --test`)

## Tests Required

- `test/memory-cross-session.integration.test.js` — the headline test
- `test/memory-consolidation.test.js` — episodic-to-semantic pipeline
- `test/memory-sqlite.test.js` — edge cases (expanded from task 062)
- `test/helpers/mock-provider.js` — shared mock helper

## Outputs

- `test/memory-cross-session.integration.test.js` — new
- `test/memory-consolidation.test.js` — new
- `test/memory-sqlite.test.js` — expanded
- `test/helpers/mock-provider.js` — new shared helper

## Interface Contracts

- Mock provider helper is used by all memory tests and potentially provider tests (task 056)
- Cross-session test validates the contract between SQLiteMemoryStore and the DB layer
- Consolidation test validates the contract between memory store and chat provider

## Handoff Notes

- Added `test/helpers/mock-provider.js` with deterministic mock chat and embedding providers.
- Added cross-session SQLite memory coverage proving `sess-1` espresso memory is recalled after closing and reopening the same DB path.
- Added consolidation coverage for 15 episodic rows producing recallable semantic facts with `source_episode_ids` linked back to every episode.
- Expanded SQLite store tests for empty recall, empty embedding provider fallback, concurrent `remember()` writes, and >10KB content round-trip.
- No production code changes were required; no additional file claims were needed.
- Verification passed: `node --check` on changed JS, `node --test test/memory-*.test.js`, `npm run check`, and full `node --test`.

## Errors Encountered

- None.

## Self-Annealing Contract

| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Cross-session test flaky | Test pass rate over 10 runs | <100% | Investigate DB connection leaks or temp dir cleanup |
| Mock provider too simplistic | Real provider behavior diverges from mock | Any real-world failure not caught by mock tests | Add targeted integration test with real provider (guarded by env var) |
| Consolidation test brittle | Test depends on exact prompt output | Breaks on prompt wording change | Assert on structure (fact count, linkage) not exact text |
