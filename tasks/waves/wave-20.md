# Wave 20 - Post-MVP refinement - Focused settings details, file policy, and live chat wiring

**Band:** C (post-MVP refinement)
**Gate:** none
**Tasks:** 5

## Tasks
| ID | Title | Complexity | Depends on |
|----|-------|------------|------------|
| 128 | Theme detail preservation | S | 125, 127 |
| 129 | Providers detail polish | M | 126, 127 |
| 130 | Updates detail flow | S | 126, 127 |
| 138 | File access scope policy | M | 122, 136 |
| 141 | Chat history and detail wiring | M | 140 |

## Parallel dispatch
Tasks are parallel if file claims do not collide. Serialize `src/renderer/screens/settings.js` and `src/renderer/leena.css` across 128, 129, and 130. Keep Chat memory/IPC safety review separate from visual work.

## Pre-wave protocol (MANDATORY)
Read Wave 17 contracts and Wave 18-19 handoffs. Run kencode-search before implementation references, especially for file access and update UI states.

## Post-wave protocol (MANDATORY)
Focused tests for each detail -> screenshot proof for Settings and Chat -> full `npm run check` -> reviewer -> advisor -> bookkeeping.

## Execution notes
Theme values are preservation-critical. Do not rename or remove existing theme/treatment/density options.

## Gate
No human gate.
