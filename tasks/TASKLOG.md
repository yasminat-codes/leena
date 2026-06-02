# Leena — Task Log (append-only)

## 2026-06-01 — Project initialized

- Decomposed the Leena revamp plan into **72 atomic tasks across 16 waves**, split into two bands with a single approval gate.
- **Band A (waves 1–6)** = Phase 0 visual shell; **wave-06 = the only human gate** (owner reviews `npm start` before functional work).
- **Band B (waves 7–16)** = functional phases 1–7, fully autonomous.
- **Provider abstraction** added (new vs. original plan): OpenAI **subscription primary / API key backup** for voice + chat; OpenRouter + Ollama as selectable providers; **Ollama models downloadable on demand** (any model from dropdown; embedding model independent) — tasks 052/053/054.
- **MCP client** (streamable HTTP + stdio) — Phase 5.
- **Two `.dmg` builds:** MVP (046, guaranteed) + Final (111). Both verified **decoupled from wake (090-096) and MCP (080-087)** so the deliverable always ships.
- **Advisor gate (Phase 3.5) fixes applied:** decoupled `.dmg` critical path from the wake-word Colab spike; settings screen (104) degrades gracefully instead of hard-depending on wake/MCP; `.env` preserved (wrote `.env.example`, not a clobber); `SETUP-UNBLOCK.md` written.
- **Build mandates wired into `/run-leena-wave` + `/run-leena-task`:** kencode-search before any code (production-ready, full file context); no over-engineering; never break current functionality; rigorous E2E testing; agents deployed per wave; reviewer + advisor() gates per wave; CodeRabbit mandatory but advisory-only (never blocks); WAL + LEARNINGS + bookkeeping compulsory; file-claim concurrency protocol; no AskUserQuestion / no prod-DB confirmation; complete the whole wave; 10× unblock then skip; never idle.
- Governance files created: `LEARNINGS.md`, `WAL-PROTOCOL.md`, `FILE-CLAIMS.md`, `SPEC.md`, `OVERVIEW.md`.
- kencode-search MCP installed and connected (`claude mcp add kencode-search`).

---
_(wave execution entries appended below as the build runs)_

## 2026-06-01 — Wave 01 completed

- Dispatched two Wave 01 workers in parallel: `000` error handling infrastructure and `010` Leena design foundation CSS.
- Verified task `000` outputs: `src/utils/errors.js`, `src/main.js`, `src/preload.js`, `test/errors.test.js`.
- Verified task `010` outputs: `src/renderer/leena.css`, `src/renderer/index.html`, `test/leena-css-tokens.test.js`.
- Added a narrow Biome gate exclusion for generated/reference artifacts: `design-system`, `plans/.wal`, `tasks/.wal`.
- Reviewer found one blocker: raw renderer `leena:error` payloads could include stacks/custom fields. Re-dispatched task `000` owner; fixed with renderer-safe serializer options/redaction.
- Focused reviewer found one more blocker: embedded callback URLs in longer strings were not redacted. Re-dispatched task `000` owner; fixed URL-substring scrubbing and regression coverage.
- Final reviewer found the diagnostics path still used a separate sanitizer. Re-dispatched task `000` owner; fixed diagnostics to reuse the shared redaction helper.
- Independent gates passed in the parent checkout after the fix: `npm run check`, `node --test` (127 tests), and `node --check` for changed JS files.

## 2026-06-02 — Wave 02 started

- Cut clean branch/worktree `wave-02` from `origin/main` after PR #1 (`Wave 01 foundations`) merged.
- Moved tasks `001`, `002`, `011`, and `019` to `in-progress` with attempt 1 and pre-run WAL entries.
- Detected a mandatory file-claim conflict: tasks `011` and `019` both may need `src/renderer/leena.css`. Per `FILE-CLAIMS.md`, dispatching all four agents, with `019` limited to component/test files until `011` releases the stylesheet.
- Completed task `001`: retry utility and tests. Independent verification caught and fixed the non-retryable 401 error shape before completion.
- Completed task `002`: provider capability constants, base provider, registry, SQLite-backed provider settings, and tests.
- Completed task `011`: bundled local brand fonts, removed Google Fonts, tightened CSP, and added font bundle tests.
- Completed task `019`: standalone orb and waveform DOM factories plus tests, reusing the existing Leena CSS primitives.
- Reviewer found two blockers: legacy `styles.css` still referenced removed Google font families, and provider API-key helpers persisted raw secrets in SQLite. Reopened tasks `011` and `002` for focused fixes.
- Fixed the task `002` reviewer blocker by requiring protected provider API-key payloads and adding SQLite raw-secret regression coverage.
- Fixed the task `011` reviewer blocker by replacing legacy `Inter`/`Geist` CSS references with bundled Leena font tokens and adding a runtime CSS scan.
- CodeRabbit advisory review was requested on PR #1. At merge decision time it had posted only the generated "review in progress" comment with no actionable findings; advisory status did not block the wave.
