# Wave 15 — Band B (post-gate) · Final DMG + identity tests

**Band:** B (post-gate)
**Gate:** none
**Tasks:** 2

## Tasks
| ID | Title | Complexity | Depends on |
|----|-------|-----------|------------|
| 073 | Identity comprehensive test suite | S | 070, 071, 072 |
| 111 | Final DMG build + Gatekeeper bypass docs | M | 033, 039, 109 |

## Parallel dispatch
ONE parallel group (2 agents). 111 produces the full-feature `.dmg` (unsigned + `xattr -cr` INSTALL.md). Verified free of wake/MCP blocks. All terminal before Wave 16.

## Pre-wave protocol (MANDATORY)
Read LEARNINGS.md + FILE-CLAIMS.md. WAL `pre_run`. kencode-search before code.

## Post-wave protocol (MANDATORY)
WAL `post_run` → learnings → reviewer → advisor() → CodeRabbit (advisory) → commit → update OVERVIEW + TASKLOG.

## Execution notes
Final full-feature build. Deliverable checkpoint: confirm `dist/Leena-*.dmg` exists; record path + SHA-256 to `tasks/DELIVERABLE.md`.

## Gate
No gate — auto-proceed to Wave 16.
