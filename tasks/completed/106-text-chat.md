---
id: "106"
title: "Text chat input"
type: feature
status: completed
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
attempts: 1
claim_started: "2026-06-03T05:05:41Z"
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
- [x] Text input sends messages to the active chat provider
- [x] Streamed responses render incrementally in chat bubbles
- [x] Markdown formatting (code blocks, lists, bold) renders correctly
- [x] Tool calls from chat responses execute through standard tool dispatch
- [x] Provider/model can be switched per conversation
- [x] Chat exchanges return/store episodic memory handoff data
- [x] Cmd+Enter submits; Enter alone allows multiline

## Tests Required
- `test/text-chat.test.js` — mock provider, verify message send, verify stream rendering, verify tool dispatch integration, verify memory storage

## Outputs
- Added `src/renderer/components/chat-input.js`
  - Form-backed textarea + icon send button.
  - Cmd/Ctrl+Enter submits; plain Enter remains multiline.
  - Exposes `setDisabled()`, `clear()`, `focus()`, and `submit()` for host controllers.
- Added `src/renderer/components/chat-bubble.js`
  - Safe DOM markdown rendering without `innerHTML`.
  - Supports paragraphs, unordered lists, fenced code, inline code, strong, and emphasis.
  - Exposes `setContent()`, `appendContent()`, and `setStatus()`.
- Modified `src/renderer/components/command-center.js`
  - Optional `chat` constructor option and `enableTextChat()` / `disableTextChat()` methods.
  - Mounts compact provider/model selectors, message log, chat input, streamed assistant bubble updates, tool status labels, and optional memory write via bridge.
  - Refreshes model choices after provider changes without reusing the old provider's model selection.
  - Leaves provider/model unset until the user explicitly selects a provider so `chat:send` can honor the configured main-process default chat provider/model.
  - Preserves existing default Command Center behavior when `chat` is not supplied.
- Modified `src/renderer/components/command-center.css`
  - Added scoped Command Center chat, input, and bubble styles using existing Leena tokens.
- Added `src/ipc/chat-handlers.js`
  - Standalone `registerChatHandlers()` / `createChatIpcHandlers()` module for `chat:send`.
  - Streams `chat:chunk` events with start/delta/tool_call/tool_result/done/error payloads.
  - Selects explicit provider/model or falls back through `ProviderRegistry` chat capability.
  - Converts low/read-risk realtime tool schemas to chat-completions tool schema shape for default text chat.
  - Denies unadvertised or higher-risk model-selected tool calls with a model-visible permission result instead of executing them.
  - Executes allowed normalized tool calls through `executeRealtimeTool`, adds tool result messages to the chat context, and runs a follow-up model turn for the final answer.
  - Returns memory handoff payload for parent `memory:remember` integration.
- Added `test/text-chat.test.js`
  - Covers provider streaming, provider/model contract, tool dispatch, structured errors, tool schema conversion, markdown-safe bubbles, Cmd+Enter behavior, and optional Command Center chat mounting.

## Interface Contracts
- `src/ipc/chat-handlers.js`
  - Register with `registerChatHandlers({ ipcMain, registry, executeTool, chunkSender })`.
  - Handles `chat:send` payloads: `{ message, messages, provider, model, conversationId, messageId, tools }`.
  - Resolves provider by explicit `provider` or `registry.getDefault('chat')` / `registry.getForCapability('chat')[0]`.
  - Calls `provider.chat({ messages, model, stream: true, tools, toolChoice: 'auto' })`.
  - Default advertised tools are restricted to `low` and `read` permission levels; `write`, `network`, `screen`, `sensitive`, `destructive`, and `unknown` tools are not advertised or executed by text chat.
  - When a provider emits tool calls, the handler appends assistant `tool_calls` plus `role: "tool"` result messages and performs a second provider call without tools to get user-facing text.
  - Accepts provider response forms: string, sync iterable, async iterable, or normalized object chunks.
  - Emits `chat:chunk` payloads: `{ type, conversationId, messageId, sequence, provider, model, delta, content, toolCall, toolResult, error, memory }`.
  - Returns `{ ok, conversationId, messageId, provider, model, content, messages, toolResults, memory }`.
- `src/renderer/components/command-center.js`
  - `new CommandCenter({ chat: { bridge, eventSource, providers, models, provider, model, conversationId } })` enables text chat.
  - Bridge contract can be `bridge.invoke('chat:send', payload)`, `bridge.chat.send(payload)`, or `bridge.sendChat(payload)`.
  - Chunk subscription can be `bridge.onChatChunk(callback)` / `offChatChunk(token)`, DOM `chat:chunk` events, or `source.on('chat:chunk', callback)`.
  - Memory storage is best-effort via `bridge.memory.remember(text, metadata)` or `bridge.invoke('memory:remember', memory)`.
- Parent integration still owns:
  - Import/register chat handlers in `src/main.js`. Completed by parent integration.
  - Expose `chat:send` and `chat:chunk` bridge APIs in `src/preload.js`. Completed by parent integration.
  - Pass `chat: { bridge: window.leena, eventSource: window.leena }` when mounting live Command Center in `src/renderer/renderer.js`. Completed by parent integration.
- Downstream task 107 can consume returned `memory.metadata.conversationId` and handler-returned context messages for conversation history.

