# Phase 6 — UI / UX

## Goal & Exit Criteria

**Goal:** Deliver a polished, personalizable desktop experience. The window becomes a first-class surface — resizable, skimmable, and conversational — not just an orb you talk at.

**Exit criteria (all must pass):**

1. **Resize + persist:** In panel mode the user can drag the window edge to any size within bounds; the size survives quit-and-relaunch.
2. **Skins switchable:** At least three built-in skins (dark, light, midnight); switching in settings takes effect without restart; choice persists across launches.
3. **Text-chat panel works:** User can type a message, receive a streamed reply, and trigger any registered tool — identical behaviour to a voice turn (same `executeRealtimeTool` path).
4. **Conversation history searchable:** History list shows past sessions from the episodic memory store; full-text and semantic search returns relevant sessions; clicking a result opens the exchange.

---

## Design

### 1. Theme / Skin System

**What:** Replace all hard-coded colour/radius/blur values in `styles.css` (1 862 lines) with CSS custom properties. Scope token declarations to `:root[data-theme="<name>"]` so switching is a single attribute write; no JS re-renders required.

**Token categories:**

| Category | Example tokens |
|---|---|
| Colour — surface | `--clr-bg-base`, `--clr-bg-elevated`, `--clr-bg-overlay` |
| Colour — text | `--clr-text-primary`, `--clr-text-secondary`, `--clr-text-accent` |
| Colour — interactive | `--clr-accent`, `--clr-accent-hover`, `--clr-destructive` |
| Colour — status | `--clr-listening`, `--clr-speaking`, `--clr-idle` |
| Radii | `--radius-sm`, `--radius-md`, `--radius-pill` |
| Blur | `--blur-panel`, `--blur-overlay` |
| Font | `--font-body`, `--font-mono`, `--font-size-sm`, `--font-size-md` |
| Motion | `--dur-fast`, `--dur-normal`, `--ease-default` |

**Built-in skins:**

- `dark` (current default — near-black surfaces, electric-purple accent)
- `light` (white/off-white surfaces, same accent family, reduced blur)
- `midnight` (deep navy, cyan accent, higher contrast)

**Theme switcher:** A `<select>` or icon-button row in the settings panel (already exists in `panel.js`). On change: write `document.documentElement.dataset.theme = name`; call `settings:set({ theme: name })` via `window.brah`. On load: read `settings:get('theme')` and apply before first paint to avoid flash.

**Frameless/transparent window stays unchanged.** Token refactor is pure CSS; no Electron window property changes.

---

### 2. Resizable Window

**Current behaviour:** `setMainWindowMode` in `main.js` pins `setMinimumSize` = `setMaximumSize` = mode dimensions, then the `resize` event listener calls `enforceModeBounds` to snap back any OS-driven resize (the macOS screen-capture guard). `resizable: false` is set at `BrowserWindow` construction.

**Target behaviour:**

- **orb and call modes: unchanged.** Both remain locked (min = max, `resizable: false`). Call is a transient overlay; orb is a fixed-size ambient widget.
- **Panel mode only:** relax the lock. Set `resizable: true` and expand bounds:
  - min: 340 × 480 (narrower than default is unreadable)
  - max: 900 × 1 200 (beyond this overlaps too much desktop real estate)
  - default (first launch): 440 × 600 (current value, unchanged)

**`enforceModeBounds` guard:** The existing guard snaps the window back to exact mode dimensions on every resize event — it must be conditioned: skip the snap if `windowMode === 'panel'`. The macOS screen-capture auto-resize only expands the window; the existing comment in `main.js` confirms this. In panel mode the user's intentional resize must win. The guard still fires for orb/call.

**Persist size via `window-state-store.js`:** The current store only persists `{ x, y }` (window position). Extend it:

- Add `loadWindowSize(storePath)` / `saveWindowSize(size, storePath)` alongside the existing position functions. Both use the same `settings` table in `brah.db` with a new key `window_size_panel`.
- `normalizeWindowSize(value)` validates `{ width, height }` as finite integers clamped to the panel bounds.
- In `main.js`, after `setMainWindowMode('panel')` completes, load the persisted size and call `mainWindow.setSize(width, height)`.
- On `mainWindow.on('resize')` in panel mode (after the `enforceModeBounds` guard is skipped), debounce (300 ms) and call `saveWindowSize`.

