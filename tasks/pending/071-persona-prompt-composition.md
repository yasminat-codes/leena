---
id: "071"
title: "Persona-aware prompt composition"
type: feature
status: pending
priority: medium
complexity: M
estimated_tokens: 15000
dependencies: ["070", "064"]
context_files:
  - src/realtime/prompts.js
  - src/identity/persona-engine.js
  - src/memory/memory-middleware.js
skills: []
tags: [phase-4, identity, prompts]
attempts: 0
created_at: "2026-06-01"
---

## Objective

Refactor `buildRealtimeInstructions()` to compose prompts from persona + memory + tool context with a defined priority order, and support mid-session persona switching by updating the realtime session config.

## Why This Matters

Currently `buildRealtimeInstructions` concatenates static instructions + persona string + profile context + runtime context. With memory (task 064) and a full persona engine (task 070), the composition needs a clear priority hierarchy and the ability to hot-swap personas without restarting the voice session. This is where Leena's personality becomes dynamic and contextual.

## Steps

1. Refactor `buildRealtimeInstructions()` to accept `{ profile, memories, persona, tools }` and compose in priority order: (1) persona.systemPrompt + persona.tone instructions, (2) memory context section (from task 064), (3) tool context (available tool descriptions), (4) base static instructions (trimmed — remove personality bits now handled by persona), (5) runtime context (time, timezone).
2. Replace `buildPersonaInstructions(persona)` — instead of looking up from `AGENT_PERSONAS`, it now receives the full persona object from `PersonaEngine.getActive()` and formats `persona.instructions` + `persona.tone` into the `# Persona` section.
3. Add `buildAgentInstructionsFromPersona(persona, profile, memories)` as the new primary entry point that persona-engine-aware callers use. Keep `buildAgentInstructions(profile)` as a backward-compatible wrapper that loads default persona.
4. Implement mid-session persona switching: export `buildPersonaSwitchDelta(oldPersona, newPersona)` that returns only the changed prompt sections (for efficient session.update() calls to the realtime API — avoids resending the entire instruction set). If the realtime API doesn't support partial updates, fall back to full re-send.
5. Update `test/prompts.test.js`: verify prompt composition order (persona section before memory section before tools), verify persona switch produces correct delta, verify backward compatibility (old `buildAgentInstructions` still works), verify voice preference from persona is respected.
6. Run `npm run check` and `node --test test/prompts.test.js` — all pass.

## Acceptance Criteria

- [ ] Prompt composition follows defined priority: persona > memory > tools > base > runtime
- [ ] `buildAgentInstructionsFromPersona()` produces correctly ordered instructions
- [ ] Backward compatibility: `buildAgentInstructions(profile)` still works for callers not yet migrated
- [ ] Persona switch delta correctly identifies changed sections
- [ ] Voice preference from persona flows through to session config
- [ ] All existing prompt tests still pass

## Tests Required

- `test/prompts.test.js` — updated: composition order, persona-aware building, switch delta, backward compat, voice preference

## Outputs

- `src/realtime/prompts.js` — refactored
- `test/prompts.test.js` — updated

## Interface Contracts

- Depends on PersonaEngine.getActive() from task 070
- Depends on memory recall results from task 064
- Consumed by realtime session setup in renderer.js
- Task 072 (IPC) triggers persona switch which calls buildPersonaSwitchDelta

## Handoff Notes

_Filled after completion._

## Errors Encountered

_Filled if errors occur._

## Self-Annealing Contract

| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Prompt too long after adding persona + memory | Total instruction token count | >4000 tokens | Trim memory context first, then persona instructions |
| Persona switch causes session disconnect | Realtime API error on session.update | Any occurrence | Fall back to full session restart instead of delta update |
| Backward compat broken | Existing callers of buildAgentInstructions fail | Any test failure | Restore wrapper, investigate caller expectations |
