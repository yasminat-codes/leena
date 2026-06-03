---
id: "073"
title: "Identity comprehensive test suite"
type: test
status: completed
priority: medium
complexity: S
estimated_tokens: 10000
dependencies: ["070", "071", "072"]
context_files:
  - test/prompts.test.js
  - test/agent-profile-store.test.js
  - src/identity/persona-engine.js
skills: []
tags: [phase-4, identity, testing]
attempts: 1
claim_started: "2026-06-03T10:05:06Z"
completed_at: "2026-06-03T10:18:35Z"
created_at: "2026-06-01"
---

## Objective

Write the comprehensive identity test suite covering persona engine CRUD, prompt composition with personas, and IPC channel integration — ensuring the identity subsystem is fully exercised and existing agent profile tests still pass.

## Why This Matters

The identity system changes the core prompt pipeline — the most sensitive path in the entire app. Any regression here means Leena's personality breaks, the voice changes unexpectedly, or personas are lost. Comprehensive tests prevent silent breakage when future tasks modify prompts or settings.

## Steps

1. Create `test/persona-engine.test.js`: (a) default Leena persona exists on fresh init, (b) CRUD cycle — create persona, read back, update tone, delete, (c) cannot delete default persona, (d) getActive returns default when no active set, (e) setActive switches and persists, (f) seed migration creates 5 initial personas from legacy AGENT_PERSONAS, (g) persistence round-trip — create, close settings store, reopen, personas still there.
2. Create `test/prompt-composition.test.js`: (a) buildAgentInstructionsFromPersona with custom persona includes persona.tone in output, (b) prompt section order is persona → memory → tools → base → runtime (check string positions), (c) buildPersonaSwitchDelta returns only changed sections between two personas, (d) backward compat — buildAgentInstructions without persona engine still produces valid output, (e) voice preference from persona overrides profile default.
3. Verify `test/agent-profile-store.test.js` still passes — the extended agent:get-profile must not break existing test expectations. If tests check exact object shape, update them to tolerate the new `persona` field.
4. Run full test suite: `node --test` — zero failures across all test files.
5. Run `npm run check` — zero Biome errors.

## Acceptance Criteria

- [x] `test/persona-engine.test.js` passes with ≥7 test cases covering all CRUD + edge cases
- [x] Prompt-composition coverage passes with ≥5 test cases covering order, switching, backward compat
- [x] Existing `test/agent-profile-store.test.js` still passes
- [x] Existing `test/prompts.test.js` still passes
- [x] Full `node --test` run: zero failures

## Tests Required

- `test/persona-engine.test.js` — full CRUD + persistence + seed migration + edge-case coverage
- `test/prompts.test.js` — existing prompt-composition suite for composition order, switching, backward compat, and voice preference
- `test/identity-ipc.test.js` — verified IPC integration coverage
- `test/agent-profile-store.test.js` — verified backward compat

## Outputs

- `test/persona-engine.test.js` — completed 7-case PersonaEngine suite covering seed/default behavior, CRUD persistence, active switching and stale fallback, default protection, stored-record repair/deduplication/clone isolation, and validation failures.
- `test/prompts.test.js` — verified as the existing prompt-composition suite; it already covers persona tone, persona/memory/tool/base/runtime ordering, persona switch delta, backward compatibility, memory untrusted-data handling, and voice preference behavior.
- `test/identity-ipc.test.js` — verified existing IPC coverage for list/switch/create/update/delete, profile adapters, change notifications, and structured default-delete errors.
- `test/agent-profile-store.test.js` — verified existing agent-profile persistence coverage still passes.

## Interface Contracts

- PersonaEngine stores normalized JSON personas in SettingsStore and returns cloned records so external mutation cannot leak back into persistence.
- Missing, malformed, duplicate, or reordered stored persona records are repaired into a default-first persona list.
- Stale active persona ids fall back to the default Leena persona without breaking reads.
- Prompt composition coverage remains in `test/prompts.test.js`; no duplicate `test/prompt-composition.test.js` was needed because the existing suite owns the prompt contract.

## Handoff Notes

- Ran kencode-search before code edits with queries `buildRealtimeInstructions` and `PersonaEngine`.
- Added two targeted PersonaEngine edge-case tests instead of duplicating prompt tests already present on `origin/main`.
- Focused gate: `node --test test/persona-engine.test.js` passed 7/7.
- Syntax gate: `node --check test/persona-engine.test.js` passed.
- Full gates: `npm run check` passed; `node --test` passed 527/527.

## Errors Encountered

- Initial `npm run check` failed on one Biome formatting preference in the new clone-isolation assertion; reformatted it and reran green.

## Self-Annealing Contract

| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Tests pass but miss real-world failure | Bug found in production that tests didn't catch | Any persona-related bug | Add regression test for the specific failure mode |
| Agent profile test fragile on shape | Test breaks every time profile shape changes | >2 breaks | Switch to partial assertion (assert subset of fields) |
| Prompt order test brittle | Test uses string indexOf positions | Breaks on whitespace change | Use section header detection instead of position math |
