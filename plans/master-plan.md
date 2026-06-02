# Lena — Master Plan

> Transform the cloned open-source Electron voice assistant **Brah** into **Lena**: a persistent, personalized, voice-first desktop AI agent that lives in the menubar, wakes to "Hey Lena" or a hotkey, remembers everything, acts across your apps via MCP/Composio, and can also be typed to.

- **Plan version**: v1
- **Created**: 2026-06-01
- **Mode**: Brownfield multi-phase build (existing Electron codebase, no prior plan)
- **Source app**: `Brah` (`com.unstablemind.brah`) — Electron 42, OpenAI Realtime API
- **Owner**: yseidu@zenifygroup.com

---

## 1. Goal

A single, named desktop companion ("Lena") that:
1. Runs as a **standalone background app** — no terminal, launches on login, lives in the menubar.
2. Is **summoned hands-free** by "Hey Lena" (wake word) or a global hotkey, not just by clicking.
3. **Remembers everything** about the user across sessions (episodic + semantic + procedural memory) and never forgets.
4. Has a **user-defined identity** (name, personality, tone, rules) plus switchable persona modes.
5. **Acts across the user's apps** (Gmail, Calendar, Slack, Notion, and any Composio/MCP app) by voice, behind a permission gate.
6. Can be **typed to** in an expandable chat panel, is **resizable**, and is **skinnable** (themes).

**Not a goal (v1):** mobile, web, multi-tenant cloud sync, team/collab features, marketplace.

## 2. Target user

**Primary — "the power owner" (the user, and a few invited people).**
- Technical-enough to install an unsigned/signed Mac app and complete an OAuth login and paste API keys during onboarding.
- Uses the assistant all day; wants it ambient and proactive, not click-to-summon.
- Cares about personalization and memory ("it should know me"); accepts an always-on local mic for the wake word.
- Cost-tolerant on OpenAI realtime minutes in exchange for responsiveness.

**Distribution**: shared with a small number of people (not public). Each user runs their own copy with their own credentials. → Requires code signing/notarization and a per-user key onboarding flow (no shipped secrets).

## 3. Stack

| Layer | Choice | Status |
|---|---|---|
| Shell | Electron 42 (`electron-builder` mac `dir` → migrate to signed `dmg`/`zip`) | existing |
| Language | JavaScript (ESM), Node built-ins | existing |
| Storage | `node:sqlite` (`brah.db` → `lena.db`) | existing |
| Realtime voice | OpenAI Realtime API `gpt-realtime-2`, WebRTC in renderer, ephemeral client secret from main | existing |
| Auth (realtime) | ChatGPT-account OAuth (`codex_cli_simplified_flow`) — **see Risk R-1**; fallback OpenAI API key | existing + at risk |
| OS control | Playwright (browser), `@nut-tree-fork/nut-js` (OS) | existing |
| Memory embeddings | `@huggingface/transformers` (`Xenova/all-MiniLM-L6-v2`, local, in-process) | new (Phase 2) |
| Memory engine | Swappable interface: **baseline** custom `node:sqlite`; **adapter** `mem0ai` (OSS, vector mode) | new (Phase 2) |
| Tool/integration bridge | `@modelcontextprotocol/sdk` ^1.29.0 + `@composio/core` ^0.10.0 | new (Phase 4) |
| Wake word | **openWakeWord** (Apache-2.0, WASM/onnxruntime-web in renderer) behind an engine-agnostic interface | new (Phase 5) |

See `decision-log.md` for why each was chosen, `risk-register.md` for what could break.

## 4. Core feature list (by phase)

1. **Foundation & Rename** — packaged standalone `.app`, launch-on-login, menubar tray (status + mute + open + quit), global hotkey summon, rename Brah→Lena everywhere, per-user key onboarding, code signing.
2. **Memory** — swappable memory interface; episodic (append-only) + semantic (consolidated facts) + procedural (preferences) tiers; local embedding + brute-force vector recall; extraction after conversations; injection into session instructions; Mem0 adapter validated.
3. **Identity** — settings UI to author Lena's name/personality/tone/rules in free text + switchable persona presets/modes; feeds `buildRealtimeInstructions`.
4. **MCP / Composio bridge** — generic MCP client (stdio + HTTP); Composio connected as a remote MCP server; dynamic tool discovery merged into the realtime tool set; per-app OAuth via Composio connect links; permission-gated.
5. **Wake word** — "Hey Lena" via openWakeWord behind a `WakeEngine` interface; two-stage gating (local detection → start paid realtime session); mute/pause control.
6. **UI / UX** — theme/skin system (CSS variables), resizable + size-persisted window, expandable text-chat panel sharing the tool/realtime backend, conversation history + search, proactive nudges.

