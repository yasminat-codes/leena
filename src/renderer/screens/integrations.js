import {
  createOsPermissionSnapshot,
  isOsPermissionActionable,
  normalizeOsPermissionStatus,
  osPermissionDefinitions,
} from "../../os-permissions.js";

const STATUS_META = Object.freeze({
  connected: Object.freeze({ className: "chip chip--green", label: "Connected" }),
  connecting: Object.freeze({
    className: "chip status-badge status-max_steps",
    label: "Connecting",
  }),
  disconnected: Object.freeze({
    className: "chip status-badge status-error",
    label: "Disconnected",
  }),
  error: Object.freeze({ className: "chip status-badge status-error", label: "Error" }),
});

const TRANSPORT_LABELS = Object.freeze({
  http: "Streamable HTTP",
  stdio: "STDIO",
  unknown: "MCP",
});
const STREAMABLE_HTTP_TRANSPORT_ALIASES = new Set([
  "http",
  "streamable-http",
  "streamable_http",
  "streamable",
]);
const MCP_FORM_ERROR_ORDER = Object.freeze(["name", "transport", "url", "command", "headers"]);
const MCP_HTTP_HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const MAC_ACCESS_PERMISSION_IDS = Object.freeze([
  "microphone",
  "screen",
  "accessibility",
  "full-disk-access",
  "apple-calendar",
  "files",
]);
const OS_PERMISSION_DEFINITIONS_BY_ID = new Map(
  osPermissionDefinitions.map((permission) => [permission.id, permission]),
);
const MAC_ACCESS_DETAILS = Object.freeze({
  accessibility: Object.freeze({
    accent: "A",
    description: "Real OS mouse and keyboard control stays explicit and permission-led.",
    eyebrow: "Mac Access",
    rows: Object.freeze([
      Object.freeze(["Control scope", "Mouse, keyboard, windows, and app surfaces"]),
      Object.freeze(["Execution rule", "Only after a current Accessibility grant"]),
      Object.freeze(["Safety", "Unknown or stale status blocks OS control"]),
    ]),
    title: "Accessibility",
  }),
  "apple-calendar": Object.freeze({
    accent: "C",
    description: "Day-one Calendar setup card; adapter execution is not enabled here.",
    eyebrow: "Apple",
    rows: Object.freeze([
      Object.freeze(["Read access", "Requires a read-capable Calendar permission"]),
      Object.freeze(["Write actions", "Separate confirmation path; not implied by read access"]),
      Object.freeze(["Current scope", "Guided permission card only"]),
    ]),
    title: "Apple Calendar",
  }),
  files: Object.freeze({
    accent: "F",
    description: "File access starts with workspace or user-selected scopes, not broad disk trust.",
    eyebrow: "Mac Access",
    rows: Object.freeze([
      Object.freeze(["Workspace files", "Allowed inside explicit workspace scope"]),
      Object.freeze(["Selected folders", "Review Files and Folders access in System Settings"]),
      Object.freeze(["Broad reads", "Use Full Disk Access only when that grant is known-good"]),
    ]),
    title: "Files",
  }),
  "full-disk-access": Object.freeze({
    accent: "D",
    description: "High-power broad read/search capability controlled by macOS System Settings.",
    eyebrow: "High Power",
    rows: Object.freeze([
      Object.freeze(["Capability", "Broad file read/search after a known-good grant"]),
      Object.freeze(["Grant owner", "macOS System Settings; Leena only guides setup"]),
      Object.freeze(["Write/delete", "Still confirmation-gated by default"]),
    ]),
    title: "Full Disk Access",
  }),
  microphone: Object.freeze({
    accent: "M",
    description: "Voice input for realtime sessions and local microphone capture.",
    eyebrow: "Mac Access",
    rows: Object.freeze([
      Object.freeze(["Voice input", "Realtime conversation microphone stream"]),
      Object.freeze(["Prompt", "OS-supported microphone request"]),
      Object.freeze(["Fallback", "Open System Settings if the prompt was denied"]),
    ]),
    title: "Microphone",
  }),
  screen: Object.freeze({
    accent: "S",
    description: "Screenshot and screen-understanding access for visible Mac context.",
    eyebrow: "Mac Access",
    rows: Object.freeze([
      Object.freeze(["Screen reads", "Screenshot source listing and capture"]),
      Object.freeze(["Prompt", "Electron capture request plus System Settings review"]),
      Object.freeze(["Safety", "Unknown status blocks screen tools"]),
    ]),
    title: "Screen Recording",
  }),
});
const DEFAULT_DETAIL_ID = "composio";
const INTEGRATION_DETAILS = Object.freeze({
  composio: Object.freeze({
    accent: "C",
    description: "Protected app-action credentials and account connections for future tools.",
    eyebrow: "Actions Hub",
    status: "First-class",
    title: "Composio",
  }),
  "custom-mcp": Object.freeze({
    accent: "M",
    description: "Advanced Streamable HTTP and stdio setup for local or remote MCP servers.",
    eyebrow: "Advanced",
    status: "Custom MCP",
    title: "Custom MCP",
  }),
  ...MAC_ACCESS_DETAILS,
  "provider-health": Object.freeze({
    accent: "H",
    description: "Connection health, server counts, and tool availability at a glance.",
    eyebrow: "Status",
    status: "Live",
    title: "Provider Health",
  }),
});
const INTEGRATION_DETAIL_ORDER = Object.freeze([
  "composio",
  "custom-mcp",
  "microphone",
  "screen",
  "accessibility",
  "full-disk-access",
  "apple-calendar",
  "files",
  "provider-health",
]);
const MAC_ACCESS_PERMISSION_ID_SET = new Set(MAC_ACCESS_PERMISSION_IDS);

let activeBinding = null;

function getDocument() {
  return typeof document === "undefined" ? null : document;
}

function getDefaultMCPBridge() {
  return typeof window === "undefined" ? null : window.leena?.mcp;
}

function getDefaultPermissionBridge() {
  return typeof window === "undefined" ? null : window.leena;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return "";
}

function normalizeTransport(value) {
  const transport = firstString(value).toLowerCase();
  if (STREAMABLE_HTTP_TRANSPORT_ALIASES.has(transport)) {
    return "http";
  }
  return transport === "http" || transport === "stdio" ? transport : "unknown";
}

function normalizeToolCount(...values) {
  for (const value of values) {
    if (Number.isInteger(value) && value >= 0) {
      return value;
    }
    if (Array.isArray(value)) {
      return value.length;
    }
  }
  return 0;
}

