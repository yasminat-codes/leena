---
id: "112"
title: "End-to-end integration test suite"
type: test
status: completed
priority: critical
complexity: L
estimated_tokens: 22000
dependencies: ["100", "101", "103", "104", "106"]
context_files:
  - test/
  - src/providers/index.js
  - src/memory/sqlite-memory-store.js
  - src/mcp/client-manager.js
skills: []
tags: [phase-7, testing, integration, e2e]
attempts: 1
claim_started: "2026-06-03T08:05:33Z"
created_at: "2026-06-01"
---

## Objective
Write the final end-to-end integration test suite verifying that all subsystems work together: provider switching, cross-session memory recall, MCP server connectivity, and settings persistence across restarts.

## Why This Matters
Unit tests verify pieces; integration tests verify the product works. These tests are the last gate before the .dmg ships — they catch wiring bugs that unit tests miss.

## Steps
1. Create `test/e2e-provider-switching.test.js`: register mock OpenAI + OpenRouter providers → switch default chat provider via settings → send a chat message → verify it routes to the new provider (mock HTTP verifies correct endpoint hit).
2. Create `test/e2e-memory-recall.test.js`: open memory store at temp path → remember "user likes espresso" in session 1 → close store → re-open at same path → recall("coffee preference") → assert top result contains "espresso".
3. Create `test/e2e-mcp-connect.test.js`: start a mock MCP server (HTTP) → add server config → connect → list tools → verify tools appear in merged tool list → disconnect → verify tools removed.
4. Create `test/e2e-settings-persistence.test.js`: set theme, provider, hotkey via settings store → close store → re-open → verify all values persisted correctly.
5. Run full test suite (`npm test`) — verify zero failures across all existing + new tests (regression check).
6. Document any flaky tests found during the full run — add retry or fix root cause.

## Acceptance Criteria
- [x] Provider switching test passes — chat routes to correct provider after switch
- [x] Memory recall test passes — cross-session recall works
- [x] MCP connect test passes — tools appear/disappear on connect/disconnect
- [x] Settings persistence test passes — all value types round-trip correctly
- [x] Full `npm test` passes with zero failures
- [x] No flaky tests remain (or are documented with skip annotation + reason)

## Tests Required
- `test/e2e-provider-switching.test.js`
- `test/e2e-memory-recall.test.js`
- `test/e2e-mcp-connect.test.js`
- `test/e2e-settings-persistence.test.js`

## Outputs
- 4 new test files in `test/`
- Updated `npm test` results showing all green

## Interface Contracts
- Depends on provider layer (tasks 050-056)
- Depends on memory store (tasks 060-065)
- Depends on MCP client (tasks 080-087)
- Depends on settings store (task 038)
- This is a terminal task — validates all others

## Handoff Notes
Added all four required e2e test files:
- `test/e2e-provider-switching.test.js` verifies chat IPC uses the configured default provider after switching from OpenAI to OpenRouter, with fetch mocks asserting the correct chat-completions endpoints.
- `test/e2e-memory-recall.test.js` verifies SQLite memory recall survives closing and reopening the same temp database with deterministic embedding mocks.
- `test/e2e-mcp-connect.test.js` starts a local mock HTTP MCP server, persists the server config, connects through `MCPClientManager`, verifies merged namespaced tools, disconnects, and verifies removal.
- `test/e2e-settings-persistence.test.js` verifies theme, default provider, hotkey, and protected provider secret persistence across database reopen.

Kencode-search queries used before writing code:
- `node:test createServer await new Promise server.listen` (no results)
- `import { test } from 'node:test'` (returned examples)

Verification run:
- `node --check` on all four new e2e JS files: passed.
- `biome check` on the four new e2e files: passed.
- Focused `node --test` for the four new e2e files: passed, 4/4.
- Final combined Wave 14 gates passed after all workers completed: `npm run check`, `node --test` (515/515), `npm test`, changed-file `node --check`, WAL parse, and `git diff --check`.

## Errors Encountered
- Initial focused memory test required two recall results; the implementation correctly filters zero-similarity memories, so the assertion was tightened to require the espresso memory as the top result.
- Concurrent task 071, 107, and 109 edits briefly blocked full `npm run check`/`npm test` while those files were still mid-patch. No task 112 code changes were required; combined Wave 14 gates passed after all workers completed.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Flaky test in CI-like environment | intermittent failure | 2 failures in 10 runs | Add retry logic or increase timeouts; investigate race condition |
| Test passes alone but fails in suite | test isolation issue | 1 occurrence | Verify temp dirs are unique; check for shared state leaks |
| Memory recall test fails with embedding mismatch | cosine similarity too low | score < 0.5 | Verify embedding model consistency between store and recall |
