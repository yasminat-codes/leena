# Leena — Task Log (append-only)

## 2026-06-01 — Project initialized

- Decomposed the Leena revamp plan into **72 atomic tasks across 16 waves**, split into two bands with a single approval gate.
- **Band A (waves 1–6)** = Phase 0 visual shell; **wave-06 = the only human gate** (owner reviews `npm start` before functional work).
- **Band B (waves 7–16)** = functional phases 1–7, fully autonomous.
- **Provider abstraction** added (new vs. original plan): OpenAI **API key primary / OAuth optional fallback** for voice + chat; OpenRouter + Ollama as selectable providers; **Ollama models downloadable on demand** (any model from dropdown; embedding model independent) — tasks 052/053/054.
- **MCP client** (streamable HTTP + stdio) — Phase 5.
- **Two `.dmg` builds:** MVP (046, guaranteed) + Final (111). Both verified **decoupled from wake (090-096) and MCP (080-087)** so the deliverable always ships.
- **Advisor gate (Phase 3.5) fixes applied:** decoupled `.dmg` critical path from the wake-word Colab spike; settings screen (104) degrades gracefully instead of hard-depending on wake/MCP; `.env` preserved (wrote `.env.example`, not a clobber); `SETUP-UNBLOCK.md` written.
- **Build mandates wired into `/run-leena-wave` + `/run-leena-task`:** kencode-search before any code (production-ready, full file context); no over-engineering; never break current functionality; rigorous E2E testing; agents deployed per wave; reviewer + advisor() gates per wave; CodeRabbit mandatory but advisory-only (never blocks); WAL + LEARNINGS + bookkeeping compulsory; file-claim concurrency protocol; no AskUserQuestion / no prod-DB confirmation; complete the whole wave; 10× unblock then skip; never idle.
- Governance files created: `LEARNINGS.md`, `WAL-PROTOCOL.md`, `FILE-CLAIMS.md`, `SPEC.md`, `OVERVIEW.md`.
- kencode-search MCP installed and connected (`claude mcp add kencode-search`).

---
_(wave execution entries appended below as the build runs)_

## 2026-06-02 — Wave 07 started

- Owner approved moving past the Wave 06 Phase 0 gate, with visual polish deferred to later iterations.
- Cut clean branch/worktree `wave-07` from `origin/main` at `c2f1a05`; primary checkout remains dirty/diverged and was not touched.
- Moved tasks `030`, `050`, `051`, `052`, `060`, `080`, `090`, and `102` to `in-progress` with attempt 1, active claims, and pre-run WAL entries.
- Ran the required initial `kencode-search` pass before code; curated MCP/provider references and several literal searches returned no tight hits, so workers must search narrower implementation anchors before editing their files.
- Reserved shared provider registry file `src/providers/index.js` for orchestrator integration after provider workers finish, avoiding parallel writes by tasks `050`, `051`, and `052`.

## 2026-06-02 — Wave 07 summary

- Completed tasks `030`, `050`, `051`, `052`, `060`, `080`, `090`, and `102`.
- Documented R-1 as UNTESTED and made OpenAI API key the primary auth path with OAuth as optional fallback.
- Added concrete OpenAI, OpenRouter, and Ollama providers with mocked endpoint tests, retry/error wrapping, streaming support, model helpers, and default provider registry integration.
- Added the `MemoryStore` interface, MCP client manager core with `@modelcontextprotocol/sdk@1.29.0`, and wake-engine interface/factory.
- Replaced Tasks screen fixtures with live planner bridge loading, grouped calendar rendering, empty state, and shell refresh on Tasks tab activation.
- Independent gates passed after integration: `npm run check`, focused provider/tasks/shell tests, `node --test` (266 tests after advisor-fix coverage), `node --check` on integration files, WAL JSON parse, and `git diff --check`.
- Reviewer gate found blockers in Ollama registry visibility, MCP side-effect retry defaults, and stale task bookkeeping. Fixed with `BaseProvider.canProvide()`, Ollama dynamic-candidate routing, one-attempt default MCP `callTool()`, focused regression tests, and corrected completed-task criteria.
- Advisor gate found provider-contract blockers. Fixed streaming chunk normalization across OpenAI/OpenRouter/Ollama, added OpenAI `getModels()` metadata, and removed unimplemented Ollama speech from advertised capabilities.
- Final advisor pass found OpenRouter embedding model metadata missing from `getModels()`. Fixed model normalization so chat and embedding-capable models are both returned with per-model capability tags.
- Final advisor gate passed with warnings only: Task 056 should lock terminal streaming metadata semantics; OpenRouter cached model arrays should avoid caller mutation; MCP renderer/user-config wiring must add allowlist and encrypted secret handling; existing `@nut-tree-fork/nut-js` dependency chain still reports 7 moderate `npm audit` advisories with no direct fix available.
- Opened PR #8 (`wave-07` -> `main`) and requested CodeRabbit with `@coderabbitai review`. CodeRabbit posted generated "Review triggered" / "review in progress" comments and had a pending advisory status with no actionable findings at merge-decision time; advisory status did not block the wave. GitHub labels `codex` and `codex-automation` are not present in this repo.

## 2026-06-02 — Wave 08 started

- Cut clean branch/worktree `wave-08` from `origin/main` at `98199e5`; primary checkout remains dirty/diverged and was not touched.
- Moved tasks `031`, `055`, `082`, and `091` to `in-progress` with attempt 1, active claims, and pre-run WAL entries.
- Ran the required initial `kencode-search` pass before code. Electron safeStorage/IPC and MCP `inputSchema` references were found; openWakeWord repository discovery found maintained custom-wake/training references. Workers must continue with narrower file-context searches before editing.
- Reserved shared `src/main.js` and `src/preload.js` for the Wave 08 integration pass because tasks `031` and `055` both need those files. Task workers must keep their owned edits to non-conflicting files until integration.

## 2026-06-02 — Wave 08 summary

- Completed tasks `031`, `055`, and `082`; blocked task `091` without fabricated metrics because no trained `hey-lena.onnx`, one-hour ambient corpus, or 50-utterance positive corpus exists.
- Added API-key auth IPC and preload helpers: `openai:save-api-key`, `openai:get-auth-type`, `window.brah.saveApiKey`, and `window.brah.getAuthType`.
- Routed realtime session creation through the provider layer with `realtime:create-session`; kept `openai:create-realtime-secret` as a deprecated alias for renderer compatibility.
- Added MCP schema conversion utilities and tests: MCP tool conversion, schema sanitization, namespacing, reverse parsing, static+MCP merge, and depth truncation.
- Added `plans/spike-results-wake.md` plus `test/spike/wake_openwakeword_eval.py` so the wake spike can be rerun once a real model and audio corpora exist. Task `092` must wait for measured results or use the documented fallback.
- Independent gates after reviewer fixes passed: `npm run check`, full `node --test` (282 tests), `node --check` on changed JS/test files, wake harness `py_compile` and `--help`, undersized-corpus negative probe, WAL JSON parse, and `git diff --check`.
- Advisor gate passed with warnings: task `085` must fail closed on malformed MCP names, verify server ownership before `callTool`, sanitize MCP descriptions before prompt exposure, and enforce allowlist/tool-count/schema limits; task `092` must remain blocked for openWakeWord until real model + ambient/positive corpora produce measured FA/hr and FR%, while hotkey-only or Porcupine fallback can proceed without blocking the DMG path.
- Reviewer gate initially blocked on stale task-move index state, unsafe MCP namespace round-tripping, wake harness corpus minimums, and task `082` wording. Fixed with final full staging, encoded reversible namespace segments, one-hour ambient plus 50-positive WAV preflight checks, and corrected task wording.
- Task `091` is blocked rather than complete: no trained `src/wake/models/hey-lena.onnx`, one-hour ambient corpus, or 50-utterance positive corpus exists, so FA/hr, FR%, model size, and latency could not be measured without fabrication. Added `plans/spike-results-wake.md` and `test/spike/wake_openwakeword_eval.py`; Task 092 must wait for real measured results or choose the documented Porcupine/hotkey-only fallback.
- Opened PR #9 (`wave-08` -> `main`) and requested CodeRabbit with `@coderabbitai review`. CodeRabbit selected all 19 changed files but could not start a substantive review because the org hit review-rate and usage-credit limits; it posted no actionable code findings. Advisory status did not block merge. GitHub labels `codex` and `codex-automation` are not present in this repo.

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
- Parent-branch gates passed after reviewer fixes: `npm run check`, `node --test` (159 tests), `node --check` on changed JS, `git diff --check`, and source-only font-host/family scan.
- Reviewer gate passed with no blockers; prior font and provider-secret blockers were verified fixed.
- Advisor gate passed with no blockers. Warnings recorded for downstream work: keep OpenRouter/Ollama networking in main process unless CSP is expanded, wire provider key settings to Electron `safeStorage`, and use canonical concrete provider names.
- GitHub labels `codex` and `codex-automation` are not present in this repo, so PR labeling was unavailable without creating new labels.
- Opened PR #2 (`wave-02` → `main`) and requested CodeRabbit with `@coderabbitai review`. CodeRabbit responded with a rate-limit/usage-credit warning and produced no actionable review findings; advisory status did not block the wave.

## 2026-06-02 — Wave 02 summary

- Built retry/backoff infrastructure with abort support, Retry-After handling, and non-retryable failure wrapping.
- Built the provider abstraction skeleton: capability constants, `BaseProvider`, registry, singleton access, persisted defaults, protected API-key setting helpers, and tests.
- Bundled local Leena font assets, removed Google Font loading/CSP allowances, and routed runtime CSS through local font tokens.
- Built standalone orb and waveform DOM primitives with reduced-motion-aware tests.
- Reviewer blockers on raw provider secret persistence and legacy remote-font fallback were fixed and independently re-verified.
- Independent gates passed: `npm run check`, `node --test` (159 tests), `node --check` for changed JS files, and `git diff --check`.
- Advisor gate passed with warnings for downstream provider wiring: safeStorage codec hookup, main-process provider networking unless CSP expands, and canonical provider names.
- CodeRabbit advisory review was requested on PR #2. It was rate-limited before review start and produced no actionable findings at merge decision time.

## 2026-06-02 — Wave 03 started

