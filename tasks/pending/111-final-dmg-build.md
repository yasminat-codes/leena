---
id: "111"
title: "Final DMG build with Gatekeeper bypass docs"
type: build
status: pending
priority: critical
complexity: M
estimated_tokens: 15000
dependencies: ["033", "039", "109"]
context_files:
  - package.json
  - build/entitlements.mac.plist
  - src/main.js
skills: []
tags: [phase-7, build, distribution, dmg]
attempts: 0
created_at: "2026-06-01"
---

## Objective
Produce a distributable unsigned .dmg and .zip via `npm run build:mac`, verify the DMG installs and launches correctly, and write INSTALL.md with Gatekeeper bypass instructions.

## Why This Matters
This is the deliverable — a .dmg file someone can download, install, and run on their Mac. Without this, everything else is just code in a repo.

## Steps
1. Run `npm run build:mac` (unsigned — `CSC_IDENTITY_AUTO_DISCOVERY=false` if no cert) — verify it completes without errors, producing both `.dmg` and `.zip` in `dist/`.
2. **Headless structural verification (autonomous-safe — no GUI needed):** `hdiutil verify` the dmg; mount read-only; confirm drag-to-Applications layout (app bundle + Applications symlink), `Leena.app/Contents/MacOS/Leena` executable present, fonts present under `Resources`, and the `@nut-tree-fork` native addon present in `app.asar.unpacked`. These confirm a well-formed build without launching it.
3. Write `INSTALL.md` at project root: download instructions, drag-install steps, Gatekeeper bypass (`xattr -cr /Applications/Leena.app`), unsigned-build note, first-run guide.
4. Write path + SHA-256 of `dist/Leena-*.dmg` to `tasks/DELIVERABLE.md`, plus a clearly-flagged **owner manual checklist** (requires GUI session — NOT an autonomous gate): launches from Applications without Terminal, shell renders with correct fonts/themes, native addons load, `checkForUpdates()` returns the packaged-builds guard message.

## Acceptance Criteria
- [ ] `npm run build:mac` produces .dmg and .zip without errors (`electron-builder` exit 0)
- [ ] `hdiutil verify` passes; dmg mounts; `Leena.app` bundle + executable + fonts + unpacked native addon present (headless structural check)
- [ ] `INSTALL.md` written with complete setup + Gatekeeper bypass instructions
- [ ] `tasks/DELIVERABLE.md` records artifact path + SHA-256 + owner GUI launch checklist
- [ ] *(owner, GUI session — not an autonomous gate)* app launches without Terminal, renders shell, addons load, auto-updater doesn't throw

## Tests Required
- No automated tests — this is a build verification task. Manual verification checklist above serves as the test.

## Outputs
- `dist/Leena-{version}.dmg`
- `dist/Leena-{version}-mac.zip`
- `INSTALL.md` at project root

## Interface Contracts
- Depends on DMG build target (task 033)
- Depends on design system packaging (task 039)
- Depends on CSS token cleanup (task 109) for visual correctness
- This is a terminal task — no downstream dependencies

## Handoff Notes
[Filled after completion]

## Errors Encountered
[Filled if errors occur]

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Build fails on native addon | electron-builder error | 1 occurrence | Verify asarUnpack includes all native modules; check arch match |
| Fonts missing in packaged build | visual regression | 1 font missing | Verify extraResources or asar includes font files |
| App crashes on first launch | crash report | 1 occurrence | Check main process logs; verify all require paths resolve in asar |
