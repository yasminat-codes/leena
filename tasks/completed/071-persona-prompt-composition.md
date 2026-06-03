---
id: "071"
title: "Persona-aware prompt composition"
type: feature
status: completed
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
attempts: 1
claim_started: "2026-06-03T08:05:33Z"
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

- [x] Prompt composition follows defined priority: persona > memory > tools > base > runtime
- [x] `buildAgentInstructionsFromPersona()` produces correctly ordered instructions
- [x] Backward compatibility: `buildAgentInstructions(profile)` still works for callers not yet migrated
- [x] Persona switch delta correctly identifies changed sections
- [x] Voice preference from persona flows through to session config
- [x] All existing prompt tests still pass

## Tests Required

- `test/prompts.test.js` — updated: composition order, persona-aware building, switch delta, backward compat, voice preference
- `test/wave14-integration.test.js` — pins live Settings persona changes invalidating prefetched secrets and sending realtime `session.update`

## Outputs

- `src/realtime/prompts.js` — refactored
- `src/main.js` — active persona/tool-context session config and persona session-update IPC
- `src/preload.js` — persona session-update bridge
- `src/renderer/renderer.js` — active session update + prefetch invalidation on persona/profile changes
- `src/renderer/screens/settings.js` — emits persona-change runtime event after Settings persona switch
- `test/prompts.test.js` — updated
- `test/wave14-integration.test.js` — updated

## Interface Contracts

- Depends on PersonaEngine.getActive() from task 070
- Depends on memory recall results from task 064
- Consumed by realtime session setup in `src/main.js` and live session updates sent from `src/renderer/renderer.js`
- Settings persona switches emit `leena:persona-changed`; renderer invalidates prefetched realtime secrets and sends a full `session.update` payload when a call data channel is open
- Task 072 (IPC) switches active personas; realtime update payloads use the main-process `realtime:create-persona-session-update` bridge

## Handoff Notes

Implemented persona-aware prompt composition in `src/realtime/prompts.js` and updated `test/prompts.test.js`.

- `buildRealtimeInstructions()` now accepts `{ profile, memories, persona, tools }` and composes persona, memory, tool context, base instructions, profile context, then runtime.
- `buildAgentInstructionsFromPersona(persona, profile, memories, { tools })` is the new persona-engine-aware entry point.
- `buildAgentInstructions(profile)` remains a backward-compatible wrapper for legacy profile persona keys.
- `buildPersonaSwitchDelta(oldPersona, newPersona, options)` exports changed persona sections and full `session.instructions` / `fallbackSession.instructions` payloads so a realtime `session.update` never drops base, memory, tool, or runtime boundaries.
- `resolveRealtimeVoicePreference(profile, persona)` preserves an explicit legacy/profile voice selection over seeded persona defaults, while still allowing custom persona voice preference when the profile voice remains default.
- Live realtime session creation now uses the active PersonaEngine persona, live tool definitions, memory recall, and the resolved voice in the main process.
- Settings persona switches now invalidate prefetched client secrets and send a main-built full `session.update` over the open realtime data channel when a call is active.
- Prefetched realtime secrets are guarded by a generation token so an in-flight pre-persona-change secret cannot repopulate the cache after invalidation.
- Memory prompt boundary remains explicit: recalled memories are untrusted data and cannot override system, persona, tool, base, runtime, or safety instructions.
- Focused prompt coverage now verifies ordering, persona-engine shape formatting, switch delta, backward compatibility, memory boundary, tool context, and persona voice preference.

Verification completed:

- `kencode-search`: queried `session.update` before code edits.
- `node --check src/realtime/prompts.js`
- `node --check test/prompts.test.js`
- `npx biome check src/realtime/prompts.js test/prompts.test.js`
- `node --test test/prompts.test.js test/wave12-integration.test.js test/wave13-integration.test.js test/wave14-integration.test.js` (24/24 pass)
- Combined independent verification after all Wave 14 workers completed passed: `npm run check`, `node --test` (515/515), `npm test`, changed-file `node --check`, WAL parse, and `git diff --check`.

## Errors Encountered

- Concurrent task 107 and task 109 edits briefly made full gates fail while their files were still mid-patch. No task 071 code changes were required; combined Wave 14 gates passed after those workers completed.

## Self-Annealing Contract

| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Prompt too long after adding persona + memory | Total instruction token count | >4000 tokens | Trim memory context first, then persona instructions |
| Persona switch causes session disconnect | Realtime API error on session.update | Any occurrence | Fall back to full session restart instead of delta update |
| Backward compat broken | Existing callers of buildAgentInstructions fail | Any test failure | Restore wrapper, investigate caller expectations |
