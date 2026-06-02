---
id: "060"
title: "MemoryStore abstract interface"
type: feature
status: pending
priority: high
complexity: S
estimated_tokens: 8000
dependencies: ["000"]
context_files:
  - src/realtime/tools/database.js
  - src/realtime/prompts.js
skills: []
tags: [phase-3, memory, interface]
attempts: 0
created_at: "2026-06-01"
---

## Objective

Define the `MemoryStore` abstract interface and associated type definitions that all memory implementations (SQLite baseline, future Mem0 adapter) must satisfy.

## Why This Matters

Memory is the highest-risk subsystem (R-2, R-4). A clean interface decouples storage from callers, enables swapping implementations without touching consuming code, and makes the memory layer independently testable. Every downstream memory task depends on this contract.

## Steps

1. Create `src/memory/memory-store.js` exporting a `MemoryStore` class with abstract methods: `remember(text, metadata)`, `recall(query, limit)`, `getEpisodic(conversationId)`, `consolidate()`, `stats()`, and `close()`. Each method throws `new Error('Not implemented')` in the base class.
2. Create `src/memory/types.js` defining JSDoc typedefs for `MemoryEntry` (id, content, type, embedding, createdAt, metadata), `EpisodicEntry` (id, conversationId, role, content, embedding, createdAt, metadata), `SemanticEntry` (id, category, content, confidence, embedding, sourceEpisodeIds, createdAt, lastSeen, supersededBy), and `RecallResult` (entry, score).
3. Add `src/memory/index.js` barrel export re-exporting `MemoryStore` and all types.
4. Write `test/memory-store.test.js` verifying that calling any abstract method on a bare `MemoryStore` instance throws `'Not implemented'`, and that a minimal subclass implementing all methods does not throw.
5. Run `npm run check` and `node --test test/memory-store.test.js` — verify zero errors.

## Acceptance Criteria

- [ ] `MemoryStore` class exists with 6 abstract methods that throw when called directly
- [ ] All typedefs documented with JSDoc in `types.js`
- [ ] Barrel export in `src/memory/index.js` re-exports everything
- [ ] `test/memory-store.test.js` passes with at least 3 test cases (abstract throws, subclass works, close is callable)
- [ ] `npm run check` clean

## Tests Required

- `test/memory-store.test.js` — abstract method enforcement, subclass compliance, close idempotency

## Outputs

- `src/memory/memory-store.js` — base class
- `src/memory/types.js` — typedefs
- `src/memory/index.js` — barrel export
- `test/memory-store.test.js` — interface tests

## Interface Contracts

- Task 062 (SQLiteMemoryStore) extends this class and must implement all 6 methods
- Task 063 (IPC channels) imports from `src/memory/index.js`
- Task 064 (prompt integration) calls `recall()` and `remember()`
- Any future Mem0 adapter extends this class

## Handoff Notes

_Filled after completion._

## Errors Encountered

_Filled if errors occur._

## Self-Annealing Contract

| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Interface method signature changed after consumer tasks start | git diff on memory-store.js after task 062+ | Any breaking change | Audit all importers; update interface contract |
| Subclass doesn't implement all methods | test failure in subclass compliance test | Any missing method | Fix subclass before proceeding |
| Types diverge from SQLite schema | Compare types.js fields vs 061 DDL | Mismatch on >1 field | Reconcile types.js with actual schema |