- Cut clean branch/worktree `wave-03` from `origin/main` after PR #2 (`Wave 02 utilities and visual primitives`) merged.
- Moved task `012` to `in-progress` with attempt 1, active claims, and a pre-run WAL entry.
- Clean worktree does not include the untracked `design-system/` reference directory; Wave 03 uses `<primary-checkout>/design-system/Leena Design System.md` and its gradient PNGs as external source references while committing only runtime outputs.
- Completed task `012`: visible Leena window shell, sidebar/topbar navigation, shell state module, bundled gradient wallpapers, package asset include, and DOM-free shell navigation tests.
- Parent verification caught approximate shell icon paths; re-dispatched task `012` owner for a focused exact-path fix, then re-ran all gates successfully.
- Independent task gates passed: `npm run check`, `node --test` (161 tests), `node --check` on renderer JS/test files, exact icon path scan, `git diff --check`, and short `npm start` startup smoke.
- Reviewer gate blocked Wave 03 on Electron still locking `panel` mode to the old 440x600 window and on the Integrations grid icon still drifting from the exact design-system path. Reopened task `012` for focused reviewer fixes.
- Fixed the reviewer blockers by resizing Electron `panel` mode to 1060x712 in `src/main.js` and replacing the Integrations icon with the exact design-system grid rects.
- Re-verified after the reviewer fix with `npm run check`, `node --test` (161 tests), `node --check` on changed JS/test files, exact grid icon scan, `git diff --check`, and short `npm start` startup smoke.
- Reviewer re-review found an active-call regression: `#call-wave` was inside the hidden `legacy-controls` container, so the waveform canvas could not render during calls. Reopened task `012` for a focused HTML placement fix.
- Fixed the active-call waveform regression by moving the single `#call-wave` canvas into visible `#call-stage`; re-verified with placement scans, `npm run check`, `node --test` (161 tests), `node --check`, `git diff --check`, and short `npm start` startup smoke.

## 2026-06-02 — Wave 03 summary

- Built the visible Leena `.win` shell scaffold with sidebar/topbar navigation, shell screen state, bundled gradient wallpaper assets, and DOM-free shell navigation coverage.
- Task `012` completed after three verified attempts: initial scaffold, exact icon/window-size reviewer fix, and active-call waveform placement fix.
- Reviewer gate passed after confirming Electron `panel` mode now uses the 1060x712 app-shell size, the Integrations icon uses the exact grid path, and `#call-wave` is visible inside `#call-stage`.
- Advisor gate passed with downstream warnings recorded: mount Wave 04 screen content into `#shell-content`, treat `panelController.isOpen()` as legacy state only, use `#app-shell[data-theme]` for shell theme changes, and keep bundled gradient PNGs available for future styling.
- Independent gates passed: `npm run check`, `node --test` (161 tests), `node --check` for changed JS/test files, `git diff --check`, exact icon/canvas placement scans, and short `npm start` startup smoke.
- GitHub labels `codex` and `codex-automation` are not present in this repo, so PR labeling was unavailable without creating new labels.
- Opened PR #3 (`wave-03` → `main`) and requested CodeRabbit with `@coderabbitai review`. CodeRabbit posted generated "review in progress" / "Review triggered" comments and remained pending with no actionable findings at merge-decision time; advisory status did not block the wave.

## 2026-06-02 — Wave 04 started

- Cut clean branch/worktree `wave-04` from `origin/main` after Wave 03 landed.
- Moved tasks `013`, `014`, `015`, `016`, `017`, and `018` to `in-progress` with attempt 1, active claims, and pre-run WAL entries.
- Shared integration files are reserved for a post-worker integration pass: screen workers own their screen modules/tests, task `018` owns command-center component/CSS/tests, and the orchestrator owns final `shell.js`/`renderer.js` wiring to avoid concurrent edits.
- Completed tasks `013` through `018`: Home, Activity, Tasks, Integrations, Settings, and Command Center mock surfaces are wired into the Wave 03 shell with focused tests.
- Parent verification caught task `018` worker output in the wrong checkout and recovered only the task-owned files into `<wave-04-worktree>`.
- Integrated all Wave 04 routes through `src/renderer/shell.js`, moved screen styling into `src/renderer/leena.css`, and reworked stale inline-style tests to assert class/token usage.
- Reviewer found two blockers after first completion: Command Center demo mode used renderer file URL as a production signal, and Settings appearance writes allowed loose fallback targets. Both were fixed in attempt 2.
- Reviewer re-review found Settings still accepted direct loose roots and the missing-storage theme default was light instead of dark. Task `017` was fixed in attempt 3 with exact `#app-shell.leena` selector matching and default coverage.
- Wave 04 gates after reviewer re-review fixes passed: `npm run check`, `node --test` (189 tests), `node --check` on changed JS/test files, `git diff --check`, output existence checks, and short `npm start` startup smoke.
- Reviewer re-review passed with no blockers after the Settings direct-root/default fix.
- Advisor gate passed with no blockers. Warnings recorded: stage `test/dev-mode-gate.test.js` with the Wave 04 commit, and preserve the shell route shape when later replacing mock screen data with live stores/providers.
- Opened PR #4 (`wave-04` → `main`) and requested CodeRabbit with `@coderabbitai review`. CodeRabbit posted generated "review in progress" / "Review triggered" comments and had a pending advisory status with no actionable findings at merge-decision time; advisory status did not block the wave.

## 2026-06-02 — Wave 05 started

- Cut clean branch/worktree `wave-05` from `origin/main` after Wave 04 landed.
- Moved task `020` to `in-progress` with attempt 1, active claims, and a pre-run WAL entry.
- Primary checkout is stale/dirty versus `origin/main`; Wave 05 is running from `<wave-05-worktree>` to keep unrelated local plan changes out of the wave branch.
- Completed task `020`: verified shell startup restores appearance preferences before first render, added required persistence tests, and added 200ms wallpaper cross-fade coverage.
- Independent task gates passed: `npm run check`, `node --test` (193 tests), `node --check` on changed JS/test files, and `git diff --check`.
- Reviewer found one blocker: the visible `.win` shell also paints `--wall`, so wrapper-only transition coverage could still allow the actual wallpaper surface to snap. Reopened task `020` for a focused CSS/test fix.
- Fixed the reviewer blocker by adding the 200ms background transition to `.leena-page, .win`, adding selector coverage, and re-running gates: `npm run check`, `node --test` (194 tests), `node --check`, and `git diff --check`.
- Reviewer re-review passed with no blockers after the visible wallpaper surface fix.
- Advisor gate passed with no blockers. Non-blocking bookkeeping warning about the completed-wave list was addressed by adding Wave 05 to `tasks/OVERVIEW.md`.
- GitHub labels `codex` and `codex-automation` are not present in this repo, so PR labeling was unavailable without creating new labels.
- Opened PR #5 (`wave-05` → `main`) and requested CodeRabbit with `@coderabbitai review`. CodeRabbit returned a rate-limit/usage-credit warning and produced no actionable review findings; advisory status did not block the wave.

## 2026-06-02 — Wave 06 started

- Cut clean branch/worktree `wave-06` from `origin/main` after Wave 05 landed.
- Moved task `021` to `in-progress` with attempt 1, active claims, and a pre-run WAL entry.
- Primary checkout remains stale/dirty versus `origin/main`; Wave 06 is running from `<wave-06-worktree>` to keep unrelated local plan edits out of the wave branch.
- Completed task `021`: added Phase 0 shell rendering coverage, design-system audit coverage, tokenized legacy renderer values found by the audit, and captured the approval screenshot.
- Independent task gates passed: `npm run check`, `node --test` (202 tests), `npm test`, `node --check` on changed JS/test files, `git diff --check`, and Electron/Playwright visual sweep with 5 screens, 18 appearance combinations, Ctrl+D Command Center demo, and screenshot capture.
- Reviewer gate passed with no blockers. Residual risk noted: synthetic DOM tests depend on the parent Electron/Playwright sweep for pixel/layout coverage.
- Advisor gate passed with no blockers. Warning recorded: keep the Electron/Playwright visual sweep as the authority for pixel/layout review at the Wave 06 approval gate.
- GitHub labels `codex` and `codex-automation` are not present in this repo, so PR labeling was unavailable without creating new labels.
- Opened PR #6 (`wave-06` → `main`) and requested CodeRabbit with `@coderabbitai review`. CodeRabbit posted generated "review in progress" / "Review triggered" comments and had a pending advisory status with no actionable findings at merge-decision time; advisory status did not block the wave.

## 2026-06-02 — Wave 06 visual repair started

- Owner rejected the Phase 0 approval gate: fonts were too big, design was not refined, and the UX did not feel like a mature desktop app.
- Created branch `wave-06-visual-repair` from `origin/main` in `<wave-06-worktree>`; primary checkout remains dirty/diverged and was not used.
- Checked GitHub/OpenAI skill sources for a literal `taste` skill. The curated OpenAI skill list and GitHub searches did not surface an installable exact match; local available taste/design skills were applied instead: `design-taste-frontend`, `gpt-taste`, `stitch-design-taste`, and `redesign-existing-projects`.
- Repaired the Phase 0 shell visual scale: smaller desktop-app typography, narrower sidebar/topbar rhythm, tighter buttons/nav rows, reduced radii, calmer dark wallpaper, stacked row text, two-column integration tiles, quieter Integrations summary, and smaller Command Center mini/compact/expanded dimensions.
- Refreshed approval artifacts: `tasks/artifacts/wave-06-visual-repair-home.png`, `activity.png`, `tasks.png`, `integrations.png`, `settings.png`, and `command-center.png`.
- Gates passed after repair: `npm run check`, focused `node --test test/command-center.test.js test/leena-css-tokens.test.js test/shell-rendering.test.js`, full `node --test` (202 tests), `node --check` on changed JS files, `git diff --check`, and Electron/Playwright screenshot sweep.

## 2026-06-02 — Wave 06 taste repair follow-up

- Owner rejected the first visual repair as still cheap/poorly composed and specifically called out the Home/orb/chat grouping and sidebar/topbar refinement.
- Found and installed the requested GitHub taste skill: `Leonxlnx/taste-skill` -> `<codex-skills>/gpt-tasteskill`. Codex must be restarted to auto-load it as a named skill, but its `SKILL.md` was read and applied in this run.
- Ran the required `kencode-search` reference pass before code and used polished UI references to steer away from generic dashboard/card composition.
- Rebuilt Home around a single nested command surface containing greeting, orb, and chat input; converted the shell sidebar into a slim icon rail; removed visible title chrome; softened Command Center material; made recent/up-next quiet context sections; and fixed the Settings identity grid after the screenshot sweep exposed an awkward Edit-button row.
- Refreshed taste-repair artifacts: `tasks/artifacts/wave-06-taste-repair-home.png`, `activity.png`, `tasks.png`, `integrations.png`, `settings.png`, and `command-center-demo.png`.
- Gates passed after follow-up: `npm run check`, focused home/token/shell/command-center tests, full `node --test` (202 tests), `node --check`, `git diff --check`, Electron/Playwright five-screen sweep, and final `npm test` (202 tests).
- Reviewer gate found one blocker after follow-up: `tasks/artifacts/wave-06-taste-repair-integrations.png` clipped the `6 connected` stat. Fixed the Integrations header min-height/overflow in `src/renderer/leena.css`, added CSS regression coverage in `test/integrations-screen.test.js`, refreshed the Integrations artifact, and re-ran gates: `npm run check`, focused integration/CSS tests, full `node --test` (203 tests), `node --check`, and `git diff --check`.

