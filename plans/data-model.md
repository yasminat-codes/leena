# Lena — Data Model

All persistent storage lives in a single SQLite file (`brah.db`, renamed to `lena.db` per Phase 1 — see R-11 below). Engine: `node:sqlite` (`DatabaseSync`). WAL mode + foreign keys ON. Schema applied via `applySchema()` in `src/realtime/tools/database.js`.

---

## 1. Existing Tables and Stores

### 1.1 `tasks` — Planner tasks

Owned by `src/realtime/tools/planner-store.js`.

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| `seq` | INTEGER | PRIMARY KEY AUTOINCREMENT | Stable insertion order for ordered reads |
| `id` | TEXT | NOT NULL UNIQUE | Client-generated stable ID (`task-<slug>-<rand>`) |
| `name` | TEXT | NOT NULL | Short task label |
| `description` | TEXT | NOT NULL DEFAULT `''` | Free-text detail |
| `priority` | TEXT | NOT NULL DEFAULT `'medium'` | Enum: `low` / `medium` / `high` |
| `status` | TEXT | NOT NULL DEFAULT `'todo'` | Enum: `todo` / `in_progress` / `done` |

Access pattern: full replace on save (`DELETE` + INSERT in a transaction); `SELECT … ORDER BY seq` for ordered list. `INSERT OR REPLACE` on single-task create.

### 1.2 `calendar_items` — Planner calendar events

Owned by `src/realtime/tools/planner-store.js`.

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| `seq` | INTEGER | PRIMARY KEY AUTOINCREMENT | Insertion order |
| `id` | TEXT | NOT NULL UNIQUE | Client-generated ID (`calendar-<slug>-<rand>`) |
| `title` | TEXT | NOT NULL | Event title |
| `description` | TEXT | NOT NULL DEFAULT `''` | Free-text detail |
| `date` | TEXT | NOT NULL DEFAULT `''` | ISO-8601 date string (YYYY-MM-DD) or empty |
| `time` | TEXT | NOT NULL DEFAULT `''` | HH:MM string or empty |

### 1.3 `activity` — Tool-use activity log

Owned by `src/realtime/tools/activity-store.js`.

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| `seq` | INTEGER | PRIMARY KEY AUTOINCREMENT | Tie-break ordering |
| `id` | TEXT | NOT NULL UNIQUE | Client-generated UUID |
| `kind` | TEXT | NOT NULL | Enum: `web_search` / `web_fetch` / `computer_use` |
| `time` | TEXT | NOT NULL | ISO-8601 timestamp |
| `data` | TEXT | NOT NULL | JSON blob; shape varies by kind (see below) |

`data` shapes by kind:
- `web_search`: `{ query, resultCount, results: [{ title, url, snippet }] }` — text clamped to 300/600/400 chars
- `web_fetch`: `{ url, title, text }` — text clamped to 600 chars
- `computer_use`: `{ task, statusText, screenshot? }` — task 600 chars, statusText 60 chars

Index: `idx_activity_kind_time ON activity (kind, time)` — supports per-kind listing and pruning.

Retention: capped at 50 entries per kind; oldest pruned on insert.

### 1.4 `settings` — Key-value store

Used by `agent-profile-store.js`, `window-state-store.js`, and `microphone-store.js`. Not queried in bulk; each store reads its own key.

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| `key` | TEXT | PRIMARY KEY | Logical store name |
| `value` | TEXT | NOT NULL | JSON blob or raw string |

Known keys:

| Key | Value format | Owned by |
|---|---|---|
| `agent_profile` | JSON: `{ name, voice, persona }` | `agent-profile-store.js` |
| `window_position` | JSON: `{ x, y }` (integers) | `window-state-store.js` |
| `microphone_device_id` | Raw string (OS device ID) or absent | `microphone-store.js` |

