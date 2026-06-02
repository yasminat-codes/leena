# Lena — Testing Plan

## Runner & toolchain

- **Test runner:** `node --test` (Node built-ins, no additional framework)
- **Assertions:** `node:assert/strict`
- **Lint/format gate:** `npm run check` (Biome format-check + lint) runs first inside `npm test`
- **Full gate command:** `npm test` = `npm run check && node --test`
- **Pattern per test file:** `withTempDir` helper that creates a `mkdtemp` directory, calls `setDatabaseUserDataPath`, runs the callback, then `closeDatabase` + `rm` in `finally`. Each test is a top-level `test(...)` call.
- **ESM:** all test files use `import` — match project convention.

---

## Existing suites (test/)

| File | Covers |
|---|---|
| `activity-store.test.js` | record/list activity log, sanitization, newest-first ordering |
| `agent-profile-store.test.js` | profile save/load, defaults |
| `all-tools-functional.test.js` | smoke-fires every registered tool name returns a non-throw result |
| `computer-use-actions.test.js` | action builders for browser/OS computer-use |
| `computer-use-os.test.js` | OS-level computer-use steps (mocked nut-js) |
| `computer-use-tools.test.js` | tool dispatch for computer-use, args validation |
| `filesystem-tools.test.js` | read/write/list file tool implementations |
| `microphone-store.test.js` | mute state persistence |
| `os-permissions.test.js` | permission status detection + settings deep-links |
| `planner-store.test.js` | planner CRUD, SQLite persistence, legacy JSON migration |
| `prompts.test.js` | `buildRealtimeInstructions` output shape |
| `realtime-playback.test.js` | audio queue drain ordering |
| `realtime-response-queue.test.js` | response queueing, dedup, flush |
| `realtime-tool-handler.test.js` | tool handler routing, unknown-tool fallback |
| `session-tools.test.js` | session create/end, context injection |
| `tool-permissions.test.js` | per-tool permission level lookups |
| `tool-schemas.test.js` | schema shapes, required fields, no unknown keys |
| `web-tools.test.js` | web search/fetch tool implementations |
| `window-state-store.test.js` | window size/position persistence |

---

## New unit tests by phase

All new files land in `test/`. Same `withTempDir` + `closeDatabase` pattern as existing suites.

### Phase 1 — Foundation & settings

**File:** `test/settings-store.test.js`

| Test | What it asserts |
|---|---|
| Round-trip: save OpenAI API key, load back | `safeStorage`-backed store returns identical string; no plaintext in SQLite |
| Round-trip: save + load Composio key, Mem0 key | same pattern; optional fields return `null` when absent |
| Onboarding state transitions | `isOnboarded()` false before first key write, true after |
| Second-user isolation | two separate `userData` paths do not bleed key values |

### Phase 2 — Memory

**File:** `test/memory-store.test.js`

Tests operate against the `MemoryStore` interface (`remember / recall / consolidate`) backed by the sqlite baseline. Each test uses a fresh `withTempDir`.

| Test | What it asserts |
|---|---|
| Extraction round-trip | `remember({ role, content })` writes ≥1 row to `memories_episodic`; returned id is a positive integer |
| Append-only invariant — episodic | after `remember(e1)`, `remember(e2)`, the row count is exactly 2; a direct SQL `DELETE` attempt via the store interface throws or is unavailable; row count is still 2 |
| Append-only invariant — no DELETE path exposed | `MemoryStore` interface has no `deleteEpisodic` method; any attempt to delete episodic rows via the public interface produces an error |
| Recall scoring — similarity wins | two facts stored; query semantically close to fact A scores fact A first |
| Recall scoring — recency weight | two semantically equal facts at different timestamps; more recent scores first when similarity is tied |
| Recall scoring — confidence weight | two identical-similarity, same-timestamp facts with different confidence values; higher confidence scores first |
| Recall returns top-K only | store has 10 facts; `recall(query, 3)` returns exactly 3 |
| Recall across cold open | close the database, re-open with same path, `recall` returns same top result — the cross-session headline criterion at unit level |
| Consolidation dedup | store two near-identical semantic facts; `consolidate()` reduces to one row in `memories_semantic` |
| Consolidation preserves original episodic | after consolidation, episodic row count unchanged |
| Mem0 adapter satisfies interface | construct `Mem0MemoryStore`; call `remember`, `recall(q,1)`, `consolidate()` — no throw; returned shapes match baseline contract |