**`window:set-size` IPC** (already spec'd in `ipc-api-spec.md`):

```
window:set-size  R→M  { width: number, height: number }  → { width, height }  (clamped)
```

Handler in `main.js`: clamp to panel bounds, call `mainWindow.setSize`, return applied values. Only valid when `windowMode === 'panel'`; returns an error for other modes.

---

### 3. Expandable Text-Chat Panel

**What:** A typed-input surface inside the panel view. Appears below the existing voice/tool activity area. The user types a message, hits Enter or clicks Send, and receives a streamed reply — same tool dispatch, same memory injection, same permission gating as a voice turn.

**Layout (index.html + panel.js):**

- A `<div id="chat-history">` scrollable message list, hidden when empty.
- A `<div id="chat-input-row">` with a `<textarea id="chat-input">` (auto-growing, max 4 lines) and a Send `<button>`.
- The input row is always visible in panel mode; history expands upward as messages accumulate.
- Voice and text coexist: a live voice call pushes `assistant` bubbles into the same history list so there is one unified transcript per session.

**Backend path:**

`chat:send` IPC → `main.js` handler → dispatches to the realtime/tool backend. Two sub-paths:

1. **Realtime session active:** inject as a `conversation.item.create` + `response.create` data-channel event (same as a text injection used in testing). Response tokens arrive via the existing `response.output_audio.delta` / `response.text.delta` realtime events and are mirrored to the renderer via `chat:token` push.
2. **No active realtime session (text-only mode — ADR-8 opt-in):** call the Chat Completions API (`gpt-4o-mini` by default, configurable via `settings:set({ textModel: '...' })`). Tools are translated to OpenAI function-calling format (the same schemas already in `tool-schemas.js`). Tool calls are executed via `executeRealtimeTool` identically. This avoids opening a realtime session (and paying realtime-minute pricing) for a typed exchange. The user can toggle text-only mode in settings; it is off by default (realtime session is used when available).

**Streaming:** response tokens pushed main→renderer as `chat:token` events:

```
chat:token  M→R  { messageId: string, delta: string, done: boolean }
```

The renderer appends `delta` to the in-progress bubble and marks it complete on `done: true`.

**Message history view:**

- Each message bubble: `{ role: 'user'|'assistant', text, timestamp, messageId }`.
- Bubbles stored in memory (current session only) in `panel.js`; persisted to the episodic memory store at session end alongside voice turns (they are the same conversation).
- Auto-scroll to bottom on new messages; user can scroll up to read earlier in the session without losing their position if new messages arrive (scroll-anchor behaviour).

---

### 4. Conversation History + Search

**What:** A history view accessible from the panel header. Shows past sessions from `memories_episodic` (Phase 2). Each row is a `Conversation` summary (see `ipc-api-spec.md`). Clicking a row expands the full exchange.

**IPC (already spec'd):**

```
conversation:list    R→M  { limit?, offset?, before? }  → Conversation[]
conversation:search  R→M  { query: string, limit? }      → Conversation[]
```

`conversation:list` pages through episodic sessions newest-first.
`conversation:search` uses SQLite FTS5 over the stored transcript text (full-text) plus, if the Phase 2 embedding store is populated, a cosine-similarity pass over the top FTS5 candidates (semantic re-rank). Returns at most 20 results.

**UI:**

- A "History" icon button in the panel header toggles a history sidebar/sheet that overlays the main panel view.
- Search input at the top of the history view; results filter live after 300 ms debounce.
- Each row: date, conversation summary, message count. Clicking expands to a read-only transcript.
- "Jump to" button restores the session's context summary into the current session instructions (soft context injection, not a full memory replay).

---

### 5. Proactive Nudges

**What:** Opt-in surface. Lena surfaces timely reminders without being asked. Examples: a task due soon, a calendar item in 15 minutes, a semantic memory ("you mentioned wanting to follow up with X last Tuesday").

**How:**

- A `NudgeScheduler` class in `main.js` (or a small `src/nudge-scheduler.js` module). Runs on a `setInterval` (default: every 5 minutes while the app is in the foreground; paused when screensaver/lock screen is active via `powerMonitor`).
- Each tick: query `planner:list-tasks` for items due within the next 2 hours; query `memories_semantic` for facts flagged with a `remind_at` timestamp; merge and deduplicate against a `lastNudgedAt` map (avoid re-nudging for 1 hour per item).
- If nudges exist: push a `nudge:available` M→R event with a count badge. The panel renders a subtle indicator (dot on the orb or a banner in panel mode). The user can expand to see the list or dismiss all.
- **Frequency guardrails:** max 3 nudges per hour; min 10 minutes between any two nudges; dismiss-all silences for 2 hours.
- **Opt-in:** disabled by default. Settings toggle `nudgesEnabled: boolean`. When disabled, the scheduler does not start.

**No pop-ups.** Nudges appear inside the Lena window only, never as OS notifications (no `Notification` API calls). This avoids notification-permission friction and respects focus.

---

## File-Level Changes

| File | Change |
|---|---|
| `src/renderer/styles.css` | Refactor all hard-coded values to CSS custom property references; add token declarations per skin under `:root[data-theme="…"]` blocks at the top of the file. Do not change any selector/layout logic. |
| `src/renderer/index.html` | Add `data-theme="dark"` to `<html>`; add `#chat-history`, `#chat-input-row`, `#chat-input`, `#send-btn` elements inside the panel section; add `#history-sidebar` overlay structure. |
| `src/renderer/panel.js` | Wire chat input (keydown Enter, Send click → `window.brah.invoke('chat:send', …)`); handle `chat:token` push events to stream bubbles; render history list and search from `conversation:list` / `conversation:search`; apply theme on settings load; render nudge indicator on `nudge:available`. |
| `src/renderer/renderer.js` | In `stopCall`, mirror final voice transcript turns into the chat history list. Apply `data-theme` on initial settings load (before `DOMContentLoaded` flash). Register `chat:token` and `nudge:available` listeners. |
| `src/main.js` | (a) Relax panel-mode bounds: `resizable: true`, set min/max to panel bounds range instead of fixed size. (b) Condition `enforceModeBounds` to skip when `windowMode === 'panel'`. (c) `window:set-size` IPC handler. (d) Load/save panel size via extended `window-state-store`. (e) `chat:send` IPC handler (realtime injection + text-only fallback). (f) `NudgeScheduler` init; `nudge:available` push. |
| `src/realtime/tools/window-state-store.js` | Add `loadWindowSize`, `saveWindowSize`, `normalizeWindowSize` alongside existing position functions. Use key `window_size_panel` in the `settings` table. |
| `src/nudge-scheduler.js` (new) | `NudgeScheduler` class: `start()`, `stop()`, `tick()`, `dismiss(id)`, `dismissAll()`. Reads planner + semantic memory; enforces frequency guardrails; emits via passed-in `emit` callback. |

---

## IPC Additions

All channels are defined in `ipc-api-spec.md` Phase 1 and Phase 6 sections; summarised here for quick reference:

| Channel | Dir | Args | Returns | Phase spec |
|---|---|---|---|---|
| `window:set-size` | R→M | `{ width, height }` | `{ width, height }` clamped | Phase 1 |
| `settings:get` / `settings:set` | R→M | `key?` / `patch` | `Settings` | Phase 1 |
| `chat:send` | R→M | `{ text, conversationId? }` | `{ messageId, conversationId }` | Phase 6 |
| `chat:token` | M→R push | `{ messageId, delta, done }` | — | Phase 6 |
| `conversation:list` | R→M | `{ limit?, offset?, before? }` | `Conversation[]` | Phase 6 |
| `conversation:search` | R→M | `{ query, limit? }` | `Conversation[]` | Phase 6 |
| `nudge:available` | M→R push | `{ count: number, items: Nudge[] }` | — | Phase 6 new |

`Settings` gains two new fields:

```ts
{
  theme: string,          // skin name, default 'dark'
  textModel: string,      // Chat Completions model for text-only mode, default 'gpt-4o-mini'
  nudgesEnabled: boolean, // proactive nudges opt-in, default false
  // existing fields unchanged
}
```

`Nudge`:

```ts
{
  id: string,
  source: 'planner' | 'memory',
  text: string,
  dueAt?: number,   // unix ms, for planner items
  itemId: string    // task id or memory id
}
```

---

## Edge Cases

**1. Resize vs macOS screen-capture auto-resize guard.**
The existing `enforceModeBounds` listener fires on every `resize` event specifically to counteract macOS silently expanding the frameless/transparent window during screen capture. The fix is surgical: `if (windowMode === 'panel') return;` at the top of `enforceModeBounds`. This disarms the guard for panel mode only. For orb/call the guard continues unchanged. If a future macOS version expands the panel window during capture, the worst outcome is the user's panel grows slightly — tolerable, and corrected on the next manual resize or quit-relaunch. Do not add a secondary size-enforcement timer; it fights the user's resize intent.

**2. Transparent-window resize artifacts.**
Electron's `transparent: true` windows can leave painting artifacts at new edges during live resize on macOS (especially with `vibrancy` or backdrop-filter). Mitigation: use CSS `will-change: transform` on the root panel element; ensure no `backdrop-filter` is applied to elements that touch the window edge. If artifacts persist, a `mainWindow.webContents.invalidate()` call after resize-end (debounced 200 ms) clears the compositor layer.

**3. Very long chat history within a session.**
The in-session `#chat-history` element must not grow unboundedly. Cap rendered bubbles at 200 (virtual scroll or a "show earlier" button). The underlying data is not capped — all turns go to the episodic store. FTS5 search handles large stores efficiently; no pagination needed until millions of rows.

**4. Nudge fatigue.**
The 3-per-hour cap and 10-minute minimum interval are enforced in `NudgeScheduler.tick()` before the push event fires. Additionally: if the user dismisses all nudges, suppress for 2 hours regardless of new items. On quit-relaunch, `lastNudgedAt` and `dismissedUntil` are persisted to the `settings` table (keys `nudge_last_at` and `nudge_dismissed_until`) so the silence window survives restarts.

**5. `window:set-size` called outside panel mode.**
Return `{ error: 'not_in_panel_mode' }` from the IPC handler without changing window size. The renderer should only expose the resize handle in panel mode; this is a belt-and-suspenders guard.

**6. Theme flash on load.**
Apply `data-theme` in a `<script>` tag in `<head>` (synchronous, before CSS parse) by reading `settings:get('theme')` via `window.brah` synchronously if the preload bridge allows it, or via a `localStorage` write-through cache. The `settings:set` handler must also update `localStorage['lena-theme']` so the renderer can read it synchronously before IPC is ready.

**7. Text-only mode cost with long sessions.**
When using the Chat Completions fallback (`gpt-4o-mini`), the full conversation context is sent each turn. Cap the context window passed to the API at the last 40 messages (~80k tokens ceiling) by slicing `conversationHistory` before the API call. This bounds cost for marathon text sessions.

---

## Definition of Done + Manual QA

### Definition of done (automated)

- `npm test` passes with no new failures.
- `window-state-store.js` unit tests cover `loadWindowSize` / `saveWindowSize` / `normalizeWindowSize` (round-trip, invalid input, clamp).
- `nudge-scheduler.js` unit tests cover: tick with no items returns empty; frequency cap blocks 4th nudge in 1 hour; dismiss-all sets suppressedUntil; persisted silence survives re-instantiation.
- `chat:send` integration test (mock realtime session): sends a text turn, receives a `chat:token` stream, final `done: true` closes the bubble.

### Manual QA checklist

**Resize + persist:**
1. Open panel. Drag the bottom edge to increase height to ~800 px. Quit the app.
2. Relaunch. Confirm panel opens at ~800 px height, not the 600 px default.
3. Resize to minimum (340 × 480). Confirm window snaps to min and does not go smaller.
4. Switch to orb mode. Confirm orb is still fixed size. Switch back to panel. Confirm panel size is still the user-set size, not reset to default.

**Skin switch:**
1. Open settings. Switch from `dark` to `light`. Confirm all surfaces update immediately, no restart required, no layout shift.
2. Switch to `midnight`. Confirm colours change.
3. Quit and relaunch. Confirm `midnight` skin is still active.

**Text chat round-trip:**
1. Ensure no active voice call. Type "What time is it?" and press Enter. Confirm a streaming reply appears in the chat bubble within 3 seconds.
2. Type "Add 'buy milk' to my planner." Confirm tool activity indicator fires and the item appears in the planner list (same as a voice turn would produce).
3. Start a voice call mid-session. Speak a message. Confirm both voice and text turns appear in the unified history list.

**History search:**
1. End a session that included at least 5 messages. Open the history view.
2. Confirm the session appears with a summary and message count.
3. Search for a keyword spoken/typed during that session. Confirm the session appears in results.
4. Click the session row. Confirm the full transcript is readable.

*(Reference `plans/testing-plan.md` once created for the full regression matrix.)*
