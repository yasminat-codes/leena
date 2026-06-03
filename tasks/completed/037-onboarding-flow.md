---
id: "037"
title: "First-run onboarding wizard"
type: feature
status: completed
priority: high
complexity: M
estimated_tokens: 18000
dependencies: ["031", "032", "035", "038"]
context_files:
  - src/main.js
  - src/preload.js
  - src/renderer/index.html
  - plans/auth-matrix.md
  - src/os-permissions.js
skills: []
tags: [phase-1, onboarding, auth, permissions]
attempts: 1
claim_started: "2026-06-03T02:05:04Z"
completed_at: "2026-06-03T02:54:10Z"
created_at: "2026-06-01"
---

## Objective
Build a multi-step first-run onboarding wizard that walks new users through authentication (OAuth or API key), OS permissions (microphone, screen capture, accessibility), and basic setup, storing a completion flag so it only runs once.

## Why This Matters
Distributed users have no credentials pre-configured. Without onboarding, the app launches broken — no auth tokens, no mic permission, no idea what to do. This is the first experience every new user has with Leena.

## Steps
1. Create `src/renderer/onboarding.js` — a multi-step wizard renderer with steps: Welcome → Auth → Permissions → Name → Done. Each step is a function that returns HTML for its panel and a validation function.
2. **Welcome step**: brand intro, "Get Started" button. No validation needed.
3. **Auth step**: read task 030 decision. Show API key input (always) + OAuth button (if OAuth verified). `window.leena.saveApiKey(key)` on submit. Validate: call `window.leena.getOpenAIStatus()` — must return authenticated.
4. **Permissions step**: call `window.leena.getOsPermissions()` and show each permission (microphone, screen-capture, accessibility) with status indicator and "Request" / "Open Settings" buttons. Validate: microphone permission must be granted (others recommended but not blocking).
5. **Name step**: text input for the user's name (stored in agent profile via `window.leena.setAgentProfile`). Optional — can skip.
6. **Done step**: summary of what's configured, show the hotkey (Cmd+Shift+L), "Start Using Leena" button. On click: set `onboardingCompleted: true` in settings store, transition to main app.
7. In `src/main.js`: on app ready, check `settings.getBool('onboardingCompleted')`. If false, load the onboarding view instead of the main view. After onboarding completes (IPC `onboarding:complete`), switch to main view.

## Acceptance Criteria
- [x] First launch shows onboarding wizard (not main app)
- [x] Auth step: API key input works, validates against OpenAI
- [x] Auth step: OAuth button works (if available)
- [x] Permissions step: shows mic/screen/accessibility status with request buttons
- [x] Name step: saves to agent profile
- [x] Done step: sets `onboardingCompleted` flag
- [x] Second launch skips onboarding, goes straight to main app
- [x] Can re-run onboarding from settings (via `settings:reset-onboarding`)

## Tests Required
- No unit test for onboarding UI (Electron renderer — manual QA only)
- Manual QA: fresh app state → onboarding flow → complete → restart → skips onboarding
- Test: `onboardingCompleted` flag persists in settings store (covered by 038 tests)

## Outputs
- New: `src/renderer/onboarding.js`
- Modified: `src/main.js` (onboarding check, view switching)
- Modified: `src/renderer/index.html` (onboarding container)

## Interface Contracts
- Task 031 (API key): provides `saveApiKey` and `getAuthType`
- Task 035 (tray): "Settings" action can trigger re-onboarding
- Task 038 (settings store): persists `onboardingCompleted` flag
- Phase 2 (provider layer): onboarding gains provider selection step

## Handoff Notes
Worker 037 delivered the integration-ready renderer contract without touching shared `src/main.js`,
`src/preload.js`, or `src/renderer/index.html` in this parallel pass.

Implemented `src/renderer/onboarding.js`:
- Exports `ONBOARDING_STEPS` for `Welcome`, `Auth`, `Permissions`, `Name`, and `Done`.
- Exports pure helpers: `renderOnboardingShell`, `normalizeAuthStatus`,
  `normalizePermissions`, `hasRequiredPermissions`, `formatHotkey`, `shouldShowOnboarding`,
  `completeOnboarding`, and `resetOnboarding`.
- Exports DOM integration helpers: `createOnboardingFlow(options)` and
  `mountOnboarding(target, options)`.
- Uses existing `window.leena` APIs only: `saveApiKey`, `loginOpenAI`, `getOpenAIStatus`,
  `getOsPermissions`, `requestOsPermission`, `openOsPermissionSettings`, `getAgentProfile`,
  `setAgentProfile`, `getSetting`, and `setSetting`.

Exact main/preload handoff for the integration pass:
1. `src/main.js`: on app ready after `initializeDataStore()`, read
   `getSetting("onboardingCompleted", false)`. If false, load the same packaged
   renderer file and pass a launch flag or query param such as `?onboarding=1`.
2. `src/renderer/index.html`: integration may add a mount container or reuse
   `#shell-content`; load `src/renderer/onboarding.js` when the launch flag says onboarding.
3. `src/renderer/renderer.js` or a small bootstrap module: call
   `mountOnboarding(target, { onComplete })`; `onComplete` should remove the onboarding
   surface and initialize/show the normal shell.
4. `src/main.js`: add `onboarding:complete` and `settings:reset-onboarding` IPC aliases only if
   the product wants named channels. They can delegate to
   `setSetting("onboardingCompleted", true/false)`; the renderer module already works today
   through `window.leena.setSetting`.
5. `src/preload.js`: expose optional `completeOnboarding()` and `resetOnboarding()` wrappers for
   those aliases, or keep using existing `setSetting` if no alias is desired.

Verification from this worker:
- `node --test test/onboarding-flow.test.js` passed, 5/5.
- `node --check src/renderer/onboarding.js && node --check test/onboarding-flow.test.js` passed.
- `npx biome check src/renderer/onboarding.js test/onboarding-flow.test.js` passed.
- Full `node --test` passed, 354/354.

- Parent integration 2026-06-03T02:54:10Z: `src/main.js` and `src/preload.js` now expose `onboarding:complete` and `settings:reset-onboarding` aliases.
- Reviewer fix 2026-06-03T03:12:59Z: first launch now passes `?onboarding=1` when `onboardingCompleted` is false; `src/renderer/renderer.js` mounts `src/renderer/onboarding.js`, hides the main shell until completion, then starts the normal app runtime. Added tokenized onboarding styling and a runtime bootstrap regression in `test/onboarding-flow.test.js`.

## Errors Encountered
- Earlier worker-local `npm run check` was blocked by parallel task `053`; the parent integration
  fixed that shared-file state and reran focused onboarding, Biome, and full wave gates successfully.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Onboarding skipped unexpectedly | onboardingCompleted true on fresh install | Any | Check settings store default, verify key not pre-set |
| Permission request fails silently | OS permission not prompted | Any | Check entitlements, verify Electron permission API |
| Auth validation passes with invalid key | getOpenAIStatus returns ok for bad key | Any | Add explicit key validation call to OpenAI API |
