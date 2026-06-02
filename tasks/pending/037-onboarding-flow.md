---
id: "037"
title: "First-run onboarding wizard"
type: feature
status: pending
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
attempts: 0
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
- [ ] First launch shows onboarding wizard (not main app)
- [ ] Auth step: API key input works, validates against OpenAI
- [ ] Auth step: OAuth button works (if available)
- [ ] Permissions step: shows mic/screen/accessibility status with request buttons
- [ ] Name step: saves to agent profile
- [ ] Done step: sets `onboardingCompleted` flag
- [ ] Second launch skips onboarding, goes straight to main app
- [ ] Can re-run onboarding from settings (via `settings:reset-onboarding`)

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
<!-- Filled after completion -->

## Errors Encountered
<!-- Filled if errors occur -->

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Onboarding skipped unexpectedly | onboardingCompleted true on fresh install | Any | Check settings store default, verify key not pre-set |
| Permission request fails silently | OS permission not prompted | Any | Check entitlements, verify Electron permission API |
| Auth validation passes with invalid key | getOpenAIStatus returns ok for bad key | Any | Add explicit key validation call to OpenAI API |
