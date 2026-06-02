# Leena — Task Architect Specification

## project_config

```yaml
project_name: Leena
project_slug: leena
task_root: tasks/
target_dir: /Users/yasmineseidu/leena
tech_stack:
  - Electron 36+
  - Node.js 22+ (node:sqlite)
  - OpenAI Realtime API
  - OpenRouter API
  - Ollama (local models)
  - Playwright (browser automation)
  - "@nut-tree-fork/nut-js" (OS automation)
  - onnxruntime-web (wake word)
  - MCP SDK (@modelcontextprotocol/sdk)
  - electron-builder (packaging)
test_runner: "node --test"
lint_command: "npm run check"
build_command: "npm run build:mac"
dev_command: "npm start"
```

## 1. Project Overview

Leena is an Electron desktop voice assistant (rebranded from "Brah") that uses AI models to listen, view the screen, control the computer, and manage a local planner — all in realtime.

**New in this build:**
- **Universal Provider Layer**: Abstract all model calls (chat, embeddings, voice/realtime) behind a pluggable provider interface supporting OpenAI, OpenRouter, and Ollama
- **Ollama Support**: Full offline capability — local chat, embeddings, and voice (STT/TTS)
- **OpenRouter Integration**: Access to 200+ models as alternative provider
- **MCP Client**: Connect to external MCP servers via streamable HTTP and stdio transports
- **Visual Shell First**: UI-first approach — build and approve the look before any backend wiring

## 2. Architecture

### Subsystems (isolated units)
1. **ProviderLayer** — model abstraction (OpenAI, OpenRouter, Ollama) for chat/embeddings/realtime/TTS/STT
2. **RealtimeEngine** — voice sessions via OpenAI Realtime API (or provider layer)
3. **MemoryStore** — episodic + semantic memory with local SQLite + embeddings
4. **IdentityEngine** — persona, tone, instruction composition
5. **MCPBridge** — MCP client connecting to external servers (streamable HTTP + stdio)
6. **WakeEngine** — "Hey Leena" detection via openWakeWord WASM
7. **ComputerUse** — browser (Playwright) + OS (@nut-tree-fork) automation
8. **Planner** — task/calendar management (existing, enhanced)
9. **Shell** — Electron UI: design system, app shell, command center, all screens

### Provider Layer Design (NEW)
```
src/providers/
  index.js            — ProviderRegistry: register/get/list providers
  base-provider.js    — BaseProvider abstract class
  openai-provider.js  — OpenAI: chat, embeddings, realtime, TTS, STT
  openrouter-provider.js — OpenRouter: chat, embeddings (via compatible models)
  ollama-provider.js  — Ollama: chat, embeddings, TTS (via compatible models), STT
  types.js            — TypeDefs: ChatMessage, EmbeddingRequest, ProviderCapabilities
```

Each provider declares capabilities:
```js
{
  chat: true,
  embeddings: true,
  realtime: false,  // only OpenAI for now
  tts: true,
  stt: true,
  models: ['gpt-4o', 'gpt-4o-mini', ...]
}
```

Settings UI lets user pick default provider + model per capability.

### Provider Primacy (owner directive)
- **OpenAI subscription (ChatGPT OAuth) is PRIMARY for voice + chat.** The OpenAI **API key is the backup** (used when OAuth unavailable/restricted, per R-1).
- **OpenRouter** and **Ollama** are additional user-selectable providers.
- **Ollama models download on demand:** the user pulls ANY model from the Ollama registry by name, picks it from the dropdown, uses it immediately. Embedding model downloads independently of chat models. (Tasks 052/053/054.)

### Build Mandates (owner directive — enforced by run commands)
- **kencode-search MCP before any code** — production-ready code, full file context, every relevant symbol pinpointed. No reinventing.
- **Never over-engineer** — simplest solution that fully works; never compromise correctness.
- **Never break current functionality** — full regression suite green before + after every task.
- **Rigorous E2E testing** — no implementation advances without passing tests.
- **Agents deployed per wave** (mandatory) with **reviewer** + **advisor()** gates per wave.
- **CodeRabbit mandatory but never a blocker** — advisory; findings → LEARNINGS.md.
- **WAL + LEARNINGS + bookkeeping compulsory** — pending→in-progress→completed moved immediately per task and per wave; fixes documented on success; each wave reads prior learnings.
- **File-claim protocol** — claim before edit; a claimed file (or a task in in-progress/) is off-limits; never idle.
- **No AskUserQuestion, no production-DB confirmation** — only stop is the wave-06 Phase-0 gate.
- **Complete the whole wave** — every task reaches terminal state; 10× unblock then skip to next eligible task; no excuses for no work.