## 2026-06-02 — Wave 06 polish follow-up

- Owner said the taste repair looked better but still needed more polish, especially the font and the orb sitting too close to the chat input.
- Re-ran the installed GitHub taste skill and the required `kencode-search` reference pass before code.
- Changed the display font token to Gellix, moved the Home prompt into the left command column, separated the orb into a dedicated right-side well, removed the extra top-right readiness label, and refreshed five polish artifacts.
- Gates passed after polish: `npm run check`, focused home/token/shell tests, five-screen screenshot sweep, full `node --test` (203 tests), `npm test` (203 tests), `git diff --check`, and `node --check src/renderer/screens/home.js`.

## 2026-06-02 — Wave 06 X-style premium neutral follow-up

- Owner said the shell still felt vibe-coded and suspected the purple visual language; target was ultra-premium restraint associated with X-style UI taste.
- Re-applied the installed GitHub taste skill, high-end visual design checklist, and required `kencode-search` reference pass before code.
- Kept the existing composition but changed the default visual language: Aurora is now graphite/blue-neutral, the dark theme is near-black with neutral text, broad purple wallpaper/orb/card glow was removed, and blue is reserved for small state accents.
- Added CSS token tests that reject the old purple default treatment/theme values and refreshed five screenshot artifacts under `tasks/artifacts/wave-06-x-premium-*.png`.
- Gates passed after neutral pass: `npm run check`, focused home/token/shell tests, full `node --test` (205 tests), `npm test` (205 tests), `git diff --check`, `node --check test/leena-css-tokens.test.js`, and Electron/Playwright five-screen screenshot sweep.

## 2026-06-02 — Wave 06 Workspace reference-token follow-up

- Owner provided a dark-teal/warm-white workspace UI reference and asked to change the entire design-token direction instead of continuing the purple/graphite pass.
- Re-applied the installed GitHub taste skill, high-end visual design checklist, and required `kencode-search` reference pass before code.
- Added `Workspace` as the default theme/treatment, with a deep teal outer frame, warm-white command/work surfaces, mint rows, dark teal pill controls, restrained orb material, and a quiet abstract right-side shape.
- Added Workspace token/default tests, added the new `--r-sculpt` radius token after the design audit caught a literal decorative radius, and refreshed five screenshot artifacts under `tasks/artifacts/wave-06-workspace-mode-*.png`.
- Gates passed after the Workspace pass: `npm run check`, focused design-audit/token tests, full `node --test` (207 tests), `git diff --check`, and `node --check` on changed JS/test files.

## 2026-06-02 — Wave 06 off-white dominance follow-up

- Owner clarified that the dominant Workspace color should be off-white.
- Kept the Workspace mode but changed the visual hierarchy: off-white now owns the wallpaper, side rail, topbar, Home context, list surfaces, and orb well; teal is constrained to the logo/orb material, active nav, CTA, small markers, and faint sculptural accent.
- Updated Workspace token tests to assert the off-white shell and refreshed five artifacts under `tasks/artifacts/wave-06-offwhite-dominant-*.png`.
- Gates passed after the off-white pass: `npm run check`, focused design-audit/token tests, full `node --test` (207 tests), `node --check test/leena-css-tokens.test.js`, `git diff --check`, and Electron/Playwright five-screen screenshot sweep.

## 2026-06-02 — Wave 09 started

- Cut clean branch/worktree `wave-09` from `origin/main` at `4e5e6f3`; primary checkout remains dirty/diverged and was not touched.
- Moved tasks `032`, `083`, `092`, and `105` to `in-progress` with attempt 1, active claims, and pre-run WAL entries.
- Dispatched four workers in one parallel group for rename, MCP permission gate, wake engine dependency verification, and live Command Center state. Task `092` was expected to block if dependency `091` remained blocked.
- Ran required `kencode-search` passes before implementation edits. Useful local context came from the existing Electron preload, SQLite database helper, MCP schema converter, Realtime tool handler, and Command Center tests.

## 2026-06-02 — Wave 09 summary

- Completed task `032`: package/app identity, preload bridge, renderer bridge calls, docs, user-facing strings, default DB path, and legacy DB/sidecar migration now use Leena.
- Completed task `083`: MCP permission requests now fail closed by default, validate server ownership, infer schema risk, sanitize descriptions, summarize arguments, and respect `auto` / `confirm` / `trust` server policy.
- Completed task `105`: live Command Center state now uses `SessionStateManager`, real renderer Realtime events, preload push-event hooks, tool previews, debounce, disconnect error handling, and reconnect recovery.
- Blocked task `092`: dependency `091` has no trained `hey-lena.onnx`, selected threshold, one-hour ambient corpus, 50-positive utterance corpus, FA/hr, FR%, model size, or latency measurement. Wake remains decoupled from the DMG path.
- Independent gates passed after integration: `npm run check`, `node --test` (291 tests), changed JS syntax checks, output existence checks, old-name grep over `src/ test/ package.json README.md CLAUDE.md`, WAL JSON parse, and `git diff --check`.

## 2026-06-02 — Wave 09 reviewer fixes revalidated

- Re-dispatched focused reviewer-fix workers for task `032` rename migration and task `083` MCP permission gating, plus a ledger-order audit worker.
- Hardened MCP permission validation so stale tool metadata, unnamed singleton metadata, and malformed or absent `inputSchema` fail closed even under `auto` or `trust` server policy.
- Added stricter rename migration coverage for cross-root SQLite WAL/SHM sidecars with uncheckpointed rows and for legacy `openai-credentials.json` migration from the old Electron support root.
- Ledger audit confirmed the Wave 09 TASKLOG started/summary entries are now at the physical end of the append-only task log.
- Reviewer gate cleared with no blockers. Advisor gate cleared with warnings only: pending task `085` must enforce MCP permission helpers in the dynamic MCP execution path, and the live Command Center surface should get an Electron visual smoke when production-visible runtime proof is needed.
- Parent gates passed after reviewer hardening: `npm run check`, `node --test` (295 tests), changed JS syntax checks, `git diff --check`, WAL JSON parse, old-name grep, active-claims audit, and task-artifact privacy scan.
- Opened PR #10 (`wave-09` -> `main`) and requested CodeRabbit with `@coderabbitai review`. CodeRabbit posted its generated "Review triggered" response and left the advisory status pending as "Review in progress" with no actionable findings available at merge-decision time; advisory status did not block the wave. GitHub labels `codex` and `codex-automation` are not present in this repo.

## 2026-06-03 — Wave 10 started

- Cut clean branch/worktree `wave-10` from `origin/main` at `87a16fd` because the primary checkout is dirty/diverged and must remain untouched.
- Moved tasks `033`, `035`, `038`, `061`, `081`, `085`, and `093` to `in-progress` with attempt 1, active claims, and pre-run WAL entries.
- Task `093` is expected to block because dependency `092` is already blocked by missing wake model/corpus/metrics; the wave will keep non-wake deliverable work moving.
- Ran the required kencode-search pass before implementation. No tight curated/live reference repo matched the exact Electron Builder + tray + SQLite + MCP execution mix, so workers must rely on the existing local production patterns and continue with narrower context reads before editing.
- Shared files are reserved for orchestrator integration to avoid concurrent writes: `src/main.js`, `src/preload.js`, and `src/realtime/tools/database.js`.

## 2026-06-03 — Wave 10 summary

- Completed tasks `033`, `035`, `038`, `061`, `081`, and `085`; blocked task `093` because dependency `092` still lacks a real openWakeWord engine/model/threshold/metrics.
- Configured mac distribution for unsigned DMG + ZIP while preserving `build:mac:dir`; added `GATEKEEPER-BYPASS.md` and verified `dist/Leena-0.1.0-arm64.dmg`, `dist/Leena-0.1.0-arm64-mac.zip`, mounted DMG layout, and packaged tray assets inside `app.asar`.
- Added Leena tray/menubar infrastructure: template tray icons, injectable `src/tray.js`, close-to-tray, Show/Hide/Mute/Settings/Quit actions, preload tray listeners, and renderer-driven listening/speaking/idle state updates that preserve muted state.
- Added persistent settings storage through `src/settings-store.js`, main-process settings IPC, preload settings APIs, default settings, typed helpers, and compatibility with legacy raw string settings rows.
- Added memory SQLite tables/indexes, `mcp_servers` central schema, `src/mcp/server-store.js` CRUD storage, and MCP auto-connect filtering for downstream MCP IPC/launch tasks.
- Wired MCP tools into realtime dispatch: merged static+MCP tool definitions, namespaced routing, default-deny permission handling, safe MCP error results, and main-process MCP manager/options.
- Independent parent gates passed: `npm run check`, `node --test` (329/329), changed JS `node --check`, `git diff --check`, `npm run build:mac:dir`, `npm run build:mac`, mounted DMG layout check, ZIP structure check, and `app.asar` tray asset check.
- Reviewer/advisor notes for Wave 11: task `084` can build IPC over `ServerStore`; task `086` can use `getAutoConnectServers()` and the single main-process `MCPClientManager`; task `094`/`095` remain blocked from wake runtime until `092` resumes or a fallback is chosen.
- Reviewer gate initially found two bookkeeping blockers: Wave 10 learning entries were inside the fix-entry template fence, and the WAL physical tail ended with an older tray-slice checkpoint. Both were corrected by moving Wave 10 learnings to the physical tail and appending a later terminal WAL checkpoint.
- Reviewer gate re-check passed with no findings after the bookkeeping fix.
- Advisor gate cleared with warnings only: DMG/ZIP remain unsigned until Developer ID signing exists; MCP server IPC and auto-connect lifecycle remain scoped to tasks `084` and `086`; wake coordinator follow-ons remain blocked until task `092` has real wake evidence or an approved fallback.
- Opened PR #11 (`wave-10` -> `main`) and requested CodeRabbit with `@coderabbitai review`. CodeRabbit posted its generated "Review triggered" response and left the advisory status pending, with no actionable findings available at merge-decision time; advisory status did not block the wave. GitHub labels `codex` and `codex-automation` are not present in this repo.

