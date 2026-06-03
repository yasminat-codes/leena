# Leena — Build Learnings (read before every wave, append after every fix)

**This file is a non-negotiable part of the build loop.** Every wave's agents MUST read this file *before* starting work, and MUST append new entries *after* any fix that worked. The goal: never repeat a mistake twice across waves.

## How to use this file

**BEFORE a wave starts** (every agent in the wave):
1. Read this entire file.
2. Read the `## Active Rules` section — these are hardened rules distilled from past fixes. Follow them.
3. Scan `## Wave Log` for entries tagged with files/subsystems you're about to touch.

**WHEN a fix works** (WAL checkpoint — stop, document, continue):
1. The moment a non-trivial fix makes a failing gate pass, STOP.
2. Append a `### Fix` entry to the current wave's section (template below).
3. If the fix reveals a general rule, also add/update a bullet in `## Active Rules`.
4. Resume work.

**AFTER a wave completes** (wave summary):
1. Append a `## Wave NN — summary` block: what was built, what broke, what was learned, time/retry stats.
2. Promote any recurring pattern (seen ≥2×) into `## Active Rules`.

---

## Active Rules (hardened — always apply)

> These start as the project's known constraints. Agents add to them as fixes accumulate.

- **kencode-search FIRST.** Before writing any new code, query the `kencode-search` MCP for production-ready implementations and to pull the FULL context of every file you'll modify. Never reinvent code that a vetted library/snippet already solves. If you have not pinpointed every section/place/symbol you need for context, search again before coding.
- **Never break current functionality.** The app already works as "Brah." Run the existing test suite (`node --test`) before and after every task. A passing-before / failing-after test = regression = the task is not done.
- **Simplest thing that works.** No over-engineering. If a simpler approach yields the same result, take it. Complexity is only acceptable when genuinely required. But it must *work* — never compromise correctness for brevity or vice-versa.
- **Match existing conventions.** Read neighboring files, `CLAUDE.md`, `biome.json`. Comment density, naming, and idiom must match surrounding code.
- **Provider primacy.** OpenAI API key is the primary voice + chat path for distribution; OAuth/subscription is an optional fallback only. OpenRouter and Ollama are additional selectable providers. Ollama models are user-downloadable on demand.
- **`node:sqlite` only** for storage (no better-sqlite3). Use the existing `database.js` patterns and `withTempDir` + `closeDatabase` test helpers.
- **Native addons stay in `asarUnpack`** (`@nut-tree-fork/**`, onnxruntime native bits).
- **Tests are mandatory, not optional.** No task is complete without the tests named in its `## Tests Required`, and they must pass. E2E coverage for any user-facing flow.
- **Sub-agent completion reports are NOT evidence — verify on disk.** A dispatched agent returning "done" (even with high token/tool-use counts) may have written nothing, done adjacent work, or hallucinated a summary. After ANY dispatched agent: independently confirm the named output files exist, `git status --porcelain`/`git diff` is non-empty, and re-run `npm run check` + `node --test` yourself before trusting the result. *(Evidence: on 2026-06-01, three sub-agents reported success — `wave-writer`/`wave-writer2`/`ollama-model-download` — and two had written nothing; the wave files were claimed-written and were absent. Caught only by an on-disk `ls` count.)*
- **Verify the exact worktree path, not just filenames.** A worker can produce correct-looking output in the wrong checkout. Completion verification must test the requested worktree path explicitly before marking a task complete.
- **Verify content, not just structure.** File counts, section-header presence, and dependency-graph parity all pass even when section bodies are placeholder/hollow. Body-level verification (non-trivial content per section, numbered Steps, named test paths, atomicity cap) is mandatory for any generated artifact — a `wc -l` + `grep` pass is not enough.
- **Approval-gate visuals must pass owner taste, not just automated audits.** For Leena's desktop shell, avoid presentation-scale type and saturated AI-gradient wallpaper: default to desktop-app density, 11-14px operational text, restrained 16-22px headings, tight rows, smaller HUDs, and subdued work-surface backgrounds.
- **Refine composition before ornament.** For Leena approval screens, the assistant identity must live in one intentional command surface. Avoid scattering the greeting, orb, chat affordance, and command center across generic cards; use whitespace, quiet dividers, and nested hardware-like surfaces before adding decoration.
- **Keep orb and prompt in separate visual lanes.** On approval surfaces, the orb may be adjacent or ambient, but it must not sit directly above or over the command input. Use a dedicated orb well or integrated control composition so the prompt remains the primary action.
- **Default shell must not read as purple AI-template UI.** The default approval theme should feel graphite, neutral, precise, and product-grade. Keep violet/purple out of the default dark wallpaper/orb/primary surfaces; reserve color for tiny state accents and avoid broad saturated glow.
- **Reference-derived appearance changes must become first-class token modes.** When owner feedback supplies a strong material reference, encode it as an explicit theme/treatment/default if the reference changes the product model; do not keep layering cosmetic tweaks onto the rejected mode.
- **Decorative geometry still uses named radius tokens.** Even abstract pseudo-elements and background shapes must use `--r-*` tokens for `border-radius`; if a new shape needs a new radius, add a named token instead of a literal runtime value.
- **Off-white dominance means paper owns the shell.** If the owner says the dominant color should be off-white, teal/dark accents must not own the wallpaper, side rail, topbar, or major orb well. Keep strong teal to selected controls, active states, small marks, and subtle sculptural accents.
- **Measurement spikes must not invent metrics.** For wake-word, model, audio, latency, or accuracy spikes, block with a usable harness and exact missing assets instead of reporting synthetic FA/FR/latency numbers.
- **Packaged runtime assets outside `src/` must be explicitly included.** If main-process code loads assets from `build/` or another non-source directory, add that path to electron-builder `build.files` and verify it inside `app.asar` after packaging.
- **Renderer-exposed memory reads must be bounded at every layer.** Clamp recall/history limits in IPC handlers and in the store itself; do not rely on renderer callers to pass safe pagination values.
- **Async renderer refreshes must reject stale results.** Backend generation guards are not enough if older renderer promises can still publish late UI state; guard each publish path that can overlap.
- **Identity/profile mutations must broadcast runtime invalidation.** Persona/profile changes need a durable `data:changed` path so prefetched realtime secrets and active session updates cannot keep using stale persona instructions.

---

## Wave Log

> Append below. Newest wave at the bottom. Never delete entries.

### Fix — Wave 07 — integration — Provider registry and Tasks live-refresh completion
- **Symptom:** Individual workers completed their slices, but the provider registry remained unintegrated and the Tasks worker left tab-refresh wiring as a follow-up because `shell.js` was outside its ownership.
- **Root cause:** Wave 07 intentionally serialized shared files (`src/providers/index.js`, shell integration tests) to avoid provider-worker conflicts, so acceptance criteria depending on shared integration could not be satisfied inside the isolated workers.
- **Fix:** Orchestrator integration added `registerDefaultProviders()` coverage for OpenAI/OpenRouter/Ollama, wired `refreshTasksScreen()` from `src/renderer/shell.js`, removed production Tasks fixture exports, updated renderer tests, and re-ran focused plus full gates.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 07 — reviewer — Dynamic provider candidates and MCP side-effect retries
- **Symptom:** Reviewer found Ollama could be registered yet excluded from synchronous `getForCapability("chat")` before a health/model probe, and MCP `callTool()` retried by default even though MCP tools can perform side effects.
- **Root cause:** Provider routing used `supports()` only, which is a last-known-health flag for dynamic providers, and MCP retry defaults treated tool invocation like connection setup.
- **Fix:** Added `BaseProvider.canProvide()` and an Ollama override so registry lookups can include dynamic-capability candidates without changing the health-derived `supports()` summary; changed MCP `callTool` default retry attempts to 1 with explicit opt-in retry coverage for idempotent calls.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 07 — advisor — Provider contract unification
- **Symptom:** Advisor blocked Wave 07 because provider chat streaming shapes diverged, OpenAI lacked the downstream `getModels()` contract, and Ollama advertised TTS/STT even though speech execution is not implemented.
- **Root cause:** Provider workers implemented endpoint-specific behavior without one final pass over the downstream selector/router contracts.
- **Fix:** Normalized streaming chunks to `{ content, delta, model, finishReason?, usage? }`, added tagged OpenAI model metadata via `getModels()`, and kept Ollama speech out of `canProvide()`/`supports()`/model capabilities until executable support exists.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 07 — advisor — OpenRouter embedding model metadata
- **Symptom:** Advisor blocked Wave 07 because OpenRouter advertised embeddings but `getModels()` filtered out embedding-only models, leaving downstream embedding selectors empty.
- **Root cause:** The OpenRouter model catalog normalization filtered for chat-capable text-output models only.
- **Fix:** `getModels()` now returns both chat and embedding-capable models with per-model capability tags; embedding-only models are marked `chat: false, embeddings: true`. Updated the OpenRouter model-list test and aligned stale auth-governance prose with ADR-9.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

## Wave 07 — summary
- Completed Band B Wave 07 after owner approval: auth decision documentation, OpenAI/OpenRouter/Ollama providers, memory/MCP/wake interfaces, and Tasks live-data wiring.
- Provider default registration is now centralized in `src/providers/index.js`; future provider work should integrate shared registry changes after concrete provider workers finish, not during parallel worker edits.
- Provider stream consumers can depend on unified streaming chunks across OpenAI, OpenRouter, and Ollama; provider model selectors can call `getModels()` on all three concrete providers.
- Advisor warnings to carry forward: Task 056 should define terminal stream metadata semantics, OpenRouter model caches should not be mutated by consumers, and MCP user-config wiring must add allowlist/encrypted secret handling before renderer exposure.
- Tasks live-data rendering now treats synchronous render as an empty safe state and refreshes asynchronously through the existing `window.brah.getPlannerTasks()` / `getCalendarItems()` bridge on Tasks navigation.
- Independent gates passed: `npm run check`, focused provider/tasks/shell tests, full `node --test` (266 tests after advisor-fix coverage), `node --check` on integration files, WAL JSON parse, and `git diff --check`.
- CodeRabbit advisory review was requested on PR #8. It posted generated "Review triggered" / "review in progress" comments and a pending advisory status at merge-decision time, with no actionable findings available; this did not block merge.

