# Wave 04 — Band A (pre-gate) · All screens + command center (mock data)

**Band:** A (pre-gate)
**Gate:** none
**Tasks:** 6

## Tasks
| ID | Title | Complexity | Depends on |
|----|-------|-----------|------------|
| 013 | Home screen (mock data) | M | 012 |
| 014 | Activity screen (mock data) | S | 012 |
| 015 | Tasks/planner screen (mock data) | S | 012 |
| 016 | Integrations screen (mock data) | S | 012 |
| 017 | Settings screen (mock data + theme/density switcher) | M | 012 |
| 018 | Command Center — 4 variants + 6 assistant states | L | 012, 010 |

## Parallel dispatch
All depend only on the shell (012, done) → ONE parallel group (6 agents). **Watch file claims:** screens share `index.html`/`renderer.js` — agents MUST claim their section and coordinate via `FILE-CLAIMS.md`; if a shared file is claimed, serialize. All terminal before Wave 05.

## Pre-wave protocol (MANDATORY)
Read LEARNINGS.md + FILE-CLAIMS.md (critical this wave — shared files). WAL `pre_run`. kencode-search before code.

## Post-wave protocol (MANDATORY)
WAL `post_run` → learnings → reviewer → advisor() → CodeRabbit (advisory) → commit → update OVERVIEW + TASKLOG.

## Execution notes
The visual heart of Phase 0. Every screen + the command center, all on mock fixtures. This is most of what the owner reviews at the gate.

## Gate
No gate — auto-proceed to Wave 05.
