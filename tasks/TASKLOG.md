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
