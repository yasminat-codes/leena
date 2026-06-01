---
id: "073"
title: "Identity comprehensive test suite"
type: test
status: pending
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
attempts: 0
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

- [ ] `test/persona-engine.test.js` passes with ≥7 test cases covering all CRUD + edge cases
- [ ] `test/prompt-composition.test.js` passes with ≥5 test cases covering order, switching, backward compat
- [ ] Existing `test/agent-profile-store.test.js` still passes
- [ ] Existing `test/prompts.test.js` still passes
- [ ] Full `node --test` run: zero failures

## Tests Required

- `test/persona-engine.test.js` — new: full CRUD + persistence + seed migration
- `test/prompt-composition.test.js` — new: composition order + switching + backward compat
- `test/agent-profile-store.test.js` — verified or updated for backward compat
- `test/prompts.test.js` — verified still passes

## Outputs

- `test/persona-engine.test.js` — new
- `test/prompt-composition.test.js` — new
- `test/agent-profile-store.test.js` — possibly modified for new persona field

## Interface Contracts

- These tests validate the contract between PersonaEngine ↔ SettingsStore ↔ Prompts
- Mock provider from `test/helpers/mock-provider.js` (task 065) may be reused if prompt composition tests need memory mocks

## Handoff Notes

_Filled after completion._

## Errors Encountered

_Filled if errors occur._

## Self-Annealing Contract

| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Tests pass but miss real-world failure | Bug found in production that tests didn't catch | Any persona-related bug | Add regression test for the specific failure mode |
| Agent profile test fragile on shape | Test breaks every time profile shape changes | >2 breaks | Switch to partial assertion (assert subset of fields) |
| Prompt order test brittle | Test uses string indexOf positions | Breaks on whitespace change | Use section header detection instead of position math |
