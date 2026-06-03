# Settings and Integrations IA Contract

Status: accepted for Wave 17 downstream UI work.

This contract is the source of truth for the Settings, Integrations, and sidebar information architecture. Downstream UI tasks must cite this file in handoff notes before changing these surfaces.

## Source Checks

- `src/renderer/shell.js` currently routes `Home`, `Activity`, `Tasks`, `Integrations`, and `Settings`; the accepted contract adds `Chat` as a top-level screen rather than nesting it under Home or Settings.
- `src/renderer/screens/settings.js` currently owns identity/persona, appearance, hotkey, updates, provider defaults, launch/notification switches, and wake controls.
- `src/renderer/screens/integrations.js` currently owns MCP server listing, add-server, connect/disconnect, remove, status, transport, and tool-count interactions.
- `test/settings-screen.test.js` protects the existing appearance values and default appearance behavior.

## Main Sidebar

The approved sidebar order is:

1. Home
2. Chat
3. Activity
4. Tasks
5. Integrations
6. Settings

`Chat` is a first-class screen. It must not be hidden inside Home, Activity, Settings, a modal-only launcher, or an Integrations detail. The global voice dock can remain available outside Chat, but the conversation workspace lives under Chat.

Do not add new top-level sidebar destinations for Theme, Providers, Updates, Mac Access, MCP, Composio, Calendar, Files, Permissions, Models, Voice, or Tools. Those are detail views inside Settings or Integrations.

## Settings Contract

Settings opens to a compact `Overview`, not directly to a long form. The Overview shows cards for the detail areas below. Selecting a card opens the detail in place within the Settings screen, with a clear path back to Overview. This is a detail-panel pattern, not a tab bar.

Settings owns personal app preferences and local app configuration:

- `General`: identity/profile name, active persona, hotkey, launch on login, proactive nudges, notifications, and other basic app behavior.
- `Theme`: appearance controls only.
- `Providers`: provider credentials/configuration and provider/model defaults by capability.
- `Updates`: app version, check, download, and restart/install controls.
- `Mac Access`: trusted Mac access state, permission guidance, wake/voice access state, and high-power local capability toggles or summaries.

Settings may show a small integrations-health summary card on Overview, but integration setup and tool-source details open in Integrations.

### Theme Values

Preserve the existing appearance contract exactly:

- Theme values: `workspace`, `light`, `dark`, `vercel-dark`
- Treatment values: `workspace`, `aurora`, `coral`, `iris`
- Density values: `compact`, `comfortable`
- Defaults: `theme=workspace`, `treatment=workspace`, `density=comfortable`

Do not rename, remove, reorder into a new meaning, or visually rebrand these values without owner approval. Segmented controls are appropriate for Theme, Treatment, and Density because they are small finite choices; do not reuse segmented controls as primary navigation.

### Provider Values

Settings > Providers preserves the current provider model:

- Provider cards: `OpenAI`, `OpenRouter`, `Ollama`
- Capability defaults: `Chat`, `Realtime`, `Embeddings`, `TTS`, `STT`
- Expected actions: configure, test connection, refresh models, select default provider/model per capability, and download/pull local Ollama models.

Provider setup belongs in Settings. Provider health can be summarized in Integrations, but editing provider credentials or default models should deep-link back to Settings > Providers instead of duplicating the form.

## Integrations Contract

Integrations opens to an `Overview` of integration cards. Selecting a card opens a detail panel in place. The default screen should be useful even with no configured integrations; it should not show a raw empty form as the first impression.

Integrations owns external tool sources, connection health, and action surfaces:

- `Composio`: first-class Actions Hub integration. It must be visible as its own card, support credential status/test/refresh-tool states when available, and route executable tools through the existing MCP/schema/permission path.
- `Custom MCP`: advanced manual MCP setup. Existing HTTP/stdio add-server, connect/disconnect, remove, status, transport, endpoint/command, and tool-count behavior belongs here.
- `Apple Calendar`: calendar connection and permission state. Read access and write/delete actions must remain explicit and permission-gated.
- `Files / Full Disk Access`: file integration scope, workspace access, Full Disk Access status, and trusted-write state. Do not imply Leena can silently grant Full Disk Access.
- `Provider Health`: connection/model health summary for OpenAI, OpenRouter, and Ollama. Configuration edits should route to Settings > Providers.

MCP manual setup must not appear as a main Integrations tab or the default raw form. It belongs under `Custom MCP` or an advanced detail within that card.

## Not A Tab Explosion

These rules are mandatory for Settings and Integrations UI tasks:

- Keep the main sidebar to the six approved destinations.
- Each of Settings and Integrations opens to Overview.
- Use cards to enter details; render details in place.
- Show at most one active detail panel per screen.
- Do not create top-level tabs for each setting or integration.
- Do not duplicate the same edit form across Settings and Integrations.
- Do not add marketing-style empty states. Empty states must expose the next useful action.
- Preserve current theme, treatment, density, spacing, card radius, button, chip, and typography treatment unless a task explicitly changes design tokens.
- UI copy must fit compact desktop widths without overlapping controls.

## Ownership Split

Use this split when deciding where a control belongs:

- If it changes Leena app preferences, identity, appearance, provider defaults, updates, or local trust posture, place it in Settings.
- If it connects or manages an external action/tool source, place it in Integrations.
- If a feature needs both, show status in one place and deep-link to the owner surface for editing.

## Downstream Handoff Requirement

Any task that changes sidebar routing, Settings, Integrations, Chat entry, provider setup, Composio, MCP, Apple Calendar, Files, or Mac Access UI must cite `tasks/artifacts/settings-ia-contract.md` in its handoff notes.
