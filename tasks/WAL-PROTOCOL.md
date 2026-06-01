# Leena — Write-Ahead Log (WAL) Protocol

**WAL is the crash-recovery + self-annealing backbone of the build.** Every task writes a `pre_run` entry before its first step and a `post_run` entry at its terminal state. Fixes that work are checkpointed immediately. The WAL is the source of truth for "what was the state before/after this change."

WAL entries live in `tasks/.wal/` as append-only JSONL. The directory already exists.

## When to write (NON-NEGOTIABLE)

| Event | When | File |
|-------|------|------|
| `pre_run` | Before Step 1 of any task | `tasks/.wal/wal.jsonl` |
| `checkpoint` | The moment a non-trivial fix makes a failing gate pass — **stop, write, continue** | `tasks/.wal/wal.jsonl` |
| `post_run` | When a task reaches terminal state (completed or blocked) | `tasks/.wal/wal.jsonl` |
| `error` | On any gate failure / exception | `tasks/.wal/wal.jsonl` |

If the WAL write itself fails, buffer to `tasks/.wal/WAL-PENDING.jsonl` and continue — the write is never skipped.

## Entry shape

```json
{"ts":"2026-06-01T19:00:00Z","event":"pre_run","wave":7,"task":"050","files_before":["src/providers/openai-provider.js (absent)"],"deps_used":["002","001","000"],"learnings_read":true}
{"ts":"2026-06-01T19:08:00Z","event":"checkpoint","wave":7,"task":"050","fix":"retry wrapper needed AbortSignal passthrough","gate_now_passing":"node --test","file":"src/providers/openai-provider.js:42"}
{"ts":"2026-06-01T19:12:00Z","event":"post_run","wave":7,"task":"050","status":"completed","files_after":["src/providers/openai-provider.js","test/provider-openai.test.js"],"attempts":1,"gates":{"check":"pass","test":"pass","lsp":"pass"}}
```

## The fix loop (owner directive: "when we fix something and it works, stop, document, continue")

```
1. gate fails  → write {event:"error", ...}
2. apply fix
3. re-run gate
4. gate passes → STOP
                → write {event:"checkpoint", fix, gate_now_passing, file}
                → append the fix to tasks/LEARNINGS.md (### Fix entry)
                → continue
5. task terminal → write {event:"post_run", status, gates}
                 → append wave learnings if last task in wave
```

## Recovery

On resume after a crash: read `wal.jsonl`, find tasks with a `pre_run` but no `post_run` → those were interrupted. Re-queue them in `pending/` (move back from `in-progress/`), release their file claims in `FILE-CLAIMS.md`, and continue.

## Self-annealing

`pre_run`/`post_run` pairs give a before/after diff per task. Recurring `error` events with the same root cause across tasks → promote to a `## Active Rules` bullet in `LEARNINGS.md` so future waves avoid the mistake.
