# Phase 2 — Memory

> **Complexity:** L  
> **Depends on:** Phase 1 (Foundation & Rename) complete — `lena.db` path established, `setDatabaseUserDataPath` called from main process.  
> **Independent of:** Phase 3, Phase 4, Phase 5.

---

## 1. Goal & Exit Criteria

**Goal:** Give Lena persistent, cross-session memory. Facts the user states in one conversation are recalled accurately in a later, separate session. The memory system is honest (never silently loses data), inspectable (user can view/edit/delete what Lena knows), and swappable (two impls behind one interface, per ADR-2).

**Exit criteria (all must be true):**

1. A fact stated in session A ("I have a dog named Mochi") is recalled correctly when asked cold in session B with no other context.
2. `memories_episodic` is strictly append-only — no row is ever deleted or modified; audit query `SELECT COUNT(*) FROM memories_episodic WHERE deleted_at IS NOT NULL` returns 0.
3. The Mem0 adapter passes the same cross-session recall test and its p50 recall latency is measured and logged against the baseline.
4. Memory management IPC channels (`memory:list`, `memory:search`, `memory:delete`, `memory:edit`, `memory:stats`) return correct results and `memory:delete` soft-deletes semantic rows (sets `deleted_at`), never touches episodic.
5. All tests in `test/memory.test.js` pass under `npm test`.

---

## 2. Architecture: `MemoryStore` Interface Contract

**Location:** `src/realtime/memory/memory-store.js`

All callers (extraction pipeline, injection, consolidation, IPC handlers, tests) program to this interface. Neither the baseline nor the Mem0 adapter is imported directly outside of `memory/index.js`.

```js
// memory-store.js — interface documentation (JSDoc, not enforced at runtime)

/**
 * @typedef {Object} Exchange
 * @property {string} sessionId   - unique session identifier
 * @property {string} userText    - user turn text
 * @property {string} agentText   - agent turn text
 * @property {Date}   [timestamp] - defaults to now
 */

/**
 * @typedef {Object} MemoryRecord
 * @property {number} id
 * @property {string} content      - human-readable fact or summary
 * @property {string} category     - 'general' | 'procedural' | 'preference' | 'relationship' | 'goal'
 * @property {number} confidence   - 0.0–1.0
 * @property {number} [similarity] - present on recall results
 * @property {number} [score]      - composite recall score
 * @property {Date}   created_at
 * @property {Date}   [updated_at]
 */

/**
 * @typedef {Object} MemoryStats
 * @property {number} episodic_count
 * @property {number} semantic_count
 * @property {number} semantic_deleted_count
 * @property {number} model_cache_size_bytes  - baseline only; 0 for Mem0 adapter
 */

class MemoryStore {
  /** Persist a conversation exchange to episodic log and queue fact extraction. */
  async remember(exchange: Exchange): Promise<void>

  /**
   * Retrieve top-k semantic memories relevant to query.
   * Returns MemoryRecord[] sorted by composite score descending.
   * k defaults to 8.
   */
  async recall(query: string, k?: number): Promise<MemoryRecord[]>

  /**
   * Merge near-duplicate semantic memories (cosine > 0.9).
   * LLM-assisted. Supersedes old rows via FK; never hard-deletes.
   * Idempotent — safe to call periodically.
   */
  async consolidate(): Promise<{ merged: number }>

  /** Returns counts and health info. */
  async stats(): Promise<MemoryStats>
}
```

**Factory:** `src/realtime/memory/index.js` exports `getMemoryStore()` which reads a persisted setting (`settings` table key `memory_backend`, default `'baseline'`) and returns the appropriate singleton. Swapping the backend requires only updating that setting — no code changes.

---

## 3. Memory Model (ADR-3)

Two SQLite tables in `lena.db` (added to `database.js` `applySchema`). No four-table complexity — covers every memory type the user named.

### 3.1 `memories_episodic`

**What it is:** Append-only log of every conversation exchange. The "never forget" guarantee. No row is ever deleted or modified — this is enforced at the database level by the application; there is no `DELETE` path for episodic rows anywhere in the codebase.

