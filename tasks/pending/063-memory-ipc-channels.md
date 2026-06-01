---
id: "063"
title: "Memory IPC channels"
type: feature
status: pending
priority: high
complexity: M
estimated_tokens: 14000
dependencies: ["062"]
context_files:
  - src/main.js
  - src/preload.js
  - src/memory/sqlite-memory-store.js
skills: []
tags: [phase-3, memory, ipc]
attempts: 0
created_at: "2026-06-01"
---

## Objective

Wire the `SQLiteMemoryStore` into Electron's IPC layer so the renderer can store and query memories, and expose the memory API through the preload bridge.

## Why This Matters

The renderer (UI, realtime session) needs to trigger memory operations — storing exchanges as they happen, recalling context when composing prompts, and displaying memory stats in the UI. Without IPC channels, the memory subsystem is invisible to the frontend.

## Steps

1. In `src/main.js`, import `SQLiteMemoryStore` and instantiate it during app initialization (after database path is set). Pass `{ dbPath: getDatabasePath(), providerRegistry }` where providerRegistry comes from the provider layer (task 002/050).
2. Register IPC handlers: `memory:remember` (invoke — takes `{ text, metadata }`, returns `{ id }`), `memory:recall` (invoke — takes `{ query, limit }`, returns `RecallResult[]`), `memory:get-conversation` (invoke — takes `{ conversationId }`, returns `EpisodicEntry[]`), `memory:consolidate` (invoke — no args, returns `{ newFacts: number }`), `memory:stats` (invoke — no args, returns `{ episodic, semantic }`).
3. In `src/preload.js`, add to the contextBridge `exposeInMainWorld` object: `memory: { remember(text, metadata), recall(query, limit), getConversation(conversationId), consolidate(), stats() }` — each wrapping `ipcRenderer.invoke('memory:...')`.
4. Add input validation in main.js handlers: `text` must be non-empty string, `limit` must be positive integer (default 5), `conversationId` must be non-empty string. Return structured errors for invalid input.
5. Write `test/memory-ipc.test.js`: mock the SQLiteMemoryStore methods, verify IPC handler registration calls the correct store method with correct args, verify input validation rejects bad input.
6. Run `npm run check` and `node --test test/memory-ipc.test.js` — zero errors.

## Acceptance Criteria

- [ ] 5 IPC channels registered in main.js (remember, recall, get-conversation, consolidate, stats)
- [ ] Preload bridge exposes `window.leena.memory.*` (or `window.brah.memory.*` if rename not yet done — adapt to current state)
- [ ] Input validation prevents empty text, negative limits, missing conversationId
- [ ] Error responses are structured `{ error: string }`, not raw throws
- [ ] Tests verify handler-to-store method mapping

## Tests Required

- `test/memory-ipc.test.js` — handler registration, argument passing, input validation, error wrapping

## Outputs

- `src/main.js` — modified (memory store init + IPC handlers)
- `src/preload.js` — modified (memory bridge methods)
- `test/memory-ipc.test.js` — new test file

## Interface Contracts

- Task 064 (prompt integration) uses `memory:recall` and `memory:remember` channels internally in main process (can call store directly, bypass IPC)
- Task 017/Settings screen uses `memory:stats` to display counts
- Renderer code accesses memory via `window.leena.memory.*`

## Handoff Notes

_Filled after completion._

## Errors Encountered

_Filled if errors occur._

## Self-Annealing Contract

| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| IPC handler throws unstructured error | Renderer receives raw Error instead of { error } | Any occurrence | Wrap all handlers in try/catch returning structured errors |
| Memory store not initialized at IPC call time | Handler called before store constructor | Any occurrence | Defer IPC registration until store is ready, or return { error: 'Memory not initialized' } |
| Preload bridge mismatch with IPC channels | Channel name typo between preload and main | Any mismatch | Add a startup self-check that verifies channel names match |
