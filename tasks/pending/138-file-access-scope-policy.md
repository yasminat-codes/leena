---
id: "138"
title: "File access scope policy"
type: security
status: pending
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
attempts: 0
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
- [ ] Unknown Full Disk Access status does not unlock broad reads.
- [ ] Broad read/search is possible after grant.
- [ ] Write/delete/edit requires confirmation by default.
- [ ] Existing file tool tests still pass.

## Tests Required
- `node --test test/filesystem-tools.test.js test/tool-permissions.test.js`
- `npm run check`

## Outputs
- `src/realtime/tools/filesystem-tools.js`
- `src/realtime/tool-permissions.js`
- Tests as needed.

## Interface Contracts
Trusted Mac Access and trusted write mode are separate states.

## Handoff Notes
To be filled by executor.

## Errors Encountered
To be filled if errors occur.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Broad read unlocked too early | Unknown/denied status test | Any unlock | Fail closed |
| Write bypass | Write tool executes without approval | Any occurrence | Gate permission |
| Path leak | Test/task logs contain home paths | Any sensitive path | Redact before commit |
