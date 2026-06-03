---
id: "109"
title: "CSS token cleanup audit"
type: chore
status: completed
priority: medium
complexity: S
estimated_tokens: 8000
dependencies: ["100", "101", "102", "104"]
context_files:
  - src/renderer/styles.css
  - src/renderer/leena.css
skills: []
tags: [phase-7, css, cleanup, design-system]
attempts: 1
claim_started: "2026-06-03T08:05:33Z"
created_at: "2026-06-01"
---

## Objective
Audit all CSS files for hardcoded color, border-radius, blur, and shadow values that should reference leena.css custom properties — fix any violations to ensure full design-system compliance.

## Why This Matters
Functional phases may have added inline styles or hardcoded values that bypass the design system. A single hardcoded color breaks theme switching. This audit ensures visual consistency.

## Steps
1. Run a grep scan across `src/renderer/` for hardcoded hex colors (`#[0-9a-fA-F]{3,8}`), rgb/rgba values, and named colors (excluding inside leena.css itself and comments).
2. Run a grep scan for hardcoded `border-radius`, `box-shadow`, `backdrop-filter`, and `blur` values not using `var(--` references.
3. For each violation found: replace with the corresponding CSS custom property from leena.css (e.g., `#1a1a1a` → `var(--wall-bg)`).
4. Verify theme switching still works across all 3 themes × 3 treatments after replacements.
5. Run `npm run check` to confirm no Biome formatting issues introduced.

## Acceptance Criteria
- [x] Zero hardcoded color values in renderer CSS (outside leena.css)
- [x] Zero hardcoded border-radius/shadow/blur values
- [x] Theme switching renders correctly across all 9 theme × treatment combinations
- [x] `npm run check` passes

## Tests Required
- No new test file — this is a static analysis + manual verification task. The existing shell-rendering test (task 021) validates no JS errors.

## Outputs
- Modified CSS files across `src/renderer/` (any file with violations)
- Grep results log documenting what was found and fixed

## Interface Contracts
- No downstream dependencies — this is a cleanup task
- Prerequisite for task 111 (final DMG build) to ensure the packaged app looks correct

## Handoff Notes
- 2026-06-03T08:20:54Z — Ran required kencode-search queries before editing: `border-radius: var(--` and `box-shadow: var(--`.
- Extended task 109's active claim to `src/renderer/components/command-center.css` after the renderer-wide grep found an unclaimed hardcoded command-center shadow/blur violation; no design-system audit test edits were needed.
- Centralized legacy color/effect literals in `src/renderer/leena.css`, then replaced scattered `rgba(...)`, data-URI hex colors, transparent literals, radius fallbacks, raw blur values, and direct shadow/reset declarations in `src/renderer/styles.css` and `src/renderer/components/command-center.css`.
- Post-fix grep scans are clean for hardcoded hex/rgb/url colors outside `leena.css`, radius/shadow/backdrop declarations without `var(--...)`, and raw blur arguments. The named-color scan only reports comment text.
- Theme/treatment verification used `node --test test/shell-rendering.test.js`; the matrix test passed. Focused CSS/token gates also passed.
- No task-owned JavaScript changed. `node --check` across currently changed worktree JS files completed without output.
- Final combined Wave 14 gates passed after all workers completed: `npm run check`, `node --test` (515/515), `npm test`, WAL parse, and `git diff --check`.

## Errors Encountered
- Concurrent task 107 edits briefly blocked full gates while Activity files were still mid-patch. No task 109 code changes were required; combined Wave 14 gates passed after task 107 completed.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Hardcoded values reintroduced | grep finds new violations | 1 new violation | Add Biome lint rule or pre-commit hook for CSS custom property enforcement |
| Theme broken after replacement | visual regression | 1 theme/treatment combo | Verify var name maps to correct token in leena.css |
| Too many violations to fix manually | grep count | >50 violations | Batch-replace with sed; verify each file after |