**Role in ADR-3:** This is the raw episodic tier. Long-term vs. working = recency scoring axis at recall time, not a separate table.

```sql
CREATE TABLE IF NOT EXISTS memories_episodic (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT    NOT NULL,
  user_text   TEXT    NOT NULL,
  agent_text  TEXT    NOT NULL,
  summary     TEXT    NOT NULL DEFAULT '',   -- LLM-generated one-liner, filled async
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_episodic_session ON memories_episodic (session_id);
CREATE INDEX IF NOT EXISTS idx_episodic_created ON memories_episodic (created_at);
```

No `deleted_at`. No `UPDATE`. The schema has no path to mutate a row.

### 3.2 `memories_semantic`

**What it is:** Consolidated, deduplicated facts extracted from episodic exchanges. Searchable by embedding. Supports soft-delete (supersede, not erase) and provenance tracking.

**Role in ADR-3:** Covers semantic facts + procedural-as-category (category `'procedural'` = "how Lena should do my tasks") + preference + relationship + goal. `superseded_by_id` is the non-destructive update mechanism: old facts are never deleted, just linked to their replacement.

```sql
CREATE TABLE IF NOT EXISTS memories_semantic (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  content         TEXT    NOT NULL,
  category        TEXT    NOT NULL DEFAULT 'general',
                  -- values: 'general' | 'procedural' | 'preference' | 'relationship' | 'goal'
  confidence      REAL    NOT NULL DEFAULT 1.0,
  embedding       BLOB,                            -- Float32Array → ArrayBuffer, 384 dims (baseline)
                                                   -- NULL when Mem0 adapter owns embeddings
  source_episodic_id INTEGER REFERENCES memories_episodic(id),
  superseded_by_id   INTEGER REFERENCES memories_semantic(id),
  deleted_at      TEXT,                            -- soft-delete timestamp; NULL = active
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_semantic_category    ON memories_semantic (category);
CREATE INDEX IF NOT EXISTS idx_semantic_deleted     ON memories_semantic (deleted_at);
CREATE INDEX IF NOT EXISTS idx_semantic_superseded  ON memories_semantic (superseded_by_id);
```

**Active rows** = `WHERE deleted_at IS NULL AND superseded_by_id IS NULL`.

> `data-model.md` does not exist yet; the above is the authoritative schema definition for Phase 2. When `data-model.md` is created it should reference these table definitions exactly.

---

## 4. Baseline Implementation

**Location:** `src/realtime/memory/baseline-store.js`

### 4.1 Embedding model

- Model: `Xenova/all-MiniLM-L6-v2` (sentence-transformers, Apache-2.0)
- Dimension: 384
- Package: `@huggingface/transformers` (ONNX runtime, no Python, no native addon)
- Cache: model files downloaded once to `{userData}/hf-cache/` via `env.cacheDir` setting; subsequent startups load from disk in <200ms
- Load: lazy singleton, initialized on first `remember()` or `recall()` call; emits `memory:model-ready` IPC event when done

Embedding is stored as a raw `Float32Array` serialized to `BLOB` via `Buffer.from(float32Array.buffer)`. Deserialization: `new Float32Array(blob.buffer)`.

### 4.2 Recall scoring

For a given query:

1. Embed query → 384-dim vector
2. Load all active `memories_semantic` rows with non-null embeddings
3. Compute cosine similarity per row: `dot(q, m) / (|q| * |m|)`
4. Compute recency score: `1 / (1 + daysSince(created_at))`, normalized 0–1 over the candidate set
5. Composite score: `0.6 * similarity + 0.2 * recency + 0.2 * confidence`
6. Filter: `similarity >= 0.35` (pre-filter to avoid noise; threshold lower than injection threshold of 0.6 to avoid missing edge cases — injection caller applies its own 0.6 cutoff)
7. Sort descending by composite score, return top-k (default 8)

