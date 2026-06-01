---
id: "012"
title: "Build the app shell — window chrome, sidebar nav, top bar"
type: ui
status: pending
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
attempts: 0
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
- `src/renderer/index.html` — rewritten with `.leena` wrapper + app shell markup
- `src/renderer/shell.js` — sidebar navigation logic
- `src/renderer/assets/gradients/` — 2 wallpaper PNGs
- `package.json` — `build.files` updated
- `test/shell-navigation.test.js`

## Interface Contracts
- All screen tasks (013–017) mount their content inside `.content` div
- `shell.js` exports `setActiveScreen(name)` that screens can call
- The `.leena` wrapper's `data-theme`, `data-treatment`, `data-density` attributes are readable/writable by the theme switcher (task 020)
- The top bar title updates via `shell.js` when screen changes

## Handoff Notes
_Filled after completion._

## Errors Encountered
_Filled if errors occur._

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Nav item click does not switch screen | manual test: click each item | Any nav item fails | Debug event listener wiring in shell.js |
| Shell CSS overridden by styles.css | computed style inspection | Any token overridden | Ensure leena.css loads first; scope styles.css under .leena |
| Gradient wallpaper not visible | visual check on npm start | Flat bg color showing | Verify --wall defined for active theme; check .win uses var(--wall) |
