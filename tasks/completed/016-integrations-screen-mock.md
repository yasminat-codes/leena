---
id: "016"
title: "Integrations screen with mock data"
type: ui
status: completed
priority: high
complexity: S
estimated_tokens: 10000
dependencies: ["012"]
context_files:
  - design-system/Leena Design System.md
  - src/renderer/shell.js
  - src/renderer/leena.css
skills: []
tags: [phase-0, screen, integrations, mcp]
attempts: 1
claim_started: "2026-06-02T02:05:14Z"
completed_at: "2026-06-02T02:19:22Z"
created_at: "2026-06-01"
---

## Objective
Build the Integrations screen showing a glass header with stats and a 3-column tile grid of available integrations/MCP servers, each with On/Connect status chips, using mock data.

## Why This Matters
The Integrations screen is where users manage MCP server connections and tool access. Validating the tile grid layout, status chips, and the glass header stat display ensures the MCP management UI (Phase 5) has a solid visual foundation.

## Steps
1. Create `src/renderer/screens/integrations.js` exporting `renderIntegrations()`.
2. Build the glass header (`.panel-glass`): mono eyebrow "/ connect your tools", large display stat (`.lx-display`) showing "6 / 9" (connected/total), and a subtitle line.
3. Build the 3-column tile grid below the header. Each tile is a `.card` with: `.tooldot` (app icon with gradient — Calendar, Mail, Slack, Notion, Spotify, Messages, Safari, MCP Server 1, MCP Server 2), app name (`.lx-h3`), brief description (`.lx-sm --text-dim`), and a status `.chip` — green "On" for connected, accent "+ Connect" for available, or `.chip` "MCP" for MCP servers.
4. Wire `renderIntegrations()` into `shell.js` for the Integrations nav item.
5. Add `MOCK_INTEGRATIONS_DATA` array with 9 entries, each having `{ id, name, description, icon, iconGradient, status: 'connected' | 'available' | 'mcp' }`.

## Acceptance Criteria
- [ ] Integrations screen renders when Integrations nav item is selected
- [ ] Glass header shows stat counter and eyebrow text
- [ ] 3-column tile grid with 9 integration tiles
- [ ] Connected integrations show green "On" chip
- [ ] Available integrations show accent "+ Connect" chip
- [ ] MCP servers show "MCP" chip with distinct styling
- [ ] All icons use correct gradient colors from §3
- [ ] All styling from leena.css tokens
- [ ] `npm run check` passes

## Tests Required
- `test/integrations-screen.test.js`: Verify `renderIntegrations()` returns HTML with expected tile count and status chip classes.

## Outputs
- `src/renderer/screens/integrations.js`
- `test/integrations-screen.test.js`
- `src/renderer/shell.js` — integrated Integrations route into `#shell-content`
- `src/renderer/leena.css` — responsive integrations header/grid/tile styles and status chip classes

## Interface Contracts
- `renderIntegrations()` returns HTML mountable in `.content`
- Phase 5 (MCP) replaces mock MCP server entries with live `mcp_servers` table data
- Tile click handler is visual-only in Phase 0; Phase 5 wires to MCP connect/disconnect

## Handoff Notes
- `renderIntegrations()` returns an HTML string and keeps MCP mock entries isolated for Phase 5 replacement.
- Parent verification passed `npm run check`, `node --test` (186 tests), `node --check` on changed JS/test files, `git diff --check`, output existence checks, and an Electron startup smoke.

## Errors Encountered
- None.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Grid overflow on narrow window | Visual test at min window width | Tiles clip or stack wrong | Add grid auto-fit or min-width clamp |
| MCP mock shape diverges from mcp_servers schema | Compare with data-model.md | >1 field mismatch | Align mock shape |