## 2026-06-03 — Wave 11 started

- Cut clean branch/worktree `wave-11` from `origin/main` at `b5db6ab` because the primary checkout is dirty/diverged and must remain untouched.
- Moved tasks `034`, `036`, `037`, `039`, `053`, `062`, `070`, `084`, `086`, `087`, `094`, and `110` to `in-progress` with attempt 1 and pre-run WAL entries.
- Task `094` is expected to block because dependency `093` is already blocked by missing wake engine/model/threshold/metrics.
- Ran required kencode-search passes before code. The external index did not return exact Electron API snippets for login items/hotkeys/IPC, so agents must rely on the existing local Leena main/preload/settings/MCP patterns and continue with narrower kencode/local context reads before editing.
- Shared `src/main.js` and `src/preload.js` changes must be serialized through file claims; workers should prefer task-owned helper modules plus focused tests where possible.

## 2026-06-03 — Wave 11 summary

- Completed tasks `034`, `036`, `037`, `039`, `053`, `062`, `070`, `084`, `086`, `087`, and `110`; blocked task `094` because dependency `093` has no wake coordinator implementation and upstream wake assets/metrics remain absent.
- Parent integration wired shared `src/main.js` and `src/preload.js` for launch-on-login, global hotkey, provider settings IPC, MCP server IPC, MCP auto-connect, onboarding completion/reset aliases, first-run onboarding launch, and resizable panel bounds persistence.
- Reviewer gate found three blockers: MCP server removal could fail to delete a stored server if live disconnect cleanup errored; onboarding was implemented but unreachable at runtime; provider settings could overwrite a stored secret with its redacted placeholder. Fixed with best-effort MCP disconnect cleanup, first-launch onboarding bootstrap, tokenized onboarding styling, and redacted-sentinel preservation for provider config saves.
- Reviewer follow-up preserved the approved 1060px app-shell panel default while keeping resize persistence by allowing panel resize up to 1280px instead of clamping the desktop shell narrower.
- Focused reviewer-fix gates passed: `npm run check`, `node --test test/onboarding-flow.test.js test/provider-settings-ipc.test.js`, changed JS `node --check`, and `git diff --check`.
- Final parent gates passed after reviewer-fix bookkeeping: `npm run check`, `node --test` (400/400), changed JS `node --check`, `git diff --check`, WAL JSON parse, task-artifact privacy scan, and `npm run build:mac:dir`.
- Reviewer re-check passed with warnings only: future MCP UI should reconcile `mcp:changed` vs `mcp:status-changed`, pending task `103` still has stale bridge prose, and the 380px panel minimum needs visual smoke when resizable UI becomes user-facing.
- Advisor gate cleared with warnings only: task `094`/wake chain remains blocked until real wake assets/metrics or an explicit fallback, package build is ad-hoc signed without notarization, and CodeRabbit remains advisory-only.
- Opened PR #12 (`wave-11` -> `main`) and requested CodeRabbit with `@coderabbitai review`. CodeRabbit status was pending at merge-decision time with no actionable findings available; advisory status did not block the wave. GitHub labels `codex` and `codex-automation` are not present in this repo.

## 2026-06-03 — Wave 12 started

- Cut clean branch/worktree `wave-12` from `origin/main` at `8a29a57` because the primary checkout is dirty/diverged and must remain untouched.
- Moved tasks `040`, `054`, `056`, `063`, `072`, and `103` to `in-progress` with attempt 1, active claims, and pre-run WAL entries.
- Blocked tasks `095` and `096` immediately because upstream wake tasks `092`, `093`, and `094` are blocked by missing real wake assets, metrics, coordinator, and IPC runtime. Wake remains decoupled from the MVP/final DMG path.
- Ran the required initial `kencode-search` pass before implementation. No tight curated/live reference matched the exact Electron provider/settings/memory/wake mix, so workers must rely on local production patterns and continue with file-specific context searches before editing.
- Reserved shared `src/main.js` and `src/preload.js` for serialized Wave 12 integration after task-owned workers finish, avoiding parallel writes between memory and identity IPC tasks.

## 2026-06-03 — Wave 12 summary

- Completed tasks `040`, `054`, `056`, `063`, `072`, and `103`; blocked tasks `095` and `096` because the upstream wake engine/coordinator/IPC chain still lacks real wake assets, metrics, and runtime implementation.
- Settings now includes a live provider/model selector with provider cards, config modal, test connection, capability-filtered model choices, refresh, and Ollama pull progress handling.
- Provider-layer integration and stress coverage now exercises mocked default routing, fallback behavior, response/stream shape consistency, provider error metadata, model capability tags, and registry churn.
- Memory and identity IPC now have standalone handler modules, focused tests, serialized `src/main.js` registration, `src/preload.js` bridges, and a Wave 12 integration test pinning the main/preload contracts.
- Integrations screen now loads real MCP servers through the current `window.leena.mcp` bridge, renders live status/tool counts, validates add-server drafts, wires add/remove/connect/disconnect, and reconciles `mcp:status-changed` plus `mcp:changed` events.
- Parent gates passed: `npm run check`, `node --test` (438/438), changed JS `node --check`, `git diff --check`, WAL JSON parse, task count audit, active-claims audit, task-artifact privacy scan, and primary-checkout contamination check.
- Reviewer gate cleared with no blockers. Reviewer warnings: staging must be reconciled before commit, and realtime appears in the settings capability selector while runtime model selection still falls back through provider defaults; the realtime warning is non-blocking while only one OpenAI realtime model exists.
- Advisor gate cleared with warnings only: reconcile staging before commit, keep the realtime selector/runtime-defaults mismatch as non-blocking for now, and release post-wave bookkeeping claims before commit.
- Opened PR #13 (`wave-12` -> `main`) and requested CodeRabbit with `@coderabbitai review`. CodeRabbit posted the generated "review in progress" and "Review triggered" responses with advisory status pending and no actionable findings available at merge-decision time; advisory status did not block the wave. GitHub labels `codex` and `codex-automation` are not present in this repo.

## 2026-06-03 — Wave 13 started

- Cut clean branch/worktree `wave-13` from `origin/main` at `2f979ffe` because the primary checkout is dirty/diverged and must remain untouched.
- Baseline gates before implementation: `node --test` passed 438/438; `npm run check` initially failed because this new worktree had no installed Biome binary, then passed after `npm install`.
- Moved tasks `064`, `100`, `101`, `104`, and `106` to `in-progress` with attempt 1, active claims, and pre-run WAL entries.
- Ran required kencode-search before code. Curated references identified Vercel AI SDK/chatbot and OpenAI Agents SDK as production chat/tool-use sources; literal Electron `chat:send`/`memory:recall` matches were absent, so workers must use existing Leena IPC/provider/settings patterns plus narrower file context.
- Shared lifecycle files are reserved for serialized parent integration: `src/main.js`, `src/preload.js`, `src/renderer/renderer.js`, and `test/wave13-integration.test.js`.

## 2026-06-03 — Wave 13 summary

- Completed tasks `064`, `100`, `101`, `104`, and `106`.
- Added memory-aware realtime prompts and middleware, then completed the serialized parent integration so recalled memories are injected into realtime session instructions and transcript exchanges are stored best-effort.
- Replaced Home, Activity, and Settings mock paths with live data loading, current bridge fallbacks, loading/empty states, provider/identity/settings persistence, wake graceful degradation, and focused screen-data tests.
- Added text chat to the live Command Center with chat IPC handlers, preload send/chunk APIs, provider/model switching, streamed chat bubbles, standard realtime tool dispatch, and memory handoff storage.
- Worker recovery found and fixed a text-chat provider/model switching bug before terminal bookkeeping.
- Parent self-review also made chat-triggered `computer_use_task` calls cancelable through the same abort-controller path as voice/tool IPC calls.
- Reviewer/advisor self-review found and fixed a provider parser gap where OpenAI/OpenRouter streamed `tool_calls` deltas were dropped before text chat could execute tools; provider regressions now cover split JSON argument deltas.
- Final reviewer found blockers and they were fixed: text chat now advertises/executes only low/read-risk tools and runs a post-tool model turn; Activity has live `memory:get-episodes` across generated conversation ids; Launch on Login uses the dedicated OS side-effect bridge; recalled memory has an untrusted-data prompt boundary.
- Final reviewer follow-up found one production async-definition gap and one task-artifact wording mismatch. Fixed by awaiting async MCP-merged chat tool definitions before low/read-risk filtering, adding focused regression coverage, and correcting task `101` from FTS5 wording to the implemented bounded SQLite `LIKE` search path.
- Advisor found initial Command Center text chat bypassed configured chat-provider defaults by sending the first provider from the renderer list. Fixed by leaving provider/model unset until explicit user selection so `chat:send` resolves the main-process default, with focused regression coverage.
- Independent parent gates passed after reviewer/advisor fixes: `npm run check`, `node --test` (483/483), changed JS `node --check`, focused Wave 13 integration tests, `git diff --check`, WAL JSON parse, task-count audit, active-claims audit, and task-artifact privacy scan.
- Opened PR #14 (`wave-13` -> `main`) and requested CodeRabbit with `@coderabbitai review`. CodeRabbit status was pending at merge-decision time with no actionable findings available; advisory status did not block the wave. GitHub labels `codex` and `codex-automation` are not present in this repo.
- Wave 13 is terminal with no blocked tasks. Wake tasks `091`-`096` remain blocked independently and do not affect the deliverable path.

## 2026-06-03 — Wave 13 reviewer-fix-2

- Reviewer gate found four blockers after the first final-gate pass: renderer-forged chat tools/privileged roles could steer text chat toward local reads, chat-triggered tools bypassed standard diagnostics/activity/data refresh, OpenRouter could drop accumulated tool-call deltas at `[DONE]`, and `memory:get-episodes` allowed unbounded pagination/search.
- Fixed text-chat privacy by ignoring renderer-supplied tool schemas, accepting only renderer `user`/`assistant` history roles, capping chat history/message size, and advertising only explicit default chat tools. `read_file` is denied even if emitted by the model.
- Routed text-chat tool execution through `executeRealtimeToolWithAudit()` so chat-triggered tools get the same diagnostics, activity recording, and `data:changed` broadcasts as direct `tools:execute`.
- Fixed OpenRouter streaming so `[DONE]` no longer prevents accumulated tool calls from flushing, and bounded memory episode reads with limit/page/query caps plus literal `LIKE` escaping.
- Reviewer re-check found no blockers and one warning: the legacy `memory:get-episodes` fallback still returned all conversation rows. Closed it by applying the same capped pagination/search behavior to the fallback path and adding focused IPC coverage.
- Focused gates passed: changed-file `node --check`, focused Biome, and `node --test test/text-chat.test.js test/provider-openrouter.test.js test/memory-ipc.test.js test/memory-sqlite.test.js test/wave13-integration.test.js` (45/45).
- Full parent gates passed after reviewer-fix-2 and WAL tail repair: `npm run check`, `node --test` (488/488), active-claims audit, WAL JSON parse, task-count audit, `git diff --check`, and task-artifact privacy scan.

