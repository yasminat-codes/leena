---
id: "141"
title: "Chat history and detail wiring"
type: integration
status: completed
wave: 20
priority: high
complexity: M
estimated_tokens: 14000
dependencies: ["140"]
context_files:
  - src/ipc/chat-handlers.js
  - src/renderer/screens/chat.js
  - src/memory/sqlite-memory-store.js
  - test/text-chat.test.js
  - test/conversation-history.test.js
skills: []
tags: [chat, memory, history]
attempts: 1
claim_started: "2026-06-04T02:05:17Z"
completed_at: "2026-06-04T02:36:08Z"
created_at: "2026-06-03"
---

## Objective
Wire Chat workspace to real conversation history, active text streaming, and conversation detail loading.

## Why This Matters
The Chat screen must be operational, not just a polished shell.

## Steps
1. Re-read Wave 13 chat/memory handoff notes before editing.
2. Bind composer to existing `chat:send` and streamed `chat:chunk` events.
3. Load recent conversations from memory using bounded `memory:get-episodes` or conversation APIs.
4. Open conversation detail transcripts in the active area.
5. Preserve main-process ownership of roles/tools.
6. Add tests for send, streaming, history load, and unsafe renderer payload rejection.

## Acceptance Criteria
- [x] User can send a text message from Chat.
- [x] Assistant chunks stream into the active transcript.
- [x] Recent conversations load in the rail.
- [x] Renderer cannot provide system/tool roles or tool schemas.

## Tests Required
- `node --test test/text-chat.test.js test/conversation-history.test.js test/memory-ipc.test.js`
- `npm run check`

## Outputs
- `src/renderer/screens/chat.js`
- Chat/memory tests as needed.

## Outputs Actuals
- `src/renderer/screens/chat.js`: Added Chat controller binding, bounded history loading, stale-guarded conversation detail loading, chunk subscription, provider/model controls, memory persistence, and sanitized send payload history.
- `src/renderer/leena.css`: Added scoped Chat two-pane layout and composer rules that override the command-center `chat-input` component only inside the Chat screen.
- `test/text-chat.test.js`: Added renderer coverage for bounded history loads, escaped history rendering, stale detail rejection, active chunk streaming, memory persistence, and user/assistant-only payload history.
- `test/ui-baseline-smoke.test.js`: Added Chat screenshot capture to the post-MVP baseline harness plus narrow-width rail/composer overlap coverage.
- `tasks/artifacts/post-mvp-ui-baseline/chat.png`: Captured Chat screen proof with the history rail, transcript, composer, and voice dock visible without overlap.

## Interface Contracts
Chat IPC remains main-process-owned and bounded on primary and fallback memory paths.

## Handoff Notes
- Ran required `kencode-search` first for `window.leena.chat.send`; no exact public snippet was available, so implementation followed local Wave 13 contracts and existing IPC tests.
- Main-process chat ownership remains in `src/ipc/chat-handlers.js`; renderer sends only message/provider/model/conversation/message ids plus bounded user/assistant history and never sends tool schemas.
- `memory:get-episodes` history calls are clamped in the renderer before IPC and continue to be clamped in existing IPC/store layers.
- Conversation detail loads are generation-guarded so stale async responses cannot overwrite the active transcript.
- Parent fixed the Chat screenshot proof after the initial baseline placed the rail across both columns and let the command-center `chat-input` CSS collapse the composer. The Chat-specific grid placement and composer overrides now keep the transcript and message controls inside the viewport and above the voice dock.
- Reviewer found a narrow-width overlap at the `max-width: 920px` breakpoint. Fixed by assigning the rail and workspace to separate rows under the breakpoint while preserving the three-column composer grid.
- Parent verification passed after combined Wave 20 integration and reviewer fix: `npm run check`, full `node --test` (623/623), `node --test test/ui-baseline-smoke.test.js`, changed-file `node --check`, and `git diff --check`.

## Errors Encountered
- Initial Chat UI baseline failed because `.settings-card:first-of-type` forced the history rail to span the layout; fixed with Chat-specific grid placement.
- The composer initially inherited later-injected command-center `.chat-input` CSS, collapsing the textarea into the action column; fixed with Chat-screen-scoped child placement.
- Reviewer gate initially failed because the narrow breakpoint reset columns without resetting the base `grid-row: 1` placement; fixed with narrow Chat overlap coverage.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Role injection | Renderer role accepted | Any occurrence | Strip/ignore renderer role |
| History unbounded | Query limit missing | Any occurrence | Clamp pagination |
| Chunk lost | Stream ends without final text | Any failure | Preserve accumulated deltas |
