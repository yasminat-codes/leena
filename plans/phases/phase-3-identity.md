# Phase 3 — Identity

**Complexity:** M  
**Depends on:** Phase 1 (Foundation & Rename)  
**Pairs with:** Phase 2 (Memory) — memory feeds identity context but is not a prerequisite.

---

## Goal & Exit Criteria

**Goal:** Let the user author Lena's identity in settings and select a persona/mode. The composed prompt is the single source of truth for how Lena speaks and behaves.

**Exit criteria (all must hold):**

1. User saves an identity change in settings; the change is audible in Lena's next reply (next realtime session or next turn).
2. Switching persona modes takes effect in the next reply — no app restart required.
3. Voice picker saves and is applied when the next realtime session opens.
4. `buildRealtimeInstructions` produces a deterministic, section-ordered string given any valid profile + memory block + timestamp.
5. `normalizeAgentProfile` accepts any partial input without throwing; unknown fields are stripped; values exceeding caps are truncated silently.
6. `DEFAULT_AGENT_PROFILE` uses name `""` (Lena addresses the user by name only if the user sets one) and base persona key `"lena"`.
7. All existing tests pass; new unit tests covering composition, normalization edge cases, and persona switching pass.

---

## Design

### 1. Agent Profile — Extended Fields

**Current profile shape** (in `normalizeAgentProfile` + `DEFAULT_AGENT_PROFILE`):

```js
{ goals, name, about, voice, persona }
```

**New profile shape** after Phase 3:

```js
{
  // existing
  goals,          // string[] — up to 12 items, each trimmed
  name,           // string — user's name (what Lena calls them); "" = don't use one
  about,          // string — freeform user-authored context; cap 1000 chars
  voice,          // string — one of REALTIME_VOICES; falls back to DEFAULT_VOICE
  persona,        // string — key in AGENT_PERSONAS; falls back to "lena"

  // new in Phase 3
  personality,    // string — freeform description of Lena's character/vibe; cap 500 chars
  tone,           // string — freeform tone directive (e.g. "playful but precise"); cap 300 chars
  speaking_rules, // string — freeform constraints on speech style; cap 500 chars
  custom_persona, // string — free-text override injected instead of the preset persona prompt; cap 800 chars
}
```

**`DEFAULT_AGENT_PROFILE` changes:**

```js
export const DEFAULT_AGENT_PROFILE = Object.freeze({
  goals: [],
  name: "",               // was "Ken" — rename to Lena project; user sets their own name
  about: "",
  voice: DEFAULT_VOICE,
  persona: "lena",        // was "default" — base persona is now Lena-branded
  personality: "",
  tone: "",
  speaking_rules: "",
  custom_persona: "",
});
```

**`normalizeAgentProfile` additions:**

```js
export function normalizeAgentProfile(profile) {
  return {
    goals:          normalizeGoals(Array.isArray(profile?.goals) ? profile.goals : []),
    name:           normalizeStr(profile?.name, 200),
    about:          normalizeStr(profile?.about, 1000),
    voice:          normalizeVoice(profile?.voice),
    persona:        normalizePersona(profile?.persona),
    personality:    normalizeStr(profile?.personality, 500),
    tone:           normalizeStr(profile?.tone, 300),
    speaking_rules: normalizeStr(profile?.speaking_rules, 500),
    custom_persona: normalizeStr(profile?.custom_persona, 800),
  };
}

// helper replacing the inline typeof checks for string fields
function normalizeStr(value, cap) {
  return typeof value === "string" ? value.trim().slice(0, cap) : "";
}
```

`normalizeVoice` and `normalizePersona` remain unchanged except `normalizePersona` must fall back to `"lena"` (the new `DEFAULT_PERSONA`).

---

### 2. Persona Presets / Modes

**Keep all four existing presets** (`therapist`, `explainer`, `coach`, `honest`). The old `default` key is replaced by `lena`.

**Add three Lena-specific modes:**

```js
export const AGENT_PERSONAS = Object.freeze({
  lena: {
    label: "Lena (default)",
    prompt: "",   // base behavior defined by STATIC_VOICE_INSTRUCTIONS; no extra overlay
  },
  therapist: { /* unchanged */ },
  explainer: { /* unchanged */ },
  coach:     { /* unchanged */ },
  honest:    { /* unchanged */ },

  // new
  brief: {
    label: "Brief",
    prompt:
      "Tone: ultra-concise. One sentence maximum per reply unless the user asks for elaboration. No preambles, no filler. Lead with the answer.",
  },
  socratic: {
    label: "Socratic",
    prompt:
      "Tone: curious guide. Answer questions with a clarifying question that steers the user toward their own insight. Only give a direct answer when the user explicitly asks for one.",
  },
  hype: {
    label: "Hype",
    prompt:
      "Tone: energetic co-conspirator. Match the user's enthusiasm, celebrate wins loudly, and keep the energy high. Still accurate — hype is not fluff.",
  },
});

export const DEFAULT_PERSONA = "lena";
```