### Fix — Wave 08 — integration — Realtime no-provider message contract
- **Symptom:** The provider integration test expected `NO_REALTIME_PROVIDER` message text without a trailing period, while the shared main-process integration returned a period-suffixed string.
- **Root cause:** The integration handler was written before the task 055 fixture finalized the exact structured-error contract.
- **Fix:** Aligned `createNoRealtimeProviderResponse()` to return `Configure an OpenAI API key to use voice mode` exactly and reran focused auth/realtime/MCP tests.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 08 — reviewer — MCP namespace and wake harness hardening
- **Symptom:** Reviewer found MCP namespacing was not reversible for server/tool names containing separators or unsafe characters, the wake harness could accept an undersized corpus, and the git index still contained stale task moves.
- **Root cause:** The first converter used a delimiter-only namespace contract, the spike harness validated WAV format but not measurement volume, and final staging had not yet reconciled `git mv` state after terminal bookkeeping.
- **Fix:** Added reversible encoded namespace segments that preserve the public `mcp__{serverId}__{toolName}` contract for safe names, required at least one hour of ambient WAVs plus 50 positive clips before wake metrics can pass, updated task wording to match truncation behavior, and made final `git add -A` a required pre-commit step.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

## Wave 08 — summary
- Completed tasks `031`, `055`, and `082`; blocked task `091` honestly because no trained `hey-lena.onnx`, one-hour ambient corpus, or 50-utterance positive corpus exists.
- API-key auth now uses `openai:save-api-key`, `openai:get-auth-type`, `window.brah.saveApiKey`, and `window.brah.getAuthType`; API-key credentials use `refreshToken: null` plus a JSON-safe non-refreshing expiry sentinel.
- Realtime session creation now goes through the provider layer. `realtime:create-session` is the new channel, and `openai:create-realtime-secret` remains a deprecated alias for compatibility.
- MCP schema conversion now has a standalone converter for sanitization, namespacing, reverse parsing, and static+MCP tool merging; downstream tasks 083/085 should wire it into permission checks and execution routing.
- Wake-word work remains decoupled from the deliverable path. Task 092 must wait for measured wake results or use the documented Porcupine/hotkey-only fallback.
- Reviewer blockers were fixed before merge: stale index reconciliation, unsafe MCP namespace round-trip handling, and wake harness minimum-corpus enforcement.
- Independent gates after reviewer fixes passed: `npm run check`, full `node --test` (282 tests), `node --check`, wake harness compile/help, undersized-corpus negative probe, WAL JSON parse, and `git diff --check`.
- CodeRabbit advisory was requested on PR #9. It selected all 19 changed files but could not start a substantive review due to review-rate and usage-credit limits, then posted no actionable code findings; local reviewer/advisor gates remained authoritative.

### Fix — Wave 06 — 021 — Desktop visual scale repair after owner rejection
- **Symptom:** Owner rejected Phase 0 approval: fonts were too big, the design was not refined, and the UX did not feel like a mature desktop app.
- **Root cause:** The first Phase 0 shell used presentation-scale type, saturated purple wallpaper, large cards/radii, a wide sidebar/topbar rhythm, and oversized Command Center dimensions. Automated tests verified token usage but did not encode taste-level desktop density.
- **Fix:** Tightened `src/renderer/leena.css` typography/control/radius/density tokens, subdued the default dark wallpaper and glass surfaces, stacked row title/detail text for scanability, changed Integrations from a huge poster metric to a calmer connection summary, reduced Command Center dimensions in `src/renderer/components/command-center.js` and `.css`, and refreshed screenshot artifacts under `tasks/artifacts/wave-06-visual-repair-*.png`.
- **Rule added?:** yes — Approval-gate visuals must pass owner taste, not just automated audits.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 06 — 021 — Command-surface composition repair after taste rejection
- **Symptom:** Owner still rejected the repaired shell as cheap and poorly composed; the Home screen split the greeting, orb, and chat affordance into unrelated card-like chunks.
- **Root cause:** The visual system treated Leena like a generic sidebar dashboard. The app identity was scattered across a hero card, ordinary list cards, and a separate floating command center, so shrinking fonts alone could not make it feel premium.
- **Fix:** Installed the GitHub taste skill from `Leonxlnx/taste-skill`, applied the taste/redesign audit, rebuilt Home as one nested command surface in `src/renderer/screens/home.js`, changed `src/renderer/leena.css` to a slim icon rail, hidden title chrome, quiet context sections, calmer markers, and a corrected Settings identity grid; refreshed five-screen screenshots and verified with `npm test`.
- **Rule added?:** yes — Refine composition before ornament.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 06 — 021 — Integrations header clipping
- **Symptom:** Reviewer found the committed taste-repair Integrations artifact clipped the `6 connected` approval-gate stat and hid the description line.
- **Root cause:** The compact glass header reused `.panel-glass` hidden overflow with only token padding, which left the three-line header without a stable visual height after the shell density repair.
- **Fix:** Made `.integrations-header` a non-clipping centered flex surface with a stable `min-height`, added copy padding in `src/renderer/leena.css`, added CSS regression coverage in `test/integrations-screen.test.js`, and refreshed `tasks/artifacts/wave-06-taste-repair-integrations.png`.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 06 — 021 — Orb/prompt lane and display font polish
- **Symptom:** Owner said the repair looked better but still needed much more polish, calling out the font and the top orb sitting on the chat window.
- **Root cause:** The Home command surface still placed the prompt below the full command stage, making the orb read as perched over the input, and the UlmGrotesk display token kept the greeting too rounded and toy-like for a premium desktop app.
- **Fix:** Changed the display token to Gellix in `src/renderer/leena.css`, moved the command input into the left copy column in `src/renderer/screens/home.js`, added a dedicated right-side orb well, removed the cheap top-right readiness label, updated home/CSS tests, and refreshed five screenshot artifacts under `tasks/artifacts/wave-06-polish-followup-*.png`.
- **Rule added?:** yes — Keep orb and prompt in separate visual lanes.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 06 — 021 — Purple AI-template neutralization
- **Symptom:** Owner said the design still felt vibe-coded and suspected the purple visual language; target was ultra-premium UI taste associated with X-style restraint.
- **Root cause:** The default Aurora treatment, dark wallpaper, orb, command deck, and gradient utilities still leaned on broad violet/purple glow, making the shell look like an AI template instead of a precise desktop product.
- **Fix:** Changed the default Aurora treatment to graphite/blue-neutral tokens, made the dark theme near-black with neutral text, removed purple shadows and broad radial glow from shell/card/home surfaces in `src/renderer/leena.css`, converted the orb to a restrained graphite/silver material with a tiny blue signal, and added CSS token tests that reject the old purple defaults.
- **Rule added?:** yes — Default shell must not read as purple AI-template UI.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 06 — 021 — Workspace reference token mode
- **Symptom:** Owner asked to change the entire design token direction to match a supplied dark-teal/paper workspace reference, after the graphite pass still did not feel refined enough.
- **Root cause:** The previous passes were still modifying the rejected visual language instead of creating a new material model: deep teal outer frame, warm-white working panel, mint rows, restrained pill controls, and a quiet sculptural background shape.
- **Fix:** Added `workspace` theme/treatment defaults in `src/renderer/screens/settings.js` and `src/renderer/index.html`, rebuilt the corresponding token/surface overrides in `src/renderer/leena.css`, added Workspace coverage in renderer/default tests, and refreshed five screenshot artifacts under `tasks/artifacts/wave-06-workspace-mode-*.png`.
- **Rule added?:** yes — Reference-derived appearance changes must become first-class token modes.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 06 — 021 — Workspace pseudo-element radius token gate
- **Symptom:** `node --test` failed `runtime CSS border-radius declarations use radius tokens` with `src/renderer/leena.css:536 58px`, then rejected `calc(var(--r-win) + 24px)` because runtime radius values must start with a `--r-*` token.
- **Root cause:** The new workspace abstract background shape used one-off decorative geometry that was not promoted into the design-token scale.
- **Fix:** Added `--r-sculpt: 58px` to the root radius tokens, used `border-radius: var(--r-sculpt)` for the workspace pseudo-element, added token coverage in `test/leena-css-tokens.test.js`, and reran the audit.
- **Rule added?:** yes — Decorative geometry still uses named radius tokens.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 06 — 021 — Off-white dominant Workspace hierarchy
- **Symptom:** Owner clarified that the Workspace mode's dominant color should be off-white, not the dark teal frame.
- **Root cause:** The first Workspace pass used off-white panels inside a dark teal wallpaper/chrome system, so teal still owned the first visual read.
- **Fix:** Changed the Workspace wallpaper, side rail, topbar, Home context, Activity title, and orb well in `src/renderer/leena.css` to paper/off-white surfaces with teal only as accents; updated `test/leena-css-tokens.test.js` to assert the off-white dominant shell; refreshed `tasks/artifacts/wave-06-offwhite-dominant-*.png`.
- **Rule added?:** yes — Off-white dominance means paper owns the shell.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 06 — 021 — Renderer design-token audit cleanup
- **Symptom:** The Phase 0 design audit found hardcoded renderer colors and non-token radius/font fallbacks in legacy runtime CSS, and the first radius audit draft skipped `leena.css`.
- **Root cause:** Wave 01-05 token work covered the new shell CSS first, but legacy `styles.css`, `renderer.js` canvas colors, and Command Center fallbacks still carried direct hex/radius values.
- **Fix:** Moved legacy color values behind Leena CSS tokens, changed renderer waveform colors to read CSS variables, tokenized radius/font declarations across runtime CSS, and tightened `test/design-system-audit.test.js` to scan all renderer CSS for radius declarations.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 06 — 021 — CodeRabbit hygiene cleanup
- **Symptom:** CodeRabbit flagged deprecated visually-hidden CSS and hard-coded local workstation paths in the task log.
- **Root cause:** Earlier wave bookkeeping kept absolute worktree paths, and hidden helper blocks retained the legacy `clip: rect(...)` pattern.
- **Fix:** Replaced hidden-helper blocks in `src/renderer/leena.css` with the modern `clip-path: inset(50%)` pattern and sanitized task bookkeeping local paths to safe placeholders.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 06 — 021 — Reviewer privacy path sweep
- **Symptom:** Reviewer found the CodeRabbit hygiene fix only scanned `TASKLOG.md`, leaving absolute local paths in `LEARNINGS.md` and WAL records.
- **Root cause:** The first hygiene scan was scoped to the exact CodeRabbit comment file instead of all committed task bookkeeping artifacts.
- **Fix:** Sanitized remaining local checkout paths in `tasks/LEARNINGS.md` and `tasks/.wal/wal.jsonl`, then widened the verification scan to task bookkeeping files.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 06 — 021 — CSS token test radius expectations
- **Symptom:** Full `node --test` failed in `test/leena-css-tokens.test.js` with `.dot missing border-radius: 50%` after runtime radii were moved to tokens.
- **Root cause:** The older token-foundation regression test still asserted literal circular radii for `.dot` and `.orb`, conflicting with the Wave 06 no-literal-radius audit.
- **Fix:** Updated the existing token regression test to expect `border-radius: var(--r-round)` for `.dot` and `.orb`.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

