# Lena — Auth Matrix

_Source of truth for all credential flows, permission surfaces, and access-control decisions._
_Last updated: 2026-06-01. Cross-ref: ADR-6, ADR-7, R-1, R-5, R-6._

---

## 1. Roles

Lena has no server-side multi-tenancy. There is one role concept:

| Role | Definition |
|---|---|
| **Owner** | The person who installed the app and ran onboarding. Holds all credentials in their own system keychain via `safeStorage`. |
| **Invited user** | Runs their own installed copy of Lena with their own onboarding. Each install is fully independent — no shared credentials, no shared session. |

There is no admin/viewer distinction, no token delegation between installs, and no cloud user registry. "Share with a few people" (ADR-7) means distributing a signed binary; each recipient onboards individually.

---

## 2. Realtime Auth (OpenAI)

### 2a. Primary path — ChatGPT-account OAuth (PKCE)

**Risk note (R-1):** This flow uses the undocumented `codex_cli_simplified_flow` flag. It may not generalize to all account types or may violate OpenAI ToS. The API-key path (§2b) is a first-class fallback built into onboarding for exactly this reason.

**Constants (src/main.js `openAIAuthConfig`):**

| Field | Value |
|---|---|
| `clientId` | `app_EMoamEEZ73f0CkXaXp7hrann` |
| `authorizeUrl` | `https://auth.openai.com/oauth/authorize` |
| `tokenUrl` | `https://auth.openai.com/oauth/token` |
| `scope` | `openid profile email offline_access api.connectors.read api.connectors.invoke` |
| Callback | `http://localhost:1455/auth/callback` |

**Flow (loginOpenAI):**

```
1. Generate PKCE pair:
     verifier  = 32 random bytes → base64url
     challenge = SHA-256(verifier) → base64url
   Generate state = 24 random bytes → base64url

2. Start local HTTP server on port 1455 to receive the callback.

3. Open browser to authorizeUrl with params:
     client_id, redirect_uri, response_type=code, scope
     state, code_challenge, code_challenge_method=S256
     id_token_add_organizations=true
     codex_cli_simplified_flow=true, originator=ggcoder

4. User completes login in browser.

5. Callback server receives ?code=…&state=… 
   Validates state matches; closes server.

6. POST tokenUrl (exchangeOpenAICode):
     grant_type=authorization_code
     client_id, code, redirect_uri, code_verifier

7. Response parsed by tokenJsonToCredentials → {accessToken, idToken, refreshToken, expiresAt}.

8. saveOpenAICredentials encrypts and writes to disk (see §2c).
```

**Token refresh (refreshOpenAICredentials):**

```
POST tokenUrl:
  grant_type=refresh_token
  refresh_token, client_id

→ new accessToken + expiresAt saved via saveOpenAICredentials.
```

Refresh is called proactively before `createRealtimeClientSecret` if the access token is near expiry.

### 2b. Fallback path — API key (R-1 mitigation)

If OAuth is unavailable or account-type restricted, the user pastes an OpenAI API key during onboarding. It is stored via the same `safeStorage` path as OAuth tokens. At runtime, the access token field is populated with the raw API key; no refresh cycle applies.

### 2c. Credential storage (safeStorage)

All OpenAI credentials are stored encrypted at `<userData>/openai-credentials.json`.

**Encryption:**
- `safeStorage.encryptString(json)` → base64 → written with mode `0o600`.
- On load: `safeStorage.decryptString(Buffer.from(data, 'base64'))`.
- If `safeStorage.isEncryptionAvailable()` returns false, storage is refused — no cleartext fallback.
- Backend: OS keychain (macOS Keychain, Windows DPAPI, Linux libsecret/kwallet).

**Credential object fields:**

| Field | Source |
|---|---|
| `accessToken` | OAuth `access_token` / raw API key |
| `idToken` | OAuth `id_token` |
| `refreshToken` | OAuth `refresh_token` (absent on API-key path) |
| `expiresAt` | Parsed from `expires_at` (Unix seconds → JS Date) |

### 2d. Realtime client secret lifecycle

Each voice session requires a short-lived ephemeral secret from the Realtime API.

