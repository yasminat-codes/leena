# Phase 1 — Foundation & Rename

## 1. Goal & Exit Criteria

Ship a standalone, redistribution-ready Lena app that:

- Runs with **no terminal** — double-click `.app` or auto-start at login; closing Terminal does not kill it.
- **Launches on login** — `app.setLoginItemSettings` enrolled by default, toggleable in settings.
- **Reachable from tray** — menubar icon always visible; window is `skipTaskbar: true` so the tray is the only persistent entry point when the window is hidden.
- **Hotkey summon** — `Option+Space` shows the window and triggers session start from any app.
- **Branded Lena** — `productName` is "Lena", persona is "Lena" not "LAD", user-name placeholder is off "Ken", all microcopy updated.
- **Second-user onboarding** — a fresh install on a different macOS account presents an onboarding flow that collects credentials, stores them via `safeStorage`, and exits into a working session without any developer intervention.

Phase is complete when all eight tasks below are done and their test cases pass.

---

## 2. Design Per Task

### Task 1 — R-1 BLOCKER: Verify auth model for second accounts

**Risk:** The existing OAuth flow uses `codex_cli_simplified_flow` with `clientId: "app_EMoamEEZ73f0CkXaXp7hrann"`. This is the owner's registered OAuth app. It is unknown whether a second ChatGPT account can authorize through this client ID, whether OpenAI restricts it to the registering account, or whether it violates ToS for redistribution.

**Verification steps (manual, before writing any auth code):**

1. On a separate macOS account (or with a different browser profile), navigate to `https://auth.openai.com/oauth/authorize?client_id=app_EMoamEEZ73f0CkXaXp7hrann&response_type=code&redirect_uri=http://localhost:1455/auth/callback&scope=openid+profile+email+offline_access+api.connectors.read+api.connectors.invoke&code_challenge=...&code_challenge_method=S256`.
2. Sign in with a second OpenAI account that has ChatGPT Plus (required for Realtime API access via ChatGPT OAuth).
3. Confirm the authorization page loads, completes the redirect, and that the resulting access token successfully creates a realtime client secret via `POST /v1/realtime/sessions` (the existing `createRealtimeClientSecret` call in `main.js`).
4. Confirm the token works for at least one `gpt-realtime-2` session.

**Decision gate — two outcomes:**

| Outcome | Decision |
|---|---|
| OAuth works for second account | Keep OAuth as primary path. Add API-key path as fallback in onboarding (ADR-7 requirement). |
| OAuth fails or is restricted | Drop OAuth as primary. API-key path becomes the only onboarding path. Remove `openAIAuthConfig.clientId` dependency. The existing `loginOpenAI` / `getFreshOpenAICredentials` / `saveOpenAICredentials` functions still work — swap the token acquisition front-end only. |

**API-key path design (implement regardless — required by ADR-7):** User pastes an OpenAI API key in the onboarding UI. `main.js` stores it via `saveOpenAICredentials` using a synthetic credentials object `{ accessToken: key, refreshToken: null, expiresAt: Infinity }`. `createRealtimeClientSecret` already calls `POST /v1/realtime/sessions` with the `Authorization: Bearer <token>` header; an API key is valid there. `getFreshOpenAICredentials` skips the refresh logic when `refreshToken` is null and `expiresAt` is Infinity.

---

### Task 2 — Rename: Brah → Lena

**Recommendation on bundle ID (R-11):** Keep `appId: "com.unstablemind.brah"` stable. Change only `productName`. Rationale: changing the bundle ID orphans TCC permissions (microphone, screen recording) — macOS binds them to the bundle ID, not the display name. The keychain entry for `safeStorage` is also keyed to the bundle ID. A bundle-ID rename would require every user to re-grant TCC permissions and re-enter credentials. The "Brah" string never surfaces to end users; `productName` controls the `.app` name, menu bar name, and installer. Cost: the process name shown in Activity Monitor and macOS Privacy settings will say "Brah" not "Lena" until a future bundle-ID migration is explicitly planned.

