# Wave 01 — Band A (pre-gate) · Foundations begin

**Band:** A (pre-gate, Phase 0 visual shell)
**Gate:** none
**Tasks:** 2

## Tasks
| ID | Title | Complexity | Depends on |
|----|-------|-----------|------------|
| 000 | Error handling infrastructure | S | — |
| 010 | Design foundation CSS (leena.css tokens) | M | — |

## Parallel dispatch
Both tasks have no dependencies → dispatch as ONE parallel group (one Agent message, 2 agents). Both must reach terminal state before Wave 02.

## Pre-wave protocol (MANDATORY)
1. Read `tasks/LEARNINGS.md` — apply Active Rules.
2. Read `tasks/FILE-CLAIMS.md` — claim files before editing.
3. WAL `pre_run` per task before step 1. kencode-search before any code.

## Post-wave protocol (MANDATORY)
WAL `post_run` per task → append learnings → reviewer → advisor() gate → CodeRabbit (advisory) → commit vetted code → update OVERVIEW + TASKLOG.

## Execution notes
Bootstraps the two independent foundations: typed error handling (everything depends on it) and the design-token CSS (every screen depends on it).

## Gate
No gate — auto-proceed to Wave 02.
