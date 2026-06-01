# IPC API Specification — Lena

All communication between renderer and main process flows through Electron IPC.
`contextIsolation: true`, `nodeIntegration: false` — renderer has no Node access.
The `window.brah` bridge (exposed by `src/preload.js` via `contextBridge.exposeInMainWorld`)
is the only surface the renderer may call. All calls are `ipcRenderer.invoke` (request/response)
unless noted as renderer-bound push events (`ipcRenderer.on`). Main process never calls back
into a renderer except via `webContents.send`.

---

## Security model

- `preload.js` runs in the renderer process but has access to `ipcRenderer`.
- `contextIsolation: true` means renderer JS cannot reach `ipcRenderer` directly.
- `window.brah` exposes only the named methods below; all others are blocked.
- Navigation is locked to `file://` (off-origin navigations are preventDefault'd).
- `safeStorage` (system keychain) encrypts all credentials; cleartext storage is refused.

---

## Part 1 — Existing channels (current codebase)

Direction notation: **R→M** = renderer invokes, main handles and returns.
**M→R** = main pushes to renderer (`webContents.send`), renderer listens via `ipcRenderer.on`.

### App

| Channel | Dir | Args | Returns |
|---|---|---|---|
| `app:get-version` | R→M | — | `string` (semver) |
| `app:quit` | R→M | — | `true` |

### Auto-updater

| Channel | Dir | Args | Returns / Payload |
|---|---|---|---|
| `update:check` | R→M | — | `string` (status message; dev-mode guard) |
| `update:status` | M→R | — | `string` message (not-available / error / downloaded) |

### OpenAI / Auth

| Channel | Dir | Args | Returns |
|---|---|---|---|
| `openai:get-status` | R→M | — | `{ connected: boolean, email?: string, accountType?: string }` |
| `openai:login` | R→M | — | same shape as `get-status` |
| `openai:logout` | R→M | — | `{ connected: false }` |
| `openai:create-realtime-secret` | R→M | `options?: object` | Realtime client secret object from OpenAI API |

`create-realtime-secret` merges `profile.voice` and `buildRealtimeInstructions({profile})` into
the options before forwarding to `createRealtimeClientSecret`. Throws if not authenticated.

### Agent profile

| Channel | Dir | Args | Returns |
|---|---|---|---|
| `agent:get-profile` | R→M | — | `AgentProfile` |
| `agent:set-profile` | R→M | `profile: AgentProfile` | `AgentProfile` (saved value) |

`AgentProfile` current fields: `{ name: string, voice: string, persona: string }`.
Normalised by `normalizeAgentProfile` — unknown keys are preserved but coerced.

### Audio

| Channel | Dir | Args | Returns |
|---|---|---|---|
| `audio:get-microphone` | R→M | — | `string \| null` (device ID) |
| `audio:set-microphone` | R→M | `deviceId: string` | `string` (saved value) |

### Planner

| Channel | Dir | Args | Returns |
|---|---|---|---|
| `planner:list-tasks` | R→M | — | `Task[]` |
| `planner:list-calendar` | R→M | — | `CalendarItem[]` |
| `planner:delete-tasks` | R→M | `ids: string[]` | `void` |
| `planner:complete-tasks` | R→M | `ids: string[]` | `void` |
| `planner:delete-calendar-items` | R→M | `ids: string[]` | `void` |

### Activity

| Channel | Dir | Args | Returns |
|---|---|---|---|
| `activity:list` | R→M | `kind?: string` | `ActivityEntry[]` |

### Screenshots

| Channel | Dir | Args | Returns |
|---|---|---|---|
| `screenshots:list` | R→M | — | `ScreenshotMeta[]` (`{ name, size, createdAt }`) |
| `screenshots:reveal` | R→M | `name: string` | `void` (shell reveal in Finder) |
| `screenshots:delete` | R→M | `names: string[]` | `void` |

### Window

| Channel | Dir | Args | Returns |
|---|---|---|---|
| `window:set-mode` | R→M | `mode: 'orb' \| 'call' \| 'panel'` | `void` |
| `window:set-focusable` | R→M | `focusable: boolean` | `boolean` (applied value) |
| `window:minimize` | R→M | — | `boolean` (`true` if minimized) |

### Permissions

| Channel | Dir | Args | Returns |
|---|---|---|---|
| `permissions:get-status` | R→M | — | `OsPermission[]` (`{ id, label, status }`) |
| `permissions:request` | R→M | `id: string` | `{ id, status }` |
| `permissions:open-settings` | R→M | `id: string` | `void` |

### Diagnostics

| Channel | Dir | Args | Returns |
|---|---|---|---|
| `diagnostics:get-log-path` | R→M | — | `string` (absolute path to diagnostics.log) |
| `diagnostics:open-log` | R→M | — | `void` (shell open) |
| `diagnostics:write` | R→M | `event: string, details?: object` | `void` |
| `diagnostics:privacy` | R→M | — | `PrivacyDiagnostics` object |

### Tools

| Channel | Dir | Args | Returns |
|---|---|---|---|
| `tools:get-definitions` | R→M | — | `ToolDefinition[]` (OpenAI function schema array) |
| `tools:execute` | R→M | `name: string, args?: object` | `ToolResult` (`{ status, message?, path?, … }`) |
| `tools:cancel-computer-use` | R→M | — | `{ cancelled: boolean }` |

`tools:execute` goes through the permission-gating layer before dispatching to
`executeRealtimeTool`. Result is logged and broadcast via `data:changed`.

### Data push

| Channel | Dir | Payload |
|---|---|---|
| `data:changed` | M→R | `{ category: string }` — indicates which data category changed (e.g. `'planner'`, `'activity'`, `'screenshots'`) |

`window.brah.onDataChanged(cb)` / `offDataChanged(listener)` wrap subscribe/unsubscribe.

---

## Part 2 — New channels by phase

All new channels follow the same invoke pattern as existing ones.
Direction `R→M` unless noted.

---

### Phase 1 — Foundation & Rename

#### Tray actions (M→R events, no invoke)

| Channel | Dir | Payload | Notes |
|---|---|---|---|
| `tray:action` | M→R | `{ action: 'open' \| 'mute' \| 'settings' \| 'quit' }` | Main sends when user clicks a tray menu item; renderer reacts |

#### Window size

| Channel | Dir | Args | Returns |
|---|---|---|---|
| `window:set-size` | R→M | `{ width: number, height: number }` | `{ width, height }` (clamped applied size) |

#### Settings

| Channel | Dir | Args | Returns |
|---|---|---|---|
| `settings:get` | R→M | `key?: string` | `Settings \| any` (all settings or single value) |
| `settings:set` | R→M | `patch: Partial<Settings>` | `Settings` (full updated object) |

`Settings` shape:
```ts
{
  theme: 'dark' | 'light' | string,   // CSS skin name
  hotkey: string,                      // e.g. "Option+Space"
  idleTimeout: number,                 // ms; 0 = never
  openAtLogin: boolean
}
```

Settings persisted via `app.setLoginItemSettings` (for `openAtLogin`) and a JSON store in
`userData` (for the rest). `settings:set` merges; unknown keys are preserved.

#### Onboarding

| Channel | Dir | Args | Returns |
|---|---|---|---|
| `onboarding:status` | R→M | — | `{ completed: boolean, steps: Record<string, boolean> }` |
| `onboarding:save-keys` | R→M | `{ openaiKey?: string, composioKey?: string, mem0Key?: string }` | `{ ok: boolean }` |

Keys stored via `safeStorage`. `onboarding:save-keys` does not require all keys; omitted keys are
left unchanged. After save, marks the relevant onboarding steps complete.

#### Hotkey events (M→R)

| Channel | Dir | Payload |
|---|---|---|
| `hotkey:triggered` | M→R | `{ hotkey: string }` | Sent by main when `globalShortcut` fires; renderer decides whether to summon or dismiss |

---

### Phase 2 — Memory

| Channel | Dir | Args | Returns |
|---|---|---|---|
| `memory:list` | R→M | `{ type?: 'episodic' \| 'semantic', limit?: number, offset?: number }` | `MemoryEntry[]` |
| `memory:search` | R→M | `{ query: string, type?: 'episodic' \| 'semantic', limit?: number }` | `MemoryEntry[]` (brute-force cosine ranked) |
| `memory:delete` | R→M | `{ ids: string[] }` | `void` |
| `memory:edit` | R→M | `{ id: string, content: string, tags?: string[] }` | `MemoryEntry` (updated) |
| `memory:stats` | R→M | — | `{ episodicCount: number, semanticCount: number, totalBytes: number }` |

`MemoryEntry`:
```ts
{
  id: string,
  type: 'episodic' | 'semantic',
  category?: 'procedural' | string,   // subset tag per ADR-3
  content: string,
  createdAt: number,                  // unix ms
  updatedAt: number
}
```

After any mutation, main broadcasts `data:changed` with `category: 'memory'`.

---

### Phase 3 — Identity

#### Extend `agent:get-profile` / `agent:set-profile`

No new channel names; the `AgentProfile` shape is extended in-place:

```ts
AgentProfile (extended) {
  // existing
  name: string,           // user's name
  voice: string,          // OpenAI TTS voice id
  persona: string,        // preset key from AGENT_PERSONAS

  // new — Phase 3
  agentName: string,           // Lena's own name (default "Lena")
  personality: string,         // free-text personality description
  tone: string,                // free-text tone rules
  speakingRules: string,       // free-text speaking constraints
  personaOverride: string      // free-text instructions that override the preset
}
```

#### Personas list

| Channel | Dir | Args | Returns |
|---|---|---|---|
| `personas:list` | R→M | — | `PersonaPreset[]` (`{ key: string, label: string, description: string }`) |

Returns the keys/labels/descriptions of all entries in `AGENT_PERSONAS` plus any user-defined
entries. Read-only; presets are defined in `src/realtime/prompts.js`.

---

### Phase 4 — MCP / Composio

| Channel | Dir | Args | Returns |
|---|---|---|---|
| `mcp:list-servers` | R→M | — | `McpServer[]` |
| `mcp:add-server` | R→M | `{ id: string, label: string, transport: 'stdio' \| 'http', command?: string, args?: string[], url?: string, headers?: Record<string,string> }` | `McpServer` |
| `mcp:remove-server` | R→M | `{ id: string }` | `void` |
| `mcp:set-enabled` | R→M | `{ id: string, enabled: boolean }` | `McpServer` (updated) |
| `mcp:connect-app` | R→M | `{ app: string }` | `{ url: string }` (Composio OAuth URL to open in browser) |
| `mcp:list-tools` | R→M | `{ serverId?: string }` | `McpTool[]` (filtered or all) |

`McpServer`:
```ts
{
  id: string,
  label: string,
  transport: 'stdio' | 'http',
  enabled: boolean,
  status: 'connected' | 'connecting' | 'error' | 'disabled',
  toolCount: number,
  errorMessage?: string
}
```

`McpTool`:
```ts
{
  serverId: string,
  name: string,           // namespaced: "<serverId>/<originalName>"
  description: string,
  schema: object          // JSON Schema (patched for OpenAI strict mode)
}
```

After `mcp:add-server` or `mcp:set-enabled`, main rebuilds the merged tool set and broadcasts
`data:changed` with `category: 'tools'`. Tool definitions returned by `tools:get-definitions`
include MCP tools after Phase 4.

---

### Phase 5 — Wake word

#### Invoke channels

| Channel | Dir | Args | Returns |
|---|---|---|---|
| `wake:set-enabled` | R→M | `{ enabled: boolean }` | `{ enabled: boolean }` |
| `wake:mute` | R→M | `{ muted: boolean }` | `{ muted: boolean }` |
| `wake:get-status` | R→M | — | `WakeStatus` |

`WakeStatus`:
```ts
{
  enabled: boolean,
  muted: boolean,
  listening: boolean,        // true when wake engine is actively sampling
  engineReady: boolean       // false until WASM/onnxruntime model is loaded
}
```

#### Push events (M→R)

| Channel | Dir | Payload |
|---|---|---|
| `wake:detected` | M→R | `{ confidence: number }` | Fired when "Hey Lena" passes the threshold; renderer starts a realtime session |
| `wake:status` | M→R | `WakeStatus` | Fired on any status change (mute/unmute, engine ready, error) |

The two-stage gate: wake engine (renderer WASM) fires `wake:detected`; renderer then calls
`openai:create-realtime-secret` to start the paid session.

---

### Phase 6 — UI / UX

#### Conversation history

| Channel | Dir | Args | Returns |
|---|---|---|---|
| `conversation:list` | R→M | `{ limit?: number, offset?: number, before?: number }` | `Conversation[]` |
| `conversation:search` | R→M | `{ query: string, limit?: number }` | `Conversation[]` |

`Conversation` maps to the episodic memory store (ADR-3); these channels are read-only views
over `memories_episodic`.

```ts
Conversation {
  id: string,
  summary: string,
  startedAt: number,
  endedAt: number,
  messageCount: number
}
```

#### Text chat

| Channel | Dir | Args | Returns |
|---|---|---|---|
| `chat:send` | R→M | `{ text: string, conversationId?: string }` | `{ messageId: string, conversationId: string }` |

`chat:send` enqueues a text-mode message into the realtime/tool backend (shares the same
`executeRealtimeTool` path). Response tokens are pushed back via `data:changed` with
`category: 'chat'` so the renderer polls or listens for updates; streaming tokens may be
pushed as `chat:token` M→R events (implementation detail deferred to Phase 6 spike).

| Channel | Dir | Payload |
|---|---|---|
| `chat:token` | M→R | `{ messageId: string, delta: string, done: boolean }` |
