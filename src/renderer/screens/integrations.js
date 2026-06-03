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
  http: "HTTP",
  stdio: "STDIO",
  unknown: "MCP",
});

let activeBinding = null;

function getDocument() {
  return typeof document === "undefined" ? null : document;
}

function getDefaultMCPBridge() {
  return typeof window === "undefined" ? null : window.leena?.mcp;
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

function normalizeStatuses(statuses) {
  if (statuses instanceof Map) {
    return Object.fromEntries(statuses);
  }
  return typeof statuses === "object" && statuses !== null && !Array.isArray(statuses)
    ? statuses
    : {};
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

export async function loadIntegrations(bridge = getDefaultMCPBridge()) {
  assertMCPBridge(bridge);

  const [servers, statuses] = await Promise.all([
    bridge.listServers(),
    typeof bridge.getStatus === "function" ? bridge.getStatus() : {},
  ]);

  return normalizeIntegrationsData({ servers, statuses });
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
    <article class="card integrations-tile" data-integrations-empty="true">
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
    <article class="card integrations-tile" data-integrations-loading="true" aria-busy="true">
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

function formatSummary(servers) {
  const serverLabel = servers.length === 1 ? "server" : "servers";
  return `${servers.length} configured MCP ${serverLabel} for Leena's realtime workspace.`;
}

function renderAddServerDialog() {
  return `
    <section class="card integrations-dialog" data-integrations-dialog hidden aria-label="Add MCP server">
      <form data-integrations-add-form>
        <div class="row settings-row">
          <label class="row__txt">
            <strong class="lx-body">Name</strong>
            <input name="name" autocomplete="off" placeholder="Project tools" />
          </label>
        </div>
        <div class="row settings-row">
          <label class="row__txt">
            <strong class="lx-body">Transport</strong>
            <select name="transport" data-integrations-transport-select>
              <option value="http">HTTP URL</option>
              <option value="stdio">Stdio command</option>
            </select>
          </label>
        </div>
        <div class="row settings-row" data-integrations-field="url">
          <label class="row__txt">
            <strong class="lx-body">URL</strong>
            <input name="url" autocomplete="off" placeholder="https://example.com/mcp" />
          </label>
        </div>
        <div class="row settings-row" data-integrations-field="command" hidden>
          <label class="row__txt">
            <strong class="lx-body">Command</strong>
            <input name="command" autocomplete="off" placeholder="npx @modelcontextprotocol/server-filesystem" />
          </label>
        </div>
        <div class="row settings-row" data-integrations-field="args" hidden>
          <label class="row__txt">
            <strong class="lx-body">Args</strong>
            <input name="args" autocomplete="off" placeholder="workspace-root" />
          </label>
        </div>
        <p class="lx-sm text-dim" data-integrations-form-error role="alert" hidden></p>
        <div class="integrations-tile__head">
          <button class="btn btn--ghost" type="submit">Add</button>
          <button class="btn btn--ghost" type="button" data-integrations-action="cancel-add">Cancel</button>
        </div>
      </form>
    </section>
  `;
}

function renderIntegrationsShell(data = {}) {
  const normalized = normalizeIntegrationsData(data);
  const connectedCount = normalized.servers.filter((server) => server.connected).length;
  const isLoading = data.loading === true;

  return `
    <section class="integrations-screen" aria-label="Integrations" data-integrations-state="${isLoading ? "loading" : "ready"}">
      <header class="panel-glass integrations-header">
        <div class="integrations-header__copy">
          <p class="lx-mono">Connections</p>
          <p class="lx-h1" data-integrations-connected-count>${connectedCount} connected</p>
          <p class="lx-sm text-dim" data-integrations-summary>${escapeHtml(formatSummary(normalized.servers))}</p>
        </div>
        <button class="btn btn--ghost" type="button" data-integrations-action="open-add" aria-expanded="false">Add Server</button>
      </header>

      ${renderAddServerDialog()}

      <section class="integrations-grid" aria-label="Configured MCP servers" data-integrations-list>
        ${isLoading ? renderLoadingState() : renderServerList(normalized.servers)}
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

function scheduleIntegrationsHydration(root = getDocument(), bridge = getDefaultMCPBridge()) {
  if (!root || !bridge) {
    return;
  }

  const hydrate = () => {
    const screen = root.querySelector?.(".integrations-screen");
    if (!screen) {
      return;
    }
    bindIntegrationsControls(root, bridge);
    void refreshIntegrationsScreen(root, bridge).catch((error) =>
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
  list.innerHTML = `
    <article class="card integrations-tile" data-integrations-error="true">
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

function updateIntegrationsScreen(root, data) {
  const screen = findScreen(root);
  if (!screen) {
    return null;
  }

  const normalized = normalizeIntegrationsData(data);
  const connectedCount = normalized.servers.filter((server) => server.connected).length;
  const count = screen.querySelector?.("[data-integrations-connected-count]");
  const summary = screen.querySelector?.("[data-integrations-summary]");
  const list = screen.querySelector?.("[data-integrations-list]");

  if (count) {
    count.textContent = `${connectedCount} connected`;
  }
  if (summary) {
    summary.textContent = formatSummary(normalized.servers);
  }
  if (list) {
    list.innerHTML = renderServerList(normalized.servers);
  }
  setScreenState(screen, "ready");
  return normalized;
}

export async function refreshIntegrationsScreen(
  root = getDocument(),
  bridge = getDefaultMCPBridge(),
) {
  if (!root) {
    return null;
  }
  const data = await loadIntegrations(bridge);
  return updateIntegrationsScreen(root, data);
}

export function validateMCPServerDraft(draft = {}) {
  const name = firstString(draft.name);
  const transport = firstString(draft.transport).toLowerCase();
  const args = firstString(draft.args)
    .split(/\s+/)
    .map((arg) => arg.trim())
    .filter(Boolean);

  if (!name) {
    return { error: "MCP server name is required." };
  }
  if (transport !== "http" && transport !== "stdio") {
    return { error: "Choose HTTP URL or stdio command." };
  }

  if (transport === "http") {
    const url = firstString(draft.url);
    if (!url) {
      return { error: "HTTP MCP servers require a URL." };
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { error: "HTTP MCP server URL must use http or https." };
      }
      return {
        config: {
          name,
          transport,
          url: parsed.href,
        },
      };
    } catch {
      return { error: "HTTP MCP server URL must be valid." };
    }
  }

  const command = firstString(draft.command);
  if (!command) {
    return { error: "Stdio MCP servers require a command." };
  }
  return {
    config: {
      args,
      command,
      name,
      transport,
    },
  };
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

function setFormError(form, message = "") {
  const error = form?.querySelector?.("[data-integrations-form-error]");
  if (!error) {
    return;
  }
  error.textContent = message;
  error.hidden = !message;
}

function readFormValue(form, name) {
  const field = form?.elements?.namedItem?.(name) ?? form?.querySelector?.(`[name="${name}"]`);
  return firstString(field?.value);
}

function getAddServerDraft(form) {
  return {
    args: readFormValue(form, "args"),
    command: readFormValue(form, "command"),
    name: readFormValue(form, "name"),
    transport: readFormValue(form, "transport"),
    url: readFormValue(form, "url"),
  };
}

function syncAddServerFields(form) {
  const transport = readFormValue(form, "transport") || "http";
  const urlField = form?.querySelector?.('[data-integrations-field="url"]');
  const commandField = form?.querySelector?.('[data-integrations-field="command"]');
  const argsField = form?.querySelector?.('[data-integrations-field="args"]');

  if (urlField) {
    urlField.hidden = transport !== "http";
  }
  if (commandField) {
    commandField.hidden = transport !== "stdio";
  }
  if (argsField) {
    argsField.hidden = transport !== "stdio";
  }
}

function toggleAddServerDialog(screen, isOpen) {
  const dialog = screen?.querySelector?.("[data-integrations-dialog]");
  const button = screen?.querySelector?.('[data-integrations-action="open-add"]');
  if (dialog) {
    dialog.hidden = !isOpen;
  }
  if (button) {
    button.setAttribute("aria-expanded", String(isOpen));
  }
  const form = dialog?.querySelector?.("[data-integrations-add-form]");
  if (form) {
    syncAddServerFields(form);
    setFormError(form);
  }
}

async function handleIntegrationAction(action, root, bridge) {
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
  if (type === "connect" || type === "disconnect") {
    action.disabled = true;
    try {
      await toggleIntegrationConnection(getServerFromAction(action), bridge);
      await refreshIntegrationsScreen(root, bridge);
    } finally {
      action.disabled = false;
    }
    return;
  }
  if (type === "remove") {
    action.disabled = true;
    try {
      await removeIntegrationServer(action.dataset.serverId, bridge);
      await refreshIntegrationsScreen(root, bridge);
    } finally {
      action.disabled = false;
    }
  }
}

async function handleAddServerSubmit(event, root, bridge) {
  event.preventDefault();
  const form = event.currentTarget;
  const draft = getAddServerDraft(form);
  const validation = validateMCPServerDraft(draft);
  if (!validation.config) {
    setFormError(form, validation.error);
    return;
  }

  setFormError(form);
  const submit = form.querySelector?.('[type="submit"]');
  if (submit) {
    submit.disabled = true;
  }
  try {
    await addIntegrationServer(draft, bridge);
    form.reset?.();
    toggleAddServerDialog(findScreen(root), false);
    await refreshIntegrationsScreen(root, bridge);
  } catch (error) {
    setFormError(form, error instanceof Error ? error.message : String(error));
  } finally {
    if (submit) {
      submit.disabled = false;
    }
  }
}

export function bindIntegrationsControls(root = getDocument(), bridge = getDefaultMCPBridge()) {
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
      void handleIntegrationAction(action, root, bridge);
    }
  };
  const handleStatusChange = () => {
    void refreshIntegrationsScreen(root, bridge).catch((error) =>
      renderIntegrationsError(root, error),
    );
  };
  const statusCleanup = subscribeToMCPStatusChanges(bridge, handleStatusChange);

  screen.addEventListener("click", handleClick);
  const form = screen.querySelector?.("[data-integrations-add-form]");
  const transport = screen.querySelector?.("[data-integrations-transport-select]");
  form?.addEventListener?.("submit", (event) => void handleAddServerSubmit(event, root, bridge));
  transport?.addEventListener?.("change", () => syncAddServerFields(form));

  activeBinding = {
    dispose() {
      screen.removeEventListener?.("click", handleClick);
      statusCleanup();
    },
    screen,
  };
  return activeBinding;
}
