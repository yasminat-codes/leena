---
id: "061"
title: "Create episodic and semantic SQLite tables"
type: feature
status: completed
priority: high
complexity: M
estimated_tokens: 14000
dependencies: ["060", "032"]
context_files:
  - src/realtime/tools/database.js
  - plans/data-model.md
skills: []
tags: [phase-3, memory, database]
attempts: 1
claim_started: "2026-06-03T01:04:37Z"
completed_at: "2026-06-03T01:24:00Z"
created_at: "2026-06-01"
---

## Objective

Add `memories_episodic` and `memories_semantic` tables to the SQLite schema in `database.js`, with proper indexes and a safe migration path that preserves all existing tables (tasks, calendar_items, activity, settings).

## Why This Matters

These tables are the persistence backbone for Leena's memory system. Episodic stores raw conversation turns with embeddings for vector search. Semantic stores consolidated facts that survive across sessions. Both must coexist with the existing planner/activity schema without breaking the rename migration from brah.db → lena.db (task 032).

## Steps

1. Read `src/realtime/tools/database.js` and confirm current `applySchema()` uses `CREATE TABLE IF NOT EXISTS` pattern — new tables follow the same pattern and are additive-safe.
2. Add `memories_episodic` DDL to `applySchema()`: `CREATE TABLE IF NOT EXISTS memories_episodic (id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, embedding BLOB, created_at TEXT NOT NULL DEFAULT (datetime('now')), metadata TEXT NOT NULL DEFAULT '{}')`.
3. Add `memories_semantic` DDL: `CREATE TABLE IF NOT EXISTS memories_semantic (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL DEFAULT 'general', content TEXT NOT NULL, confidence REAL NOT NULL DEFAULT 1.0, embedding BLOB, source_episode_ids TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL DEFAULT (datetime('now')), last_seen TEXT NOT NULL DEFAULT (datetime('now')), superseded_by INTEGER REFERENCES memories_semantic(id))`.
4. Add indexes: `CREATE INDEX IF NOT EXISTS idx_episodic_conversation ON memories_episodic(conversation_id)`, `CREATE INDEX IF NOT EXISTS idx_episodic_created ON memories_episodic(created_at)`, `CREATE INDEX IF NOT EXISTS idx_semantic_category ON memories_semantic(category)`, `CREATE INDEX IF NOT EXISTS idx_semantic_last_seen ON memories_semantic(last_seen)`.
5. Write `test/memory-tables.test.js` using the existing `withTempDir` + `closeDatabase` pattern: verify both tables are created on fresh DB, verify existing tables (tasks, activity) still exist after schema application, verify insert/select round-trip for both new tables, verify indexes exist via `PRAGMA index_list`.
6. Run `npm run check` and `node --test test/memory-tables.test.js` — zero errors.

## Acceptance Criteria

- [ ] `memories_episodic` table created with all columns matching data model spec
- [ ] `memories_semantic` table created with all columns including self-referential `superseded_by`
- [ ] 4 indexes created (2 episodic, 2 semantic)
- [ ] Existing tables (tasks, calendar_items, activity, settings) unaffected
- [ ] `PRAGMA foreign_keys = ON` already set in `getDatabase()` — verify `superseded_by` FK works
- [ ] Test file passes with insert/select round-trip assertions for both tables

## Tests Required

- `test/memory-tables.test.js` — table creation, column presence, index verification, round-trip insert/select, existing table preservation, FK constraint on superseded_by

## Outputs

- `src/realtime/tools/database.js` — modified (added DDL to `applySchema`)
- `test/memory-tables.test.js` — new test file

## Interface Contracts

- Task 062 (SQLiteMemoryStore) reads/writes to these tables
- Task 032 (rename) must apply before this task touches the DB path (dependency enforced)
- Column names and types must match `src/memory/types.js` from task 060

## Handoff Notes

- Added additive `memories_episodic` and `memories_semantic` tables plus required indexes to `applySchema()`.
- Parent integration also added the Wave 10 `mcp_servers` table to the same central schema so fresh databases include all Wave 10 storage surfaces.
- `test/memory-tables.test.js` verifies column shape, row preservation for existing planner/activity/settings tables, episodic/semantic round trips, indexes, and `superseded_by` FK enforcement.
- Final parent gates passed: `npm run check`, `node --test` (329/329), focused memory tests, changed JS syntax checks, and `git diff --check`.

## Errors Encountered

- The first FK negative check mixed `BigInt` and number arithmetic from SQLite `lastInsertRowid`; fixed by coercing to `Number()` before adding the invalid offset.

## Self-Annealing Contract

| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Schema drift from types.js | Column count or name mismatch | Any mismatch | Sync DDL with types.js before proceeding |
| Existing table breakage | Existing test suites fail after schema change | Any failure | Revert DDL change, investigate conflict |
| Embedding BLOB size issue | BLOB column stores >1MB embeddings | >1MB per row | Add size check or compress before store |
