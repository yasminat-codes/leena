# Leena — Build Overview

**Project:** Leena (Electron desktop voice assistant, rebranded from Brah)
**Total tasks:** 99 · **Total waves:** 23 · **MVP boundary:** Phases 0–4 · **Post-MVP refinement:** Waves 17–23
**Deliverable:** unsigned `.dmg` (MVP build = task 046, Final build = task 111) + `xattr -cr` install docs

## Progress

| State | Count |
|-------|-------|
| Pending | 23 |
| In-Progress | 0 |
| Completed | 70 |
| Blocked | 6 |

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
| 17 | C | 4 | Research, proof, and contracts | — |
| 18 | C | 7 | Shell, visual system, integration foundations, voice preflight | — |
| 19 | C | 7 | Settings router, MCP polish, Composio refresh, Mac adapters, chat shell | — |
| 20 | C | 5 | Focused settings details, file policy, live chat wiring | — |
| 21 | C | 2 | Permission UX and UI regression proof | — |
| 22 | C | 1 | Integration test matrix | — |
| 23 | C | 1 | Build smoke and owner handoff | owner manual GUI smoke remains manual |

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

- `091` — openWakeWord accuracy spike blocked: no trained `hey-lena.onnx`, no one-hour ambient corpus, and no 50-utterance positive corpus. Task 092 must wait for measured wake results or use the documented Porcupine/hotkey-only fallback.
- `092` — openWakeWord engine implementation blocked by `091`: no trained model, selected threshold, real audio corpus, FA/hr, FR%, model size, or latency measurement exists. Hotkey-only and non-wake deliverable work remain unblocked.
- `093` — wake coordinator blocked by `092`: no openWakeWord engine/model/threshold/metrics exist, so coordinator implementation must wait for real wake assets or an explicit fallback decision.
- `094` — wake IPC channels blocked by `093`: no wake coordinator implementation exists, so IPC wiring must wait for real wake assets/metrics or an explicit fallback decision.
- `095` — wake consent/tray controls blocked by `093`/`094`: no wake coordinator or IPC runtime exists, so consent controls must wait for real wake assets/metrics or an explicit fallback decision.
- `096` — wake test suite blocked by `092`/`093`/`094`: no wake engine, coordinator, or IPC path exists to test honestly.

## Completed Waves

- Wave 01 — Foundations begin (`000`, `010`) completed 2026-06-02.
- Wave 02 — Utilities, provider skeleton, fonts, orb/waveform primitives (`001`, `002`, `011`, `019`) completed 2026-06-02.
- Wave 03 — App shell scaffold (`012`) completed 2026-06-02.
- Wave 04 — Mock screens and command center (`013`, `014`, `015`, `016`, `017`, `018`) completed 2026-06-02.
- Wave 05 — Live theme switching (`020`) completed 2026-06-02.
- Wave 06 — Phase 0 integration test and polish (`021`) completed 2026-06-02; owner approval granted 2026-06-02 and Band B is underway.
- Wave 07 — Provider implementations, subsystem interfaces, auth verification, and Tasks live-data wiring (`030`, `050`, `051`, `052`, `060`, `080`, `090`, `102`) completed 2026-06-02.
- Wave 08 — Auth key, realtime provider integration, MCP schema conversion, and wake-word accuracy spike (`031`, `055`, `082`, `091`) terminal 2026-06-02: `031`, `055`, and `082` completed; `091` blocked pending real wake-word model/audio measurement.
- Wave 09 — Rename, MCP permission gate, live Command Center state, and openWakeWord engine (`032`, `083`, `092`, `105`) terminal 2026-06-02: `032`, `083`, and `105` completed; `092` blocked pending real wake-word model/audio measurement or fallback decision.
- Wave 10 — Storage, settings, build target, tray, MCP execution, and wake coordinator (`033`, `035`, `038`, `061`, `081`, `085`, `093`) terminal 2026-06-03: `033`, `035`, `038`, `061`, `081`, and `085` completed; `093` blocked pending task `092` wake engine assets/metrics or fallback decision.
- Wave 11 — IPC channels, persona, memory implementation, onboarding, MCP tests, and resizable panel (`034`, `036`, `037`, `039`, `053`, `062`, `070`, `084`, `086`, `087`, `094`, `110`) terminal 2026-06-03: all non-wake tasks completed; `094` blocked pending task `093` wake coordinator assets/metrics or fallback decision.
- Wave 12 — Test suites, provider model selector, memory/identity IPC, live integrations, and wake consent/test-suite follow-ons (`040`, `054`, `056`, `063`, `072`, `095`, `096`, `103`) terminal 2026-06-03: `040`, `054`, `056`, `063`, `072`, and `103` completed; `095` and `096` blocked pending real wake engine/coordinator/IPC assets or fallback decision.
- Wave 13 — Memory-aware prompts, live Home/Activity/Settings data, and text chat (`064`, `100`, `101`, `104`, `106`) completed 2026-06-03; reviewer/advisor fixes added safe/async text-chat tool handling, default-provider preservation, live cross-conversation Activity history, Launch on Login side effects, and an untrusted-memory prompt boundary.
- Wave 14 — History, nudges, persona composition, memory tests, CSS token cleanup, and final e2e tests (`065`, `071`, `107`, `108`, `109`, `112`) completed 2026-06-03; final reviewer/advisor gates passed with 525/525 tests.
- Wave 15 — Identity comprehensive tests and final full-feature DMG (`073`, `111`) completed 2026-06-03; final gates passed with 527/527 tests and `dist/Leena-0.1.0-arm64.dmg` recorded in `tasks/DELIVERABLE.md`.
- Wave 16 — MVP DMG guaranteed deliverable (`046`) completed 2026-06-03; final gates passed with 529/529 tests and `dist/Leena-MVP.dmg` recorded in `tasks/DELIVERABLE.md`.
- Wave 17 — Post-MVP research, UI baseline proof, Mac access trust contract, and Settings IA contract (`120`, `121`, `122`, `123`) completed 2026-06-03; final gates passed with 542/542 tests and baseline screenshots recorded in `tasks/artifacts/post-mvp-ui-baseline/`.