**Migration for userData (R-11):** The `lena.db` name in the master plan stack table refers to a future rename. For Phase 1, leave the SQLite file as `brah.db` (it lives in Electron `userData` which is scoped by bundle ID). Add a `// TODO(phase-1): db file is brah.db; rename deferred to avoid orphaning existing data` comment in `database.js` only.

**Files to change:**

| File | Change |
|---|---|
| `package.json` | `"productName": "Brah"` → `"Lena"`. `NSMicrophoneUsageDescription`: replace "Brah" → "Lena". `NSScreenCaptureDescription`: replace "Brah" → "Lena". `build:mac` script `open dist/mac-arm64/Brah.app` → `Lena.app`. `open:mac` script same. |
| `src/realtime/prompts.js` | `STATIC_VOICE_INSTRUCTIONS`: `"You are LAD, Ken's"` → `"You are Lena, {name}'s"` where `{name}` is injected from `normalizeAgentProfile`; default user name changes from `"Ken"` to `""` (blank = "the user"). Update all four `AGENT_PERSONAS` prompt strings: replace literal `"Ken"` with `"the user"`. `DEFAULT_AGENT_PROFILE.name`: `"Ken"` → `""`. |
| `src/renderer/index.html` | Title tag and any visible "Brah" copy → "Lena". |
| `src/renderer/renderer.js` | Any `window.brah.*` calls stay as-is (the JS API name `brah` is internal — changing it requires coordinating preload + renderer; defer to Phase 6 UI pass). Add a `// NOTE: window.brah API name is internal; not user-visible` comment at the top of the file. |
| `src/renderer/styles.css` | Any text strings referencing "Brah". |
| `src/renderer/panel.js` | Any visible "Brah" copy. |

**Do not change:** `window.brah` in `preload.js` or any `ipcRenderer.invoke` channel names — these are internal identifiers not shown to users and changing them is a coordinated rename across all renderer call sites.

---

### Task 3 — Standalone build: `dir` → `dmg` + `zip`

**Current state:** `package.json` `build.mac.target` is `["dir"]`. This produces an unpackaged app bundle — no installer, no notarization, no update delta. `npm run build:mac` runs `electron-builder --mac dir`.

**Changes:**

