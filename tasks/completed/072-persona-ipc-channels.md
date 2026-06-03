---
id: "072"
title: "Identity IPC channels"
type: feature
status: completed
priority: medium
complexity: S
estimated_tokens: 10000
dependencies: ["070"]
context_files:
  - src/main.js
  - src/preload.js
  - src/identity/persona-engine.js
skills: []
tags: [phase-4, identity, ipc]
attempts: 1
claim_started: "2026-06-03T04:02:39Z"
completed_at: "2026-06-03T04:24:04Z"
created_at: "2026-06-01"
---

## Objective

Wire the PersonaEngine into Electron's IPC layer, extending the existing `agent:get-profile` / `agent:set-profile` channels and adding new identity-specific channels for persona CRUD and switching.

## Why This Matters

The renderer needs to display persona options in the settings UI, let users create/edit personas, and trigger mid-session persona switches. Without IPC channels, the persona engine is invisible to the frontend. Extending existing agent profile channels maintains backward compatibility with current renderer code.

## Steps

1. In `src/main.js`, import `PersonaEngine` and instantiate during app initialization (after settings store is ready from task 038). Pass `{ settingsStore }`.
2. Extend `agent:get-profile` handler to include `persona: personaEngine.getActive()` in the returned profile object alongside existing name, goals, about, voice fields.
3. Extend `agent:set-profile` handler to accept optional `personaId` field — if provided, call `personaEngine.setActive(personaId)`.
4. Register new IPC handlers: `identity:list-personas` (invoke — returns all personas), `identity:switch-persona` (invoke — takes `{ personaId }`, returns new active persona), `identity:create-persona` (invoke — takes persona data, returns created persona), `identity:update-persona` (invoke — takes `{ id, changes }`, returns updated persona), `identity:delete-persona` (invoke — takes `{ id }`, returns success/error).
5. In `src/preload.js`, add to contextBridge: `identity: { listPersonas(), switchPersona(id), createPersona(data), updatePersona(id, changes), deletePersona(id) }` — each wrapping `ipcRenderer.invoke('identity:...')`.
6. Write `test/identity-ipc.test.js`: verify all 5 new channels call correct PersonaEngine methods, verify extended agent:get-profile includes persona, verify delete-default returns error.

## Acceptance Criteria

- [x] 5 new IPC channels registered by standalone `registerIdentityHandlers`
- [x] Agent profile adapter exposes `personaId` and full `activePersona`
- [x] Agent profile adapter accepts `personaId` and legacy `persona` id strings
- [x] Preload bridge exposes `window.leena.identity.*`
- [x] Delete default persona returns structured error
- [x] All tests pass

## Tests Required

- `test/identity-ipc.test.js` — channel registration, method delegation, error handling, backward compatibility of agent profile channels

## Outputs

- `src/ipc/identity-handlers.js` — new standalone identity IPC module plus agent-profile adapter helpers
- `test/identity-ipc.test.js` — new focused coverage for registration, delegation, structured errors, and profile compatibility
- `src/main.js` — parent integration registers identity handlers and profile adapters
- `src/preload.js` — parent integration exposes `window.leena.identity.*`

## Interface Contracts

- Renderer settings screen (Phase 7 wire-up) reads personas via `identity:list-personas`
- Persona switching triggers prompt recomposition (task 071)
- Existing renderer code using `agent:get-profile` still works (backward compatible)

## Handoff Notes

- Parent main-process integration should instantiate `PersonaEngine` with the settings store, then call `registerIdentityHandlers({ ipcMain, personaEngine })`.
- Parent should replace the current direct `agent:get-profile` / `agent:set-profile` handlers with `createAgentProfileIdentityAdapters({ personaEngine, loadAgentProfile, saveAgentProfile })`.
- Profile adapter behavior is intentionally backward compatible for current renderer callers: `profile.persona` stays a string id, `profile.personaId` mirrors the active id, and `profile.activePersona` carries the full PersonaEngine record.
- Parent preload integration should add `window.leena.identity.{ listPersonas, switchPersona, createPersona, updatePersona, deletePersona }` wrappers around the five `identity:*` channels.
- `identity:delete-persona` returns `{ ok: true, id, deleted }` on success and `{ ok: false, id, error }` on failure. Default deletion uses error code `IDENTITY_DEFAULT_PERSONA_PROTECTED`.
- Parent integration complete: `src/main.js` now registers identity handlers and adapts `agent:get-profile` / `agent:set-profile`; `src/preload.js` exposes the identity bridge; `test/wave12-integration.test.js` pins both contracts.

## Errors Encountered

- Early worker gates saw concurrent Wave 12 renderer edits. Parent verification later passed full `npm run check` plus `node --test`.
- Initial patch was accidentally applied to the primary checkout by the patch tool default path; the two untracked files were removed immediately and verified absent from the primary checkout.

## Self-Annealing Contract

| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Existing agent:get-profile callers break | Test failure in agent-profile-store.test.js | Any failure | Ensure persona field is additive, not replacing existing fields |
| Persona switch doesn't trigger prompt update | Active persona changes but prompts don't reflect it | Any occurrence | Add event emission on switch that prompt system listens to |
| IPC channel naming inconsistent | Mix of agent: and identity: prefixes | User confusion | Document channel naming convention in IPC spec |
