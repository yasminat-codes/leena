---
id: "033"
title: "Switch build from dir to dmg + zip"
type: build
status: completed
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
attempts: 1
claim_started: "2026-06-03T01:04:37Z"
completed_at: "2026-06-03T01:24:00Z"
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
- Modified: `package.json` (mac targets now `dmg` + `zip`, added `build:mac:dir`, updated `open:mac`, GitHub publish config, and packaged `build/tray/**` assets)
- New: `GATEKEEPER-BYPASS.md`
- Build artifacts verified: `dist/Leena-0.1.0-arm64.dmg`, `dist/Leena-0.1.0-arm64-mac.zip`, and `dist/mac-arm64/Leena.app`

## Interface Contracts
- Task 039 (design system packaging): depends on build target being configured
- Task 037 (onboarding): no dependency — onboarding is runtime, not build
- Final distribution task: builds on this — produces the final .dmg

## Handoff Notes
- `npm run build:mac:dir` passed and produced `dist/mac-arm64/Leena.app`.
- `npm run build:mac` passed and produced the DMG/ZIP plus blockmaps.
- Mounted `dist/Leena-0.1.0-arm64.dmg`; the volume contains `Leena.app` and an `Applications` symlink.
- `npx asar list dist/mac-arm64/Leena.app/Contents/Resources/app.asar` confirms all six tray icon assets are packaged under `/build/tray/`.
- Final parent gates passed: `npm run check`, `node --test` (329/329), changed JS syntax checks, `git diff --check`, and package build-config probe.

## Errors Encountered
- Initial repo-wide gates failed while other Wave 10 slices were still unfinished; parent re-ran after integration and all gates passed.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| DMG build fails | electron-builder exit code | non-zero | Check native addon asar unpack, entitlements |
| App crashes on launch from DMG | App exits within 5s | Any | Check code signing, hardened runtime entitlements |
| Auto-updater throws | Error on checkForUpdates | Any | Verify publish config, guard for dev mode |