**Agent profile fields** (JSON stored under `agent_profile`):
- `name` — user's name (string, empty = unknown); injected into session instructions as "The user's name is …"
- `voice` — OpenAI Realtime voice ID (enum: one of `REALTIME_VOICES`); default `DEFAULT_VOICE`
- `persona` — persona preset key (enum: keys of `AGENT_PERSONAS`); controls the tone/style block injected into instructions

Phase 3 extends this with free-text identity fields — see Section 4.

### 1.5 Screenshots — Filesystem (not SQLite)

Screenshots are PNG/JPEG files, not database rows. Stored in `{userData}/screenshots/`. Listed, revealed, and deleted via IPC handlers in `main.js` (`screenshots:list`, `screenshots:reveal`, `screenshots:delete`). Not indexed in SQLite; no row-level metadata. The `computer_use` activity entry may reference a screenshot by name inside its `data` JSON blob.

---

## 2. New Memory Tables (Phase 2)

Implemented as part of `src/realtime/memory/` (new module). Added to `applySchema()` via an `ALTER TABLE`-safe migration block.

### 2.1 `memories_episodic` — Append-only conversation log

The "never forget" guarantee. Rows are never deleted or updated. Every conversation exchange is written here at session end by the `MemoryStore.remember()` call.

```sql
CREATE TABLE IF NOT EXISTS memories_episodic (
  id               TEXT    PRIMARY KEY,           -- UUID v4
  conversation_id  TEXT    NOT NULL,              -- groups turns from one session
  raw_exchange     TEXT    NOT NULL,              -- JSON: [{ role, content }] verbatim turns
  extracted_facts  TEXT    NOT NULL DEFAULT '[]', -- JSON array of fact strings; filled by consolidate()
  created_at       TEXT    NOT NULL,              -- ISO-8601 timestamp; set on insert, never changed
  embedding        BLOB                           -- 384-dim float32 little-endian; NULL until embed job runs
);
CREATE INDEX IF NOT EXISTS idx_episodic_conversation ON memories_episodic (conversation_id);
CREATE INDEX IF NOT EXISTS idx_episodic_created ON memories_episodic (created_at);
```

**Embedding:** 384-dimensional float32 vector produced by `Xenova/all-MiniLM-L6-v2` (transformers.js, in-process). Stored as a BLOB of `384 * 4 = 1536` bytes, little-endian float32. NULL on insert; backfilled asynchronously by the embedding worker. Similarity search via brute-force cosine in JS (see Section 5).

### 2.2 `memories_semantic` — Consolidated fact store

Deduplicated, queryable facts extracted from episodic memory. The primary recall surface for prompt injection. Facts can be superseded (soft-deprecated) but not hard-deleted, so the chain of updates is traceable.

```sql
CREATE TABLE IF NOT EXISTS memories_semantic (
  id                TEXT    PRIMARY KEY,           -- UUID v4
  fact              TEXT    NOT NULL,              -- human-readable fact string
  category          TEXT    NOT NULL,              -- see enum below
  confidence        REAL    NOT NULL DEFAULT 1.0,  -- 0.0–1.0; decays on contradiction
  first_seen        TEXT    NOT NULL,              -- ISO-8601; set on insert
  last_seen         TEXT    NOT NULL,              -- ISO-8601; updated on re-confirmation
  source_episode_ids TEXT   NOT NULL DEFAULT '[]', -- JSON array of memories_episodic.id
  superseded_by     TEXT,                          -- FK → memories_semantic.id (NULL = current)
  embedding         BLOB                           -- 384-dim float32; same encoding as episodic
  -- FOREIGN KEY (superseded_by) REFERENCES memories_semantic(id) -- enabled when PRAGMA foreign_keys=ON
);
CREATE INDEX IF NOT EXISTS idx_semantic_category ON memories_semantic (category);
CREATE INDEX IF NOT EXISTS idx_semantic_last_seen ON memories_semantic (last_seen);
```

**`category` enum** (enforced in application layer, not SQL CHECK):