## 2026-06-03 — Wave 14 started

- Cut clean branch/worktree `wave-14` from `origin/main` at `a0662d7` because the primary checkout is dirty/diverged and must remain untouched.
- Baseline gates before implementation: `node --test` passed 488/488; `npm run check` initially lacked the fresh worktree's local Biome binary, then passed after `npm install`.
- Ran the required initial `kencode-search` pass before implementation. Curated references identified Vercel AI SDK chat/tool streaming and the MCP TypeScript SDK tool-registration patterns; workers must still follow Leena's local SQLite, provider, preload, renderer, and MCP contracts.
- Moved tasks `065`, `071`, `107`, `108`, `109`, and `112` to `in-progress` with attempt 1, active claims, and pre-run WAL entries.
- Shared file ownership is constrained for parallel work: task `108` owns nudge runtime/main/preload/home wiring, task `107` owns Activity conversation history, task `071` owns prompt composition, task `109` owns renderer CSS audit files, task `065` owns memory-focused tests, and task `112` owns final e2e test files.

## 2026-06-03 — Wave 14 summary

- Completed tasks `065`, `071`, `107`, `108`, `109`, and `112`.
- Added comprehensive memory tests with deterministic mock providers, cross-session recall, consolidation/source-link coverage, and SQLite edge cases.
- Refactored prompt composition around persona, memory, tools, base instructions, profile context, and runtime context while preserving backward-compatible wrappers and the untrusted recalled-memory boundary.
- Extended Activity with lazy expandable conversation transcripts, hybrid keyword/semantic rerank search, relevance badges, de-duplication, bounded requests, and local date grouping.
- Added opt-in in-shell proactive nudges with planner/calendar reminders, stale memory follow-ups, 7-day dismissal persistence, main/preload IPC, and Home Suggested rendering without OS notifications.
- Completed renderer CSS token cleanup across runtime stylesheets and recorded grep proof in `tasks/artifacts/wave-14-token-cleanup-grep.log`.
- Added final e2e tests for provider switching, memory recall persistence, MCP HTTP connect/tool merging/disconnect, and settings/protected-secret persistence.
- Independent verification passed: output existence checks, changed-file `node --check`, `npm run check`, full `node --test` (515/515), `npm test`, WAL JSON parse, and `git diff --check`.

## 2026-06-03 — Wave 14 reviewer-fix-1

- Reviewer gate found blockers in realtime persona wiring, persona switch session-update safety, nudge opt-out staleness, and completed-task checklist hygiene.
- Fixed realtime session creation so it uses `PersonaEngine.getActive()` for prompt composition and persona voice preference, and passes realtime tool definitions into prompt Tool Context while preserving legacy profile and memory injection.
- Fixed `buildPersonaSwitchDelta()` so `session.instructions` carries the full realtime instruction contract, not a persona-only fragment; the persona-only section remains available under `sections.persona`.
- Fixed nudge settings and dismissal refreshes with forced generation invalidation so stale in-flight enabled payloads cannot update or broadcast after opt-out/dismiss.
- Fixed completed-task acceptance checklists for Wave 14 tasks `065`, `071`, `107`, `108`, `109`, and `112`; checklist audit, privacy scan, and diff check passed.
- Worker-focused fix gates passed: `npm run check`, focused prompt/nudge tests, Wave 10/Wave 13 integration checks, source diff check, and full `node --test` (517/517). Parent re-run gates passed before re-review, then the parent closed a final realtime Tool Context gap and re-ran gates.

## 2026-06-03 — Wave 14 reviewer-fix-2

- Reviewer re-check found two remaining nudge opt-out blockers: legacy `nudgesEnabled=true` could override the visible Settings toggle `proactiveNudges=false`, and `nudges:list` could return a cached enabled payload while a forced settings/dismiss refresh was in flight.
- Fixed nudge opt-in precedence so `proactiveNudges` is authoritative when present and `nudgesEnabled` is only a legacy fallback.
- Fixed `nudges:list` to wait for forced refreshes, and forced refreshes immediately replace the cached payload with a disabled empty payload until the fresh result resolves.
- Added focused coverage in `test/nudge-engine.test.js` and `test/wave14-integration.test.js`; focused nudge gate passed 8/8. Full parent gates follow before final re-review/advisor.

## 2026-06-03 — Wave 14 reviewer-fix-3

- Reviewer final re-check found persona runtime blockers: Settings persona switches did not update active realtime calls or invalidate prefetched client secrets, and seeded/default persona voice preference could override the user's explicit legacy voice selector.
- Fixed main-process realtime session config so call secrets and persona session updates share active PersonaEngine state, memory recall, live tool definitions, and resolved voice selection.
- Added `realtime:create-persona-session-update` through main/preload; renderer sends the returned full `session.update` over an open realtime data channel after Settings/agent profile changes.
- Added a secret prefetch generation guard so stale in-flight prefetches cannot repopulate the cache after persona/profile invalidation.
- Added focused coverage in prompt and Wave 12-14 integration tests; focused persona/session gate passed 24/24. Full parent gates follow before final reviewer/advisor.

## 2026-06-03 — Wave 14 reviewer-fix-4

- Independent reviewer re-check found three remaining blockers: identity/profile changes needed a durable main-process invalidation broadcast, renderer-exposed `memory:recall` still accepted unbounded limits, and Home could render stale data from an older overlapping refresh.
- Fixed identity/profile IPC to broadcast `identity` data changes and wired renderer `onDataChanged` to the existing realtime secret/session refresh helper.
- Bounded memory recall at both IPC and direct `SQLiteMemoryStore` layers, with focused IPC/store regression coverage.
- Added a Home refresh generation guard so late older refreshes return `null` and do not overwrite the current Suggested/Home UI state.
- Focused reviewer-fix gate passed: changed-file `node --check`, scoped Biome, and `node --test test/identity-ipc.test.js test/memory-ipc.test.js test/memory-sqlite.test.js test/home-screen-data.test.js test/wave13-integration.test.js test/wave14-integration.test.js` (41/41). Full parent gates follow before final reviewer/advisor.
- Full parent gates passed after reviewer-fix-4: `npm test` (524/524), changed-file `node --check`, `git diff --check`, WAL JSON parse, active-claims release, and task-artifact privacy scan pending re-review/advisor.

## 2026-06-03 — Wave 14 reviewer-fix-5

- Final reviewer re-check cleared blockers and raised two P3 warnings: rapid persona/profile changes could race older realtime session-update IPC responses, and active sessions did not refresh tool definitions.
- Fixed renderer active-session updates with the same invalidation generation used for realtime secret prefetches, so stale session-update responses are dropped before sending on the data channel.
- Fixed main-process persona session updates to include refreshed realtime tool definitions alongside the full instructions/audio payload.
- Focused reviewer-warning gate passed: `node --check` on changed files and `node --test test/prompts.test.js test/wave13-integration.test.js test/wave14-integration.test.js` (24/24). Full parent gates follow before advisor.
- First full gate rerun exposed one Biome formatting issue in the new Wave 14 integration assertion; the assertion was reformatted and the full parent gate then passed.
- Full parent gates passed after reviewer-fix-5: `npm test` (525/525), changed-file `node --check`, `git diff --check`, WAL JSON parse (`258` entries before the final checkpoint append), completed-checklist scan, task-artifact privacy scan, active-claims audit, and task-count audit (`pending=3`, `in-progress=0`, `completed=63`, `blocked=6`).

## 2026-06-03 — Wave 14 final reviewer/advisor gate

- Reviewer re-check passed with no blockers after reviewer-fix-5. The only carried warning is redundant persona/profile refresh through both the custom renderer event and `data:changed`; it is non-blocking because active session updates and Home refreshes are generation-guarded.
- Advisor gate cleared. Carried warnings for the next wave: avoid redundant persona refresh churn if it becomes noisy, and keep overview proof counts aligned with the latest full gate.
- Final parent gates passed against the current worktree: `npm test` (525/525), changed-file `node --check`, `git diff --check`, WAL JSON parse (`260` entries), task-count audit (`pending=3`, `in-progress=0`, `completed=63`, `blocked=6`), active-claims audit (`0`), and changed-task privacy scan.

## 2026-06-03 — Wave 14 PR and CodeRabbit advisory

- Opened PR #15 (`wave-14` -> `main`) after reviewer and advisor gates cleared; branch head `f89cc47`.
- Requested CodeRabbit with `@coderabbitai review`. CodeRabbit posted generated review-in-progress/trigger comments and a pending advisory status at merge-decision time; no actionable findings were available, so the advisory-only status did not block merge.
- The repo still lacks `codex` and `codex-automation` labels, so no automation labels were applied.

## 2026-06-03 — Wave 15 started

- Cut clean branch/worktree `wave-15` from `origin/main` at `f730f6f` because the primary checkout is dirty/diverged and must remain untouched.
- Baseline gates before implementation: `npm run check` passed after `npm install` restored the fresh worktree's local Biome binary; `node --test` passed 525/525.
- Ran the required initial `kencode-search` pass before code. Electron Builder reference discovery surfaced mature electron-builder apps; persona/prompt searches did not return useful external matches, so task `073` must rely on existing local PersonaEngine, prompt, IPC, and profile-store contracts.
- Moved tasks `073` and `111` to `in-progress` with attempt 1, active claims, and pre-run WAL entries.
- File ownership is disjoint: task `073` owns identity/prompt/profile tests and its task file; task `111` owns final packaging outputs, `INSTALL.md`, `tasks/DELIVERABLE.md`, and its task file.

## 2026-06-03 — Wave 15 summary

