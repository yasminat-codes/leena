# Mac Access Trust Contract

Created: 2026-06-03
Owner task: 122
Status: contract for downstream implementation

## Purpose

Leena may earn broad Mac access for read/search workflows, but high-power actions stay explicit, auditable, and centrally gated.

The contract is:

- Read/search actions may run independently only after the required OS or integration grant is known-good.
- Write, delete, and OS-control actions require a confirmation prompt by default.
- `Allow trusted write actions` may suppress those prompts only for known, current, centrally classified tools.
- Unknown permission status, stale tool metadata, missing schemas, or unclassified tools fail closed.

## Source Anchors

- Required pre-draft `kencode-search` queries were run for macOS Full Disk Access, Accessibility, Calendar/EventKit, and Electron permission handling. The high-star repository discovery searches returned no usable implementation anchors, so this contract uses official Electron and Apple API behavior plus current Leena source/tests.
- Electron `systemPreferences` can report media status for `screen` and can check/prompt Accessibility trust, but it cannot silently grant macOS privacy permissions.
- Electron `desktopCapturer` requires user consent for screen capture on macOS 10.15+.
- Apple Calendar access is permissioned: write-only access can create events without reading calendar data, while full access is needed to read, edit, and delete events.
- Apple Full Disk Access is user controlled in System Settings. Leena can open/guidance settings and detect/probe status, but it cannot grant Full Disk Access programmatically.

## UI Names

Use these exact labels unless a later UI contract deliberately changes them:

- `Trusted Mac Access`: the integration/settings area that explains high-power local access.
- `Full Disk Access`: the macOS privacy grant for broad filesystem read/search.
- `Allow trusted write actions`: an explicit off-by-default toggle that allows known write/delete/control tools to run without a per-call prompt.

Recommended status names:

- `not-determined`: Leena has not requested or probed the permission yet.
- `granted`: Leena has current positive evidence.
- `denied`: the OS or integration reports denial.
- `restricted`: the OS reports policy restriction.
- `unknown`: Leena cannot verify the state. Treat as not granted.
- `unsupported`: the current platform or build cannot provide the capability.
- `stale`: tool metadata or permission evidence is too old or mismatched to trust. Treat as not granted.

## Capability Model

### Read/Search After Grant

These may run without repeated confirmation after the required grant is `granted`:

- File read/search inside the existing workspace scope.
- Broad Mac file read/search only when `Full Disk Access` or an explicit user-selected scope is granted.
- Calendar list/search only when the chosen Apple Calendar path has a grant that permits reads. EventKit write-only access is not enough for read/search.
- Screenshot source listing and screenshot capture only after Screen Recording is granted.
- Web search/fetch under the existing `network` policy, not under Mac access.
- MCP/Composio read-only tools only when the tool is namespaced, server-owned, current, and centrally classified as `read` or `low`.

Read/search permission is not permission to write. Broad Mac read/search also does not permit Leena to log raw private file contents, secrets, or full sensitive paths into diagnostics, task artifacts, prompts, or renderer-visible summaries.

### Prompted By Default

These require confirmation unless `Allow trusted write actions` is explicitly enabled and the tool is eligible:

- File `write_file`, `edit_file`, overwrite, move, rename, delete, chmod/chown, archive extraction, or any operation that changes disk state.
- Calendar create, edit, move, invite, RSVP, delete, or reminder mutation through Apple Calendar, local planner tools, MCP, or Composio.
- MCP and Composio tools classified as `write`, `network`, `destructive`, `screen`, `sensitive`, or `control`.
- Screenshot analysis that sends screen contents to a model or remote service.
- Computer Use with `target: "computer"` or any tool that controls mouse, keyboard, windows, apps, System Settings, shell, browser profiles, or external accounts.

Confirmation copy must show the action label, risk level, sanitized details, and the integration/tool source. It must not include raw credentials or unnecessarily expose private absolute paths.

### Trusted Write Override

