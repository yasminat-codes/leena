---
id: "143"
title: "Theme-aware voice orb"
type: ui
status: completed
wave: 19
priority: high
complexity: S
estimated_tokens: 9000
dependencies: ["125", "142"]
context_files:
  - src/renderer/renderer.js
  - src/renderer/leena.css
  - src/renderer/components/orb.js
  - test/orb-waveform.test.js
skills: []
tags: [voice, orb, theme]
attempts: 1
claim_started: "2026-06-04T00:04:46Z"
completed_at: "2026-06-04T00:37:29Z"
created_at: "2026-06-03"
---

## Objective
Make the speaking/listening orb reflect the current theme and treatment consistently across Home, Chat, and the global voice dock.

## Why This Matters
The user expects each orb to represent the selected theme. This must happen without creating parallel orb styling systems.

## Steps
1. Reuse task 125 tokens rather than adding hard-coded colors.
2. Bind voice dock state to the same orb token variables used by Home and Command Center.
3. Add state-specific treatments for idle, starting, listening, speaking, tool, and error.
4. Ensure reduced motion remains readable.
5. Add/update orb tests for token/state presence.
6. Refresh screenshot proof.

## Acceptance Criteria
- [x] Orb colors shift with treatment/theme.
- [x] Starting/listening/speaking/error states are visually distinct.
- [x] No oversized green shadow returns.
- [x] Reduced motion state remains understandable.

## Tests Required
- `node --test test/orb-waveform.test.js test/session-state-manager.test.js`
- UI screenshot harness from task 121.
- `npm run check`

## Outputs
- `src/renderer/leena.css`
- `src/renderer/renderer.js` if state bindings change.
- Tests/screenshots as needed.

## Interface Contracts
Orb visuals are token-driven through `#app-shell.leena` data attributes and session state.

## Handoff Notes
- Changed `src/renderer/components/orb.js` to expose the shared orb state vocabulary (`idle`, `starting`, `listening`, `speaking`, `tool`, `error`), normalize renderer/realtime aliases into those states, and apply state intensity/scale/filter through orb CSS custom properties rather than color or shadow literals.
- Changed `src/renderer/renderer.js` to bind the global voice dock to those same state names via `#app-shell.leena[data-orb-state]` plus `data-state` on `#call-toggle`, `#call-stage-toggle`, and `#header-call`; dock orb surfaces now inherit the task 125 palette through `--orb-a`, `--orb-b`, `--orb-c`, `--orb-signal`, and per-state scale/brightness/saturation variables without raw colors. Tool execution temporarily maps to `tool` and mode changes resync the dock.
- Updated `test/orb-waveform.test.js` for token/state presence, alias normalization, animation cancellation, and reduced-motion readability.
- Updated `test/session-state-manager.test.js` with a static renderer binding guard because importing `renderer.js` would bootstrap the app in Node.
- Did not edit `src/renderer/leena.css`; parent can add exact CSS selectors/tokens for `data-orb-state` if more visual differentiation is desired.
- `kencode-search` note: shell command was not on PATH; used available `mcp__kencode_search.searchCode` before code edits with query `data-orb-state` (no public matches).
- Successful gates: `node --check src/renderer/components/orb.js && node --check src/renderer/renderer.js && node --check test/orb-waveform.test.js && node --check test/session-state-manager.test.js`; `npx biome check src/renderer/components/orb.js src/renderer/renderer.js test/orb-waveform.test.js test/session-state-manager.test.js`; `node --test test/orb-waveform.test.js test/session-state-manager.test.js` (16/16).

- 2026-06-04T00:37:29Z parent verification: Theme-aware orb state mapping completed for idle, starting, listening, speaking, tool, and error states across Command Center/voice dock bindings. The screenshot proof blocker was resolved by the Settings hidden-section CSS fix, and the UI baseline harness now passes. Gates passed: `npm run check`, `node --test test/orb-waveform.test.js test/session-state-manager.test.js`, `node --test test/ui-baseline-smoke.test.js`, full `node --test` (596/596), and output existence checks.

## Errors Encountered
- `npm run check` is blocked by concurrent/out-of-scope files: `src/renderer/leena.css` descending specificity around `.settings-card__head`, unused `renderSegmentedControl` in `src/renderer/screens/settings.js`, and formatting in `src/main.js` import wrapping.
- Full `node --test` ran 594 tests with 593 passing; the only failure was `test/ui-baseline-smoke.test.js` on `settings-theme: [data-appearance-key='density'] fits viewport height`.
- Focused UI screenshot harness `node --test test/ui-baseline-smoke.test.js` failed on the same Settings viewport assertion before completing refreshed voice-orb proof.
- While running the screenshot harness, concurrent changes to `test/ui-baseline-smoke.test.js` were present and the harness updated/created Settings screenshot artifacts; left those untouched rather than reverting another worker's state.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Hard-coded orb color | CSS scan | Any new raw color in orb block | Tokenize |
| State ambiguous | Screenshot review | Any unclear state | Adjust state token |
| Motion dependency | Reduced motion hides meaning | Any occurrence | Add static state cue |