function normalizeStatus(server, status) {
  if (status?.connected === true || server.connected === true) {
    return "connected";
  }
  if (status?.connecting === true || server.connecting === true) {
    return "connecting";
  }
  if (status?.error || server.error) {
    return "error";
  }
  return "disconnected";
}

function normalizeDetailId(detailId) {
  const id = firstString(detailId);
  return Object.hasOwn(INTEGRATION_DETAILS, id) ? id : DEFAULT_DETAIL_ID;
}

function normalizeStatuses(statuses) {
  if (statuses instanceof Map) {
    return Object.fromEntries(statuses);
  }
  return typeof statuses === "object" && statuses !== null && !Array.isArray(statuses)
    ? statuses
    : {};
}

function normalizePermissionStatuses(permissions) {
  if (permissions instanceof Map) {
    return Object.fromEntries(permissions);
  }
  if (Array.isArray(permissions)) {
    return Object.fromEntries(
      permissions
        .filter((permission) => typeof permission?.id === "string")
        .map((permission) => [permission.id, permission.status]),
    );
  }
  return typeof permissions === "object" && permissions !== null ? permissions : {};
}

function normalizePermissions(permissions) {
  const statuses = normalizePermissionStatuses(permissions);
  const detailsById = new Map(
    (Array.isArray(permissions) ? permissions : [])
      .filter((permission) => typeof permission?.id === "string")
      .map((permission) => [permission.id, permission]),
  );

  return createOsPermissionSnapshot(statuses).map((permission) => {
    const detail = detailsById.get(permission.id) ?? {};
    return {
      ...permission,
      ...detail,
      status: normalizeOsPermissionStatus(detail.status ?? permission.status),
    };
  });
}

function normalizeServer(server, statuses = {}) {
  const statusMap = normalizeStatuses(statuses);
  const id = firstString(server?.id, server?.serverId, server?.name);
  const status = statusMap[id] ?? {};
  const transport = normalizeTransport(server?.transport ?? status.transport);
  const connectionStatus = normalizeStatus(server ?? {}, status);

  return {
    id,
    name: firstString(server?.name, status.name, id, "Unnamed MCP server"),
    transport,
    status: connectionStatus,
    connected: connectionStatus === "connected",
    enabled: server?.enabled !== false && status.enabled !== false,
    toolCount: normalizeToolCount(status.toolCount, server?.toolCount, status.tools, server?.tools),
    url: firstString(server?.url, status.url),
    command: firstString(server?.command, status.command),
  };
}

export function normalizeIntegrationsData(data = {}) {
  const servers = Array.isArray(data.servers) ? data.servers : [];
  const statuses = normalizeStatuses(data.statuses);
  return {
    permissions: normalizePermissions(data.permissions ?? data.osPermissions),
    servers: servers
      .map((server) => normalizeServer(server, statuses))
      .filter((server) => server.id),
  };
}

function assertMCPBridge(bridge) {
  if (!bridge || typeof bridge.listServers !== "function") {
    throw new Error("Integrations screen requires window.leena.mcp.listServers().");
  }
}

async function loadPermissionSnapshot(permissionBridge = getDefaultPermissionBridge()) {
  if (typeof permissionBridge?.getOsPermissions !== "function") {
    return createOsPermissionSnapshot();
  }
  try {
    return await permissionBridge.getOsPermissions();
  } catch {
    return createOsPermissionSnapshot();
  }
}

export async function loadIntegrations(
  bridge = getDefaultMCPBridge(),
  permissionBridge = getDefaultPermissionBridge(),
) {
  assertMCPBridge(bridge);

  const [servers, statuses, permissions] = await Promise.all([
    bridge.listServers(),
    typeof bridge.getStatus === "function" ? bridge.getStatus() : {},
    loadPermissionSnapshot(permissionBridge),
  ]);

  return normalizeIntegrationsData({ permissions, servers, statuses });
}

function renderStatusChip(server) {
  const meta = STATUS_META[server.status] ?? STATUS_META.disconnected;
  return `<span class="${meta.className}" data-integrations-status="${escapeHtml(server.status)}">${escapeHtml(meta.label)}</span>`;
}

function renderToolCount(server) {
  const label = server.toolCount === 1 ? "1 tool" : `${server.toolCount} tools`;
  return `<span class="chip" data-integrations-tool-count="${escapeHtml(server.id)}">${escapeHtml(label)}</span>`;
}

function renderServerEndpoint(server) {
  if (server.transport === "http" && server.url) {
    return server.url;
  }
  if (server.transport === "stdio" && server.command) {
    return server.command;
  }
  return "Configured MCP server";
}

function renderServerTile(server) {
  const action = server.connected ? "disconnect" : "connect";
  const actionLabel = server.connected ? "Disconnect" : "Connect";

  return `
    <article class="card integrations-tile" data-integration-id="${escapeHtml(server.id)}" data-integrations-server-id="${escapeHtml(server.id)}">
      <header class="integrations-tile__head">
        <span class="tooldot integrations-tile__icon" data-icon-gradient="mcp" aria-hidden="true">${escapeHtml(server.name.at(0).toUpperCase())}</span>
        ${renderStatusChip(server)}
      </header>
      <div class="integrations-tile__body">
        <h2 class="lx-h3">${escapeHtml(server.name)}</h2>
        <p class="lx-sm text-dim">${escapeHtml(renderServerEndpoint(server))}</p>
        <div class="row">
          <span class="chip chip--mcp" data-integrations-transport="${escapeHtml(server.transport)}">${escapeHtml(TRANSPORT_LABELS[server.transport])}</span>
          ${renderToolCount(server)}
        </div>
      </div>
      <footer class="integrations-tile__head">
        <button class="btn btn--ghost" type="button" data-integrations-action="${escapeHtml(action)}" data-server-id="${escapeHtml(server.id)}">${escapeHtml(actionLabel)}</button>
        <button class="btn btn--ghost" type="button" data-integrations-action="remove" data-server-id="${escapeHtml(server.id)}">Remove</button>
      </footer>
    </article>
  `;
}

function renderEmptyState() {
  return `
    <article class="card integrations-tile integrations-state-card" data-integrations-empty="true">
      <header class="integrations-tile__head">
        <span class="tooldot integrations-tile__icon" data-icon-gradient="mcp" aria-hidden="true">M</span>
        <span class="chip status-badge status-error">Disconnected</span>
      </header>
      <div class="integrations-tile__body">
        <h2 class="lx-h3">No MCP servers</h2>
        <p class="lx-sm text-dim">Add a server to make its tools available to Leena.</p>
      </div>
    </article>
  `;
}