### Phase 3 — Identity

**File:** `test/identity-prompts.test.js`

Tests for `buildRealtimeInstructions` composition. Mock `agentProfileStore.getProfile()` to return controlled values; mock `memoryStore.recall()` to return a fixed fact list.

| Test | What it asserts |
|---|---|
| Identity block present | returned instructions string contains the user-set `name` value |
| Persona block present | returned string contains the active persona's tone keywords |
| Memory injection present | returned string contains the injected fact from the mock recall result |
| Runtime block present | returned string contains current date/time marker |
| Empty memory — no injection block | when recall returns `[]`, the "What You Know" block is absent (not an empty section) |
| Persona override wins over preset | free-text override replaces preset text in output |

### Phase 4 — MCP / Composio bridge

**File:** `test/mcp-tools.test.js`

| Test | What it asserts |
|---|---|
| Schema conversion — basic | `mcpToolToOpenAI(mcpSchema)` produces `{ name, description, parameters: { type:'object', properties, required } }` |
| `additionalProperties` patch | input schema without `additionalProperties:false` → output has it set; recursive for nested objects |
| Tool-name namespacing | two servers both expose `"send_email"`; merged list has `"server_a__send_email"` and `"server_b__send_email"` — no collision |
| No-collision invariant | `getRealtimeToolDefinitions()` with static + MCP tools has all unique `name` values |
| Permission gate — default-deny | a tool whose server is not in the allowlist returns `{ allowed: false }` from the permission check |
| Permission gate — allowlisted | server in allowlist + tool permission level `read` → `{ allowed: true }` |
| Permission gate — write prompts | tool permission level `write` returns `{ allowed: false, requiresConfirmation: true }` before explicit grant |
| Definition-hash drift | store hash of tool definition; mutate description; `detectDrift(tool, storedHash)` returns `true` |
| Definition-hash no-drift | same definition re-checked → `detectDrift` returns `false` |
| Schema too large — truncate | tool list capped at 20 tools; `getRealtimeToolDefinitions()` with 25 MCP tools returns ≤20 + all static tools |

### Phase 5 — Wake word

**File:** `test/wake-engine.test.js`

Uses a `MockWakeEngine` that implements the `{ start(onDetect), stop(), mute(), unmute() }` interface; `start` returns a controllable `emit('detect')` function.

| Test | What it asserts |
|---|---|
| Interface contract — start/stop | `engine.start(cb)` returns without throw; `engine.stop()` resolves without throw |
| Interface contract — mute/unmute | `mute()` then `unmute()` sets internal state; a `detect` event emitted while muted does not fire `onDetect` |
| Debounce | two `detect` events fired within the debounce window (default 500 ms, injected as param) → `onDetect` called exactly once |
| Cooldown after session start | `detect` fires; session starts; second `detect` within cooldown window → `onDetect` not called again |
| Cooldown expires | after cooldown expires, `detect` fires `onDetect` again |
| openWakeWord impl starts without throw | construct `OpenWakeWordEngine` with a mock WASM loader; call `start`; verify no synchronous throw |

---

## Integration tests

**File:** `test/memory-cross-session.integration.test.js`

The headline success criterion: fact stated in session 1 is recalled in session 2.

| Test | What it asserts |
|---|---|
| Cross-session recall | (1) open store at path P, `remember` exchange containing "user likes espresso"; close db. (2) open fresh store at same path P, `recall("coffee preference", 1)` — top result contains "espresso" |
| Cross-session episodic count | row count in `memories_episodic` persists across open/close |

**File:** `test/dynamic-tools.integration.test.js`

