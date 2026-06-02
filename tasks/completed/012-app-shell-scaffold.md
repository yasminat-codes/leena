---
id: "012"
title: "Build the app shell — window chrome, sidebar nav, top bar"
type: ui
status: completed
priority: high
complexity: M
estimated_tokens: 16000
dependencies: ["010", "011"]
context_files:
  - design-system/Leena Design System.md
  - src/renderer/index.html
  - src/renderer/panel.js
  - src/renderer/leena.css
skills: []
tags: [phase-0, app-shell, layout]
attempts: 3
claim_started: "2026-06-02T01:04:03Z"
review_fix_started: "2026-06-02T01:23:46Z"
review_fix_2_started: "2026-06-02T01:29:28Z"
completed_at: "2026-06-02T01:31:53Z"
created_at: "2026-06-01"
---

## Objective
Replace the existing Brah panel HTML/JS with the Leena app shell: a `.leena` wrapper with `data-theme`/`data-treatment`/`data-density` attributes, sidebar navigation (brand + 5 nav items + footer hint), top bar with traffic lights + title + date + icon buttons, and a `<div class="content">` area for screen rendering.

## Why This Matters
The app shell is the structural skeleton every screen and component mounts into. All 5 screens (Home, Activity, Tasks, Integrations, Settings), the command center, and the theme-switching system depend on this wrapper and navigation structure existing.

