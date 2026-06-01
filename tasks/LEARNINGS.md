# Leena — Build Learnings (read before every wave, append after every fix)

**This file is a non-negotiable part of the build loop.** Every wave's agents MUST read this file *before* starting work, and MUST append new entries *after* any fix that worked. The goal: never repeat a mistake twice across waves.

## How to use this file

**BEFORE a wave starts** (every agent in the wave):
1. Read this entire file.
2. Read the `## Active Rules` section — these are hardened rules distilled from past fixes. Follow them.
3. Scan `## Wave Log` for entries tagged with files/subsystems you're about to touch.

**WHEN a fix works** (WAL checkpoint — stop, document, continue):
1. The moment a non-trivial fix makes a failing gate pass, STOP.
2. Append a `### Fix` entry to the current wave's section (template below).
3. If the fix reveals a general rule, also add/update a bullet in `## Active Rules`.
4. Resume work.

**AFTER a wave completes** (wave summary):
1. Append a `## Wave NN — summary` block: what was built, what broke, what was learned, time/retry stats.
2. Promote any recurring pattern (seen ≥2×) into `## Active Rules`.

---

## Active Rules (hardened — always apply)

> These start as the project's known constraints. Agents add to them as fixes accumulate.

- **kencode-search FIRST.** Before writing any new code, query the `kencode-search` MCP for production-ready implementations and to pull the FULL context of every file you'll modify. Never reinvent code that a vetted library/snippet already solves. If you have not pinpointed every section/place/symbol you need for context, search again before coding.
- **Never break current functionality.** The app already works as "Brah." Run the existing test suite (`node --test`) before and after every task. A passing-before / failing-after test = regression = the task is not done.
- **Simplest thing that works.** No over-engineering. If a simpler approach yields the same result, take it. Complexity is only acceptable when genuinely required. But it must *work* — never compromise correctness for brevity or vice-versa.
- **Match existing conventions.** Read neighboring files, `CLAUDE.md`, `biome.json`. Comment density, naming, and idiom must match surrounding code.
- **Provider primacy.** OpenAI subscription (OAuth) is the primary voice + chat path; the OpenAI API key is the backup. OpenRouter and Ollama are additional selectable providers. Ollama models are user-downloadable on demand.
- **`node:sqlite` only** for storage (no better-sqlite3). Use the existing `database.js` patterns and `withTempDir` + `closeDatabase` test helpers.
- **Native addons stay in `asarUnpack`** (`@nut-tree-fork/**`, onnxruntime native bits).
- **Tests are mandatory, not optional.** No task is complete without the tests named in its `## Tests Required`, and they must pass. E2E coverage for any user-facing flow.

---

## Wave Log

> Append below. Newest wave at the bottom. Never delete entries.

### Fix entry template
```
### Fix — Wave NN — <task id> — <one-line title>
- **Symptom:** what failed (exact error quoted)
- **Root cause:** why
- **Fix:** what changed (file:line)
- **Rule added?:** yes/no — if yes, which Active Rule
- **WAL ref:** tasks/.wal/<entry>
```

_(no wave entries yet — build has not started)_
