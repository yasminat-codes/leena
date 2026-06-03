---
id: "064"
title: "Integrate memory into realtime prompts"
type: feature
status: completed
priority: high
complexity: M
estimated_tokens: 16000
dependencies: ["062", "063"]
context_files:
  - src/realtime/prompts.js
  - src/memory/sqlite-memory-store.js
skills: []
tags: [phase-3, memory, prompts, realtime]
attempts: 1
claim_started: "2026-06-03T05:05:41Z"
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

- [x] `buildRealtimeInstructions()` includes `# Memory Context` section when memories are provided
- [x] Memory middleware correctly calls recall on session start, remember on each exchange, consolidate on session end
- [x] Graceful degradation: no memory store -> no crash, prompts work without memory section
- [x] Existing prompt tests still pass (no regression)
- [x] Consolidation triggers only when episodic count exceeds threshold (10)

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

- `buildRealtimeInstructions({ memories })` now appends `# Memory Context` only when normalized recall results contain non-empty `entry.content`; each memory is formatted with a clamped two-decimal confidence score.
- `createMemoryMiddleware(memoryStore)` provides async `onSessionStart(profile)`, `onExchange(conversationId, role, content)`, and `onSessionEnd(conversationId)` hooks. It recalls with the profile name/about query and limit 10, stores non-empty exchanges as episodic memories, and consolidates only when `getEpisodic(conversationId).length > 10`.
- Shared lifecycle wiring was intentionally not added here because Worker 064 does not own `src/main.js`, `src/preload.js`, or `src/renderer/renderer.js`. Parent orchestration should instantiate the middleware at session setup, pass `await onSessionStart(profile)` into `buildRealtimeInstructions({ profile, memories })`, call `onExchange` after user/assistant turns, and call `onSessionEnd` on disconnect.
- Verification at 2026-06-03T05:11:25Z: `node --check src/realtime/prompts.js`, `node --check src/memory/memory-middleware.js`, `node --check test/prompts.test.js`, `node --check test/memory-middleware.test.js`, `npm run check`, `node --test`, and targeted `git diff --check` passed.
- Parent integration completed the shared lifecycle wiring: `src/main.js` now injects recalled memories into `buildRealtimeInstructions({ profile, memories })`, `src/renderer/renderer.js` stores realtime transcript exchanges through the memory bridge, and `test/wave13-integration.test.js` pins the wiring.
- Reviewer fix added an explicit untrusted-data boundary to recalled memories so remembered transcript text cannot override system, persona, runtime, tool, or safety instructions.
- Final independent verification at 2026-06-03T06:12:24Z passed: `npm run check`, full `node --test` (474/474), changed JS `node --check`, focused Wave 13 integration tests, and `git diff --check`.
- Reviewer-fix verification at 2026-06-03T06:37:44Z passed: `npm run check`, full `node --test` (481/481), focused prompt tests, and `git diff --check`.

## Errors Encountered

- Required shell command `kencode-search` was not installed on PATH (`zsh: command not found: kencode-search`). Used the available `mcp__kencode_search.searchCode` connector before edits; the repo-specific `buildRealtimeInstructions({` anchor returned no public matches, so local file context was used as source of truth.
- Reviewer found recalled memories were injected without a clear untrusted-data boundary; fixed by adding explicit memory-as-data instructions and regression coverage.

## Self-Annealing Contract

| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Memory context bloats prompt | Token count of Memory Context section | >2000 tokens | Limit to top 5 results, summarize long entries |
| Recall latency slows session start | Time from session start to first prompt ready | >500ms | Cache recent recalls, precompute on app start |
| Consolidation runs too often | consolidate() calls per session | >3 per session | Raise episodic threshold or debounce |
