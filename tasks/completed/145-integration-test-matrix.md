---
id: "145"
title: "Integration test matrix"
type: test
status: completed
wave: 22
priority: critical
complexity: M
estimated_tokens: 15000
dependencies: ["132", "134", "136", "137", "138", "139"]
context_files:
  - test/mcp-integration.test.js
  - test/mcp-permission-gate.test.js
  - test/os-permissions.test.js
  - test/filesystem-tools.test.js
  - test/tool-permissions.test.js
skills: []
tags: [testing, composio, mcp, mac-access]
attempts: 1
claim_started: "2026-06-04T05:04:44Z"
completed_at: "2026-06-04T05:17:44Z"
created_at: "2026-06-03"
---

## Objective
Create a rigorous automated integration matrix for Composio, Custom MCP, Mac access, Full Disk Access, Apple Calendar, file access, and permission confirmations.

## Why This Matters
The user specifically called out rigorous testing, especially for Apple products and high-power integrations.

## Steps
1. Build a test matrix table mapping each integration to happy path, missing credential, denied permission, unknown status, and write-confirmation cases.
2. Add mocked tests for Composio tool refresh and MCP server lifecycle.
3. Add mocked tests for Full Disk Access and Apple Calendar status/denial.
4. Add file access tests for trusted read and gated write.
5. Add permission confirmation tests for MCP/Composio write tools.
6. Ensure full `node --test` passes.

## Acceptance Criteria
- [x] Matrix exists in `tasks/artifacts/post-mvp-integration-test-matrix.md`.
- [x] Automated tests cover every day-one integration.
- [x] No tests require real user credentials or real Apple Calendar mutation.
- [x] Unknown statuses fail closed.

## Tests Required
- `node --test`
- `npm run check`
- `git diff --check`

## Outputs
- `tasks/artifacts/post-mvp-integration-test-matrix.md`
- Focused integration tests across MCP, Composio, OS permissions, files, and tools.

## Interface Contracts
Tests must use mocks/fakes for credentials and Apple resources; owner-granted GUI smoke remains manual unless explicitly changed.

## Handoff Notes
- Added `test/post-mvp-integration-matrix.test.js` as the focused cross-contract suite for Composio refresh, Custom MCP lifecycle, Mac access, Full Disk Access, Apple Calendar, file access, and central permission confirmations.
- Added `tasks/artifacts/post-mvp-integration-test-matrix.md` with row-by-row happy path, missing credential, denied permission, unknown/stale, write-confirmation, and automated-anchor coverage.
- Tests use fake Composio credentials/session responses, fake MCP transports/clients, fake TCC rows, fake Full Disk Access probes, and temporary filesystem sandboxes only. No real owner credentials, Apple Calendar data, or broad owner-file access are touched.
- Parent review tightened the Composio matrix case so the fake tool schema carries write-risk metadata, asserts a `write` permission request, and proves denied confirmation prevents the integration call.
- Parent independent verification passed: `node --check test/post-mvp-integration-matrix.test.js`, `node --test test/post-mvp-integration-matrix.test.js` (6/6), `npm run check`, full `node --test` (637/637), and `git diff --check`.

## Errors Encountered
- Worker fixed a focused Mac-control helper assertion by passing raw runtime args into `shouldRequireToolConfirmation()`.
- Worker normalized the new focused test with Biome after `npm run check` reported formatting/import-order issues.
- Parent review found the first Composio fake schema did not actually infer write risk; fixed by adding `filePath` schema/args and denied-confirmation call prevention coverage.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Real credential needed | Test env dependency | Any occurrence | Replace with fake/mock |
| Real calendar mutated | Test side effect | Any occurrence | Mock adapter |
| Unknown allowed | Permission test | Any occurrence | Fail closed |
