---
id: "104"
title: "Settings screen: mock to real data"
type: feature
status: completed
priority: high
complexity: M
estimated_tokens: 18000
dependencies: ["017", "053", "072"]
context_files:
  - src/renderer/index.html
  - src/renderer/renderer.js
  - src/settings-store.js
skills: []
tags: [phase-7, ui, wire-live, settings]
attempts: 1
claim_started: "2026-06-03T05:05:41Z"
created_at: "2026-06-01"
---

## Objective
Wire every Settings screen control to its real backend — provider selection, model pickers, theme/treatment/density, wake word toggles, persona controls, and general preferences — all persisted via the settings store.

## Why This Matters
Settings is the control panel for the entire app. Every subsystem (providers, identity, wake, appearance) surfaces configuration here. Broken settings = users can't customize anything.

**Graceful degradation (no hard dep on wake/MCP):** Wake-word and MCP controls must render in a **disabled** state with an explanatory tooltip when those subsystems are not yet present (feature-detect via `window.leena?.wake` / `window.leena?.mcp`). This task must NOT block on Phase 5 (MCP) or Phase 6 (wake) — it wires what exists and degrades the rest. Wake/MCP wiring is completed by their own phase tasks when present.

## Steps
1. Remove all hardcoded default values from Settings screen; on load, call `window.leena.invoke('settings:get-all')` to populate every control with persisted values.
2. Wire the Provider section: call `window.leena.invoke('providers:list')` to populate provider dropdown; on change, call `providers:set-config` and refresh model lists via `providers:get-config`.
3. Wire the Model Selection section: for each capability (chat, embeddings, TTS, STT), populate model dropdown from active provider's model list; on change, call `settings:set` with the chosen model.
4. Wire Theme/Treatment/Density controls to `settings:set` (replacing the localStorage mock from Phase 0); apply changes to `.leena` attributes immediately on change.
5. Wire Wake Word controls: enabled toggle → `wake:set-enabled`, mute toggle → `wake:mute`, status display from `wake:get-status`.
6. Wire Persona controls: name/tone fields → `identity:switch-persona` / `agent:set-profile`; persona list from `identity:list-personas`.
7. Wire general toggles (launch on login, proactive nudges, etc.) to `settings:set` with appropriate keys.

## Acceptance Criteria
- [x] All settings load from persisted store on screen open
- [x] Provider dropdown shows real registered providers
- [x] Model dropdowns update when provider changes
- [x] Theme/treatment/density changes apply immediately and persist
- [x] Wake word controls reflect real engine state when `window.leena.wake` exists and degrade disabled/explanatory when absent
- [x] Persona controls load and save real persona data
- [x] Live settings path persists through the settings store; legacy no-bridge localStorage fallback is preserved only for existing shell/appearance compatibility

## Tests Required
- `test/settings-screen-data.test.js` — mock IPC, verify settings load populates all controls, verify save calls correct IPC channels with correct keys

## Outputs
- Modified `src/renderer/screens/settings.js`
  - Added `createSettingsScreenController`, `loadSettingsScreenData`, `saveSettingsValue`, and `persistAppearancePreference`.
  - Settings load now reads persisted appearance/general/wake intent values, profile data, and persona data through the bridge.
  - Appearance clicks mutate the exact `#app-shell.leena` wrapper immediately and persist through `settings:set` when a settings bridge exists.
  - Persona switch/name save wiring uses `identity:switch-persona` and `agent:set-profile`.
  - Wake controls feature-detect `window.leena.wake`; absent wake runtime renders disabled controls with explanatory text/title.
  - Provider/model selector path is preserved and still receives the active bridge.
  - Launch on Login now routes through `window.leena.setLaunchOnLogin(bool)` / `settings:set-launch-on-login` when available so the OS login item updates immediately, with generic `settings:set` retained as fallback.
- Added `test/settings-screen-data.test.js`
  - Covers settings load population, Launch on Login side-effect calls, settings/profile/persona save calls, provider key preservation, live wake controls, and wake bridge absence.

## Interface Contracts
- Settings bridge: uses `window.leena.getAllSettings()` / `window.leena.setSetting(key, value)`, with `invoke("settings:get-all")` / `invoke("settings:set", key, value)` fallback for IPC-style tests.
- Launch on Login bridge: `launchOnLogin` writes prefer `window.leena.setLaunchOnLogin(bool)` or `invoke("settings:set-launch-on-login", { enabled })` before falling back to generic settings persistence.
- Provider bridge: existing `window.leena.providers.list/getConfig/setConfig/getModels/testConnection` model selector contract remains intact.
- Identity bridge: uses `window.leena.identity.listPersonas()` and `window.leena.identity.switchPersona(id)` for persona list/switching.
- Agent profile bridge: uses `window.leena.getAgentProfile()` and `window.leena.setAgentProfile(profile)` for profile name and persona persistence.
- Wake bridge: uses `window.leena.wake.getStatus()`, `window.leena.wake.setEnabled(bool)`, and `window.leena.wake.mute(bool)` only when the wake bridge exists; otherwise controls stay disabled.
- No downstream dependencies — settings is a leaf screen.

## Handoff Notes
- Required `kencode-search` pass completed before editing.
- Verification run:
  - `node --check src/renderer/screens/settings.js`
  - `node --check test/settings-screen-data.test.js`
  - `npx biome check src/renderer/screens/settings.js test/settings-screen-data.test.js`
  - `node --test test/settings-screen.test.js test/settings-screen-data.test.js test/provider-model-selector.test.js test/shell-rendering.test.js`
  - `node --test test/settings-screen-data.test.js` (6/6 after live wake/provider redaction coverage)
  - `node --test` (481/481 passing after reviewer fixes)
  - `git diff --check -- src/renderer/screens/settings.js test/settings-screen-data.test.js tasks/in-progress/104-mock-to-real-settings.md`
- Full `npm run check` is green after task `106` and parent integration fixes. This task's owned files also pass scoped Biome.
- I did not edit `src/main.js`, `src/preload.js`, CSS, or unrelated test/source files.

## Errors Encountered
- Earlier worker-scope full gates were blocked by active task `106` and shared integration files; those blockers were resolved. Final parent gates are green.
- Reviewer found the Launch on Login toggle only wrote the generic setting and skipped the OS side effect; fixed by routing that key through the dedicated launch bridge and regression coverage.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Settings not persisting across restart | user report | 1 occurrence | Verify settings:set writes to SQLite, not just in-memory |
| Model dropdown empty for a provider | test failure | 1 occurrence | Add fallback model list; log provider model-fetch failure |
| Theme change not applying | visual regression | 1 occurrence | Verify .leena attribute mutation; check CSS specificity |