- Completed task `073`: expanded PersonaEngine coverage to seven cases with stale active-id fallback and stored-persona normalization/deduplication/repair/clone-isolation tests, while verifying existing prompt composition, identity IPC, and agent profile tests.
- Completed task `111`: regenerated the unsigned macOS DMG/ZIP with `CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac`, wrote `INSTALL.md`, and recorded artifact paths plus SHA-256 checksums in `tasks/DELIVERABLE.md`.
- Parent structural verification passed: `hdiutil verify`, read-only DMG layout check (`Leena.app` plus Applications symlink), executable check, 21 packaged font assets in `app.asar`, four unpacked `@nut-tree-fork` native addon files, and matching ZIP extraction checks.
- Independent parent gates passed: `npm run check`, full `node --test` (527/527), changed-file syntax check, `git diff --check`, WAL JSON parse, task-count audit, active-claims release, and task-artifact privacy scan.
- Owner GUI launch remains a manual checklist in `tasks/DELIVERABLE.md`; no GUI launch result was fabricated.

## 2026-06-03 — Wave 15 reviewer/advisor gate

- Reviewer gate passed with no blockers. Warning only: stage the new deliverable docs and completed task files before commit.
- Advisor gate passed with no release-readiness blockers. GUI launch remaining owner-manual is acceptable because the wave records it as a checklist and does not claim it as autonomous proof.
- Carry forward for Wave 16: `dist/` remains gitignored, so the local full-feature DMG/ZIP are recorded by path and checksum but not committed; task `046` must record the separate MVP artifact clearly in `tasks/DELIVERABLE.md` without conflating it with task `111`.

## 2026-06-03 — Wave 15 PR and CodeRabbit advisory

- Opened PR #16 (`wave-15` -> `main`) after reviewer and advisor gates cleared; branch head `7770c13`.
- Requested CodeRabbit with `@coderabbitai review`. CodeRabbit posted generated trigger/review-in-progress comments and a pending advisory status at merge-decision time; no actionable findings were available, so the advisory-only status did not block merge.
- The repo still lacks `codex` and `codex-automation` labels, so no automation labels were applied.

## 2026-06-03 — Wave 16 started

- Cut clean branch/worktree `wave-16` from `origin/main` at `445f417` after Wave 15 merged; the dirty/diverged primary checkout remains untouched.
- Baseline gates before implementation passed after `npm install` restored the fresh worktree dependencies: `npm run check` and full `node --test` (527/527).
- Ran the required initial `kencode-search` pass before code. Electron Builder references confirm `mac.target` can use `dmg` + `zip`; CI examples confirm `CSC_IDENTITY_AUTO_DISCOVERY=false` as the unsigned macOS fallback; hdiutil references confirm `hdiutil verify` as the headless image-integrity check.
- Moved task `046` to `in-progress` with attempt 1, active claims, and pre-run WAL entry.

## 2026-06-03 — Wave 16 summary

- Completed task `046`: added `test/build-smoke.test.js`, rebuilt unsigned macOS artifacts with `CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac`, copied the builder outputs to `dist/Leena-MVP.dmg` and `dist/Leena-MVP.zip`, and recorded both standard builder outputs plus MVP named copies in `tasks/DELIVERABLE.md`.
- Final MVP artifact hashes: DMG `622285f88cee98384c905c70412c794fe21f6bed03683ad85c72c64ee293be8c`; ZIP `f4897055756ec344ac883d5bc34a3d5a22485267e017c2df5417d16cf46043f6`.
- Parent structural verification passed: `hdiutil verify`, `hdiutil imageinfo`, read-only DMG layout check (`Leena.app` plus Applications symlink), executable check, 21 packaged font assets, four unpacked `@nut-tree-fork` native addon files, and matching ZIP extraction checks.
- Independent parent gates passed: `npm run check`, full `node --test` (529/529), `node --check test/build-smoke.test.js`, focused `node --test test/build-smoke.test.js`, `git diff --check`, WAL JSON parse, task-count audit, active-claims release, and task-artifact privacy scan.
- Owner GUI launch-smoke remains a manual checklist in `tasks/DELIVERABLE.md`; no GUI launch result was fabricated.

## 2026-06-03 — Wave 16 reviewer/advisor gate

- Reviewer gate passed with no blockers. Warning only: stage `test/build-smoke.test.js`, task move, and ledger updates before PR creation.
- Advisor gate passed with no release-readiness blockers. Owner GUI launch-smoke remaining manual is acceptable because task `046` and `tasks/DELIVERABLE.md` explicitly keep it as a non-autonomous checklist item.
- Carry forward for final handoff: the MVP build is unsigned/ad-hoc and not notarized, `dist/` artifacts are ignored local build outputs, and no GUI launch was performed or claimed.

## 2026-06-03 — Wave 16 PR and CodeRabbit advisory

- Opened PR #17 (`wave-16` -> `main`) after reviewer and advisor gates cleared; branch head `18f4928`.
- CodeRabbit posted a generated advisory status/comment but could not run a substantive review because of hourly rate/usage-credit limits. No actionable findings were available, so the advisory-only status did not block merge.
- The repo still lacks `codex` and `codex-automation` labels, so no automation labels were applied.

## 2026-06-03 — Post-MVP refinement plan created

- Used `task-architect` mode to decompose the owner-reviewed UI, Chat, Settings, Integrations, Composio, MCP, Full Disk Access, Apple Calendar, file-access, voice-startup, and verification work into tasks `120`-`146`.
- Added supplemental spec `tasks/SPEC-POST-MVP-REFINEMENT.md`, pending task cards in `tasks/pending/`, and wave ledgers `tasks/waves/wave-17.md` through `tasks/waves/wave-23.md`.
- Updated `tasks/OVERVIEW.md` totals to `pending=27`, `in-progress=0`, `completed=66`, `blocked=6`, `total=99`, with Wave 17 as the next planned wave.
- The plan requires kencode-search/production references before implementation, serialized shared-file integration for renderer/main/preload files, screenshot proof for UI changes, mocked Apple/Composio integration tests, and honest owner-manual GUI smoke in the final handoff.

## 2026-06-03 — Wave 17 started

- Moved tasks `120`, `121`, `122`, and `123` from `pending/` to `in-progress/` at `2026-06-03T21:08:47Z`; attempts set to `1`.
- Opened active file claims for each task's declared outputs and task files.
- Wrote WAL `pre_run` entries and prepared parallel agent dispatch for the research/proof/contract wave.

## 2026-06-03 — Wave 17 tasks completed

- Completed task `120`: `tasks/artifacts/post-mvp-reference-brief.md` now records Composio, OpenClaw/Railway, MCP v1 transport, Electron/macOS permission, Full Disk Access, UI reference, and research-gap anchors for downstream implementation.
- Completed task `121`: `test/ui-baseline-smoke.test.js` captures deterministic Home, Settings, Integrations, and voice dock/start screenshots under `tasks/artifacts/post-mvp-ui-baseline/`, with viewport, selector, and nonblank PNG checks.
- Completed task `122`: `tasks/artifacts/mac-access-trust-contract.md` defines Trusted Mac Access, Full Disk Access, trusted-write override, read/write/destructive/control separation, and fail-closed rules for Composio, MCP, Apple Calendar, file tools, screenshots, and OS control.
- Completed task `123`: `tasks/artifacts/settings-ia-contract.md` defines the approved sidebar order, Settings Overview/detail model, Integrations Overview/detail model, Custom MCP placement, Composio Actions Hub placement, and theme/treatment/density preservation.
- Independent orchestrator gates passed: `node --test test/ui-baseline-smoke.test.js` (1/1), `npm run check` (174 files), full `node --test` (542/542, no skips/failures), WAL parse (`282` entries), task-artifact privacy scan, and `git diff --check`.
- Released all Wave 17 active claims and updated `tasks/OVERVIEW.md` counts to `pending=23`, `in-progress=0`, `completed=70`, `blocked=6`.
- Appended a final physical-tail WAL checkpoint after terminal wording cleanup; WAL parse now passes with `283` entries.

## 2026-06-03 — Wave 17 reviewer gate

- Reviewer gate passed with no blocking findings.
- Advisory warning recorded: Wave 18 has same-wave dependencies (`131` after `126`, `135` after `131`), so future dispatch must respect dependency order instead of starting all seven tasks at once. `tasks/waves/wave-18.md` now makes the initial eligible set and serial follow-ons explicit.
- Advisory warning recorded: the Wave 17 voice baseline artifact is named `voice-dock-start` while it captures the idle dock state. This remains non-blocking because tasks `142` and `144` own Starting/Listening/Error voice coverage.

## 2026-06-03 — Wave 17 advisor gate

- Advisor gate passed with no blocking findings.
- Advisor confirmed Wave 17 stayed inside research/proof/contract scope, with no implementation drift into UI, Composio, MCP, or Mac access behavior.
- Advisor confirmed task contracts are adequate for downstream waves and bookkeeping is consistent at `pending=23`, `in-progress=0`, `completed=70`, `blocked=6`, with empty active claims.
- Advisory warning recorded: all untracked Wave 17 outputs must be staged before PR so artifacts and task files are included in the branch.

## 2026-06-03 — Wave 17 PR and CodeRabbit

- Opened PR #21 (`wave-17` -> `main`) after reviewer and advisor gates passed.
- Requested CodeRabbit review with `@coderabbitai review`.
- CodeRabbit acknowledged the request and began processing the PR; its status was `PENDING` with no actionable findings available at merge-decision time. Per wave protocol, CodeRabbit is advisory-only and does not block merge.
- The repo does not have `codex` or `codex-automation` labels, so no automation labels were applied.

## 2026-06-03 — Wave 18 started

- Cut clean branch/worktree `wave-18` from `origin/main` at `2ae0d69` because the primary checkout is dirty/behind and must remain untouched.
- Baseline gates before implementation passed after `npm install` restored the fresh worktree dependencies: `npm run check` and full `node --test` (542/542).
- Ran the required initial kencode-search pass before implementation. Curated UI/source searches and literal anchors for `aria-current`, `safeStorage`, and `RTCPeerConnection` did not return reusable snippets; downstream workers must re-run kencode-search against exact task symbols and use Wave 17 contracts plus local Leena source as authoritative context where public search is empty.
- Moved initial eligible Wave 18 tasks `124`, `125`, `126`, `133`, and `142` from `pending/` to `in-progress/` at `2026-06-03T22:05:26Z`; attempts set to `1`.
- Opened active file claims for the disjoint first-pass write sets. Shared `src/renderer/leena.css`, `src/main.js`, and `src/preload.js` integration remains serialized; task `131` waits on terminal `126`, and task `135` waits on terminal `131`.

## 2026-06-03 — Wave 18 initial tasks completed

