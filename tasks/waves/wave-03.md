# Wave 03 — Band A (pre-gate) · App shell

**Band:** A (pre-gate)
**Gate:** none
**Tasks:** 1

## Tasks
| ID | Title | Complexity | Depends on |
|----|-------|-----------|------------|
| 012 | App shell — window chrome, sidebar nav, top bar | M | 010, 011 |

## Parallel dispatch
Single task (one agent). The shell is the frame every screen mounts into, so it gates Wave 04.

## Pre-wave protocol (MANDATORY)
Read LEARNINGS.md + FILE-CLAIMS.md. WAL `pre_run`. kencode-search before code.

## Post-wave protocol (MANDATORY)
WAL `post_run` → learnings → reviewer → advisor() → CodeRabbit (advisory) → commit → update OVERVIEW + TASKLOG.

## Execution notes
Builds the persistent chrome (sidebar + top bar) on the design tokens + fonts. All screens in Wave 04 render inside it.

## Gate
No gate — auto-proceed to Wave 04.