**Custom persona override:** When `profile.custom_persona` is non-empty it replaces the preset's `prompt` entirely. The `buildPersonaInstructions` function checks `custom_persona` first:

```js
export function buildPersonaInstructions(persona, custom_persona = "") {
  if (custom_persona.trim().length > 0) {
    return `# Persona\n${custom_persona.trim()}`;
  }
  const key = typeof persona === "string" && persona in AGENT_PERSONAS ? persona : DEFAULT_PERSONA;
  const prompt = AGENT_PERSONAS[key].prompt;
  return prompt ? `# Persona\n${prompt}` : "";
}
```

---

### 3. Prompt Composition — `buildRealtimeInstructions`

**Composition order** (each section separated by `\n\n`; empty sections omitted):

```
1. STATIC_VOICE_INSTRUCTIONS   — hardcoded base (role, voice style, behavior, audio handling)
2. # Identity                  — user-authored personality / tone / speaking_rules (new)
3. # Persona                   — preset or custom_persona overlay
4. # Personal Context          — user name / about / goals (existing buildAgentProfileInstructions)
5. # What Lena Knows           — Phase 2 memory injection block (passed in as `memoryBlock`)
6. # Runtime Context           — current date/time/timezone (buildRuntimeInstructions)
```

**Updated `buildAgentInstructions`:**

```js
export function buildAgentInstructions(profile = DEFAULT_AGENT_PROFILE, memoryBlock = "") {
  const normalized = normalizeAgentProfile(profile);
  return [
    STATIC_VOICE_INSTRUCTIONS,
    buildIdentityInstructions(normalized),
    buildPersonaInstructions(normalized.persona, normalized.custom_persona),
    buildAgentProfileInstructions(normalized),
    memoryBlock ? `# What Lena Knows\n${memoryBlock}` : "",
  ]
    .filter((section) => section.trim().length > 0)
    .join("\n\n");
}
```

**New `buildIdentityInstructions`:**

```js
export function buildIdentityInstructions(profile) {
  const normalized = normalizeAgentProfile(profile);
  const lines = [];
  if (normalized.personality) lines.push(`Personality: ${normalized.personality}`);
  if (normalized.tone)        lines.push(`Tone: ${normalized.tone}`);
  if (normalized.speaking_rules) lines.push(`Speaking rules:\n${normalized.speaking_rules}`);
  return lines.length > 0 ? `# Identity\n${lines.join("\n")}` : "";
}
```

**Updated `buildRealtimeInstructions`:**

```js
export function buildRealtimeInstructions({
  now = new Date(),
  profile = DEFAULT_AGENT_PROFILE,
  memoryBlock = "",
} = {}) {
  return [buildAgentInstructions(profile, memoryBlock), buildRuntimeInstructions(now)].join("\n\n");
}
```

The `memoryBlock` parameter is `""` in Phase 3 (memory not yet wired); Phase 2 will populate it. The signature is forward-compatible.

---

### 4. Settings UI — Identity Section

**Location:** `src/renderer/` — the identity editor lives inside the existing agent panel (`#agent-panel`), added as a new section below the existing name/about/goals fields.

**New HTML inputs** (inside `#agent-form`):

| Input ID | Type | Label | Bound to |
|---|---|---|---|
| `#agent-personality` | `textarea` | "Personality" | `profile.personality` |
| `#agent-tone` | `text` | "Tone" | `profile.tone` |
| `#agent-speaking-rules` | `textarea` | "Speaking rules" | `profile.speaking_rules` |
| `#agent-custom-persona` | `textarea` | "Custom persona (overrides preset)" | `profile.custom_persona` |
| `#agent-persona` | `select` | "Persona mode" | `profile.persona` (already exists) |
| `#agent-voice` | `select` | "Voice" | `profile.voice` (already exists) |

**`renderer.js` changes:**