## Wave 06 — summary
- Completed Phase 0 approval-gate coverage for task `021`: shell rendering tests, design-system audit tests, token cleanup, and approval screenshot capture.
- The design audit now keeps hardcoded renderer colors centralized in `leena.css` and requires runtime CSS font/radius declarations to use tokens.
- Electron/Playwright visual sweep verified all five screens, all 18 theme/treatment/density combinations, Ctrl+D Command Center demo mode, and saved `tasks/artifacts/wave-06-phase0-approval.png`.
- Independent gates passed: `npm run check`, `node --test` (202 tests), `npm test` (202 tests), `node --check` on changed JS/test files, `git diff --check`, reviewer gate, and advisor gate.
- CodeRabbit advisory review was requested on PR #6. It posted generated in-progress/triggered comments and no actionable findings were available at merge-decision time.
- Wave 06 is ready for the single Phase 0 owner approval gate before Band B.

### Fix — Wave 05 — 020 — Visible wallpaper transition
- **Symptom:** Reviewer found theme changes could still snap because `.win` also painted `background: var(--wall)` while only `.leena` had the 200ms background transition.
- **Root cause:** The first task 020 fix covered the wrapper wallpaper but missed the visible shell wallpaper surface rule shared by `.leena-page` and `.win`.
- **Fix:** Added the same `background var(--dur-base) var(--ease-out)` transition to `.leena-page, .win` and added CSS token tests for both visible wallpaper selectors.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 04 — 018 — Wrong checkout output recovery
- **Symptom:** Command Center worker reported completion but its files were absent from `<wave-04-worktree>`; they existed under `<primary-checkout>`.
- **Root cause:** The worker wrote to the wrong checkout despite being instructed to use the wave worktree.
- **Fix:** Copied only the task-owned command-center files into `<wave-04-worktree>`, removed those worker-created untracked files from `<primary-checkout>`, and added an Active Rule to verify exact worktree paths.
- **Rule added?:** yes — Verify the exact worktree path, not just filenames.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 04 — integration — Tokenized screen styling
- **Symptom:** Full `node --test` failed after parent integration because worker tests still expected inline `style` attributes for text weight/color and avatar sizing.
- **Root cause:** Worker modules used inline token styles; parent integration moved visual rules into `leena.css`, but tests still asserted the old inline implementation detail.
- **Fix:** Added shared token classes in `src/renderer/leena.css`, removed inline styles from screen renderers, and updated tests to assert class-based styling.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 04 — 018 — Production-safe Command Center demo gate
- **Symptom:** Reviewer found `location.protocol === "file:"` enabled the Ctrl+D Command Center demo in packaged Electron, not only development.
- **Root cause:** The renderer treated URL protocol as a trust boundary even though packaged Electron loads local files too.
- **Fix:** Added main-process `app:is-development` IPC, exposed it through preload, gated the renderer demo listener on that trusted value, and added `test/dev-mode-gate.test.js`.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 04 — 017 — Exact settings appearance target
- **Symptom:** Reviewer found Settings appearance writes could target loose `.leena` or `#app-shell` fallback elements instead of the app shell wrapper contract.
- **Root cause:** The helper accepted fallback selectors after looking for the exact `#app-shell.leena` wrapper.
- **Fix:** Restricted `resolveAppearanceRoot()` to exact `#app-shell.leena` and added a regression test proving loose wrappers are ignored.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 04 — 017 — Direct-root exact settings target
- **Symptom:** Reviewer re-review found direct loose roots still mutated appearance state: a root with only `id="app-shell"` or only `.leena` passed the wrapper check.
- **Root cause:** `isLeenaWrapper()` still used `id === "app-shell" OR classList.contains("leena")` for a direct root.
- **Fix:** Changed the helper to require the exact `#app-shell.leena` selector, added direct loose-root regression coverage, and restored the task-required dark/aurora/comfortable missing-storage defaults.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

## Wave 04 — summary
- Built all six Phase 0 mock surfaces: Home, Activity, Tasks, Integrations, Settings, and the Command Center variants/states.
- Integrated screen routing through `src/renderer/shell.js` and kept reusable layout/visual treatment in `src/renderer/leena.css` rather than inline screen styles.
- Command Center demo mode must be treated like a development-only debug surface; renderer file URLs are not sufficient because packaged Electron also uses local files.
- Settings appearance controls now write only to an exact `#app-shell.leena` root, preserving the Wave 03 shell contract for theme/treatment/density attributes.
- Independent gates after reviewer re-review fixes passed: `npm run check`, `node --test` (189 tests), `node --check`, `git diff --check`, output existence checks, and short `npm start` smoke.
- Reviewer re-review and advisor gates passed. Downstream wire-live work should keep the shell route and renderer contracts stable while replacing mock data with real stores/providers.
- CodeRabbit advisory review was requested on PR #4. It posted generated "review in progress" / "Review triggered" comments and no actionable findings were available at merge-decision time.

## Wave 05 — summary
- Built live appearance persistence coverage for task `020`: shell startup restores theme, treatment, and density before first screen render, while settings writes continue to persist exact localStorage keys.
- Kept the Wave 04 exact-root setting contract: appearance writes still target only `#app-shell.leena`; loose `.leena` or `#app-shell` roots remain rejected by regression tests.
- Added 200ms wallpaper cross-fade coverage for both wrapper and visible wallpaper surfaces. Reviewer found `.win` could still snap; fixed by applying the same background transition to `.leena-page, .win`.
- Independent gates after reviewer fix passed: `npm run check`, `node --test` (194 tests), `node --check` for changed JS/test files, and `git diff --check`.
- Reviewer re-review and advisor gates passed with no blockers. Advisor bookkeeping warning was addressed by adding Wave 05 to `tasks/OVERVIEW.md`.
- CodeRabbit advisory review was requested on PR #5. It returned a rate-limit/usage-credit warning and produced no actionable findings at merge-decision time.

### Fix — Wave 03 — 012 — Exact shell icon paths
- **Symptom:** Parent verification found the first app-shell implementation used approximate Tasks, Settings, and bell SVG paths even though task 012 required inline design-system §3 icons.
- **Root cause:** The worker followed the shell layout contract but substituted visually similar icon paths instead of copying the exact source path data.
- **Fix:** Updated `src/renderer/index.html` so Tasks, Settings, and bell use the exact design-system paths, then re-ran `npm run check`, `node --test`, `node --check`, exact path scan, and `git diff --check`.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 03 — 012 — App shell window sizing
- **Symptom:** Reviewer found the 1060x712 `.win` shell was still clamped inside Electron's old 440x600 locked `panel` mode, and the Integrations grid icon still used approximate rect data.
- **Root cause:** The renderer shell was updated without updating `src/main.js` `windowModes.panel`, and the first exact-icon correction missed the `grid` icon.
- **Fix:** Changed `src/main.js` `windowModes.panel` to 1060x712 so BrowserWindow creation, min/max constraints, mode switching, and resize guard use the app-shell size; updated `src/renderer/index.html` to use the exact design-system grid rects.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 03 — 012 — Active-call waveform visibility
- **Symptom:** Reviewer re-review found `#call-wave` was inside the hidden `.legacy-controls` container, so active-call waveform drawing would not render even though `renderer.js` still writes to that canvas.
- **Root cause:** The shell preserved runtime-required legacy IDs by grouping several controls in a hidden container, but `#call-wave` is not merely a hidden compatibility control; existing `styles.css` expects it in the visible call HUD.
- **Fix:** Moved the single `#call-wave.call-wave` canvas into visible `#call-stage`, before `#call-end`, while leaving hidden compatibility controls that are not rendered in the active-call HUD.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

