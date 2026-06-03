---
id: "140"
title: "Chat workspace shell"
type: ui
status: pending
wave: 19
priority: high
complexity: M
estimated_tokens: 12000
dependencies: ["124"]
context_files:
  - src/renderer/screens/chat.js
  - src/renderer/components/command-center.js
  - src/renderer/components/chat-input.js
  - test/text-chat.test.js
  - test/command-center.test.js
skills: []
tags: [chat, workspace, ui]
attempts: 0
created_at: "2026-06-03"
---

## Objective
Build the Chat screen as a full conversation workspace shell with history rail, active conversation area, header controls, and composer.

## Why This Matters
The approved UX is a real conversation workspace, not a lightweight hidden panel.

## Steps
1. Run kencode-search for production chat workspace layouts.
2. Render conversation rail, active transcript area, provider/model header area, and composer.
3. Reuse existing chat input and bubble components where possible.
4. Keep provider/model selectors tucked into the header.
5. Add voice button affordance in composer without starting voice yet.
6. Add rendering tests for the workspace shell.

## Acceptance Criteria
- [ ] Chat screen has conversation rail, transcript area, and composer.
- [ ] Provider/model controls are present but compact.
- [ ] Empty state is useful and not marketing-like.
- [ ] Layout fits approved shell size with no overlap.

## Tests Required
- `node --test test/text-chat.test.js test/command-center.test.js test/shell-rendering.test.js`
- UI screenshot harness from task 121.
- `npm run check`

## Outputs
- `src/renderer/screens/chat.js`
- `src/renderer/leena.css`
- Chat tests as needed.

## Interface Contracts
Chat shell must use existing `window.leena.chat.send` and `chat:chunk` paths in later wiring.

## Handoff Notes
To be filled by executor.

## Errors Encountered
To be filled if errors occur.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Chat hidden | Sidebar route does not show workspace | Any failure | Fix route/screen mount |
| Layout cramped | Composer/rail overlaps | Any screenshot issue | Rebalance grid |
| Duplicate chat stack | New IPC path invented | Any occurrence | Reuse existing bridge |