- Declare four new element references alongside the existing ones (`agentPersonalityInput`, `agentToneInput`, `agentSpeakingRulesInput`, `agentCustomPersonaInput`).
- In the `initAgentPanel()` load path, populate voice and persona selects as today, then set the four new inputs from `agentProfile`.
- In the save handler, include the four new fields when building the profile object passed to `window.brah.setAgentProfile(profile)`.
- `normalizeAgentProfile` (imported from prompts.js via the renderer bundle) strips unknown/overlong values on the return trip, so no extra sanitisation needed in the renderer.

**Persona select population** is driven by `AGENT_PERSONAS` — iterate its keys after Phase 3 to pick up the three new modes automatically. The existing loop already does this via `Object.entries(AGENT_PERSONAS)`.

---

## File-Level Changes

| File | Change |
|---|---|
| `src/realtime/prompts.js` | Rename `DEFAULT_PERSONA` to `"lena"`. Add `lena`, `brief`, `socratic`, `hype` to `AGENT_PERSONAS`. Add `personality`, `tone`, `speaking_rules`, `custom_persona` to `DEFAULT_AGENT_PROFILE`. Extend `normalizeAgentProfile` with `normalizeStr` helper and four new fields. Add `buildIdentityInstructions`. Update `buildPersonaInstructions` signature (add `custom_persona` param). Update `buildAgentInstructions` to pass `memoryBlock` and call `buildIdentityInstructions`. Update `buildRealtimeInstructions` to accept `memoryBlock`. |
| `src/realtime/tools/agent-profile-store.js` | No schema changes — profile is stored as JSON in the existing `settings` key; `normalizeAgentProfile` handles new fields on read. Verify `loadAgentProfile` round-trips through updated `normalizeAgentProfile` correctly (it does — no changes needed). |
| `src/main.js` | `agent:get-profile` and `agent:set-profile` handlers unchanged — they delegate to `loadAgentProfile`/`saveAgentProfile` which call `normalizeAgentProfile` automatically. Verify `openai:create-realtime-secret` still calls `buildRealtimeInstructions({ profile })` — it does; the `memoryBlock` param defaults to `""`. |
| `src/renderer/index.html` | Add four new inputs (`#agent-personality`, `#agent-tone`, `#agent-speaking-rules`, `#agent-custom-persona`) inside `#agent-form`. |
| `src/renderer/renderer.js` | Add four element references. Populate/read from the four new inputs in `initAgentPanel()` and the save handler. |
| `test/prompts.test.js` | New test file (or extend existing) — see Test Cases below. |

---

## IPC Additions

No new IPC channels are required for Phase 3. The existing channels are extended:

**`agent:get-profile`** — returns the normalized profile; response shape now includes `personality`, `tone`, `speaking_rules`, `custom_persona`. Renderer reads these on panel open.

**`agent:set-profile`** — accepts the extended profile shape; `normalizeAgentProfile` in `saveAgentProfile` strips unknowns and enforces caps. Returns the normalized profile.

**`personas:list`** — new read-only channel. Returns `Object.entries(AGENT_PERSONAS).map(([key, {label}]) => ({ key, label }))`. Used by the renderer to populate the persona `<select>` without importing `prompts.js` directly. Registered in `main.js`:

```js
ipcMain.handle("personas:list", () =>
  Object.entries(AGENT_PERSONAS).map(([key, { label }]) => ({ key, label }))
);
```

Exposed on `window.brah` in `preload.js`:

```js
listPersonas: () => ipcRenderer.invoke("personas:list"),
```

---

## Interaction with Phase 2 Memory

Identity and memory are **two distinct prompt sections** and must remain that way:

- **Identity (`# Identity`)** — user-authored, static per session. Describes Lena's character. Lives in the profile store. Never modified by runtime events.
- **Personal Context (`# Personal Context`)** — user-authored name/about/goals. Also static per session.
- **Memory (`# What Lena Knows`)** — learned by Lena from conversations. Written by the memory extraction pipeline (Phase 2). Injected via `memoryBlock` parameter. The user can view/edit it in the memory management UI (Phase 2 task 8), not the identity UI.

**Prompt ordering rationale:** Identity and Persona come before Personal Context and Memory so that character directives frame how Lena interprets everything that follows. Runtime Context comes last to ground time-sensitive reasoning without interfering with character.

**Interface contract for Phase 2:** `buildRealtimeInstructions({ profile, memoryBlock, now })`. Phase 2 constructs `memoryBlock` as a formatted string and passes it in. No other coupling.

---

## Edge Cases

