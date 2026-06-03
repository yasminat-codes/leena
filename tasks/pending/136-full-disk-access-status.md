---
id: "136"
title: "Full Disk Access status"
type: integration
status: pending
wave: 19
priority: critical
complexity: M
estimated_tokens: 12000
dependencies: ["135"]
context_files:
  - src/os-permissions.js
  - src/main.js
  - src/preload.js
  - test/os-permissions.test.js
skills: []
tags: [full-disk-access, macos, permissions]
attempts: 0
created_at: "2026-06-03"
---

## Objective
Add Full Disk Access guidance and best-effort status detection without claiming the app can grant the permission itself.

## Why This Matters
Full Disk Access is a high-power Mac capability. Leena must guide the user correctly and avoid dangerous or false behavior.

## Steps
1. Re-read task 122 trust contract and run kencode-search for current macOS Full Disk Access detection patterns.
2. Add a `full-disk-access` permission definition with clear label, description, and activation copy.
3. Add macOS settings deep link fallback for Privacy/Full Disk Access when available.
4. Implement best-effort status detection using a safe read probe if official status API is unavailable.
5. Expose status through existing permissions IPC/preload.
6. Add tests for granted, denied/unknown, unsupported, and open-settings behavior.

## Acceptance Criteria
- [ ] Full Disk Access status appears in permissions snapshots.
- [ ] Open Settings routes to macOS privacy settings or general privacy fallback.
- [ ] Detection never reads or prints private file contents.
- [ ] Unsupported/non-mac state is honest.

## Tests Required
- `node --test test/os-permissions.test.js`
- `npm run check`

## Outputs
- `src/os-permissions.js`
- `src/main.js` if status handler changes are needed.
- `src/preload.js` if exposed API changes.
- `test/os-permissions.test.js`

## Interface Contracts
Status probe may return `unknown`; unknown must not be treated as granted.

## Handoff Notes
To be filled by executor.

## Errors Encountered
To be filled if errors occur.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Private content logged | Diagnostic scan | Any content | Remove logging immediately |
| Unknown treated granted | Status mapper | Any occurrence | Fail closed |
| Deep link broken | Open settings result | Error | Fallback to general privacy URL |