- Completed task `124`: Chat is now the second sidebar route, has a non-empty `renderChat()` screen, and shell tests cover approved sidebar order, active state, `aria-current`, and screen rendering.
- Completed task `125`: theme-aware orb, traffic-light, command-shadow, and Home grid visual tokens were refined; token/orb tests were expanded and UI baseline screenshots refreshed.
- Completed task `126`: Settings now renders reusable overview cards, detail sections, rows, fields, segmented controls, toggles, selects/inputs, buttons, and status callouts while preserving existing settings bridge keys.
- Completed task `133`: Composio credential storage now uses protected safeStorage-style persistence with redacted status/save/clear/test-stub handlers and parent-serialized preload bridge exposure.
- Completed task `142`: voice startup now has staged preflight states, stable visible failure UI, Retry/Open Settings/Configure Provider actions, and guarded resource cleanup.
- Independent parent gates passed: output existence checks, changed-file `node --check`, focused Wave 18 tests (84/84), UI baseline harness (1/1), `npm run check`, full `node --test` (559/559), and `git diff --check`.

## 2026-06-03 — Wave 18 task 131 started

- Moved task `131` from `pending/` to `in-progress/` at `2026-06-03T22:27:04Z`; attempts set to `1`.
- Opened active claims for `src/renderer/screens/integrations.js`, `src/renderer/leena.css`, `test/integrations-screen.test.js`, and `test/integrations-screen-data.test.js`.
- Required pre-code kencode-search for the exact local `data-integrations-action` anchor returned no external snippets, so the worker must rely on task 120/123 contracts plus local Integrations source and still run task-local searches before implementation.

## 2026-06-03 — Wave 18 task 131 completed

- Completed task `131`: Integrations now opens as a Composio-first overview/detail shell with Custom MCP scoped to its own advanced detail panel, Apple Calendar and Files/Full Disk Access cards, and Provider Health metrics while preserving the existing MCP server list/actions.
- Independent parent verification passed: `npm run check`, focused integration tests (10/10), UI baseline harness (1/1), full `node --test` (561/561), and `git diff --check`.
- Released task `131` active claims and updated `tasks/OVERVIEW.md` counts to `pending=17`, `in-progress=0`, `completed=76`, `blocked=6`.
- Task `135` is now eligible because `131` is terminal.

## 2026-06-03 — Wave 18 task 135 started

- Moved task `135` from `pending/` to `in-progress/` at `2026-06-03T22:45:12Z`; attempts set to `1`.
- Opened active claims for Integrations, OS permission definitions, onboarding permission copy, integration CSS, and focused permission/integration tests.
- Required kencode-search for Electron/macOS permission UI/code anchors returned no reusable external implementation snippets, so implementation must use the task 122 trust contract and current Leena source/tests as the authority.

## 2026-06-03 — Wave 18 task 135 completed

- Completed task `135`: Integrations now includes Mac Access cards for Microphone, Screen Recording, Accessibility, Full Disk Access, Apple Calendar, and Files with detected status labels, scoped Request/Open Settings actions, and no silent-grant copy.
- Parent fixed the initial UI baseline height regression by making the nine-card marketplace a single-row horizontal strip; the live MCP list now remains inside the proof viewport.
- Independent parent verification passed: changed-file `node --check`, `npm run check`, focused integration/onboarding/permission tests (28/28), UI baseline harness (1/1), `git diff --check`, and full `node --test` (565/565).
- Released task `135` active claims and updated `tasks/OVERVIEW.md` counts to `pending=16`, `in-progress=0`, `completed=77`, `blocked=6`. Wave 18 implementation tasks are terminal.

## 2026-06-03 — Wave 18 reviewer-fix started

- Reviewer gate found a blocker: Settings identity controls were clipped in the refreshed baseline because the identity panel gained a second row of controls while retaining compact panel sizing and clipped overflow.
- Opened reviewer-fix claims at `2026-06-03T23:10:32Z` for Settings renderer/CSS, focused Settings/UI-baseline tests, and refreshed Settings baseline artifacts.
- Ran required kencode-search before code; public examples reaffirmed the simple pattern of constrained scroll/overflow surfaces, while the local fix must follow Leena's existing panel and baseline contracts.

## 2026-06-03 — Wave 18 reviewer-fix completed

- Fixed the reviewer blocker by wrapping identity controls in an explicit `.settings-identity__fields` band and giving the Settings identity panel a stable two-row height so name, persona, and tone controls are visible in the baseline viewport.
- Added UI baseline required selectors for `[data-agent-name]`, `[data-persona-select]`, and `[data-persona-tone]`; refreshed `tasks/artifacts/post-mvp-ui-baseline/settings.png` and manifest.
- Independent gates passed after the reviewer fix: changed-file `node --check`, `npm run check`, focused Settings tests (16/16), UI baseline harness (1/1), `git diff --check`, and full `node --test` (565/565).
- Released reviewer-fix claims; active claims are empty.

## 2026-06-03 — Wave 18 reviewer gate passed

- Re-review confirmed the Settings clipping blocker is fixed in `tasks/artifacts/post-mvp-ui-baseline/settings.png`.
- Reviewer found no remaining blocking findings in Wave 18.
- Non-blocking warnings recorded: Composio test connection is still a credential-present stub rather than live SDK validation, and Full Disk Access/Apple Calendar/Files cards are guided/settings capabilities until later status adapter tasks wire real detection.

## 2026-06-03 — Wave 18 advisor gate passed

- Advisor passed Wave 18 with no merge blockers.
- Advisor confirmed Wave 18 scope is aligned and downstream implementation remains assigned to later tasks: Composio refresh (`134`), Full Disk Access status (`136`), Apple Calendar adapter (`137`), file policy (`138`), Chat workspace/history (`140`/`141`), and screenshot regression matrix (`144`/`145`).
- Non-blocking warnings carried forward: Composio `testConnection` remains credential-present stub status until task `134`, and Full Disk Access/Apple Calendar/Files are guided capabilities until tasks `136`-`138`.

## 2026-06-03 — Wave 18 final pre-PR gates

- Final gates passed before staging: `npm run check`, `node --test` (565/565), `git diff --check`, WAL JSON parse, overview count audit, active-claim audit, and task-artifact privacy scan.
- Overview count audit matched filesystem truth: `pending=16`, `in-progress=0`, `completed=77`, `blocked=6`.
- Active claims are empty; Wave 18 is ready for PR creation and advisory CodeRabbit request.

## 2026-06-03 — Wave 18 PR and CodeRabbit

- Opened PR #22 (`wave-18` -> `main`) after reviewer and advisor gates passed.
- Requested CodeRabbit review with `@coderabbitai review`; CodeRabbit acknowledged the command and started processing run `43490940-5a8e-4cff-a84e-8c784b4f7fd4`.
- No actionable CodeRabbit findings were available at merge-decision time. Per wave protocol, CodeRabbit is advisory-only and does not block merge.
- The repo does not have `codex` or `codex-automation` labels, so no automation labels were applied.

## 2026-06-04 — Wave 19 started

- Created a clean Wave 19 worktree from `origin/main` commit `6947d44e7f2fdddcbd30dee34e981f25e3b772ef` because the primary checkout is dirty and behind remote truth.
- Baseline gates passed before task work: `npm run check` and full `node --test` (565/565).
- Required pre-code kencode-search was attempted through the MCP-backed curated reference map for Wave 19 UI, MCP/Composio, macOS permission, Apple Calendar, chat, and orb slices; no exact reusable curated references matched, so local Wave 17/18 contracts and source remain authoritative.
- Moved tasks `127`, `132`, `134`, `136`, `137`, `140`, and `143` to `in-progress` with `attempts=1`, updated overview counts to `pending=9`, `in-progress=7`, `completed=77`, `blocked=6`, and wrote WAL `pre_run` entries.
- Opened active file claims for all seven task slices. Shared `src/renderer/leena.css`, `src/main.js`, and `src/preload.js` are reserved for serialized parent integration after workers finish.


## 2026-06-04 — Wave 19 tasks completed

- Completed tasks `127`, `132`, `134`, `136`, `137`, `140`, and `143`; moved task files to `tasks/completed/` and released active claims.
- Parent integration completed shared `src/renderer/leena.css`, `src/main.js`, and `src/preload.js` wiring for Settings viewport proof, Composio live MCP refresh, and Full Disk Access status.
- Independent gates passed before terminal bookkeeping: `npm run check`, focused task gates, UI baseline harness, output existence checks, and full `node --test` (596/596).
- Next gates pending: advisor gate, CodeRabbit advisory PR request, and merge to `main`.

## 2026-06-04 — Wave 19 advisor schema fix

- Local advisor review found the Apple Calendar create tool schema still required local planner `description`, `date`, and `time` even though the Apple adapter path uses `startDate` and `endDate`.
- Fixed `add_calendar_item` schema to require only shared `title`, kept local planner field requirements in runtime validation, and added Apple create/schema regression coverage.
- Focused gate passed: `node --test test/apple-calendar-adapter.test.js test/tool-schemas.test.js test/all-tools-functional.test.js` (17/17).

## 2026-06-04 — Wave 19 reviewer blockers fixed

- Reviewer blocker 1: Apple Calendar was schema-visible but had no live main-process permission runtime. Fixed by adding Calendar-specific TCC status detection, adding Apple Calendar to permission snapshots, and passing `appleCalendar.permissionStatus` into realtime tool execution.
- Reviewer blocker 2: Custom MCP HTTP headers were parsed by the UI but dropped by IPC/store normalization. Fixed by preserving validated headers through MCP IPC, persisted server storage, temporary test connections, and the HTTP client transport; stdio transport changes clear headers.
- Focused reviewer-fix gate passed: `node --test test/mcp-server-store.test.js test/mcp-ipc-handlers.test.js test/e2e-mcp-connect.test.js test/integrations-screen.test.js test/wave19-integration.test.js` (33/33).
- Static check passed after the fixes: `npm run check`.

## 2026-06-04 — Wave 19 reviewer re-check blocker fixed

- Reviewer re-check found the Apple Calendar runtime status was still passed as a top-level `appleCalendar` option, while `executeRealtimeTool` forwards only `options.planner` to planner tools.
- Fixed the runtime handoff by nesting the live Calendar permission under `planner.appleCalendar` in `src/main.js` and tightened the Wave 19 integration test to assert that exact dispatcher path.
- Focused Apple Calendar gate passed: `node --test test/wave19-integration.test.js test/apple-calendar-adapter.test.js` (13/13).
- Full gates passed after the re-check fix: `npm run check` and `node --test` (600/600).

