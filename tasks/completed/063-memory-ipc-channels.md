---
id: "063"
title: "Memory IPC channels"
type: feature
status: completed
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
attempts: 1
claim_started: "2026-06-03T04:02:39Z"
completed_at: "2026-06-03T04:24:04Z"
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

- [x] Standalone registration module exports 5 IPC channels (remember, recall, get-conversation, consolidate, stats)
- [x] Parent integration registers handlers in `src/main.js`
- [x] Parent integration exposes `window.leena.memory.*` in `src/preload.js`
- [x] Input validation prevents empty text, negative limits, missing conversationId
- [x] Error responses are structured `{ error: string }`, not raw throws
- [x] Tests verify handler-to-store method mapping

## Tests Required

- `test/memory-ipc.test.js` — handler registration, argument passing, input validation, error wrapping

## Outputs

- `src/ipc/memory-handlers.js` — new standalone IPC registration module
- `test/memory-ipc.test.js` — new test file
- `src/main.js` — parent integration registers `registerMemoryHandlers`
- `src/preload.js` — parent integration exposes `window.leena.memory.*`

## Interface Contracts

- Task 064 (prompt integration) uses `memory:recall` and `memory:remember` channels internally in main process (can call store directly, bypass IPC)
- Task 017/Settings screen uses `memory:stats` to display counts
- Renderer code accesses memory via `window.leena.memory.*`

## Handoff Notes

- 2026-06-03T04:10:55Z worker 063 slice complete: added `src/ipc/memory-handlers.js` with `MEMORY_IPC_CHANNELS`, `registerMemoryHandlers()`, `createMemoryIpcHandlers()`, and `serializeMemoryIpcError()`.
- Registered standalone channels: `memory:remember`, `memory:recall`, `memory:get-conversation`, `memory:consolidate`, and `memory:stats`.
- The module accepts an injected `store`/`memoryStore` for tests and creates `SQLiteMemoryStore({ dbPath, providerRegistry })` by default for parent integration. It delegates `memory:get-conversation` to `store.getConversation()` when present and falls back to upstream 062's `store.getEpisodic()`.
- Handler results: `memory:remember` returns `{ id }`; `memory:recall` returns store recall results; `memory:get-conversation` returns episodic entries; `memory:consolidate` maps the store consolidation result to `{ newFacts }`; `memory:stats` returns store stats.
- Validation/errors: invalid remember/recall/conversation payloads and store failures return structured `{ error: string }` results rather than raw thrown errors.
- Parent `src/main.js` handoff: import `registerMemoryHandlers` from `./ipc/memory-handlers.js`, then call `registerMemoryHandlers({ ipcMain, dbPath: getDatabasePath(), providerRegistry })` after database path and provider registry setup. The module can also receive a prebuilt `memoryStore` if parent wants lifecycle ownership.
- Parent `src/preload.js` handoff: expose `memory: { remember(text, metadata), recall(query, limit), getConversation(conversationId), consolidate(), stats() }` under `window.leena`, each wrapping the matching `ipcRenderer.invoke("memory:...")` channel with the object payloads documented above.
- Parent integration complete: `src/main.js` registers the memory handlers with the provider registry, `src/preload.js` exposes the memory bridge, and `test/wave12-integration.test.js` pins both contracts.
- Verification passed:
  - `node --test test/memory-ipc.test.js`
  - `npm run check`

## Errors Encountered

- Early worker full-suite failures came from concurrent provider-test work in task `056`. Parent verification later passed the focused memory/identity/provider/integrations suite and full `node --test`.

## Self-Annealing Contract

| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| IPC handler throws unstructured error | Renderer receives raw Error instead of { error } | Any occurrence | Wrap all handlers in try/catch returning structured errors |
| Memory store not initialized at IPC call time | Handler called before store constructor | Any occurrence | Defer IPC registration until store is ready, or return { error: 'Memory not initialized' } |
| Preload bridge mismatch with IPC channels | Channel name typo between preload and main | Any mismatch | Add a startup self-check that verifies channel names match |
