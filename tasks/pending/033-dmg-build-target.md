---
id: "033"
title: "Switch build from dir to dmg + zip"
type: build
status: pending
priority: high
complexity: S
estimated_tokens: 8000
dependencies: ["032"]
context_files:
  - package.json
  - build/entitlements.mac.plist
  - build/entitlements.mac.inherit.plist
skills: []
tags: [phase-1, build, distribution, dmg]
attempts: 0
created_at: "2026-06-01"
---

## Objective
Change the electron-builder mac target from `dir` (unpackaged app bundle) to `dmg` + `zip` so the app produces an installable disk image and zip archive for distribution, while preserving a fast `dir` target for local development.

## Why This Matters
The final deliverable is a `.dmg` users can download and install. The current `dir` target produces no installer, no auto-update delta, and no drag-to-Applications experience. This task also wires up GitHub Releases for electron-updater.

## Steps
1. In `package.json`, change `build.mac.target` from `["dir"]` to `["dmg", "zip"]`.
2. Add a new script `"build:mac:dir": "electron-builder --mac dir"` for fast local dev builds (no signing wait).
3. Add `"publish"` config to the `"build"` section: `{ "provider": "github", "owner": "yasmineseidu", "repo": "leena" }` (adjust owner/repo if different).
4. Update `"open:mac"` script to: `"npm run build:mac:dir && open dist/mac-arm64/Leena.app"` (reflects the renamed app from task 032).
5. Add `GATEKEEPER-BYPASS.md` to project root documenting the unsigned app workaround: `xattr -cr /Applications/Leena.app` and right-click → Open bypass for first launch. Note this is only needed until a Developer ID cert is obtained.
6. Run `npm run build:mac:dir` to verify the dir target still works. Then run `npm run build:mac` to verify dmg + zip targets produce output in `dist/`.

## Acceptance Criteria
- [ ] `npm run build:mac` produces `dist/*.dmg` and `dist/*.zip`
- [ ] `npm run build:mac:dir` still works for fast local dev
- [ ] `open:mac` script references `Leena.app` (not `Brah.app`)
- [ ] `GATEKEEPER-BYPASS.md` exists with clear bypass instructions
- [ ] `autoUpdater.checkForUpdates()` does not throw (existing guard: "checked only in packaged builds")
- [ ] dmg opens and shows drag-to-Applications layout

## Tests Required
- No unit tests — this is a build config change
- Manual: build dmg, mount it, drag to Applications, launch — verify app runs
- Manual: verify `xattr -cr` bypass works on the unsigned .app

## Outputs
- Modified: `package.json` (targets, scripts, publish config)
- New: `GATEKEEPER-BYPASS.md`
- Build artifacts: `dist/Leena-*.dmg`, `dist/Leena-*.zip`

## Interface Contracts
- Task 039 (design system packaging): depends on build target being configured
- Task 037 (onboarding): no dependency — onboarding is runtime, not build
- Final distribution task: builds on this — produces the final .dmg

## Handoff Notes
<!-- Filled after completion -->

## Errors Encountered
<!-- Filled if errors occur -->

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| DMG build fails | electron-builder exit code | non-zero | Check native addon asar unpack, entitlements |
| App crashes on launch from DMG | App exits within 5s | Any | Check code signing, hardened runtime entitlements |
| Auto-updater throws | Error on checkForUpdates | Any | Verify publish config, guard for dev mode |
