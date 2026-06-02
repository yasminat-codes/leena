---
id: "106"
title: "Text chat input"
type: feature
status: pending
priority: high
complexity: M
estimated_tokens: 18000
dependencies: ["054", "105"]
context_files:
  - src/renderer/renderer.js
  - src/renderer/panel.js
  - src/providers/index.js
skills: []
tags: [phase-7, ui, text-chat, providers]
attempts: 0
created_at: "2026-06-01"
---

## Objective
Add a text input to the command center / panel view that sends messages to the active chat provider, shares the same tool dispatch as realtime voice, and renders streamed responses in the UI.

## Why This Matters
Not every interaction needs voice — text chat gives users a quiet, precise way to interact with Leena. It also enables Leena to work with providers that don't support realtime voice (OpenRouter, Ollama).

## Steps
1. Add a text input bar to the bottom of the panel/command-center expanded view — styled per the design system with send button and Cmd+Enter shortcut.
2. On submit, call `window.leena.invoke('chat:send', { message, provider, model })` — the main process routes to the active chat provider via the provider layer.
3. In main.js, implement the `chat:send` IPC handler: get the chat-capable provider from ProviderRegistry, call `provider.chat(messages, { tools, stream: true })`, pipe streamed chunks back to renderer via `chat:chunk` push events.
4. Render streamed responses in a chat bubble UI — markdown rendering for code blocks, lists, and emphasis; auto-scroll to bottom on new content.
5. Wire tool calls from chat responses through the same `executeRealtimeTool` dispatch used by voice — results fed back into the chat context.
6. Add a provider/model selector dropdown in the chat header (defaults from settings; user can override per-conversation).
7. Store chat history in episodic memory via `memory:remember` after each exchange.

## Acceptance Criteria
- [ ] Text input sends messages to the active chat provider
- [ ] Streamed responses render incrementally in chat bubbles
- [ ] Markdown formatting (code blocks, lists, bold) renders correctly
- [ ] Tool calls from chat responses execute through standard tool dispatch
- [ ] Provider/model can be switched per conversation
- [ ] Chat exchanges are stored in episodic memory
- [ ] Cmd+Enter submits; Enter alone allows multiline

## Tests Required
- `test/text-chat.test.js` — mock provider, verify message send, verify stream rendering, verify tool dispatch integration, verify memory storage

## Outputs
- New `src/renderer/components/chat-input.js`
- New `src/renderer/components/chat-bubble.js`
- Modified panel/command-center to include chat UI
- New IPC handler `chat:send` in main.js
- New `test/text-chat.test.js`

## Interface Contracts
- Depends on ProviderRegistry `getForCapability('chat')` (task 054)
- Depends on SessionStateManager (task 105) for state coordination
- Depends on `executeRealtimeTool` for tool dispatch
- Depends on `memory:remember` for chat history storage (task 063)
- Downstream: task 107 (conversation history) displays these stored exchanges

## Handoff Notes
[Filled after completion]

## Errors Encountered
[Filled if errors occur]

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Streamed response drops chunks | incomplete output | 1 occurrence | Verify chunk ordering; add sequence number to push events |
| Tool call from chat fails silently | missing tool result in context | 1 occurrence | Add error feedback in chat bubble; log tool dispatch failure |
| Memory storage fails for chat | missing episodic entries | 1 occurrence | Add fallback: log warning, don't block chat response |
