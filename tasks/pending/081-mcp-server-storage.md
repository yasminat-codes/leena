---
id: "081"
title: "MCP server configuration storage"
type: feature
status: pending
priority: high
complexity: S
estimated_tokens: 10000
dependencies: ["032"]
context_files:
  - src/realtime/tools/database.js
  - plans/data-model.md
skills: []
tags: [phase-5, mcp, storage]
attempts: 0
created_at: "2026-06-01"
---

## Objective
Create the `mcp_servers` SQLite table and a `ServerStore` module with CRUD operations for persisting MCP server configurations.

## Why This Matters
Users need to add, remove, and configure MCP servers persistently. The server store is the source of truth for which servers exist, their transport type, connection URL or command, and whether they auto-connect on launch.

## Steps
1. Create `src/mcp/server-store.js`. Import the database module from `src/realtime/tools/database.js` (which already manages SQLite via `node:sqlite`).
2. Add migration logic: on first call, execute `CREATE TABLE IF NOT EXISTS mcp_servers (id TEXT PRIMARY KEY, name TEXT NOT NULL, transport TEXT NOT NULL CHECK(transport IN ('http','stdio')), url TEXT, command TEXT, args TEXT, enabled INTEGER DEFAULT 1, auto_connect INTEGER DEFAULT 0, permission_level TEXT DEFAULT 'confirm', created_at TEXT DEFAULT (datetime('now')))`. Validate: http servers require `url`, stdio servers require `command`.
3. Implement `addServer({ name, transport, url?, command?, args?, enabled?, auto_connect?, permission_level? })` — generate UUID id, INSERT row, return the full server record. Throw `LeenaError` if http+no-url or stdio+no-command.
4. Implement `removeServer(id)` — DELETE by id. Return boolean (true if row existed).
5. Implement `updateServer(id, updates)` — UPDATE only provided fields. Return updated record or null if not found.
6. Implement `listServers()` — SELECT all, return array. Implement `getServer(id)` — SELECT by id, return record or null. Implement `getAutoConnectServers()` — SELECT WHERE auto_connect=1 AND enabled=1.

## Acceptance Criteria
- [ ] `mcp_servers` table created on first access (migration-safe, idempotent)
- [ ] `addServer` stores HTTP server config with url and returns full record with generated id
- [ ] `addServer` stores stdio server config with command+args and returns full record
- [ ] `addServer` rejects HTTP server without url (throws LeenaError)
- [ ] `addServer` rejects stdio server without command (throws LeenaError)
- [ ] `removeServer` deletes record and returns true; returns false for nonexistent id
- [ ] `updateServer` modifies only specified fields, returns updated record
- [ ] `listServers` returns all servers; `getAutoConnectServers` filters to enabled+auto_connect

## Tests Required
- `test/mcp-server-store.test.js` — full CRUD lifecycle: add HTTP server, add stdio server, list, get by id, update fields, remove, verify empty after remove. Validation: reject bad configs. Use `withTempDir` + temp database path pattern from existing test suites.

## Outputs
- `src/mcp/server-store.js` — ServerStore with CRUD operations
- `mcp_servers` table added to SQLite schema (auto-migrated)

## Interface Contracts
- **Task 084** depends on all CRUD methods for IPC channel handlers
- **Task 086** depends on `getAutoConnectServers()` for launch-time auto-connect
- Schema shape returned: `{ id, name, transport, url, command, args, enabled, auto_connect, permission_level, created_at }`

## Handoff Notes
[Filled after completion]

## Errors Encountered
[Filled if errors occur]

## Self-Annealing Contract
| Signal | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Migration fails on existing DB | error on CREATE TABLE | any | Wrap in IF NOT EXISTS, add ALTER TABLE for new columns |
| args field parsing errors | JSON.parse failures on args column | any | Store args as JSON string, parse on read with try/catch |
| Orphan server configs | servers with no matching connection | >3 unused | Add cleanup sweep or UI indicator |
