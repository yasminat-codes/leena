---
id: "011"
title: "Bundle and normalize brand fonts"
type: ui
status: in_progress
priority: high
complexity: S
estimated_tokens: 8000
dependencies: ["010"]
context_files:
  - design-system/Leena Design System.md
  - design-system/ulm-grotesk/
  - design-system/gellix-font/
  - src/renderer/leena.css
skills: []
tags: [phase-0, fonts, assets]
attempts: 1
claim_started: "2026-06-02T00:13:31Z"
created_at: "2026-06-01"
---

## Objective
Copy, rename, and bundle UlmGrotesk, Gellix, and Roboto Mono font files into `src/renderer/assets/fonts/` with canonical filenames, and add all `@font-face` declarations to `leena.css`.

## Why This Matters
The design system mandates bundled local fonts only — no Google Fonts hotlinks (offline Electron app, CSP restrictions). All typography depends on these face files loading correctly. Wrong filenames = invisible text fallback to system-ui.

## Steps
1. Create directory `src/renderer/assets/fonts/`.
2. Copy and rename UlmGrotesk TTF files from `design-system/ulm-grotesk/` to canonical names: `UlmGrotesk-Regular.ttf` (from `FontsFreeNetUlmGroteskRegular31a37af04c031c3123c94d9cced96b6f.ttf`), `UlmGrotesk-Bold.ttf` (from `FontsFreeNetUlmGroteskBold94d4299a1cff25d0157b7ed7aea3accf.ttf`), `UlmGrotesk-Extrabold.ttf` (from `FontsFreeNetUlmGroteskExtrabold0b3118a57784e4d175edb3a9cba99b321.ttf`). Ignore non-UlmGrotesk faces in that directory.
3. Copy Gellix `.woff2` files from `design-system/gellix-font/` — full ramp (Thin through Black + italics) as-is (names already canonical per §2.2).
4. Download Roboto Mono Regular (400) and Medium (500) as `.woff2` from Google Fonts CDN or a local source; save as `RobotoMono-Regular.woff2` and `RobotoMono-Medium.woff2` in the fonts directory.
5. Add all `@font-face` declarations to `src/renderer/leena.css` per §2.2 — UlmGrotesk (400/500/700/800), Gellix (100-900 + italics 400/500/700), Roboto Mono (400/500). All use `font-display:swap` and `url("assets/fonts/...")` relative paths.
6. Remove the Google Fonts `<link>` tags from `src/renderer/index.html` and update CSP to remove `fonts.googleapis.com` and `fonts.gstatic.com` from `style-src` and `font-src`.

## Acceptance Criteria
- [ ] `src/renderer/assets/fonts/` contains UlmGrotesk (3 files), Gellix (12+ woff2 files), Roboto Mono (2 files)
- [ ] All `@font-face` declarations in `leena.css` with correct `url()` paths
- [ ] No Google Fonts `<link>` tags in `index.html`
- [ ] CSP in `index.html` no longer references `fonts.googleapis.com` or `fonts.gstatic.com`
- [ ] `font-src` in CSP updated to `'self'` only
- [ ] `npm run check` passes

## Tests Required
- `test/font-bundle.test.js`: Verify all expected font files exist in `src/renderer/assets/fonts/` by checking filesystem. Verify `leena.css` contains `@font-face` declarations for UlmGrotesk, Gellix, and Roboto Mono. Verify `index.html` contains no `fonts.googleapis.com` references.

## Outputs
- `src/renderer/assets/fonts/` — 17+ font files (3 UlmGrotesk TTF + 12+ Gellix woff2 + 2 Roboto Mono woff2)
- `src/renderer/leena.css` — updated with @font-face declarations
- `src/renderer/index.html` — Google Fonts links removed, CSP tightened
- `test/font-bundle.test.js` — font presence verification test

## Interface Contracts
- All tasks that render text depend on these fonts being loadable via `leena.css` `@font-face`
- `--font-display`, `--font-body`, `--font-mono` custom properties reference these family names
- `index.html` must import `leena.css` (done in task 010's downstream wiring)

## Handoff Notes
_Filled after completion._

## Errors Encountered
_Filled if errors occur._

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Font file missing at runtime | Electron console font loading errors | Any error | Verify file copied + path correct in @font-face |
| System-ui fallback visible | Visual inspection of rendered text | Any page showing system font | Check @font-face src URL matches actual file location |
| CSP blocks font loading | Console CSP violation for font-src | Any violation | Update CSP to allow 'self' for font-src |
