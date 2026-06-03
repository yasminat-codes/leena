---
id: "070"
title: "Persona engine core"
type: feature
status: completed
priority: medium
complexity: M
estimated_tokens: 14000
dependencies: ["038"]
context_files:
  - src/realtime/prompts.js
  - src/realtime/tools/database.js
skills: []
tags: [phase-4, identity, persona]
attempts: 1
claim_started: "2026-06-03T02:05:04Z"
completed_at: "2026-06-03T02:27:57Z"
created_at: "2026-06-01"
---

## Objective

Create the persona engine that manages named personality profiles (tone, instructions, voice preference, response style) with a default "Leena" persona, replacing the current hardcoded `AGENT_PERSONAS` object in `prompts.js`.

## Why This Matters

The current persona system is a frozen object with 5 hardcoded entries (default, therapist, explainer, coach, honest). Users can't create custom personas, personas aren't persisted, and the system is tightly coupled to `prompts.js`. The persona engine decouples identity from prompts, makes personas persistent and user-extensible, and enables mid-session persona switching.

## Steps

1. Create `src/identity/persona-engine.js` exporting a `PersonaEngine` class. Constructor takes `{ settingsStore }` (from task 038). Define the Persona type: `{ id, name, tone, instructions, systemPrompt, voicePreference, responseStyle, isDefault, createdAt }`.
2. Implement `getAll()` → loads all personas from settings store (key: `personas`, stored as JSON array). Returns default "Leena" persona plus any user-created ones. The default Leena persona has: name "Leena", tone "warm, direct, conversational", voicePreference "marin", responseStyle "concise".
3. Implement `getActive()` → returns the currently active persona (stored as `active_persona_id` in settings). Falls back to default Leena persona if not set.
4. Implement `setActive(personaId)` → validates persona exists, updates `active_persona_id` in settings. Returns the newly active persona.
5. Implement `create(personaData)` → validates required fields (name, tone), generates id from slugified name, appends to stored personas array. Implement `update(id, changes)` and `delete(id)` (cannot delete default).
6. Migrate existing `AGENT_PERSONAS` from `prompts.js` to seed data: on first run (no personas in settings), create default Leena + therapist + explainer + coach + honest as initial personas. Mark AGENT_PERSONAS in prompts.js as deprecated with a comment pointing to persona-engine.
7. Write `test/persona-engine.test.js`: CRUD operations, default persona always exists, delete default fails, getActive fallback, migration from AGENT_PERSONAS seeds.

## Acceptance Criteria

- [x] PersonaEngine class with full CRUD (getAll, getActive, setActive, create, update, delete)
- [x] Default "Leena" persona always exists and cannot be deleted
- [x] Existing 5 personas migrated as seed data on first run
- [x] Personas persisted via settings store (survives restart)
- [x] `AGENT_PERSONAS` in prompts.js marked deprecated
- [x] Tests pass for all CRUD operations and edge cases

## Tests Required

- `test/persona-engine.test.js` — CRUD, default protection, seed migration, persistence round-trip, active persona switching

## Outputs

- `src/identity/persona-engine.js` — new
- `src/realtime/prompts.js` — modified (deprecation comment on AGENT_PERSONAS)
- `test/persona-engine.test.js` — new

## Interface Contracts

- Task 071 (prompt composition) reads active persona via `getActive()`
- Task 072 (IPC channels) exposes persona engine methods to renderer
- Task 038 (settings store) must be complete — persona engine depends on it for persistence
- Prompt composition (task 071) replaces direct AGENT_PERSONAS usage with persona engine calls

## Handoff Notes

- Added `src/identity/persona-engine.js` with `PersonaEngine`, `DEFAULT_LEENA_PERSONA`, `PERSONAS_SETTING_KEY`, `ACTIVE_PERSONA_ID_SETTING_KEY`, and first-run seed migration from legacy `AGENT_PERSONAS`.
- Persistence uses task 038 settings-store semantics: `personas` is a JSON array and `active_persona_id` is a string setting. The engine defaults to `src/settings-store.js`, while tests inject a temp-DB-bound store wrapper.
- Task 071 should compose the active persona from `engine.getActive()`. Use `persona.systemPrompt` for legacy migrated personas, falling back to `persona.instructions`/`tone` for custom personas.
- Task 072 can expose `getAll`, `getActive`, `setActive`, `create`, `update`, and `delete` through IPC. Default Leena update/delete both throw; custom delete resets active persona to default if needed.
- `AGENT_PERSONAS` remains exported only as deprecated seed/legacy prompt data until task 071 removes direct prompt composition usage.
- Verification passed: `npm run check`, `node --test` (382/382), `node --check src/identity/persona-engine.js`, `node --check test/persona-engine.test.js`, `node --check src/realtime/prompts.js`, `node --test test/persona-engine.test.js`, and `git diff --check`.

## Errors Encountered

- Caught an `apply_patch` checkout-path mistake before implementation edits and removed only the accidental primary-checkout task-070 claim rows. Final implementation changes are in the requested wave worktree.

## Self-Annealing Contract

| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Default persona deleted or corrupted | getActive() returns undefined | Any occurrence | Re-seed default on startup if missing |
| Persona count explodes | Number of stored personas | >50 | Add creation limit or archival |
| AGENT_PERSONAS still used directly | grep for AGENT_PERSONAS in non-deprecated code | >0 hits outside prompts.js | Refactor caller to use persona engine |
