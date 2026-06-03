# Leena Post-MVP UI, Integrations, and Mac Access Refinement Spec

Created: 2026-06-03
Status: planned
Scope: tasks 120-146, waves 17-23

## Goal

Refine Leena from a working MVP into a polished desktop app surface with a dashboard-like Home, first-class Chat, focused Settings, mature Integrations, Composio Actions Hub, MCP setup, Apple/Mac access, stable voice startup, and rigorous screenshot/integration proof.

## Owner Decisions

- Main sidebar stays lean: Home, Chat, Activity, Tasks, Integrations, Settings.
- Settings opens to a compact Overview. Cards open focused in-place details.
- Preserve the existing theme/treatment/density values and behavior.
- Updates download first, then show a separate restart-to-finish action.
- Mac access allows independent read/search after grant. Write, delete, and OS-control actions require confirmation unless trusted write mode is explicitly enabled.
- MCP uses polished integration cards and an advanced Custom MCP form.
- Composio is a first-class Actions Hub integration, with secure credential storage, Test connection, Refresh tools, and advanced MCP details.
- Full Disk Access is a high-power Trusted Mac Access capability. Leena can guide the owner to grant it and detect status, but cannot silently grant it.
- Voice plus button shows a stable Starting state and actionable failure states instead of disappearing.
- Home becomes a practical dashboard; the orb remains a polished voice dock, not the whole page.
- Chat becomes a full conversation workspace with history rail, active transcript, provider/model controls, and voice affordance.

## Non-Negotiable Constraints

- Run kencode-search before implementation files are changed.
- Use production references for Composio, MCP, Mac access, and UI patterns. Record no-result searches instead of inventing examples.
- Do not print, commit, or return raw Composio credentials or other secrets.
- Unknown or stale MCP/Composio tool metadata must fail closed.
- Do not mutate real Apple Calendar resources or owner files in automated tests.
- Keep shared files serialized: `src/main.js`, `src/preload.js`, `src/renderer/renderer.js`, `src/renderer/screens/settings.js`, and `src/renderer/leena.css`.
- Preserve owner manual GUI smoke as manual unless the owner explicitly changes that contract.

## Wave Plan

| Wave | Theme | Tasks |
|------|-------|-------|
| 17 | Research, proof, and contracts | 120, 121, 122, 123 |
| 18 | Shell, visual system, integration foundations, voice preflight | 124, 125, 126, 131, 133, 135, 142 |
| 19 | Settings router, MCP polish, Composio refresh, Mac adapters, chat shell | 127, 132, 134, 136, 137, 140, 143 |
| 20 | Focused settings details, file policy, live chat wiring | 128, 129, 130, 138, 141 |
| 21 | Permission UX and UI regression proof | 139, 144 |
| 22 | Integration test matrix | 145 |
| 23 | Build smoke and owner handoff | 146 |

## Verification Strategy

- Each implementation task has focused unit or integration tests.
- UI tasks must refresh screenshot proof through the post-MVP harness.
- Integration tasks must test happy path, missing credential, denied permission, unknown status, and write-confirmation behavior using mocks/fakes.
- Final gate runs `npm run check`, full `node --test`, `git diff --check`, screenshot proof, integration matrix, and DMG/ZIP structural verification.

## External Reference Notes

Initial code search found `ComposioHQ/composio` as the primary Composio repository and `TrendpilotAI/openclaw-n8n-railway` as an OpenClaw-related Composio/n8n reference. Direct searches for exact Hermes/OpenClaw macOS Full Disk Access implementations did not produce reliable matches; task 120 must record this and use official Electron/Apple/MCP/Composio documentation for API contracts where code search is insufficient.
