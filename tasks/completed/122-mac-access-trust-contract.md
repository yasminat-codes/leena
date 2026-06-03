---
id: "122"
title: "Mac access trust contract"
type: security
status: completed
completed_at: "2026-06-03T21:27:08Z"
wave: 17
priority: critical
complexity: S
estimated_tokens: 7000
dependencies: []
context_files:
  - src/os-permissions.js
  - src/realtime/tool-permissions.js
  - test/tool-permissions.test.js
  - test/os-permissions.test.js
skills: []
tags: [security, mac-access, permissions, full-disk-access]
attempts: 1
claim_started: "2026-06-03T21:08:47Z"
created_at: "2026-06-03"
---

## Objective
Define the trust contract for Mac access: read/search may run after grant, while write/delete/control actions require confirmation unless trusted write mode is explicitly enabled.

## Why This Matters
The user wants broad Mac access and independent action, but destructive actions must remain safe and auditable. This contract blocks all Apple, file, Composio, and MCP action tasks.

## Steps
1. Run kencode-search for macOS Full Disk Access, Accessibility, Calendar, and Electron permission handling anchors.
2. Audit current `tool-permissions.js` levels for file, calendar, screenshot, and computer-use tools.
3. Write `tasks/artifacts/mac-access-trust-contract.md` with allowed read actions, gated write actions, and trusted-write override rules.
4. Define UI copy and state names: `Trusted Mac Access`, `Full Disk Access`, and `Allow trusted write actions`.
5. Define test expectations for unknown/stale tool metadata to fail closed.
6. Link downstream tasks that must obey the contract.

## Acceptance Criteria
- [x] Contract says Leena opens macOS settings and detects/guides status, not silently grants access.
- [x] Contract separates read/search from write/delete/control.
- [x] Contract covers Composio, MCP tools, Apple Calendar, file tools, screenshots, and OS control.
- [x] Contract includes explicit fail-closed rules.

## Tests Required
No code tests in this task. Downstream implementation tasks must add tests against the contract.

## Outputs
- `tasks/artifacts/mac-access-trust-contract.md`

## Interface Contracts
Every new integration tool must map to read, write, destructive, screen, or control permission levels before it appears in realtime/chat tools.

## Handoff Notes
- Output written to `tasks/artifacts/mac-access-trust-contract.md`.
- kencode-search ran for Electron/macOS permissions, Full Disk Access, Accessibility, Calendar/EventKit, and screen-capture permission anchors. No reusable public implementation snippet was found, so the contract explicitly grounds implementation in official Electron/Apple docs plus current Leena permission/tool tests.
- Downstream tasks must keep Full Disk Access best-effort and content-free, keep Apple Calendar write-only distinct from read access, route Composio through MCP/schema/permission gates, and preserve the central confirmation path for high-power actions.
- Independent orchestrator verification passed: artifact exists, content checks for Trusted Mac Access, Full Disk Access, trusted write, fail-closed rules, Composio/MCP/Apple Calendar/file/screen/control coverage passed, privacy scan clean, `npm run check` passed, focused UI harness passed, full `node --test` passed 542/542, and `git diff --check` passed.

## Errors Encountered
- Public kencode searches did not return a production-ready Electron Full Disk Access implementation anchor; the contract records official-doc behavior and requires implementation-time verification on macOS.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Tool has no risk level | Permission lookup returns unknown | Any shipped tool | Block tool exposure |
| UI implies silent grant | Copy audit | Any misleading text | Replace with settings-guided wording |
| Trusted mode too broad | Write runs without toggle | Any occurrence | Force confirmation prompt |
