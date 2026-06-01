---
id: "038"
title: "Persistent settings store"
type: feature
status: pending
priority: high
complexity: M
estimated_tokens: 14000
dependencies: ["032"]
context_files:
  - src/main.js
  - src/preload.js
  - src/realtime/tools/database.js
skills: []
tags: [phase-1, settings, storage, sqlite]
attempts: 0
created_at: "2026-06-01"
---

## Objective
Create a typed key-value settings store backed by the existing SQLite database (`node:sqlite`), with IPC channels for renderer access, supporting string, boolean, number, and JSON value types with sensible defaults.

## Why This Matters
Multiple features need persistent user preferences (theme, hotkey, launch-on-login, provider defaults, onboarding completion). Currently there's a `settings` table in the schema but no dedicated module. A centralized store prevents scattered localStorage / ad-hoc IPC.

## Steps
1. Create `src/settings-store.js` that imports the database module and exposes: `getSetting(key, defaultValue)`, `setSetting(key, value)`, `getAllSettings()`, `deleteSetting(key)`. Values are stored as JSON strings in the `settings` table (`key TEXT PRIMARY KEY, value TEXT, updated_at TEXT`).
2. Add typed convenience methods: `getString(key, default)`, `getBool(key, default)`, `getNumber(key, default)`, `getJSON(key, default)` — each parses the stored JSON string to the expected type.
3. Define the default settings map with initial values: `{ theme: 'dark', treatment: 'aurora', density: 'comfortable', hotkey: 'CommandOrControl+Shift+L', launchOnLogin: false, onboardingCompleted: false, defaultProvider: 'openai', defaultChatModel: 'gpt-4o', defaultEmbeddingModel: 'text-embedding-3-small', ollamaBaseUrl: 'http://localhost:11434', wakeMuted: false, wakeEnabled: false }`.
4. In `src/main.js`, register IPC handlers: `settings:get` (key, defaultValue) → `getSetting`, `settings:set` (key, value) → `setSetting`, `settings:get-all` → `getAllSettings`. After setting a value, send `data:changed` event with `{ type: 'settings', key }` so the renderer can react.
5. Expose in `src/preload.js` under `window.leena`: `getSetting(key, defaultValue)`, `setSetting(key, value)`, `getAllSettings()`.
6. Write `test/settings-store.test.js`: round-trip tests for each value type (string, bool, number, JSON object, JSON array), default value returns when key missing, overwrite existing key, delete key, getAllSettings returns full map.

## Acceptance Criteria
- [ ] `setSetting('theme', 'light')` → `getSetting('theme')` returns `'light'`
- [ ] `getBool('launchOnLogin', false)` returns `false` when unset
- [ ] `getJSON('customConfig', {})` returns parsed object
- [ ] `getAllSettings()` returns full key-value map
- [ ] IPC channels `settings:get`, `settings:set`, `settings:get-all` work from renderer
- [ ] Setting a value emits `data:changed` event
- [ ] All 6 test cases pass

## Tests Required
- `test/settings-store.test.js` — 6 cases: string round-trip, bool round-trip, number round-trip, JSON round-trip, default values, delete + getAllSettings

## Outputs
- New: `src/settings-store.js`
- Modified: `src/main.js` (IPC handlers)
- Modified: `src/preload.js` (settings API)
- New: `test/settings-store.test.js`

## Interface Contracts
- Task 034 (launch-on-login): reads/writes `launchOnLogin` setting
- Task 036 (hotkey): reads/writes `hotkey` setting
- Task 037 (onboarding): reads/writes `onboardingCompleted`
- Phase 2 (provider layer): reads/writes `defaultProvider`, model settings
- Phase 0 (theme switcher): reads/writes `theme`, `treatment`, `density`

## Handoff Notes
<!-- Filled after completion -->

## Errors Encountered
<!-- Filled if errors occur -->

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Type coercion bug | getBool returns string instead of boolean | Any | Fix JSON parse, add type validation |
| Settings table missing | getSetting throws on fresh DB | Any | Ensure CREATE TABLE IF NOT EXISTS in database.js |
| data:changed not firing | Renderer doesn't react to setting changes | Any | Verify webContents.send call in IPC handler |
