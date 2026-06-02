# Wave 11 — Band B (post-gate) · IPC channels, persona, memory impl, onboarding, MCP tests

**Band:** B (post-gate)
**Gate:** none
**Tasks:** 12

## Tasks
| ID | Title | Complexity | Depends on |
|----|-------|-----------|------------|
| 034 | Auto-launch on macOS login | S | 032, 038 |
| 036 | Global hotkey to summon Leena | S | 032, 038 |
| 037 | First-run onboarding wizard | M | 031, 032, 035, 038 |
| 039 | Ship design system in packaged build | S | 033, 010 |
| 053 | Provider settings IPC (+ model pull/list/delete) | M | 002, 038 |
| 062 | SQLiteMemoryStore implementation | L | 060, 061, 002 |
| 070 | Persona engine core | M | 038 |
| 084 | MCP IPC channels for renderer | M | 080, 081 |
| 086 | Auto-connect MCP servers on launch | S | 080, 081, 035 |
| 087 | MCP comprehensive test suite | M | 080, 082, 083, 085 |
| 094 | Wake word IPC channels | M | 093, 038 |
| 110 | Resizable panel window with persistence | S | 038 |

## Parallel dispatch
Largest wave — ONE parallel group (12 agents). Heavy on independent IPC-channel + store work. If wake chain (093) blocked, 094 blocks → skip. All terminal before Wave 12.

## Pre-wave protocol (MANDATORY)
Read LEARNINGS.md + FILE-CLAIMS.md (12 agents — claim discipline critical, esp. `main.js`/`preload.js` shared by many IPC tasks → serialize those). WAL `pre_run`. kencode-search before code.

## Post-wave protocol (MANDATORY)
WAL `post_run` → learnings → reviewer → advisor() → CodeRabbit (advisory) → commit → update OVERVIEW + TASKLOG.

## Execution notes
Many IPC tasks touch `main.js` + `preload.js` — the file-claim protocol must serialize edits to those two files. First MCP test suite (087) runs here.

## Gate
No gate — auto-proceed to Wave 12.
