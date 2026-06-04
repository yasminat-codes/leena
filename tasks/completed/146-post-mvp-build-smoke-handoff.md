---
id: "146"
title: "Post-MVP build smoke handoff"
type: build
status: completed
wave: 23
priority: critical
complexity: M
estimated_tokens: 13000
dependencies: ["144", "145"]
context_files:
  - package.json
  - tasks/DELIVERABLE.md
  - test/build-smoke.test.js
  - tasks/WAL-PROTOCOL.md
skills: []
tags: [build, smoke, deliverable, handoff]
attempts: 1
claim_started: "2026-06-04T05:41:41Z"
completed_at: "2026-06-04T05:58:51Z"
created_at: "2026-06-03"
---

## Objective
Run the final post-MVP gates, rebuild the unsigned macOS artifact, record checksums, and leave owner GUI smoke as an explicit manual checklist.

## Why This Matters
After UI and integration changes, the app must still package, verify, and launch structurally before owner review.

## Steps
1. Confirm tasks 144 and 145 passed and artifacts exist.
2. Run `npm run check`, full `node --test`, and `git diff --check`.
3. Build with `CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac`.
4. Verify DMG/ZIP structure with the same Wave 16 hdiutil and bundle checks.
5. Record artifact paths and hashes in `tasks/DELIVERABLE.md`.
6. Add owner manual GUI smoke checklist for voice, Chat, Composio, MCP, Full Disk Access, and Apple Calendar.

## Acceptance Criteria
- [x] Full automated gates pass.
- [x] DMG and ZIP build successfully.
- [x] Headless structure checks pass.
- [x] `tasks/DELIVERABLE.md` records paths, hashes, and manual GUI smoke checklist.
- [x] No claim is made that owner GUI smoke was completed autonomously.

## Tests Required
- `npm run check`
- `node --test`
- `git diff --check`
- `hdiutil verify` and `hdiutil imageinfo` on the built DMG.

## Outputs
- `dist/Leena-*.dmg`
- `dist/Leena-*.zip`
- `tasks/DELIVERABLE.md`

## Interface Contracts
Final handoff must preserve both build artifacts and an honest manual GUI smoke checklist.

## Handoff Notes
- Confirmed execution in the assigned Wave 23 worktree on branch `wave-23`; parent verification passed and the task is completed.
- Dependency proof confirmed on disk: task `144` is completed with `test/ui-baseline-smoke.test.js`, `tasks/artifacts/post-mvp-ui-regression/manifest.json`, and 16 PNG artifacts; task `145` is completed with `tasks/artifacts/post-mvp-integration-test-matrix.md` and `test/post-mvp-integration-matrix.test.js`.
- Ran `kencode-search` before file edits. It found only generic external `CSC_IDENTITY_AUTO_DISCOVERY=false` and `hdiutil imageinfo` references, with no reusable snippet for this repo; this handoff follows local Wave 16 packaging conventions.
- Gates passed: `npm run check` (after `npm ci`, Biome checked 187 files with no fixes applied), full `node --test` (637/637), `git diff --check`, `CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac`, `hdiutil verify dist/Leena-0.1.2-arm64.dmg`, `hdiutil imageinfo dist/Leena-0.1.2-arm64.dmg`, DMG read-only mount checks, ZIP `ditto` extraction checks, ASAR font/native-binary checks, and `codesign --verify --deep --strict --verbose=2 dist/mac-arm64/Leena.app`.
- Build mode: unsigned/ad-hoc. `codesign -dv --verbose=4 dist/mac-arm64/Leena.app` reports `Signature=adhoc`, `TeamIdentifier=not set`, and runtime flag present. Electron Builder skipped notarization because notarize options were unavailable.
- Current local artifact outputs:
  - `dist/Leena-0.1.2-arm64.dmg` — SHA-256 `2cbc7ed5f696941a9e4c63bded6daf7c0c5d5855b7a9cab28c7a645ef009d906`, 128566660 bytes.
  - `dist/Leena-0.1.2-arm64-mac.zip` — SHA-256 `5b7fbd7f908d4a4f4b63d08b13220a4ebfbe40eb21b2c6f43654e45c9c29972b`, 124425803 bytes.
  - `dist/latest-mac.yml` — SHA-256 `b1d4cf7af5c32a773c60c0a9d25f50a92278230fdd9ff3c3f504544122fd7734`, 499 bytes.
  - `dist/Leena-0.1.2-arm64.dmg.blockmap` — SHA-256 `47f01a2e83dbd49954ff5492bf1dc160956c31995254a38e27e0bde3109c5da7`, 135136 bytes.
  - `dist/Leena-0.1.2-arm64-mac.zip.blockmap` — SHA-256 `9a2e24f574e7fd0650851e296c658e9531304f6e515123c6e7450b4d50914f1c`, 131269 bytes.
- Headless structure passed: DMG contains `Leena.app` plus `Applications` symlink to `/Applications`; DMG and ZIP app executables are present and executable; both include `app.asar`, 21 renderer fonts inside ASAR, and 5 unpacked native binaries (`@nut-tree-fork` libnut darwin/linux/win32, `@nut-tree-fork/node-mac-permissions`, and `fsevents`).
- Updated `tasks/DELIVERABLE.md` with the current local Wave 23 artifact lane, preserved the prior GitHub release checkpoint lane because the same standard `dist/` filenames were regenerated, and added the required unchecked owner manual GUI smoke checklist for voice, Chat, Composio, Custom MCP, Full Disk Access, Apple Calendar, and visual regression review.
- Owner GUI smoke was not run, the app was not GUI-launched, and no manual checklist item is claimed complete.
- Parent independent verification reran `npm run check`, full `node --test` (637/637), `git diff --check`, `hdiutil verify`, `hdiutil imageinfo`, DMG read-only mount checks, ZIP extraction checks, ASAR font/native-binary checks, codesign verification, WAL parse, count audit, and task-artifact privacy scan before completion.

## Errors Encountered
- `npm run check` initially failed with `biome: command not found` because the clean wave worktree had no installed `node_modules`. Fixed by running `npm ci` from `package-lock.json`, then reran `npm run check` successfully. WAL and learnings checkpoint recorded.
- The first DMG/ZIP structure script incorrectly counted only loose `Resources` font files and expected Wave 16's older native-addon count. Current packaging keeps fonts inside `app.asar` and includes five unpacked native binaries. Fixed by rerunning the check against ASAR contents and current unpacked binary layout. WAL and learnings checkpoint recorded.
- Parent privacy scan found machine-specific worktree naming in task artifact prose. Fixed by replacing it with generic Wave 23 wording, then reran the scan successfully.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Build fails signing | electron-builder output | Signing/cert error | Rebuild unsigned with CSC flag |
| DMG invalid | hdiutil failure | Any failure | Fix packaging before handoff |
| GUI smoke fabricated | Deliverable checklist | Any autonomous checked owner item | Revert to manual unchecked |