Performance: brute-force cosine over personal-scale memory (<10k rows) runs in <5ms in Node JS (R-4 confirmed). Scale-up path: if `memories_semantic` count exceeds 10,000, migrate to `better-sqlite3` + `sqlite-vec` via `asarUnpack` (same pattern as `@nut-tree-fork/nut-js`); this is a same-interface swap with no caller changes.

### 4.3 ADD / UPDATE / SUPERSEDE logic

The extraction pipeline calls `upsertFact(content, category, confidence, sourceEpisodicId)`:

1. Embed the new fact
2. Search active semantic rows for cosine > 0.85 (near-match)
3. If no match → `INSERT` new row (ADD)
4. If match, confidence ≥ existing → `INSERT` new row + set `superseded_by_id` on the old row + set `deleted_at` on old row (SUPERSEDE — soft replace, not UPDATE)
5. If match, confidence < existing → no write (ignore weaker claim)
6. Contradictory facts (opposite polarity detected by LLM extraction) → SUPERSEDE old, mark new `category` = same, log to activity table

No destructive deletes anywhere in the baseline impl.

---

## 5. Fact Extraction

**Location:** `src/realtime/memory/extractor.js`

After each conversation turn (triggered from the realtime session `response.done` event handler in `renderer.js` via `window.brah.memory.remember(exchange)`), the extractor:

1. Receives the `Exchange` object (sessionId, userText, agentText)
2. Appends raw exchange to `memories_episodic` synchronously (this write must never fail silently)
3. Sends the exchange to the existing OpenAI connection (via `ipcMain.handle('memory:extract-facts', ...)` in main process) with a structured extraction prompt:

```
Extract all personal facts about the user from this exchange. Output JSON array:
[{ "content": "...", "category": "general|procedural|preference|relationship|goal", "confidence": 0.0-1.0 }]
Only include facts explicitly stated or strongly implied. Return [] if none.
```

4. Parse response → call `upsertFact()` per item
5. Generate a one-line `summary` for the episodic row and backfill it

**Model:** Uses the existing OpenAI API key / session token already available in main process — no new auth. Uses `gpt-4.1-mini` (cheap, fast, JSON mode). Call is fire-and-forget from the renderer's perspective; failures are logged to the `activity` table and retried on next session start for unprocessed episodic rows.

**Large transcripts:** Transcripts >4000 tokens are chunked into 2000-token windows with 200-token overlap before extraction. Each chunk extracts independently; results are merged with duplicate suppression (cosine > 0.9 = deduplicate before upsert).

---

## 6. Memory Injection

**Location:** `src/realtime/prompts.js` — `buildRealtimeInstructions` modified.

`buildRealtimeInstructions({ profile, memory })` gains an optional `memory` parameter carrying the pre-fetched recall results. The call site in `main.js` `openai:create-realtime-secret` handler:

```js
const profile = loadAgentProfile();
const memoryStore = getMemoryStore();
const recalled = await memoryStore.recall(profile.about || '', 8);
const instructions = buildRealtimeInstructions({ profile, memory: recalled });
```

Inside `buildRealtimeInstructions`, after `buildAgentInstructions(profile)` and before `buildRuntimeInstructions(now)`, a new section is injected when `memory` is non-empty and has items with `similarity >= 0.6`:

```
# What You Know About the User
[filtered recall results, one fact per line, prefixed by category]
- [preference] Prefers responses without bullet points.
- [general] Has a dog named Mochi.
- [goal] Working toward a product launch in Q3 2026.
...

# Recent Context
[last 3 episodic summaries, newest first, prefixed with relative time]
- 2 hours ago: Discussed task prioritization for the week.
- Yesterday: Asked Lena to draft an investor update email.
```

The `memory` parameter is optional — if absent or empty, `buildRealtimeInstructions` returns unchanged output (backward compatible; existing call site at line 1241 of `main.js` that calls `buildRealtimeInstructions()` with no args continues to work).

---

## 7. Consolidation

**Location:** `src/realtime/memory/consolidator.js`

Triggered: (a) on app startup if last consolidation was >24h ago (checked via `settings` table key `memory_last_consolidated`), and (b) via `memory:consolidate` IPC call.