## Post-MVP Refinement Tasks

Created 2026-06-03 from owner review of the shipped app screenshots and approved IA decisions. Supplemental spec: `tasks/SPEC-POST-MVP-REFINEMENT.md`.

| ID | Wave | Title | State |
|----|------|-------|-------|
| 120 | 17 | Production reference research for UI, Composio, MCP, and Mac access | completed |
| 121 | 17 | UI baseline proof harness | completed |
| 122 | 17 | Mac access trust contract | completed |
| 123 | 17 | Settings information architecture contract | completed |
| 124 | 18 | Sidebar Chat route | pending |
| 125 | 18 | Visual token and orb polish | pending |
| 126 | 18 | Settings component primitives | pending |
| 127 | 19 | Settings overview detail router | pending |
| 128 | 20 | Theme detail preservation | pending |
| 129 | 20 | Providers detail polish | pending |
| 130 | 20 | Updates detail flow | pending |
| 131 | 18 | Integrations detail shell | pending |
| 132 | 19 | Custom MCP form polish | pending |
| 133 | 18 | Composio secure credential storage | pending |
| 134 | 19 | Composio MCP tool refresh | pending |
| 135 | 18 | Mac access integration cards | pending |
| 136 | 19 | Full Disk Access status | pending |
| 137 | 19 | Apple Calendar adapter | pending |
| 138 | 20 | File access scope policy | pending |
| 139 | 21 | Permission confirmation UX | pending |
| 140 | 19 | Chat workspace shell | pending |
| 141 | 20 | Chat history and detail wiring | pending |
| 142 | 18 | Voice startup preflight | pending |
| 143 | 19 | Theme-aware voice orb | pending |
| 144 | 21 | UI screenshot regression suite | pending |
| 145 | 22 | Integration test matrix | pending |
| 146 | 23 | Post-MVP build smoke handoff | pending |

## Discovered Tasks

_(none yet — added here as they surface mid-build, per Discovered-Tasks protocol)_

## Governance (enforced by `/run-leena-wave`)

- **LEARNINGS.md** — read before each wave, appended after each fix + wave.
- **WAL-PROTOCOL.md** — pre_run / checkpoint / post_run per task.
- **FILE-CLAIMS.md** — concurrency guard; claimed files / in-progress tasks are off-limits.
- kencode-search before any code · reviewer + advisor() per wave · CodeRabbit advisory-only · no AskUserQuestion · complete the whole wave · 10× unblock then skip · never idle.
