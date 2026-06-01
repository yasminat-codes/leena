# Wave 02 — Band A (pre-gate) · Utilities + provider skeleton + visual primitives

**Band:** A (pre-gate)
**Gate:** none
**Tasks:** 4

## Tasks
| ID | Title | Complexity | Depends on |
|----|-------|-----------|------------|
| 001 | Retry with exponential backoff utility | S | 000 |
| 002 | Provider abstraction layer skeleton | S | 000 |
| 011 | Bundle and normalize brand fonts | S | 010 |
| 019 | Orb and waveform visualization components | M | 010 |

## Parallel dispatch
All deps satisfied by Wave 01 → ONE parallel group (4 agents). All terminal before Wave 03.

## Pre-wave protocol (MANDATORY)
Read LEARNINGS.md + FILE-CLAIMS.md. WAL `pre_run`. kencode-search before code.

## Post-wave protocol (MANDATORY)
WAL `post_run` → learnings → reviewer → advisor() → CodeRabbit (advisory) → commit → update OVERVIEW + TASKLOG.

## Execution notes
Two tracks in parallel: infra utilities (retry, provider registry skeleton) and visual primitives (fonts, orb/waveform). No cross-dependency.

## Gate
No gate — auto-proceed to Wave 03.
