---
id: "101"
title: "Activity screen: mock to real data"
type: feature
status: completed
priority: high
complexity: M
estimated_tokens: 16000
dependencies: ["014", "063"]
context_files:
  - src/renderer/index.html
  - src/renderer/renderer.js
  - src/memory/sqlite-memory-store.js
skills: []
tags: [phase-7, ui, wire-live, activity]
attempts: 1
claim_started: "2026-06-03T05:05:41Z"
created_at: "2026-06-01"
---

## Objective
Replace the Activity screen's mock conversation list with live episodic memory queries, and wire the search box to bounded SQLite text search with pagination.

## Why This Matters
Activity is the user's conversation history — the core feedback loop showing Leena remembers. Broken search or missing history erodes the "she knows me" promise.

## Steps
1. Remove all fixture arrays from the Activity screen module; replace with an `async loadActivity(page, query)` function that calls `window.leena.invoke('memory:get-episodes', { page, limit: 20, query })`.
2. Render each episodic entry using the existing history-card component: timestamp, role, content preview (truncated to 120 chars), and conversation grouping by conversation_id.
3. Wire the search input's `input` event (debounced 300ms) to re-call `loadActivity(1, searchValue)` — the IPC handler searches episodic content with bounded SQLite `LIKE` query.
4. Implement pagination: "Load more" button at the bottom increments page counter and appends results; disable button when fewer than `limit` results returned.
5. Add empty-state for no results ("No conversations yet" / "No results for '{query}'").
6. Add loading spinner for initial load and search transitions.

## Acceptance Criteria
- [x] Activity screen displays real episodic memory entries grouped by conversation
- [x] Search calls the `memory:get-episodes` adapter with query/page/limit when available; current bridge fallback uses available memory methods until the IPC alias lands
- [x] Pagination loads additional pages without replacing existing results
- [x] Empty states render for zero conversations and zero search results
- [x] Legacy fixture conversation rows removed from Activity live path
- [x] Debounced search does not fire on every keystroke

## Tests Required
- `test/activity-screen-data.test.js` — mock IPC, verify loadActivity pagination logic, verify search debounce, verify empty-state branches

## Outputs
- Modified `src/renderer/screens/activity.js`
  - Replaced static conversation fixtures with `loadActivity({ page, query, limit })`.
  - Added renderer-side adapter that prefers `memory:get-episodes` through `getEpisodes()`/generic `invoke()` and falls back to `window.leena.memory.recall()` for searches or `window.leena.memory.getConversation("default")` for current bridge compatibility.
  - Added live loading, empty, grouped conversation, escaped row rendering, debounced search, and load-more append controller.
  - Preserved the synchronous `renderActivity()` shell route contract by rendering a loading shell and scheduling hydration inside the screen module.
- Modified `src/memory/sqlite-memory-store.js`, `src/ipc/memory-handlers.js`, and `src/preload.js`
  - Added the live `memory:get-episodes` / `window.leena.memory.getEpisodes()` contract backed by SQLite pagination/search across all conversation ids.
- Added `test/activity-screen-data.test.js`
  - Covers IPC payload shape, pagination fallback, append/dedupe behavior, debounce behavior, empty states, escaping, truncation, and conversation grouping.
  - Covers generated chat/realtime conversation ids through the live `getEpisodes()` bridge path.
- Updated `test/memory-ipc.test.js` and `test/memory-sqlite.test.js`
  - Cover `memory:get-episodes` registration, validation, pagination, search, and cross-conversation history.

## Interface Contracts
- Preferred contract: `memory:get-episodes` accepts `{ page: number, limit: number, query: string }` and returns `{ entries: [...], total: number, hasMore?: boolean }`; this is now registered in main IPC and exposed through preload as `window.leena.memory.getEpisodes(options)`.
- Reviewer-fix-2 contract: `memory:get-episodes` clamps renderer-supplied `limit` to 50, `page` to 500, and query text to 200 characters. SQLite search treats `%`, `_`, and `\` as literal characters through escaped `LIKE`, not wildcards.
- Entry fields accepted by renderer: `id`, `conversationId`/`conversation_id`, `role`, `content`, `createdAt`/`created_at`, and optional `metadata`.
- Current bridge compatibility: if the exact `memory:get-episodes` alias is unavailable, search fallback uses `window.leena.memory.recall(query, page * limit)` and empty-query fallback uses `window.leena.memory.getConversation("default")`.
- Downstream: task 107 (conversation history) can extend `data-activity-id` and `data-activity-conversation` rows with expandable transcripts and semantic re-rank search.

## Handoff Notes
- `kencode-search` was run before implementation. No exact reusable Activity feed implementation was found; local renderer screen patterns were used.
- Activity-specific gates passed:
  - `node --check src/renderer/screens/activity.js`
  - `node --check test/activity-screen-data.test.js`
  - `npx biome check src/renderer/screens/activity.js test/activity-screen-data.test.js`
  - `node --test test/activity-screen.test.js test/activity-screen-data.test.js`
- Final full-suite status:
  - `npm run check` passed.
  - `node --test` passed 481/481 after reviewer fixes.
  - `git diff --check` passed.
- Reviewer-fix-2 focused gates passed: `node --test test/memory-ipc.test.js test/memory-sqlite.test.js` and the combined 44/44 reviewer-fix suite.
- Note: `MOCK_ACTIVITY_DATA` remains only as an empty compatibility sentinel for the existing legacy shell test; it is not an array and contains no fixture conversation rows.

## Errors Encountered
- Earlier worker-scope full gates were blocked by active task `106` command-center files; task `106` and the parent integration resolved those blockers. Final parent gates are green.
- Reviewer found Activity could only fall back to `getConversation("default")` because the exact live episodes channel was missing; fixed by adding `memory:get-episodes` to SQLite, IPC, preload, and focused tests.
- Reviewer found renderer-exposed episode pagination/search was unbounded and wildcard-heavy; fixed by clamping limit/page/query size in IPC and store code and escaping `LIKE` input literally.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Search returns no results despite data existing | test or user report | 1 occurrence | Verify the SQLite content query and index-backed pagination path |
| Pagination duplicates entries | test failure | 1 occurrence | Verify OFFSET calculation matches page * limit |
| Debounce fires too aggressively | UI jank during typing | noticeable delay | Increase debounce to 400ms or cancel in-flight requests |
