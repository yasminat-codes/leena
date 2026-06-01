---
id: "046"
title: "MVP .dmg build (guaranteed deliverable)"
type: build
status: pending
priority: critical
complexity: M
estimated_tokens: 12000
dependencies: ["021", "040", "056", "065", "073", "033", "039"]
context_files:
  - package.json
  - build/entitlements.mac.plist
  - src/main.js
skills: []
tags: [distribution, dmg, mvp, deliverable]
attempts: 0
created_at: "2026-06-01"
---

## Objective
Produce a working, installable, unsigned `Leena.dmg` at the end of the MVP boundary (Phases 0–4) — the guaranteed downloadable artifact, independent of whether Phases 5 (MCP), 6 (wake), or 7 (UI wire-live) complete.

## Why This Matters
The user's one mandatory deliverable is a `.dmg` they can download and run on macOS. The final full-feature build (task 111) transitively depends on later phases that *can* legitimately block in an unattended run (e.g. the wake-word Colab spike 091). This task decouples the deliverable from those fragile dependencies: once the MVP (approved shell + foundation + providers + memory + identity) is green, a runnable `.dmg` exists no matter what happens downstream. This is the safety net for the autonomous run.

## Steps
1. Confirm MVP gate tasks are all in `completed/` (021 shell, 040 phase-1 tests, 056 provider tests, 065 memory tests, 073 identity tests, 033 build target, 039 design-system packaging). If any are blocked, proceed anyway — build with what exists.
2. Run `npm run check` and `node --test` — confirm zero failures across the MVP codebase. Abort build only on test failure (not on missing optional features).
3. Run `npm run build:mac` (target `dmg` + `zip`, unsigned — `CSC_IDENTITY_AUTO_DISCOVERY=false` if no cert). Confirm `dist/Leena-*.dmg` is produced.
4. Mount the `.dmg`, drag `Leena.app` to a temp Applications dir, run `xattr -cr` on it, launch it headless-check (`open -a` then confirm process starts) — verify it does not crash on launch.
5. Copy the artifact to `dist/Leena-MVP.dmg` and write its path + SHA-256 to `tasks/DELIVERABLE.md`.

## Acceptance Criteria
- [ ] `dist/Leena-MVP.dmg` exists and is non-zero size
- [ ] App launches from a clean Applications copy after `xattr -cr` without crashing
- [ ] `npm run check` and `node --test` pass before the build runs
- [ ] `tasks/DELIVERABLE.md` records the artifact path + checksum

## Tests Required
- `test/build-smoke.test.js` — asserts `package.json` build config has `dmg` + `zip` targets and unsigned fallback is configured; asserts `dist/` artifact path convention. (Build itself is verified manually in steps; CI cannot run electron-builder reliably.)

## Outputs
- `dist/Leena-MVP.dmg`, `dist/Leena-MVP.zip`
- `tasks/DELIVERABLE.md` (artifact manifest)

## Interface Contracts
- Final-build task 111 reuses the same `npm run build:mac` pipeline; this task proves the pipeline works at MVP so 111 is low-risk.
- `tasks/DELIVERABLE.md` is the manifest the orchestrator reads to confirm the deliverable exists.

## Handoff Notes
[Filled after completion]

## Errors Encountered
[Filled if errors occur]

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Build fails on missing cert | electron-builder exit code | non-zero w/ signing error | Set `CSC_IDENTITY_AUTO_DISCOVERY=false`, rebuild unsigned |
| App crashes on launch | process alive after `open` | dead within 3s | Capture crash log, check asarUnpack for @nut-tree-fork native addon |
| dmg path convention drift | glob `dist/*.dmg` | 0 matches | Re-check electron-builder `artifactName` config |