Algorithm:

1. Load all active semantic rows with embeddings
2. Build cosine similarity matrix for all pairs
3. Identify clusters where similarity > 0.9 between any two members
4. For each cluster of ≥2 rows, call OpenAI with the conflicting facts:

```
These facts about the user may be duplicates or contradictions. 
Merge them into a single canonical fact. Output: { "content": "...", "category": "...", "confidence": 0.0-1.0, "action": "merge"|"keep_both" }
```

5. If `action = "merge"`: INSERT merged row, SUPERSEDE all cluster members (set `superseded_by_id` + `deleted_at` on each old row)
6. If `action = "keep_both"`: no change
7. Update `settings.memory_last_consolidated` timestamp
8. Return `{ merged: N }` count

No row is hard-deleted. `superseded_by_id` chain preserves full provenance.

---

## 8. Mem0 Adapter Spike (R-2)

**Location:** `src/realtime/memory/mem0-store.js`

**Scope:** OSS vector mode only. Mem0 graph mode (Neo4j) is explicitly out of scope (ADR-2). No Ollama dependency allowed — if Mem0 requires Ollama for local embeddings it fails the spike.

**Interface compliance:** `mem0-store.js` implements `remember(exchange)`, `recall(query, k)`, `consolidate()`, `stats()` identically to the baseline contract. Mem0 handles its own embedding; `embedding` column in `memories_semantic` is NULL when Mem0 adapter is active (Mem0 manages its own vector store separately).

**Spike validation criteria:**

| Criterion | Pass threshold |
|---|---|
| Cross-session recall accuracy | ≥ baseline on 10-fact test set |
| p50 recall latency | ≤ 2× baseline p50 |
| No cloud calls without explicit config | Verified via network monitor |
| No Ollama or external server required | Verified at cold start |
| Install size delta | < 50MB additional in `node_modules` |

**Outcome:** Document results in `plans/.wal/mem0-spike-results.json`. If Mem0 passes all criteria, the default backend setting changes to `'mem0'`. If it fails any criterion, baseline remains default and Mem0 stays as an opt-in adapter. This decision is recorded as an update to ADR-2.

---

## 9. File-Level Changes

### New files

| File | Purpose |
|---|---|
| `src/realtime/memory/index.js` | `getMemoryStore()` factory; exports interface |
| `src/realtime/memory/memory-store.js` | JSDoc interface contract |
| `src/realtime/memory/baseline-store.js` | `node:sqlite` + transformers.js impl |
| `src/realtime/memory/mem0-store.js` | Mem0 OSS vector adapter |
| `src/realtime/memory/extractor.js` | Fact extraction from exchanges |
| `src/realtime/memory/consolidator.js` | Periodic dedup/merge |
| `src/realtime/memory/embedder.js` | `Xenova/all-MiniLM-L6-v2` singleton; `embed(text)` → Float32Array |
| `src/realtime/memory/cosine.js` | `cosineSimilarity(a, b)` pure function |
| `src/realtime/tools/memory-tools.js` | Tool executor: `memory_remember`, `memory_recall`, `memory_list`, `memory_delete` realtime tools |
| `test/memory.test.js` | `node --test` suite |

### Modified files

| File | Change |
|---|---|
| `src/realtime/tools/database.js` | Add `memories_episodic`, `memories_semantic` tables + indexes to `applySchema()` |
| `src/realtime/prompts.js` | `buildRealtimeInstructions` gains `memory` param; injects "What You Know" + "Recent Context" blocks |
| `src/realtime/tools/index.js` | Add `executeMemoryTool` import + dispatch branch |
| `src/realtime/tools/tool-schemas.js` | Add `memory_remember`, `memory_recall`, `memory_list`, `memory_delete` tool definitions |
| `src/realtime/tools/tool-permissions.js` | Add permission levels for memory tools (`memory_remember` = low, `memory_recall` = read, `memory_list` = read, `memory_delete` = write) |
| `src/main.js` | `openai:create-realtime-secret` handler: fetch recalled memories before building instructions; add `memory:*` IPC handlers; call `setDatabaseUserDataPath` before `getMemoryStore()` (already done for planner — verify order) |
| `src/preload.js` | Expose `window.brah.memory.*` bridge for renderer calls |
| `package.json` | Add `@huggingface/transformers` (required); add `mem0ai` (optional, spike only — mark in a comment) |

