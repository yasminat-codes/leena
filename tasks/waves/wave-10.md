# Wave 10 — Band B (post-gate) · Storage, settings, build target, tray, wake coordinator

**Band:** B (post-gate)
**Gate:** none
**Tasks:** 7

## Tasks
| ID | Title | Complexity | Depends on |
|----|-------|-----------|------------|
| 033 | Switch build dir → dmg + zip (unsigned) | S | 032 |
| 035 | System tray / menubar icon | M | 032 |
| 038 | Persistent settings store | M | 032 |
| 061 | Episodic + semantic SQLite tables | M | 060, 032 |
| 081 | MCP server configuration storage | S | 032 |
| 085 | Wire MCP tools into realtime tool dispatch | M | 080, 082, 083 |
| 093 | Wake coordinator (debounce, cooldown, dispatch) | M | 092 |

## Parallel dispatch
ONE parallel group (7 agents). All unblocked by the rename + earlier waves. If 092 blocked, 093 blocks → skip. All terminal before Wave 11.

## Pre-wave protocol (MANDATORY)
Read LEARNINGS.md + FILE-CLAIMS.md. WAL `pre_run`. kencode-search before code.

## Post-wave protocol (MANDATORY)
WAL `post_run` → learnings → reviewer → advisor() → CodeRabbit (advisory) → commit → update OVERVIEW + TASKLOG.

## Execution notes
Foundational stores land here (settings, memory tables, MCP server store) plus the dmg build target — the machinery the deliverable depends on.

## Gate
No gate — auto-proceed to Wave 11.
