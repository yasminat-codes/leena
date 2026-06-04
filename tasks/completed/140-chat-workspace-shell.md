---
id: "140"
title: "Chat workspace shell"
type: ui
status: completed
wave: 19
priority: high
complexity: M
estimated_tokens: 12000
dependencies: ["124"]
context_files:
  - src/renderer/screens/chat.js
  - src/renderer/components/command-center.js
  - src/renderer/components/chat-input.js
  - test/text-chat.test.js
  - test/command-center.test.js
skills: []
tags: [chat, workspace, ui]
attempts: 1
claim_started: "2026-06-04T00:04:46Z"
completed_at: "2026-06-04T00:37:29Z"
created_at: "2026-06-03"
---

## Objective
Build the Chat screen as a full conversation workspace shell with history rail, active conversation area, header controls, and composer.

## Why This Matters
The approved UX is a real conversation workspace, not a lightweight hidden panel.

## Steps
1. Run kencode-search for production chat workspace layouts.
2. Render conversation rail, active transcript area, provider/model header area, and composer.
3. Reuse existing chat input and bubble components where possible.
4. Keep provider/model selectors tucked into the header.
5. Add voice button affordance in composer without starting voice yet.
6. Add rendering tests for the workspace shell.

## Acceptance Criteria
- [x] Chat screen has conversation rail, transcript area, and composer.
- [x] Provider/model controls are present but compact.
- [x] Empty state is useful and not marketing-like.
- [x] Layout fits approved shell size with no overlap.

## Tests Required
- `node --test test/text-chat.test.js test/command-center.test.js test/shell-rendering.test.js`
- UI screenshot harness from task 121.
- `npm run check`

## Outputs
- `src/renderer/screens/chat.js`
- `src/renderer/leena.css`
- Chat tests as needed.

## Interface Contracts
Chat shell must use existing `window.leena.chat.send` and `chat:chunk` paths in later wiring.

## Handoff Notes
- Ran required kencode-search before implementation edits. Curated/live searches for production chat workspace layouts did not return a usable narrow reference, so the implementation followed existing Leena shell primitives and CommandCenter chat contracts.
- Changed `src/renderer/screens/chat.js` to render a real Chat workspace shell: conversation rail, active workspace header, compact provider/model selects, transcript log, operational empty state, composer, existing `chat-input`/`chat-bubble` class hooks, static `window.leena.chat.send` / `chat:chunk` data hooks, and disabled voice affordance.
- Added focused render coverage in `test/text-chat.test.js` for rail/transcript/composer presence, provider/model default-unset controls, bridge hook names, and inert voice affordance.
- Did not edit parent-serialized `src/renderer/leena.css`; used existing `integrations-detail-layout`, `settings-card`, `integrations-detail`, `activity-screen__header`, `activity-screen__list`, `settings-select`, `settings-input`, `btn`, `chat-input`, and `chat-bubble` hooks for styling handoff.
- Changed-file gates passed:
  - `node --check src/renderer/screens/chat.js`
  - `node --check test/text-chat.test.js`
  - `npx biome check src/renderer/screens/chat.js test/text-chat.test.js`
  - `node --test test/text-chat.test.js test/command-center.test.js` (23/23)
- Required combined focused gate was attempted: `node --test test/text-chat.test.js test/command-center.test.js test/shell-rendering.test.js` ran task 140 tests green but failed 2 shell-rendering tests due out-of-scope `src/renderer/screens/settings.js` `renderHotkeySettings is not defined`.
- Full gates attempted:
  - `npm run check` failed only on out-of-scope Settings/Integrations worker edits.
  - `node --test` ran 576 tests, 571 passed, 5 failed in out-of-scope Settings/shell/UI-baseline paths.
- UI screenshot harness from task 121 was attempted as part of full `node --test`; `test/ui-baseline-smoke.test.js` timed out waiting for `#app-shell[data-onboarding='complete']`, likely downstream of the concurrent Settings/shell breakage. It did not reach Chat-specific capture.
- Learning for parent bookkeeping: when `src/renderer/leena.css` is parent-owned, use existing layout primitives such as `integrations-detail-layout` for a small rail plus large detail pane and keep task-specific `chat-screen__*` hooks for the serialized styling pass.

- 2026-06-04T00:37:29Z parent verification: Chat workspace shell completed with conversation rail, active transcript area, compact provider/model controls, composer, existing `window.leena.chat.send` / `chat:chunk` hooks, and disabled voice affordance. Gates passed: `npm run check`, `node --test test/text-chat.test.js test/command-center.test.js test/shell-rendering.test.js`, full `node --test` (596/596), and output existence checks.

## Errors Encountered
- `tasks/LEARNINGS.md` is actively claimed by `wave-19-parent-bookkeeping`; this worker did not edit it despite the task mandate. Parent should copy the learning above if it wants a durable LEARNINGS entry.
- Out-of-scope gate blockers observed:
  - `test/settings-screen.test.js`: `resolveSettingsRouterRoot is not defined` and `renderHotkeySettings is not defined`.
  - `test/shell-rendering.test.js`: `renderHotkeySettings is not defined`.
  - `npm run check`: unused `SETTINGS_DETAIL_IDS`, unused `renderHotkeySettingsContent`, formatter drift in `src/renderer/screens/settings.js` and `src/renderer/screens/integrations.js`.
  - `test/ui-baseline-smoke.test.js`: timeout waiting for `#app-shell[data-onboarding='complete']`.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Chat hidden | Sidebar route does not show workspace | Any failure | Fix route/screen mount |
| Layout cramped | Composer/rail overlaps | Any screenshot issue | Rebalance grid |
| Duplicate chat stack | New IPC path invented | Any occurrence | Reuse existing bridge |