## 2026-06-04 — Wave 19 final reviewer blockers fixed

- Final reviewer found two remaining blockers before PR: stale git index/untracked files and a too-narrow Calendar status probe that checked only the system TCC database.
- Fixed Calendar status by moving the runtime detection into `src/os-permissions-main.js`, checking both user and system TCC databases, and keeping unreadable/write-only states fail-closed.
- Fixed the non-blocking MCP header parity warning by applying the same HTTP token-name validation in direct MCP IPC and server-store persistence paths.
- Gates passed after the final fixes: focused reviewer-fix tests (39/39), `npm run check`, full `node --test` (605/605), WAL parse, count audit, privacy scan, and `git diff --check`.

## 2026-06-04 — Wave 19 advisor security blocker fixed

- Advisor gate blocked merge because Custom MCP HTTP headers can contain bearer tokens but were stored as ordinary JSON server config and returned to renderer state.
- Fixed the storage boundary by requiring protected storage for persisted non-empty MCP HTTP headers, storing encrypted header payloads with only header names visible, redacting headers in MCP IPC list/add/update responses, and keeping decrypted values only on main-process connect/auto-connect paths.
- Also aligned MCP change broadcasts with the existing preload subscription channel `mcp:status-changed` so post-add/update/remove/connection refreshes are not stale.
- Focused security gate passed: `node --test test/mcp-server-store.test.js test/mcp-ipc-handlers.test.js test/e2e-mcp-connect.test.js test/composio-integration.test.js test/mcp-integration.test.js` (31/31).
- Static check passed after the fix: `npm run check`.

## 2026-06-04 — Wave 19 reviewer IPC redaction gaps fixed

- Final reviewer re-pass found two remaining IPC leak paths: `mcp:update-server` with an empty update returned an already-decrypted existing server, and `mcp:test-connection`/connect failures could echo bearer material in renderer-visible error messages.
- Fixed the handler boundary so empty updates return `redactServerForRenderer(existing)` and MCP handler errors pass through `redactSensitiveText` before reaching renderer-visible return values or thrown errors.
- Added regressions for both reproduced leaks in `test/mcp-ipc-handlers.test.js`.
- Final local gates passed after the fix: `npm run check`, `node --test` (606/606), `git diff --check`, and task-artifact privacy scan.

## 2026-06-04 — Wave 19 direct list-tools redaction fixed

- Reviewer re-pass found one direct IPC leak path still open: `mcp:list-tools` called the MCP client manager directly, so a client error containing `Authorization: Bearer ...` could be thrown to the renderer without sanitizer coverage.
- Fixed `listTools` to sanitize thrown errors with the same renderer boundary helper used by connect/test paths and added a direct list-tools regression in `test/mcp-ipc-handlers.test.js`.
- Final local gates passed after the fix: focused MCP handler test (12/12), `npm run check`, `node --test` (606/606), `git diff --check`, WAL parse, count audit, and task-artifact privacy scan.

## 2026-06-04 — Wave 19 terminal reviewer edges fixed

- Final reviewer/advisor edge checks found stale terminal evidence plus three direct-boundary issues: conflicting Apple Calendar TCC rows could grant after denial, blank Custom MCP header values could pass direct IPC/store validation, and MCP execution error text needed the same secret-header redaction coverage as IPC errors.
- Fixed Calendar denial precedence, rejected blank MCP header values after trimming, extended `redactSensitiveText` to cover secret `Header: value` diagnostics, and added focused regressions across Calendar, MCP IPC/store, MCP execution, Composio permission metadata, and generic error redaction.
- Terminal local gates passed after the fix: focused Calendar/MCP gate (38/38), `npm run check`, full `node --test` (607/607), and the final bookkeeping/audit pass is recorded in WAL.

## 2026-06-04 — Wave 19 reviewer and advisor gates passed

- Independent reviewer gate passed with no blockers after checking the Wave 19 diff, MCP redaction/protected-storage paths, task counts, active claims, WAL JSON, and privacy scans.
- Advisor gate passed with no merge blockers after verifying MCP tool execution redaction, credential-header redaction, Composio permission metadata stripping, Apple Calendar runtime nesting, Settings router, Full Disk Access, Chat shell, and orb theming.
- Final pre-PR gates passed: `npm run check`, focused MCP/redaction suite (49/49), full `node --test` (607/607), `git diff --check`, WAL parse, count audit, active-claim audit, and task-artifact privacy scan.

## 2026-06-04 — Wave 19 PR and CodeRabbit advisory recorded

- Opened PR #23 from `wave-19` to `main` after reviewer and advisor gates passed.
- Requested CodeRabbit review on PR #23; CodeRabbit acknowledged the request and began processing. No actionable CodeRabbit findings were available at merge-decision time, so the advisory gate is recorded as requested/in-progress and non-blocking.
- Checked for `codex` and `codex-automation` labels; neither label exists in this repo, so no PR labels were applied.

## 2026-06-04 — Wave 20 started

- Created clean branch/worktree `wave-20` from `origin/main` commit `c4c056c2dd8d7a3030feafa6d34d73c0aaf6365c` because the primary checkout is dirty and behind remote truth.
- Installed dependencies in the fresh worktree and verified the baseline before task work: `npm run check` passed and full `node --test` passed 607/607.
- Required pre-code kencode-search was attempted for compact Settings detail patterns, Electron updater state anchors, trusted file access policy, and Chat memory history anchors. No exact reusable public snippets matched the local Leena contracts; Wave 17-19 contracts and source remain authoritative.
- Moved Wave 20 tasks `128`, `129`, `130`, `138`, and `141` to `in-progress` with `attempts=1`, updated overview counts to `pending=4`, `in-progress=5`, `completed=84`, `blocked=6`, and wrote WAL `pre_run` entries.
- Opened active file claims for all Wave 20 slices. Shared `src/renderer/screens/settings.js`, `src/renderer/leena.css`, and `test/settings-screen.test.js` are reserved for serialized Settings integration across tasks `128`-`130`; file policy and Chat work are independent.

## 2026-06-04 — Wave 20 tasks completed

- Completed tasks `128`, `129`, `130`, `138`, and `141`; moved task files to `tasks/completed/`, released active claims, and updated overview counts to `pending=4`, `in-progress=0`, `completed=89`, `blocked=6`.
- Parent integration preserved existing theme values, fixed Providers and Updates detail flows, enforced file access scope policy, wired Chat history/detail/send behavior, and added Chat to the post-MVP screenshot baseline.
- Fixed two parent verification issues: Chat inherited the Settings first-card grid span, then inherited command-center `.chat-input` CSS; both now have Chat-scoped layout overrides.
- Fixed file policy runtime reachability by passing the audited Full Disk Access status into main-process filesystem tool options.
- Reviewer initially blocked on Chat overlap below the 920px breakpoint; fixed by stacking the Chat rail and workspace on separate rows and keeping the composer three-column placement under the breakpoint.
- Terminal gates passed after reviewer fix: `npm run check`, full `node --test` (623/623), `node --test test/ui-baseline-smoke.test.js`, changed-file syntax checks, and `git diff --check`.
- Reviewer re-check passed with no blockers after independently verifying the narrow Chat fix. Non-blocking risk recorded: coverage exercises one narrow viewport, not every boundary/minimum width.
- Advisor gate passed with no merge blockers after reviewing Settings detail preservation, file policy and Full Disk Access runtime handoff, Chat history/detail/narrow layout coverage, task counts, empty active claims, WAL, and privacy hygiene.
- Opened PR #24 from `wave-20` to `main`, requested CodeRabbit review, and received CodeRabbit acknowledgement/processing status. No actionable CodeRabbit findings were available at merge-decision time, so the advisory gate is recorded as requested/in-progress and non-blocking.
- Checked for `codex` and `codex-automation` labels; neither label exists in this repo, so no PR labels were applied.
- Next gate pending: merge to `main`.

## 2026-06-04 — Wave 21 baseline repaired and started

- Created clean branch/worktree `wave-21` from `origin/main` commit `6433e9d` because the primary checkout is dirty and behind remote truth.
- Installed dependencies in the fresh worktree.
- Baseline `npm run check` passed, but baseline `node --test` initially failed one date-sensitive Activity render assertion after midnight/date drift. Fixed by threading the existing fixed clock through `renderActivityData` test data to `groupConversationsByDate`.
- Required pre-code kencode-search was run before the baseline repair; no exact public snippet matched the local Activity selector.
- Post-repair gates passed: `node --test test/conversation-history.test.js`, `npm run check`, and full `node --test` (623/623).
- Moved Wave 21 tasks `139` and `144` to `in-progress` with `attempts=1`, updated overview counts to `pending=2`, `in-progress=2`, `completed=89`, `blocked=6`, wrote WAL `pre_run` entries, and opened active file claims.
- Dispatched task `139` for central permission confirmation UX and task `144` for screenshot regression proof. Task `144` must coordinate with task `139` for permission-prompt screenshot states and must not edit claimed permission runtime files.

## 2026-06-04 — Wave 21 tasks verified complete

- Completed task `139`: central permission confirmation UX now models allowed/confirm/blocked states, blocks unknown/stale metadata visibly, preserves Apple Calendar trust-source metadata, and renders confirmation/blocked copy in chat and voice surfaces.
- Completed task `144`: post-MVP UI regression harness now captures 16 screenshot artifacts plus manifest metadata for Home, Chat, Settings details, Integrations details, and voice starting/listening/error states.
- Parent visual spot-checks covered Home, Settings Providers, Chat, and voice Listening. Parent gates passed: `npm run check`, focused permission suite (37/37), focused UI screenshot suite (2/2), design/shell/UI focused suite (10/10), changed-file syntax checks, `git diff --check`, and full `node --test` (631/631).
- Released Wave 21 file claims, moved tasks `139` and `144` to completed, and updated overview counts to `pending=2`, `in-progress=0`, `completed=91`, `blocked=6`.
- Reviewer gate passed with no blockers after reviewing permission UX, renderer boundaries, Apple Calendar trust-source preservation, MCP fail-closed behavior, screenshot artifacts, and bookkeeping. Non-blocking risks recorded: screenshot proof is selector/nonblank/overflow-based rather than pixel-golden, and renderer permission display duplicates central permission concepts to avoid Node-only imports.
- Advisor gate passed with no blockers after reviewing product fit, safety posture, privacy, architecture, and integration contracts. Non-blocking warnings recorded: screenshot regression is not pixel-golden, renderer permission display must stay in sync with central permission concepts, and permission-prompt-specific screenshot artifacts remain outside this suite.
