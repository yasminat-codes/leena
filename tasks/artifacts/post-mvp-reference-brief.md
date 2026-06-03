# Post-MVP Production Reference Brief

Task: 120 - Production reference research for UI, Composio, MCP, and Mac access
Created: 2026-06-03

## Scope

This brief is the reference handoff for later post-MVP implementation tasks. Downstream tasks must cite this file before using external API patterns for Composio, MCP, Mac access, Full Disk Access, dashboard/settings UI polish, or UI screenshot proof.

Local constraints from `CLAUDE.md` and phase plans:

- Storage uses `node:sqlite`; do not introduce JSON state for persisted app data unless a phase plan explicitly says the file is config-only.
- Main/preload boundaries are strict. Renderer code must use the context-isolated bridge; do not call Electron main-process APIs directly from renderer screens.
- Owner manual GUI smoke remains manual. Automated proof can prepare screenshots, tests, and checklists, but must not mark owner GUI smoke complete.
- Current local dependencies include `@modelcontextprotocol/sdk` `^1.29.0`, Electron `^42.3.0`, and Playwright `^1.60.0`. `@composio/core` is not installed yet.

## Kencode Search Log

Searches run before writing this artifact:

| Area | Query | Result |
|---|---|---|
| Composio | `from "@composio/core"` in `ComposioHQ/composio` | No result; import spelling was too narrow. |
| Composio | discover repos: `ComposioHQ composio` | GitHub API rate-limited; use code search/docs instead. |
| Composio | `ComposioHQ/composio` | Found external references to the official repo, not enough API contract. |
| Composio | `@composio/core` | Found official and community usage; current package is `@composio/core`. |
| Composio | `Composio({` | Found `ComposioHQ/composio` README/AGENTS snippets and recent app usages. |
| Composio MCP | `session.mcp` | Found `session.mcp.url` and `session.mcp.headers` references, including Composio community OpenClaw/Cowork usage. |
| Composio auth | `connectedAccounts.link`, `session.authorize`, `composio.create(` in `ComposioHQ/composio` | Found official repo docs for link, authorize, session creation, toolkit filtering, and MCP usage. |
| OpenClaw | `openclaw-n8n-railway` | No result in code search index. |
| OpenClaw | `TrendpilotAI` | Found only changelog mentions, no target repo snippets. |
| OpenClaw | `OpenClaw` | Found unrelated OpenClaw refs; not the exact target repo. |
| MCP SDK | `StreamableHTTPClientTransport`, `StdioClientTransport` in `modelcontextprotocol/typescript-sdk` | Found official SDK transport docs and source anchors. |
| Electron/macOS | `systemPreferences.getMediaAccessStatus`, `getMediaAccessStatus`, `askForMediaAccess`, `NSMicrophoneUsageDescription` | No usable kencode code results; official Electron/Apple docs used. |
| UI references | curated dashboard/settings reference sources | Initial narrow filter had no match; broader search found Twenty, Chatwoot, Midday, Dub, Origin UI, and related dashboard sources. |
| UI references | `settings`, `Integrations`, `SettingsLayout` in Twenty/Chatwoot/Midday | Found production settings navigation/cards/layout/table references. |

No-result searches above are intentional evidence. Do not convert them into claimed examples later.

## Composio References

Primary anchors:

- Official repo: `https://github.com/ComposioHQ/composio`
- Official sessions doc: `https://docs.composio.dev/docs/how-composio-works`
- Official TypeScript `ToolRouterSession` reference: `https://docs.composio.dev/reference/sdk-reference/typescript/tool-router-session`
- Official TypeScript `ConnectedAccounts` reference: `https://docs.composio.dev/reference/sdk-reference/typescript/connected-accounts`
- Official API session endpoint reference: `https://docs.composio.dev/reference/api-reference/tool-router/post-tool-router-session`

Safe findings:

- TypeScript SDK import is `import { Composio } from "@composio/core"`.
- A session is created with `await composio.create(userId, config?)`.
- Sessions expose native tools through `session.tools()` when a provider is configured and remote MCP access through `session.mcp.url`.
- Official docs say sessions also bind user identity, toolkit/tool filtering, auth config selection, connected account selection, execution state, MCP state, and workbench files.
- The MCP path should use both `session.mcp.url` and `session.mcp.headers`; public code search found recent examples passing those directly into MCP clients.
- Toolkit scope can be narrowed at session creation with `toolkits`, `tools`, tags, auth config mapping, and connected account mapping. Do not auto-enable all toolkits.
- Auth/connect flows should use either `session.authorize(toolkit, { callbackUrl? })` for a session-scoped connect flow or `composio.connectedAccounts.link(userId, authConfigId, { callbackUrl? })` for an auth-config-specific connect link.
- `ConnectionRequest` exposes `redirectUrl`, and connection completion can be polled with `connectionRequest.waitForConnection()` or `connectedAccounts.waitForConnection(connectionRequest.id)`.
- Composio docs recommend stable app user IDs and explicitly warn against production use of a shared/default user. Do not use `default` for Leena owner-scoped state unless a task explicitly defines a single-owner isolation model.

