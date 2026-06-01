# Lena — Decision Log (ADRs)

Architectural decisions with context, options, rationale, consequences. Canonical source for all phase specs.

---

## ADR-1 — Kill the terminal dependency via packaging, not a daemon

- **Context:** The app currently runs via `npm start` (`electron .`), so it dies when the terminal closes. `electron-builder` is already configured (`mac dir` target → `dist/mac-arm64/Brah.app`).
- **Options:** (a) Package as a standalone `.app` + launch-on-login; (b) run a background Node daemon + thin UI; (c) keep dev workflow.
- **Decision:** (a). Build the `.app`, add `app.setLoginItemSettings({ openAtLogin: true })`, add a menubar `Tray`. The app already has auto-update wired.
- **Rationale:** No new architecture; uses Electron's native lifecycle. A daemon would duplicate the process model the app already has.
- **Consequences:** Need code signing/notarization for sharing (see ADR-7). Window currently uses `skipTaskbar: true` — pair with a Tray so the app is reachable when no window is visible.

## ADR-2 — Memory as a swappable interface; custom sqlite baseline, Mem0 as an adapter

- **Context:** User first chose "hand-build on node:sqlite," then "actually use Mem0, support all memory types." Research: Mem0 is the only embeddable-in-Node option but its local mode is less proven; Letta/Zep/Cognee/Hindsight need Python/Docker/graph servers. `node:sqlite` **cannot load `sqlite-vec` on macOS** (`OMIT_LOAD_EXTENSION`).
- **Options:** (a) custom sqlite only; (b) Mem0 only; (c) stack both (rejected — two embedders, two sources of truth); (d) **one `MemoryStore` interface, custom baseline + Mem0 adapter.**
- **Decision:** (d). Baseline = custom `node:sqlite` + `transformers.js` local embeddings + brute-force cosine. Mem0 = an alternative adapter validated in Phase 2.
- **Rationale:** Honors both user answers without redundancy; doesn't bet the centerpiece feature on an unproven dependency; brute-force cosine is <5ms at personal scale.
- **Consequences:** Define the interface contract before either impl. Mem0 graph mode (Neo4j) is **out** — too heavy to ship to others; use Mem0 vector mode only.

## ADR-3 — Memory "types" flattened to episodic + semantic + procedural

- **Context:** User asked for "procedural, episodic, semantic, long-term."
- **Decision:** Two stores + one thin layer: **episodic** (append-only log of exchanges — the "never forget" guarantee), **semantic** (consolidated, deduped facts for recall). **Procedural** = a small preferences/"how Lena should do my tasks" set (a tagged subset of semantic). **Long-term vs working** = a retention/recency scoring axis, not a separate store.
- **Rationale:** Avoids over-building four parallel subsystems; maps to the proven two-tier research design while covering every type the user named.
- **Consequences:** `data-model.md` defines `memories_episodic`, `memories_semantic` (with `category` incl. `procedural`), not four tables.

## ADR-4 — Composio via a generic MCP client, not bespoke code

- **Context:** User wants Composio ("Compose-you") + general MCP. Composio exposes a per-user Streamable-HTTP MCP endpoint.
- **Decision:** Build one generic MCP client (`@modelcontextprotocol/sdk`) in the **main process**; Composio is just a configured remote server (`@composio/core` creates the session → URL + headers → `StreamableHTTPClientTransport`). MCP tool `inputSchema` maps ~1:1 to OpenAI function-tool definitions (namespace tool names per server).
- **Rationale:** Any MCP server (incl. all Composio apps) drops in as config. No special-casing.
- **Consequences:** Dynamic tool list → `getRealtimeToolDefinitions()` must merge static + MCP tools. Must patch `additionalProperties:false` for OpenAI strict mode or set `strict:false`. Security: ADR-6.

## ADR-5 — openWakeWord, behind an engine-agnostic interface

- **Context:** "Hey Lena" wake word. Picovoice Porcupine is best but its **free tier ends 2026-06-30** and paid is enterprise-priced. openWakeWord is Apache-2.0/free, no official Node SDK (WASM/onnxruntime-web in renderer, or Python sidecar), "good enough" accuracy, ~1hr custom training.
- **Decision:** Target **openWakeWord** via WASM in the always-on renderer (the `orb` window keeps it alive). Wrap in a `WakeEngine` interface so Porcupine/OS speech can swap in later.
- **Rationale:** Sustainable free cost for a shared personal app; the interface removes lock-in.
- **Consequences:** Custom-train "Hey Lena" ONNX model; validate false-accept rate in a Phase 5 spike; always-on local mic is a privacy/consent surface (mute toggle required).

## ADR-6 — MCP/dynamic tools default to "needs confirmation"

- **Context:** MCP tools are externally defined → tool-poisoning, rug-pull (silent schema change), prompt-injection via descriptions/results.
- **Decision:** Extend `tool-permissions.js`: unknown/MCP tools default to `write`/`destructive` level (explicit user confirmation). Allowlist servers. Hash tool definitions on approval; re-prompt on drift. Sanitize/truncate tool descriptions before prompt injection.
- **Consequences:** Reuse the existing permission prompt UI; never auto-approve external tools.

## ADR-7 — Code signing + per-user credential onboarding for sharing

- **Context:** Distribution = "share with a few people." Cannot ship the owner's OpenAI/Composio/Mem0 keys.
- **Decision:** Move to a signed/notarized build (Developer ID; `electron-builder` `dmg`+`zip`, hardened runtime already on). Add an **onboarding flow**: OpenAI login (OAuth or API key per R-1), optional Composio key, optional Mem0 key — all stored via Electron `safeStorage` (keychain), as the app already does for OpenAI tokens.
- **Consequences:** Requires an Apple Developer ID cert; `auth-matrix.md` + `env-secrets.md` define the credential set.

## ADR-8 — "Always-ready" session policy

- **Context:** User chose responsiveness over realtime-minute savings.
- **Decision:** Keep generous idle timeout before auto-ending a realtime session; wake/hotkey reconnect fast. Memory embeddings/extraction run locally (free) so "always-ready" cost is bounded to realtime minutes only. Optional Phase 6 cheaper text mode (non-realtime model) for typed chat.
- **Consequences:** Document cost expectations in onboarding; expose an idle-timeout setting.