---

## 10. IPC Additions

All channels follow the existing `ipcMain.handle` + `ipcRenderer.invoke` pattern in `preload.js`.

> `ipc-api-spec.md` does not exist yet. These definitions are the authoritative IPC spec for memory channels.

| Channel | Direction | Args | Returns |
|---|---|---|---|
| `memory:list` | renderer → main | `{ category?, limit?, offset? }` | `MemoryRecord[]` from active semantic rows |
| `memory:search` | renderer → main | `{ query: string, k?: number }` | `MemoryRecord[]` scored by composite |
| `memory:delete` | renderer → main | `{ id: number }` | `{ ok: boolean }` — soft-delete only; sets `deleted_at` on semantic row; rejects episodic ids |
| `memory:edit` | renderer → main | `{ id: number, content: string }` | `{ ok: boolean }` — SUPERSEDE old row with new content at same category/confidence |
| `memory:stats` | renderer → main | `{}` | `MemoryStats` object |
| `memory:consolidate` | renderer → main | `{}` | `{ merged: number }` |
| `memory:extract-facts` | main internal | `{ exchange: Exchange }` | `MemoryRecord[]` inserted — used by extractor.js calling OpenAI |
| `memory:model-ready` | main → renderer | `{}` | event; renderer shows ready indicator |

**Memory management UI hooks:** The renderer memory-management panel (Phase 6 polishes the full UI; Phase 2 delivers the functional IPC surface) calls `memory:list` on open, `memory:search` on query input, `memory:delete` on user-initiated removal, `memory:edit` on inline edit, and `memory:stats` for the footer count display. Phase 2 delivers a minimal functional panel in `panel.js`; Phase 6 applies full UX polish.

---

## 11. Edge Cases & Failure Modes

| Scenario | Handling |
|---|---|
| Model download fails (offline / first run) | `embedder.js` catches fetch error; logs to `activity` table; `recall()` returns `[]` gracefully; `remember()` still writes episodic row (embedding stored as NULL, flagged for backfill); UI shows "Memory offline — embeddings will sync when connected" |
| Embedding fails for a specific text | Catch per-call; store episodic row with NULL embedding; skip semantic upsert; log to activity; no crash |
| Huge transcript (>4000 tokens) | Chunk with 200-token overlap before extraction (described in §5); chunked independently, merged before upsert |
| Contradictory facts | Detected at extraction time (LLM extraction prompt includes: "if this contradicts a known fact, set action=supersede"); SUPERSEDE old row, insert new — both preserved in history |
| Mem0 adapter cold-start slow | `getMemoryStore()` is async; first `recall()` call during session startup is awaited with a 3-second timeout; timeout → fall back to baseline for this session only; logged to activity |
| `memories_episodic` append races (concurrent sessions) | `node:sqlite` WAL mode + synchronous `DatabaseSync` API; writes are serialized by the Node event loop in the main process; no concurrent write race |
| User deletes a semantic fact referenced by `source_episodic_id` | Soft-delete only (`deleted_at`); episodic row untouched; FK remains valid; fact simply excluded from recall/injection |
| Consolidation LLM call fails | Log error; leave cluster unchanged; retry next scheduled consolidation cycle |
| Memory injection bloats instructions past token limit | Injection block is capped at 20 facts × 120 chars + 3 episodic summaries × 80 chars ≈ ~2800 chars max; safe for all OpenAI Realtime session instruction limits |

---

## 12. Definition of Done & Test Cases

**Reference:** `testing-plan.md` does not exist yet; the cases below are the authoritative test definitions for Phase 2.

All tests in `test/memory.test.js`, run via `node --test`:

