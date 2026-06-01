# Wave 09 — Band B (post-gate) · Command center live, MCP perms, wake engine, rename

**Band:** B (post-gate)
**Gate:** none
**Tasks:** 4

## Tasks
| ID | Title | Complexity | Depends on |
|----|-------|-----------|------------|
| 032 | Global rename: Brah → Leena (+ db migration) | M | 031 |
| 083 | MCP tool permission gating (ADR-6 default-deny) | M | 080, 082 |
| 092 | openWakeWord engine implementation | L | 090, 091 |
| 105 | Command Center driven by real session state | M | 018, 055 |

## Parallel dispatch
ONE parallel group (4 agents). **032 (rename) touches many files** — claim broadly in `FILE-CLAIMS.md`; other agents avoid those files. If 091 blocked, 092 will block too → skip, continue. All terminal before Wave 10.

## Pre-wave protocol (MANDATORY)
Read LEARNINGS.md + FILE-CLAIMS.md (critical — rename is wide). WAL `pre_run`. kencode-search before code. **Regression-guard the rename: existing tests must still pass after `window.brah` → `window.leena` and brah.db → lena.db migration.**

## Post-wave protocol (MANDATORY)
WAL `post_run` → learnings → reviewer → advisor() → CodeRabbit (advisory) → commit → update OVERVIEW + TASKLOG.

## Execution notes
Rename is a high-risk wide change — many downstream tasks (settings store, tray, build) depend on it landing cleanly.

## Gate
No gate — auto-proceed to Wave 10.
