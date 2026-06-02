---
id: "013"
title: "Home screen with mock data"
type: ui
status: pending
priority: high
complexity: M
estimated_tokens: 14000
dependencies: ["012"]
context_files:
  - design-system/Leena Design System.md
  - src/renderer/shell.js
  - src/renderer/leena.css
skills: []
tags: [phase-0, screen, home]
attempts: 0
created_at: "2026-06-01"
---

## Objective
Build the Home screen as a panel-glass hero section (greeting + orb placeholder + ask input) above a two-column grid of Recent Actions and Up Next, all using static mock data and design system tokens.

## Why This Matters
Home is the default landing screen — the first thing the user sees. It sets the visual tone and validates that the glass hero, list rows, gradient accent blocks, and grid layout all render correctly with the design system tokens.

## Steps
1. Create `src/renderer/screens/home.js` exporting a `renderHome()` function that returns an HTML string (or creates DOM elements) for the Home screen.
2. Build the hero section using `.panel-glass`: greeting text (`.lx-h1` "Good morning, Yasmine"), status label (`.lx-mono` "READY"), and an orb placeholder div (64px, uses `.orb` class). Add an ask-input pill — a rounded input field styled as `.btn--ghost` with placeholder "Ask Leena anything...".
3. Build the two-column grid (`display:grid; grid-template-columns:1.45fr 1fr; gap:var(--gap)`): left column = "Recent actions" card (`.card`) with 4-5 mock `.row` entries using `.tooldot` icons (calendar, mail, slack, browser) and mock text (e.g., "Sent email to Maya Chen", "Checked calendar for tomorrow"); right column = "Up next" card with 2-3 mock timeline entries + one `.grad` block ("Brief me on my day" prompt).
4. Wire `renderHome()` into `shell.js` so selecting "Home" in the sidebar renders this screen in `.content`.
5. Add static mock data as a `const MOCK_HOME_DATA` object at the top of `home.js` — makes it easy to swap for real data in Phase 6.

## Acceptance Criteria
- [ ] Home screen renders in the app shell when Home nav item is active
- [ ] Hero section has greeting, status, orb placeholder, and ask input
- [ ] Two-column grid with Recent Actions (4+ rows) and Up Next (2+ entries + gradient block)
- [ ] All `.tooldot` icons use correct gradient colors from §3 icon definitions
- [ ] All styling uses `leena.css` tokens — no inline hex colors
- [ ] Layout responds correctly to density switch (compact vs comfortable padding)
- [ ] `npm run check` passes

## Tests Required
- `test/home-screen.test.js`: Test that `renderHome()` returns valid HTML string containing expected elements (`.panel-glass`, `.row`, `.grad`, `.orb`). Verify mock data is structured correctly.

## Outputs
- `src/renderer/screens/home.js` — Home screen renderer with mock data
- `test/home-screen.test.js`

## Interface Contracts
- `renderHome()` returns HTML string or DocumentFragment mountable in `.content`
- Phase 6 task will replace `MOCK_HOME_DATA` with live data from activity + planner stores
- The orb placeholder will be replaced by the real orb component (task 019)

## Handoff Notes
_Filled after completion._

## Errors Encountered
_Filled if errors occur._

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Mock data format doesn't match real data shape | Diff mock vs real activity/planner schema | >2 fields diverge | Update mock to match real schema shape |
| Grid breaks at smaller window sizes | Visual test at 900px width | Layout overflow | Add min-width or responsive breakpoint |
| Hero glass effect invisible | Visual check in light theme | No blur/translucency | Verify .panel-glass has backdrop-filter + correct background |
