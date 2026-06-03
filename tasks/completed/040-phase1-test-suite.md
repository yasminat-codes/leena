---
id: "040"
title: "Phase 1 comprehensive test suite"
type: test
status: completed
priority: high
complexity: M
estimated_tokens: 16000
dependencies: ["031", "032", "036", "038"]
context_files:
  - test/
  - src/main.js
  - src/settings-store.js
  - src/realtime/tools/database.js
skills: []
tags: [phase-1, testing, quality-gate]
attempts: 1
claim_started: "2026-06-03T04:02:39Z"
completed_at: "2026-06-03T04:24:04Z"
created_at: "2026-06-01"
---

## Objective
Write and run the comprehensive test suite for all Phase 1 features — settings store round-trips, API key auth paths, database rename migration, and hotkey registration — ensuring all quality gates pass before Phase 1 is marked complete.

## Why This Matters
Phase 1 changes foundational systems (auth, naming, database, settings). Regressions here cascade into every subsequent phase. This task is the phase exit gate — nothing proceeds until all tests pass.

## Steps
1. Write `test/settings-store.test.js` if not already created by task 038: test getString/getBool/getNumber/getJSON round-trips, default values, overwrite, delete, getAllSettings. Use `withTempDir` pattern from existing test suites.
2. Write `test/auth-paths.test.js` if not already created by task 031: test API key storage via synthetic credential object, getFreshOpenAICredentials skip-refresh for API key shape, getAuthType returns correct type for oauth/api-key/none.
3. Write `test/rename-migration.test.js` if not already created by task 032: create a temp directory, write a `brah.db` file with a known table and rows, open the database module pointing to that directory, verify it auto-renames to `lena.db` and all data is intact.
4. Write `test/hotkey.test.js` if not already created by task 036: mock `globalShortcut.register`/`unregister`, verify registration with default accelerator, verify change-shortcut flow, verify conflict detection returns error.
5. Run `npm run check` — verify zero Biome errors/warnings across all new and modified files.
6. Run `node --test` — verify all tests pass (zero failures, zero skipped without explicit skip annotation).
7. Run `node --test 2>&1 | grep -E "(pass|fail|skip)"` and document the results count in this task's Outputs section.

## Acceptance Criteria
- [x] `test/settings-store.test.js` exists and passes (≥6 test cases)
- [x] `test/auth-paths.test.js` exists and passes (≥3 test cases)
- [x] `test/rename-migration.test.js` exists and passes (≥2 test cases)
- [x] `test/hotkey.test.js` exists and passes (≥3 test cases)
- [x] `npm run check` exits 0 (zero Biome errors)
- [x] `node --test` exits 0 (zero failures)
- [x] No existing tests broken by Phase 1 changes

## Tests Required
- This IS the test task — it writes and verifies all Phase 1 tests across these 4 files:
  - `test/settings-store.test.js` — settings round-trips (string/bool/number/json), defaults, overwrite, delete
  - `test/auth-paths.test.js` — API-key storage, skip-refresh for API-key shape, getAuthType
  - `test/rename-migration.test.js` — brah.db → lena.db auto-migration with data intact
  - `test/hotkey.test.js` — globalShortcut register/unregister/change/conflict
- Total: ≥14 test cases across the 4 files; all run under `node --test`, zero failures.

## Outputs
- Verified existing Phase 1 test files without duplicating coverage:
  - `test/settings-store.test.js`: 8 tests (contract requires >=6)
  - `test/auth-paths.test.js`: 5 tests (contract requires >=3)
  - `test/rename-migration.test.js`: 3 tests (contract requires >=2)
  - `test/hotkey.test.js`: 8 tests (contract requires >=3)
- Focused gate: `node --test test/settings-store.test.js test/auth-paths.test.js test/rename-migration.test.js test/hotkey.test.js` -> 24 tests, 24 pass, 0 fail, 0 skipped.
- Quality gate: `npm run check` -> passed; Biome checked 139 files with no fixes applied.
- Full gate: `node --test` -> 400 tests, 400 pass, 0 fail, 0 skipped.
- Requested summary: `node --test 2>&1 | grep -E "(pass|fail|skip)"` -> pass 400, fail 0, skipped 0.

## Interface Contracts
- Phase 1 exit gate: all tests must pass before any Phase 2+ work begins
- Test patterns established here (withTempDir, mock IPC, mock Electron APIs) reused in all subsequent phases

## Handoff Notes
- No source changes were required; the claimed test files already exceeded the required coverage counts after local context review.
- Restored missing local dependencies with `npm ci` because the initial check could not find the local `biome` binary. `package.json` and `package-lock.json` were not changed.
- Phase 1 test gate is green in the Wave 12 worktree.

## Errors Encountered
- Initial `npm run check` failed before dependency restore with `sh: biome: command not found`; reran after `npm ci` and it passed.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Tests pass but don't assert | Test file has no assert calls | Any | Review test bodies, add real assertions |
| Existing tests broken | Pre-existing test failures after Phase 1 | Any | Fix Phase 1 code (not the tests) — regression |
| Flaky test | Same test fails intermittently | 2 occurrences | Fix timing/temp-dir cleanup issue |
