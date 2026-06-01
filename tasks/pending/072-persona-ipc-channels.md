---
id: "072"
title: "Identity IPC channels"
type: feature
status: pending
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
attempts: 0
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

- [ ] 5 new IPC channels registered (list, switch, create, update, delete)
- [ ] `agent:get-profile` extended to include active persona
- [ ] `agent:set-profile` extended to accept personaId
- [ ] Preload bridge exposes `window.leena.identity.*`
- [ ] Delete default persona returns structured error
- [ ] All tests pass

## Tests Required

- `test/identity-ipc.test.js` — channel registration, method delegation, error handling, backward compatibility of agent profile channels

## Outputs

- `src/main.js` — modified (PersonaEngine init + IPC handlers)
- `src/preload.js` — modified (identity bridge methods)
- `test/identity-ipc.test.js` — new

## Interface Contracts

- Renderer settings screen (Phase 7 wire-up) reads personas via `identity:list-personas`
- Persona switching triggers prompt recomposition (task 071)
- Existing renderer code using `agent:get-profile` still works (backward compatible)

## Handoff Notes

_Filled after completion._

## Errors Encountered

_Filled if errors occur._

## Self-Annealing Contract

| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Existing agent:get-profile callers break | Test failure in agent-profile-store.test.js | Any failure | Ensure persona field is additive, not replacing existing fields |
| Persona switch doesn't trigger prompt update | Active persona changes but prompts don't reflect it | Any occurrence | Add event emission on switch that prompt system listens to |
| IPC channel naming inconsistent | Mix of agent: and identity: prefixes | User confusion | Document channel naming convention in IPC spec |
