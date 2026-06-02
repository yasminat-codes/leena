# Wave 07 — Band B (post-gate) · Provider impls + subsystem interfaces + auth verify

**Band:** B (post-gate, functional)
**Gate:** none (runs only after wave-06 approval)
**Tasks:** 8

## Tasks
| ID | Title | Complexity | Depends on |
|----|-------|-----------|------------|
| 030 | R-1: Verify auth model for second accounts | S | — |
| 050 | OpenAI provider (primary voice + chat) | M | 002, 001, 000 |
| 051 | OpenRouter provider | M | 002, 001, 000 |
| 052 | Ollama provider (+ on-demand model download) | L | 002, 001, 000 |
| 060 | MemoryStore abstract interface | S | 000 |
| 080 | MCP client manager core (HTTP + stdio) | L | 000, 001 |
| 090 | WakeEngine abstract interface | S | 000 |
| 102 | Tasks screen: mock → real data | S | 015 |

## Parallel dispatch
All deps satisfied by Band A / infra → ONE parallel group (8 agents). The big root wave — opens providers, memory, MCP, and wake tracks at once. All terminal before Wave 08.

## Pre-wave protocol (MANDATORY)
Read LEARNINGS.md (apply all Phase-0 learnings) + FILE-CLAIMS.md. WAL `pre_run`. **kencode-search before code** — providers/MCP have well-known production patterns; reuse them.

## Post-wave protocol (MANDATORY)
WAL `post_run` → learnings → reviewer → advisor() → CodeRabbit (advisory) → commit vetted code → update OVERVIEW + TASKLOG.

## Execution notes
OpenAI provider is the primary path (subscription/OAuth; API key backup). Ollama provider includes `pullModel` for downloading any model on demand. 030 is a verification task — if OAuth can't be tested unattended, default to API-key primary and document.

## Gate
No gate — auto-proceed to Wave 08.
