---
id: "143"
title: "Theme-aware voice orb"
type: ui
status: pending
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
attempts: 0
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
- [ ] Orb colors shift with treatment/theme.
- [ ] Starting/listening/speaking/error states are visually distinct.
- [ ] No oversized green shadow returns.
- [ ] Reduced motion state remains understandable.

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
To be filled by executor.

## Errors Encountered
To be filled if errors occur.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Hard-coded orb color | CSS scan | Any new raw color in orb block | Tokenize |
| State ambiguous | Screenshot review | Any unclear state | Adjust state token |
| Motion dependency | Reduced motion hides meaning | Any occurrence | Add static state cue |
