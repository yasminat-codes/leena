---
id: "107"
title: "Conversation history and search"
type: feature
status: completed
priority: medium
complexity: M
estimated_tokens: 16000
dependencies: ["101", "064"]
context_files:
  - src/renderer/screens/activity.js
  - src/memory/sqlite-memory-store.js
skills: []
tags: [phase-7, ui, history, search, memory]
attempts: 1
claim_started: "2026-06-03T08:05:33Z"
created_at: "2026-06-01"
---

## Objective
Extend the Activity screen with full conversation history — each conversation expandable to show the complete transcript — and add semantic re-rank search on top of FTS5 text search.

## Why This Matters
FTS5 alone misses conceptual matches ("What did I say about coffee?" should find "I prefer espresso"). Semantic re-rank combines keyword precision with embedding-based recall for better search results.

## Steps
1. Extend the conversation card component to be expandable: click/tap toggles between summary view (first message preview) and full transcript view (all episodic entries for that conversation_id, ordered by created_at).
2. Fetch full transcript on expand via `window.leena.invoke('memory:get-conversation', { conversationId })` — lazy-load, not prefetched.
3. Extend search: after FTS5 returns initial results, call `window.leena.invoke('memory:semantic-search', { query, limit: 20 })` to get embedding-based matches.
4. Merge and re-rank: combine FTS5 results (scored by rank) with semantic results (scored by cosine similarity); de-duplicate by entry id; sort by combined score (0.6 * fts_score + 0.4 * semantic_score).
5. Display re-ranked results with relevance indicator (high/medium match badges).
6. Add conversation date grouping headers (Today, Yesterday, This Week, Older) above the conversation list.

## Acceptance Criteria
- [x] Conversations expand to show full transcript inline
- [x] Transcript loads lazily on expand, not on page load
- [x] Search returns both keyword and semantic matches
- [x] Results are de-duplicated and re-ranked by combined score
- [x] Date grouping headers appear correctly
- [x] Search with no results shows appropriate empty state

## Tests Required
- `test/conversation-history.test.js` — mock IPC, verify expand/collapse, verify re-rank merge logic, verify date grouping, verify de-duplication

## Outputs
- Modified `src/renderer/screens/activity.js`
- New `src/renderer/components/conversation-card.js` (or inline expansion logic)
- New `test/conversation-history.test.js`

## Interface Contracts
- Depends on `memory:get-conversation` IPC (task 063)
- Depends on `memory:semantic-search` IPC (requires embedding search in memory store, task 062)
- Depends on Activity screen base (task 101)
- No downstream dependencies

## Handoff Notes
- Added expandable Activity conversation cards in `src/renderer/components/conversation-card.js`; transcript fetch is lazy on expand via the existing memory bridge and cached per card until the list re-renders.
- Extended `src/renderer/screens/activity.js` with bounded Activity request normalization, hybrid keyword + semantic result merging, entry-id de-duplication, combined scoring (`0.6 * fts + 0.4 * semantic`), relevance badges, and local date grouping headers.
- Verified the live preload bridge exposes `memory.getEpisodes`, `memory.getConversation`, and `memory.recall`; no shared IPC/preload edits were needed.
- Added `test/conversation-history.test.js` coverage for lazy expand/collapse, transcript escaping/order, semantic rerank merging, de-duplication, date grouping, relevance badges, and search empty state.
- Verification passed for changed-file `node --check`, scoped Biome check on owned files, focused Activity/conversation tests, full `node --test`, and final combined Wave 14 gates: `npm run check`, `node --test` (515/515), `npm test`, WAL parse, and `git diff --check`.

## Errors Encountered
- Concurrent task 108 edits briefly blocked full `npm run check` while the nudge worker was still formatting owned files. No task 107 code changes were required; combined Wave 14 gates passed after task 108 completed.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Semantic search returns irrelevant results | user report or test | >30% irrelevant in top 5 | Adjust score weighting; increase FTS weight |
| Expand triggers full page re-render | performance issue | noticeable jank | Use DOM insertion instead of full re-render |
| Date grouping wrong for timezone | off-by-one on day boundary | 1 occurrence | Use local date comparison, not UTC |
