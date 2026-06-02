---
id: "034"
title: "Auto-launch on macOS login"
type: feature
status: pending
priority: medium
complexity: S
estimated_tokens: 6000
dependencies: ["032", "038"]
context_files:
  - src/main.js
  - src/preload.js
skills: []
tags: [phase-1, launch, macos, settings]
attempts: 0
created_at: "2026-06-01"
---

## Objective
Enable Leena to optionally auto-launch when the user logs into macOS, controlled by a toggle in settings that defaults to off and is offered during onboarding.

## Why This Matters
A voice assistant is most useful when it's always available. Launch-on-login removes the friction of manually opening the app each session. Must be opt-in (not forced) to respect user control.

## Steps
1. In `src/main.js`, after `app.whenReady()`, read the `launchOnLogin` setting from the settings store (task 038). Call `app.setLoginItemSettings({ openAtLogin: value, openAsHidden: true })` — `openAsHidden: true` starts the app minimized to tray (depends on task 035 tray being done, but setting it now is harmless).
2. Add an IPC handler `settings:set-launch-on-login` that accepts `{ enabled: boolean }`, calls `app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true })`, and persists the value via the settings store.
3. Add an IPC handler `settings:get-launch-on-login` that reads the current state from the settings store and also calls `app.getLoginItemSettings()` to verify sync (prefer the OS value if they diverge).
4. Expose `setLaunchOnLogin(enabled)` and `getLaunchOnLogin()` in `src/preload.js` under `window.leena`.
5. Write `test/launch-on-login.test.js`: mock `app.setLoginItemSettings` and `app.getLoginItemSettings`, verify the IPC handlers call them correctly and persist state.

## Acceptance Criteria
- [ ] `app.setLoginItemSettings` called with correct value on app startup
- [ ] IPC `settings:set-launch-on-login` toggles the login item and persists
- [ ] `settings:get-launch-on-login` returns current state
- [ ] Default is `false` (off)
- [ ] Preload exposes `setLaunchOnLogin` and `getLaunchOnLogin`
- [ ] Test passes

## Tests Required
- `test/launch-on-login.test.js` — mock Electron app API, verify set/get roundtrip

## Outputs
- Modified: `src/main.js`, `src/preload.js`
- New: `test/launch-on-login.test.js`

## Interface Contracts
- Task 037 (onboarding): presents the toggle, calls `setLaunchOnLogin(true)` if user opts in
- Task 017 (settings screen mock): the real settings screen will wire to this

## Handoff Notes
<!-- Filled after completion -->

## Errors Encountered
<!-- Filled if errors occur -->

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Login item silently fails | App not in Login Items after setLoginItemSettings | Any | Check app.isPackaged guard — may only work in packaged builds |
| OS/settings state diverge | getLoginItemSettings disagrees with stored value | Any | Prefer OS value, re-sync stored value |