## Steps
1. In `src/renderer/index.html`, wrap the `<main>` content in a `.leena` div with default attributes `data-theme="dark" data-treatment="aurora" data-density="comfortable"`. Add `<link rel="stylesheet" href="./leena.css" />` BEFORE `styles.css`.
2. Replace the existing panel markup with the app shell structure from §5.1: `.win` container (1060×712 default) → `.side` aside (232px sidebar) + `.main` div → `.topbar` (52px) + `.content` div.
3. Build the sidebar: brand block (30px gradient square logo + "Leena" text in `.lx-h3` display), five `.nav-item` entries (Home with `home` icon, Activity with `activity` icon, Tasks with `tasks` icon, Integrations with `grid` icon, Settings with `settings` icon), and footer hint `⌘ Space to talk` in `.kbd` style. Use SVG icons from §3 inline.
4. Build the top bar: traffic-light dots (`.win__lights` — 3 circles: #ff5f57, #febc2e, #28c840), page title in display 15px/500, mono date label, spacer, bell + plus `.icon-btn` buttons.
5. Add a `src/renderer/shell.js` module that handles sidebar navigation: clicking a nav item sets `.nav-item--active` on the clicked item (removing from others), updates the top bar title, and swaps the `.content` area to show the corresponding screen (screen modules imported from separate files in later tasks — for now, show a placeholder `<div>Screen: {name}</div>`).
6. Update `src/renderer/panel.js` (or replace with `shell.js` import in `renderer.js`) to initialize the shell on DOMContentLoaded, defaulting to Home screen.
7. Copy gradient wallpaper PNGs from `design-system/gradients/` to `src/renderer/assets/gradients/` with canonical names (`Leena-Gradient-Light.png`, `Leena-Gradient-Dark.png`). Update `package.json` `build.files` to include `src/renderer/assets/**`.

## Acceptance Criteria
- [ ] `npm start` opens a window showing the Leena app shell with sidebar and top bar
- [ ] Sidebar has brand, 5 nav items with correct SVG icons, footer hint
- [ ] Clicking nav items switches active state and updates top bar title
- [ ] `.content` area shows placeholder for the active screen
- [ ] Window uses `--wall` gradient background (not flat color)
- [ ] All colors come from `leena.css` tokens — zero hardcoded hex in shell HTML/CSS
- [ ] Traffic lights render correctly (macOS native if `titleBarStyle: hidden` or custom dots)
- [ ] `npm run check` passes

## Tests Required
- `test/shell-navigation.test.js`: Test that `shell.js` exports a function to set active nav; verify it returns correct screen name; verify calling it with each nav item name works without error. (DOM-free — test the navigation state logic, not the DOM.)

## Outputs
- `src/renderer/index.html` — visible Leena `.win` shell with 232px sidebar, five exact design-system nav icons, topbar traffic lights/date/icon buttons, `.content` placeholder region, and preserved hidden runtime controls required by existing call/permissions/profile code.
- `src/main.js` — panel mode resized to 1060x712 so the Electron window opens at the app-shell contract size while orb/call modes remain unchanged.
- `src/renderer/shell.js` — DOM-free screen normalization plus `setActiveScreen(name, root)` and `initShell(root)` for sidebar active state, topbar title, date label, and placeholder content swapping.
- `src/renderer/assets/gradients/Leena-Gradient-Light.png` — bundled light wallpaper PNG copied from the external design-system reference.
- `src/renderer/assets/gradients/Leena-Gradient-Dark.png` — bundled dark wallpaper PNG copied from the external design-system reference.
- `package.json` — `build.files` explicitly includes `src/renderer/assets/**`.
- `test/shell-navigation.test.js` — DOM-free navigation export and screen-name coverage.

## Interface Contracts
- All screen tasks (013–017) mount their content inside `#shell-content.content`; `setActiveScreen()` replaces that region with the current placeholder until those tasks provide concrete screen renderers.
- `src/renderer/shell.js` exports `setActiveScreen(name, root?)`, `initShell(root?)`, and `shellScreens`; unknown screen names throw an error.
- The `.leena` wrapper retains `data-theme`, `data-treatment`, and `data-density` attributes and defaults to `dark` / `aurora` / `comfortable`, so task 020 can read/write them directly.
- The top bar title is `#shell-title` and updates through `setActiveScreen()`.
- Existing realtime and settings/profile controls remain present by ID so `src/renderer/renderer.js` can load without null-element regressions; the legacy activity panel no longer opens over the new shell by default.

## Handoff Notes
- Parent verification required a focused icon-path fix after the first worker pass; `Tasks`, `Settings`, and topbar bell now use the exact design-system §3 path data.
- Reviewer verification required a second focused fix: Electron `panel` mode now uses the app-shell size, and the Integrations grid icon now uses the exact design-system rect values.
- Reviewer re-review required a third focused fix: `#call-wave` now lives inside visible `#call-stage` so active-call waveform drawing remains visible.
- `npm start` was smoke-tested for startup only and intentionally terminated after diagnostics showed `session.start` and renderer secret prefetch; no manual visual approval gate applies until Wave 06.
- Gradients were sourced from `/Users/yasmineseidu/leena/design-system/gradients/` because the clean `origin/main` worktree does not include the untracked `design-system/` directory.
- Independent gates passed: `npm run check`, `node --test` (161 tests, 0 failed/skipped/todo), `node --check` on changed renderer JS/test files, exact icon path scan, `git diff --check`, and Electron startup smoke.

## Errors Encountered
- Initial worker implementation used approximate Tasks, Settings, and bell SVGs instead of the exact design-system paths. Re-dispatched the owning worker for a focused fix and re-ran all gates successfully.
- Reviewer gate found the app shell still rendered inside the old 440x600 Electron panel mode and the Integrations icon still used approximate grid rects. Re-dispatched the owning worker; `src/main.js` now opens panel mode at 1060x712 and `src/renderer/index.html` uses exact grid rects.
- Reviewer re-review found `#call-wave` inside hidden `legacy-controls`, which would hide the active-call waveform. Re-dispatched the owning worker; the single waveform canvas now lives inside visible `#call-stage`.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Nav item click does not switch screen | manual test: click each item | Any nav item fails | Debug event listener wiring in shell.js |
| Shell CSS overridden by styles.css | computed style inspection | Any token overridden | Ensure leena.css loads first; scope styles.css under .leena |
| Gradient wallpaper not visible | visual check on npm start | Flat bg color showing | Verify --wall defined for active theme; check .win uses var(--wall) |
