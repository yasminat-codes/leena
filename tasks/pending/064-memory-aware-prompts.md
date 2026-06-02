---
id: "064"
title: "Integrate memory into realtime prompts"
type: feature
status: pending
priority: high
complexity: M
estimated_tokens: 16000
dependencies: ["062", "063"]
context_files:
  - src/realtime/prompts.js
  - src/memory/sqlite-memory-store.js
skills: []
tags: [phase-3, memory, prompts, realtime]
attempts: 0
created_at: "2026-06-01"
---

## Objective

Modify `buildRealtimeInstructions()` to inject recalled memories into session prompts and wire automatic episodic storage of each conversation exchange.

## Why This Matters

Memory without prompt integration is inert data. The user won't feel Leena "remembers" unless recalled facts appear in the system prompt and new exchanges are automatically stored. This task connects the memory engine to the realtime voice pipeline — the moment Leena becomes contextually aware across sessions.

## Steps

1. Modify `buildRealtimeInstructions()` in `src/realtime/prompts.js` to accept an optional `memories` parameter (array of `RecallResult`). When present and non-empty, append a `# Memory Context` section to the instructions listing each recalled fact with its confidence score.
2. Create `src/memory/memory-middleware.js` exporting `createMemoryMiddleware(memoryStore)` that returns an object with: `onSessionStart(profile)` — calls `memoryStore.recall(profile.name + ' ' + profile.about, 10)` and returns recalled memories for prompt injection; `onExchange(conversationId, role, content)` — calls `memoryStore.remember(content, { conversationId, role })`; `onSessionEnd(conversationId)` — triggers `memoryStore.consolidate()` if episodic count for this conversation exceeds 10.
3. Wire `memory-middleware.js` into the realtime session lifecycle in `src/renderer/renderer.js` (or wherever session start/end is managed): call `onSessionStart` before building instructions, pass recalled memories to `buildRealtimeInstructions`, call `onExchange` after each user/assistant turn, call `onSessionEnd` on disconnect.
4. Handle edge cases: if memory store is unavailable (provider not configured), skip memory injection silently — prompts still work without the Memory Context section. If recall returns empty, omit the section entirely (no "No memories found" noise).
5. Update `test/prompts.test.js` to verify: `buildRealtimeInstructions` with empty memories produces no Memory Context section; with 3 mock memories produces a correctly formatted section; memory middleware calls store methods in correct order.
6. Run `npm run check` and `node --test` — all tests pass including existing prompt tests.

## Acceptance Criteria

- [ ] `buildRealtimeInstructions()` includes `# Memory Context` section when memories are provided
- [ ] Memory middleware correctly calls recall on session start, remember on each exchange, consolidate on session end
- [ ] Graceful degradation: no memory store → no crash, prompts work without memory section
- [ ] Existing prompt tests still pass (no regression)
- [ ] Consolidation triggers only when episodic count exceeds threshold (10)

## Tests Required

- `test/prompts.test.js` — updated with memory injection cases
- `test/memory-middleware.test.js` — new: session lifecycle, exchange recording, consolidation trigger threshold, graceful fallback when store unavailable

## Outputs

- `src/realtime/prompts.js` — modified (accepts memories parameter)
- `src/memory/memory-middleware.js` — new
- `test/prompts.test.js` — modified
- `test/memory-middleware.test.js` — new

## Interface Contracts

- Depends on `MemoryStore.recall()` returning `RecallResult[]` from task 060/062
- Depends on realtime session lifecycle hooks (session start, exchange, disconnect)
- Task 071 (persona prompt composition) extends this further with persona + memory + context priority

## Handoff Notes

_Filled after completion._

## Errors Encountered

_Filled if errors occur._

## Self-Annealing Contract

| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Memory context bloats prompt | Token count of Memory Context section | >2000 tokens | Limit to top 5 results, summarize long entries |
| Recall latency slows session start | Time from session start to first prompt ready | >500ms | Cache recent recalls, precompute on app start |
| Consolidation runs too often | consolidate() calls per session | >3 per session | Raise episodic threshold or debounce |
