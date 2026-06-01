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
1. Run `npm run build:mac` — verify it completes without errors, producing both `.dmg` and `.zip` in `dist/`.
2. Mount the .dmg, verify the drag-to-Applications layout renders correctly (app icon + Applications symlink).
3. Copy Leena.app to /Applications (or a test directory), launch it — verify it opens without Terminal, displays the shell, and doesn't crash.
4. Verify the auto-updater `checkForUpdates()` call doesn't throw (should return the "packaged builds only" guard message from existing code).
5. Verify all native addons (`@nut-tree-fork` in asarUnpack) load correctly in the packaged build.
6. Write `INSTALL.md` at project root with: download link placeholder, drag-install instructions, Gatekeeper bypass command (`xattr -cr /Applications/Leena.app`), known limitations (unsigned), and first-run guide.

## Acceptance Criteria
- [ ] `npm run build:mac` produces .dmg and .zip without errors
- [ ] .dmg mounts and shows drag-to-install layout
- [ ] App launches from Applications without Terminal
- [ ] Design system renders correctly in packaged build (fonts, themes)
- [ ] Native addons load without errors
- [ ] Auto-updater doesn't throw
- [ ] INSTALL.md written with complete setup instructions

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