`Allow trusted write actions` is allowed to remove repeated prompts only when all of the following are true:

- `Trusted Mac Access` is enabled.
- The required OS/integration grant is `granted`.
- The specific tool is known, current, server-owned when applicable, and classified by the central permission map.
- The tool is not `unknown`, unregistered, malformed, or backed by stale/missing metadata.
- The action is within the user-granted scope.
- The execution path still records a concise activity/audit entry.

The override does not grant macOS permissions, does not bypass OS dialogs, does not expose secrets, and does not convert unknown status into permission. It also does not allow tests to mutate real Apple Calendar data, real owner files outside a fake/sandboxed scope, or real Composio resources.

Even with the override on, Leena must still stop and ask for owner confirmation before payments, credential reveal/use, account deletion, security/privacy settings changes, irreversible bulk deletion, or actions in unrelated private windows.

## Integration-Specific Rules

### macOS Permissions

Leena may:

- Show status for Microphone, Screen Recording, Accessibility, Computer Use browser support, and Full Disk Access.
- Open the relevant macOS Privacy & Security pane when possible.
- Trigger only OS-supported prompts, such as microphone/camera prompts where Electron supports them.
- Run safe status probes for Full Disk Access when no official status API exists, without reading, printing, or storing private file contents.

Leena must not:

- Claim it can grant Full Disk Access, Screen Recording, Accessibility, or Calendar access silently.
- Treat `unknown`, failed probe, unsupported platform, or stale cached status as `granted`.
- Depend on renderer-provided permission state for execution decisions.

### File Tools

File access has two independent dimensions:

- Scope: workspace, explicit user-selected path, or broad Mac access after Full Disk Access.
- Action: read/search versus write/delete/edit.

Broad read/search can unlock after scope/grant. Write/delete/edit stays prompted by default and may use the trusted write override only if the central gate approves it for a known tool.

### Apple Calendar

Apple Calendar adapters must declare which access mode they use:

- Write-only: may create events if granted, but cannot read/list/search user calendars.
- Full access: may read, create, edit, and delete events if granted.
- EventKit UI or user-mediated UI: may be preferred when Leena should let the owner review/save rather than mutate directly.

Calendar create/edit/delete requires confirmation by default unless trusted write mode is enabled. Calendar reads require real read-capable permission; write-only status must not be presented as read access.

### Screenshots And Screen Analysis

Screen Recording is a read-like OS grant, but screen contents are sensitive.

- `list_screenshot_sources` and `take_screenshot` require Screen Recording and should avoid leaking captured file paths/content in logs.
- `analyze_screen` is higher risk because it sends visible content to a model/service and should remain confirmable unless the confirmation UX explicitly classifies it as trusted under the same central policy.
- Unknown Screen Recording status blocks screenshot and analysis tools.

### Computer Use And OS Control

Browser-harness Computer Use and real desktop control are separate capabilities.

- Browser-harness automation requires the automation browser/runtime.
- Real desktop control requires Screen Recording and Accessibility.
- `computer_use_task` with `target: "computer"` is `destructive`/control-risk, not a normal read.
- Unknown, denied, unsupported, or stale Screen Recording/Accessibility state blocks OS control.
- Trusted write mode can remove routine per-action prompts only after the central gate classifies the tool and required grants are current. It must not override sensitive-stop rules for credentials, payments, security settings, unrelated windows, or irreversible changes.

### MCP

MCP tools are externally supplied and must pass the central MCP gate before exposure or execution:

- Tool names must be valid and namespaced.
- Server ownership must match.
- Tool metadata must include a matching name and object `inputSchema`.
- Missing, stale, malformed, mismatched, or unnamed metadata returns `unknown` and blocks auto-approval, including for `permission_level: "trust"`.
- `permission_level: "auto"` may auto-approve only `read`/`low` tools.
- `permission_level: "confirm"` prompts for every tool.
- `permission_level: "trust"` may auto-approve only after metadata validation and central risk classification.

