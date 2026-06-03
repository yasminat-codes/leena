---
id: "111"
title: "Final DMG build with Gatekeeper bypass docs"
type: build
status: completed
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
attempts: 1
claim_started: "2026-06-03T10:05:06Z"
completed_at: "2026-06-03T10:18:35Z"
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
4. Write path + SHA-256 of `dist/Leena-*.dmg` to `tasks/DELIVERABLE.md`, plus a clearly-flagged **owner manual checklist** (requires GUI session — NOT an autonomous gate): launches from Applications without Terminal, shell renders with correct fonts/themes, native addons load, and update check does not throw. Current source returns `Update check started.` in packaged builds and the guard string `Updates are checked only in packaged builds.` in development.

## Acceptance Criteria
- [x] `npm run build:mac` produces .dmg and .zip without errors (`electron-builder` exit 0)
- [x] `hdiutil verify` passes; dmg mounts; `Leena.app` bundle + executable + fonts + unpacked native addon present (headless structural check)
- [x] `INSTALL.md` written with complete setup + Gatekeeper bypass instructions
- [x] `tasks/DELIVERABLE.md` records artifact path + SHA-256 + owner GUI launch checklist
- [x] Owner GUI checklist recorded for launch/font/addon/update verification; GUI launch remains owner/manual and was not claimed as an autonomous gate.

## Tests Required
- Required gates for this build task:
  - `npm run check`
  - `node --test`
  - `git diff --check`
  - DMG/ZIP structural checks recorded in the handoff below.

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
- Worktree verified: clean Wave 15 worktree on branch `wave-15`.
- Pre-edit `kencode-search` queries:
  - `"asarUnpack" "@nut-tree-fork"`: no public code matches.
  - `"hdiutil verify" "Applications"`: no public code matches.
- Build command: `CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac`.
- Build result: passed; electron-builder produced `dist/Leena-0.1.0-arm64.dmg` and `dist/Leena-0.1.0-arm64-mac.zip`.
- DMG SHA-256: `eb82e79a4dd974999c0a4a645335916e70a37741c5da3887a9891b6ad8392463`.
- ZIP SHA-256: `fb1530e7b778360ec24082c00c78f586126b779a92c0fde6fb3c47015e7bb849`.
- `hdiutil verify dist/Leena-0.1.0-arm64.dmg`: passed, checksum valid.
- Read-only DMG mount path used: `<temp-dmg-mount>`; detached after verification.
- DMG layout verified: `Leena.app` and `Applications` symlink to `/Applications`.
- App executable verified: `Leena.app/Contents/MacOS/Leena` present and executable.
- Fonts verified: 21 files under `Contents/Resources/app.asar` at `/src/renderer/assets/fonts/`.
- Native addon unpacking verified: `@nut-tree-fork` `.node` files present under `Contents/Resources/app.asar.unpacked/node_modules/@nut-tree-fork/`.
- ZIP structure verified with `ditto`: app executable, 21 packaged fonts, and unpacked `@nut-tree-fork` native addons present.
- Root install doc written: `INSTALL.md`.
- Deliverable manifest written: `tasks/DELIVERABLE.md`.
- Owner GUI checklist is recorded in `tasks/DELIVERABLE.md`; GUI launch was not claimed as an autonomous gate.

## Errors Encountered
- None.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Build fails on native addon | electron-builder error | 1 occurrence | Verify asarUnpack includes all native modules; check arch match |
| Fonts missing in packaged build | visual regression | 1 font missing | Verify extraResources or asar includes font files |
| App crashes on first launch | crash report | 1 occurrence | Check main process logs; verify all require paths resolve in asar |
