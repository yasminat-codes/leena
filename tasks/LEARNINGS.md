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
