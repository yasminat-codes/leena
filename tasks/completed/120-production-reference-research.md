---
id: "120"
title: "Production reference research for UI, Composio, MCP, and Mac access"
type: research
status: completed
completed_at: "2026-06-03T21:27:08Z"
wave: 17
priority: critical
complexity: S
estimated_tokens: 9000
dependencies: []
context_files:
  - CLAUDE.md
  - plans/phases/phase-4-mcp-composio.md
  - plans/phases/phase-6-ui-ux.md
skills: []
tags: [research, kencode-search, composio, mcp, mac-access, ui]
attempts: 1
claim_started: "2026-06-03T21:08:47Z"
created_at: "2026-06-03"
---

## Objective
Create a concise implementation reference brief for the UI polish, Composio, MCP, Apple/Mac access, Full Disk Access, and production testing work.

## Why This Matters
All later refinement tasks depend on real production references, not guessed APIs. This task blocks the Composio, MCP, Mac access, and UI execution tasks.

## Steps
1. Run kencode-search for `ComposioHQ/composio`, `TrendpilotAI/openclaw-n8n-railway`, MCP TypeScript SDK transports, Electron macOS permission APIs, and polished dashboard settings references.
2. Browse only primary official docs when code search does not prove an API contract.
3. Record what was found, what was not found, and which repo/API anchors are safe to reuse.
4. Identify exact APIs to verify during implementation: Composio credential/session/toolkit flow, MCP HTTP/stdio transport flow, macOS privacy deep links/status checks, and UI screenshot proof.
5. Record risks where public code search did not find enough evidence.
6. Write the brief in `tasks/artifacts/post-mvp-reference-brief.md`.

## Acceptance Criteria
- [x] Brief includes Composio official repo/docs anchors and any usable OpenClaw-related reference found.
- [x] Brief includes MCP TypeScript SDK transport anchors.
- [x] Brief includes Electron/macOS permission anchors and a note that Full Disk Access cannot be silently granted.
- [x] Brief includes dashboard/settings UI references and what patterns to adapt.
- [x] Brief states all no-result searches so future agents do not fabricate references.

## Tests Required
No automated tests. Verify by reading the brief and checking that every implementation task has a reference source or an explicit "research gap" note.

## Outputs
- `tasks/artifacts/post-mvp-reference-brief.md`

## Interface Contracts
Downstream tasks must cite this brief in their handoff notes before using any external API pattern.

## Handoff Notes
- Output written to `tasks/artifacts/post-mvp-reference-brief.md`.
- kencode-search ran for Composio official repo/API anchors, OpenClaw/Railway references, MCP TypeScript SDK transports, Electron/macOS permission anchors, and production dashboard/settings references.
- The brief records explicit no-result searches so downstream tasks do not fabricate examples.
- Research gaps preserved: Composio SDK shape must be verified at install time; MCP v2 docs must not be mixed with Leena's v1 SDK package; Full Disk Access remains settings-guided/probe-only; real Composio credentials and Apple/Mac grants were not exercised.
- Independent orchestrator verification passed: artifact exists, content checks for Composio/OpenClaw/MCP/Electron/Full Disk Access/UI references passed, privacy scan clean, `npm run check` passed, focused UI harness passed, full `node --test` passed 542/542, and `git diff --check` passed.

## Errors Encountered
- kencode did not index the exact `TrendpilotAI/openclaw-n8n-railway` snippets; the brief records the gap and treats that repo as product/deployment reference only.
- Electron permission code examples were not found through kencode; official Electron/Apple docs and local source are the authoritative anchors.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Reference is vague | Missing repo/doc URL | Any occurrence | Re-run targeted search with literal API anchors |
| API is stale | Official doc conflicts with code search | Any conflict | Prefer official docs and record the mismatch |
| Mac access is overclaimed | Plan says app grants permission itself | Any occurrence | Replace with "open settings + detect/guide" |