## 5. Architecture (subsystems as isolated units)

| Subsystem | Owns | New/changed files |
|---|---|---|
| App shell | packaging, login-launch, tray, global hotkey, onboarding | `main.js`, new `src/tray.js`, `src/onboarding/` |
| Activation | `WakeEngine` interface + openWakeWord impl + hotkey → session trigger | new `src/wake/` |
| Identity | identity + persona injection | `src/realtime/prompts.js`, `agent-profile-store.js`, settings UI |
| Memory | `MemoryStore` interface + sqlite baseline + Mem0 adapter, extraction, retrieval, injection | new `src/realtime/memory/`, `database.js`, `prompts.js` |
| Integrations | MCP client manager + Composio + dynamic tool dispatch | new `src/realtime/tools/mcp-client.js`, `mcp-tools.js`; `tools/index.js`, `tool-schemas.js`, `tool-permissions.js` |
| UI | skins, resize, chat panel, history | `src/renderer/*`, `styles.css`, `panel.js`, `renderer.js` |

**Interface discipline (the two swap points that de-risk the project):**
- `WakeEngine` — `{ start(onDetect), stop(), pause(), resume() }`. openWakeWord today; Porcupine or OS speech later = new impl, no caller changes.
- `MemoryStore` — `{ remember(exchange), recall(query, k), consolidate() }`. sqlite baseline; Mem0 adapter; both satisfy the same contract.

## 6. Success criteria (definition of done — overall)

- Lena launches on login and runs with **no terminal**; quitting/relaunch works from the tray.
- Saying "Hey Lena" (or pressing the hotkey) starts a listening session from any app.
- After a conversation, a fact stated by the user is **recalled in a later, separate session**.
- The user can edit Lena's identity in settings and hear the change in her next reply.
- The user can connect Gmail via Composio and have Lena send an email by voice, with a permission prompt.
- The window can be resized, re-skinned, and opened as a text chat.
- A second invited user can install, onboard with their own keys, and use Lena without code changes.

Per-phase done criteria live in each `plans/phases/phase-N-*.md`.

## 7. Phase sequencing

```
Phase 1 Foundation+Rename ──┬─> Phase 2 Memory ──> Phase 3 Identity ──┐
                            ├─> Phase 4 MCP/Composio ─────────────────┤──> Phase 6 UI/UX
                            └─> Phase 5 Wake word ────────────────────┘
```
Phase 1 is the hard prerequisite (everything assumes a persistent background process + onboarding). Phases 2–5 are largely independent and could be reordered; recommended order optimizes user-visible value. Phase 6 polishes across all. See `build-sequence.md`.

## 8. Open questions (tracked, not assumed)

- **OQ-1 (R-1):** Does the ChatGPT-account OAuth realtime flow generalize to each shared user's own ChatGPT account, and is it within OpenAI ToS? Phase 1, Task 1 verifies; fallback = OpenAI API key path.
- **OQ-2:** openWakeWord custom "Hey Lena" accuracy in-renderer — acceptable false-accept rate? Validated in Phase 5 spike.
- **OQ-3:** Mem0 Node OSS local-mode maturity — adapter validated in Phase 2 against the sqlite baseline before committing.

## 9. self_annealing

See `self-annealing-contract.md` for the full table. Minimum signals tracked for this plan:

| Signal | What to watch | Where captured | What changes next plan |
|---|---|---|---|
| Plan executed without deviation | Phase estimate vs. reality | `plans/.wal/post-*.json` + confidence++ | Reuse this phase decomposition for desktop-agent builds |
| Scope crept during execution | Memory "types" expanding into 4 stores | WAL + `learnings.jsonl` | Re-affirm episodic+semantic v1 boundary earlier |
| Assumption wrong | R-1 auth flow doesn't generalize | WAL error + learnings | Default future "share" builds to API-key auth from the start |
| Dependency unproven | Mem0/openWakeWord behave worse than researched | learnings.jsonl, confidence-0.15 | Prototype centerpiece deps in a spike before planning around them |