Risk inference is a fallback, not authority. Any new MCP integration that can write, delete, run commands, send messages, control screens, or touch local paths must add explicit tests proving it does not auto-run from unknown/stale metadata.

### Composio

Composio is an integration source, not a permission bypass.

- Credentials must be stored through secure storage and returned only as configured/redacted status.
- Tool refresh may create/update MCP server/tool metadata.
- Composio tool execution must use MCP namespacing, schema conversion, metadata validation, and the central permission gate.
- Missing credential, failed refresh, stale tool list, SDK/API drift, or ambiguous tool metadata blocks exposure or execution.
- Enabled toolkits must be explicit user selections; do not expose a large tool flood by default.

## Central Risk Mapping

Every new realtime/chat/integration tool must be mapped before it is advertised:

| Risk | Meaning | Default behavior |
|------|---------|------------------|
| `low` | Local non-mutating utility with minimal privacy impact | May auto-run |
| `read` | Reads local/integration data after a grant | May auto-run after grant |
| `network` | Sends queries/URLs or calls remote services | Confirm unless existing policy allows |
| `screen` | Lists/captures screen/window content | Requires Screen Recording; confirm per screen policy |
| `sensitive` | Reads/sends sensitive personal or screen data | Confirm by default |
| `write` | Creates or changes data | Confirm unless trusted write override applies |
| `destructive` | Deletes, overwrites, controls OS, runs commands, or has irreversible side effects | Confirm unless trusted write override applies and sensitive-stop rules allow |
| `control` | Moves mouse/keyboard/windows/apps or changes system/account state | Confirm unless trusted write override applies and sensitive-stop rules allow |
| `unknown` | Missing, stale, invalid, or unclassified metadata | Block exposure/execution |

The renderer may display permission state and prompt results, but execution decisions belong in main/realtime-owned code paths. Renderer-provided tool schemas, roles, permission flags, or cached grants are not trusted authority.

## Test Expectations

Downstream tests must prove:

- Unknown OS permission status does not unlock broad reads, screenshots, Calendar, or OS control.
- Full Disk Access detection never reads, prints, snapshots, or returns private file contents.
- Write/delete/control tools request confirmation with trusted write mode off.
- Trusted write mode on allows only known/current/mapped tools with required grants.
- Unknown first-party tool names return `unknown` or a model-visible denial.
- MCP missing config, malformed names, ownership mismatch, missing tool, stale metadata, missing `inputSchema`, unnamed singleton metadata, and malformed schema all fail closed under `auto` and `trust`.
- Composio missing credentials, stale refresh data, and ambiguous tool schemas fail closed.
- Apple Calendar write-only access is not treated as read access.
- Automated tests use mocks/fakes; they must not mutate real Apple Calendar resources, owner files, or real Composio accounts.

## Downstream Tasks

- Task 133: secure Composio credential storage must keep raw credentials out of storage, renderer responses, logs, and artifacts.
- Task 134: Composio MCP tool refresh must route all tools through MCP namespacing and the central permission gate.
- Task 136: Full Disk Access status must guide/detect only; unknown status remains denied for execution.
- Task 137: Apple Calendar adapter must separate write-only and full-access capabilities.
- Task 138: file access scope policy must keep Trusted Mac Access and trusted write mode separate.
- Task 139: confirmation UX must use this contract for prompts, trusted integration affordances, and unknown blocked states.
- Task 145: integration matrix must cover Composio, MCP, Mac access, Full Disk Access, Apple Calendar, file access, permission confirmations, denied states, and unknown states with mocks.
- Task 146: owner GUI smoke stays manual for real Composio, Full Disk Access, and Apple Calendar verification unless the owner explicitly changes that rule.

## Non-Goals

- No implementation in this task.
- No claim that Leena can silently grant macOS privacy permissions.
- No fabricated support for read-only Calendar access where the chosen Apple API does not provide it.
- No automated tests that require real credentials, real Apple Calendar mutation, or broad owner-file mutation.
