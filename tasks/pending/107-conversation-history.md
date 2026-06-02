---
id: "107"
title: "Conversation history and search"
type: feature
status: pending
priority: medium
complexity: M
estimated_tokens: 16000
dependencies: ["101", "064"]
context_files:
  - src/renderer/screens/activity.js
  - src/memory/sqlite-memory-store.js
skills: []
tags: [phase-7, ui, history, search, memory]
attempts: 0
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
- [ ] Conversations expand to show full transcript inline
- [ ] Transcript loads lazily on expand, not on page load
- [ ] Search returns both keyword and semantic matches
- [ ] Results are de-duplicated and re-ranked by combined score
- [ ] Date grouping headers appear correctly
- [ ] Search with no results shows appropriate empty state

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
[Filled after completion]

## Errors Encountered
[Filled if errors occur]

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Semantic search returns irrelevant results | user report or test | >30% irrelevant in top 5 | Adjust score weighting; increase FTS weight |
| Expand triggers full page re-render | performance issue | noticeable jank | Use DOM insertion instead of full re-render |
| Date grouping wrong for timezone | off-by-one on day boundary | 1 occurrence | Use local date comparison, not UTC |