| Value | Meaning |
|---|---|
| `preference` | User likes/dislikes, habits, working style |
| `biographical` | Name, location, job, relationships, background facts |
| `decision` | Choices the user has made; conclusions reached in conversation |
| `instruction` | Explicit directives: "always do X", "never do Y" |
| `procedural` | How Lena should execute tasks; standing operating procedures |

**Procedural memory** is not a separate table. It is `category = 'procedural'` rows in `memories_semantic`. Semantically, procedural facts read as "when asked to do X, do it this way." They are injected into session instructions ahead of other categories to maximize their effect on Lena's behavior.

**Long-term vs. working memory** is not a separate store. It is a recency scoring axis applied at recall time: `MemoryStore.recall(query, k)` computes a combined score = `cosine_similarity(embedding, query_embedding) * recency_weight(last_seen)`. Recent confirmations raise `last_seen`; low `confidence` rows are skipped or ranked last. There is no separate "working memory table."

**Supersession:** when a new fact contradicts an old one (detected during `consolidate()`), the old row's `superseded_by` is set to the new row's `id`. Queries filter `WHERE superseded_by IS NULL` to get current facts only.

---

## 3. New `mcp_servers` Table (Phase 4)

Tracks configured MCP servers. Owned by the new `src/realtime/tools/mcp-client.js` manager. Added to `applySchema()` in the Phase 4 migration block.

```sql
CREATE TABLE IF NOT EXISTS mcp_servers (
  id                   TEXT    PRIMARY KEY,          -- UUID v4
  name                 TEXT    NOT NULL UNIQUE,       -- human label, e.g. "composio"
  transport            TEXT    NOT NULL,              -- enum: 'stdio' | 'http'
  url_or_command       TEXT    NOT NULL,              -- HTTP: full URL; stdio: absolute path to binary
  args                 TEXT    NOT NULL DEFAULT '[]', -- JSON array of strings; argv for stdio servers
  enabled              INTEGER NOT NULL DEFAULT 1,    -- boolean (0/1); disabled = not loaded at startup
  approved_tool_hashes TEXT    NOT NULL DEFAULT '{}', -- JSON: { toolName: sha256hex } approved definitions (ADR-6)
  created_at           TEXT    NOT NULL               -- ISO-8601 timestamp
);
```

**`transport` semantics:**
- `stdio` — binary launched as a child process; `url_or_command` is the executable path; `args` is `StdioServerParameters.argv`. Note R-9: PATH must be resolved from the login shell at startup.
- `http` — `StreamableHTTPClientTransport`; `url_or_command` is the base URL; `args` unused.

**`approved_tool_hashes`:** JSON map of `toolName → SHA-256 hex` of the tool's `inputSchema` JSON at approval time. On reconnect, definitions are re-hashed; any drift triggers a re-prompt before the tool is made available (ADR-6).

---

## 4. Extended Identity Fields (Phase 3)

The `agent_profile` settings key is extended in-place (backwards-compatible: missing keys fall back to defaults). No new table needed.

New fields added to the JSON value of `settings` where `key = 'agent_profile'`:

