---
id: "032"
title: "Global rename: Brah → Leena"
type: refactor
status: completed
priority: high
complexity: M
estimated_tokens: 18000
dependencies: ["031"]
context_files:
  - src/main.js
  - src/preload.js
  - src/renderer/renderer.js
  - src/renderer/index.html
  - package.json
  - CLAUDE.md
  - README.md
skills: []
tags: [phase-1, rename, breaking-change]
attempts: 3
claim_started: "2026-06-02T23:02:41Z"
completed_at: "2026-06-02T23:28:44Z"
created_at: "2026-06-01"
---

## Objective
Rename every occurrence of "Brah" / "brah" to "Leena" / "leena" across the entire codebase — package identity, IPC bridge, database file, UI strings, documentation — ensuring zero references to the old name remain.

## Why This Matters
The app is being rebranded from Brah to Leena. Every downstream task depends on the new name. The preload bridge (`window.brah`) is the most critical rename — all renderer code references it. Database migration prevents data loss for existing users.

## Steps
1. Update `package.json`: `name` → `leena`, `productName` → `Leena`, `build.appId` → `com.leena.app`, `build.mac.extendInfo` descriptions (replace "Brah" with "Leena").
2. In `src/preload.js`: change `contextBridge.exposeInMainWorld("brah", {` → `contextBridge.exposeInMainWorld("leena", {`. This is the single most impactful rename — every renderer file that calls `window.brah.*` must update to `window.leena.*`.
3. Search all files under `src/renderer/` for `window.brah` or `brah.` references and replace with `window.leena` / `leena.`. Include `renderer.js`, `panel.js`, `index.html`, and any other files.
4. In `src/realtime/tools/database.js`: update the default database filename from `brah.db` to `lena.db`. Add a migration check at database open: if `lena.db` doesn't exist but `brah.db` does at the same path, rename the file before opening.
5. Update `src/main.js`: any UI-facing strings that say "Brah" → "Leena" (window titles, error messages). Update the `open:mac` script path reference if it contains "Brah".
6. Update `README.md` and `CLAUDE.md` — replace all "Brah" / "brah" references with "Leena" / "leena".
7. Run `npm run check` and `node --test` to verify no regressions. Run `grep -ri "brah" src/ test/ package.json README.md CLAUDE.md` to confirm zero remaining references (exclude node_modules, .git, plans/).

## Acceptance Criteria
- [ ] `package.json` name/productName/appId all reference "leena"
- [ ] `window.leena` is the preload bridge name (not `window.brah`)
- [ ] All renderer code uses `window.leena.*`
- [ ] Database migration: `brah.db` auto-renames to `lena.db` on first open
- [ ] `grep -ri "brah" src/ test/ package.json README.md CLAUDE.md` returns zero matches
- [ ] `npm run check` passes
- [ ] `node --test` passes (existing tests may need `brah` → `leena` updates)

## Tests Required
- `test/rename-migration.test.js` — create a temp `brah.db` file, open database module, verify it renames to `lena.db` and data persists
- Existing test suites pass after rename (may need reference updates)

## Outputs
- Modified: `package.json`, `src/preload.js`, `src/main.js`, `src/renderer/*.js`, `src/renderer/index.html`, `src/realtime/tools/database.js`, `README.md`, `CLAUDE.md`
- New: `test/rename-migration.test.js`

## Interface Contracts
- ALL downstream tasks reference `window.leena` (not `window.brah`)
- Database module exports handle migration transparently — no caller changes needed
- Build output changes from `Brah.app` to `Leena.app`

## Handoff Notes
Global product identity now uses Leena in package metadata, preload bridge, renderer calls, user-facing strings, and docs. The SQLite default path is `lena.db`; opening the default database migrates an existing same-directory legacy DB and sidecar files before connecting, and startup passes the old Electron user-data root so real installs can migrate from the prior support directory. Startup also moves `openai-credentials.json` from the old user-data root when the new Leena credential file does not exist. Reviewer-hardening tests now cover cross-root DB migration, SQLite WAL/SHM sidecar migration with uncheckpointed rows, and credential migration from the old Electron support root. Verification passed: old-name grep over `src/ test/ package.json README.md CLAUDE.md` returned no matches, `npm run check` passed, focused migration/auth tests passed, changed JS syntax checks passed, WAL parse passed, and `git diff --check` passed.

## Errors Encountered
- `test/rename-migration.test.js` initially compared a null-prototype SQLite row directly to a plain object; fixed by spreading the row before `assert.deepEqual`.
- Biome initially requested wrapping in `src/realtime/tools/screenshot-tools.js` and `test/rename-migration.test.js`; fixed by applying the formatter-compatible wrapping.
- Reviewer found the first migration only handled an adjacent legacy DB under the new Leena user-data root; fixed by passing old Electron user-data root candidates into database migration, adding cross-root DB coverage, and migrating the encrypted OpenAI credential file at startup.
- Reviewer-hardening coverage added a WAL/SHM sidecar migration test so uncheckpointed legacy SQLite data cannot be lost during the cross-root rename migration.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Missed brah reference | grep -ri "brah" src/ count | >0 | Re-scan and fix remaining references |
| Test failures after rename | node --test exit code | non-zero | Fix test references to old name |
| DB migration data loss | lena.db missing tables after rename | Any | Fix rename logic, test with populated DB |
