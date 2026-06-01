# Wave 16 — Band B (post-gate) · MVP .dmg (guaranteed deliverable)

**Band:** B (post-gate)
**Gate:** none
**Tasks:** 1

## Tasks
| ID | Title | Complexity | Depends on |
|----|-------|-----------|------------|
| 046 | MVP .dmg build (guaranteed deliverable) | M | 021, 040, 056, 065, 073, 033, 039 |

## Parallel dispatch
Single task (one agent). Produces `dist/Leena-MVP.dmg` — the guaranteed downloadable artifact. Its deps are **MVP-only (Phases 0-4 + build infra)** and verified **free of wake/MCP**, so it builds even if every optional-phase task blocked.

## Pre-wave protocol (MANDATORY)
Read LEARNINGS.md + FILE-CLAIMS.md. WAL `pre_run`. kencode-search before code.

## Post-wave protocol (MANDATORY)
WAL `post_run` → learnings → reviewer → advisor() → CodeRabbit (advisory) → commit → update OVERVIEW + TASKLOG.

## Execution notes
The safety-net deliverable. **Final deliverable checkpoint:** confirm `dist/Leena-MVP.dmg` exists, app launches after `xattr -cr`, record path + SHA-256 to `tasks/DELIVERABLE.md`. Build complete.

## Gate
No gate — build complete after this wave.
