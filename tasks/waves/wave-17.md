# Wave 17 - Post-MVP refinement - Research, proof, and contracts

**Band:** C (post-MVP refinement)
**Gate:** none
**Tasks:** 4

## Tasks
| ID | Title | Complexity | Depends on |
|----|-------|------------|------------|
| 120 | Production reference research for UI, Composio, MCP, and Mac access | S | - |
| 121 | UI baseline proof harness | S | - |
| 122 | Mac access trust contract | S | - |
| 123 | Settings information architecture contract | S | - |

## Parallel dispatch
All four tasks are independent and can run in parallel. Each task produces a contract or proof artifact that later waves must cite before implementation.

## Pre-wave protocol (MANDATORY)
Read `tasks/LEARNINGS.md`, `tasks/FILE-CLAIMS.md`, `CLAUDE.md`, and the task files. Run kencode-search before any code or contract-writing step that relies on external implementation references.

## Post-wave protocol (MANDATORY)
WAL `post_run` -> learnings -> reviewer -> advisor -> update `tasks/OVERVIEW.md` and `tasks/TASKLOG.md`.

## Execution notes
This wave is deliberately research/proof-heavy. Do not implement UI, Composio, MCP, or Mac access behavior here beyond the baseline harness if needed for proof.

## Gate
No human gate. Later implementation waves are blocked until the contracts and baseline artifacts exist.
