---
id: "018"
title: "Command Center — all 4 variants and 6 assistant states"
type: ui
status: pending
priority: high
complexity: L
estimated_tokens: 22000
dependencies: ["012", "010"]
context_files:
  - design-system/Leena Design System.md
  - src/renderer/leena.css
  - src/renderer/renderer.js
skills: []
tags: [phase-0, command-center, voice-ui]
attempts: 0
created_at: "2026-06-01"
---

## Objective
Build all 4 Command Center variants (mini-orb, mini-pill, compact, expanded) and the 6 assistant states (idle, listening, thinking, acting, done, error) as a self-contained component with 260ms animated transitions, using design system tokens.

## Why This Matters
The Command Center is Leena's primary voice interaction surface — it's the floating HUD that appears on ⌘Space. All 4 size variants and 6 states must be visually correct and smoothly animated before real voice functionality is wired. This is the most visually complex component.

## Steps
1. Create `src/renderer/components/command-center.js` exporting a `CommandCenter` class (or factory function) with methods: `setVariant('mini-orb' | 'mini-pill' | 'compact' | 'expanded')`, `setState('idle' | 'listening' | 'thinking' | 'acting' | 'done' | 'error')`, `mount(container)`, `destroy()`.
2. Implement the 4 variant HTML structures per §6: `cc--mini-orb` (44×44 orb dot), `cc--mini` (200×52 pill with orb + wave + timer), `cc--compact` (560×76 orb + transcript + wave), `cc--expanded` (640×auto with preview row + hint). All share the `.cc` base class with bright floating-glass styling.
3. Implement the 6 assistant states per §8: Idle (static orb, "READY" faint), Listening (breathing orb scale, animated wave, red live dot, "LISTENING"), Thinking (slow rotate sheen, shimmer wave, "THINKING..."), Acting (steady orb, preview row visible), Done (success pulse + ✓, "DONE" green), Error (shake 2px ×2, "DIDN'T CATCH THAT" red).
4. Add CSS transitions for variant switching: width, height, border-radius animate over 260ms `cubic-bezier(.2,.7,.3,1)`; content cross-fades in 120ms. Add keyframe animations: `ccpulse` for mini-orb listening state, wave bar animation (1.1s cycle), orb breathing (1.4s).
5. Add `prefers-reduced-motion` handling: drop pulse/wave/breathing animations, keep instant state swaps with 0-80ms fades.
6. Add a demo mode function `demoAllStates()` that cycles through all variants × states on a timer (for Phase 0 visual review). Wire this to a keyboard shortcut (e.g., Ctrl+D) that's only active in development.
7. Add CSS for the command center to `leena.css` or a separate `command-center.css` imported from `leena.css`.

## Acceptance Criteria
- [ ] All 4 variants render correctly with proper dimensions and styling
- [ ] All 6 states show correct visual treatment (orb, wave, label, color)
- [ ] Transitions between variants animate smoothly at 260ms
- [ ] State changes show correct label, orb behavior, and color cue
- [ ] `ccpulse` animation plays on mini-orb listening state
- [ ] Wave bars animate while listening (1.1s cycle)
- [ ] `prefers-reduced-motion` removes animations
- [ ] Demo mode cycles through all combinations
- [ ] Floating glass effect visible (blur + translucent bg)
- [ ] `npm run check` passes

## Tests Required
- `test/command-center.test.js`: Test `CommandCenter` class API — `setVariant()` returns valid state, `setState()` accepts all 6 states without error, `mount()`/`destroy()` don't throw. Verify variant dimensions match spec. Test that demo mode function exists.

## Outputs
- `src/renderer/components/command-center.js` — CommandCenter component
- CSS additions to `leena.css` or new `src/renderer/components/command-center.css`
- `test/command-center.test.js`

## Interface Contracts
- `CommandCenter` is instantiated by `renderer.js` to handle voice UI state
- Phase 1 (hotkey) will trigger `setVariant('compact')` on ⌘Space
- Realtime engine will call `setState()` as conversation progresses
- The expanded variant's preview row will be populated by tool results in Phase 6

## Handoff Notes
_Filled after completion._

## Errors Encountered
_Filled if errors occur._

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Transition jank | Visual check of variant switches | Any stutter/flash | Profile CSS transitions; check will-change usage |
| State label incorrect | Check each state's label text | Any mismatch with §8 | Fix label map in setState() |
| Glass effect not working | Check backdrop-filter support | No blur visible | Verify -webkit-backdrop-filter prefix for Electron |