| Field | Type | Purpose |
|---|---|---|
| `personality` | string (free text) | User-authored personality description injected verbatim into session instructions |
| `tone` | string (free text) | Communication style override (replaces the persona's default tone block when set) |
| `rules` | string (free text) | Standing instructions/constraints; injected as a mandatory rules block |
| `persona_presets` | JSON array of `{ key, label, instructions }` | User-defined switchable persona modes; extends the built-in `AGENT_PERSONAS` enum |

`buildAgentInstructions()` in `src/realtime/prompts.js` is updated to read and inject these fields. When `personality`/`tone`/`rules` are non-empty they take precedence over the selected `persona` preset's defaults. The `normalizeAgentProfile()` function is updated to pass these fields through (trimmed strings, default empty).

---

## 5. Embeddings

| Aspect | Detail |
|---|---|
| Model | `Xenova/all-MiniLM-L6-v2` via `@huggingface/transformers` (WASM, in-process, no GPU required) |
| Dimensions | 384 |
| Storage encoding | BLOB; 384 × 4 = 1536 bytes; little-endian float32 array |
| When generated | Asynchronously after row insert; NULL until backfill completes |
| Recall method | Brute-force cosine similarity in JS — `dot(a,b) / (|a| * |b|)` over all non-NULL rows |
| Performance | <5 ms at personal scale (<10k rows); acceptable per ADR-2 |

**Why not `sqlite-vec`:** `node:sqlite` on macOS compiles with `OMIT_LOAD_EXTENSION`; extension loading is impossible. This is confirmed and tracked as R-4 (High likelihood, Low impact at personal scale).

**Scale-up path (R-4 mitigation):** If the memory store grows beyond ~10k rows (latency >50ms per recall), replace `node:sqlite` with `better-sqlite3` (which supports `loadExtension`) and load `sqlite-vec` as a native addon via `asarUnpack` — the same pattern used for `@nut-tree-fork/nut-js`. This is a drop-in swap at the storage layer behind the `MemoryStore` interface; no callers change.

---

## 6. Relationships, Indexes, and Migration Notes

### Relationships

```
memories_episodic
  └── id ←── source_episode_ids (JSON array) ── memories_semantic

memories_semantic
  └── id ←── superseded_by (self-FK) ── memories_semantic

settings (key='agent_profile') → consumed by agent-profile-store.js + prompts.js
settings (key='window_position') → consumed by window-state-store.js
settings (key='microphone_device_id') → consumed by microphone-store.js

mcp_servers.id → referenced by runtime MCP client session map (in-memory only)
```

All tables share one database file. `PRAGMA foreign_keys = ON` is set at connection open; the `superseded_by` self-FK on `memories_semantic` is enforced at runtime.

### Full index list

| Index | Table | Columns | Purpose |
|---|---|---|---|
| `idx_activity_kind_time` | `activity` | `(kind, time)` | Per-kind listing + pruning (existing) |
| `idx_episodic_conversation` | `memories_episodic` | `(conversation_id)` | Load all turns for a session |
| `idx_episodic_created` | `memories_episodic` | `(created_at)` | Chronological scan for consolidation |
| `idx_semantic_category` | `memories_semantic` | `(category)` | Filter by type (procedural injection, etc.) |
| `idx_semantic_last_seen` | `memories_semantic` | `(last_seen)` | Recency scoring at recall time |

### Migration notes — R-11 (brah.db → lena.db rename)

R-11 flags that renaming `brah.db` and the bundle ID `com.unstablemind.brah` would orphan existing user data, keychain entries, and TCC (privacy) permissions.

**Decision to be finalized in Phase 1:**

Option A — **Keep bundle ID stable, change only `productName`:** `brah.db` path stays the same (derived from `app.getPath('userData')` which uses the bundle ID). Zero data migration needed. Display name becomes "Lena." This is the lower-risk path.

Option B — **Full rename (bundle ID + db file):** Requires a one-time migration at first launch: detect the old `userData` path (`com.unstablemind.brah`), copy `brah.db` to the new path as `lena.db`, set the new `getDatabasePath()` to return `lena.db`, and re-pair TCC permissions (screen recording, accessibility, microphone) under the new bundle ID. Keychain entries under `safeStorage` are **not portable** — the user must re-enter their OpenAI token.

**Code impact:** `getDatabasePath()` in `database.js` currently returns `path.join(getUserDataPath(), "brah.db")`. Under Option A this string is never changed. Under Option B it becomes `lena.db` and a migration shim is added alongside `migrateLegacyStores()`.

Until Phase 1 makes the call, all new tables (`memories_episodic`, `memories_semantic`, `mcp_servers`) are added to whichever file path is active — no separate db file for new tables.