function renderLoadingState() {
  return `
    <article class="card integrations-tile integrations-state-card" data-integrations-loading="true" aria-busy="true">
      <header class="integrations-tile__head">
        <span class="tooldot integrations-tile__icon" data-icon-gradient="mcp" aria-hidden="true">M</span>
        <span class="chip status-badge status-max_steps">Loading</span>
      </header>
      <div class="integrations-tile__body">
        <h2 class="lx-h3">Loading MCP servers</h2>
        <p class="lx-sm text-dim">Reading configured servers and live connection state.</p>
      </div>
    </article>
  `;
}

function renderServerList(servers) {
  return servers.length > 0 ? servers.map(renderServerTile).join("") : renderEmptyState();
}

function renderErrorState(error) {
  return `
    <article class="card integrations-tile integrations-state-card" data-integrations-error="true">
      <header class="integrations-tile__head">
        <span class="tooldot integrations-tile__icon" data-icon-gradient="mcp" aria-hidden="true">!</span>
        <span class="chip status-badge status-error">Error</span>
      </header>
      <div class="integrations-tile__body">
        <h2 class="lx-h3">Unable to load MCP servers</h2>
        <p class="lx-sm text-dim">${escapeHtml(error instanceof Error ? error.message : String(error))}</p>
      </div>
    </article>
  `;
}

function formatSummary(servers) {
  const serverLabel = servers.length === 1 ? "server" : "servers";
  return `${servers.length} configured MCP ${serverLabel} for Leena's realtime workspace.`;
}

function getServerMetrics(servers) {
  const connected = servers.filter((server) => server.connected).length;
  const connecting = servers.filter((server) => server.status === "connecting").length;
  const errors = servers.filter((server) => server.status === "error").length;
  const tools = servers.reduce((total, server) => total + server.toolCount, 0);

  return {
    connected,
    connecting,
    errors,
    total: servers.length,
    tools,
  };
}

function getPermissionDefinition(permissionId) {
  return (
    OS_PERMISSION_DEFINITIONS_BY_ID.get(permissionId) ?? {
      id: permissionId,
      label: permissionId,
      requestMode: "guided",
    }
  );
}

function getPermissionState(normalized, permissionId) {
  const permission = normalized.permissions.find((item) => item.id === permissionId);
  const definition = getPermissionDefinition(permissionId);
  return {
    ...definition,
    ...(permission ?? {}),
    status: normalizeOsPermissionStatus(permission?.status),
  };
}

function formatPermissionStatus(status) {
  switch (normalizeOsPermissionStatus(status)) {
    case "granted":
      return "Allowed";
    case "not-determined":
      return "Needs setup";
    case "denied":
      return "Needs settings";
    case "restricted":
      return "Restricted";
    case "stale":
      return "Refresh";
    case "unsupported":
      return "Unsupported";
    default:
      return "Check status";
  }
}

function getPermissionStatusClass(status) {
  switch (normalizeOsPermissionStatus(status)) {
    case "granted":
      return "chip chip--green";
    case "denied":
    case "restricted":
      return "chip status-badge status-error";
    default:
      return "chip settings-chip--warning";
  }
}

function getPermissionRequestLabel(permission) {
  if (permission.requestMode === "settings") {
    return "Open Settings";
  }
  return permission.id === "computer" ? "Install" : "Request";
}

function isMacAccessDetail(detailId) {
  return MAC_ACCESS_PERMISSION_ID_SET.has(detailId);
}

function formatCardStatus(detailId, normalized, { isLoading = false } = {}) {
  if (isLoading && (detailId === "custom-mcp" || detailId === "provider-health")) {
    return "Loading";
  }

  if (isMacAccessDetail(detailId)) {
    return formatPermissionStatus(getPermissionState(normalized, detailId).status);
  }

  const metrics = getServerMetrics(normalized.servers);
  if (detailId === "custom-mcp") {
    const serverLabel = metrics.total === 1 ? "server" : "servers";
    return `${metrics.total} ${serverLabel}`;
  }
  if (detailId === "provider-health") {
    if (metrics.total === 0) {
      return "No servers";
    }
    if (metrics.errors > 0) {
      const errorLabel = metrics.errors === 1 ? "error" : "errors";
      return `${metrics.errors} ${errorLabel}`;
    }
    if (metrics.connecting > 0) {
      return "Connecting";
    }
    return `${metrics.connected}/${metrics.total} online`;
  }
  return INTEGRATION_DETAILS[detailId].status;
}

function getCardStatusClass(detailId, normalized, { isLoading = false } = {}) {
  if (isLoading) {
    return "chip status-badge status-max_steps";
  }
  if (isMacAccessDetail(detailId)) {
    return getPermissionStatusClass(getPermissionState(normalized, detailId).status);
  }
  if (detailId === "provider-health") {
    const metrics = getServerMetrics(normalized.servers);
    if (metrics.errors > 0 || metrics.total === 0) {
      return "chip status-badge status-error";
    }
    return "chip chip--green";
  }
  if (detailId === "custom-mcp") {
    return "chip chip--mcp";
  }
  return "chip chip--accent";
}

function renderIntegrationCards(normalized, selectedDetail, state = {}) {
  return INTEGRATION_DETAIL_ORDER.map((id) => {
    const detail = INTEGRATION_DETAILS[id];
    const isSelected = id === selectedDetail;
    const isPermission = isMacAccessDetail(id);
    const permission = isPermission ? getPermissionState(normalized, id) : null;
    const permissionAttrs = isPermission
      ? ` data-integrations-permission-card data-permission-id="${escapeHtml(id)}" data-permission-status="${escapeHtml(permission.status)}"`
      : "";
    return `
        <button class="card integrations-card" type="button" data-integrations-action="select-detail" data-integrations-detail-card data-integrations-detail="${escapeHtml(id)}"${permissionAttrs} aria-pressed="${String(isSelected)}">
          <span class="tooldot integrations-card__icon" data-icon-gradient="${escapeHtml(id)}" aria-hidden="true">${escapeHtml(detail.accent)}</span>
          <span class="integrations-card__copy">
            <span class="lx-mono text-faint">${escapeHtml(detail.eyebrow)}</span>
            <strong class="lx-h3">${escapeHtml(detail.title)}</strong>
            <span class="lx-sm text-dim">${escapeHtml(detail.description)}</span>
          </span>
          <span class="${getCardStatusClass(id, normalized, state)}" data-integrations-card-status="${escapeHtml(id)}">${escapeHtml(formatCardStatus(id, normalized, state))}</span>
          <span class="integrations-card__learn">Learn more</span>
        </button>
      `;
  }).join("");
}