## Wave 03 — summary
- Built the visible Leena app shell scaffold, sidebar/topbar navigation, shell state module, bundled gradient wallpapers, and DOM-free shell navigation tests.
- Shell layout tasks must update both renderer markup/CSS and Electron window mode constraints; otherwise a correct 1060x712 `.win` can still be clipped by the old 440x600 `panel` BrowserWindow.
- Existing realtime/call DOM IDs are runtime contracts, not disposable compatibility markup. Hidden legacy controls are acceptable only for elements that are not visible runtime surfaces; `#call-wave` must remain in the visible call stage.
- Independent gates passed: `npm run check`, `node --test` (161 tests), `node --check` for changed JS/test files, `git diff --check`, exact icon/canvas placement scans, and short `npm start` startup smoke.
- Advisor gate passed with downstream notes: Wave 04 should mount screen content into `#shell-content`, `panelController.isOpen()` no longer means the panel is visually open, theme switching should use `#app-shell[data-theme]`, and the bundled gradient PNGs are available even though current CSS uses token gradients.
- CodeRabbit advisory review was requested on PR #3. It posted only generated "review in progress" / "Review triggered" comments and a pending status at merge-decision time, with no actionable findings available.

### Wave 02 — pre-run file-claim note
- **Symptom:** Wave 02 decomposition lists tasks `011` and `019` as parallel, but both may require `src/renderer/leena.css`.
- **Root cause:** Font-face bundling and orb/waveform visual states share the central design-system stylesheet.
- **Fix:** Dispatch all four Wave 02 agents, but scope `019` to component/test files first; any `leena.css` edits for `019` wait until task `011` releases its stylesheet claim.
- **Rule added?:** no — existing `FILE-CLAIMS.md` conflict resolution already requires serialization for shared files.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 02 — 001 — Non-retryable failure wrapping
- **Symptom:** Independent verification found `withRetry` rethrew HTTP 401 directly, while the task required `RetryExhaustedError` after one attempt.
- **Root cause:** The initial retry loop treated `retryOn(error) === false` as a passthrough instead of a completed one-attempt retry cycle.
- **Fix:** `src/utils/retry.js` now throws `RetryExhaustedError` with `attempts` and `lastError` for non-retryable failures, and `test/retry.test.js` asserts the HTTP 401 shape.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 02 — 002 — Protected provider API-key settings
- **Symptom:** Reviewer found provider API-key helpers persisted raw `sk-*` secrets in the SQLite `settings` table.
- **Root cause:** The first provider settings skeleton treated API keys like ordinary settings values instead of requiring the Electron safeStorage-style protection boundary.
- **Fix:** `src/providers/provider-settings.js` now requires an injected secret codec for non-empty API-key saves, stores only protected payloads, rejects payloads containing the raw key, and reveals only through the codec; `test/provider-registry.test.js` inspects SQLite to prevent raw-secret storage.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 02 — 011 — Legacy renderer font fallback
- **Symptom:** Reviewer found `src/renderer/styles.css` still referenced `Inter` and `Geist` after Google Fonts links and CSP allowances were removed.
- **Root cause:** Task 011 updated the Leena design stylesheet but missed the legacy runtime stylesheet that still supplied page-level font-family declarations.
- **Fix:** `src/renderer/styles.css` now uses the local Leena font CSS variables, and `test/font-bundle.test.js` scans runtime renderer CSS for removed Google font families and hosts.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

## Wave 02 — summary
- Retry utilities should preserve the retry contract even when a failure is intentionally not retried; downstream callers can inspect `RetryExhaustedError.lastError` for the original status/code.
- Provider API-key settings are now fail-closed: downstream settings/IPC tasks must inject Electron `safeStorage` protection rather than calling `saveProviderApiKey()` bare.
- Font tasks must scan every runtime renderer stylesheet, not only the new design-system CSS, after removing remote font links or CSP allowances.
- Advisor warnings for future waves: keep provider network requests in the main process unless renderer CSP is deliberately expanded; use canonical provider names in concrete providers.
- CodeRabbit can be installed but still unable to start a review due to rate limits or usage credits. Treat that as advisory-only evidence, record the bot response, and continue after local reviewer/advisor gates pass.

### Fix entry template
```
### Fix — Wave NN — <task id> — <one-line title>
- **Symptom:** what failed (exact error quoted)
- **Root cause:** why
- **Fix:** what changed (file:line)
- **Rule added?:** yes/no — if yes, which Active Rule
- **WAL ref:** tasks/.wal/<entry>
```

### Pre-build — 2026-06-01 — Decomposition-phase learnings (before any wave ran)
- **Sub-agent mis-reporting (3×):** `wave-writer`, `wave-writer2`, `ollama-model-download` returned "completed" but 2 of 3 wrote nothing (wave files absent). Fix: orchestrator now independently verifies every dispatched agent's output on disk (added to both run commands, Step 2.8 / Step 9). Rule promoted to Active Rules.
- **Structure-only verification missed thin sections:** initial decomposition QA used `wc -l` + `grep dependencies:` only; a later content-integrity sweep (12-section presence + ≥80-char bodies + numbered Steps ≤7 + named test paths + est_tokens ≤30k) found 15 terse-but-valid sections and 0 hollow files. Two test-suite tasks (040, 087) had test paths only in Steps, not in `## Tests Required` — enriched. Rule promoted to Active Rules.
- **Deliverable nearly shipped mock data:** MVP `.dmg` (046) originally depended only on backends, not wire-live tasks → would build an app showing Phase-0 mock screens. Fixed: added wake/MCP-free wire-live tasks 100/101/104 to 046's deps.
- **`.dmg` launch-check assumed a GUI:** 046/111 acceptance required `open`-launching the app, impossible headless. Split into headless structural checks (hdiutil verify, bundle present) for the autonomous path + an owner GUI checklist in DELIVERABLE.md.

### Fix — Wave 01 — 000 — Error module formatter gate
- **Symptom:** `npx biome check src/utils/errors.js src/main.js src/preload.js test/errors.test.js` failed on formatter/import order.
- **Root cause:** New error utility and test import order did not exactly match Biome formatting.
- **Fix:** Applied Biome-equivalent formatting in `src/utils/errors.js` and `test/errors.test.js`.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 01 — 010 — Leena CSS Biome gate
- **Symptom:** `npm run check` failed with `lint/complexity/noImportantStyles` in `src/renderer/leena.css`.
- **Root cause:** Reduced-motion overrides used `!important`, which Biome rejects.
- **Fix:** Removed `!important` from the reduced-motion rules and updated the token test expectation in `test/leena-css-tokens.test.js`.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 01 — 010 — CSS selector test gate
- **Symptom:** `node --test` failed with `.nav-item missing height: 34px` in `test/leena-css-tokens.test.js`.
- **Root cause:** The test matched selector substrings, so `.nav-item` was resolved from the focus-visible selector before the real class block.
- **Fix:** Changed `extractRuleBody` to parse CSS blocks and match complete comma-separated selectors.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 01 — gate — Biome scanned generated/reference artifacts
- **Symptom:** Parent `npm run check` failed before Wave 01 code verification on `design-system/gellix-font/demo.html` parse errors and `plans/.wal/post-2026-06-01.json` formatting.
- **Root cause:** Biome was configured to scan every file, including design-reference font demos and append-only WAL artifacts that are not runtime source.
- **Fix:** Narrowly excluded `design-system`, `plans/.wal`, and `tasks/.wal` in `biome.json`.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 01 — 000 — Renderer error-event redaction
- **Symptom:** Reviewer found `leena:error` could send raw serialized stacks/custom fields to the renderer in packaged/default `NODE_ENV` paths.
- **Root cause:** `reportGlobalError` sanitized the diagnostics write but sent raw `serializeError(error)` to `webContents.send`.
- **Fix:** Added explicit `includeStack` and `redactSecrets` serializer options in `src/utils/errors.js`; `src/main.js` now sends a redacted renderer payload and includes stacks only when unpackaged and non-production.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 01 — 000 — Embedded URL redaction
- **Symptom:** Focused reviewer found embedded callback URLs like `failed https://example.test/callback?code=SECRET` still reached renderer-safe payloads with query secrets intact.
- **Root cause:** `scrubString` only stripped query/fragment data when the full string parsed as a URL.
- **Fix:** Added embedded URL substring matching in `src/utils/errors.js` and regression coverage in `test/errors.test.js`.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 01 — 000 — Diagnostics URL redaction
- **Symptom:** Focused reviewer found embedded callback URLs could still be written to `diagnostics.log` through `sanitizeDiagnosticValue`.
- **Root cause:** `src/main.js` maintained a separate string scrubber that only stripped query/fragment data when the full string parsed as a URL.
- **Fix:** Exported the shared redaction helper from `src/utils/errors.js`, reused it in `src/main.js`, and added direct regression coverage in `test/errors.test.js`.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

## Wave 01 — summary
- Built typed error infrastructure, global main-process error reporting, renderer error-event exposure, and serialization tests.
- Built the Leena CSS token foundation, imported it before the legacy stylesheet, mounted the `.leena` wrapper attributes, and added token completeness tests.
- Reviewer blockers on renderer error redaction, embedded callback URL redaction, and diagnostics redaction were fixed and independently re-verified.
- Independent gates passed: `npm run check`, `node --test` (127 tests), and `node --check` on changed JS files.
- CodeRabbit advisory review was requested on PR #1. It had posted only its generated "review in progress" note with no actionable findings at merge decision time.

