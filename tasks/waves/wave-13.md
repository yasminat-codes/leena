# Wave 13 — Band B (post-gate) · Wire shell to real data + text chat + memory prompts

**Band:** B (post-gate)
**Gate:** none
**Tasks:** 5

## Tasks
| ID | Title | Complexity | Depends on |
|----|-------|-----------|------------|
| 064 | Integrate memory into realtime prompts | M | 062, 063 |
| 100 | Home screen: mock → real data | M | 013, 063, 038 |
| 101 | Activity screen: mock → real data | M | 014, 063 |
| 104 | Settings screen: mock → real data (degrades gracefully) | M | 017, 053, 072 |
| 106 | Text chat input | M | 054, 105 |

## Parallel dispatch
ONE parallel group (5 agents). The shell starts becoming live. 104 degrades gracefully — wake/MCP controls render disabled if those subsystems blocked (no hard dep). All terminal before Wave 14.

## Pre-wave protocol (MANDATORY)
Read LEARNINGS.md + FILE-CLAIMS.md (screens share `renderer.js`/`index.html` → serialize). WAL `pre_run`. kencode-search before code.

## Post-wave protocol (MANDATORY)
WAL `post_run` → learnings → reviewer → advisor() → CodeRabbit (advisory) → commit → update OVERVIEW + TASKLOG.

## Execution notes
Memory-aware prompts (064) deliver the headline feature: cross-session recall. Text chat (106) shares the realtime tool backend.

## Gate
No gate — auto-proceed to Wave 14.
