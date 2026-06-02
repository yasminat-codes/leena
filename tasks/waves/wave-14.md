# Wave 14 — Band B (post-gate) · History, nudges, persona composition, E2E + memory tests

**Band:** B (post-gate)
**Gate:** none
**Tasks:** 6

## Tasks
| ID | Title | Complexity | Depends on |
|----|-------|-----------|------------|
| 065 | Memory comprehensive test suite | M | 062, 064 |
| 071 | Persona-aware prompt composition | M | 070, 064 |
| 107 | Conversation history + search | M | 101, 064 |
| 108 | Proactive nudges (opt-in) | M | 100, 064 |
| 109 | CSS token cleanup audit | S | 100, 101, 102, 104 |
| 112 | End-to-end integration test suite | L | 100, 101, 103, 104, 106 |

## Parallel dispatch
ONE parallel group (6 agents). **112 is the rigorous E2E gate** — provider switching, cross-session recall, MCP connect, settings persistence, full regression. All terminal before Wave 15.

## Pre-wave protocol (MANDATORY)
Read LEARNINGS.md + FILE-CLAIMS.md. WAL `pre_run`. kencode-search before code.

## Post-wave protocol (MANDATORY)
WAL `post_run` → learnings → reviewer → advisor() → CodeRabbit (advisory) → commit → update OVERVIEW + TASKLOG.

## Execution notes
This wave proves the whole system end-to-end (112) and finishes memory/identity (065 cross-session test, 071 persona composition). Token cleanup (109) gates the final dmg.

## Gate
No gate — auto-proceed to Wave 15.
