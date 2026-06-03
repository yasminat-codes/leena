---
id: "105"
title: "Command Center driven by real session state"
type: feature
status: completed
priority: high
complexity: M
estimated_tokens: 18000
dependencies: ["018", "055"]
context_files:
  - src/renderer/renderer.js
  - src/renderer/panel.js
  - src/realtime/tools/index.js
skills: []
tags: [phase-7, ui, wire-live, command-center]
attempts: 1
claim_started: "2026-06-02T23:02:41Z"
completed_at: "2026-06-02T23:28:44Z"
created_at: "2026-06-01"
---

## Objective
Wire the four Command Center variants and six assistant states to real-time session events from the realtime engine, replacing the static state mock with live listening/thinking/acting/done/error transitions.

## Why This Matters
The Command Center is Leena's primary interaction surface — the orb, pill, compact, and expanded views. Without real state, it's a static animation. With real state, users see Leena listen, think, act, and respond.

## Steps
1. Create a `SessionStateManager` class in `src/renderer/session-state.js` that subscribes to main-process push events: `realtime:state-changed`, `realtime:tool-executing`, `realtime:response-complete`, `realtime:error`.
2. Map session events to the 6 assistant states: idle (no session), listening (mic active, waiting for speech), thinking (API processing), acting (tool execution in progress), done (response delivered), error (session failure).
3. Wire `SessionStateManager` to the Command Center component — on state change, update the variant's visual state (orb animation, pill text, compact status, expanded content).
4. In the Expanded variant: populate the intent preview panel with real tool call data from `realtime:tool-executing` events (tool name, arguments summary, result preview).
5. Wire the 260ms CSS transitions between states using the existing transition classes from Phase 0.
6. Handle edge cases: rapid state changes (debounce visual transitions), session disconnect mid-action (show error state), reconnection (return to idle).

## Acceptance Criteria
- [ ] Command Center reflects real session state across all 4 variants
- [ ] All 6 assistant states trigger from actual session events
- [ ] Expanded variant shows real tool call data during acting state
- [ ] 260ms transitions are smooth between states
- [ ] Rapid state changes don't cause visual glitches
- [ ] Session disconnect shows error state, reconnect returns to idle

## Tests Required
- `test/session-state-manager.test.js` — mock events, verify state transitions, verify debounce on rapid changes, verify error recovery

## Outputs
- New `src/renderer/session-state.js`
- Modified Command Center component to consume SessionStateManager
- New `test/session-state-manager.test.js`

## Interface Contracts
- Depends on `realtime:state-changed`, `realtime:tool-executing`, `realtime:response-complete`, `realtime:error` push events (task 055 wires these through provider layer)
- Downstream: task 106 (text chat) adds text input to the Command Center using this same state manager

## Handoff Notes
Added `SessionStateManager` and bound it to Command Center instances. The renderer now mounts a live compact Command Center by default, dispatches real Realtime session/tool/done/error events from the data-channel flow, and lets the development Ctrl+D demo temporarily replace the live center. Preload also exposes `onRealtimeStateChanged`, `onRealtimeToolExecuting`, `onRealtimeResponseComplete`, and `onRealtimeError` hooks for main-process push events. Verification passed: `npm run check`, `node --test` 291/291, focused session-state tests, changed JS syntax checks, WAL parse, old-name grep, and `git diff --check`.

## Errors Encountered
Parallel rename integration left one old bridge reference in `src/renderer/session-state.js` and no live renderer mount. Fixed by switching the default bridge to `window.leena`, adding preload listener hooks, emitting DOM `realtime:*` events from the renderer, and mounting a live Command Center from `renderer.js`.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| State stuck on "thinking" | user report or timeout | >30s in thinking state | Add timeout fallback to error state with retry prompt |
| Transition jank on rapid changes | visual glitch | noticeable stutter | Increase debounce; use requestAnimationFrame for transitions |
| Expanded preview empty during tool execution | missing data | 1 occurrence | Verify tool-executing event includes name + args; add fallback text |
