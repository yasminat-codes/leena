---
id: "101"
title: "Activity screen: mock to real data"
type: feature
status: pending
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
attempts: 0
created_at: "2026-06-01"
---

## Objective
Replace the Activity screen's mock conversation list with live episodic memory queries, and wire the search box to FTS5 full-text search with pagination.

## Why This Matters
Activity is the user's conversation history — the core feedback loop showing Leena remembers. Broken search or missing history erodes the "she knows me" promise.

## Steps
1. Remove all fixture arrays from the Activity screen module; replace with an `async loadActivity(page, query)` function that calls `window.leena.invoke('memory:get-episodes', { page, limit: 20, query })`.
2. Render each episodic entry using the existing history-card component: timestamp, role, content preview (truncated to 120 chars), and conversation grouping by conversation_id.
3. Wire the search input's `input` event (debounced 300ms) to re-call `loadActivity(1, searchValue)` — the IPC handler uses FTS5 `MATCH` on episodic content.
4. Implement pagination: "Load more" button at the bottom increments page counter and appends results; disable button when fewer than `limit` results returned.
5. Add empty-state for no results ("No conversations yet" / "No results for '{query}'").
6. Add loading spinner for initial load and search transitions.

## Acceptance Criteria
- [ ] Activity screen displays real episodic memory entries grouped by conversation
- [ ] Search filters results via FTS5 full-text search
- [ ] Pagination loads additional pages without replacing existing results
- [ ] Empty states render for zero conversations and zero search results
- [ ] No mock/fixture data remains in Activity screen code
- [ ] Debounced search does not fire on every keystroke

## Tests Required
- `test/activity-screen-data.test.js` — mock IPC, verify loadActivity pagination logic, verify search debounce, verify empty-state branches

## Outputs
- Modified `src/renderer/screens/activity.js` (or equivalent)
- New `test/activity-screen-data.test.js`

## Interface Contracts
- Depends on `memory:get-episodes` IPC channel (task 063) returning `{ entries: [...], total: number }`
- Downstream: task 107 (conversation history) extends this screen with expandable transcripts and semantic re-rank search

## Handoff Notes
[Filled after completion]

## Errors Encountered
[Filled if errors occur]

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Search returns no results despite data existing | test or user report | 1 occurrence | Verify FTS5 index is built; check tokenizer config |
| Pagination duplicates entries | test failure | 1 occurrence | Verify OFFSET calculation matches page * limit |
| Debounce fires too aggressively | UI jank during typing | noticeable delay | Increase debounce to 400ms or cancel in-flight requests |
