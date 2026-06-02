# Leena — Build Overview

**Project:** Leena (Electron desktop voice assistant, rebranded from Brah)
**Total tasks:** 72 · **Total waves:** 16 · **MVP boundary:** Phases 0–4
**Deliverable:** unsigned `.dmg` (MVP build = task 046, Final build = task 111) + `xattr -cr` install docs

## Progress

| State | Count |
|-------|-------|
| Pending | 66 |
| In-Progress | 2 |
| Completed | 4 |
| Blocked | 0 |

## Wave Map

| Wave | Band | Tasks | Theme | Gate |
|------|------|-------|-------|------|
| 01 | A | 2 | Foundations (errors + design CSS) | — |
| 02 | A | 4 | Utilities + provider skeleton + visual primitives | — |
| 03 | A | 1 | App shell | — |
| 04 | A | 6 | All screens + command center (mock) | — |
| 05 | A | 1 | Live theme switching | — |
| 06 | A | 1 | Phase 0 polish | **★ APPROVAL GATE ★** |
| 07 | B | 8 | Provider impls + interfaces + auth verify | — |
| 08 | B | 4 | Auth key, realtime wiring, wake spike, MCP schema | — |
| 09 | B | 4 | Command center live, MCP perms, wake engine, rename | — |
| 10 | B | 7 | Storage, settings, build target, tray, wake coordinator | — |
| 11 | B | 12 | IPC channels, persona, memory impl, onboarding, MCP tests | — |
| 12 | B | 8 | Test suites + model selector + identity/memory IPC + wake consent | — |
| 13 | B | 5 | Wire shell to real data + text chat + memory prompts | — |
| 14 | B | 6 | History, nudges, persona composition, E2E + memory tests | — |
| 15 | B | 2 | Final DMG + identity tests | — |
| 16 | B | 1 | MVP .dmg (guaranteed deliverable) | — |

## Phase → Wave Mapping

| Phase | Waves | Notes |
|-------|-------|-------|
| Phase 0 — Visual Shell | 1–6 | Band A; **approval gate at wave-06** |
| Phase 1 — Foundation & Rename | 7–12 | auth, rename, build, tray, hotkey, onboarding, settings |
| Phase 2 — Provider Layer | 7–12 | OpenAI (primary) / OpenRouter / Ollama (+ model download) |
| Phase 3 — Memory | 7–14 | episodic + semantic, embeddings, cross-session recall |
| Phase 4 — Identity | 11–15 | persona engine, prompt composition |
| Phase 5 — MCP | 7–12 | client (HTTP + stdio), permission gate, tools |
| Phase 6 — Wake Word | 7–12 | openWakeWord; decoupled from .dmg |
| Phase 7 — UI Wire + Distro | 13–16 | live data, text chat, history, both .dmg builds |

> Phases overlap across Band B waves because tasks are scheduled by dependency, not by phase. The topo-sort interleaves phases for maximum parallelism.

### ⚠️ Plan-doc → SPEC phase number mapping (numbering changed when the provider layer was inserted)

The `plans/phases/*.md` docs use the **original** 6-phase numbering. This SPEC inserted **Provider Layer as a new Phase 2**, shifting everything after it. Some task `context_files` still point at the original doc names — those files are correct in *content*; only the number in the filename differs. Use this table to translate:

| Plan doc (`plans/phases/`) | = SPEC phase | Subsystem |
|----------------------------|--------------|-----------|
| `phase-0-visual-shell.md` | Phase 0 | Visual shell |
| `phase-1-foundation.md` | Phase 1 | Foundation & rename |
| *(no doc — new this build)* | **Phase 2** | **Provider layer (OpenAI/OpenRouter/Ollama)** |
| `phase-2-memory.md` | Phase 3 | Memory |
| `phase-3-identity.md` | Phase 4 | Identity |
| `phase-4-mcp-composio.md` | Phase 5 | MCP |
| `phase-5-wake-word.md` | Phase 6 | Wake word |
| `phase-6-ui-ux.md` | Phase 7 | UI wire + distribution |

Executor agents: when a task's `context_files` names e.g. `phase-5-wake-word.md`, that is the **wake-word** spec (SPEC Phase 6) — read it for content, ignore the legacy number.

## Critical Path (to the deliverable)

```
000 → 002 → 050 → 055 → 105 → 106 ─┐
010 → 012 → 017 → 020 → 021 (GATE) ─┤
                                     ├→ 100/101/104 → 109 → 111 (Final .dmg)
032 → 038 → 062 → 063 → 064 ────────┘
021 + 040 + 056 + 065 + 073 + 033 + 039 → 046 (MVP .dmg — guaranteed)
```
Both `.dmg` tasks are verified **free of any wake-word (090-096) or MCP (080-087) dependency**, so the deliverable ships even if those optional phases block.

## The One Gate

**Wave-06 (task 021) — Phase 0 visual-shell approval.** After the shell is built, the runner stops, launches `npm start`, and waits for the owner to review the app against `design-system/Leena Design System.md` and approve. This is the **only** human gate in the entire build. Everything after runs autonomously to the .dmg.

## Deliverables

| Artifact | Task | Gated on | Signing |
|----------|------|----------|---------|
| `dist/Leena-MVP.dmg` | 046 | Phases 0–4 only (guaranteed) | Unsigned + `xattr -cr` |
| `dist/Leena-*.dmg` (final) | 111 | Full feature set | Unsigned + `xattr -cr` |

Both recorded with path + SHA-256 in `tasks/DELIVERABLE.md` on completion.

## Blockers

None.

## Completed Waves

- Wave 01 — Foundations begin (`000`, `010`) completed 2026-06-02.

## Discovered Tasks

_(none yet — added here as they surface mid-build, per Discovered-Tasks protocol)_

## Governance (enforced by `/run-leena-wave`)

- **LEARNINGS.md** — read before each wave, appended after each fix + wave.
- **WAL-PROTOCOL.md** — pre_run / checkpoint / post_run per task.
- **FILE-CLAIMS.md** — concurrency guard; claimed files / in-progress tasks are off-limits.
- kencode-search before any code · reviewer + advisor() per wave · CodeRabbit advisory-only · no AskUserQuestion · complete the whole wave · 10× unblock then skip · never idle.