### Fix — Wave 09 — 083 — MCP permission gate Biome cleanup
- **Symptom:** `npm run check` failed on `src/realtime/tool-permissions.js` with `lint/suspicious/noControlCharactersInRegex` and on the new MCP permission test formatting.
- **Root cause:** The sanitizer used an explicit control-character regex, and one summary assertion exceeded Biome's preferred line width.
- **Fix:** Replaced the sanitizer regex with a small character-code loop and wrapped the long test assertion.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 09 — 032 — SQLite row prototype in rename migration test
- **Symptom:** Focused `node --test test/rename-migration.test.js ...` failed because `DatabaseSync#get()` returns a null-prototype row object that did not strict-deep-equal a plain object.
- **Root cause:** The migration test asserted the raw SQLite row shape instead of normalizing it to the business payload.
- **Fix:** Spread the returned row before `assert.deepEqual` in `test/rename-migration.test.js`.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 09 — 032 — Rename-slice Biome formatting
- **Symptom:** `npm run check` reported formatting changes for `src/realtime/tools/screenshot-tools.js` and `test/rename-migration.test.js`.
- **Root cause:** The rename patch left one long predicate and one assertion block outside Biome's preferred wrapping.
- **Fix:** Wrapped the screenshot noise predicate and normalized the migration-test assertion formatting.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 09 — 105 — Session-state Biome formatting
- **Symptom:** `npm run check` reported formatting changes for `src/renderer/session-state.js` and `src/renderer/components/command-center.js`.
- **Root cause:** The new session-state manager and Command Center binding left a few long expressions outside Biome's preferred wrapping.
- **Fix:** Ran Biome formatting on the task-owned session-state, Command Center, and session-state-manager test files.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 09 — integration — Rename/session-state runtime hook
- **Symptom:** The global rename was clean in owned files, but `src/renderer/session-state.js` still defaulted to `window.brah`, and the new Command Center state manager was not mounted into the live renderer.
- **Root cause:** Task `032` and task `105` intentionally avoided each other's active claims, leaving the bridge rename and runtime Command Center hook for integration.
- **Fix:** Switched `SessionStateManager` default lookup to `window.leena`, added preload `realtime:*` listener helpers, mounted a live compact Command Center from `renderer.js`, dispatched real Realtime state/tool/done/error events from the renderer flow, and passed tool arguments/results through `realtime-tool-handler.js`.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

## Wave 09 — summary
- Completed tasks `032`, `083`, and `105`; blocked task `092` because dependency `091` has no trained wake model, selected threshold, real audio corpus, or measured FA/FR/latency report.
- Rebranded runtime identity to Leena: package metadata, preload bridge, renderer bridge calls, docs, user-facing strings, and default SQLite DB path now use Leena. The default DB open migrates an existing legacy DB and SQLite sidecars to `lena.db`.
- Added default-deny MCP permission helpers with server ownership checks, malformed-name fail-closed behavior, schema risk inference, sanitized descriptions, argument summaries, and `auto` / `confirm` / `trust` policy behavior for downstream task `085`.
- Added live Command Center state wiring: `SessionStateManager`, Command Center binding, renderer event emission from real Realtime activity, preload push-event hooks, tool preview summaries, debounce, disconnect error state, and reconnect idle recovery.
- Independent verification passed: `npm run check`, full `node --test` (291 tests), changed JS syntax checks, output existence checks, old-name grep over `src/ test/ package.json README.md CLAUDE.md`, WAL JSON parse, and `git diff --check`.
- Advisor warnings to carry forward: task `085` must wire these MCP permission helpers into the actual dynamic MCP execution path; Command Center live state has DOM/unit coverage and should get an Electron visual smoke before relying on the live surface for production-visible runtime proof.
- Wake-word remains non-blocking for the deliverable path. Task `092` can resume only after a real `hey-lena.onnx` model and measured ambient/positive corpus exist, or after selecting the documented Porcupine/hotkey fallback.
- CodeRabbit advisory was requested on PR #10. It posted the generated "Review triggered" response and left the advisory CodeRabbit status pending at merge-decision time, with no actionable findings available; advisory status did not block merge.

### Fix — Wave 09 — reviewer — MCP missing-tool fail-closed
- **Symptom:** Reviewer found `shouldAutoApproveMCPTool()` could auto-approve a namespaced tool on an `auto` server even when the server config did not list that tool.
- **Root cause:** Missing MCP tool metadata fell back to an empty object, so risk inference defaulted to `low` and the `auto` policy approved it.
- **Fix:** `getMCPPermissionContext()` now treats missing tool metadata as invalid, including for `trust` servers; missing tools return an `unknown` permission request and never auto-approve. Added focused regression coverage.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 09 — reviewer — Legacy Electron user-data migration
- **Symptom:** Reviewer found the rename migration only handled a legacy DB already inside the new Leena user-data directory, so real installs using the old Electron support directory would start fresh.
- **Root cause:** The database layer only checked adjacent `lena.db`/legacy DB paths and legacy JSON import only looked in the new user-data root plus the historical temp fallback.
- **Fix:** Startup now computes old Electron user-data roots, passes them into `setDatabaseUserDataPath()`, moves `openai-credentials.json` from the old root when needed, and the database migration imports legacy DB/JSON stores from those roots. Added cross-root DB migration coverage and auth source assertions.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 09 — reviewer — Task log append-only placement
- **Symptom:** Reviewer found the Wave 09 TASKLOG entry had been inserted above older Wave 01-06 history instead of appended at the end.
- **Root cause:** The orchestrator inserted the new section next to Wave 07/08 entries rather than respecting the file-level append-only convention.
- **Fix:** Moved the Wave 09 TASKLOG start/summary block to the end of `tasks/TASKLOG.md` without rewriting older history.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 09 — reviewer-hardening — MCP stale metadata fail-closed
- **Symptom:** The reviewer fix covered absent MCP tool records, but stale tool metadata, unnamed singleton metadata, and malformed `inputSchema` could still be too easy to treat as trusted configuration.
- **Root cause:** Tool metadata validity only checked that a matching record existed; it did not require a matching tool name and object schema before permissive `auto` / `trust` policies were evaluated.
- **Fix:** Required MCP tool metadata to include a matching name and object `inputSchema`; added regressions for malformed names, stale metadata, missing schema, unnamed singleton metadata, and malformed schema under `auto` and `trust`.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 09 — reviewer-hardening — Rename migration sidecar proof
- **Symptom:** Cross-root DB migration coverage proved the legacy DB moved, but did not prove uncheckpointed WAL data and sidecar files survived the rename.
- **Root cause:** The first reviewer-fix test used a normally closed database path where data may already be checkpointed into the main DB file.
- **Fix:** Added a realistic SQLite WAL/SHM sidecar migration test with `wal_autocheckpoint=0`, proving an uncheckpointed legacy row survives the cross-root move into `lena.db`; added a focused auth harness test for legacy OpenAI credential migration from the old Electron support root.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 10 — 033/035 — Packaged tray assets
- **Symptom:** The tray helper loaded icons from `build/tray`, but the electron-builder `files` allowlist only included `src/**/*`, renderer assets, and `package.json`.
- **Root cause:** The tray icons lived outside `src/`, so a successful local run could still produce a packaged app with missing tray images.
- **Fix:** Added `build/tray/**` to `package.json` `build.files`, rebuilt the dir and DMG/ZIP targets, and verified all six tray icon files with `npx asar list dist/mac-arm64/Leena.app/Contents/Resources/app.asar`.
- **Rule added?:** yes — Packaged runtime assets outside `src/` must be explicitly included.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 10 — 061 — SQLite rowid BigInt in FK test
- **Symptom:** The full test suite failed with `TypeError: Cannot mix BigInt and other types` in the semantic supersession foreign-key test.
- **Root cause:** `DatabaseSync#run().lastInsertRowid` can be a BigInt, and the negative FK test added a numeric offset directly.
- **Fix:** Converted `lastInsertRowid` with `Number(replacement)` before computing the invalid FK id and reran focused memory tests plus full `node --test`.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 10 — reviewer — Learning/WAL tail repair
- **Symptom:** Reviewer found Wave 10 learnings inside the fix-entry template code fence and the WAL physical tail ending with an older tray checkpoint that implied gates were still blocked.
- **Root cause:** The Wave 10 summary was inserted into the template block, and a worker checkpoint was appended after terminal post-run entries.
- **Fix:** Moved Wave 10 fix entries and summary to the physical learning tail and appended a later terminal reviewer-fix WAL checkpoint that supersedes the stale tray checkpoint.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

## Wave 10 — summary
- Completed tasks `033`, `035`, `038`, `061`, `081`, and `085`; blocked `093` because `092` still lacks the wake engine/model/threshold/metrics required for an honest coordinator implementation.
- Electron Builder now creates DMG + ZIP artifacts while preserving `build:mac:dir`; `GATEKEEPER-BYPASS.md` documents unsigned install bypass until Developer ID signing exists.
- Tray work now has packaged template icons, close-to-tray, tray actions/listeners, state icons, and renderer-driven listening/speaking/idle updates that preserve a muted tray state.
- Settings work now has a typed SQLite store, defaults, main IPC, preload APIs, `data:changed` settings events, and tests for value types/defaults/deletion/legacy raw rows.
- Storage work added additive memory tables/indexes, central `mcp_servers` schema, `ServerStore` CRUD, and auto-connect filtering.
- MCP tools now merge into realtime tool definitions and execute through namespaced routing plus the Wave 09 permission helpers; missing/stale metadata fails closed.
- Parent verification passed: `npm run check`, `node --test` (329/329), changed JS syntax checks, `git diff --check`, `npm run build:mac:dir`, `npm run build:mac`, mounted DMG layout check, ZIP app check, and packaged tray asset check.
- CodeRabbit advisory was requested on PR #11. It posted the generated "Review triggered" response and left the advisory CodeRabbit status pending at merge-decision time, with no actionable findings available; advisory status did not block merge.