- `package.json`: change `"target": ["dir"]` → `"target": ["dmg", "zip"]`.
- Add `"publish"` config pointing to a GitHub Releases feed (used by `electron-updater`, already wired in `main.js` via `autoUpdater`). Minimum: `{ "provider": "github", "owner": "<org>", "repo": "<repo>" }`.
- Add `build:mac:dir` script preserving the old `dir` target for local development launches (faster, no signing wait).
- `open:mac` script updated to open the `dmg` or use `build:mac:dir` path.
- Signing is auto-discovered from keychain via `CSC_*` env vars (already configured in `build/entitlements.mac.plist`). Without a cert, `electron-builder` falls back to ad-hoc; document this in the README.
- Notarization: add `afterSign` hook using `electron-notarize` (or `electron-builder`'s built-in `notarize` config with `appleId` + `appleIdPassword` from env vars `APPLE_ID` / `APPLE_ID_PASSWORD` / `APPLE_TEAM_ID`). Gate notarization behind `process.env.CI` or a `NOTARIZE=1` flag so local builds skip it.

**Verify:** `open Lena.app` with Terminal closed still runs. Drag-install from DMG works. `autoUpdater.checkForUpdates()` does not throw (returns "checked only in packaged builds" string per existing guard).

---

### Task 4 — Launch on login

**Implementation in `src/main.js`** inside `app.whenReady()`:

```js
// Enable login-item on first launch; respect user override afterward.
const loginSettings = app.getLoginItemSettings();
if (!loginSettings.wasOpenedAtLogin && !loginSettings.openAtLogin) {
  app.setLoginItemSettings({ openAtLogin: true });
}
```

**IPC handler** (new, in `main.js`):

```
ipcMain.handle("app:get-login-item", () => app.getLoginItemSettings().openAtLogin);
ipcMain.handle("app:set-login-item", (_event, enabled) => {
  app.setLoginItemSettings({ openAtLogin: Boolean(enabled) });
  return app.getLoginItemSettings().openAtLogin;
});
```

**Preload addition** (`src/preload.js`, inside the `brah` object):

```js
getLoginItem: () => ipcRenderer.invoke("app:get-login-item"),
setLoginItem: (enabled) => ipcRenderer.invoke("app:set-login-item", enabled),
```

**Settings UI hook:** the settings panel (existing in `panel.js`) gets a "Launch on login" toggle that calls `window.brah.setLoginItem(checked)`.

**Edge case:** `app.setLoginItemSettings` is a no-op in development (when `app.isPackaged === false`). Guard the IPC handler: `if (!app.isPackaged) return false;` before calling `getLoginItemSettings`.

---

### Task 5 — Menubar Tray

**New file: `src/tray.js`**

Owns the `Tray` instance. Called from `main.js` `app.whenReady()` after `createMainWindow()`. Exports `createTray(mainWindow)` and `updateTrayStatus(status)`.

**Status values:** `"idle"` | `"listening"` | `"speaking"` | `"muted"`. Maps to distinct icon files (16×16 template images for macOS dark/light mode auto-inversion): `tray-idle.png`, `tray-listening.png`, `tray-speaking.png`, `tray-muted.png`. Place under `src/renderer/assets/` or a new `src/assets/tray/`. Must be included in `package.json` `build.files`.

**Context menu:**

```
Open Lena          → mainWindow.show(); setMainWindowMode("panel")
──────────────────
Mute mic           → ipcMain emit "tray:toggle-mute" (renderer handles mic muting)
──────────────────
Launch on login ✓  → toggle app.setLoginItemSettings
──────────────────
Quit               → app.quit()
```

**IPC additions** (renderer can push status updates to the tray):

```
ipcMain.on("tray:set-status", (_event, status) => updateTrayStatus(status))
```

Preload (one-way send, not invoke):

```js
setTrayStatus: (status) => ipcRenderer.send("tray:set-status", status),
onTrayToggleMute: (cb) => ipcRenderer.on("tray:toggle-mute", cb),
offTrayToggleMute: (cb) => ipcRenderer.removeListener("tray:toggle-mute", cb),
```

**Pairing with `skipTaskbar: true`:** `createMainWindow` already sets `skipTaskbar: true`. The tray is the only persistent chrome. On `mainWindow.on("close")` intercept with `event.preventDefault(); mainWindow.hide()` so clicking the window close button hides rather than quits.

---

### Task 6 — Global hotkey

**Implementation in `src/main.js`** in `app.whenReady()`, after `createMainWindow()`:

```js
const { globalShortcut } = require("electron"); // already using ESM import at top
globalShortcut.register("Alt+Space", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isVisible()) {
    mainWindow.focus();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
  mainWindow.webContents.send("hotkey:summon");
});
```

On `app.on("will-quit")`: `globalShortcut.unregisterAll()`.

**Renderer side:** `ipcRenderer.on("hotkey:summon", ...)` in `renderer.js` starts a new session (same path as the existing start-session button).

**Preload addition:**

```js
onHotkeySummon: (cb) => ipcRenderer.on("hotkey:summon", cb),
offHotkeySummon: (cb) => ipcRenderer.removeListener("hotkey:summon", cb),
```

**Conflict handling:** `globalShortcut.register` returns `false` if the shortcut is already claimed by another app. Log via `writeDiagnosticLog("hotkey.register.failed", { shortcut: "Alt+Space" })` and surface a one-time notification in the tray tooltip: "Hotkey Alt+Space is in use by another app. Change it in Settings."

**IPC for user-configurable hotkey (defer to Phase 6):** For Phase 1, hardcode `Alt+Space`. Add a `// TODO(phase-6): make hotkey user-configurable` comment.

---

### Task 7 — Onboarding

**New directory: `src/onboarding/`**

**Files:**

- `src/onboarding/index.js` — `createOnboardingWindow()`: opens a modal `BrowserWindow` (width 520, height 640, modal to mainWindow, frame: true, resizable: false). Resolves when the user completes or cancels. Exports `runOnboardingIfNeeded()` which returns early if `await loadOpenAICredentials()` already returns a valid credential.
- `src/onboarding/onboarding.html` — multi-step UI (three screens: auth, optional integrations, permissions). No external dependencies; plain HTML + inline CSS matching the existing dark theme.
- `src/onboarding/onboarding-preload.js` — context-isolated bridge for the onboarding window. Exposes a separate `window.onboarding` object (not `window.brah`) to avoid naming conflicts.

**Three onboarding screens:**

**Screen 1 — Connect OpenAI** (required):
- If Task 1 confirmed OAuth works: show "Sign in with ChatGPT" button → calls existing `ipcRenderer.invoke("openai:login")` (reuses the full OAuth flow in main.js). Also show "Use API key instead" link that reveals a text input.
- If OAuth path was dropped: show only the API-key input.
- On success: advance to Screen 2.

**Screen 2 — Optional integrations** (skippable):
- Composio API key field (label: "Composio key — connect Gmail, Calendar, Slack"). Stored via a new `ipcMain.handle("onboarding:save-composio-key", ...)` → `safeStorage.encryptString` → write to `path.join(app.getPath("userData"), "composio-credentials.json")`.
- Mem0 API key field (label: "Mem0 key — enable persistent memory"). Same pattern, file `mem0-credentials.json`.
- "Skip for now" button advances to Screen 3.

**Screen 3 — Permissions walkthrough**:
- Calls existing `ipcRenderer.invoke("permissions:get-status")` → displays status for microphone and screen recording.
- For each denied permission: "Grant access" button → `ipcRenderer.invoke("permissions:open-settings", id)`.
- "Done" button closes the onboarding window.

**Trigger in `main.js`** `app.whenReady()` after `createMainWindow()`:

```js
await runOnboardingIfNeeded();
```

**Cost/idle warning** on Screen 1: one sentence below the auth button: "Lena keeps a realtime session open while active. See OpenAI's pricing for Realtime API usage."

---

### Task 8 — Code signing and notarization

**Prerequisites:**
- Apple Developer ID Application certificate enrolled in Keychain.
- `CSC_LINK` + `CSC_KEY_PASSWORD` env vars (or cert auto-discovered from default Keychain).
- `APPLE_ID`, `APPLE_ID_PASSWORD` (app-specific password), `APPLE_TEAM_ID` env vars for notarization.

**Changes to `package.json` build config:**

```json
"mac": {
  "identity": null,
  "sign": true,
  "notarize": {
    "teamId": "${APPLE_TEAM_ID}"
  }
}
```

(`electron-builder` >= 24 supports `notarize` inline; no separate `afterSign` script needed.)

**Native addon signing:** `@nut-tree-fork/nut-js` is in `asarUnpack` — `electron-builder` signs unpacked binaries automatically when a Developer ID cert is present. Verify: `codesign -dv --verbose=4 dist/mac-arm64/Lena.app/Contents/Resources/app.asar.unpacked/node_modules/@nut-tree-fork` shows a valid Developer ID signature.

**Without a cert (R-7):** `electron-builder` falls back to ad-hoc signing (works on the build machine only). Document in `README.md`: "First launch on another Mac: right-click → Open → Open anyway (Gatekeeper bypass)." This is the temporary state until a Developer ID cert is acquired.

---

## 3. File-Level Change List

| File | Action | Change summary |
|---|---|---|
| `package.json` | Edit | `productName` Brah→Lena; `mac.target` dir→[dmg,zip]; add `publish` config; update `extendInfo` usage strings; add `build:mac:dir` script; update `open:mac` |
| `src/main.js` | Edit | Add `globalShortcut` registration in `app.whenReady()`; add `app.setLoginItemSettings` first-launch logic; add `ipcMain.handle("app:get-login-item")` + `"app:set-login-item"`; add `ipcMain.on("tray:set-status")`; import and call `createTray()` from `src/tray.js`; call `runOnboardingIfNeeded()` in `app.whenReady()`; add `mainWindow.on("close")` hide-instead-of-quit; add `globalShortcut.unregisterAll()` in `will-quit` |
| `src/preload.js` | Edit | Add `getLoginItem`, `setLoginItem`, `setTrayStatus`, `onTrayToggleMute`, `offTrayToggleMute`, `onHotkeySummon`, `offHotkeySummon` to `window.brah` |
| `src/tray.js` | Create | `createTray(mainWindow)`, `updateTrayStatus(status)`, context menu, icon loading |
| `src/realtime/prompts.js` | Edit | `STATIC_VOICE_INSTRUCTIONS`: "LAD"→"Lena", "Ken's"→dynamic from profile; `DEFAULT_AGENT_PROFILE.name`: "Ken"→""; all `AGENT_PERSONAS` prompts: literal "Ken"→"the user" |
| `src/onboarding/index.js` | Create | `createOnboardingWindow()`, `runOnboardingIfNeeded()` |
| `src/onboarding/onboarding.html` | Create | Three-screen onboarding UI |
| `src/onboarding/onboarding-preload.js` | Create | `window.onboarding` bridge |
| `src/renderer/index.html` | Edit | Title, any visible "Brah" copy → "Lena" |
| `src/renderer/panel.js` | Edit | Any visible "Brah" copy; add "Launch on login" toggle calling `window.brah.setLoginItem`; add tray-status push calls `window.brah.setTrayStatus` on session state changes |
| `src/renderer/renderer.js` | Edit | Wire `window.brah.onHotkeySummon` to existing session-start path; add `window.brah API name is internal` comment |
| `src/renderer/styles.css` | Edit | Any "Brah" text strings |
| `src/realtime/tools/database.js` | Edit | Add `// TODO(phase-1): db file is brah.db; rename deferred` comment |
| `src/assets/tray/` | Create | Four 16×16 PNG template images: `tray-idle.png`, `tray-listening.png`, `tray-speaking.png`, `tray-muted.png` |

---

## 4. IPC Additions

All new channels follow the existing `verb:noun` pattern in `main.js` / `preload.js`.

| Direction | Channel | Payload | Notes |
|---|---|---|---|
| Renderer → Main (invoke) | `app:get-login-item` | — → `boolean` | Returns `openAtLogin`; always `false` in dev |
| Renderer → Main (invoke) | `app:set-login-item` | `boolean` → `boolean` | Sets and returns new value; no-op in dev |
| Renderer → Main (send) | `tray:set-status` | `"idle"\|"listening"\|"speaking"\|"muted"` | One-way; updates tray icon |
| Main → Renderer (push) | `tray:toggle-mute` | — | Sent when user clicks "Mute mic" in tray menu |
| Main → Renderer (push) | `hotkey:summon` | — | Sent on `Alt+Space` press |
| Renderer → Main (invoke) | `onboarding:save-composio-key` | `string` → `void` | Encrypts + persists via safeStorage |
| Renderer → Main (invoke) | `onboarding:save-mem0-key` | `string` → `void` | Encrypts + persists via safeStorage |

The `window.brah` object in `preload.js` gains: `getLoginItem`, `setLoginItem`, `setTrayStatus`, `onTrayToggleMute`, `offTrayToggleMute`, `onHotkeySummon`, `offHotkeySummon`.

The onboarding window uses a separate `window.onboarding` bridge in `src/onboarding/onboarding-preload.js` that re-invokes the shared main-process handlers (`openai:login`, `permissions:get-status`, `permissions:open-settings`, plus the two new `onboarding:save-*` handlers).

---

## 5. Edge Cases and Failure Modes

### R-1: OAuth fails for second account
- Fallback API-key path is always present in onboarding (Task 7, Screen 1). If `ipcRenderer.invoke("openai:login")` rejects, onboarding catches the error and shows "Sign in failed — paste an API key instead."
- The existing `getFreshOpenAICredentials` in `main.js` handles `null` credentials by throwing; `openai:create-realtime-secret` surfaces this to the renderer as an error toast.

### R-7: No Developer ID cert at build time
- Build succeeds with ad-hoc signing. App runs on the build machine.
- On another Mac: Gatekeeper blocks; user must right-click → Open. Document in README.
- `notarize` config is present but `APPLE_TEAM_ID` being unset causes `electron-builder` to skip notarization silently (verify this behavior; fallback: gate behind `if (process.env.NOTARIZE)` in a `beforeBuild` hook).

### R-11: Data orphaning on rename
- Decision: keep `appId: "com.unstablemind.brah"` and `brah.db`. No migration needed in Phase 1. TCC permissions and keychain entries are unaffected.
- If the decision is later reversed (future phase), the migration path is: on first launch after bundle-ID change, detect old `userData` dir (`~/Library/Application Support/Brah`), copy to new path (`Lena`), set a migration-complete flag.

### Login item fails silently
- `app.setLoginItemSettings` is silently ignored in dev builds. In packaged builds it requires no special entitlements on macOS 13+. If it fails (edge: sandboxed build), log via `writeDiagnosticLog("login-item.set.failed", ...)` and surface a settings-screen warning.

### Hotkey conflict
- `globalShortcut.register` returns `false`. Log + tray tooltip warning (described in Task 6). Do not crash. User can work around by clicking the tray icon.

### Mic denied at launch
- Onboarding Screen 3 shows "Microphone: Denied" with a "Grant access" button → `permissions:open-settings`. The app launches fine without mic access; the session start path in `renderer.js` already shows an error when mic is unavailable.

### Onboarding window closed without completing
- `runOnboardingIfNeeded()` checks credentials on every launch, not just first run. If credentials are missing after the window closes, the main window shows the existing "Sign in" prompt (already handled in `renderer.js`).

### `mainWindow` close button hides instead of quits
- `mainWindow.on("close", (e) => { e.preventDefault(); mainWindow.hide(); })`. The only quit path is Tray → Quit → `app.quit()`. This matches ADR-8 "always-ready" intent.

---

## 6. Definition of Done & Test Cases

Phase 1 is done when all of the following pass. Tests run via `npm test` (`npm run check && node --test`).

### Automated tests (`test/`)

| Test file | Cases |
|---|---|
| `test/tray.test.js` | `updateTrayStatus` accepts all four status values; rejects unknown values; does not throw when called before `createTray`. |
| `test/onboarding.test.js` | `runOnboardingIfNeeded` resolves immediately when credentials are present (mock `loadOpenAICredentials`). `onboarding:save-composio-key` IPC handler writes an encrypted file to the expected path (mock `safeStorage`). |
| `test/prompts.test.js` (extend existing) | `DEFAULT_AGENT_PROFILE.name` is `""`. `buildAgentInstructions` with empty name does not include the literal string "Ken". `STATIC_VOICE_INSTRUCTIONS` does not contain "LAD". All `AGENT_PERSONAS` prompts do not contain "Ken". |
| `test/login-item.test.js` | IPC handler `app:get-login-item` returns `false` in non-packaged env (mock `app.isPackaged = false`). |

### Manual verification checklist

- [ ] `npm run build:mac` produces `dist/mac-arm64/Lena.app` (not `Brah.app`).
- [ ] Double-click `Lena.app` with Terminal closed; app stays running.
- [ ] Menubar shows tray icon. Clicking it shows context menu with Open, Mute mic, Launch on login, Quit.
- [ ] `Option+Space` from any app: Lena window appears and session starts.
- [ ] System Preferences → Login Items shows "Lena" (or "Brah" until bundle-ID rename — acceptable for Phase 1).
- [ ] Fresh install on a second macOS user account: onboarding window appears on first launch.
- [ ] Onboarding: "Sign in with ChatGPT" (if OAuth confirmed) or API-key field completes successfully and stores credentials.
- [ ] Onboarding: "Skip" on optional integrations advances to permissions screen.
- [ ] Onboarding: "Done" closes onboarding; main window is functional.
- [ ] No "Brah" visible in any user-facing string (window title, tray menu, onboarding copy, panel UI).
- [ ] `window.brah` in DevTools console still works (internal name preserved).
- [ ] `npm run check` passes with zero Biome errors.

---

## 7. Dependencies

No new runtime npm packages beyond build tooling.

**Build-time additions (devDependencies):**

- `electron-builder` already present (`^26.8.1`). The `notarize` config is built in at this version — no separate `electron-notarize` package needed.
- No new runtime dependencies. Tray icons are PNG assets, not an npm package. Onboarding UI is plain HTML/CSS.

**Native addon unchanged:** `@nut-tree-fork/nut-js` remains in `asarUnpack`; no new native addons.
