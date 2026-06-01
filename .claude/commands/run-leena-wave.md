# /run-leena-wave — Autonomous Leena wave orchestrator

Execute a full Leena wave by **dispatching a team of agents** that build **every task in the wave to completion**. Fully autonomous. **No human gates except wave-06 (Phase 0 approval). No AskUserQuestion. No production-DB confirmations. No idle — there is always work to do.**

Usage:
- `/run-leena-wave` — run the next pending wave
- `/run-leena-wave wave-N` — run a specific wave
- `/run-leena-wave --stop-after wave-N` — run through N, then stop
- `/run-leena-wave --from wave-N` — resume from N (after the approval gate)

---

## NON-NEGOTIABLES (apply to every task, every wave)

1. **kencode-search MCP before any code.** Before writing/modifying ANY code, an agent MUST call `kencode-search` to find production-ready implementations and to pull **full context of the file(s) it will touch**. If the agent has not pinpointed every section/symbol/usage it needs, it searches again until it has. Reinventing code from scratch is forbidden when a vetted pattern exists.
2. **Never over-engineer.** Simplest solution that fully works wins. No speculative abstraction, no complexity that isn't required. But it MUST work — never compromise correctness for brevity. We do not ship code that "mostly" works.
3. **Don't break current functionality.** Full regression suite (`node --test`) must stay green. A task that breaks an existing test is not done.
4. **Rigorous E2E testing.** No implementation advances without tests. Each task writes its `## Tests Required`. Each wave runs the full suite + relevant e2e. Test, test, test.
5. **Agent deployment is mandatory.** A wave is executed by dispatching one agent per task (parallel group), not by the orchestrator coding inline. This is compulsory.
6. **Reviewer + advisor gates per wave.** After tasks build, a `reviewer` agent reviews; then `advisor()` gates the wave before proceeding.
7. **CodeRabbit: mandatory but NEVER a blocker.** Create the PR + CodeRabbit review every wave. Capture findings into `tasks/LEARNINGS.md`. CodeRabbit NEVER blocks merge or wave progress.
8. **Commit only truly vetted code to production.** Merge after: automated gates green → reviewer pass → advisor gate clear. CodeRabbit findings recorded (advisory).
9. **Bookkeeping is compulsory.** Every task moves `pending/ → in-progress/ → completed/` (or `blocked/`) the instant its state changes — frontmatter + folder + OVERVIEW.md updated atomically. Same for waves.
10. **WAL + Learnings are compulsory.** WAL pre_run before first step; WAL post_run at terminal state. When a fix works: **stop, document the fix in `tasks/LEARNINGS.md`, then continue.** Document again at end of iteration.
11. **File-claim protocol.** Before touching a file, an agent records it in `tasks/FILE-CLAIMS.md`. A file already claimed is off-limits — the agent picks a different unblocked task instead. A task in `in-progress/` is claimed; never start it.
12. **No excuses for idle.** If a task blocks after 10 unblock attempts → `blocked/`, then immediately pick the next task whose deps are satisfied (this wave, or pull-ahead from a later wave if its deps are met). Work never stops because one task is stuck.

---

## Execution Protocol

### Step 0 — Pre-wave (MANDATORY, in order)
1. Determine the current wave: read `tasks/OVERVIEW.md`; pick the lowest-numbered wave with pending tasks whose earlier-wave deps are all in `completed/`.
2. Read `tasks/LEARNINGS.md` **in full** — the dispatched agents must apply every prior-wave learning. Pass the relevant learnings into each agent's prompt so they don't repeat past mistakes.
3. Read `tasks/FILE-CLAIMS.md` — know what's claimed.
4. Read the wave file `tasks/waves/wave-NN.md`.

### Step 1 — Dispatch the agent team (MANDATORY)
- Move **all** wave tasks `pending/ → in-progress/` (frontmatter `status: in_progress`, `claim_started: <ISO ts>`, `attempts: +1`). Update OVERVIEW counts.
- Write a WAL `pre_run` entry per task.
- Dispatch **one agent per task in a single message** (true parallel group). Each agent prompt MUST include:
  - The task file contents + dependency `## Outputs`/`## Interface Contracts`/`## Handoff Notes`.
  - Relevant `LEARNINGS.md` entries.
  - The list of files it will touch → it must claim them in `FILE-CLAIMS.md` first; if a needed file is already claimed, it coordinates or picks non-conflicting work.
  - **Mandate block:** "Call kencode-search before writing code. Pull full file context. Don't over-engineer. Don't break existing tests. Write rigorous tests. Run `npm run check` + `node --test` + LSP until green."