```
POST https://api.openai.com/v1/realtime/client_secrets
  Authorization: Bearer <accessToken>
  Body: { session: { model, voice, instructions, output_modalities, audio: { input: {format, rate} } } }

→ { value: "<ephemeral-key>", expiresAt: <timestamp> }
```

- The ephemeral key is used only within that session's WebSocket connection.
- It is not persisted to disk.
- `expiresAt` is tracked in memory; sessions must start before expiry.
- If the access token itself is expired, `refreshOpenAICredentials` is called first.

---

## 3. Composio Auth

### 3a. API key

`COMPOSIO_API_KEY` is stored via `safeStorage` during onboarding (ADR-7). It is never bundled in the binary.

### 3b. Per-app OAuth (connected-accounts model)

Composio manages per-service OAuth on behalf of the user. Lena initiates via the `@composio/core` client → MCP session URL + headers. Each external service (Gmail, Google Calendar, Slack, Notion) is connected separately through Composio's hosted OAuth connect links.

| Service | Connection type |
|---|---|
| Gmail | OAuth 2.0 via Composio connect link |
| Google Calendar | OAuth 2.0 via Composio connect link |
| Slack | OAuth 2.0 via Composio connect link |
| Notion | OAuth 2.0 via Composio connect link |

**Token refresh:** Handled entirely by Composio's platform. Lena holds only the `COMPOSIO_API_KEY`; per-service refresh tokens are stored and rotated by Composio's backend. Lena receives fresh short-lived tokens through the MCP session.

**Onboarding UI:** Displays a connect link per app; user completes OAuth in browser; Composio confirms connection; Lena polls until connected state is confirmed.

---

## 4. Mem0 Auth

Mem0 is an optional memory adapter (ADR-2). It is used only when the user selects Mem0 as the memory backend (the default is custom SQLite + local embeddings).

| Credential | Storage | Required |
|---|---|---|
| `MEM0_API_KEY` | `safeStorage` (same pattern as other keys) | Only if Mem0 adapter selected in onboarding |

If `MEM0_API_KEY` is absent and the Mem0 adapter is selected, onboarding blocks until the key is provided. The custom SQLite baseline requires no credentials.

---

## 5. OS Permission Matrix

Permissions are defined in `src/os-permissions.js`. Status values are normalized to the following set: `not-determined`, `granted`, `denied`, `restricted`, `unknown`, `unsupported`.

| Permission ID | Label | Required for | Request mechanism (macOS) | Request mechanism (Windows) | Settings deep-link |
|---|---|---|---|---|---|
| `microphone` | Microphone | Realtime voice input | `systemPreferences.askForMediaAccess("microphone")` triggers OS prompt | Opens Windows privacy settings URL | macOS: Privacy > Microphone |
| `screen` | Screen Recording | Screenshot tools, screen analysis, Computer Use OS mode | `desktopCapturer.getSources()` triggers capture prompt | Opens Windows privacy settings URL | macOS: Privacy > Screen Recording |
| `accessibility` | Accessibility Control | Computer Use OS mode (real mouse/keyboard via nut-js) | `systemPreferences.isTrustedAccessibilityClient(true)` opens prompt | Opens Windows privacy settings URL | macOS: Privacy > Accessibility |
| `computer` | Computer Use Browser | Computer Use browser harness (Playwright/Chromium) | Downloads Chromium via `installComputerUseBrowser()` | Same | Opens Playwright browser install docs URL |

**Status state machine (per permission):**

```
not-determined → [user grants] → granted
not-determined → [user denies] → denied
granted        → [user revokes in Settings] → denied
denied         → [user re-enables in Settings] → granted
restricted     (MDM/parental — cannot be changed by user)
unknown        (platform cannot determine status)
unsupported    (platform does not support this permission)
```

**Always-on microphone consent (R-6):**

The wake-word listener (Phase 5) keeps the microphone open continuously. This triggers macOS's persistent mic indicator dot. Mitigations required at onboarding:

- Explicit user consent screen explaining always-on local processing before the mic is opened.
- Visible "listening" state in the tray icon at all times.
- One-click mute/pause accessible from the tray without entering the main UI.
- Audio never leaves the device until a session is explicitly started — wake detection is fully on-device.

---

## 6. MCP Tool Permission Model

### 6a. Permission levels

