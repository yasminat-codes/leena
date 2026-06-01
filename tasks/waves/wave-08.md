# Wave 08 — Band B (post-gate) · Auth key, realtime wiring, wake spike, MCP schema

**Band:** B (post-gate)
**Gate:** none
**Tasks:** 4

## Tasks
| ID | Title | Complexity | Depends on |
|----|-------|-----------|------------|
| 031 | API key authentication path (backup to OAuth) | M | 030 |
| 055 | Wire realtime engine to provider layer | M | 050, 002 |
| 082 | Convert MCP tool schemas → OpenAI function format | M | 080 |
| 091 | openWakeWord accuracy spike (R-3) | L | 090 |

## Parallel dispatch
ONE parallel group (4 agents). **Note 091** is the wake-word Colab training spike — the one task that may not self-complete unattended. If it blocks after 10 attempts → `blocked/`, build continues; wake is decoupled from the .dmg. All terminal before Wave 09.

## Pre-wave protocol (MANDATORY)
Read LEARNINGS.md + FILE-CLAIMS.md. WAL `pre_run`. kencode-search before code.

## Post-wave protocol (MANDATORY)
WAL `post_run` → learnings → reviewer → advisor() → CodeRabbit (advisory) → commit → update OVERVIEW + TASKLOG.

## Execution notes
Realtime engine refactored to source credentials from the provider layer (keeps existing voice flow working — regression-guard). MCP schema converter unlocks tool merging.

## Gate
No gate — auto-proceed to Wave 09.
