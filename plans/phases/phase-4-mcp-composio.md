# Phase 4 — MCP / Composio Bridge

Complexity: L. Depends on: Phase 1 (persistent process, onboarding, safeStorage keys).
Independent of: Phase 2 (memory), Phase 3 (identity), Phase 5 (wake word).

---

## 1. Goal & Exit Criteria

**Goal:** Let Lena reach external services (starting with Gmail) through a generic MCP bridge.
Any MCP server — remote (Composio) or local (stdio) — drops in as config with no bespoke code per integration (ADR-4).

**Exit criteria (all must be true before Phase 4 is closed):**

1. User authenticates Composio via API key (stored in `safeStorage`) during onboarding.
2. Lena connects to Gmail via Composio's Streamable-HTTP MCP endpoint.
3. Voice command "send an email to …" causes Lena to call `composio/GMAIL_SEND_EMAIL`, blocked by a permission prompt at `destructive` level, which the user approves.
4. Email is sent; Lena confirms verbally.
5. A second arbitrary MCP server (stdio or HTTP) can be added via the server-management UI / `mcp:add-server` IPC channel without any code change.
6. No MCP tool appears in the realtime tool set without an approved server allowlist entry.

---

## 2. Architecture

### 2.1 New file: `src/realtime/tools/mcp-client.js`

Runs in the **main process**. Manages a `Map<serverId, ServerEntry>` where:

```js
// ServerEntry shape
{
  client: Client,          // @modelcontextprotocol/sdk /client
  transport: StreamableHTTPClientTransport | StdioClientTransport,
  tools: McpToolDef[],     // raw tools from server (name, description, inputSchema)
  config: McpServerConfig, // persisted config (id, label, transport kind, url/command/args/headers, enabled)
  status: 'connected' | 'connecting' | 'error' | 'disabled',
  errorMessage?: string
}
```

**Public API exported from this module:**

```js
export async function addServer(config)         // connect + store; throws on transport failure
export async function removeServer(id)          // disconnect + delete from map
export async function setServerEnabled(id, enabled) // connect/disconnect; update status
export function listServers()                   // McpServer[] (UI shape, no internals)
export function listAllTools(serverId?)         // McpToolDef[] (optionally filtered to one server)
export async function callTool(serverId, originalName, args) // Client.callTool; returns raw MCP result
export async function connectComposio(apiKey, toolkits) // build Composio session → addServer('composio', ...)
export async function getComposioConnectUrl(app) // composio.getConnectionUrl(app) → OAuth URL
```

**Transport construction:**

```js
// HTTP (Composio and any HTTP server)
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = new StreamableHTTPClientTransport(new URL(config.url), {
  requestInit: { headers: config.headers ?? {} }
});

// stdio (local servers — R-9 mitigation required)
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Resolve login-shell PATH at startup (see §7 edge cases) and pass via env:
const transport = new StdioClientTransport({
  command: config.command,
  args: config.args ?? [],
  env: { ...resolvedLoginShellEnv, ELECTRON_RUN_AS_NODE: "1" }
});
```

After `client.connect(transport)`, call `client.listTools()` and store the result in `ServerEntry.tools`.

**Persistence:** Server configs (excluding secrets) are serialised to `mcpServers.json` in Electron `userData`. Composio headers (which carry an API key) are encrypted via `safeStorage` before writing; decrypted on load.

---

### 2.2 New file: `src/realtime/tools/mcp-tools.js`

Executor module in the `executeRealtimeTool` dispatch chain. Returns `null`/`undefined` if `name` is not an MCP-namespaced tool — the chain falls through to the next executor.