function renderDetailRow(label, value) {
  return `
    <div class="integrations-detail-row">
      <span class="lx-mono text-faint">${escapeHtml(label)}</span>
      <strong class="lx-body">${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderDetailHeader(detailId, statusClass, statusLabel) {
  const detail = INTEGRATION_DETAILS[detailId];
  return `
    <header class="integrations-detail__head">
      <div class="integrations-detail__title">
        <span class="tooldot integrations-card__icon" data-icon-gradient="${escapeHtml(detailId)}" aria-hidden="true">${escapeHtml(detail.accent)}</span>
        <div>
          <p class="lx-mono text-faint">${escapeHtml(detail.eyebrow)}</p>
          <h2 class="lx-h2">${escapeHtml(detail.title)}</h2>
        </div>
      </div>
      <span class="${statusClass}">${escapeHtml(statusLabel)}</span>
    </header>
  `;
}

function renderFieldError(fieldName) {
  return `<p class="lx-sm text-dim" id="integrations-mcp-${escapeHtml(fieldName)}-error" data-integrations-error-for="${escapeHtml(fieldName)}" role="alert" hidden></p>`;
}

function renderAddServerDialog() {
  return `
    <section class="integrations-dialog" data-integrations-dialog aria-label="Add custom MCP server">
      <form data-integrations-add-form>
        <div class="integrations-form-grid">
          <label class="settings-field integrations-detail-row" data-integrations-field="name">
            <span class="lx-mono text-faint">Name</span>
            <input class="settings-input" name="name" autocomplete="off" placeholder="Project tools" aria-describedby="integrations-mcp-name-error" />
            ${renderFieldError("name")}
          </label>
          <label class="settings-field integrations-detail-row" data-integrations-field="transport">
            <span class="lx-mono text-faint">Transport</span>
            <select class="settings-select" name="transport" data-integrations-transport-select aria-describedby="integrations-mcp-transport-error">
              <option value="http">Streamable HTTP URL</option>
              <option value="stdio">Stdio command</option>
            </select>
            ${renderFieldError("transport")}
          </label>
          <label class="settings-field integrations-detail-row" data-integrations-field="url">
            <span class="lx-mono text-faint">MCP endpoint URL</span>
            <input class="settings-input" name="url" autocomplete="off" placeholder="https://example.com/mcp" aria-describedby="integrations-mcp-url-error" />
            ${renderFieldError("url")}
          </label>
          <label class="settings-field integrations-detail-row" data-integrations-field="headers">
            <span class="lx-mono text-faint">HTTP headers (optional)</span>
            <input class="settings-input" name="headers" autocomplete="off" placeholder="Authorization: Bearer token; X-Team: ops" aria-describedby="integrations-mcp-headers-error" />
            ${renderFieldError("headers")}
          </label>
          <label class="settings-field integrations-detail-row" data-integrations-field="command" hidden>
            <span class="lx-mono text-faint">Command</span>
            <input class="settings-input" name="command" autocomplete="off" placeholder="npx @modelcontextprotocol/server-filesystem" aria-describedby="integrations-mcp-command-error" />
            ${renderFieldError("command")}
          </label>
          <label class="settings-field integrations-detail-row" data-integrations-field="args" hidden>
            <span class="lx-mono text-faint">Args</span>
            <input class="settings-input" name="args" autocomplete="off" placeholder="workspace-root" />
          </label>
        </div>
        <p class="lx-sm text-dim" data-integrations-test-status role="status" hidden></p>
        <p class="lx-sm text-dim" data-integrations-form-error role="alert" hidden></p>
        <div class="integrations-dialog__actions">
          <button class="btn btn--ghost" type="button" data-integrations-action="test-connection">Test connection</button>
          <button class="btn btn--primary" type="submit">Add MCP Server</button>
          <button class="btn btn--ghost" type="button" data-integrations-action="cancel-add">Cancel</button>
        </div>
      </form>
    </section>
  `;
}

function renderComposioDetail() {
  return `
    ${renderDetailHeader("composio", "chip chip--accent", "Actions Hub")}
    <p class="lx-sm text-dim">Composio stays visible as the primary app-actions path while credentials remain protected, redacted, and fail-closed until runtime connection work is ready.</p>
    <div class="integrations-detail__rows">
      ${renderDetailRow("Credentials", "Stored through the protected Composio bridge")}
      ${renderDetailRow("Renderer state", "Configured status only; secrets are never returned")}
      ${renderDetailRow("Tool exposure", "Hidden until account/tool metadata is trusted")}
    </div>
  `;
}

function renderCustomMCPDetail(normalized) {
  const metrics = getServerMetrics(normalized.servers);
  return `
    ${renderDetailHeader("custom-mcp", "chip chip--mcp", `${metrics.total} configured`)}
    <p class="lx-sm text-dim">Use Custom MCP for advanced local or remote servers. Existing servers stay listed below and continue using the current live bridge.</p>
    ${renderAddServerDialog()}
  `;
}

function renderPermissionActions(permission) {
  const status = normalizeOsPermissionStatus(permission.status);
  const requestLabel = getPermissionRequestLabel(permission);
  const requestDisabled = !isOsPermissionActionable(status) ? "disabled" : "";

  if (permission.requestMode === "settings") {
    return `
      <div class="integrations-permission-actions" data-integrations-permission-actions="${escapeHtml(permission.id)}">
        <button class="btn btn--primary" type="button" data-integrations-action="open-permission-settings" data-permission-id="${escapeHtml(permission.id)}">${escapeHtml(requestLabel)}</button>
        <span class="integrations-permission-note lx-sm text-dim">macOS owns this grant; refresh status after changing System Settings.</span>
      </div>
    `;
  }

  return `
    <div class="integrations-permission-actions" data-integrations-permission-actions="${escapeHtml(permission.id)}">
      <button class="btn btn--primary" type="button" data-integrations-action="request-permission" data-permission-id="${escapeHtml(permission.id)}" ${requestDisabled}>${escapeHtml(requestLabel)}</button>
      <button class="btn btn--ghost" type="button" data-integrations-action="open-permission-settings" data-permission-id="${escapeHtml(permission.id)}">Open Settings</button>
      <span class="integrations-permission-note lx-sm text-dim">Request only uses approved OS prompts or opens guided settings.</span>
    </div>
  `;
}

function renderPermissionDetail(detailId, normalized) {
  const permission = getPermissionState(normalized, detailId);
  const detail = MAC_ACCESS_DETAILS[detailId];
  const statusClass = getPermissionStatusClass(permission.status);
  const statusLabel = formatPermissionStatus(permission.status);

  return `
    ${renderDetailHeader(detailId, statusClass, statusLabel)}
    <p class="lx-sm text-dim">${escapeHtml(detail.description)}</p>
    <div class="integrations-detail__rows">
      ${detail.rows.map(([label, value]) => renderDetailRow(label, value)).join("")}
      ${renderDetailRow("Current status", statusLabel)}
    </div>
    ${renderPermissionActions(permission)}
  `;
}

function renderProviderHealthDetail(normalized) {
  const metrics = getServerMetrics(normalized.servers);
  return `
    ${renderDetailHeader("provider-health", getCardStatusClass("provider-health", normalized), formatCardStatus("provider-health", normalized))}
    <p class="lx-sm text-dim">Provider health summarizes the live MCP bridge without replacing the server list or connection controls.</p>
    <div class="integrations-detail__rows integrations-detail__rows--metrics">
      ${renderDetailRow("Configured", `${metrics.total}`)}
      ${renderDetailRow("Connected", `${metrics.connected}`)}
      ${renderDetailRow("Errors", `${metrics.errors}`)}
      ${renderDetailRow("Tools", `${metrics.tools}`)}
    </div>
  `;
}

function renderIntegrationDetailContent(detailId, normalized) {
  switch (normalizeDetailId(detailId)) {
    case "custom-mcp":
      return renderCustomMCPDetail(normalized);
    case "provider-health":
      return renderProviderHealthDetail(normalized);
    default:
      if (isMacAccessDetail(detailId)) {
        return renderPermissionDetail(detailId, normalized);
      }
      return renderComposioDetail();
  }
}

function renderIntegrationsShell(data = {}) {
  const normalized = normalizeIntegrationsData(data);
  const connectedCount = normalized.servers.filter((server) => server.connected).length;
  const isLoading = data.loading === true;
  const selectedDetail = normalizeDetailId(data.selectedDetail);

  return `
    <section class="integrations-screen" aria-label="Integrations" data-integrations-state="${isLoading ? "loading" : "ready"}" data-integrations-detail="${escapeHtml(selectedDetail)}">
      <header class="panel-glass integrations-header">
        <div class="integrations-header__copy">
          <p class="lx-mono">Connections</p>
          <p class="lx-h1" data-integrations-connected-count>${connectedCount} connected</p>
          <p class="lx-sm text-dim" data-integrations-summary>${escapeHtml(formatSummary(normalized.servers))}</p>
        </div>
        <button class="btn btn--ghost" type="button" data-integrations-action="open-add" aria-expanded="${String(selectedDetail === "custom-mcp")}">Add MCP Server</button>
      </header>

      <section class="integrations-marketplace" aria-label="Integration options" data-integrations-card-grid>
        ${renderIntegrationCards(normalized, selectedDetail, { isLoading })}
      </section>

      <section class="integrations-detail-layout">
        <section class="card integrations-detail" aria-live="polite" data-integrations-detail-panel data-integrations-detail-active="${escapeHtml(selectedDetail)}">
          ${renderIntegrationDetailContent(selectedDetail, normalized)}
        </section>

        <section class="integrations-server-shell" aria-label="Configured MCP servers">
          <header class="integrations-section-head">
            <div>
              <p class="lx-mono text-faint">Live MCP</p>
              <h2 class="lx-h2">Configured servers</h2>
            </div>
            <button class="btn btn--ghost" type="button" data-integrations-action="refresh">Refresh</button>
          </header>
          <section class="integrations-grid" aria-label="Configured MCP servers" data-integrations-list>
            ${isLoading ? renderLoadingState() : renderServerList(normalized.servers)}
          </section>
        </section>
      </section>
    </section>
  `;
}

export function renderIntegrationsData(data = {}) {
  return renderIntegrationsShell(data);
}

export function renderIntegrations() {
  scheduleIntegrationsHydration();
  return renderIntegrationsShell({ loading: true });
}

function scheduleIntegrationsHydration(
  root = getDocument(),
  bridge = getDefaultMCPBridge(),
  permissionBridge = getDefaultPermissionBridge(),
) {
  if (!root || !bridge) {
    return;
  }

  const hydrate = () => {
    const screen = root.querySelector?.(".integrations-screen");
    if (!screen) {
      return;
    }
    bindIntegrationsControls(root, bridge, permissionBridge);
    void refreshIntegrationsScreen(root, bridge, permissionBridge).catch((error) =>
      renderIntegrationsError(root, error),
    );
  };

  if (typeof queueMicrotask === "function") {
    queueMicrotask(hydrate);
  } else {
    setTimeout(hydrate, 0);
  }
}

function findScreen(root) {
  return root?.querySelector?.(".integrations-screen") ?? null;
}

function setScreenState(screen, state) {
  if (screen?.dataset) {
    screen.dataset.integrationsState = state;
  }
}

function renderIntegrationsError(root, error) {
  const screen = findScreen(root);
  const list = screen?.querySelector?.("[data-integrations-list]");
  if (!screen || !list) {
    return;
  }
  setScreenState(screen, "error");
  list.innerHTML = renderErrorState(error);
}

function updateIntegrationsScreen(root, data) {
  const screen = findScreen(root);
  if (!screen) {
    return null;
  }

  const normalized = normalizeIntegrationsData(data);
  const connectedCount = normalized.servers.filter((server) => server.connected).length;
  const count = screen.querySelector?.("[data-integrations-connected-count]");
  const summary = screen.querySelector?.("[data-integrations-summary]");
  const cardGrid = screen.querySelector?.("[data-integrations-card-grid]");
  const detailPanel = screen.querySelector?.("[data-integrations-detail-panel]");
  const list = screen.querySelector?.("[data-integrations-list]");
  const selectedDetail = getSelectedDetail(screen);

  if (count) {
    count.textContent = `${connectedCount} connected`;
  }
  if (summary) {
    summary.textContent = formatSummary(normalized.servers);
  }
  if (cardGrid) {
    cardGrid.innerHTML = renderIntegrationCards(normalized, selectedDetail);
  }
  if (detailPanel) {
    detailPanel.dataset.integrationsDetailActive = selectedDetail;
    detailPanel.innerHTML = renderIntegrationDetailContent(selectedDetail, normalized);
    syncAddServerFields(detailPanel.querySelector?.("[data-integrations-add-form]"));
  }
  if (list) {
    list.innerHTML = renderServerList(normalized.servers);
  }
  if (activeBinding?.screen === screen) {
    activeBinding.data = normalized;
  }
  syncDetailButtons(screen, selectedDetail);
  setScreenState(screen, "ready");
  return normalized;
}

export async function refreshIntegrationsScreen(
  root = getDocument(),
  bridge = getDefaultMCPBridge(),
  permissionBridge = getDefaultPermissionBridge(),
) {
  if (!root) {
    return null;
  }
  const data = await loadIntegrations(bridge, permissionBridge);
  return updateIntegrationsScreen(root, data);
}

function getNormalizedSetupTransport(value) {
  return normalizeTransport(value) === "stdio" ? "stdio" : "http";
}

export function getMCPSetupFieldVisibility(transportValue) {
  const transport = getNormalizedSetupTransport(transportValue);
  const isStdio = transport === "stdio";
  return {
    args: isStdio,
    command: isStdio,
    headers: !isStdio,
    name: true,
    transport: true,
    url: !isStdio,
  };
}

function parseMCPHeaderDraft(value) {
  const raw = firstString(value);
  if (!raw) {
    return { headers: null };
  }

  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return { error: "HTTP headers must be a JSON object or Name: value pairs." };
      }
      return normalizeHeaderEntries(Object.entries(parsed));
    } catch {
      return { error: "HTTP headers must be valid JSON or Name: value pairs." };
    }
  }

  return normalizeHeaderEntries(
    raw
      .split(/\r?\n|;/)
      .map((entry) => {
        const separator = entry.indexOf(":");
        return separator < 0
          ? [entry, ""]
          : [entry.slice(0, separator), entry.slice(separator + 1)];
      })
      .filter(([name, value]) => firstString(name, value)),
  );
}

function normalizeHeaderEntries(entries) {
  const headers = {};
  for (const [rawName, rawValue] of entries) {
    const name = firstString(rawName);
    const value = firstString(rawValue);
    if (!name || !MCP_HTTP_HEADER_NAME_PATTERN.test(name) || !value) {
      return { error: "HTTP headers must use Name: value pairs with non-empty values." };
    }
    headers[name] = value;
  }
  return Object.keys(headers).length > 0 ? { headers } : { headers: null };
}

function getFirstValidationError(errors) {
  for (const field of MCP_FORM_ERROR_ORDER) {
    if (errors[field]) {
      return errors[field];
    }
  }
  return Object.values(errors).find(Boolean) ?? "";
}

export function validateMCPServerDraftFields(draft = {}) {
  const name = firstString(draft.name);
  const transport = normalizeTransport(draft.transport);
  const args = firstString(draft.args)
    .split(/\s+/)
    .map((arg) => arg.trim())
    .filter(Boolean);
  const errors = {};

  if (!name) {
    errors.name = "MCP server name is required.";
  }
  if (transport !== "http" && transport !== "stdio") {
    errors.transport = "Choose Streamable HTTP URL or stdio command.";
  }

  if (transport === "http") {
    const url = firstString(draft.url);
    if (!url) {
      errors.url = "Streamable HTTP MCP servers require a URL.";
    }

    let parsedUrl = null;
    if (url) {
      try {
        parsedUrl = new URL(url);
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
          errors.url = "Streamable HTTP MCP server URL must use http or https.";
        }
      } catch {
        errors.url = "Streamable HTTP MCP server URL must be valid.";
      }
    }

    const headerResult = parseMCPHeaderDraft(draft.headers);
    if (headerResult.error) {
      errors.headers = headerResult.error;
    }

    if (Object.keys(errors).length > 0) {
      return { errors };
    }

    return {
      config: {
        ...(headerResult.headers ? { headers: headerResult.headers } : {}),
        name,
        transport,
        url: parsedUrl.href,
      },
      errors,
    };
  }

  const command = firstString(draft.command);
  if (!command) {
    errors.command = "Stdio MCP servers require a command.";
  }
  if (Object.keys(errors).length > 0) {
    return { errors };
  }
  return {
    config: {
      args,
      command,
      name,
      transport,
    },
    errors,
  };
}

export function validateMCPServerDraft(draft = {}) {
  const validation = validateMCPServerDraftFields(draft);
  if (validation.config) {
    return { config: validation.config };
  }
  return { error: getFirstValidationError(validation.errors ?? {}) };
}

export async function addIntegrationServer(draft, bridge = getDefaultMCPBridge()) {
  const validation = validateMCPServerDraft(draft);
  if (!validation.config) {
    throw new Error(validation.error);
  }
  if (!bridge || typeof bridge.addServer !== "function") {
    throw new Error("Integrations screen requires window.leena.mcp.addServer().");
  }
  return bridge.addServer(validation.config);
}

export async function testMCPServerConnection(draft, bridge = getDefaultMCPBridge()) {
  const validation = validateMCPServerDraft(draft);
  if (!validation.config) {
    throw new Error(validation.error);
  }
  if (!bridge || typeof bridge.testConnection !== "function") {
    throw new Error("Integrations screen requires window.leena.mcp.testConnection().");
  }
  return bridge.testConnection(validation.config);
}

export async function toggleIntegrationConnection(server, bridge = getDefaultMCPBridge()) {
  const serverId = firstString(server?.id, server?.serverId);
  if (!serverId) {
    throw new Error("MCP server id is required.");
  }
  if (server?.connected === true) {
    if (!bridge || typeof bridge.disconnect !== "function") {
      throw new Error("Integrations screen requires window.leena.mcp.disconnect().");
    }
    return bridge.disconnect(serverId);
  }
  if (!bridge || typeof bridge.connect !== "function") {
    throw new Error("Integrations screen requires window.leena.mcp.connect().");
  }
  return bridge.connect(serverId);
}

export async function removeIntegrationServer(
  serverId,
  bridge = getDefaultMCPBridge(),
  confirmRemove = globalThis.confirm,
) {
  const id = firstString(serverId);
  if (!id) {
    throw new Error("MCP server id is required.");
  }
  if (typeof confirmRemove === "function" && !confirmRemove("Remove this MCP server?")) {
    return { cancelled: true, removed: false, serverId: id };
  }
  if (!bridge || typeof bridge.removeServer !== "function") {
    throw new Error("Integrations screen requires window.leena.mcp.removeServer().");
  }
  return bridge.removeServer(id);
}

export function subscribeToMCPStatusChanges(bridge = getDefaultMCPBridge(), callback = () => {}) {
  if (!bridge) {
    return () => {};
  }

  const cleanups = [];
  if (typeof bridge.onStatusChanged === "function") {
    const listener = bridge.onStatusChanged(callback);
    if (typeof bridge.offStatusChanged === "function") {
      cleanups.push(() => bridge.offStatusChanged(listener));
    }
  }
  if (typeof bridge.onChanged === "function") {
    const listener = bridge.onChanged(callback);
    if (typeof bridge.offChanged === "function") {
      cleanups.push(() => bridge.offChanged(listener));
    }
  }
  if (typeof bridge.on === "function") {
    const listener = bridge.on("mcp:changed", callback) ?? callback;
    if (typeof bridge.off === "function") {
      cleanups.push(() => bridge.off("mcp:changed", listener));
    }
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

function closestAction(target, boundary) {
  let node = target;
  while (node) {
    if (node.dataset?.integrationsAction) {
      return node;
    }
    if (node === boundary) {
      return null;
    }
    node = node.parentElement;
  }
  return null;
}

function getServerFromAction(action) {
  return {
    id: firstString(action?.dataset?.serverId),
    connected: action?.dataset?.integrationsAction === "disconnect",
  };
}

function getSelectedDetail(screen) {
  return normalizeDetailId(screen?.dataset?.integrationsDetail);
}

function syncDetailButtons(screen, selectedDetail = getSelectedDetail(screen)) {
  for (const card of screen?.querySelectorAll?.("[data-integrations-detail-card]") ?? []) {
    card.setAttribute(
      "aria-pressed",
      String(normalizeDetailId(card.dataset?.integrationsDetail) === selectedDetail),
    );
  }

  const addButton = screen?.querySelector?.('[data-integrations-action="open-add"]');
  addButton?.setAttribute?.("aria-expanded", String(selectedDetail === "custom-mcp"));
}

function setActiveIntegrationDetail(screen, detailId, data = activeBinding?.data) {
  if (!screen) {
    return;
  }
  const selectedDetail = normalizeDetailId(detailId);
  const normalized = data ?? normalizeIntegrationsData({});
  const cardGrid = screen.querySelector?.("[data-integrations-card-grid]");
  const detailPanel = screen.querySelector?.("[data-integrations-detail-panel]");

  if (screen.dataset) {
    screen.dataset.integrationsDetail = selectedDetail;
  }
  if (cardGrid) {
    cardGrid.innerHTML = renderIntegrationCards(normalized, selectedDetail);
  }
  if (detailPanel) {
    detailPanel.dataset.integrationsDetailActive = selectedDetail;
    detailPanel.innerHTML = renderIntegrationDetailContent(selectedDetail, normalized);
    syncAddServerFields(detailPanel.querySelector?.("[data-integrations-add-form]"));
  }
  syncDetailButtons(screen, selectedDetail);
}

function setFormError(form, message = "") {
  const error = form?.querySelector?.("[data-integrations-form-error]");
  if (!error) {
    return;
  }
  error.textContent = message;
  error.hidden = !message;
}

function setTestConnectionStatus(form, message = "", status = "") {
  const node = form?.querySelector?.("[data-integrations-test-status]");
  if (!node) {
    return;
  }
  node.textContent = message;
  node.hidden = !message;
  if (node.dataset) {
    node.dataset.integrationsTestStatus = message ? status : "";
  }
}

function setFieldError(form, fieldName, message = "") {
  const error = form?.querySelector?.(`[data-integrations-error-for="${fieldName}"]`);
  const control =
    form?.elements?.namedItem?.(fieldName) ?? form?.querySelector?.(`[name="${fieldName}"]`);

  if (error) {
    error.textContent = message;
    error.hidden = !message;
  }
  if (control?.setAttribute) {
    control.setAttribute("aria-invalid", message ? "true" : "false");
  }
}

function setValidationErrors(form, errors = {}) {
  for (const field of MCP_FORM_ERROR_ORDER) {
    setFieldError(form, field, errors[field] ?? "");
  }
}

function applyValidationFeedback(form, validation) {
  const errors = validation.errors ?? {};
  setValidationErrors(form, errors);
  if (!validation.config) {
    setFormError(form, getFirstValidationError(errors));
    setTestConnectionStatus(form);
    return false;
  }

  setFormError(form);
  return true;
}

function readFormValue(form, name) {
  const field = form?.elements?.namedItem?.(name) ?? form?.querySelector?.(`[name="${name}"]`);
  return firstString(field?.value);
}

function getAddServerDraft(form) {
  return {
    args: readFormValue(form, "args"),
    command: readFormValue(form, "command"),
    headers: readFormValue(form, "headers"),
    name: readFormValue(form, "name"),
    transport: readFormValue(form, "transport"),
    url: readFormValue(form, "url"),
  };
}

function syncAddServerFields(form) {
  const visibility = getMCPSetupFieldVisibility(readFormValue(form, "transport"));

  for (const fieldName of ["url", "headers", "command", "args"]) {
    const field = form?.querySelector?.(`[data-integrations-field="${fieldName}"]`);
    if (!field) {
      continue;
    }
    field.hidden = !visibility[fieldName];
    if (!visibility[fieldName]) {
      setFieldError(form, fieldName);
    }
  }
}

function toggleAddServerDialog(screen, isOpen) {
  if (isOpen) {
    setActiveIntegrationDetail(screen, "custom-mcp");
  }
  const dialog = screen?.querySelector?.("[data-integrations-dialog]");
  const form = dialog?.querySelector?.("[data-integrations-add-form]");
  if (form) {
    if (!isOpen) {
      form.reset?.();
    }
    syncAddServerFields(form);
    setFormError(form);
    setTestConnectionStatus(form);
    setValidationErrors(form);
  }
}

function formatTestConnectionSuccess(result = {}) {
  const toolCount = Number.isInteger(result.toolCount) ? result.toolCount : null;
  const tools =
    toolCount === null ? "" : ` with ${toolCount} ${toolCount === 1 ? "tool" : "tools"}`;
  const latency = Number.isInteger(result.latencyMs) ? ` in ${result.latencyMs}ms` : "";
  return `Connection succeeded${tools}${latency}.`;
}

function formatTestConnectionFailure(result = {}) {
  return firstString(result.error)
    ? `Connection failed: ${firstString(result.error)}`
    : "Connection failed.";
}

async function handleTestConnection(action, root, bridge) {
  const form =
    action.closest?.("[data-integrations-add-form]") ??
    findScreen(root)?.querySelector?.("[data-integrations-add-form]");
  const draft = getAddServerDraft(form);
  const validation = validateMCPServerDraftFields(draft);
  if (!applyValidationFeedback(form, validation)) {
    return;
  }
  if (!bridge || typeof bridge.testConnection !== "function") {
    setFormError(form, "Test connection is not available in this build.");
    setTestConnectionStatus(form);
    return;
  }

  action.disabled = true;
  setFormError(form);
  setTestConnectionStatus(form, "Testing MCP connection...", "pending");
  try {
    const result = await bridge.testConnection(validation.config);
    if (result?.reachable === true) {
      setTestConnectionStatus(form, formatTestConnectionSuccess(result), "success");
      setFormError(form);
    } else {
      setTestConnectionStatus(form);
      setFormError(form, formatTestConnectionFailure(result));
    }
  } catch (error) {
    setTestConnectionStatus(form);
    setFormError(form, error instanceof Error ? error.message : String(error));
  } finally {
    action.disabled = false;
  }
}

function assertPermissionBridge(permissionBridge, method) {
  if (!permissionBridge || typeof permissionBridge[method] !== "function") {
    throw new Error(`Integrations screen requires window.leena.${method}().`);
  }
}

async function handleIntegrationAction(action, root, bridge, permissionBridge) {
  const screen = findScreen(root);
  const type = action.dataset.integrationsAction;
  if (type === "open-add") {
    toggleAddServerDialog(screen, true);
    return;
  }
  if (type === "cancel-add") {
    toggleAddServerDialog(screen, false);
    return;
  }
  if (type === "test-connection") {
    await handleTestConnection(action, root, bridge);
    return;
  }
  if (type === "select-detail") {
    setActiveIntegrationDetail(screen, action.dataset.integrationsDetail);
    return;
  }
  if (type === "refresh") {
    action.disabled = true;
    try {
      await refreshIntegrationsScreen(root, bridge, permissionBridge);
    } finally {
      action.disabled = false;
    }
    return;
  }
  if (type === "request-permission" || type === "open-permission-settings") {
    const permissionId = firstString(action.dataset.permissionId);
    action.disabled = true;
    try {
      if (type === "request-permission") {
        assertPermissionBridge(permissionBridge, "requestOsPermission");
        await permissionBridge.requestOsPermission(permissionId);
      } else {
        assertPermissionBridge(permissionBridge, "openOsPermissionSettings");
        await permissionBridge.openOsPermissionSettings(permissionId);
      }
      await refreshIntegrationsScreen(root, bridge, permissionBridge);
    } finally {
      action.disabled = false;
    }
    return;
  }
  if (type === "connect" || type === "disconnect") {
    action.disabled = true;
    try {
      await toggleIntegrationConnection(getServerFromAction(action), bridge);
      await refreshIntegrationsScreen(root, bridge, permissionBridge);
    } finally {
      action.disabled = false;
    }
    return;
  }
  if (type === "remove") {
    action.disabled = true;
    try {
      await removeIntegrationServer(action.dataset.serverId, bridge);
      await refreshIntegrationsScreen(root, bridge, permissionBridge);
    } finally {
      action.disabled = false;
    }
  }
}

async function handleAddServerSubmit(event, root, bridge, permissionBridge) {
  event.preventDefault();
  const form = event.target;
  const draft = getAddServerDraft(form);
  const validation = validateMCPServerDraftFields(draft);
  if (!applyValidationFeedback(form, validation)) {
    return;
  }

  setFormError(form);
  setTestConnectionStatus(form);
  const submit = form.querySelector?.('[type="submit"]');
  if (submit) {
    submit.disabled = true;
  }
  try {
    await addIntegrationServer(draft, bridge);
    form.reset?.();
    toggleAddServerDialog(findScreen(root), false);
    await refreshIntegrationsScreen(root, bridge, permissionBridge);
  } catch (error) {
    setFormError(form, error instanceof Error ? error.message : String(error));
  } finally {
    if (submit) {
      submit.disabled = false;
    }
  }
}

export function bindIntegrationsControls(
  root = getDocument(),
  bridge = getDefaultMCPBridge(),
  permissionBridge = getDefaultPermissionBridge(),
) {
  const screen = findScreen(root);
  if (!screen || !bridge) {
    return null;
  }
  if (activeBinding?.screen === screen) {
    return activeBinding;
  }

  activeBinding?.dispose();

  const handleClick = (event) => {
    const action = closestAction(event.target, screen);
    if (action) {
      void handleIntegrationAction(action, root, bridge, permissionBridge);
    }
  };
  const handleStatusChange = () => {
    void refreshIntegrationsScreen(root, bridge, permissionBridge).catch((error) =>
      renderIntegrationsError(root, error),
    );
  };
  const handleSubmit = (event) => {
    if (event.target?.matches?.("[data-integrations-add-form]")) {
      void handleAddServerSubmit(event, root, bridge, permissionBridge);
    }
  };
  const handleChange = (event) => {
    if (event.target?.matches?.("[data-integrations-transport-select]")) {
      syncAddServerFields(event.target.form);
      setFormError(event.target.form);
      setTestConnectionStatus(event.target.form);
    }
  };
  const handleInput = (event) => {
    const form = event.target?.closest?.("[data-integrations-add-form]");
    if (!form) {
      return;
    }
    setFieldError(form, event.target?.name);
    setFormError(form);
    setTestConnectionStatus(form);
  };
  const statusCleanup = subscribeToMCPStatusChanges(bridge, handleStatusChange);

  screen.addEventListener("click", handleClick);
  screen.addEventListener("submit", handleSubmit);
  screen.addEventListener("change", handleChange);
  screen.addEventListener("input", handleInput);

  activeBinding = {
    data: normalizeIntegrationsData({}),
    dispose() {
      screen.removeEventListener?.("click", handleClick);
      screen.removeEventListener?.("submit", handleSubmit);
      screen.removeEventListener?.("change", handleChange);
      screen.removeEventListener?.("input", handleInput);
      statusCleanup();
    },
    permissionBridge,
    screen,
  };
  return activeBinding;
}
