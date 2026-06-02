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
- **Provider primacy.** OpenAI subscription (OAuth) is the primary voice + chat path; the OpenAI API key is the backup. OpenRouter and Ollama are additional selectable providers. Ollama models are user-downloadable on demand.
- **`node:sqlite` only** for storage (no better-sqlite3). Use the existing `database.js` patterns and `withTempDir` + `closeDatabase` test helpers.
- **Native addons stay in `asarUnpack`** (`@nut-tree-fork/**`, onnxruntime native bits).
- **Tests are mandatory, not optional.** No task is complete without the tests named in its `## Tests Required`, and they must pass. E2E coverage for any user-facing flow.
- **Sub-agent completion reports are NOT evidence — verify on disk.** A dispatched agent returning "done" (even with high token/tool-use counts) may have written nothing, done adjacent work, or hallucinated a summary. After ANY dispatched agent: independently confirm the named output files exist, `git status --porcelain`/`git diff` is non-empty, and re-run `npm run check` + `node --test` yourself before trusting the result. *(Evidence: on 2026-06-01, three sub-agents reported success — `wave-writer`/`wave-writer2`/`ollama-model-download` — and two had written nothing; the wave files were claimed-written and were absent. Caught only by an on-disk `ls` count.)*
- **Verify the exact worktree path, not just filenames.** A worker can produce correct-looking output in the wrong checkout. Completion verification must test the requested worktree path explicitly before marking a task complete.
- **Verify content, not just structure.** File counts, section-header presence, and dependency-graph parity all pass even when section bodies are placeholder/hollow. Body-level verification (non-trivial content per section, numbered Steps, named test paths, atomicity cap) is mandatory for any generated artifact — a `wc -l` + `grep` pass is not enough.

---

## Wave Log

> Append below. Newest wave at the bottom. Never delete entries.

### Fix — Wave 05 — 020 — Visible wallpaper transition
- **Symptom:** Reviewer found theme changes could still snap because `.win` also painted `background: var(--wall)` while only `.leena` had the 200ms background transition.
- **Root cause:** The first task 020 fix covered the wrapper wallpaper but missed the visible shell wallpaper surface rule shared by `.leena-page` and `.win`.
- **Fix:** Added the same `background var(--dur-base) var(--ease-out)` transition to `.leena-page, .win` and added CSS token tests for both visible wallpaper selectors.
- **Rule added?:** no.
- **WAL ref:** tasks/.wal/wal.jsonl

### Fix — Wave 04 — 018 — Wrong checkout output recovery
- **Symptom:** Command Center worker reported completion but its files were absent from `/Users/yasmineseidu/leena-wave-04`; they existed under the primary checkout `/Users/yasmineseidu/leena`.
- **Root cause:** The worker wrote to the wrong checkout despite being instructed to use the wave worktree.
- **Fix:** Copied only the task-owned command-center files into `/Users/yasmineseidu/leena-wave-04`, removed those worker-created untracked files from the primary checkout, and added an Active Rule to verify exact worktree paths.
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
