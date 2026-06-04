---
id: "136"
title: "Full Disk Access status"
type: integration
status: completed
wave: 19
priority: critical
complexity: M
estimated_tokens: 12000
dependencies: ["135"]
context_files:
  - src/os-permissions.js
  - src/main.js
  - src/preload.js
  - test/os-permissions.test.js
skills: []
tags: [full-disk-access, macos, permissions]
attempts: 1
claim_started: "2026-06-04T00:04:46Z"
completed_at: "2026-06-04T00:37:29Z"
created_at: "2026-06-03"
---

## Objective
Add Full Disk Access guidance and best-effort status detection without claiming the app can grant the permission itself.

## Why This Matters
Full Disk Access is a high-power Mac capability. Leena must guide the user correctly and avoid dangerous or false behavior.

## Steps
1. Re-read task 122 trust contract and run kencode-search for current macOS Full Disk Access detection patterns.
2. Add a `full-disk-access` permission definition with clear label, description, and activation copy.
3. Add macOS settings deep link fallback for Privacy/Full Disk Access when available.
4. Implement best-effort status detection using a safe read probe if official status API is unavailable.
5. Expose status through existing permissions IPC/preload.
6. Add tests for granted, denied/unknown, unsupported, and open-settings behavior.

## Acceptance Criteria
- [x] Full Disk Access status appears in permissions snapshots.
- [x] Open Settings routes to macOS privacy settings or general privacy fallback.
- [x] Detection never reads or prints private file contents.
- [x] Unsupported/non-mac state is honest.

## Tests Required
- `node --test test/os-permissions.test.js`
- `npm run check`

## Outputs
- `src/os-permissions.js`
- `src/main.js` if status handler changes are needed.
- `src/preload.js` if exposed API changes.
- `test/os-permissions.test.js`

## Interface Contracts
Status probe may return `unknown`; unknown must not be treated as granted.

## Handoff Notes
- 2026-06-04T00:14:23Z: Re-read `tasks/artifacts/mac-access-trust-contract.md`, ran required kencode-search for `Privacy_AllFiles` and protected-path probe patterns, and checked official Electron/Apple guidance. Electron exposes media/accessibility status APIs but no Full Disk Access grant/status API; Apple keeps Full Disk Access as an explicit System Settings grant.
- Changed `src/os-permissions.js`: added Full Disk Access settings URL candidates with fallback, `openMacOsPrivacySettings(id, openExternal)`, content-free default probe paths, and `detectFullDiskAccessStatus()` that returns `granted`, `denied`, `unknown`, or `unsupported` without reading, printing, or returning private file contents. Unknown/stale/malformed states still fail closed through existing normalization/grant helpers.
- Changed `test/os-permissions.test.js`: added focused coverage for granted, denied, missing/unknown, unsupported non-mac, metadata-only probe calls, default probe paths, and macOS settings deep-link fallback behavior.
- Parent serialized integration completed in `src/main.js`; Node-only helpers were moved to `src/os-permissions-main.js` so renderer imports of `src/os-permissions.js` stay CSP/browser-safe. Existing preload permission APIs remain unchanged.
- Did not edit `tasks/LEARNINGS.md` because it is outside this worker's claimed write scope; parent should append the non-trivial Full Disk Access probe/fallback learning during terminal bookkeeping if desired.

- 2026-06-04T00:37:29Z parent verification: Full Disk Access status is wired into the main permission snapshot through a renderer-safe split: `src/os-permissions.js` keeps shared definitions, while `src/os-permissions-main.js` owns Node-only probe/settings helpers. `openOsPermissionSettings` now uses the macOS Full Disk Access deep-link fallback. Gates passed: `npm run check`, `node --test test/os-permissions.test.js test/wave18-integration.test.js`, full `node --test` (596/596), and content-free probe checks.

## Errors Encountered
- `npm run check` failed on unowned `src/renderer/screens/settings.js`: unused `SETTINGS_DETAIL_IDS` and formatter output at the settings detail router block.
- Full `node --test` failed in unowned Settings/UI tests: `test/settings-screen.test.js` `bindSettingsControls loads preferences and wires segmented clicks` and `test/shell-rendering.test.js` `shell sidebar navigation switches all screens` both throw `ReferenceError: resolveSettingsRouterRoot is not defined`; `test/ui-baseline-smoke.test.js` `captures deterministic post-MVP UI baseline screenshots` times out waiting for `#app-shell[data-onboarding='complete']`.
- Passing gates for claimed files: `node --check src/os-permissions.js`, `node --check test/os-permissions.test.js`, `node --test test/os-permissions.test.js` (9/9), `npx biome check src/os-permissions.js test/os-permissions.test.js`, and `git diff --check -- src/os-permissions.js test/os-permissions.test.js tasks/in-progress/136-full-disk-access-status.md`.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Private content logged | Diagnostic scan | Any content | Remove logging immediately |
| Unknown treated granted | Status mapper | Any occurrence | Fail closed |
| Deep link broken | Open settings result | Error | Fallback to general privacy URL |