## Handoff Notes
- Parent integration should wire:
  1. `registerChatHandlers({ ipcMain, registry: getRegistry(), executeTool: executeRealtimeTool })` in main.
  2. Preload methods for `chat.send(...)` or generic `invoke('chat:send', ...)`, plus `onChatChunk` / `offChatChunk`.
  3. `createCommandCenter({ variant: 'compact', sessionStateManager, chat: { bridge: window.leena } })` or call `liveCommandCenter.enableTextChat({ bridge: window.leena })`.
- This slice intentionally did not edit `src/main.js`, `src/preload.js`, or `src/renderer/renderer.js` because those files are owned by parent integration.
- Stream deltas preserve provider whitespace exactly; tool calls are executed once and are not retried.
- Memory storage failures are swallowed in the renderer so display is not blocked; the handler still returns the memory handoff payload.
- Worker recovery fixed provider/model switching so changing providers clears the previous model and reloads the selected provider's chat models.
- Parent integration registered chat handlers, exposed preload chat APIs/listeners, enabled live Command Center text chat, and added Wave 13 integration coverage.
- Parent integration also gives chat-triggered `computer_use_task` calls the same cancelable abort-controller path as `tools:execute`.
- Reviewer fix preserved OpenAI/OpenRouter streamed `tool_calls` deltas so text chat receives complete tool calls even when providers split JSON arguments across SSE chunks.
- Reviewer fix restricted text-chat tool access to low/read-risk default tools, denied unsafe tool calls, and added the missing follow-up model turn after tool execution.
- Advisor fix preserved the configured default chat provider/model by not sending the first renderer-listed provider unless the user explicitly chooses it.
- Reviewer-fix-2 tightened the renderer IPC boundary: `chat:send` ignores renderer-supplied tool schemas, accepts only renderer `user`/`assistant` history roles, caps chat history/message text, and advertises only the explicit default chat tool allowlist. Local file read tools are not advertised and are denied if emitted by a model.
- Reviewer-fix-2 routes chat-triggered tools through `executeRealtimeToolWithAudit()` so diagnostics, tool activity, and `data:changed` broadcasts match direct `tools:execute`.
- Reviewer-fix-2 fixed OpenRouter `[DONE]` handling so accumulated streamed tool calls flush even when no explicit `finish_reason: "tool_calls"` chunk arrives.
- Gates run:
  - `npm run check`
  - `node --check src/ipc/chat-handlers.js`
  - `node --check src/renderer/components/chat-input.js`
  - `node --check src/renderer/components/chat-bubble.js`
  - `node --check src/renderer/components/command-center.js`
  - `node --check src/providers/openai-provider.js`
  - `node --check src/providers/openrouter-provider.js`
  - `node --check test/text-chat.test.js`
  - `node --check test/provider-openai.test.js`
  - `node --check test/provider-openrouter.test.js`
  - `node --test test/text-chat.test.js`
  - `node --test test/provider-openai.test.js test/provider-openrouter.test.js test/text-chat.test.js`
  - `node --test test/text-chat.test.js test/provider-openrouter.test.js test/wave13-integration.test.js`
  - `node --test`
  - Final parent `node --test` passed 483/483 after advisor fixes
  - Focused reviewer-fix-2 gates passed 44/44 across text chat, OpenRouter, memory, and Wave 13 integration tests

## Errors Encountered
- `kencode-search` was not on PATH, but the MCP `mcp__kencode_search` tools were available and were used before code edits.
- Exact Leena anchors were absent from public kencode literal search; implementation followed local provider/IPC/Command Center contracts.
- Focused tests initially caught trimming of streamed chunk whitespace (`"Hello "` became `"Hello"`); fixed by preserving content deltas while still trimming identifiers.
- Full `node --test` initially caught design-audit failures for hardcoded CSS fallback hex colors and a raw `4px` radius; fixed by using Leena design tokens.
- Reviewer self-review caught provider SSE parsers dropping streamed tool-call deltas; fixed by accumulating OpenAI/OpenRouter `tool_calls` chunks and flushing complete tool calls at `finish_reason: "tool_calls"`.
- Reviewer found text chat could advertise/execute unsafe tools and did not run a post-tool model turn; fixed by low/read-risk tool filtering, permission denial for unsafe tool calls, and a second provider call after tool results.
- Advisor found initial Command Center text chat bypassed `ProviderRegistry` defaults by sending the first renderer-listed provider; fixed by keeping provider/model blank until explicit user selection and adding a regression.
- Reviewer found renderer-supplied chat payloads could forge privileged roles/tool schemas and that chat tools bypassed the standard audit path; fixed by tightening normalization/tool advertising and using audited main-process tool execution.
- Reviewer found OpenRouter could drop accumulated streamed tool calls at `[DONE]`; fixed by allowing the accumulator flush to run after `[DONE]`.
- No remaining errors after final gates.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Streamed response drops chunks | incomplete output | 1 occurrence | Verify chunk ordering; add sequence number to push events |
| Tool call from chat fails silently | missing tool result in context | 1 occurrence | Add error feedback in chat bubble; log tool dispatch failure |
| Memory storage fails for chat | missing episodic entries | 1 occurrence | Add fallback: log warning, don't block chat response |
