# /run-leena-task — Execute a single Leena task end-to-end

Run one Leena task (or the next eligible one) via a dispatched agent with the full gate sequence. **No human gates. No AskUserQuestion. No production-DB confirmation. kencode-search is mandatory.**

Usage:
- `/run-leena-task` — execute the next pending task whose deps are all completed
- `/run-leena-task <task-id>` — execute a specific task (e.g. `050`)
- `/run-leena-task next` — same as no-arg

## Protocol

1. **Select task.** If id given, use it. Else lowest-numbered task in `tasks/pending/` whose `dependencies` are all in `tasks/completed/`. A task in `in-progress/` is claimed — never start it.

2. **Verify deps.** Every dependency in `completed/`. If not, pick the next eligible task (skip-to-next — never stall, never idle).

3. **Pre-task (MANDATORY):**
   - Read `tasks/LEARNINGS.md` — apply prior learnings.
   - Read `tasks/FILE-CLAIMS.md` — if a file you need is claimed, pick a different task.
   - Claim your files in `FILE-CLAIMS.md`. Write WAL `pre_run`.
   - Move `pending/ → in-progress/`. Frontmatter: `status: in_progress`, `claim_started: <ISO ts>`, `attempts: +1`. Update OVERVIEW.

4. **Load full context.** Read the task file. Read `## Outputs` + `## Interface Contracts` + `## Handoff Notes` of each dependency in `completed/`. Read `context_files` from frontmatter.

5. **kencode-search (MANDATORY before code).** Search for production-ready implementations and pull full context of every file/section you'll touch. If you haven't pinpointed every relevant symbol/usage, search again. Do not reinvent existing patterns.

6. **Execute Steps.** Follow `## Steps` exactly. Simplest correct solution — never over-engineer, never compromise correctness. Match existing conventions (`CLAUDE.md`, `biome.json`, neighboring files). Write the tests in `## Tests Required` (rigorous, incl. e2e where relevant).

7. **Automated gates (ALL pass, in order):**
   1. `npm run check` (Biome — zero errors/warnings)
   2. `node --test` (zero failures, no unexplained skips — regression + new)
   3. LSP diagnostics on changed files (zero errors)

8. **On gate failure:** fix → re-run. **When a fix works: append it to `tasks/LEARNINGS.md` (what broke / why / fix), then continue.** `attempts >= 10` → `blocked/`, `status: blocked`, release claims, TASKLOG + LEARNINGS entry, caller skips to next. `security_block: true` → immediate `blocked/`, no retries.

9. **On success:**
   - Fill `## Outputs`, `## Interface Contracts` (actual signatures), `## Handoff Notes`.
   - WAL `post_run`. Move `in-progress/ → completed/`. `status: completed`. Release file claims.
   - Commit atomically: `git add -A && git commit -m "<id>: <title>"`.
   - Update `tasks/OVERVIEW.md` counts. Append to `tasks/TASKLOG.md`.

## No human gates
No CodeRabbit-as-blocker, no advisor-as-blocker for a single task, no AskUserQuestion. The three automated gates (check / test / LSP) + kencode-search + tests are the bar. (Wave-level runs add reviewer + advisor + CodeRabbit-advisory — see `/run-leena-wave`.)

**Exception — wave-06 (task 021):** Phase 0 approval gate. After 021 completes, the wave runner stops and launches `npm start` for owner review.
