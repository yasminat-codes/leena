---
id: "109"
title: "CSS token cleanup audit"
type: chore
status: pending
priority: medium
complexity: S
estimated_tokens: 8000
dependencies: ["100", "101", "102", "104"]
context_files:
  - src/renderer/styles.css
  - src/renderer/leena.css
skills: []
tags: [phase-7, css, cleanup, design-system]
attempts: 0
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
- [ ] Zero hardcoded color values in renderer CSS (outside leena.css)
- [ ] Zero hardcoded border-radius/shadow/blur values
- [ ] Theme switching renders correctly across all 9 theme × treatment combinations
- [ ] `npm run check` passes

## Tests Required
- No new test file — this is a static analysis + manual verification task. The existing shell-rendering test (task 021) validates no JS errors.

## Outputs
- Modified CSS files across `src/renderer/` (any file with violations)
- Grep results log documenting what was found and fixed

## Interface Contracts
- No downstream dependencies — this is a cleanup task
- Prerequisite for task 111 (final DMG build) to ensure the packaged app looks correct

## Handoff Notes
[Filled after completion]

## Errors Encountered
[Filled if errors occur]

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Hardcoded values reintroduced | grep finds new violations | 1 new violation | Add Biome lint rule or pre-commit hook for CSS custom property enforcement |
| Theme broken after replacement | visual regression | 1 theme/treatment combo | Verify var name maps to correct token in leena.css |
| Too many violations to fix manually | grep count | >50 violations | Batch-replace with sed; verify each file after |
