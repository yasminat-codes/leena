---
id: "019"
title: "Orb and waveform visualization components"
type: ui
status: in_progress
priority: high
complexity: M
estimated_tokens: 14000
dependencies: ["010"]
context_files:
  - design-system/Leena Design System.md
  - src/renderer/leena.css
skills: []
tags: [phase-0, orb, waveform, animation]
attempts: 1
claim_started: "2026-06-02T00:13:31Z"
created_at: "2026-06-01"
---

## Objective
Build standalone Orb and Waveform components as reusable modules — the orb is Leena's visual heartbeat (multi-radial gradient sphere) and the waveform is the voice activity indicator (animated bar visualization).

## Why This Matters
The orb and waveform are used in multiple places: the Home screen hero, all 4 Command Center variants, and the call window mode. Building them as isolated, configurable components avoids duplication and ensures consistent animation behavior.

## Steps
1. Create `src/renderer/components/orb.js` exporting `createOrb({ size, animated, ring })` that returns a DOM element. Sizes: 28 (mini), 40 (bar), 64 (medium), 104 (hero). Uses `--orb-a/b/c` gradient tokens. Includes optional `.orb__ring` outer element. Has methods: `pulse()` (success), `breathe(on/off)` (listening scale 1→1.03), `shake()` (error), `stop()`.
2. Create `src/renderer/components/waveform.js` exporting `createWaveform({ bars, height, color })` that returns a DOM element. Default: 12 bars at varied heights [8,16,24,12,20,9,18,26,14,10,22,16]px. Uses `currentColor` (inherits from parent). Has methods: `play()` (start 1.1s bar animation), `pause()`, `shimmer()` (thinking state — slow, low amplitude).
3. Add CSS for both components to `leena.css`: `.orb` (radial gradient backgrounds, box-shadow, border-radius:50%), `.orb__ring` (absolute positioned ring), `.wave` (flex container), `.wave i` (bar elements). Add keyframe animations: `@keyframes orb-breathe` (scale 1→1.03), `@keyframes wave-bar` (height cycle).
4. Add `prefers-reduced-motion` styles: orb breathing → instant state change (no animation), wave bars → static at mid-height (no animation), pulse → instant color flash.
5. Write unit test verifying component creation and method calls.

## Acceptance Criteria
- [ ] `createOrb()` produces correct DOM at all 4 sizes (28/40/64/104)
- [ ] Orb displays treatment-specific gradient using `--orb-a/b/c` tokens
- [ ] Orb ring renders when `ring: true`
- [ ] `breathe()`, `pulse()`, `shake()` trigger correct CSS animations
- [ ] `createWaveform()` produces bars with correct default heights
- [ ] `play()` starts bar animation, `pause()` stops it
- [ ] `shimmer()` switches to slow/low wave animation
- [ ] `prefers-reduced-motion` disables all animations
- [ ] Components work in isolation (no dependency on Command Center or shell)
- [ ] `npm run check` passes

## Tests Required
- `test/orb-waveform.test.js`: Test `createOrb()` and `createWaveform()` factory functions — verify they return objects with expected methods. Verify orb supports all 4 sizes. Verify waveform bar count matches config.

## Outputs
- `src/renderer/components/orb.js`
- `src/renderer/components/waveform.js`
- CSS additions to `leena.css` (orb + wave keyframes)
- `test/orb-waveform.test.js`

## Interface Contracts
- Command Center (018) uses `createOrb()` and `createWaveform()` in all variants
- Home screen (013) uses `createOrb({ size: 64 })` in the hero
- Phase 6 voice wiring calls `waveform.play()`/`pause()` based on audio activity
- Orb `breathe()` is called during listening state, `stop()` on idle

## Handoff Notes
_Filled after completion._

## Errors Encountered
_Filled if errors occur._

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Orb gradient not matching treatment | Switch treatment, check orb colors | Orb colors don't change | Verify CSS uses var(--orb-a/b/c) not hardcoded |
| Wave animation jank | Profile animation performance | Any frame drops | Use transform instead of height for animation; use will-change |
| Component memory leak | Create/destroy cycle test | Memory grows unbounded | Ensure animations cancelled in stop()/destroy() |
