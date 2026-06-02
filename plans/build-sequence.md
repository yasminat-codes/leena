# Lena — Build Sequence

Dependency-ordered phase breakdown with MVP boundary, complexity (S/M/L), and task lists. Each phase ships independently and gets a full spec in `plans/phases/`.

## MVP boundary

**Minimum lovable Lena = Phase 1 + Phase 2 + Phase 3.** A standalone, hotkey-summoned, personalized agent that remembers you. Phases 4–6 are high-value extensions that don't block daily use.

## Dependency graph

- **Phase 1 (Foundation)** — hard prerequisite for everything (persistent process, onboarding, keys).
- **Phase 2 (Memory)**, **Phase 4 (MCP/Composio)**, **Phase 5 (Wake word)** — independent of each other; all depend only on Phase 1.
- **Phase 3 (Identity)** — depends on Phase 1; pairs naturally with Phase 2 (memory feeds identity context).
- **Phase 6 (UI/UX)** — polishes surfaces from all prior phases; do last.

Recommended order optimizes user-visible value: **1 → 2 → 3 → 4 → 5 → 6.**

---

## Phase 1 — Foundation & Rename  (complexity: M)

Exit: app runs with no terminal, launches on login, reachable from tray, summonable by hotkey, branded "Lena", a second user can onboard with their own keys.

1. **[Task 1 — R-1 BLOCKER] Verify realtime auth model.** Test the ChatGPT-OAuth flow with a second account. Decide: keep OAuth or add OpenAI API-key path. (S)
2. Rename: `productName`→Lena, persona `LAD`→Lena, default name off "Ken", mic/screen usage strings, app copy. Decide bundle-ID/db rename vs. keep-stable + migrate (R-11). (S)
3. Build standalone app: switch `electron-builder` target to signed `dmg`+`zip`; verify launch with no terminal. (M)
4. Launch-on-login: `app.setLoginItemSettings({ openAtLogin: true })` + settings toggle. (S)
5. Menubar `Tray`: status (idle/listening/speaking/muted), quick actions (open, mute mic, settings, quit). (M)
6. Global hotkey: `globalShortcut` (e.g. `Option+Space`) → summon + start session. (S)
7. Onboarding flow: first-run window — OpenAI login/key, optional Composio + Mem0 keys, mic/screen permission walkthrough. Store via `safeStorage`. (M)
8. Code signing/notarization (Developer ID; sign native addons; notarize). (M)

## Phase 2 — Memory  (complexity: L)

Exit: a fact stated in one session is recalled in a later separate session; episodic log is append-only; Mem0 adapter validated against baseline.

1. Define `MemoryStore` interface contract. (S)
2. Schema: `memories_episodic`, `memories_semantic` in `database.js`. (S)
3. Baseline impl: `transformers.js` embeddings (cache model in `userData`), BLOB storage, brute-force cosine recall scored by similarity+recency+confidence. (L)
4. Extraction: after each conversation/turn, LLM extracts facts → ADD/UPDATE/SUPERSEDE against semantic tier. (M)
5. Injection: retrieve top-K → inject "What You Know About the User" block in `prompts.js`. (M)
6. Consolidation: periodic dedup/merge of near-duplicate semantic memories. (M)
7. **[Spike]** Mem0 adapter behind the interface; compare recall quality/latency to baseline; pick default. (M)
8. Memory management UI (view/edit/delete what Lena remembers). (M)

## Phase 3 — Identity  (complexity: M)

Exit: user edits identity in settings; change is audible in Lena's next reply; persona modes switch live.

1. Extend `agent-profile-store.js`: free-text identity fields (name, personality, tone, speaking rules). (S)
2. Persona presets/modes: extend `AGENT_PERSONAS`; add Lena-specific modes + a free-text override box. (S)
3. Wire into `buildRealtimeInstructions` (identity + persona + memory + runtime). (S)
4. Settings UI section for identity + persona + voice selection. (M)

## Phase 4 — MCP / Composio bridge  (complexity: L)

Exit: connect Gmail via Composio; Lena sends an email by voice behind a permission prompt; any MCP server addable by config.

1. `mcp-client.js` (main process): manage servers (`Map<id,{client,transport,tools}>`); HTTP + stdio transports. (L)
2. `mcp-tools.js`: executor in the `executeRealtimeTool` chain; namespaced tool names. (M)
3. Dynamic tool merge: `getRealtimeToolDefinitions()` = static + MCP tools (schema patched for OpenAI strict). (M)
4. Composio: `@composio/core` session → MCP URL+headers → connect; per-app OAuth via connect links; onboarding for Gmail/Calendar/Slack/Notion. (M)
5. Permission gating (ADR-6): default-deny, allowlist, definition hashing/drift, description sanitization. (M)
6. Server management UI (add/remove servers, connect apps, view tools). (M)

## Phase 5 — Wake word  (complexity: L)

Exit: "Hey Lena" starts a listening session hands-free from any app; mute works; FA/FR within target.

1. `WakeEngine` interface. (S)
2. **[Spike]** Train custom "Hey Lena" openWakeWord model; measure FA/hr + FR% in-renderer WASM. (M)
3. openWakeWord impl (WASM/onnxruntime-web in the always-on renderer); always-on mic capture. (L)
4. Two-stage gating: detection → start realtime session; debounce/cooldown. (M)
5. Consent + control: onboarding consent, tray listening indicator, mute/pause. (S)

## Phase 6 — UI / UX  (complexity: L)

Exit: window resizes + persists size; skins switchable; text-chat panel works; history searchable.

1. Theme/skin system: refactor `styles.css` to CSS variables; theme switcher; persist choice. (M)
2. Resizable window: relax locked min/max bounds; persist size (extend `window-state-store.js`). (M)
3. Expandable text-chat panel: type to Lena; shares tool/realtime backend; optional cheaper text model (ADR-8). (L)
4. Conversation history + search (uses episodic memory store). (M)
5. Proactive nudges (uses planner + memory; respectful, opt-in). (M)
