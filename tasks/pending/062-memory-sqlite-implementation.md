---
id: "062"
title: "SQLiteMemoryStore implementation"
type: feature
status: pending
priority: high
complexity: L
estimated_tokens: 25000
dependencies: ["060", "061", "002"]
context_files:
  - src/memory/memory-store.js
  - src/memory/types.js
  - src/realtime/tools/database.js
  - src/providers/index.js
skills: []
tags: [phase-3, memory, sqlite, embeddings]
attempts: 0
created_at: "2026-06-01"
---

## Objective

Implement `SQLiteMemoryStore` extending `MemoryStore`, backed by the episodic/semantic tables from task 061, using the provider layer for embeddings and chat-based consolidation.

## Why This Matters

This is the core memory engine — the subsystem that makes Leena remember across sessions. It must correctly store conversation turns, generate and store embeddings for vector similarity search, recall relevant context, and consolidate episodic entries into durable semantic facts. Cross-session recall is the headline success criterion for the entire memory phase.

## Steps

1. Create `src/memory/sqlite-memory-store.js` extending `MemoryStore`. Constructor takes `{ dbPath, providerRegistry }`. Opens DB via `getDatabase(dbPath)`.
2. Implement `remember(text, metadata)`: insert into `memories_episodic` with conversation_id, role, and content from metadata. Call `providerRegistry.getForCapability('embeddings').embed(text)` to generate embedding. Store embedding as Float32Array BLOB. Return the inserted row id.
3. Implement `recall(query, limit = 5)`: embed the query via provider. Load all embeddings from `memories_semantic` (then `memories_episodic` if needed). Compute cosine similarity in JS. Return top `limit` results as `RecallResult[]` sorted by score descending. Optimize: if row count >1000, use a pre-filter on `last_seen` or `category` before full scan.
4. Implement `getEpisodic(conversationId)`: `SELECT * FROM memories_episodic WHERE conversation_id = ? ORDER BY created_at ASC`. Map to `EpisodicEntry[]`.
5. Implement `consolidate()`: fetch recent episodic entries not yet linked to any semantic entry. Batch them (up to 20). Call `providerRegistry.getForCapability('chat').chat([{role:'system', content:'Summarize these conversation exchanges into discrete facts...'}, ...])`. Parse response into fact strings. Insert each as `memories_semantic` row with embedding and source_episode_ids linking back.
6. Implement `stats()` and `close()`: stats returns `{ episodic: count, semantic: count }` via COUNT queries. close calls `closeDatabase(dbPath)`.
7. Write `test/memory-sqlite.test.js`: remember + recall round-trip (mock provider returning fixed embeddings), cosine similarity correctness, consolidate with mock chat provider, stats accuracy, close idempotency. Use `withTempDir` + `closeDatabase` pattern from existing tests.

## Acceptance Criteria

- [ ] `remember()` stores episodic entry with embedding BLOB
- [ ] `recall()` returns relevant results ranked by cosine similarity
- [ ] `getEpisodic()` returns ordered conversation entries
- [ ] `consolidate()` creates semantic entries from episodic clusters
- [ ] `stats()` returns accurate counts
- [ ] `close()` is safe to call multiple times
- [ ] All tests pass with mock provider (no real API calls in tests)
- [ ] Cosine similarity implementation is correct (verified with known vectors in tests)

## Tests Required

- `test/memory-sqlite.test.js` — remember/recall round-trip, cosine similarity math, consolidation, stats, close, edge cases (empty DB recall, recall with no embeddings)

## Outputs

- `src/memory/sqlite-memory-store.js` — full implementation
- `test/memory-sqlite.test.js` — comprehensive test suite

## Interface Contracts

- Depends on ProviderRegistry from task 002 for `getForCapability('embeddings')` and `getForCapability('chat')`
- Depends on DB tables from task 061
- Task 063 (IPC) instantiates this class
- Task 064 (prompts) calls `recall()` and `remember()` through IPC
- Provider must implement `embed(text) → Float32Array` and `chat(messages) → string`

## Handoff Notes

_Filled after completion._

## Errors Encountered

_Filled if errors occur._

## Self-Annealing Contract

| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Recall returns irrelevant results | Cosine similarity score of top result on known-good query | Score < 0.5 on exact-match | Debug embedding generation or similarity math |
| Consolidation produces garbage facts | Manual inspection of semantic entries | >30% nonsensical | Improve consolidation prompt or add filtering |
| Embedding provider unavailable | remember() or recall() throws | Any provider error | Graceful fallback: store without embedding, keyword-only recall |
