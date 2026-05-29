# Brah

Electron desktop voice assistant that uses the OpenAI Realtime API to listen, view the screen, control the computer (browser + OS), and manage a local planner — all in realtime.

## Layout

- `src/main.js` — Electron main process: window modes, OpenAI OAuth, IPC handlers, screenshots, auto-update.
- `src/preload.js` — context-isolated bridge; exposes the `window.brah` API to the renderer. All renderer↔main communication goes through these `ipcRenderer.invoke` channels.
- `src/os-permissions.js` — macOS/Windows OS permission status + settings deep-links.
- `src/renderer/` — UI: `index.html`, `renderer.js`, `panel.js`, `styles.css`, plus realtime playback/tool-handler glue.
- `src/realtime/prompts.js` — builds the realtime session instructions.
- `src/realtime/tool-permissions.js` — per-tool permission metadata (read/low/write/destructive/network levels).
- `src/realtime/tools/` — tool implementations dispatched by `tools/index.js` (`executeRealtimeTool`): planner, web, screenshot, computer-use, session.
- `test/` — `node --test` suites (one per tool module).

## Architecture notes

- **Tool dispatch:** `executeRealtimeTool(name, args, options)` in `src/realtime/tools/index.js` tries each module's executor in order; each returns a falsy value when it does not own the tool name. New tools must be wired into both `tool-schemas.js` (definition) and a module executor.
- **Storage:** planner + activity persist in SQLite via `node:sqlite` (`brah.db`), not JSON. Schema lives in `src/realtime/tools/database.js`. `database.js` defaults the user-data dir to `os.tmpdir()/brah-user-data` unless `setDatabaseUserDataPath()` is called (main.js sets it to Electron `userData`). Legacy JSON stores are auto-migrated once.
- **Computer use:** browser mode via Playwright (`computer-use-browser.js`), OS mode via `@nut-tree-fork/nut-js` (`computer-use-os.js`); driven through `computer-use-tools.js`.
- **Credentials:** OpenAI auth tokens are encrypted with Electron `safeStorage` (system keychain). OAuth callback uses a local server on port `1455`.
- **Window modes:** `orb`, `call`, `panel` (sizes/placement defined in `main.js`); switched via `window:set-mode`.

## Commands

- `npm start` — run the app (`electron .`).
- `npm run check` — Biome format-check + lint.
- `npm test` — `npm run check` then `node --test`.
- `npm run build:mac` — `electron-builder --mac dir` (dir target only).
- `npm run open:mac` — build then launch `dist/mac-arm64/Brah.app`.
- `npm run update:deps` — `ncu -u && npm install`.

## Build constraints

- `@nut-tree-fork/**` must stay in `asarUnpack` (native addon, can't run from asar).
- macOS build is the `dir` target with hardened runtime + the entitlements in `build/`. Code signing is auto-discovered from the keychain / `CSC_*` env vars; with no cert it falls back to ad-hoc/unsigned.
