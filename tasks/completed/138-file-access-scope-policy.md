---
id: "138"
title: "File access scope policy"
type: security
status: completed
wave: 20
priority: critical
complexity: M
estimated_tokens: 11000
dependencies: ["122", "136"]
context_files:
  - src/realtime/tools/filesystem-tools.js
  - src/realtime/tool-permissions.js
  - src/realtime/tools/tool-schemas.js
  - test/filesystem-tools.test.js
  - test/tool-permissions.test.js
skills: []
tags: [files, full-disk-access, security]
attempts: 1
claim_started: "2026-06-04T02:05:17Z"
completed_at: "2026-06-04T02:36:08Z"
created_at: "2026-06-03"
---

## Objective
Make file access honor Full Disk Access and trusted-write policy while preserving safe read/search behavior.

## Why This Matters
The user wants broad computer access. File tools must become more capable without becoming unsafe or opaque.

## Steps
1. Re-read task 122 and task 136 outputs.
2. Audit current filesystem tool schemas and permission levels.
3. Add scope rules for normal workspace access vs Trusted Mac Access.
4. Allow broad read/search only when Full Disk Access is granted or explicitly scoped.
5. Require confirmation for write/edit/delete unless trusted write mode is enabled.
6. Add tests for denied read, granted read, write confirmation, and unknown status.

## Acceptance Criteria
- [x] Unknown Full Disk Access status does not unlock broad reads.
- [x] Broad read/search is possible after grant.
- [x] Write/delete/edit requires confirmation by default.
- [x] Existing file tool tests still pass.

## Tests Required
- `node --test test/filesystem-tools.test.js test/tool-permissions.test.js`
- `npm run check`

## Outputs
- `src/realtime/tools/filesystem-tools.js` — added file-access scope enforcement, Full Disk Access fail-closed checks for broad file access, trusted-write/confirmation gates for write/edit, and relative-path error reporting.
- `src/realtime/tool-permissions.js` — added permission-pending results, trusted-write eligibility helpers, known-tool fail-closed checks, and absolute-path summary redaction.
- `test/filesystem-tools.test.js` — added denied broad read, granted/explicit read, write confirmation, model-supplied confirmation rejection, trusted-write separation, and edit confirmation coverage.
- `test/tool-permissions.test.js` — added pending approval, trusted-write, unknown-tool, and path-redaction coverage.
- `test/all-tools-functional.test.js` — supplied host write approval in the functional tool harness.
- `src/main.js` — passed the audited Full Disk Access snapshot into runtime filesystem options so broad reads can unlock after a real grant.
- `test/wave20-integration.test.js` — locked the main-process Full Disk Access runtime handoff.
- `test/ui-baseline-smoke.test.js` — gate-only Biome formatting of an existing unowned UI-baseline diff so `npm run check` could pass.

## Interface Contracts
Trusted Mac Access and trusted write mode are separate states.

## Handoff Notes
- 2026-06-04T02:17:55Z: Implemented scope-aware filesystem policy in the direct tool boundary. Workspace roots remain readable; `fileAccessScope: "full-disk"` requires `fullDiskAccessStatus: "granted"`; `fileAccessScope: "explicit"` allows user-selected scoped reads without treating unknown Full Disk Access as granted.
- Write/edit execution now requires host-supplied `confirmed: true` or `trustedMacAccess: true` plus `trustedWriteMode: true` with a current scope/grant. Model-supplied `confirmed` arguments are ignored.
- Central permission helpers now keep Trusted Mac Access and trusted write mode separate, fail closed for unknown tools, and redact absolute paths in permission summaries.
- Required `kencode-search` shell command was not on PATH; MCP-backed `mcp__kencode_search.searchCode` was used before code edits. Exact public searches for `Privacy_AllFiles`, `Full Disk Access`, `trustedWrite`, and `confirmToolCall` returned no reusable snippets, so implementation followed task 122/136 contracts and local Leena boundaries.
- Gate-only note: `test/ui-baseline-smoke.test.js` had an existing unowned formatting failure that blocked `npm run check`; only Biome's mechanical formatting was applied to that existing diff.
- 2026-06-04T02:19:55Z: Task 138 focused tests, related functional test, changed-file syntax checks, scoped Biome check, and diff whitespace checks pass. Full `npm run check` passed once after the task 138 changes, then failed on a concurrent active task 141 edit in `src/renderer/screens/chat.js`; did not edit that claimed file.
- Parent integration fixed the live main-process handoff by threading the audited Full Disk Access status into `fileSystem.fullDiskAccessStatus`; `node --test test/wave20-integration.test.js test/filesystem-tools.test.js test/tool-permissions.test.js test/all-tools-functional.test.js` passed.
- Parent verification passed after combined Wave 20 integration and reviewer fix: `npm run check`, full `node --test` (623/623), `node --test test/ui-baseline-smoke.test.js`, changed-file `node --check`, and `git diff --check`.

## Errors Encountered
- `kencode-search` shell binary unavailable on PATH (`zsh: command not found: kencode-search`); used MCP-backed kencode-search tools instead.
- First `npm run check` failed on formatting in `test/tool-permissions.test.js` and an existing `test/ui-baseline-smoke.test.js` formatting issue; both were formatted and the gate passed with CSS descending-specificity warnings only.
- Early full `npm run check` failed after a concurrent task 141 edit in `src/renderer/screens/chat.js`; parent integration resolved the combined diff and terminal `npm run check` passed.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Broad read unlocked too early | Unknown/denied status test | Any unlock | Fail closed |
| Write bypass | Write tool executes without approval | Any occurrence | Gate permission |
| Path leak | Test/task logs contain home paths | Any sensitive path | Redact before commit |
