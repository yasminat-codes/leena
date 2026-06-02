---
id: "104"
title: "Settings screen: mock to real data"
type: feature
status: pending
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
attempts: 0
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
- [ ] All settings load from persisted store on screen open
- [ ] Provider dropdown shows real registered providers
- [ ] Model dropdowns update when provider changes
- [ ] Theme/treatment/density changes apply immediately and persist
- [ ] Wake word controls reflect real engine state
- [ ] Persona controls load and save real persona data
- [ ] No hardcoded defaults or localStorage usage remains

## Tests Required
- `test/settings-screen-data.test.js` — mock IPC, verify settings load populates all controls, verify save calls correct IPC channels with correct keys

## Outputs
- Modified `src/renderer/screens/settings.js` (or equivalent)
- New `test/settings-screen-data.test.js`

## Interface Contracts
- Depends on `settings:get-all`, `settings:set` (task 038)
- Depends on `providers:list`, `providers:get-config`, `providers:set-config` (task 053)
- Depends on `identity:list-personas`, `identity:switch-persona` (task 072)
- Depends on `wake:set-enabled`, `wake:mute`, `wake:get-status` (task 094)
- No downstream dependencies — settings is a leaf screen

## Handoff Notes
[Filled after completion]

## Errors Encountered
[Filled if errors occur]

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Settings not persisting across restart | user report | 1 occurrence | Verify settings:set writes to SQLite, not just in-memory |
| Model dropdown empty for a provider | test failure | 1 occurrence | Add fallback model list; log provider model-fetch failure |
| Theme change not applying | visual regression | 1 occurrence | Verify .leena attribute mutation; check CSS specificity |