**Name convention:** `<serverId>__<originalToolName>` (double underscore, matching Composio's own convention: e.g. `composio__GMAIL_SEND_EMAIL`).

```js
import { callTool, listAllTools } from "./mcp-client.js";

export async function executeMcpTool(name, args, _options) {
  // Fast exit: MCP tool names always contain "__"
  if (!name.includes("__")) return null;

  const separatorIdx = name.indexOf("__");
  const serverId = name.slice(0, separatorIdx);
  const originalName = name.slice(separatorIdx + 2);

  // Confirm server owns this tool (prevents spoofing via a crafted name)
  const owned = listAllTools(serverId).some(t => t.name === originalName);
  if (!owned) return null;

  const result = await callTool(serverId, originalName, args);

  // Normalize MCP CallToolResult → Lena ToolResult shape
  if (result.isError) {
    return { status: "error", message: result.content?.[0]?.text ?? "MCP tool error" };
  }
  const text = result.content?.map(c => c.text ?? JSON.stringify(c)).join("\n") ?? "";
  return { status: "success", result: text };
}
```

Wire into `src/realtime/tools/index.js` **before** the final fallthrough:

```js
import { executeMcpTool } from "./mcp-tools.js";

// ... existing executors ...
const mcpResult = await executeMcpTool(name, args, options.mcp);
if (mcpResult) return mcpResult;

return { status: "error", message: `Unknown realtime tool: ${name}` };
```

---

### 2.3 Dynamic tool merge: `getRealtimeToolDefinitions` becomes async

**Current:** `tool-schemas.js` exports a synchronous `getRealtimeToolDefinitions()` returning a clone of a static array.

**Change:** Make it `async` and accept an optional `{ includeMcp: boolean }` param (default `true`). Merges static definitions with converted MCP tools.

```js
// tool-schemas.js (modified)
import { listAllTools } from "./mcp-client.js";

export async function getRealtimeToolDefinitions({ includeMcp = true } = {}) {
  const staticDefs = structuredClone(realtimeToolDefinitions);
  if (!includeMcp) return staticDefs;
  const mcpDefs = listAllTools()
    .filter(t => t._serverEnabled)        // only from enabled servers
    .map(t => mcpToolToOpenAI(t));
  return [...staticDefs, ...mcpDefs];
}
```

**Conversion function `mcpToolToOpenAI(mcpTool)`:**

```js
function mcpToolToOpenAI({ serverId, name, description, inputSchema }) {
  const namespacedName = `${serverId}__${name}`;
  const schema = patchSchemaForOpenAI(structuredClone(inputSchema ?? { type: "object", properties: {}, required: [] }));
  return {
    type: "function",
    name: namespacedName,
    description: sanitizeToolDescription(description, 512),
    parameters: schema
  };
}
```

**`patchSchemaForOpenAI(schema)` — strict-mode handling (R-10):**

Recursively walks the JSON Schema and:
1. Sets `additionalProperties: false` on every object node that lacks it.
2. Removes `$schema`, `$id`, `definitions`, `$defs` keys (OpenAI rejects them in strict mode).
3. Returns the patched schema.

If the server returns a schema that is too complex for strict mode (e.g. recursive `$ref` loops), fall back to `strict: false` on the tool definition instead of crashing.

**`sanitizeToolDescription(raw, maxLen)` — prompt injection mitigation (R-5, ADR-6):**

1. Strip ANSI escape sequences and control characters.
2. Remove any content after a line that looks like an injection trigger (heuristic: lines containing `"ignore previous"`, `"system:"`, `"<|"` etc.).
3. Truncate to `maxLen` characters.
4. Return sanitized string.

**Callers of `getRealtimeToolDefinitions` must be updated to `await` it:**

- `src/realtime/tools/index.js` re-exports it (no logic change; callers now `await`).
- `src/main.js` `tools:get-definitions` IPC handler: `ipcMain.handle("tools:get-definitions", () => getRealtimeToolDefinitions())` already returns the value — adding `async` is backward-compatible because IPC handlers that return promises work identically.

---

## 3. Composio Integration Flow

### 3.1 API key storage

During Phase 1 onboarding, `onboarding:save-keys` already stores a `composioKey` via `safeStorage`. Phase 4 reads it with the same decrypt pattern used for OpenAI tokens.

```js
// In mcp-client.js, called from main.js at app-ready after safeStorage is available:
const composioKey = loadComposioKey(); // decrypt from userData store
if (composioKey) {
  await connectComposio(composioKey, DEFAULT_COMPOSIO_TOOLKITS);
}
```

`DEFAULT_COMPOSIO_TOOLKITS` starts as `["gmail"]` and is expanded to `["gmail", "googlecalendar", "slack", "notion"]` once each is wired in the UI.

### 3.2 Composio session construction

```js
import Composio from "@composio/core";

async function connectComposio(apiKey, toolkits) {
  const composio = new Composio({ apiKey });
  const userId = await getOrCreateComposioUserId(); // stored in userData JSON
  const session = await composio.create(userId, { toolkits });
  // session.mcp.url  → Streamable-HTTP endpoint
  // session.mcp.headers → { "x-composio-api-key": apiKey, ... }
  await addServer({
    id: "composio",
    label: "Composio",
    transport: "http",
    url: session.mcp.url,
    headers: session.mcp.headers,
    enabled: true
  });
}
```

### 3.3 Per-app OAuth (connect-link flow)

When a Composio tool invocation returns an authentication error (HTTP 401 or MCP error containing `"not_connected"`), the `executeMcpTool` handler catches it and returns a structured result:

```js
return {
  status: "needs_oauth",
  app: appName,
  message: "Gmail is not connected. Opening browser to connect…"
};
```

The `tools:execute` IPC handler in `main.js` detects `status === "needs_oauth"` and calls `getComposioConnectUrl(app)`, then opens the URL in the system browser via `shell.openExternal`. It then broadcasts `data:changed` with `category: 'mcp'` so the settings UI can refresh the connection state.

`mcp:connect-app` IPC channel is the explicit renderer-triggered variant (e.g. from the settings panel):

```js
ipcMain.handle("mcp:connect-app", async (_event, { app }) => {
  const { url } = await getComposioConnectUrl(app);
  await shell.openExternal(url);
  return { url };
});
```

### 3.4 Tool count ceiling (R-10)

Limit enabled toolkits to those the user explicitly enables in settings. Never auto-enable all Composio toolkits. The Composio session is created only with the `toolkits` array the user has turned on. If the resulting tool count after merge exceeds 20, surface a warning in the UI and refuse to create the realtime session until the user reduces scope.

---

## 4. Security (ADR-6, R-5)

### 4.1 Default-deny permission levels

Extend `tool-permissions.js` with an MCP-aware lookup. The existing `getToolPermissionRequest` already falls through to a `level: "unknown"` default for unrecognised names. Change that fallthrough for MCP-namespaced names:

```js
// In getToolPermissionRequest, before the final ?? fallback:
if (name.includes("__")) {
  // MCP tool — classify by destructiveness heuristic
  const level = classifyMcpToolLevel(name);
  return {
    toolName: name,
    label: getMcpToolLabel(name),
    level,
    description: getMcpToolDescription(name), // sanitized (see §2.3)
    summary: summarizeMcpArgs(name, args)
  };
}
```

`classifyMcpToolLevel(name)`: defaults to `"destructive"`. Override map for known safe patterns:
- Names containing `GET`, `LIST`, `SEARCH`, `READ` → `"read"`.
- Names containing `CREATE`, `UPDATE`, `SEND`, `POST` → `"write"`.
- Names containing `DELETE`, `REMOVE`, `TRASH` → `"destructive"`.
- Unknown → `"destructive"` (safe default).

This reuses the existing permission-prompt UI with no renderer changes.

### 4.2 Server allowlist

`mcpServers.json` is the allowlist. A server not in this file cannot execute tools, even if somehow named. `executeMcpTool` calls `listAllTools(serverId)` which only returns tools from servers present in the in-memory map (populated only from `mcpServers.json`). Servers added via `mcp:add-server` are written to `mcpServers.json` only after the user confirms in the UI.

### 4.3 Definition hashing and drift re-prompt

On each server connect, compute a SHA-256 hash over the sorted JSON of `tools[].{name, inputSchema}`. Store `{ serverId, hash, approvedAt }` in `mcp-approvals.json` (in `userData`). On reconnect (app restart), if the hash differs → set `status: "pending-approval"`, exclude tools from the merged set, broadcast `data:changed` with `category: 'mcp'`, and show a UI banner: "Tools from [label] changed. Review and approve."

`mcp:set-enabled` with `{ approve: true }` updates the stored hash.

### 4.4 Description sanitization

`sanitizeToolDescription` (defined in §2.3) is called on every tool description before it enters `mcpToolToOpenAI` and therefore before it enters the realtime session instructions. This is the only path descriptions travel; they never pass raw into prompts.

### 4.5 Scope limits

- Maximum 20 total MCP tools across all enabled servers in a realtime session (R-10).
- Maximum description length per tool: 512 characters (after sanitization).
- `inputSchema` properties capped at 30 per object node (deeper schemas are rejected with a warning logged, tool excluded).

---

## 5. File-Level Changes

### New files

| File | Purpose |
|---|---|
| `src/realtime/tools/mcp-client.js` | MCP client manager (main process); HTTP + stdio transports; Composio session factory |
| `src/realtime/tools/mcp-tools.js` | `executeMcpTool` executor; namespacing; MCP→Lena result normalisation |

### Modified files

| File | Change |
|---|---|
| `src/realtime/tools/index.js` | Import and wire `executeMcpTool` before the fallthrough return; re-export `getRealtimeToolDefinitions` (now async, no interface change at call sites) |
| `src/realtime/tools/tool-schemas.js` | `getRealtimeToolDefinitions` becomes `async`; imports `listAllTools` from `mcp-client.js`; adds `mcpToolToOpenAI`, `patchSchemaForOpenAI`, `sanitizeToolDescription` |
| `src/realtime/tool-permissions.js` | Add MCP name detection in `getToolPermissionRequest`; add `classifyMcpToolLevel`, `getMcpToolLabel`, `getMcpToolDescription`, `summarizeMcpArgs`; extend `summarizeToolRequest` default case |
| `src/main.js` | Import `mcp-client.js` functions; add 6 new `ipcMain.handle` registrations (§6); call `connectComposio` at app-ready if key present; handle `needs_oauth` in `tools:execute` handler; `tools:get-definitions` handler: add `await` |
| `src/preload.js` | Expose 6 new `window.brah.mcp*` methods mirroring the new IPC channels |
| `package.json` | Add `"@modelcontextprotocol/sdk": "^1.29.0"` and `"@composio/core": "^0.10.0"` to `dependencies` |

---

## 6. IPC Additions (Phase 4 — from `ipc-api-spec.md` §Phase 4)

All R→M invoke channels.

| Channel | Args | Returns | Notes |
|---|---|---|---|
| `mcp:list-servers` | — | `McpServer[]` | Live status included |
| `mcp:add-server` | `{ id, label, transport, command?, args?, url?, headers? }` | `McpServer` | Connects immediately; writes to `mcpServers.json` |
| `mcp:remove-server` | `{ id }` | `void` | Disconnects; removes from file + map |
| `mcp:set-enabled` | `{ id, enabled, approve? }` | `McpServer` | `approve: true` updates stored hash |
| `mcp:connect-app` | `{ app: string }` | `{ url: string }` | Opens browser for Composio OAuth |
| `mcp:list-tools` | `{ serverId? }` | `McpTool[]` | Filtered or all; includes approved status |

`McpServer` shape (as defined in `ipc-api-spec.md`):
```ts
{ id, label, transport, enabled, status, toolCount, errorMessage? }
```

`McpTool` shape:
```ts
{ serverId, name, description, schema, approved: boolean }
```

Push event: after `mcp:add-server`, `mcp:remove-server`, or `mcp:set-enabled`, main broadcasts `data:changed` with `category: 'mcp'`.

**`window.brah` additions (preload.js):**

```js
listMcpServers: ()            => ipcRenderer.invoke("mcp:list-servers"),
addMcpServer: (config)        => ipcRenderer.invoke("mcp:add-server", config),
removeMcpServer: (id)         => ipcRenderer.invoke("mcp:remove-server", { id }),
setMcpServerEnabled: (id, en, approve) => ipcRenderer.invoke("mcp:set-enabled", { id, enabled: en, approve }),
connectMcpApp: (app)          => ipcRenderer.invoke("mcp:connect-app", { app }),
listMcpTools: (serverId)      => ipcRenderer.invoke("mcp:list-tools", { serverId }),
```

### Server-management UI

Rendered in the existing `panel.js` settings section. Minimum viable surface:

- **Connected apps list:** Each Composio app (Gmail, Calendar, Slack, Notion) shows connect/disconnect button. Status badge: connected / not connected.
- **Custom server list:** Add server form (id, label, transport selector, URL or command + args). Toggle enable/disable. Remove.
- **Tool inspector:** Expandable list of tools per server (name, description, approval state). "Approve all" button after schema-drift re-prompt.
- **Tool count indicator:** "N / 20 tools enabled" — turns red when limit exceeded.

---

## 7. Edge Cases and Failure Modes

| Scenario | Behaviour |
|---|---|
| **Server unreachable at connect** | `addServer` throws; server is added to `mcpServers.json` with `status: "error"` and `errorMessage`; tools from that server are excluded from the merged set; UI shows error badge. Retry available via `mcp:set-enabled` toggle. |
| **Server unreachable mid-session** | `callTool` throws; `executeMcpTool` catches and returns `{ status: "error", message: "…" }`; session continues; Lena tells the user the tool failed. |
| **OAuth incomplete (Composio app not connected)** | `callTool` returns MCP error body; `executeMcpTool` detects `not_connected` pattern and returns `status: "needs_oauth"`; `tools:execute` handler opens browser; Lena announces the action verbally. |
| **Schema drift detected on reconnect** | Server `status` set to `"pending-approval"`; tools excluded from session; `data:changed` broadcast; settings UI shows "Review tools" banner. Session can still start with remaining approved servers. |
| **Tool-name collision** (two servers expose a tool with the same original name) | Cannot collide: namespaced as `<serverId>__<name>`; server IDs are unique by construction in `mcpServers.json`. |
| **Stdio server PATH issues (R-9)** | `connectComposio` and all HTTP transports bypass this entirely. For stdio servers: at app-ready, resolve login-shell PATH once via `sh -lc 'echo $PATH'` (or `zsh -lc` on macOS), cache result in a module-level variable, pass as `env.PATH` to every `StdioClientTransport`. If resolution fails, fall back to `/usr/local/bin:/usr/bin:/bin` + Homebrew prefix. |
| **Tool count exceeds 20 (R-10)** | `getRealtimeToolDefinitions` emits a warning log and slices to the first 20 MCP tools (static tools are never cut). UI indicator turns red; realtime session creation is blocked with a user-facing message until user disables toolkits. |
| **`additionalProperties` incompatible schema** | `patchSchemaForOpenAI` catches any JSON traversal error; falls back to `{ type: "object", properties: {}, required: [], additionalProperties: false }` for that tool's schema, preserving the tool with an empty parameter set rather than crashing. |
| **Prompt injection via tool description (R-5)** | `sanitizeToolDescription` strips injection patterns before the string ever reaches the realtime session `instructions`. Tool is still available; only its description is sanitized. If description is reduced to empty after sanitization, it is set to `"(no description)"`. |

---

## 8. Definition of Done

All of the following must be true:

- [ ] `npm test` passes with the new test files (see §9).
- [ ] `npm run check` passes (Biome lint + format).
- [ ] Voice command sends a real Gmail via Composio behind a `destructive`-level permission prompt.
- [ ] A second arbitrary MCP server (local or HTTP) can be added, enabled, and invoked without code change.
- [ ] Tool count cap enforced: session creation blocked when >20 MCP tools are enabled.
- [ ] Schema drift: after manually altering a mock server's tool list, the UI shows the re-approval banner and the drifted tools are excluded from the session.
- [ ] `sanitizeToolDescription` strips a crafted injection string from a tool description before session start.

---

## 9. Test Cases

Test files live in `test/` and run under `node --test` (project convention).

### `test/mcp-schema-conversion.test.js`

| Case | Assertion |
|---|---|
| MCP tool with no `inputSchema` | `mcpToolToOpenAI` produces `parameters: { type: "object", properties: {}, required: [], additionalProperties: false }` |
| Schema with `additionalProperties` absent on nested object | `patchSchemaForOpenAI` adds `additionalProperties: false` recursively |
| Schema with `$schema` key | Key is removed from output |
| Schema with `$ref` (unsupported by strict mode) | Function does not throw; returns valid (possibly simplified) schema |
| Description with `"ignore previous instructions"` | `sanitizeToolDescription` strips the injection; result does not contain the phrase |
| Description longer than 512 chars | Truncated to 512 |

### `test/mcp-namespacing.test.js`

| Case | Assertion |
|---|---|
| `executeMcpTool("composio__GMAIL_SEND_EMAIL", args)` with mock server | Calls `callTool("composio", "GMAIL_SEND_EMAIL", args)` |
| `executeMcpTool("list_tasks", args)` (no `__`) | Returns `null` (not an MCP tool; chain falls through) |
| `executeMcpTool("composio__UNKNOWN_TOOL", args)` where tool not in server's list | Returns `null` (spoofing guard) |
| MCP tool result `{ isError: true, content: [{ text: "oops" }] }` | Normalised to `{ status: "error", message: "oops" }` |
| MCP tool result `{ content: [{ text: "sent" }] }` | Normalised to `{ status: "success", result: "sent" }` |

### `test/mcp-permission-gating.test.js`

| Case | Assertion |
|---|---|
| `getToolPermissionRequest("composio__GMAIL_SEND_EMAIL", {})` | Returns level `"write"` (SEND heuristic) |
| `getToolPermissionRequest("composio__GMAIL_DELETE_MESSAGE", {})` | Returns level `"destructive"` (DELETE heuristic) |
| `getToolPermissionRequest("composio__GMAIL_LIST_MESSAGES", {})` | Returns level `"read"` (LIST heuristic) |
| `getToolPermissionRequest("composio__SOME_UNKNOWN_TOOL", {})` | Returns level `"destructive"` (safe default) |

### Integration smoke test (manual, `npm run open:mac`)

1. Provide Composio API key in onboarding.
2. Verify `mcp:list-servers` returns the Composio server with `status: "connected"`.
3. Verify `tools:get-definitions` returns at least one `composio__` tool.
4. Issue voice command; verify permission prompt fires at `write`/`destructive` level.
5. Approve; verify email received in Gmail.