Implementation checks to rerun:

- Install and pin the current `@composio/core` version deliberately. The phase plan mentions `^0.10.0`; OpenClaw's template uses `^0.6.3`; docs may move faster than either.
- Verify whether `new Composio({ apiKey })` is sufficient for MCP-only use or whether any current constructor option is required.
- Verify exact casing for toolkit slugs (`gmail` vs `GMAIL`) against the installed SDK. Official session examples use lowercase slugs.
- Verify the `session.mcp.headers` object is directly acceptable to `StreamableHTTPClientTransport` with Leena's installed MCP SDK, or normalize into `Headers`.
- Do not rely on a method named `getComposioConnectUrl(app)`; code search and docs did not prove that helper exists. Implement it as Leena-owned wrapper around `session.authorize()` or `connectedAccounts.link()` if needed.

Risks:

- Composio auth APIs are actively changing. Recent changelog/code search shows shared-account options moved under `experimental`, which is explicitly unstable.
- Missing credentials, inactive connections, expired tokens, toolkit/tool typo errors, and too many tools must all fail closed and surface a user action instead of silently retrying with broad scope.
- Do not print or persist raw Composio API keys outside Electron `safeStorage`.

## OpenClaw / Railway Reference

Primary anchor:

- `https://github.com/TrendpilotAI/openclaw-n8n-railway`

Found through primary GitHub browsing because kencode code search did not index the exact repo name.

Usable findings:

- The repo is a Railway template for an OpenClaw gateway plus n8n workflow automation, Tailscale mesh access, optional companion services, Modal compute, Composio/Rube MCP integrations, and observability.
- README architecture says the public Express wrapper listens on port `8080`, serves `/setup/*`, and proxies non-setup traffic to an internal OpenClaw gateway on `127.0.0.1:18789`.
- `railway.toml` sets Dockerfile build, `/setup/healthz` healthcheck, and `PORT=8080`.
- `package.json` includes `@composio/core` `^0.6.3` and scripts for `dev`, `start`, `lint`, `test`, `smoke`, and quality reporting.
- `start.sh` configures Tailscale when `TAILSCALE_AUTHKEY` is present, supports boot-time OpenClaw updates with `OPENCLAW_UPDATE_REF`, then starts `src/server.js`.

Adaptation notes for Leena:

- Use this as a product/deployment reference for a setup wizard, health checks, safe diagnostics, proxying, observability, and status surfaces.
- Do not use it as the authoritative Composio TypeScript API contract; its dependency version is older than the phase plan and current official docs.
- Its Tailscale/Railway deployment model is not directly applicable to Leena's local Electron desktop runtime.

## MCP TypeScript SDK References

Primary anchors:

- Official repo: `https://github.com/modelcontextprotocol/typescript-sdk`
- Official client guide: `https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/client.md`
- Official migration guide: `https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration.md`
- V1 API docs landing page: `https://ts.sdk.modelcontextprotocol.io/`

Local package check:

- Leena currently depends on `@modelcontextprotocol/sdk` `^1.29.0`.
- Local import probe succeeded for:
  - `@modelcontextprotocol/sdk/client/index.js`
  - `@modelcontextprotocol/sdk/client/streamableHttp.js`
  - `@modelcontextprotocol/sdk/client/stdio.js`
- Local `StreamableHTTPClientTransportOptions` includes `requestInit?: RequestInit`, `fetch?`, `sessionId?`, and `authProvider?`.
- Local `StdioClientTransport` accepts `{ command, args?, env?, stderr?, cwd? }`.
- Local `Client.callTool()` takes a params object (`CallToolRequest["params"]`), so use `client.callTool({ name, arguments: args })`, not the phase-plan shorthand `callTool(serverId, originalName, args)`.

Safe v1 flow for Leena's current dependency:

