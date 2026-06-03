---
id: "133"
title: "Composio secure credential storage"
type: integration
status: completed
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
attempts: 1
claim_started: "2026-06-03T22:05:26Z"
completed_at: "2026-06-03T22:27:04Z"
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
- [x] Composio credential can be saved and cleared.
- [x] Renderer sees only configured/redacted status.
- [x] Raw credential is not stored in plaintext.
- [x] Tests cover redacted placeholder preservation.

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
- Re-read `tasks/artifacts/post-mvp-reference-brief.md` before coding.
- Ran task-local kencode-search for current Composio anchors: `from "@composio/core"`, `@composio/client`, `ComposioToolSet`, `new Composio`, `import { Composio } from '@composio/core';`, `connectedAccounts.initiate(`, and `connectedAccounts.update(` all returned no public-code hits. Official docs currently show `@composio/core`, `new Composio({ apiKey })`, and `composio.connectedAccounts.*`; no SDK dependency was added in this storage-only slice.
- Added `COMPOSIO_CREDENTIAL_KEY`, `loadComposioCredential()`, `saveComposioCredential()`, and `clearComposioCredential()` using the existing provider safeStorage codec pattern.
- Added handler-level Composio IPC channels for status, save, clear, and test connection stub. The stub is intentionally offline/test-ready and only reports saved-credential readiness.
- Renderer-visible Composio responses return `configured`, `connected`, `testedAt`, and redacted `apiKey` only. Raw credential values are never returned.
- Did not edit `src/main.js`; existing `registerProviderHandlers()` registration covers the new handler map. Parent serialized integration added `src/preload.js` exposure through `window.leena.composio.getCredentialStatus/saveCredential/clearCredential/testConnection`.
- Focused gates passed: `node --test test/provider-settings-ipc.test.js` (10/10), `node --test test/composio-credentials.test.js` (2/2), and focused Biome on owned files.
- Full `node --test` passed (553/553).
- `git diff --check` passed.
- Parent serialized preload regression added `test/wave18-integration.test.js`.
- Privacy scan over owned code/tests/task notes found 0 local absolute path matches and 0 Composio API key env-var assignment strings. Secret-like matches were limited to existing fake OpenAI-style test fixtures in `test/provider-settings-ipc.test.js`; no values were printed.

## Errors Encountered
- `npm run check` failed after owned-file formatting was fixed because concurrent out-of-scope files still need Biome formatting: `src/renderer/leena.css` and `test/leena-css-tokens.test.js`. This worker left those files untouched per file-claim scope.

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Secret in plaintext | Storage scan | Any raw value | Replace with safeStorage codec |
| Secret in renderer | IPC response contains value | Any occurrence | Return redacted placeholder |
| Test uses real key | Env/log scan | Any key-like value | Replace with fake fixture |
