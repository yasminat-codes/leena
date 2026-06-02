# Wave 06 — Band A (pre-gate) · Phase 0 polish · ★ APPROVAL GATE ★

**Band:** A (pre-gate)
**Gate:** **APPROVAL GATE — the ONLY human gate in the entire build.**
**Tasks:** 1

## Tasks
| ID | Title | Complexity | Depends on |
|----|-------|-----------|------------|
| 021 | Phase 0 integration test + polish | M | 013, 014, 015, 016, 017, 018, 019, 020 |

## Parallel dispatch
Single task (one agent). Smoke-tests every screen + command-center variant, verifies theme switching, checks no hardcoded colors remain, writes `test/shell-rendering.test.js`.

## Pre-wave protocol (MANDATORY)
Read LEARNINGS.md + FILE-CLAIMS.md. WAL `pre_run`. kencode-search before code.

## Post-wave protocol (MANDATORY)
WAL `post_run` → learnings → reviewer → advisor() → CodeRabbit (advisory) → commit → update OVERVIEW + TASKLOG.

## Execution notes
Final polish of the visual shell. After this task is green, the build STOPS for owner review.

## Gate
**★ APPROVAL GATE — STOP HERE ★**
After task 021 completes:
1. Run `npm start` to launch the visual shell.
2. Tell the owner: *"Phase 0 visual shell complete. Review the app against `design-system/Leena Design System.md` — every screen, all 4 command-center variants, the 6 assistant states, and live theme/treatment/density switching. Approve to continue to Band B (functional phases, waves 7-16)."*
3. **Do NOT proceed to Wave 07 until the owner explicitly approves.**

This is the only stop in the entire autonomous build. Everything after this runs to completion (the .dmg) without further human input.
