---
id: "141"
title: "Chat history and detail wiring"
type: integration
status: pending
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
attempts: 0
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
- [ ] User can send a text message from Chat.
- [ ] Assistant chunks stream into the active transcript.
- [ ] Recent conversations load in the rail.
- [ ] Renderer cannot provide system/tool roles or tool schemas.

## Tests Required
- `node --test test/text-chat.test.js test/conversation-history.test.js test/memory-ipc.test.js`
- `npm run check`

## Outputs
- `src/renderer/screens/chat.js`
- Chat/memory tests as needed.

## Interface Contracts
Chat IPC remains main-process-owned and bounded on primary and fallback memory paths.

## Handoff Notes
To be filled by executor.

## Errors Encountered
To be filled if errors occur.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Role injection | Renderer role accepted | Any occurrence | Strip/ignore renderer role |
| History unbounded | Query limit missing | Any occurrence | Clamp pagination |
| Chunk lost | Stream ends without final text | Any failure | Preserve accumulated deltas |
