---
id: "131"
title: "Integrations detail shell"
type: ui
status: pending
wave: 18
priority: high
complexity: M
estimated_tokens: 11000
dependencies: ["123", "126"]
context_files:
  - src/renderer/screens/integrations.js
  - src/renderer/leena.css
  - test/integrations-screen.test.js
  - test/integrations-screen-data.test.js
skills: []
tags: [integrations, mcp, composio, apple]
attempts: 0
created_at: "2026-06-03"
---

## Objective
Refactor Integrations into polished cards with in-place detail panels for Composio, Custom MCP, Apple Calendar, Files, and provider health.

## Why This Matters
The current MCP add form is raw and takes over the screen. The approved UX needs a mature integrations workspace.

## Steps
1. Run kencode-search for integration marketplace/detail panel UI patterns.
2. Add integration cards for Composio, Custom MCP, Apple Calendar, Files/Full Disk Access, and Provider Health.
3. Add an in-place detail panel shell shared by every integration.
4. Keep existing MCP server list and connection summary visible.
5. Add empty/loading/error states that use the same card system.
6. Update integration rendering tests.

## Acceptance Criteria
- [ ] Integrations screen no longer opens directly into raw MCP form fields.
- [ ] Composio is first-class and visible.
- [ ] Custom MCP remains available for advanced setup.
- [ ] Existing MCP server list still renders and refreshes.

## Tests Required
- `node --test test/integrations-screen.test.js test/integrations-screen-data.test.js`
- UI screenshot harness from task 121.
- `npm run check`

## Outputs
- `src/renderer/screens/integrations.js`
- `src/renderer/leena.css`
- Integration tests as needed.

## Interface Contracts
Integrations detail panels reuse existing `window.leena.mcp` bridge until new Composio/Mac APIs are added.

## Handoff Notes
To be filled by executor.

## Errors Encountered
To be filled if errors occur.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Raw form visible by default | Initial screenshot | Any raw MCP form fields | Hide under Custom MCP detail |
| MCP list lost | Existing list test fails | Any failure | Preserve server list mount |
| Detail special-cased | Composio-only layout | Any duplicate shell | Extract shared detail shell |
