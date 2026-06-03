# Wave 22 - Post-MVP refinement - Integration test matrix

**Band:** C (post-MVP refinement)
**Gate:** none
**Tasks:** 1

## Tasks
| ID | Title | Complexity | Depends on |
|----|-------|------------|------------|
| 145 | Integration test matrix | M | 132, 134, 136, 137, 138, 139 |

## Parallel dispatch
Single task. It is a release gate for Composio, MCP, Full Disk Access, Apple Calendar, file access, and permission confirmation behavior.

## Pre-wave protocol (MANDATORY)
Read all integration handoffs and task 122 trust contract. Do not use real Composio credentials or mutate real Apple Calendar resources in automated tests.

## Post-wave protocol (MANDATORY)
Run `node --test`, `npm run check`, `git diff --check`, reviewer, advisor, WAL/LEARNINGS/TASKLOG.

## Execution notes
The matrix must explicitly cover unknown and denied permission states.

## Gate
No human gate.
