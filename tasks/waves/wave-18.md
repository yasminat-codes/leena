# Wave 18 - Post-MVP refinement - Shell, visual system, integration foundations, and voice preflight

**Band:** C (post-MVP refinement)
**Gate:** none
**Tasks:** 7

## Tasks
| ID | Title | Complexity | Depends on |
|----|-------|------------|------------|
| 124 | Sidebar Chat route | S | 123 |
| 125 | Visual token and orb polish | M | 121 |
| 126 | Settings component primitives | M | 123 |
| 131 | Integrations detail shell | M | 123, 126 |
| 133 | Composio secure credential storage | M | 120, 122 |
| 135 | Mac access integration cards | S | 122, 131 |
| 142 | Voice startup preflight | M | 122 |

## Dispatch order
Tasks are partially parallel after dependencies are satisfied; dependency order wins over conceptual grouping:
- Initial eligible set after Wave 17: `124`, `125`, `126`, `133`, and `142`, subject to file claims.
- Run `131` only after `126` is terminal.
- Run `135` only after `131` is terminal.

Shared files still require serialization:
- `src/renderer/leena.css` is shared by 125, 126, 131, 135, and 142. Run CSS integration in a parent pass or serialize those edits.
- `src/main.js` and `src/preload.js` are shared by 133 and 142. Keep main/preload integration serialized.
- `src/renderer/index.html` and `src/renderer/shell.js` are owned by 124 first.

## Pre-wave protocol (MANDATORY)
Read Wave 17 outputs first. Read `tasks/FILE-CLAIMS.md`; claim files before edits. Run kencode-search before touching implementation files.

## Post-wave protocol (MANDATORY)
Focused tests per task -> parent `npm run check` -> focused UI screenshot proof for visible surfaces -> reviewer -> advisor -> WAL/LEARNINGS/TASKLOG updates.

## Execution notes
This wave creates the visible and runtime foundations. Do not complete a task from worker self-report alone; inspect the diff and rerun tests.

## Gate
No human gate.
