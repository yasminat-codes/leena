---
id: "039"
title: "Ship design system in packaged build"
type: build
status: completed
priority: medium
complexity: S
estimated_tokens: 6000
dependencies: ["033", "010"]
context_files:
  - package.json
  - src/renderer/index.html
  - design-system/Leena Design System.md
skills: []
tags: [phase-1, build, design-system, packaging]
attempts: 1
claim_started: "2026-06-03T02:05:04Z"
completed_at: "2026-06-03T02:14:09Z"
created_at: "2026-06-01"
---

## Objective
Verify that the Leena design system (leena.css, brand fonts, all CSS custom properties) works correctly in the packaged Electron app (asar), not just in dev mode, and fix any path or bundling issues.

## Why This Matters
CSS custom properties and font @font-face declarations use relative paths that may break inside an asar archive. If the design system doesn't ship correctly, the packaged app looks broken — wrong fonts, missing colors, no theme switching.

## Steps
1. After tasks 010 (leena.css) and 033 (dmg build) are complete, run `npm run build:mac:dir` to produce the packaged app bundle.
2. Launch `dist/mac-arm64/Leena.app` and open DevTools (`Cmd+Option+I`). Check the Console for any 404 errors on font files or CSS imports.
3. Verify all three themes (light, dark, vercel-dark) render correctly — no missing custom properties, no fallback fonts.
4. If font paths break: update @font-face `src` URLs to use `__dirname`-relative paths or adjust `package.json` `build.files` to include font directories. If CSS import paths break: adjust the HTML `<link>` or `@import` references.
5. Add font files directory to `build.files` in package.json if not already included (e.g., `"src/renderer/fonts/**/*"`).
6. Run the build again after fixes and verify clean DevTools console (no 404s, no CSS warnings).

## Acceptance Criteria
- [x] Packaged app renders all three themes correctly
- [x] All brand fonts load (no system font fallback visible)
- [x] DevTools console shows no 404 errors for fonts or CSS
- [x] Theme switching works in packaged app (not just dev mode)
- [x] `package.json` build.files includes font directory

## Tests Required
- No automated test — this is a build verification task
- Manual: launch packaged app, inspect DevTools, verify visual fidelity

## Outputs
- Potentially modified: `package.json` (build.files), font path references in leena.css
- Verified: packaged app renders design system correctly

## Interface Contracts
- All downstream UI tasks can assume the design system works in both dev and packaged builds
- Phase 6 (UI wire): relies on design system being correctly packaged

## Handoff Notes
- No source/config changes were necessary. `package.json` already packages `src/**/*` and `src/renderer/assets/**`, which covers `src/renderer/leena.css` and `src/renderer/assets/fonts/`.
- `npm run build:mac:dir` passed and produced `dist/mac-arm64/Leena.app`.
- `npx asar list dist/mac-arm64/Leena.app/Contents/Resources/app.asar` confirmed packaged `src/renderer/leena.css`, `src/renderer/index.html`, `src/renderer/styles.css`, and all 21 files under `src/renderer/assets/fonts/`.
- An `@electron/asar` archive check loaded packaged `src/renderer/leena.css`, found 17 `@font-face` URLs, 16 unique referenced font files, and 0 missing asar paths.
- Packaged Playwright Electron smoke launched `dist/mac-arm64/Leena.app/Contents/MacOS/Leena` from `app.asar`, saw 0 console/request/page errors, verified stylesheet hrefs for `leena.css`, `styles.css`, and `components/command-center.css`, flipped `workspace`, `light`, `dark`, and `vercel-dark` themes with populated CSS variables, and force-loaded all 17 registered runtime `FontFace` entries with 0 failures.
- Gates passed: `npm run check`, `node --test` (329/329), direct local CSS URL resolution, packaged asar contents check, packaged theme/font smoke, `git diff --check`, and task-artifact local-path scan.

## Errors Encountered
- The context file `design-system/Leena Design System.md` listed by the task is not present in this worktree; verification used completed task `011`, the runtime CSS/index/package files, source font assets, and packaged `app.asar` contents.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Fonts 404 in asar | Console 404 count for font files | >0 | Fix @font-face paths, add to build.files |
| CSS vars undefined | getComputedStyle returns empty for --leena-* vars | Any | Check CSS load order, verify leena.css linked |
| Theme switch broken in build | Theme attribute change has no effect | Any | Check CSS specificity, verify .leena wrapper |
