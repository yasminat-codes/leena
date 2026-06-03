# Wave 19 - Post-MVP refinement - Settings router, MCP polish, Composio refresh, Mac adapters, and chat shell

**Band:** C (post-MVP refinement)
**Gate:** none
**Tasks:** 7

## Tasks
| ID | Title | Complexity | Depends on |
|----|-------|------------|------------|
| 127 | Settings overview detail router | M | 126 |
| 132 | Custom MCP form polish | S | 131 |
| 134 | Composio MCP tool refresh | M | 133 |
| 136 | Full Disk Access status | M | 135 |
| 137 | Apple Calendar adapter | M | 122, 135 |
| 140 | Chat workspace shell | M | 124 |
| 143 | Theme-aware voice orb | S | 125, 142 |

## Parallel dispatch
Most tasks are parallel after Wave 18, but serialize shared renderer/CSS work:
- `src/renderer/leena.css` is shared by 127, 132, 140, and 143.
- `src/main.js` / `src/preload.js` integration for 134 and 136 should be parent-owned.
- Tool permission/schema changes for 134, 137, and 143 must be reviewed together for safety.

## Pre-wave protocol (MANDATORY)
Read the relevant completed Wave 18 task handoff notes and dependency outputs. Run kencode-search for any external API or UI pattern not already proven by task 120.

## Post-wave protocol (MANDATORY)
Run focused tests, then parent gates: `npm run check`, relevant focused `node --test`, screenshot refresh where visible UI changed, reviewer, advisor, WAL, LEARNINGS, TASKLOG.

## Execution notes
Apple Calendar implementation must not mutate a real owner calendar in automated tests. Use adapter mocks.

## Gate
No human gate.