## Wave 11 — summary
- Completed tasks `034`, `036`, `037`, `039`, `053`, `062`, `070`, `084`, `086`, `087`, and `110`; blocked `094` because task `093` has no wake coordinator over a real engine/model/threshold/metrics.
- Shared `src/main.js` / `src/preload.js` integration now registers launch-on-login, global hotkey, provider settings IPC, MCP server IPC, MCP auto-connect/cleanup, onboarding completion/reset aliases, first-run onboarding launch, and panel bounds get/set APIs.
- SQLite memory, persona engine, provider IPC, MCP handlers, MCP auto-connect, MCP comprehensive tests, onboarding renderer contract, launch/hotkey helpers, and panel persistence each have focused tests.
- Wake work remains non-blocking for the deliverable path; task `094` should resume only after real wake coordinator outputs or an explicit fallback decision.
- Reviewer fix: MCP server removal originally let a stale/disconnected live client block deletion of the saved server row. The handler now uses best-effort disconnect cleanup before deleting storage, with a focused regression proving stale cleanup errors do not prevent removal.
- Reviewer fix: first-run onboarding was only an integration-ready module, so fresh installs still loaded the main shell. Main now passes `?onboarding=1` when `onboardingCompleted` is false, renderer bootstrap mounts the onboarding flow before app runtime, and focused tests scan the launch path.
- Reviewer fix: provider settings returned redacted API-key placeholders and then accepted the same placeholder as a fresh secret on general config saves. `providers:set-config` now treats `[REDACTED]...` as display-only and preserves the existing encrypted key while still saving base URL/model changes.
- Reviewer fix: task-local resize constraints must not override an approved shell contract. Panel mode now preserves the existing 1060px default and allows resizing up to 1280px instead of clamping the desktop shell to 800px.
- Parent verification passed after reviewer fixes: `npm run check`, `node --test` (400/400), changed JS syntax checks, `git diff --check`, WAL JSON parse, and task-artifact privacy scan.
- CodeRabbit advisory was requested on PR #12 and was still pending at merge-decision time, with no actionable findings available; advisory status did not block merge.

## Wave 12 — summary
- Completed tasks `040`, `054`, `056`, `063`, `072`, and `103`; blocked `095` and `096` because wake consent/test-suite work cannot honestly build over absent wake engine/coordinator/IPC runtime.
- Existing phase-exit tests can satisfy a test-suite task when they already exceed the required coverage; verify counts and full gates instead of duplicating tests.
- Shared `src/main.js` / `src/preload.js` work for memory and identity IPC should stay serialized by the orchestrator while workers build standalone handler modules and focused tests.
- Current MCP Integrations UI must use the live `window.leena.mcp.*` bridge, not stale fixture exports or generic invoke prose; keep old fixture tests aligned with the live contract.
- Parent verification passed: `npm run check`, `node --test` (438/438), changed JS syntax checks, `git diff --check`, WAL parse, active-claims audit, task counts, task-artifact privacy scan, and primary-checkout contamination check.
- Reviewer gate cleared with no blockers. The realtime provider/model selector warning is non-blocking for now because runtime selection still uses provider defaults and there is only one OpenAI realtime model.
- CodeRabbit advisory was requested on PR #13. It posted generated pending/triggered responses with no actionable findings available at merge-decision time; advisory status did not block merge.

### Fix — Wave 13 — integration — Text chat and memory lifecycle wiring
- **Symptom:** Worker slices and full tests were green, but shared lifecycle files still did not register `chat:send`, expose preload chat chunk listeners, mount live text chat, or inject recalled memories into realtime session prompts.
- **Root cause:** Tasks `064` and `106` correctly left shared `src/main.js`, `src/preload.js`, and `src/renderer/renderer.js` to the orchestrator, but the interrupted run had not completed the serialized parent integration before the first green gate.
- **Fix:** Added shared memory store/middleware integration in `src/main.js`, registered `registerChatHandlers()`, exposed `chat.send`/`sendChat`/`onChatChunk`/`offChatChunk` in `src/preload.js`, mounted Command Center chat in `src/renderer/renderer.js`, recorded realtime transcript memories best-effort, and added `test/wave13-integration.test.js`.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 13 — 106 — Provider switch model reset
- **Symptom:** Text chat could retain the previous provider's selected model after the user switched chat providers.
- **Root cause:** The Command Center chat controller reused the existing `model` field when loading model options for the newly selected provider.
- **Fix:** Cleared the selected model on provider change, honored initial chat models only on first render, fetched the selected provider's chat models, and added focused regression coverage in `test/text-chat.test.js`.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 13 — integration — Cancelable chat computer-use tools
- **Symptom:** Text-chat tool calls reused the realtime tool dispatcher but did not allocate an abort controller for `computer_use_task` unless the caller supplied one, so `tools:cancel-computer-use` could not cancel a computer-use task launched from chat.
- **Root cause:** The shared runtime tool helper initially extracted the IPC handler's option construction but left abort-controller ownership at the caller boundary.
- **Fix:** `executeRealtimeToolWithRuntimeOptions()` now creates, registers, and cleans up an owned abort controller for chat-triggered `computer_use_task` calls while preserving the existing IPC-owned controller path.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 13 — 106 — Streamed provider tool-call deltas
- **Symptom:** Text chat exposed the standard tool dispatcher, but OpenAI/OpenRouter streaming providers dropped `tool_calls` SSE deltas before `chat:send` could execute them.
- **Root cause:** Provider stream parsers only yielded content/finish/usage chunks; tool-call deltas were ignored while parsing provider-specific SSE payloads.
- **Fix:** Accumulated streamed `tool_calls` deltas in the OpenAI and OpenRouter parsers, flushed complete tool calls at `finish_reason: "tool_calls"`, and added provider regression tests for split JSON argument deltas.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 13 — reviewer — Text chat tool safety and final answers
- **Symptom:** Text chat could advertise/execute the full realtime tool set and returned no user-facing answer after providers emitted tool calls that required a follow-up turn.
- **Root cause:** `chat:send` converted all realtime tool schemas without applying permission metadata, executed model-selected tool names directly, and stopped after the first provider stream.
- **Fix:** Restricted default text-chat tools to low/read-risk permission levels, denied unsafe/unadvertised tool calls with a model-visible permission result, appended tool result messages, and ran a second provider call for the final answer.
- **Rule added?:** yes — text chat must not expose or execute write/network/screen/sensitive/destructive/unknown tools without an explicit permission design.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 13 — reviewer — Live Activity history across conversations
- **Symptom:** Activity could not show generated chat/realtime conversation history because the exact `memory:get-episodes` IPC channel did not exist and fallback only read the `default` conversation.
- **Root cause:** The renderer implemented the preferred adapter before the main/preload/SQLite alias was wired.
- **Fix:** Added `SQLiteMemoryStore.getEpisodes({ page, limit, query })`, registered `memory:get-episodes`, exposed `window.leena.memory.getEpisodes()`, and added cross-conversation pagination/search coverage.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 13 — reviewer — Launch on Login side effect
- **Symptom:** The Settings Launch on Login toggle persisted a boolean but did not immediately apply the OS login item.
- **Root cause:** General toggles all routed through generic settings persistence even though Launch on Login has a dedicated main-process side-effect channel.
- **Fix:** `launchOnLogin` writes now prefer `window.leena.setLaunchOnLogin(bool)` or `settings:set-launch-on-login` before falling back to generic `settings:set`, with controller coverage.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 13 — reviewer — Recalled memory prompt boundary
- **Symptom:** Recalled memory text was placed in realtime instructions without explicitly telling the model to treat it as untrusted data.
- **Root cause:** Memory context formatting listed facts and relevance guidance but did not protect against prompt-like content stored from transcripts.
- **Fix:** Added an explicit memory-as-data boundary that forbids following commands inside memory text or overriding higher-priority instructions, plus regression coverage with malicious memory text.
- **Rule added?:** yes — recalled memory in prompts must be labeled as untrusted data.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 13 — reviewer — Async MCP tool definitions in text chat
- **Symptom:** Text chat could advertise zero tools in production when MCP integration was present.
- **Root cause:** `getRealtimeToolDefinitions(mcpClientManager)` returns an async MCP-merged definition list, but `chat:send` passed the unresolved promise into the synchronous chat tool normalizer.
- **Fix:** Awaited request/default tool definitions before applying the low/read-risk chat filter, added text-chat regression coverage for async tool definitions, and corrected task `101` documentation to match the actual bounded SQLite `LIKE` search path.
- **Rule added?:** yes — text chat must resolve async MCP-merged tool definitions before filtering or advertising tools.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 13 — advisor — Default chat provider preservation
- **Symptom:** Command Center text chat sent the first renderer-listed chat provider even when the user had not chosen a provider.
- **Root cause:** Provider loading treated the first option as selected state, bypassing `chat:send`'s main-process `ProviderRegistry` default-provider resolution.
- **Fix:** Added a blank default-provider option, kept provider/model unset until explicit user selection, and added a regression proving initial sends omit provider/model while explicit selection still sends them.
- **Rule added?:** yes — renderer provider lists must not override persisted provider defaults unless the user explicitly selects a provider.
- **WAL ref:** tasks/.wal/wal.jsonl

## Wave 13 — summary
- Completed tasks `064`, `100`, `101`, `104`, and `106`.
- Realtime prompts now inject recalled memories through `buildRealtimeInstructions({ profile, memories })`; realtime transcript exchanges are recorded as episodic memories best-effort and consolidated only after the conversation threshold.
- Home, Activity, and Settings now render live data through current `window.leena` bridge contracts with loading/empty states and graceful fallbacks instead of production fixture rows.
- Text chat is available inside the live Command Center with provider/model selection, streaming response chunks, markdown-safe bubbles, shared realtime tool dispatch, and memory handoff storage.
- OpenAI/OpenRouter streamed tool-call deltas now reach text chat as complete tool calls, including split JSON argument chunks.
- Text-chat tools are now low/read-risk by default, unsafe model-selected tools are denied, and tool-call results get a follow-up model turn for the final response.
- Text chat now awaits async MCP-merged tool definitions before applying the low/read-risk filter, so live MCP integration does not drop advertised safe tools.
- Command Center text chat preserves the configured main-process default chat provider/model until the user explicitly selects an override.
- Activity now has a real `memory:get-episodes` / `window.leena.memory.getEpisodes()` path backed by SQLite pagination/search across generated conversation ids.
- Settings Launch on Login now applies the OS login item through the dedicated launch bridge, and recalled prompt memory is explicitly treated as untrusted data.
- Chat-triggered computer-use tool calls now participate in the same cancellation path as voice/tool IPC calls.
- Parent integration coverage now pins chat handler registration, preload chat APIs, live Command Center text chat, and memory-aware realtime session wiring.
- Independent parent gates passed after reviewer/advisor fixes: `npm run check`, `node --test` (483/483), changed JS `node --check`, focused Wave 13/provider/text-chat/memory/settings/prompt tests, `git diff --check`, WAL JSON parse, task counts, active-claims audit, and task-artifact privacy scan.
- CodeRabbit advisory was requested on PR #14. Its GitHub status was pending at merge-decision time with no actionable findings available; advisory status did not block merge. GitHub labels `codex` and `codex-automation` are not present in this repo.