| Test ID | Description | Pass condition |
|---|---|---|
| MEM-01 | Append-only invariant | After 10 `remember()` calls: `SELECT COUNT(*) FROM memories_episodic` = 10; no row has been modified or deleted |
| MEM-02 | Cross-session recall | Write fact in session A (fresh DB). Close store. Re-open store (new instance, same DB path). `recall("dog name")` returns a result containing "Mochi" |
| MEM-03 | Episodic write never fails silently | Mock the OpenAI extraction call to throw. Verify episodic row was written before the throw. |
| MEM-04 | Soft-delete semantic | Insert semantic row. Call `memory:delete` IPC. Verify `deleted_at IS NOT NULL`. Verify `recall()` does not return the row. Verify episodic table is unchanged. |
| MEM-05 | Supersede on edit | Call `memory:edit` on a semantic row. Verify old row has `superseded_by_id` set + `deleted_at` set. Verify new row exists with updated content. |
| MEM-06 | No-op on episodic delete attempt | Call `memory:delete` with an episodic row id. Verify it returns `{ ok: false }` and no rows are modified. |
| MEM-07 | Cosine scoring | Three facts inserted: one highly relevant, one tangential, one unrelated. `recall("dog name", 3)` returns relevant fact first. |
| MEM-08 | Consolidation merges near-duplicates | Insert two semantic rows with cosine > 0.9. Run `consolidate()`. Verify both old rows have `superseded_by_id` set. Verify one new merged row exists. Verify `{ merged: 1 }` returned. |
| MEM-09 | Injection block is backward-compatible | Call `buildRealtimeInstructions()` with no args. Verify output is identical to pre-Phase-2 output. |
| MEM-10 | Injection block appears with memories | Call `buildRealtimeInstructions({ profile, memory: [mockFact] })`. Verify "What You Know About the User" heading present in output. |
| MEM-11 | Mem0 adapter spike — cross-session recall | Same as MEM-02 but using `mem0-store.js`. Verify pass. |
| MEM-12 | Mem0 adapter spike — no cloud calls | Run MEM-11 with network mocked off. Verify no network errors thrown. |
| MEM-13 | Stats returns correct counts | Insert 5 episodic, 3 semantic (1 soft-deleted). `stats()` returns `{ episodic_count: 5, semantic_count: 2, semantic_deleted_count: 1 }`. |

---

## 13. Task Breakdown (for execution)

Ordered by dependency:

1. **(S)** Schema: add `memories_episodic` + `memories_semantic` to `database.js` `applySchema()` + indexes.
2. **(S)** `MemoryStore` interface JSDoc + `cosine.js` pure function + `memory-store.js`.
3. **(M)** `embedder.js` — transformers.js singleton, lazy init, `hf-cache` in userData, `memory:model-ready` IPC event.
4. **(L)** `baseline-store.js` — full impl: `remember`, `recall` (scoring formula), `upsertFact` (ADD/UPDATE/SUPERSEDE), `stats`.
5. **(M)** `extractor.js` — episodic append, async OpenAI extraction, `upsertFact` per result, chunking for large transcripts.
6. **(M)** `prompts.js` injection — `buildRealtimeInstructions` `memory` param; "What You Know" + "Recent Context" blocks; backward-compat guard.
7. **(M)** `main.js` `openai:create-realtime-secret` handler update — recall before building instructions; `memory:*` IPC handlers; `preload.js` bridge.
8. **(M)** `memory-tools.js` + `tool-schemas.js` + `tool-permissions.js` + `tools/index.js` dispatch.
9. **(M)** `consolidator.js` — similarity matrix, cluster detection, LLM merge, SUPERSEDE chain.
10. **(M)** `mem0-store.js` spike + validation against MEM-11/MEM-12 criteria; document in `.wal/mem0-spike-results.json`.
11. **(M)** Minimal memory panel in `panel.js` wired to `memory:list/search/delete/edit/stats` IPC.
12. **(S)** `test/memory.test.js` — all 13 test cases passing under `npm test`.
