# Lena — Environment & Secrets Reference

> Authority: ADR-7. No secrets are shipped in the app bundle.
> Every secret is either supplied by the user at onboarding (runtime) or exists only on the developer machine / CI (build-time).

---

## 1. Runtime secrets — per user, keychain-encrypted

Stored exclusively via `electron.safeStorage` (macOS: system Keychain; Windows: DPAPI).
Written to `app.getPath('userData')/openai-credentials.json` at mode `0o600` as a base64-encoded,
safeStorage-encrypted blob. The plaintext credential never leaves the main process; it is
never forwarded to the renderer via IPC.

If `safeStorage.isEncryptionAvailable()` returns false the app refuses to save and logs
`openai.credentials.encryption_unavailable` — never falls back to cleartext storage.

### 1a. OpenAI — OAuth tokens (current path)

| Field | Detail |
|---|---|
| What | `accessToken` (short-lived JWT) + `refreshToken` (long-lived) + `expiresAt` (ms epoch) + optional `accountId` |
| How obtained | Onboarding step 1: `loginOpenAI()` — OAuth `codex_cli_simplified_flow`, local callback server on port `1455`, browser redirect |
| Where stored | `<userData>/openai-credentials.json` — safeStorage-encrypted blob, `0o600` |
| Auto-refresh | `getFreshOpenAICredentials()` silently refreshes when `expiresAt - 5 min < now` |
| Rotation / clear | User logout → `clearOpenAICredentials()` deletes the file; re-login issues new tokens |
| Risk | R-1: OAuth flow may not generalize across user accounts / may be outside OpenAI ToS — validated in Phase 1 Task 1 |
| Renderer exposure | None. Main process uses `accessToken` only to call `createRealtimeClientSecret()` and returns a short-lived ephemeral client secret to the renderer |

### 1b. OpenAI — API key (R-1 fallback path)

| Field | Detail |
|---|---|
| What | `sk-…` API key string |
| How obtained | Onboarding step 1 (alternative): user pastes key from `platform.openai.com/api-keys` |
| Where stored | Same `<userData>/openai-credentials.json` pattern; safeStorage-encrypted, `0o600` |
| Rotation / clear | User replaces or clears key in onboarding/settings; file deleted on logout |
| Renderer exposure | None. Main process uses it only to obtain ephemeral client secrets |

### 1c. COMPOSIO_API_KEY (Phase 4, optional)

| Field | Detail |
|---|---|
| What | Composio personal API key (`comp_…`) |
| How obtained | Onboarding step (Phase 4): user pastes key from `app.composio.dev` |
| Where stored | `<userData>/composio-credentials.json` (same safeStorage pattern as OpenAI) |
| Rotation / clear | User clears in settings; rotated on the Composio dashboard |
| Renderer exposure | None. Main process passes it to `@composio/core` to obtain an MCP session URL; the URL (not the key) is used for the transport |
| Note | Absent = Composio/MCP bridge silently disabled; app functions without it |

### 1d. MEM0_API_KEY (Phase 2, optional — only if Mem0 cloud adapter chosen)

| Field | Detail |
|---|---|
| What | Mem0 API key for the managed Mem0 service |
| How obtained | Onboarding step (Phase 2, if user selects Mem0 adapter over sqlite baseline): user pastes key from `app.mem0.ai` |
| Where stored | `<userData>/mem0-credentials.json` (safeStorage-encrypted, `0o600`) |
| Rotation / clear | User clears in settings; rotated on the Mem0 dashboard |
| Renderer exposure | None. Main process passes it to the `MemoryStore` Mem0 adapter only |
| Note | Absent = memory engine defaults to sqlite baseline (ADR-2). Never required. |

---

## 2. Build-time secrets — developer machine and CI only

These values are never packaged into the app bundle. They exist only in the developer's keychain
or CI environment variables during the `electron-builder` sign+notarize step.

The `package.json` `build.mac` block already sets `hardenedRuntime: true` and points to
`build/entitlements.mac.plist` / `build/entitlements.mac.inherit.plist`; `electron-builder`
auto-discovers signing identity from the keychain when `CSC_*` env vars are absent.

### 2a. Apple Developer ID signing identity

| Var | Detail |
|---|---|
| `CSC_LINK` | Path or base64-encoded `.p12` Developer ID Application certificate |
| `CSC_KEY_PASSWORD` | Password for the `.p12` |
| Keychain alternative | If vars are absent, `electron-builder` auto-discovers "Developer ID Application: …" from the macOS login keychain — preferred for local builds |
| Purpose | Signs the `.app`, all frameworks, and `asarUnpack` native addons (`@nut-tree-fork`, wake-word ONNX runtime, embedding native bits) |
| Where it lives | Developer keychain (local) or CI secret store (CI pipeline) |
| Never in repo | `.p12` files, exported certs, and any file containing a passphrase must not be committed |

### 2b. Apple notarization credentials

| Var | Purpose |
|---|---|
| `APPLE_ID` | Apple ID email used for notarization (`xcrun notarytool`) |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password generated at `appleid.apple.com` — not the account password |
| `TEAM_ID` | 10-character Apple Developer Team ID |
| Where it lives | CI secret store; locally in shell profile or `~/.netrc` — never in `.env` files in the repo |
| When needed | Only during the `dmg`/`zip` notarize step; not needed for local `dir` builds or development |

> Until a Developer ID cert is acquired: document the one-time Gatekeeper bypass (`xattr -dr com.apple.quarantine Lena.app`) in the shared install guide. See R-7.

---

## 3. Non-secret configuration

Stored in app settings (SQLite `lena.db` or Electron `app.getPath('userData')` prefs) — not in the keychain, not in `.env`:

- OpenAI model name (e.g. `gpt-4o-realtime-preview`)
- Realtime voice selection
- Global hotkey binding
- Idle-timeout duration (seconds before auto-ending a session)
- UI theme / skin
- Agent name / personality / tone (identity — Phase 3)
- Idle-wake sensitivity threshold (Phase 5)
- Enabled Composio toolkits list (Phase 4)

---

## 4. State by environment

| Context | Signing | Credential storage | Credentials present |
|---|---|---|---|
| **Dev** (`npm start`, unsigned) | None (ad-hoc) | `safeStorage` — macOS Keychain (login keychain, accessible to the unsigned app process) | User must complete onboarding in dev session; tokens stored per `userData` path, which changes on bundle ID rename (R-11) |
| **Packaged unsigned** (`npm run build:mac`) | None or ad-hoc | `safeStorage` — Keychain | Same as dev; Gatekeeper will block first launch; one-time `xattr` bypass needed |
| **Packaged signed + notarized** (target for sharing) | Developer ID Application | `safeStorage` — Keychain | Distributed recipients complete onboarding on first launch; no tokens ship in the bundle; new `<userData>` per recipient machine |
| **CI build** | `CSC_LINK` / `CSC_KEY_PASSWORD` + notarization vars | Not applicable — CI does not run the app | Only build-time signing secrets are present |

---

## 5. .gitignore reminders

The following must never be committed:

```
# Credential files
src/**/*-credentials.json
openai-credentials.json
composio-credentials.json
mem0-credentials.json

# Database
lena.db
brah.db
*.db-shm
*.db-wal

# Build output
dist/

# Screenshots captured during sessions
screenshots/

# Signing artifacts
*.p12
*.mobileprovision

# Env files (not used by this app but guard against accidental creation)
.env
.env.*
!.env.example
```

These entries belong in the root `.gitignore`. The credentials files are runtime artefacts under
`app.getPath('userData')` (outside the repo tree on all platforms), but the glob guards
against any accidental copy placed alongside source files.