### Step 2 — Per-task gates (each agent, NON-NEGOTIABLE, in order)
1. `kencode-search` performed; full context confirmed.
2. Code written (simplest correct approach).
3. `npm run check` — zero Biome errors/warnings.
4. `node --test` — all tests pass, zero failures, no unexplained skips (regression + new tests).
5. LSP diagnostics on changed files — zero errors.
6. On any gate fail: fix → re-run. `attempts++`. **When a fix works: append the fix to `tasks/LEARNINGS.md` (what broke, why, the fix), then continue.**
7. `attempts >= 10` → `blocked/`, `status: blocked`, log to TASKLOG + LEARNINGS, release file claims, **caller skips to next eligible task**. `security_block: true` → immediate `blocked/`, no retries.
8. **Independent verification before completion (MANDATORY — agent self-reports are NOT evidence).** When an agent returns "done," the orchestrator independently confirms before moving the task to `completed/`: (a) `git status --porcelain` shows non-empty changes for the task (empty diff = false "done"); (b) every file in the task's `## Outputs` exists on disk; (c) the orchestrator **re-runs `npm run check` + `node --test` itself** and sees them pass. If the diff is empty, an output is missing, or a re-run gate fails → the "done" was false: `attempts +1`, retry (do NOT mark completed); log the false-completion to LEARNINGS.md. *(Three sub-agents mis-reported completion on 2026-06-01 — this gate exists because that failure is real.)*
9. On verified success: fill `## Outputs` + `## Interface Contracts` (actual) + `## Handoff Notes`; WAL `post_run`; move `in-progress/ → completed/`; release file claims; update OVERVIEW.

### Step 3 — Wave must be COMPLETE before advancing
- Do **not** advance until **every** task in the wave is in a terminal state (`completed/` OR `blocked/`). No half-built waves.
- If some tasks blocked but others' deps are now satisfiable (including pull-ahead from later waves), keep dispatching — no idle.

### Step 4 — Post-wave (MANDATORY, in order)

**Branch model:** each wave runs on a branch `wave-NN` cut from `main` at wave start. Tasks commit atomically to that branch. The wave is PR'd and merged to `main` only after the full vetting sequence below. "Commit vetted code to production" = merge to `main` only post-vetting. Remote is `origin` (github.com/yasminat-codes/leena); `gh` is authed.

1. `reviewer` agent: review all wave changes (correctness, regressions, over-engineering, security).
2. Fix any reviewer-flagged blockers (re-dispatch the owning agent). Re-run gates + independent verification (Step 2.8).
3. `advisor()` gate on the wave's changes. Address blockers; log warnings to TASKLOG.
4. **CodeRabbit (mandatory, advisory-only — NEVER blocks):** push `wave-NN`, open a PR to `main` (`gh pr create`), request CodeRabbit. Record findings in LEARNINGS.md. Proceed regardless of verdict. **If the CodeRabbit GitHub App is not installed on the repo, the review silently no-ops — that is acceptable (advisory only); note "CodeRabbit not configured — skipped" in TASKLOG and continue. Never block on it.**
5. **Merge vetted code to production:** after reviewer + advisor pass (and CodeRabbit findings recorded), merge `wave-NN` → `main` (`gh pr merge --squash` or fast-forward). This is the only path code reaches `main`.
6. Append wave summary + new learnings to `tasks/LEARNINGS.md` and `tasks/TASKLOG.md`. Update OVERVIEW (wave marked complete).

### Step 5 — APPROVAL GATE (wave-06 ONLY — the single human gate)
- After all wave-06 tasks complete: STOP. Run `npm start`.
- Tell owner: "Phase 0 visual shell complete. Review against `design-system/Leena Design System.md`. Approve to continue (Band B, waves 7-16)."
- Do NOT proceed to wave-07 until the owner explicitly approves. This is the ONLY stop in the build.

### Step 6 — Deliverable checkpoints
- After **wave-15** (task 111): confirm `dist/Leena-*.dmg` (final, full-feature).
- After **wave-16** (task 046): confirm `dist/Leena-MVP.dmg` (guaranteed; decoupled from wake/MCP).
- Write/update `tasks/DELIVERABLE.md` with paths + SHA-256.

---

## Failure Handling (no idle, ever)
- Gate fail → fix → retry (≤10 attempts), documenting each successful fix to LEARNINGS.md.
- 10 attempts exhausted → `blocked/` → skip to next eligible task (this wave, then pull-ahead).
- `security_block: true` → immediate `blocked/`, no retries, TASKLOG entry.
- A blocked optional-phase task (wake/MCP) must NEVER prevent the MVP .dmg (046) — 046's deps are MVP-only.
- Wave is terminal when every task is `completed/` or `blocked/`. There is no state where agents sit idle with eligible work remaining.