| Test | What it asserts |
|---|---|
| Static + MCP merge | start with static tool list (N tools); register a mock MCP server exposing 3 tools; `getRealtimeToolDefinitions()` returns N+3 tools, all unique names, all schemas valid (have `type`, `properties`) |
| MCP server disconnect | after mock server disconnects, `getRealtimeToolDefinitions()` drops back to N tools |

---

## Manual QA checklist (per phase)

Run after automated gates pass. One pass per phase before marking the phase "done."

### Phase 1

- [ ] `npm run build:mac && npm run open:mac` — app launches with no terminal window open
- [ ] App appears in menu bar with correct "Lena" name and icon
- [ ] Tray menu shows: idle status, Mute Mic, Open, Settings, Quit — all functional
- [ ] Global hotkey (Option+Space) summons the orb window from any app
- [ ] First-run onboarding window appears on fresh `userData` (delete dir to simulate)
- [ ] Onboarding: enter OpenAI API key → stored; app restarts and skips onboarding
- [ ] Second-user scenario: copy app to second macOS user account, run, onboard with different key — no cross-contamination
- [ ] `npm run check` produces zero errors/warnings

### Phase 2

- [ ] Tell Lena "my favorite coffee is espresso" in session 1; quit app; relaunch; ask "what coffee do I like?" — Lena answers correctly (cross-session recall live test)
- [ ] Memory management UI: facts visible, editable; deleting a semantic fact removes it from next session's context but episodic log row remains visible (append-only UI)
- [ ] Mem0 adapter swap: toggle adapter in settings; repeat recall test; result equivalent

### Phase 3

- [ ] Change Lena's name to "Aria" in settings; start new session; Lena introduces herself as Aria
- [ ] Change tone to "very formal"; next reply uses formal register
- [ ] Switch persona mode live; audible change within one reply
- [ ] Revert to default; behavior returns to baseline

### Phase 4

- [ ] Add Composio server via settings UI; Gmail connects via OAuth link in browser
- [ ] Say "send an email to [address] saying hello" — permission prompt appears
- [ ] Approve prompt; email is sent; activity log records the action
- [ ] Deny prompt; no email sent; Lena confirms denial
- [ ] Add a second MCP server by config file; tools appear in server management UI

### Phase 5

- [ ] Say "Hey Lena" from silence — orb activates, session starts (mic indicator appears)
- [ ] Say "Hey Lena" twice quickly — only one session starts (debounce working)
- [ ] Click Mute in tray — "Hey Lena" no longer activates
- [ ] Un-mute — wake word resumes
- [ ] Hotkey still works while wake word is muted

### Phase 6 (UI/UX)

- [ ] Drag window edge to resize; size persists after relaunch
- [ ] Switch theme/skin via settings; all UI elements update immediately
- [ ] Open text-chat panel; type a message; response appears; tool calls visible in panel
- [ ] Conversation history scrollable; search finds past exchange by keyword

---

## Quality gates (non-negotiable before "phase done")

1. `npm run check` — zero Biome errors/warnings
2. `node --test` — all tests pass, zero failures, zero skipped without explicit `skip` annotation
3. LSP diagnostics — zero errors across changed files (run `LSP diagnostics` after every edit)
4. Manual QA checklist for the phase — every item checked

No phase is "done" if any gate is red.

---

## Coverage targets

| Area | Target | Rationale |
|---|---|---|
| `MemoryStore` (baseline + interface) | All public methods covered by unit + integration tests | Highest risk subsystem; R-2, R-4 |
| MCP schema conversion + permission gate | All branches covered | R-5, R-10 — security-critical |
| `buildRealtimeInstructions` | All composition branches (no memory, with memory, persona override) | Silent regression risk |
| `WakeEngine` interface | Interface contract + debounce/cooldown logic | R-3 — behavioral correctness |
| Settings store round-trip | Save+load for every key type | R-1 user-facing blocker |
| UI, OS integration, voice | Manual QA only | Cannot unit-test Electron UI, `globalShortcut`, microphone, or `@nut-tree-fork` reliably in CI |

Numeric line-coverage targets are intentionally omitted — meaningful assertions on the riskiest logic outweigh coverage percentages on this size of project.