```js
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "leena", version: appVersion });

const httpTransport = new StreamableHTTPClientTransport(new URL(config.url), {
  requestInit: { headers: config.headers ?? {} },
});
await client.connect(httpTransport);
const tools = await client.listTools();
const result = await client.callTool({ name: originalName, arguments: args });

const stdioTransport = new StdioClientTransport({
  command: config.command,
  args: config.args ?? [],
  env: resolvedSafeEnv,
});
```

Version risk:

- The official `main` branch is v2 pre-alpha/current-development and publishes split packages (`@modelcontextprotocol/client`, `@modelcontextprotocol/server`, optional middleware packages).
- The official README states v1.x remains the recommended production version until v2 stabilizes. This matches Leena's current dependency.
- Current v2 docs use import paths such as `@modelcontextprotocol/client` and `@modelcontextprotocol/client/stdio`. Do not mix those with Leena's v1 package without an explicit upgrade task.
- The v2 migration guide says headers now use Web Standard `Headers`; Leena's v1 package still exposes `requestInit`, but implementation should test Composio's `session.mcp.headers` object at connect time.

Implementation checks to rerun:

- HTTP connect: `client.connect(new StreamableHTTPClientTransport(new URL(session.mcp.url), { requestInit: { headers } }))`.
- Stdio connect: resolve a safe PATH/environment in the main process, pass it explicitly, and handle stderr without leaking secrets.
- After connect: `listTools()`, namespace tool names as `<serverId>__<toolName>`, and hash/sanitize schemas/descriptions before showing to the model.
- Tool call: verify result normalization for `{ content, isError? }` and preserve raw structured content only behind safe serialization.
- Unknown server, unknown tool, schema drift, disconnected server, and more than allowed tool count must all exclude tools from the realtime definition set.

## Electron / macOS Access References

Primary anchors:

- Electron `systemPreferences`: `https://www.electronjs.org/docs/latest/api/system-preferences`
- Electron `shell.openExternal`: `https://www.electronjs.org/docs/latest/api/shell`
- Apple sandbox/file access: `https://developer.apple.com/documentation/security/accessing-files-from-the-macos-app-sandbox`
- Apple developer forum deep-link note for Full Disk Access: `https://developer.apple.com/forums/thread/124895`

Safe findings:

- Electron `systemPreferences.getMediaAccessStatus(mediaType)` supports `microphone`, `camera`, and `screen`, returning `not-determined`, `granted`, `denied`, `restricted`, or `unknown`.
- Electron `systemPreferences.askForMediaAccess(mediaType)` is macOS-only and supports `microphone` and `camera`, not screen recording or Full Disk Access.
- Electron docs state macOS 10.14+ requires consent for microphone/camera, and macOS 10.15+ requires consent for screen access.
- Electron docs state a denied media permission later changed through System Settings may require an app restart before the new permission takes effect.
- Electron `systemPreferences.isTrustedAccessibilityClient(prompt)` detects Accessibility trust and can prompt the user.
- Electron `shell.openExternal(url)` opens external protocol URLs from the main process; use this for Settings deep links through main IPC, not direct renderer calls.
- Apple guidance says apps cannot automatically gain Full Disk Access through entitlement or code; the user must grant it in System Settings > Privacy & Security.
- Apple developer forum guidance gives a Full Disk Access deep link: `x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles`.

Leena local anchors:

- `src/os-permissions.js` already defines macOS deep links for microphone, screen recording, and accessibility.
- It does not currently define a Full Disk Access permission ID/deep link.
- Current build metadata has `NSMicrophoneUsageDescription` and `NSScreenCaptureDescription`; Electron docs specifically require microphone/camera strings for `askForMediaAccess()`. If camera is added, add `NSCameraUsageDescription`.

Implementation checks to rerun:

- Detect microphone with `getMediaAccessStatus("microphone")`; request only microphone via `askForMediaAccess("microphone")`.
- Detect screen recording with `getMediaAccessStatus("screen")`; trigger real capture/listing as needed and guide user to Screen Recording settings.
- Detect Accessibility with `isTrustedAccessibilityClient(false)`; request/guide with `isTrustedAccessibilityClient(true)` or settings deep link.
- Full Disk Access: implement as guide/open-settings plus a safe probe against a protected location, not a silent grant. Handle `EACCES` and `EPERM` distinctly where possible.
- Add `Privacy_AllFiles` deep link only through main-process `shell.openExternal`, with fallback to generic Privacy settings.
- Treat permission state changes as requiring relaunch/retry; do not promise immediate activation after the owner flips a switch.

## Dashboard / Settings UI References

Primary code-search anchors:

- Twenty CRM settings UI: `https://github.com/twentyhq/twenty`
- Chatwoot settings layouts: `https://github.com/chatwoot/chatwoot`
- Midday dashboard and connected-account UI density: `https://github.com/midday-ai/midday`
- Curated component/dashboard references: Origin UI, Shadcn Space, Dub, Documenso, Directus.

Usable patterns:

- Twenty settings navigation groups similar concerns and hides entries behind permission/feature checks. Adapt this to keep Leena Settings compact: overview first, then focused detail panes.
- Twenty `SettingsCard` uses icon, title, description, disabled/soon state, and trailing affordance. Adapt the information hierarchy, not the React implementation.
- Chatwoot settings screens use a shared `SettingsLayout` with header, loading state, empty state, body slot, search, and table/list actions. Adapt this into Leena's vanilla renderer as reusable DOM builders for settings/integrations sections.
- Chatwoot's dense table/list settings are a better reference for repeated operational rows than decorative marketing cards.
- Midday is a useful reference for polished business dashboards: compact typography, restrained color, strong table/chart density, and visible empty states.

Leena adaptation rules:

- Preserve existing theme/treatment/density values unless a task explicitly changes them.
- Do not swap to React/Tailwind/shadcn. Use these references as product patterns for layout, states, spacing, navigation, and information hierarchy.
- Avoid nested cards. Use full-width sections, rows, and repeated item cards only where a repeated object is being represented.
- Settings should expose Composio, MCP, providers, themes, Mac Access, and updates as focused detail surfaces, not raw forms on first view.
- Integrations should show status, last checked time, primary action, secondary diagnostics, and an advanced/manual detail path.
- Controls should have stable dimensions and states: idle, loading, success, warning, error, disabled, missing credential, permission denied, and needs restart/relaunch.

UI proof requirements:

- Later UI tasks must use the task 121 screenshot harness once it exists.
- Required screenshots should include Home, Chat, Settings overview/detail, Integrations overview/detail, Composio Actions Hub, Custom MCP detail, Mac Access, and voice starting/failure states.
- Proof must include nonblank/pixel checks and manual visual notes for overlap/clipping. Do not rely on "tests passed" alone for UI polish.

## Production Testing Anchors

Baseline commands required by this wave worker:

- `npm run check`
- `node --test`

Later implementation gates from `tasks/SPEC-POST-MVP-REFINEMENT.md`:

- Focused tests per task.
- Screenshot proof through the post-MVP harness for UI changes.
- Integration tests with mocks/fakes for credentials, Apple resources, denied permission, missing credential, unknown status, and write-confirmation behavior.
- Final gate: `npm run check`, full `node --test`, `git diff --check`, screenshot proof, integration matrix, and DMG/ZIP structural verification.

Do not mutate real Apple Calendar resources, owner files, Composio accounts, Gmail, Slack, or MCP remote services in automated tests. Use mocks/fakes unless an explicit owner manual smoke step is being performed.

## Research Gaps To Preserve

- Exact `TrendpilotAI/openclaw-n8n-railway` code snippets were not available via kencode code search; the GitHub repo was reachable through primary browsing and is usable as a product/deployment reference only.
- Kencode did not return Electron permission API examples. Use Electron official docs and Leena local `src/os-permissions.js` as anchors.
- Apple's Full Disk Access official documentation is JS-rendered in public HTML; use the Apple doc URL plus Apple developer forum deep-link guidance, and verify on a real macOS install during implementation.
- Composio method shapes and package versions are actively moving. Re-verify installed SDK method names before implementation, especially `session.authorize`, `connectedAccounts.link`, `session.toolkits`, and `session.mcp.headers`.
- MCP v2 docs are visible on the official repo, but Leena is on v1. Do not import v2 packages unless a separate dependency-upgrade task is claimed.
- No real Composio credentials, Full Disk Access state, or live Gmail/MCP tool execution was tested in this research task.

## Downstream API Checklist

Before implementing any related task, verify:

- Composio credential flow: API key safeStorage load/save, constructor, session creation, toolkit allowlist, connect link, toolkit status, refresh/reconnect.
- Composio MCP flow: `session.mcp.url`, `session.mcp.headers`, MCP HTTP connect, tool list, tool call, inactive connection behavior.
- MCP stdio flow: command/args/env validation, login-shell PATH resolution, child process lifecycle, stderr handling, and disabled/error status.
- macOS privacy flow: microphone request/status, screen status/capture prompt, Accessibility trust, Full Disk Access guide/probe, restart/relaunch messaging.
- UI proof flow: screenshot harness command, artifact directory, nonblank assertion, required states, and overlap notes.