## 3. Phases (Build Sequence)

### Phase 0 — Visual Shell (APPROVAL GATE)
Build complete look-and-feel as runnable Electron prototype. Mock data, no backend. Owner reviews and approves before functional work starts. This is the ONLY human gate in the entire build.

### Phase 1 — Foundation & Rename
Brah → Leena rename, standalone DMG build, launch-on-login, menubar tray, global hotkey, onboarding flow, design system packaging. Auth verification (R-1).

### Phase 2 — Provider Abstraction Layer (NEW)
Universal provider interface. OpenAI provider (wraps existing code). OpenRouter provider. Ollama provider. Settings UI for provider/model selection per capability.

### Phase 3 — Memory
MemoryStore interface, episodic + semantic tables, embeddings (via provider layer — local or cloud), cross-session recall, memory-aware prompts.

### Phase 4 — Identity
Persona engine, tone/instruction composition, persona switching, identity-aware prompts.

### Phase 5 — MCP Integration
MCP client supporting streamable HTTP + stdio transports. Server management UI (add/remove/enable). Tool schema conversion to OpenAI function format. Permission gating (ADR-6).

### Phase 6 — Wake Word
openWakeWord WASM, "Hey Leena" custom model, WakeEngine interface, two-stage gating, consent/mute controls.

### Phase 7 — UI/UX Wire Live + Distribution
Wire Phase 0 shell to real data. Text chat. Conversation history. Proactive nudges. Final DMG build with Gatekeeper bypass docs.

**MVP Boundary**: Phase 0 + 1 + 2 + 3 + 4 = standalone, provider-flexible, memory-enabled agent wearing the approved shell.

## 4. Success Criteria

1. `npm start` opens Leena with approved design system shell
2. Voice conversations work via OpenAI Realtime API
3. Text chat works via any configured provider (OpenAI/OpenRouter/Ollama)
4. Memory persists across sessions — fact from session 1 recalled in session 2
5. MCP servers connectable via settings UI (streamable HTTP + stdio)
6. "Hey Leena" wake word triggers session start
7. `npm run build:mac` produces installable .dmg
8. All tests pass (`npm test`), zero Biome errors
9. Provider switching works without restart for text chat
10. Ollama works fully offline (chat + embeddings)

## 5. Quality Gates

```yaml
per_task:
  - "npm run check" passes (zero Biome errors)
  - "node --test" passes (zero failures)
  - LSP diagnostics: zero errors on changed files
per_phase:
  - All task gates pass
  - Phase-specific manual QA checklist passes
  - All phase exit criteria met
per_wave:
  - All tasks in wave completed or blocked
  - No regressions in existing tests
```

## 6. Risks

| ID | Risk | Impact | Mitigation |
|----|------|--------|------------|
| R-1 | OAuth may not generalize to other users | Auth blocked | API-key fallback path (implement regardless) |
| R-2 | Mem0 adapter worse than custom SQLite | Memory quality | MemoryStore interface; start with custom impl |
| R-3 | openWakeWord accuracy insufficient | Wake unusable | Spike first; WakeEngine interface allows swap |
| R-5 | MCP tool injection | Security | Default-deny permission model (ADR-6) |
| R-7 | No Developer ID cert | Can't notarize | Unsigned + xattr bypass docs |
| R-12 | Ollama not installed on user machine | Offline broken | Graceful fallback; clear error in settings |
| R-13 | OpenRouter API changes | Provider broken | Abstract behind interface; version-pin SDK |

## 7. Environment & Secrets

