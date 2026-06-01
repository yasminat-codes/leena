---
id: "046"
title: "MVP .dmg build (guaranteed deliverable)"
type: build
status: pending
priority: critical
complexity: M
estimated_tokens: 12000
dependencies: ["021", "040", "056", "065", "073", "033", "039", "100", "101", "104"]
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
Produce a working, installable, unsigned `Leena.dmg` — a genuinely **usable** MVP: the core screens (Home, Activity, Settings) wired to **real data** (tasks 100/101/104), backed by working providers, memory, and identity. This is the guaranteed downloadable artifact, **decoupled from Phases 5 (MCP) and 6 (wake)** — its full dependency set is verified free of any wake (090-096) or MCP (080-087) task, so it ships even if those phases block. (The 100/101/104 wire-live tasks are themselves wake/MCP-free.)

## Why This Matters
The user's one mandatory deliverable is a `.dmg` they can download and run on macOS. The final full-feature build (task 111) transitively depends on later phases that *can* legitimately block in an unattended run (e.g. the wake-word Colab spike 091). This task decouples the deliverable from those fragile dependencies: once the MVP (approved shell + foundation + providers + memory + identity) is green, a runnable `.dmg` exists no matter what happens downstream. This is the safety net for the autonomous run.

## Steps
1. Confirm MVP gate tasks are all in `completed/` (021 shell, 040 phase-1 tests, 056 provider tests, 065 memory tests, 073 identity tests, 033 build target, 039 design-system packaging). If any are blocked, proceed anyway — build with what exists.
2. Run `npm run check` and `node --test` — confirm zero failures across the MVP codebase. Abort build only on test failure (not on missing optional features).
3. Run `npm run build:mac` (target `dmg` + `zip`, unsigned — `CSC_IDENTITY_AUTO_DISCOVERY=false` if no cert). Confirm `dist/Leena-*.dmg` is produced.
4. Verify the artifact structurally (works headless / detached — no GUI needed): `dist/Leena-*.dmg` exists, is non-zero, `electron-builder` exited 0, and `hdiutil verify` / `hdiutil imageinfo` succeeds on the dmg. Mount read-only and confirm `Leena.app/Contents/MacOS/Leena` exists inside.
5. Copy the artifact to `dist/Leena-MVP.dmg` and write its path + SHA-256 to `tasks/DELIVERABLE.md`. Append a note: **launch-smoke (`open` the installed app, confirm window) requires the owner's GUI session — flag it in DELIVERABLE.md as an owner manual step, do NOT block the build on it.**

## Acceptance Criteria
- [ ] `dist/Leena-MVP.dmg` exists, non-zero, `electron-builder` exit 0, `hdiutil verify` passes
- [ ] `Leena.app` bundle present + executable inside the mounted dmg (structural check — headless-safe)
- [ ] `npm run check` and `node --test` pass before the build runs
- [ ] `tasks/DELIVERABLE.md` records the artifact path + checksum + the owner manual launch-smoke note
- [ ] *(owner, GUI session — not an autonomous gate)* app launches after `xattr -cr` without crashing

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
