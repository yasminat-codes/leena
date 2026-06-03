---
id: "133"
title: "Composio secure credential storage"
type: integration
status: pending
wave: 18
priority: critical
complexity: M
estimated_tokens: 13000
dependencies: ["120", "122"]
context_files:
  - src/providers/provider-settings.js
  - src/ipc/provider-handlers.js
  - src/settings-store.js
  - test/provider-settings-ipc.test.js
skills: []
tags: [composio, credentials, safe-storage]
attempts: 0
created_at: "2026-06-03"
---

## Objective
Add secure Composio credential storage with redacted display, save, clear, and test-ready status plumbing.

## Why This Matters
The user already has Composio credentials ready. They must be stored securely and never leaked into task logs or renderer state.

## Steps
1. Re-read task 120 reference brief and run kencode-search for current Composio credential API anchors.
2. Add a Composio credential store using the same safeStorage pattern as provider secrets.
3. Expose IPC/preload methods for get status, save credential, clear credential, and test connection stub.
4. Redact saved credential values in renderer-visible responses.
5. Add tests proving raw credentials are not persisted or returned.
6. Add privacy scan notes to handoff.

## Acceptance Criteria
- [ ] Composio credential can be saved and cleared.
- [ ] Renderer sees only configured/redacted status.
- [ ] Raw credential is not stored in plaintext.
- [ ] Tests cover redacted placeholder preservation.

## Tests Required
- `node --test test/provider-settings-ipc.test.js`
- New focused Composio credential test.
- `npm run check`

## Outputs
- Secure credential helper or handler file.
- `src/preload.js`
- `src/main.js` or serialized main integration handoff.
- Focused tests.

## Interface Contracts
Composio credentials are never printed, committed, or returned unredacted.

## Handoff Notes
To be filled by executor.

## Errors Encountered
To be filled if errors occur.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Secret in plaintext | Storage scan | Any raw value | Replace with safeStorage codec |
| Secret in renderer | IPC response contains value | Any occurrence | Return redacted placeholder |
| Test uses real key | Env/log scan | Any key-like value | Replace with fake fixture |