### Fix — Wave 13 — reviewer-fix-2 — Chat IPC privacy boundary
- **Symptom:** Reviewer found renderer code could submit privileged chat `system`/`tool` messages or forged tool schemas and steer default text chat toward auto-approved local file reads.
- **Root cause:** `chat:send` accepted renderer-supplied history roles and renderer-supplied tool definitions, and its low/read-risk filter included generic local file reads.
- **Fix:** Text chat now ignores renderer-supplied tool schemas, accepts only renderer `user`/`assistant` history roles, caps history/message size, and advertises only an explicit default chat-tool allowlist. `read_file` remains denied even when a model emits it.
- **Rule added?:** yes — renderer-supplied chat payloads must not define tools or privileged message roles, and default text-chat tools must use an explicit allowlist instead of permission level alone.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 13 — reviewer-fix-2 — Chat tool audit path
- **Symptom:** Reviewer found chat-triggered tool execution bypassed the standard `tools:execute` diagnostics, activity recording, and `data:changed` refresh path.
- **Root cause:** Wave 13 registered text chat with the lower-level runtime tool helper directly.
- **Fix:** Added `executeRealtimeToolWithAudit()` and registered text chat against it, preserving diagnostics, tool activity, and data refresh broadcasts for chat-triggered tools.
- **Rule added?:** yes — alternate tool callers must route through the same audit/activity/refresh wrapper as direct tool IPC.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 13 — reviewer-fix-2 — OpenRouter DONE tool-call flush
- **Symptom:** Reviewer found OpenRouter streamed tool-call deltas could be dropped when `[DONE]` arrived without a `finish_reason: "tool_calls"` event.
- **Root cause:** The parser returned immediately on `[DONE]`, making the accumulator flush unreachable.
- **Fix:** `[DONE]` now stops stream parsing without returning from the generator, allowing accumulated tool calls to flush. Added regression coverage for DONE-only tool-call termination.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 13 — reviewer-fix-2 — Memory episodes bounds
- **Symptom:** Reviewer found `memory:get-episodes` accepted unbounded renderer page/limit values and wildcard-heavy `LIKE` searches.
- **Root cause:** IPC validation and direct store access trusted positive integers and interpolated unescaped `%query%` patterns.
- **Fix:** Clamped episode page/limit/query size in IPC and store code, escaped `LIKE` wildcards with an explicit escape clause, and added IPC/store regression coverage.
- **Rule added?:** yes — renderer-exposed paginated SQLite reads must cap limit/page/query size and escape literal LIKE input.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 13 — reviewer-fix-2 — Memory fallback pagination
- **Symptom:** Reviewer re-check found the legacy `memory:get-episodes` fallback for stores without `getEpisodes()` still returned all conversation rows and ignored search.
- **Root cause:** The fallback path reused `getConversation()` directly after the main SQLite path was bounded.
- **Fix:** The fallback now reuses the same capped IPC args, filters bounded conversation entries by query, paginates the result, and returns the same `{ entries, total, hasMore, limit, page }` shape. Added focused IPC regression coverage.
- **Rule added?:** yes — fallback IPC paths need the same resource bounds as the primary production path.
- **WAL ref:** tasks/.wal/wal.jsonl

### Wave 13 reviewer-fix-2 — verification
- Independent gates after the hardening fixes passed: changed-file `node --check`, focused Biome, focused `node --test` (45/45), full `npm run check`, full `node --test` (488/488), active-claims audit, WAL JSON parse, task-count audit, `git diff --check`, and task-artifact privacy scan.
- Reviewer found the WAL physical tail was stale after a late advisory checkpoint. Appending a fresh terminal checkpoint at the physical tail is the correct repair; do not leave older advisory/bookkeeping entries after the latest gate entry.

### Fix — Wave 14 — 108 — Patch default worktree hygiene
- **Symptom:** The nudge worker's first patch attempt wrote an untracked task file in `<primary-checkout>` instead of the clean Wave 14 worktree.
- **Root cause:** The patch tool defaulted to the parent checkout path unless the worker used absolute Wave 14 file paths.
- **Fix:** Removed the stray primary-checkout file immediately, re-applied the patch using absolute Wave 14 paths, and verified the primary checkout had no nudge source file contamination before terminal bookkeeping.
- **Rule added?:** no — reinforces the existing exact-worktree-path rule.
- **WAL ref:** tasks/.wal/wal.jsonl

## Wave 14 — summary
- Completed tasks `065`, `071`, `107`, `108`, `109`, and `112`: memory comprehensive tests, persona-aware prompt composition, conversation history/search, opt-in proactive nudges, CSS token cleanup, and final e2e integration tests.
- Prompt composition now orders persona, memory, tools, base instructions, profile context, and runtime context, with backward-compatible legacy wrappers and the recalled-memory untrusted-data boundary preserved.
- Activity now supports lazy full transcripts, hybrid keyword/semantic rerank search, relevance indicators, de-duplication, bounded queries, and date grouping without adding shared IPC/preload edits.
- Nudges are opt-in and in-shell only. Main process exposes nudge list/refresh/dismiss IPC, generates on launch and every 30 minutes, and Home renders max-three Suggested cards with dismissal support.
- CSS cleanup centralized legacy renderer literals behind tokens and added grep proof; Workspace/off-white dominance, radius tokens, font tokens, and shell appearance matrix tests remain green.
- Final e2e coverage validates provider switching through chat IPC, cross-session memory recall, MCP HTTP connect/list/disconnect/tool merging, and settings/protected-secret persistence with temp dirs and mocks.
- Independent gates passed: output existence checks, changed-file `node --check`, `npm run check`, full `node --test` (515/515), `npm test`, WAL JSON parse, and `git diff --check`.

