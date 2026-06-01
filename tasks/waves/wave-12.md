# Wave 12 — Band B (post-gate) · Test suites + model selector + identity/memory IPC + wake consent

**Band:** B (post-gate)
**Gate:** none
**Tasks:** 8

## Tasks
| ID | Title | Complexity | Depends on |
|----|-------|-----------|------------|
| 040 | Phase 1 comprehensive test suite | M | 031, 032, 036, 038 |
| 054 | Provider model selector UI (+ download new model) | M | 053, 050, 051, 052 |
| 056 | Provider layer comprehensive test suite | M | 050, 051, 052, 053 |
| 063 | Memory IPC channels | M | 062 |
| 072 | Identity IPC channels | S | 070 |
| 095 | Wake word consent + tray integration | M | 093, 094, 035, 037 |
| 096 | Wake word comprehensive test suite | M | 092, 093, 094 |
| 103 | Integrations screen: mock → real data | M | 016, 084 |

## Parallel dispatch
ONE parallel group (8 agents). Test-suite heavy — the MVP quality gates (040 phase-1, 056 providers) land here. Wake tasks (095/096) skip if wake chain blocked. All terminal before Wave 13.

## Pre-wave protocol (MANDATORY)
Read LEARNINGS.md + FILE-CLAIMS.md. WAL `pre_run`. kencode-search before code.

## Post-wave protocol (MANDATORY)
WAL `post_run` → learnings → reviewer → advisor() → CodeRabbit (advisory) → commit → update OVERVIEW + TASKLOG.

## Execution notes
054 adds the "download any Ollama model" affordance (typed name + live progress bar) and independent embedding-model download. 040 + 056 are MVP-gating test suites.

## Gate
No gate — auto-proceed to Wave 13.
