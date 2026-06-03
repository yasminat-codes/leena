---
id: "145"
title: "Integration test matrix"
type: test
status: pending
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
attempts: 0
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
- [ ] Matrix exists in `tasks/artifacts/post-mvp-integration-test-matrix.md`.
- [ ] Automated tests cover every day-one integration.
- [ ] No tests require real user credentials or real Apple Calendar mutation.
- [ ] Unknown statuses fail closed.

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
To be filled by executor.

## Errors Encountered
To be filled if errors occur.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Real credential needed | Test env dependency | Any occurrence | Replace with fake/mock |
| Real calendar mutated | Test side effect | Any occurrence | Mock adapter |
| Unknown allowed | Permission test | Any occurrence | Fail closed |