| Case | Handling |
|---|---|
| `personality` + `tone` + `speaking_rules` all set and verbose | Each field has its own cap (500/300/500). Total identity section max ≈ 1300 chars before the `# Identity` header. Acceptable for realtime session instructions. |
| `custom_persona` set AND `persona` key also set | `custom_persona` wins — `buildPersonaInstructions` checks `custom_persona` first and skips the preset lookup entirely. |
| Combined identity + persona + about exceeds practical context | No hard truncation above field-level caps. If the user writes maximally long values in every field, total composed prompt may be ~5–6 KB. OpenAI Realtime API accepts instructions up to 20 KB; this is safe. |
| `custom_persona` > 800 chars | `normalizeStr` truncates to 800. The UI should show a character counter to surface this to the user, but enforcement is in `normalizeAgentProfile`. |
| Old profiles missing new fields | `normalizeAgentProfile` reads `profile?.personality` etc.; all new fields default to `""`. No migration needed — existing SQLite rows load fine. |
| Live update timing | Save triggers `window.brah.setAgentProfile(profile)`. The renderer then calls `primeFreshSession()` (already exists in renderer.js, line ~534) to discard the cached realtime secret and pre-fetch a new one with the updated instructions. The change is audible on the **next turn** (or immediately if a new session opens). Mid-turn changes do not interrupt the current response. |
| Empty `name` field | `buildAgentProfileInstructions` skips the name line; Lena does not address the user by name. This is intentional — name is opt-in. |
| `persona` key removed from `AGENT_PERSONAS` in a future patch | `normalizePersona` falls back to `DEFAULT_PERSONA` (`"lena"`). Saved profiles referencing the removed key degrade gracefully. |

---

## Definition of Done

- [ ] `normalizeAgentProfile` round-trips all eight fields through `saveAgentProfile`/`loadAgentProfile` without data loss or type errors.
- [ ] `buildRealtimeInstructions` output contains sections in the order: static base → identity → persona → personal context → memory → runtime. Verified by string-position assertions.
- [ ] With `personality = ""`, `tone = ""`, `speaking_rules = ""` the `# Identity` section is absent from the composed output.
- [ ] `custom_persona` set → preset persona prompt absent, custom text present.
- [ ] Preset persona set, `custom_persona = ""` → preset prompt present.
- [ ] `DEFAULT_AGENT_PROFILE.name === ""` and `DEFAULT_AGENT_PROFILE.persona === "lena"`.
- [ ] `AGENT_PERSONAS` contains `lena`, `brief`, `socratic`, `hype` in addition to the four originals.
- [ ] `personas:list` IPC returns all eight entries with `key` and `label`.
- [ ] Settings panel saves and reloads identity fields across app restarts (SQLite persistence).
- [ ] Voice picker change is reflected in the next realtime session's `voice` parameter.
- [ ] `npm test` passes (Biome check + all `node --test` suites).

---

## Test Cases

File: `test/prompts.test.js`

```
normalizeAgentProfile — new fields
  strips unknown fields from input
  truncates personality to 500 chars
  truncates tone to 300 chars
  truncates speaking_rules to 500 chars
  truncates custom_persona to 800 chars
  defaults missing new fields to ""
  accepts a fully populated profile without throwing

buildIdentityInstructions
  returns "" when personality/tone/speaking_rules are all empty
  returns "# Identity\n..." with all three fields when all set
  omits tone line when tone is ""
  includes speaking_rules with newline prefix

buildPersonaInstructions (updated signature)
  returns preset prompt when custom_persona is ""
  returns custom_persona text when custom_persona is non-empty (ignores preset key)
  returns "" for "lena" preset with empty custom_persona

buildAgentInstructions — composition order
  sections appear in order: static > identity > persona > personal context > memory > (runtime added by buildRealtimeInstructions)
  omits empty sections (identity absent when all identity fields "")
  includes memoryBlock when non-empty
  omits memory section when memoryBlock is ""

buildRealtimeInstructions
  result ends with runtime context section
  passes memoryBlock through to buildAgentInstructions
  memoryBlock defaults to "" when not provided

DEFAULT_AGENT_PROFILE
  name is ""
  persona is "lena"
  all new fields present and equal to ""

AGENT_PERSONAS
  contains keys: lena, therapist, explainer, coach, honest, brief, socratic, hype
  lena prompt is ""
  brief, socratic, hype have non-empty prompts
```

These map to `node:test` `describe`/`it` blocks. Reference the testing pattern used in existing test files under `test/`.
