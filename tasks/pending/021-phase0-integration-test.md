---
id: "021"
title: "Phase 0 integration test and polish"
type: test
status: pending
priority: high
complexity: M
estimated_tokens: 12000
dependencies: ["013", "014", "015", "016", "017", "018", "019", "020"]
context_files:
  - src/renderer/index.html
  - src/renderer/leena.css
  - src/renderer/shell.js
  - src/renderer/screens/
  - src/renderer/components/
skills: []
tags: [phase-0, test, integration, polish]
attempts: 0
created_at: "2026-06-01"
---

## Objective
Run a comprehensive integration test across all Phase 0 screens and components — verify rendering, navigation, theme switching, command center variants, and visual consistency. Fix any remaining issues. Write automated tests. This is the APPROVAL GATE task.

## Why This Matters
Phase 0 is the user's first look at Leena. Every screen, every theme combo, every command center state must render correctly. This is the ONLY human review point in the entire build — everything after this runs autonomously. Bugs caught here save hours of rework.

## Steps
1. Write `test/shell-rendering.test.js`: programmatically verify that importing each screen module (`home.js`, `activity.js`, `tasks.js`, `integrations.js`, `settings.js`) does not throw, and each `render*()` function returns a non-empty string/element. Verify `CommandCenter` instantiation and all method calls don't throw.
2. Write `test/design-system-audit.test.js`: scan all files in `src/renderer/` for hardcoded hex colors (`#[0-9a-f]{3,8}`) outside of `leena.css` — report any found (should be zero). Scan for any `font-family:` declarations not using `var(--font-*)` tokens. Scan for `border-radius` not using `var(--r-*)` tokens.
3. Run `npm run check` — fix any Biome lint/format errors across all Phase 0 files.
4. Run `npm test` — fix any test failures.
5. Verify `npm start` successfully opens the app and do a visual sweep: navigate all 5 screens, toggle all 3 themes × 3 treatments × 2 densities (18 combos total), open command center demo mode (Ctrl+D).
6. Fix any visual issues found: misaligned elements, wrong colors, broken glassmorphism, animation jank, font rendering issues.
7. Take a screenshot of the app in Dark/Aurora/Comfortable mode (the default) for the approval review.

## Acceptance Criteria
- [ ] `npm run check` passes with zero errors
- [ ] `npm test` passes with zero failures
- [ ] All 5 screens render without JavaScript errors
- [ ] All 18 theme×treatment×density combos render correctly
- [ ] Command center all 4 variants × 6 states render correctly
- [ ] Zero hardcoded hex colors outside leena.css
- [ ] Zero non-token font-family or border-radius values
- [ ] Orb displays correct treatment-specific gradient in all combos
- [ ] Glass effects (blur, translucency) visible on cards and panels
- [ ] Sidebar navigation switches screens correctly
- [ ] App opens successfully on `npm start`

## Tests Required
- `test/shell-rendering.test.js` — screen module import + render function tests
- `test/design-system-audit.test.js` — hardcoded color/font/radius scanner

## Outputs
- `test/shell-rendering.test.js`
- `test/design-system-audit.test.js`
- Any fixes to existing Phase 0 files found during testing
- Screenshot for approval review

## Interface Contracts
- Passing this task = Phase 0 COMPLETE
- All subsequent phases build on this approved shell
- The "take screenshot" step should use Electron's `webContents.capturePage()` or manual screenshot

## Handoff Notes
_Filled after completion._

## Errors Encountered
_Filled if errors occur._

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Tests pass but visual bugs exist | Manual review vs automated tests | Any visual bug tests didn't catch | Add more specific test assertions |
| Design audit finds hardcoded values | Count from audit test | >0 | Fix in source file, re-run audit |
| Theme combo breaks a specific screen | 18-combo matrix test | Any combo fails | Fix CSS specificity or missing token for that theme |
