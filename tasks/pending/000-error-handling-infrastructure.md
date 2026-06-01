---
id: "000"
title: "Error handling infrastructure"
type: infrastructure
status: pending
priority: critical
complexity: S
estimated_tokens: 8000
dependencies: []
context_files:
  - src/main.js
  - src/preload.js
skills: []
tags: [infrastructure, error-handling]
attempts: 0
created_at: "2026-06-01"
---

## Objective

Create structured error classes and global error handlers so every subsystem (providers, MCP, memory, wake) throws typed, serializable errors that cross the IPC boundary cleanly.

## Why This Matters

Without typed errors, failures in one process (main) surface as opaque strings in another (renderer). Every subsequent task — providers, MCP, memory — will throw errors that need to serialize over IPC. Building this first means every feature task inherits consistent error handling from day one.

## Steps

1. Create `src/utils/errors.js` exporting a base `LeenaError` class (extends `Error`, adds `code`, `cause`, `toJSON()`) and subclasses: `ProviderError` (adds `provider`, `model`), `MCPError` (adds `serverName`, `transport`), `MemoryError`, `WakeError`, `RetryExhaustedError` (adds `attempts`, `lastError`).
2. Add `serializeError(err)` and `deserializeError(obj)` functions in the same file — `serializeError` returns a plain object safe for `ipcRenderer.invoke` (strips stack in production, preserves `code`/`cause`/custom fields); `deserializeError` reconstructs the correct subclass from the serialized object.
3. In `src/main.js`, register `process.on('uncaughtException')` and `process.on('unhandledRejection')` handlers that log to the existing diagnostics channel and, if the main window exists, push a `leena:error` event to the renderer via `webContents.send`.
4. Add the `leena:error` channel to `src/preload.js` so the renderer can listen for main-process errors (read-only push, no invoke).
5. Write `test/errors.test.js` covering: (a) each error subclass preserves its custom fields, (b) `serializeError` round-trips through `deserializeError` for every subclass, (c) nested `cause` chains serialize correctly, (d) unknown error types deserialize to base `LeenaError`.

## Acceptance Criteria

- [ ] `LeenaError`, `ProviderError`, `MCPError`, `MemoryError`, `WakeError`, `RetryExhaustedError` all exported from `src/utils/errors.js`
- [ ] `serializeError` / `deserializeError` round-trip every subclass correctly
- [ ] `process.on('uncaughtException')` and `process.on('unhandledRejection')` registered in `main.js`
- [ ] `leena:error` channel exposed in `preload.js`
- [ ] `test/errors.test.js` passes with `node --test`
- [ ] `npm run check` passes (zero Biome errors)

## Tests Required

- `test/errors.test.js`
  - Each subclass retains custom fields (`code`, `provider`, `serverName`, etc.)
  - `serializeError` → `deserializeError` round-trip for every subclass
  - Nested `cause` chains serialize and deserialize without data loss
  - Unrecognized error types fall back to `LeenaError`
  - `toJSON()` output matches `serializeError` output

## Outputs

- `src/utils/errors.js` — error class hierarchy + serialization utilities
- `src/main.js` — modified (global handlers added)
- `src/preload.js` — modified (`leena:error` channel added)
- `test/errors.test.js` — test suite

## Interface Contracts

- All provider tasks (003–005) import `ProviderError` for API failures
- All MCP tasks import `MCPError` for server communication failures
- Memory tasks import `MemoryError` for store failures
- Wake word tasks import `WakeError` for engine failures
- Task 001 (retry) imports `RetryExhaustedError` to wrap final failure
- `serializeError`/`deserializeError` used by any IPC handler returning errors

## Handoff Notes

_Filled after completion._

## Errors Encountered

_Filled if errors occur._

## Self-Annealing Contract

| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Error subclass not used downstream | `grep -r "ProviderError\|MCPError\|MemoryError\|WakeError" src/ \| wc -l` | < 4 uses after Wave 3 completes | Audit feature tasks for bare `throw new Error()` and refactor |
| Serialization not used in IPC | `grep -r "serializeError\|deserializeError" src/ \| wc -l` | < 2 uses after Wave 2 completes | Add to IPC handler wrapper |
| Uncaught errors still crashing app | Crash reports in diagnostics log | > 0 after Wave 4 | Review handlers; add missing try/catch in offending module |
