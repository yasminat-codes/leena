# Leena — File Claim Registry (concurrency guard)

**Purpose:** When multiple agents run a wave in parallel, two agents must never edit the same file at once. This registry is the lock table. It is append-and-update — agents claim files before editing and release them after.

## The protocol (MANDATORY for every agent in a parallel wave)

1. **Before editing any file**, an agent appends a claim row to `## Active Claims` with the file path, its task id, and a timestamp.
2. **Before claiming**, the agent checks `## Active Claims`. If a file it needs is already claimed by another task, the agent must **NOT** wait or touch it — it moves on to the next task in its wave whose files are all free, or to the next eligible pending task.
3. **A task whose file is in `tasks/in-progress/` is already being worked on — it is claimed.** Never start a task that is in `in-progress/`. Only pick from `pending/` (and only ones whose dependencies are all in `completed/`).
4. **After a task reaches a terminal state** (completed or blocked), the agent removes its claim rows from `## Active Claims` and notes the release in `## Claim History`.
5. **No idle.** If every file an agent could work on is claimed, it scans the next wave / pending folder for any unblocked, unclaimed task and works that. There is no valid state where an agent does nothing while unclaimed work remains.

## Conflict resolution
- Two tasks in the same wave that need the same file are a **decomposition smell** → the wave runner serializes them (run one, then the other) rather than parallelizing. Note it in `tasks/LEARNINGS.md`.
- A claim older than 30 min with no progress is considered stale → the wave runner may reclaim it (the original task likely crashed; re-queue it).

## Active Claims

| File | Claimed by (task) | Claimed at | Status |
|------|-------------------|------------|--------|
_(empty — no active Wave 01 claims)_

## Claim History

- 2026-06-01T23:37:45Z — Released Wave 01 claims for task `000`: `src/utils/errors.js`, `src/main.js`, `src/preload.js`, `test/errors.test.js`.
- 2026-06-01T23:37:45Z — Released Wave 01 claims for task `010`: `src/renderer/leena.css`, `src/renderer/index.html`, `test/leena-css-tokens.test.js`.
- 2026-06-01T23:37:45Z — Released Wave 01 gate claim: `biome.json`.
- 2026-06-01T23:46:46Z — Released Wave 01 reviewer-fix claims for task `000`: `src/utils/errors.js`, `src/main.js`, `test/errors.test.js`.
- 2026-06-01T23:53:22Z — Released Wave 01 embedded-URL redaction claims for task `000`: `src/utils/errors.js`, `test/errors.test.js`.
- 2026-06-02T00:00:08Z — Released Wave 01 diagnostics redaction claims for task `000`: `src/utils/errors.js`, `src/main.js`, `test/errors.test.js`.