Defined in `src/realtime/tool-permissions.js`. Every tool carries a `level` that determines whether a confirmation prompt is shown.

| Level | Prompt required | Semantics |
|---|---|---|
| `read` | No | Non-mutating local reads (tasks list, calendar list, file read) |
| `low` | No | Minor local mutations with no external effect (add task, end call) |
| `write` | Yes | Local mutations that change persisted state (write file, edit file, add calendar item, update task status) |
| `destructive` | Yes | Irreversible local mutations (delete task, delete calendar item); also applied to `computer_use_task` when `target === "computer"` |
| `network` | Yes | External network calls (web search via DuckDuckGo, web fetch) |
| `screen` | Yes | Screen capture (list screenshot sources, take screenshot) |
| `sensitive` | Yes | Data sent to OpenAI (analyze screen) or full machine control via browser/OS harness (computer_use_task default level) |
| `unknown` | Yes (defaults to write/destructive) | Any tool not in the static metadata — covers MCP/external tools |

**Level escalation rule:** `computer_use_task` is `sensitive` by default; escalates to `destructive` when `args.target === "computer"` (OS mode via nut-js).

### 6b. Static tool assignments

| Tool | Level |
|---|---|
| `list_tasks`, `list_calendar_items`, `read_file`, `list_screenshot_sources`, `take_screenshot` | `read` / `screen` |
| `add_task`, `end_call` | `low` |
| `update_task_status`, `add_calendar_item`, `write_file`, `edit_file` | `write` |
| `delete_task`, `delete_calendar_item` | `destructive` |
| `web_search`, `web_fetch` | `network` |
| `analyze_screen` | `sensitive` |
| `computer_use_task` (browser) | `sensitive` |
| `computer_use_task` (OS, `target=computer`) | `destructive` |
| Any unknown / MCP tool | `unknown` → treated as `write` or `destructive` |

### 6c. ADR-6 — MCP/external tool gating (default-deny)

MCP tools are externally defined and present three attack vectors: tool-poisoning (malicious definitions), rug-pull (silent schema change after approval), and prompt injection (via tool descriptions or results).

**Controls:**

| Control | Implementation |
|---|---|
| Default-deny | Unknown/MCP tools default to `unknown` level → always prompt |
| Server allowlist | Only explicitly allowlisted MCP servers may expose tools; others blocked at MCP client init |
| Definition hashing | Tool schemas are hashed (SHA-256 of the JSON definition) on first user approval and stored; subsequent calls compare hashes |
| Drift re-prompt | If the current tool definition hash differs from the stored approved hash, the tool is re-prompted as if new — the stored approval is invalidated |
| Description sanitization | Tool descriptions are truncated and stripped of control characters before being injected into the system prompt |
| No auto-approve | `createPermissionDeniedResult` is the default outcome; approval is always an explicit user action |

---

## 7. Session Management

### 7a. Access token lifecycle

| Token | TTL source | Refresh trigger |
|---|---|---|
| OpenAI `accessToken` | `expiresAt` from token response | Checked before every `createRealtimeClientSecret` call; `refreshOpenAICredentials` called if expired or near expiry |
| OpenAI `refreshToken` | Long-lived (no explicit expiry stored) | Used to obtain new access token; itself replaced on each refresh response |
| Realtime ephemeral secret | `expiresAt` in response (typically 60s) | Not refreshed — a new secret is created for each session start |

### 7b. Session start sequence

```
1. Load credentials from safeStorage.
2. If accessToken.expiresAt < now → call refreshOpenAICredentials.
3. Call createRealtimeClientSecret(credentials, { model, voice, instructions }).
4. Ephemeral secret value used to open WebSocket to OpenAI Realtime API.
5. Secret not stored; discarded when session ends.
```

### 7c. ADR-8 — always-ready session policy

The app maintains a warm session state (ADR-8) so that voice activation has minimal latency. This means credentials must be valid before the user invokes the assistant — the app proactively refreshes access tokens on launch and on a background interval, not lazily on first call.

### 7d. Credential clearance

`clearOpenAICredentials()` deletes `<userData>/openai-credentials.json`. Called on explicit sign-out. Does not affect Composio or Mem0 keys (those are cleared separately in their own onboarding paths).
