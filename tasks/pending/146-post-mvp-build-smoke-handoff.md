---
id: "146"
title: "Post-MVP build smoke handoff"
type: build
status: pending
wave: 23
priority: critical
complexity: M
estimated_tokens: 13000
dependencies: ["144", "145"]
context_files:
  - package.json
  - tasks/DELIVERABLE.md
  - test/build-smoke.test.js
  - tasks/WAL-PROTOCOL.md
skills: []
tags: [build, smoke, deliverable, handoff]
attempts: 0
created_at: "2026-06-03"
---

## Objective
Run the final post-MVP gates, rebuild the unsigned macOS artifact, record checksums, and leave owner GUI smoke as an explicit manual checklist.

## Why This Matters
After UI and integration changes, the app must still package, verify, and launch structurally before owner review.

## Steps
1. Confirm tasks 144 and 145 passed and artifacts exist.
2. Run `npm run check`, full `node --test`, and `git diff --check`.
3. Build with `CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac`.
4. Verify DMG/ZIP structure with the same Wave 16 hdiutil and bundle checks.
5. Record artifact paths and hashes in `tasks/DELIVERABLE.md`.
6. Add owner manual GUI smoke checklist for voice, Chat, Composio, MCP, Full Disk Access, and Apple Calendar.

## Acceptance Criteria
- [ ] Full automated gates pass.
- [ ] DMG and ZIP build successfully.
- [ ] Headless structure checks pass.
- [ ] `tasks/DELIVERABLE.md` records paths, hashes, and manual GUI smoke checklist.
- [ ] No claim is made that owner GUI smoke was completed autonomously.

## Tests Required
- `npm run check`
- `node --test`
- `git diff --check`
- `hdiutil verify` and `hdiutil imageinfo` on the built DMG.

## Outputs
- `dist/Leena-*.dmg`
- `dist/Leena-*.zip`
- `tasks/DELIVERABLE.md`

## Interface Contracts
Final handoff must preserve both build artifacts and an honest manual GUI smoke checklist.

## Handoff Notes
To be filled by executor.

## Errors Encountered
To be filled if errors occur.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Build fails signing | electron-builder output | Signing/cert error | Rebuild unsigned with CSC flag |
| DMG invalid | hdiutil failure | Any failure | Fix packaging before handoff |
| GUI smoke fabricated | Deliverable checklist | Any autonomous checked owner item | Revert to manual unchecked |
