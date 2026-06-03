# Leena — File Claim Registry (concurrency guard)

**Purpose:** When multiple agents run a wave in parallel, two agents must never edit the same file at once. This registry is the lock table. It is append-and-update — agents claim files before editing and release them after.

## The protocol (MANDATORY for every agent in a parallel wave)

1. **Before editing any file**, an agent appends a claim row to `## Active Claims` with the file path, its task id, and a timestamp.
2. **Before claiming**, the agent checks `## Active Claims`. If a file it needs is already claimed by another task, the agent must **NOT** wait or touch it — it moves on to the next task in its wave whose files are all free, or to the next eligible pending task.
3. **A task whose file is in `tasks/in-progress/` is already being worked on — it is claimed.** Never start a task that is in `in-progress/`. Only pick from `pending/` (and only ones whose dependencies are all in `completed/`).
4. **After a task reaches a terminal state** (completed or blocked), the agent removes its claim rows from `## Active Claims` and notes the release in `## Claim History`.
5. **No idle.** If every file an agent could work on is claimed, it scans the next wave / pending folder for any unblocked, unclaimed task and works that. There is no valid state where an agent does nothing while unclaimed work remains.

## Conflict resolution
- Two tasks in the same wave that need the same file are a **decomposition smell** → the wave runner serializes them (run one, then the other) rather than parallelizing. Note it in `tasks/LEARNINGS.md`.
- A claim older than 30 min with no progress is considered stale → the wave runner may reclaim it (the original task likely crashed; re-queue it).

## Active Claims

| File | Claimed by (task) | Claimed at | Status |
|------|-------------------|------------|--------|

## Claim History

- 2026-06-03T21:08:47Z — Opened Wave 17 claims for tasks `120`, `121`, `122`, and `123`: reference brief, UI baseline proof harness/artifacts, Mac access trust contract, Settings IA contract, and owned task files.
- 2026-06-03T21:27:08Z — Released Wave 17 claims for tasks `120`, `121`, `122`, and `123` after reference brief, UI baseline screenshot harness/artifacts, Mac access trust contract, Settings IA contract, independent artifact/content checks, focused UI harness, `npm run check`, full `node --test` (542/542), WAL parse, privacy scan, and `git diff --check` passed.