### Required env vars (.env)
```
# OpenAI (primary provider)
OPENAI_API_KEY=           # user provides during onboarding or .env

# OpenRouter (optional provider)
OPENROUTER_API_KEY=       # user provides in settings

# Ollama (local — no key needed, just URL)
OLLAMA_BASE_URL=http://localhost:11434

# Build
CSC_LINK=                 # Apple cert (optional — unsigned OK)
CSC_KEY_PASSWORD=         # Apple cert password (optional)
APPLE_ID=                 # For notarization (optional)
APPLE_ID_PASSWORD=        # App-specific password (optional)
APPLE_TEAM_ID=            # Team ID (optional)

# GitHub (for auto-update feed)
GH_TOKEN=                 # GitHub token for electron-builder publish
```

### No human gates
All tasks execute autonomously. The ONLY pause point is Phase 0 visual shell review.

## 8. Testing Strategy

- **Unit tests**: Every new module gets tests in `test/`
- **Integration tests**: Cross-session memory, MCP server connect/disconnect, provider switching
- **Existing pattern**: `node --test`, `withTempDir` + `closeDatabase` helpers
- **Coverage targets**: All public methods on MemoryStore, MCP schema conversion, provider interface, WakeEngine
- **Quality gates**: Biome clean, tests pass, LSP clean — enforced per task

## Build Execution Mandates (owner directives — non-negotiable)

These govern HOW every task and wave is executed. Enforced in `/run-leena-task` and `/run-leena-wave`.

1. **kencode-search MCP before any code.** Every coding task queries `kencode-search` first for production-ready implementations and to pull FULL context of every file it will touch. No reinventing existing patterns. Added via `claude mcp add kencode-search -- npx -y @kenkaiiii/kencode-search`.
2. **No over-engineering.** Simplest solution that fully works. Complexity only when required. Never compromise correctness.
3. **Don't break current functionality.** Full `node --test` regression suite stays green.
4. **Rigorous E2E testing.** No implementation advances without tests. Test, test, test.
5. **Agent deployment is mandatory per wave.** Waves are executed by a dispatched team of agents (one per task, parallel), not inline. With advisor gates.
6. **Reviewer + advisor gates per wave.** `reviewer` agent reviews wave changes, then `advisor()` gates before proceeding.
7. **CodeRabbit mandatory but NEVER a blocker.** PR + CodeRabbit review every wave; findings logged to LEARNINGS.md; never blocks merge/progress.
8. **Commit only truly vetted code to production.** Merge after automated gates + reviewer + advisor clear.
9. **Bookkeeping compulsory.** Tasks AND waves move pending → in-progress → completed/blocked the instant state changes (frontmatter + folder + OVERVIEW atomically).
10. **WAL protocol.** WAL pre_run before first step, post_run at terminal state. When a fix works: stop → document in LEARNINGS.md → continue. Document again at iteration end. (`tasks/WAL-PROTOCOL.md`)
11. **Robust learning docs.** `tasks/LEARNINGS.md` read before every wave; appended after every fix. Each wave draws on all prior learnings — no repeated mistakes.
12. **File-claim concurrency guard.** `tasks/FILE-CLAIMS.md` — claim files before editing; claimed files / in-progress tasks are off-limits; pick the next unblocked task instead. No idle while unclaimed work remains.
13. **No AskUserQuestion. No production-DB confirmation.** Fully autonomous except the single Wave-6 visual-shell approval gate.
14. **No excuses for idle.** 10 unblock attempts → blocked → skip to next eligible task (this wave or pull-ahead). Work never stops on one blocker.

### Provider primacy (owner directive)
- **OpenAI subscription (OAuth) is the PRIMARY voice + chat path.** The OpenAI API key is the **backup** only.
- **OpenRouter** = additional selectable provider (universal layer).
- **Ollama** = local provider; user can **download ANY new model on demand** (chat or embedding, independently) and select it from the dropdown. Embedding model downloads independently of chat.

## Resilience Baseline

| Check | Status | Notes |
|-------|--------|-------|
| Error tracking | PARTIAL | Diagnostics log exists; no structured error capture |
| Retry/backoff | MISSING | No retry on API failures |
| AI model fallback | MISSING | No fallback chain (new provider layer will address) |
| Telemetry | PARTIAL | Activity log exists; no perf metrics |
| Learning store | N/A | task-architect internal |

Infrastructure tasks (000-series) will address MISSING items before feature tasks begin.
