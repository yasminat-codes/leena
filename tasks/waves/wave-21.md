# Wave 21 - Post-MVP refinement - Permission UX and UI regression proof

**Band:** C (post-MVP refinement)
**Gate:** none
**Tasks:** 2

## Tasks
| ID | Title | Complexity | Depends on |
|----|-------|------------|------------|
| 139 | Permission confirmation UX | M | 122, 136, 137, 138 |
| 144 | UI screenshot regression suite | M | 125, 127, 128, 129, 130, 131, 132, 140, 141, 142, 143 |

## Parallel dispatch
Run 139 first if its UI states are needed by 144 screenshots. Otherwise, both can proceed with coordination. Screenshot artifacts from 144 are release proof for all visible surfaces.

## Pre-wave protocol (MANDATORY)
Read all completed UI and integration handoffs. Confirm no active file claims. Run kencode-search only for missing proof gaps.

## Post-wave protocol (MANDATORY)
Focused tests -> screenshot suite -> parent `npm run check` -> reviewer -> advisor -> WAL/LEARNINGS/TASKLOG.

## Execution notes
Permission UX is security-sensitive. Unknown tool metadata must render as blocked, not low risk.

## Gate
No human gate.