- 2026-06-03T10:47:25Z — Released Wave 16 claims for task `046` after MVP DMG/ZIP build, named artifact copies, manifest update, `npm run check`, full `node --test` (529/529), build-smoke focused gates, `git diff --check`, DMG hdiutil verification, read-only mount checks, ZIP extraction checks, active task-count audit, and task-artifact privacy scan.
- 2026-06-03T10:18:35Z — Released Wave 15 claims for tasks `073` and `111` after parent verification passed identity focused gates, regenerated final DMG/ZIP build, DMG/ZIP structural checks, `npm run check`, full `node --test` (527/527), changed-file syntax check, `git diff --check`, WAL parse, and privacy/count audits.
- 2026-06-03T09:29:02Z — Released Wave 14 reviewer-fix-5 claims after generation-guarded persona session updates, refreshed realtime tools in active `session.update`, Biome assertion formatting, full `npm test` (525/525), changed-file syntax checks, `git diff --check`, WAL parse, checklist scan, privacy scan, and count audit passed.
- 2026-06-03T09:27:31Z — Released Wave 14 reviewer-fix-4 claims after identity/profile data-change invalidation, bounded memory recall, and stale Home refresh generation guards passed focused tests (41/41), full `npm test` (524/524), changed-file syntax checks, WAL parse, and `git diff --check`.
- 2026-06-03T08:31:59Z — Released Wave 14 claims for tasks `065`, `071`, `107`, `108`, `109`, and `112` after independent verification passed output checks, changed-file syntax checks, `npm run check`, full `node --test` (515/515), `npm test`, WAL parse, and `git diff --check`.
- 2026-06-03T07:36:10Z — Released Wave 13 WAL tail repair claims after appending the physical-tail terminal checkpoint and re-running focused hardening gates (45/45), `npm run check`, full `node --test` (488/488), WAL/count/claim/privacy audits, and `git diff --check`.
- 2026-06-03T07:18:49Z — Released Wave 13 reviewer-fix-2 claims: chat IPC history/tool hardening, audited chat-triggered tool execution, OpenRouter `[DONE]` tool-call flush, and bounded/escaped `memory:get-episodes`; focused gates and full `node --test` (487/487) passed.
- 2026-06-03T07:03:23Z — Released Wave 13 advisor-fix claims for task `106`: Command Center text chat now leaves provider/model unset until explicit user selection so `chat:send` honors the configured main-process chat default; focused text-chat gate passed.
- 2026-06-03T06:49:46Z — Released Wave 13 final reviewer-fix claims for task `106` and task `101`: awaited async MCP-merged chat tool definitions before low/read-risk filtering, added regression coverage, and corrected Activity task search wording from FTS5 to indexed SQLite `LIKE`.
- 2026-06-03T06:37:44Z — Released Wave 13 reviewer-blocker claims for tasks `064`, `101`, `104`, and `106`: chat tool risk limiting/follow-up turns, live `memory:get-episodes`, Launch on Login side effects, and untrusted memory prompt boundary; `npm run check` and `node --test` (481/481) passed.
- 2026-06-03T06:23:18Z — Released Wave 13 reviewer-fix claims for task `106`: `src/providers/openai-provider.js`, `src/providers/openrouter-provider.js`, `test/provider-openai.test.js`, and `test/provider-openrouter.test.js`; focused provider/text-chat gates passed after preserving streamed tool-call deltas.
- 2026-06-03T06:12:24Z — Released Wave 13 claims for tasks `064`, `100`, `101`, `104`, `106`, and serialized parent integration after full parent gates passed: `npm run check`, `node --test` (474/474), changed JS `node --check`, focused Wave 13 tests, and `git diff --check`.
- 2026-06-03T04:36:29Z — Released Wave 12 CodeRabbit advisory bookkeeping claims after recording PR #13 pending advisory status and confirming no repo `codex`/`codex-automation` labels exist.
- 2026-06-03T04:34:57Z — Released Wave 12 post-wave bookkeeping claims after recording reviewer/advisor gates, wave summary, and learnings; staging reconciliation remains a git-index step only.
- 2026-06-03T04:24:04Z — Released Wave 12 claims for tasks `040`, `054`, `056`, `063`, `072`, `103`, blocked tasks `095`/`096`, and serialized main/preload integration after full parent gates passed and terminal task moves completed.
- 2026-06-03T03:11:55Z — Released Wave 11 reviewer-fix-2 claims after wiring first-run onboarding runtime launch, preserving provider API keys when redacted placeholders are saved, updating terminal bookkeeping, and passing focused onboarding/provider gates.
- 2026-06-03T02:57:58Z — Released Wave 11 reviewer-fix claims after making MCP server removal tolerate stale disconnect cleanup, adding focused regression coverage, and passing focused MCP IPC tests plus `npm run check`.
- 2026-06-03T02:46:58Z — Released task `036` hotkey helper claims after adding the standalone global-hotkey controller, focused hotkey tests, changed JS syntax checks, `npm run check`, full `node --test`, `git diff --check`, and serialized `src/main.js`/`src/preload.js` integration handoff.
- 2026-06-03T02:39:15Z — Released task `110` resizable-panel helper claims after adding panel bounds persistence helpers, focused window-state tests, task handoff notes, changed JS syntax checks, full `npm run check`, and full `node --test`.
- 2026-06-03T02:28:34Z — Released task `084` MCP IPC handler claims after adding the standalone MCP handler module, focused IPC tests, 10s fail-closed test-connection timeout coverage, changed JS syntax checks, focused MCP suite, full `npm run check`, full `node --test`, and shared `src/main.js`/`src/preload.js` integration handoff.
- 2026-06-03T02:27:57Z — Released task `070` persona engine claims after adding persistent PersonaEngine CRUD, legacy AGENT_PERSONAS seeding/deprecation, focused persona tests, full `npm run check`, full `node --test`, changed JS syntax checks, and task 071/072 handoff notes.
- 2026-06-03T02:27:20Z — Released task `087` MCP test-suite claims after adding timeout/crash/malformed-response coverage, end-to-end MCP integration tests, task handoff notes, and passing focused MCP tests, `npm run check`, and full `node --test`.
- 2026-06-03T02:25:19Z — Released task `086` auto-connect claims after adding the standalone MCP auto-connect lifecycle helper, focused lifecycle tests, changed JS syntax checks, focused Biome, full `npm run check`, full `node --test`, and integration handoff.
- 2026-06-03T02:18:29Z — Released task `053` provider settings IPC claims after adding the standalone provider handler module, safeStorage codec coverage, focused provider IPC tests, full `npm run check`, full `node --test`, changed JS syntax checks, and integration handoff for shared `src/main.js`/`src/preload.js`.
- 2026-06-03T02:15:47Z — Released task `037` renderer onboarding claims after adding the standalone onboarding flow contract, focused unit tests, task handoff notes, green focused Biome/syntax checks, and full `node --test`; shared `src/main.js`/`src/preload.js` integration remains serialized.
- 2026-06-03T02:15:07Z — Released task `062` claims after SQLiteMemoryStore implementation, mock-provider memory tests, full `npm run check`, full `node --test`, focused memory tests, syntax checks, and diff whitespace validation passed.
- 2026-06-03T02:12:39Z — Released task `034` helper claims after adding the launch-on-login IPC/startup helper, focused tests, and passing `npm run check`, `node --test`, changed JS syntax checks, and `git diff --check`; shared `src/main.js`/`src/preload.js` integration remains serialized.
- 2026-06-03T01:24:00Z — Released Wave 10 claims for tasks `033`, `035`, `038`, `061`, `081`, `085`, shared main/preload/database integration, and blocked task `093` after full parent gates, build verification, and task terminal moves completed.
- 2026-06-02T23:28:44Z — Released Wave 09 claims for tasks `032`, `083`, `092`, and `105` after rename, MCP permission gate, live Command Center state, and wake dependency-block verification reached terminal state with full gates passing.
- 2026-06-02T22:18:40Z — Released Wave 08 claims for tasks `031`, `055`, `082`, and the shared integration files after API-key auth, provider-backed realtime session creation, and MCP schema conversion reached terminal state with focused verification passing.
- 2026-06-02T22:11:22Z — Released task `091` wake-spike claims after documenting the blocked model/audio-corpus state, adding a real openWakeWord WAV evaluation harness, and refusing to fabricate FA/FR metrics.
- 2026-06-02T22:00:50Z — Released Wave 07 PR/CodeRabbit advisory bookkeeping claims after recording PR #8 advisory status and re-running `npm run check`, `node --test`, WAL parse, and diff whitespace validation.
- 2026-06-02T22:16:00Z — Released Wave 07 advisor-fix-2 claims after OpenRouter `getModels()` returned chat and embedding-capable models with per-model capability tags and full gates passed.
- 2026-06-02T22:03:00Z — Released Wave 07 advisor-fix claims after provider contract normalization passed focused provider tests, full `node --test`, Biome, WAL parse, and diff whitespace validation.
- 2026-06-02T21:43:00Z — Released Wave 07 reviewer-fix claims after resolving the second reviewer blocker: Ollama dynamic provider candidates, MCP `callTool()` retry safety, stale completion notes, and active-claim cleanup all verified.
- 2026-06-02T21:17:18Z — Released Wave 07 claims for tasks `030`, `050`, `051`, `052`, `060`, `080`, `090`, and `102`; orchestrator integration also touched `src/providers/index.js`, `src/renderer/shell.js`, `test/provider-registry.test.js`, and `test/tasks-screen.test.js` before full gates passed.
- 2026-06-02T20:58:09Z — Opened Wave 07 claims for tasks `030`, `050`, `051`, `052`, `060`, `080`, `090`, and `102`; `src/providers/index.js` reserved for orchestrator integration after provider workers finish.
- 2026-06-02T15:12:56Z — Released Wave 06 reviewer privacy-sweep claims for task `021`: sanitized remaining task bookkeeping paths in LEARNINGS/WAL, widened scans, and passed required gates.
- 2026-06-02T15:07:17Z — Released Wave 06 CodeRabbit hygiene claims for task `021`: modernized visually-hidden CSS helpers, sanitized local task-log paths, added LEARNINGS/WAL records, and passed required gates.
- 2026-06-02T14:35:27Z — Released Wave 06 off-white dominance claims for task `021`: made Workspace paper/off-white dominant, constrained teal to accents, refreshed screenshots, updated token coverage, and recorded bookkeeping.
- 2026-06-02T14:13:52Z — Released Wave 06 workspace-token claims for task `021`: added Workspace default theme/treatment, rebuilt tokens from the dark-teal/paper reference, added radius/token/default tests, refreshed screenshots, and updated bookkeeping.
- 2026-06-02T13:56:47Z — Released Wave 06 X-style premium neutral claims for task `021`: neutralized purple default treatment/theme, tightened orb and shell material, added anti-purple token tests, refreshed screenshots, and updated bookkeeping.
- 2026-06-02T13:35:25Z — Released Wave 06 polish-followup claims for task `021`: swapped display font to Gellix, separated command input from orb well, refreshed polish screenshots, updated tests, and recorded bookkeeping.
- 2026-06-02T12:36:46Z — Released Wave 06 taste-repair claims for task `021`: installed GitHub taste skill, rebuilt Home command surface, slimmed shell chrome, refined Command Center material, fixed Settings identity grid, refreshed taste-repair screenshots, and updated tests/bookkeeping.
- 2026-06-02T12:41:00Z — Released Wave 06 visual-repair claims for task `021`: desktop shell scale, Command Center dimensions, Integrations header copy, test expectations, refreshed approval screenshots, and task bookkeeping files.
- 2026-06-02T13:10:15Z — Released Wave 06 reviewer-fix claims for task `021`: fixed Integrations header clipping, added CSS regression coverage, refreshed `wave-06-taste-repair-integrations.png`, and updated task bookkeeping.
- 2026-06-02T04:04:10Z — Opened Wave 06 claims for task `021`: Phase 0 shell, screen, component, integration/audit test, and task bookkeeping files.
- 2026-06-02T04:12:05Z — Extended Wave 06 task `021` claims to `src/renderer/styles.css` and `src/renderer/renderer.js` after the Phase 0 hardcoded-hex audit reached legacy runtime renderer files.
- 2026-06-02T04:27:07Z — Extended Wave 06 task `021` claim to `test/leena-css-tokens.test.js` after tokenized circular radii required updating the existing token-foundation regression expectations.
- 2026-06-02T04:29:00Z — Extended Wave 06 task `021` claim to approval screenshot artifact `tasks/artifacts/wave-06-phase0-approval.png`.
- 2026-06-02T04:29:28Z — Released Wave 06 claims for task `021`: Phase 0 shell/screen/component files, renderer runtime CSS/JS, integration/audit/token tests, approval screenshot, and task bookkeeping files.
- 2026-06-02T03:18:09Z — Released Wave 05 reviewer-fix claims for task `020`: `src/renderer/leena.css`, `test/leena-css-tokens.test.js`.
- 2026-06-02T03:15:09Z — Reopened Wave 05 reviewer-fix claims for task `020`: `src/renderer/leena.css`, `test/leena-css-tokens.test.js`.
- 2026-06-02T03:11:33Z — Released Wave 05 claims for task `020`: `src/renderer/shell.js`, `src/renderer/screens/settings.js`, `src/renderer/leena.css`, `test/theme-persistence.test.js`.
- 2026-06-02T02:19:22Z — Released Wave 04 claims for tasks `013`-`018`: screen modules/tests, `src/renderer/components/command-center.js`, `src/renderer/components/command-center.css`, `test/command-center.test.js`, and integration files `src/renderer/shell.js`, `src/renderer/renderer.js`, `src/renderer/leena.css`.
- 2026-06-02T01:20:00Z — Released Wave 03 claims for task `012`: `src/renderer/index.html`, `src/renderer/panel.js`, `src/renderer/shell.js`, `src/renderer/renderer.js`, `src/renderer/leena.css`, `src/renderer/assets/gradients/`, `package.json`, `test/shell-navigation.test.js`.
- 2026-06-02T01:23:46Z — Reopened Wave 03 reviewer-fix claims for task `012`: `src/main.js`, `src/renderer/index.html`.
- 2026-06-02T01:26:49Z — Released Wave 03 reviewer-fix claims for task `012`: `src/main.js`, `src/renderer/index.html`.
- 2026-06-02T01:29:28Z — Reopened Wave 03 reviewer-fix claim for task `012`: `src/renderer/index.html`.
- 2026-06-02T01:31:53Z — Released Wave 03 reviewer-fix claim for task `012`: `src/renderer/index.html`.
- 2026-06-02T00:13:31Z — Wave 02 task `019` scoped to non-stylesheet implementation first because `src/renderer/leena.css` is actively claimed by task `011`; any required stylesheet edits will wait until `011` releases its claim.
- 2026-06-02T00:28:53Z — Released Wave 02 claims for task `001`: `src/utils/retry.js`, `test/retry.test.js`.
- 2026-06-02T00:28:53Z — Released Wave 02 claims for task `002`: `src/providers/types.js`, `src/providers/base-provider.js`, `src/providers/index.js`, `src/providers/provider-settings.js`, `test/provider-registry.test.js`.
- 2026-06-02T00:28:53Z — Released Wave 02 claims for task `011`: `src/renderer/assets/fonts/`, `src/renderer/leena.css`, `src/renderer/index.html`, `test/font-bundle.test.js`.
- 2026-06-02T00:28:53Z — Released Wave 02 claims for task `019`: `src/renderer/components/orb.js`, `src/renderer/components/waveform.js`, `test/orb-waveform.test.js`.
- 2026-06-02T00:35:27Z — Reopened Wave 02 reviewer-fix claims for task `011`: `src/renderer/styles.css`, `test/font-bundle.test.js`.
- 2026-06-02T00:35:27Z — Reopened Wave 02 reviewer-fix claims for task `002`: `src/providers/provider-settings.js`, `test/provider-registry.test.js`.
- 2026-06-02T00:43:01Z — Released Wave 02 reviewer-fix claims for task `002`: `src/providers/provider-settings.js`, `test/provider-registry.test.js`.
- 2026-06-02T00:43:01Z — Released Wave 02 reviewer-fix claims for task `011`: `src/renderer/styles.css`, `test/font-bundle.test.js`.

- 2026-06-01T23:37:45Z — Released Wave 01 claims for task `000`: `src/utils/errors.js`, `src/main.js`, `src/preload.js`, `test/errors.test.js`.
- 2026-06-01T23:37:45Z — Released Wave 01 claims for task `010`: `src/renderer/leena.css`, `src/renderer/index.html`, `test/leena-css-tokens.test.js`.
- 2026-06-01T23:37:45Z — Released Wave 01 gate claim: `biome.json`.
- 2026-06-01T23:46:46Z — Released Wave 01 reviewer-fix claims for task `000`: `src/utils/errors.js`, `src/main.js`, `test/errors.test.js`.
- 2026-06-01T23:53:22Z — Released Wave 01 embedded-URL redaction claims for task `000`: `src/utils/errors.js`, `test/errors.test.js`.
- 2026-06-02T00:00:08Z — Released Wave 01 diagnostics redaction claims for task `000`: `src/utils/errors.js`, `src/main.js`, `test/errors.test.js`.