### Fix — Wave 14 — reviewer-fix-1 — Realtime persona contract
- **Symptom:** Reviewer found live realtime sessions still used the legacy normalized profile, so custom/switched PersonaEngine personas and persona voice preference did not reach voice sessions.
- **Root cause:** `createRealtimeProviderSession()` loaded `loadAgentProfile()` and called `buildRealtimeInstructions({ profile, memories })` without attaching `PersonaEngine.getActive()`, then selected `profile.voice`.
- **Fix:** Realtime session creation now reads the active PersonaEngine persona, passes the live realtime tool definitions into prompt Tool Context, and selects voice through persona `voicePreference` with the legacy profile voice as fallback.
- **Rule added?:** yes — realtime session creation must route active PersonaEngine state and live tool definitions through prompt composition, and must route active PersonaEngine state through voice selection.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 14 — reviewer-fix-1 — Persona switch session safety
- **Symptom:** Reviewer found `buildPersonaSwitchDelta().session.instructions` could be used as a realtime `session.update` payload while containing only the `# Persona` section.
- **Root cause:** The persona delta exposed full instructions only under `fallbackSession`, leaving the primary `session` contract easy to misuse.
- **Fix:** Persona switch deltas now keep the persona-only text in `sections.persona` but put the full realtime instruction contract in `session.instructions` and `fallbackSession.instructions`.
- **Rule added?:** yes — any realtime session update payload carrying instructions must contain the full instruction contract, including memory/tool/base/runtime boundaries.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 14 — reviewer-fix-1 — Nudge refresh staleness
- **Symptom:** Reviewer found disabling nudges or dismissing a nudge during an in-flight refresh could leave an older enabled payload visible until the next refresh.
- **Root cause:** Settings and dismissal refreshes reused a shared in-flight refresh promise whose enabled state had been read before the opt-out/dismissal.
- **Fix:** Settings and dismissal refreshes now force a new refresh generation, and stale generation results return a disabled empty payload without updating or broadcasting.
- **Rule added?:** yes — opt-out and dismissal refreshes must invalidate stale async UI payloads before publishing.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 14 — reviewer-fix-2 — Nudge opt-out source of truth
- **Symptom:** Reviewer re-check found disabling the Settings `proactiveNudges` toggle could still leave nudges enabled when a legacy `nudgesEnabled=true` value existed.
- **Root cause:** The nudge engine read `nudgesEnabled` before the visible Settings key, so legacy state overrode the UI control.
- **Fix:** `proactiveNudges` is now authoritative whenever present, with `nudgesEnabled` used only as a legacy fallback. Added focused key-precedence coverage.
- **Rule added?:** yes — visible Settings controls must be the source of truth over legacy setting aliases.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 14 — reviewer-fix-2 — Nudge list cache during forced refresh
- **Symptom:** Reviewer re-check found `nudges:list` could return cached enabled nudges while an opt-out/dismiss forced refresh was still running.
- **Root cause:** `getLatestNudges()` preferred `latestNudgePayload` even when `refreshNudges(..., { force: true })` had already invalidated the old generation.
- **Fix:** Forced refreshes now clear the cached payload to a disabled empty result and mark the refresh as forced; `nudges:list` waits for that forced refresh promise instead of serving stale enabled data.
- **Rule added?:** yes — renderer list calls must not serve stale cached enabled UI state while a forced opt-out/dismiss refresh is pending.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 14 — reviewer-fix-3 — Live persona session update
- **Symptom:** Reviewer final re-check found Settings persona switches persisted state but did not update an active realtime data channel or invalidate prefetched client secrets.
- **Root cause:** The Settings screen was isolated from the runtime renderer profile-change path, and realtime client secrets were cached without a generation guard for in-flight prefetches.
- **Fix:** Settings now emits a persona-changed runtime event; renderer invalidates/reprimes prefetched secrets, guards stale prefetch promises with a generation token, and sends a main-built full `session.update` when a data channel is open.
- **Rule added?:** yes — persona/profile changes must invalidate any prefetched realtime secret and update the active realtime session when connected.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 14 — reviewer-fix-3 — Voice selector precedence
- **Symptom:** Reviewer final re-check found seeded/default persona `voicePreference: DEFAULT_VOICE` could override a user-selected legacy/profile voice.
- **Root cause:** Main-process realtime session creation always preferred persona voice preference whenever the persona record had the field, and PersonaEngine normalizes seeded personas with the default voice field.
- **Fix:** Added `resolveRealtimeVoicePreference(profile, persona)` so an explicit non-default profile voice wins over seeded persona defaults, while custom persona voice preference still applies when the profile voice remains default.
- **Rule added?:** yes — explicit user voice settings must not be shadowed by seeded default persona voice values.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 14 — reviewer-fix-1 — Completed checklist hygiene
- **Symptom:** Reviewer found several completed Wave 14 task files still had unchecked acceptance criteria despite terminal WAL and overview state.
- **Root cause:** Handoff/output sections were updated during terminal bookkeeping, but acceptance checklist state was not audited before completion.
- **Fix:** Completed task files for `065`, `071`, `107`, `108`, `109`, and `112` now have acceptance criteria aligned with completed outputs, with checklist and privacy audits clean.
- **Rule added?:** yes — completed task files should be scanned for stale unchecked acceptance criteria before merge.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 14 — reviewer-fix-4 — Identity broadcast, bounded recall, and Home refresh generation
- **Symptom:** Independent reviewer found Settings persona switches could still rely on a renderer-only invalidation event, `memory:recall` accepted unbounded renderer limits, and older Home refresh promises could overwrite newer opt-out/dismiss results.
- **Root cause:** Identity/profile mutation did not have a main-process `data:changed` invalidation path, recall bounds were only implemented for history pagination, and Home accepted every late `loadHomeData()` result.
- **Fix:** Identity/profile IPC now broadcasts `identity` changes and renderer data-change handling routes them through the existing realtime secret/session refresh helper; `memory:recall` clamps limits in both IPC and `SQLiteMemoryStore`; `refreshHomeScreen()` uses a generation guard before publishing UI state.
- **Rule added?:** yes — renderer-exposed memory reads must be bounded at every layer; async renderer refreshes must reject stale results; identity/profile mutations must broadcast runtime invalidation.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 14 — reviewer-fix-5 — Persona session update ordering and tools
- **Symptom:** Final reviewer warning found rapid persona/profile changes could send an older realtime `session.update`, and active sessions did not receive refreshed tool definitions.
- **Root cause:** Renderer session updates were not guarded by the same invalidation generation used for prefetched secrets, and the main-process persona update IPC returned only `audio` and `instructions`.
- **Fix:** Renderer active-session updates now capture the invalidation generation and drop stale IPC responses; main-process persona session updates include refreshed realtime `tools` with the full session payload.
- **Rule added?:** yes — active realtime session updates must be generation-guarded and must refresh tools alongside instructions when runtime context changes.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 14 — reviewer-fix-5 — Biome assertion formatting
- **Symptom:** The first full `npm test` rerun stopped in `npm run check` because the new Wave 14 integration assertion exceeded Biome's preferred single-line shape.
- **Root cause:** A long regex assertion was added manually after focused tests, and focused `node --test` did not exercise formatting.
- **Fix:** Split the assertion across Biome's formatted multi-line `assert.match()` shape, then reran the full gate successfully.
- **Rule added?:** yes — after adding test assertions during reviewer cleanup, run or preserve Biome formatting before calling the full parent gate final.
- **WAL ref:** tasks/.wal/wal.jsonl

### Wave 14 Final Gate Notes
- Reviewer and advisor cleared Wave 14 after reviewer-fix-5. Redundant persona refreshes are acceptable for now because active realtime session updates and Home refreshes are generation-guarded.
- Keep `tasks/OVERVIEW.md` proof counts synchronized with the latest full parent gate before PR creation; Wave 14 ended at `npm test` 525/525.
- CodeRabbit remains advisory-only. For PR #15 it posted review-in-progress/trigger comments with a pending status and no actionable findings available at merge-decision time.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 15 — 073 — Persona test Biome formatting
- **Symptom:** The first task-local `npm run check` after adding PersonaEngine edge-case tests failed on one long clone-isolation assertion.
- **Root cause:** Focused `node --test` passed, but the new assertion was not in Biome's preferred wrapped shape.
- **Fix:** Reformatted the assertion in `test/persona-engine.test.js` and reran focused identity gates plus the full parent suite.
- **Rule added?:** no — this reinforces the existing Wave 14 rule to preserve Biome formatting after adding test assertions.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 15 — 111 — Parent rebuild checksum reconciliation
- **Symptom:** The worker-built DMG/ZIP checksums became stale after the parent independently reran `npm run build:mac`.
- **Root cause:** macOS packaging artifacts are regenerated outputs; a verifier rebuild can produce different archive hashes even when the code/config are unchanged.
- **Fix:** Recomputed SHA-256 after the parent rebuild, updated `tasks/DELIVERABLE.md` and task `111`, then reran structural DMG/ZIP checks and full gates.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

## Wave 15 — summary
- Completed tasks `073` and `111`.
- Identity coverage now has seven PersonaEngine tests covering seed/default behavior, CRUD persistence, active fallback/switching, default protection, stored-record repair/deduplication, clone isolation, and validation failures. Existing prompt-composition, identity IPC, and agent-profile tests remained green.
- The final full-feature macOS artifacts were regenerated with `CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac`: `dist/Leena-0.1.0-arm64.dmg` and `dist/Leena-0.1.0-arm64-mac.zip`.
- `tasks/DELIVERABLE.md` records the current SHA-256 values after parent rebuild: DMG `eb82e79a4dd974999c0a4a645335916e70a37741c5da3887a9891b6ad8392463`; ZIP `fb1530e7b778360ec24082c00c78f586126b779a92c0fde6fb3c47015e7bb849`.
- Headless packaging verification passed for the DMG and ZIP: valid DMG checksum, drag-to-Applications layout, executable app bundle, 21 packaged font assets, and four unpacked `@nut-tree-fork` native addon files. GUI launch remains an owner checklist, not an autonomous gate.
- Independent parent gates passed: `npm run check`, full `node --test` (527/527), changed-file syntax check, `git diff --check`, WAL parse, task-count audit, active-claims audit, and task-artifact privacy scan.
- CodeRabbit remains advisory-only; request it after reviewer/advisor gates clear and before merge.
- Reviewer and advisor cleared Wave 15 with warnings only. Wave 16 must keep the MVP artifact lane distinct from the full-feature artifact and should not imply the ignored `dist/` binaries are committed to the PR.
- PR #16 CodeRabbit state at merge decision: generated trigger/review-in-progress comments only, pending advisory status, and no actionable findings available. Advisory status must not block Wave 15 merge.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 16 — 046 — Build-smoke unsigned convention assertion
- **Symptom:** The first `node --test` after adding `test/build-smoke.test.js` failed because the new test asserted the exact combined unsigned command string before the task evidence was finalized.
- **Root cause:** The repo keeps `CSC_IDENTITY_AUTO_DISCOVERY=false` as the invocation convention rather than baking the environment variable into `package.json`'s `build:mac` script.
- **Fix:** The smoke test now checks the Electron Builder mac target/config in `package.json` and verifies the task-owned MVP artifact convention separately.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 16 — 046 — Deliverable manifest lane separation
- **Symptom:** The initial MVP manifest update replaced the earlier final-artifact manifest instead of showing the standard builder outputs and MVP named copies distinctly.
- **Root cause:** Task `046` owns the guaranteed MVP lane, but `npm run build:mac` regenerates the standard `dist/Leena-0.1.0-*` output paths before copying them to MVP names.
- **Fix:** `tasks/DELIVERABLE.md` now records both standard builder output paths and MVP named deliverables with current hashes, while explicitly noting that `dist/` binaries are build outputs and not implied committed files.
- **Rule added?:** yes — deliverable manifests must preserve distinct artifact lanes when a later build regenerates shared output paths.
- **WAL ref:** tasks/.wal/wal.jsonl

## Wave 16 — summary
- Completed task `046`.
- `test/build-smoke.test.js` now pins the mac `dmg` + `zip` target, hardened/unsigned-compatible package config, `@nut-tree-fork` asar unpacking, and task-owned MVP artifact naming/manual GUI convention.
- The unsigned macOS build was regenerated with `CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac`, then copied to `dist/Leena-MVP.dmg` and `dist/Leena-MVP.zip`.
- `tasks/DELIVERABLE.md` records current SHA-256 values for both the standard builder outputs and MVP named copies: DMG `622285f88cee98384c905c70412c794fe21f6bed03683ad85c72c64ee293be8c`; ZIP `f4897055756ec344ac883d5bc34a3d5a22485267e017c2df5417d16cf46043f6`.
- Headless packaging verification passed for the MVP DMG and ZIP: valid DMG checksum and image info, drag-to-Applications layout, executable app bundle, 21 packaged font assets, and four unpacked `@nut-tree-fork` native addon files.
- Independent parent gates passed: `npm run check`, full `node --test` (529/529), build-smoke focused gates, `git diff --check`, WAL parse, task-count audit, active-claims audit, and task-artifact privacy scan.
- Owner GUI launch-smoke remains a manual checklist, not an autonomous gate.
- Reviewer and advisor cleared Wave 16 with warnings only. Final handoff must state the build is unsigned/ad-hoc, not notarized, and not GUI-launched; `dist/` artifacts are ignored local build outputs.
- **WAL ref:** tasks/.wal/wal.jsonl
