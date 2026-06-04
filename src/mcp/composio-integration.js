import { loadComposioCredential } from "../providers/provider-settings.js";
import { deleteSetting, getSetting, setSetting } from "../settings-store.js";
import { MCPError, ProviderError, serializeError } from "../utils/errors.js";
import { MCPClientManager } from "./client-manager.js";
import { ServerStore } from "./server-store.js";

export const COMPOSIO_PROVIDER_ID = "composio";
export const COMPOSIO_MCP_SERVER_NAME = "Composio Actions Hub";
export const COMPOSIO_DEFAULT_USER_ID = "leena-owner";
export const COMPOSIO_MCP_SERVER_ID_SETTING = "composio:mcp:serverId";
export const COMPOSIO_MCP_METADATA_SETTING = "composio:mcp:metadata";
export const COMPOSIO_IPC_CHANNELS = Object.freeze({
  getStatus: "composio:get-integration-status",
  testConnection: "composio:test-connection",
  refreshTools: "composio:refresh-tools",
  listToolkits: "composio:list-toolkits",
  listConnectedApps: "composio:list-connected-apps",
  openAppAuth: "composio:open-app-auth",
});

const DEFAULT_COMPOSIO_API_BASE_URL = "https://backend.composio.dev/api/v3.1";
const METADATA_VERSION = 1;
const DEFAULT_PERMISSION_METADATA_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const MAX_TOOLKITS_PER_SESSION = 20;

export function createComposioIntegrationService(options = {}) {
  const deps = normalizeDependencies(options);

  return {
    getStatus: () => getComposioStatus(deps),
    testConnection: (payload) => testComposioConnection(payload, deps),
    refreshTools: (payload) => refreshComposioTools(payload, deps),
    listToolkits: (payload) => listComposioToolkits(payload, deps),
    listConnectedApps: (payload) => listComposioConnectedApps(payload, deps),
    openAppAuth: (payload) => openComposioAppAuth(payload, deps),
    getPermissionServerConfig: (serverId) => getComposioPermissionServerConfig(serverId, deps),
  };
}

export function createComposioIntegrationHandlers(options = {}) {
  const service = options.service ?? createComposioIntegrationService(options);
  return {
    getStatus: wrapComposioHandler(() => service.getStatus()),
    testConnection: wrapComposioHandler((_event, payload) => service.testConnection(payload)),
    refreshTools: wrapComposioHandler((_event, payload) => service.refreshTools(payload)),
    listToolkits: wrapComposioHandler((_event, payload) => service.listToolkits(payload)),
    listConnectedApps: wrapComposioHandler((_event, payload) => service.listConnectedApps(payload)),
    openAppAuth: wrapComposioHandler((_event, payload) => service.openAppAuth(payload)),
  };
}

export function registerComposioIntegrationHandlers(options = {}) {
  const { ipcMain } = options;
  if (!ipcMain || typeof ipcMain.handle !== "function") {
    throw new TypeError("ipcMain.handle is required to register Composio handlers.");
  }

  const handlers = createComposioIntegrationHandlers(options);
  ipcMain.handle(COMPOSIO_IPC_CHANNELS.getStatus, handlers.getStatus);
  ipcMain.handle(COMPOSIO_IPC_CHANNELS.testConnection, handlers.testConnection);
  ipcMain.handle(COMPOSIO_IPC_CHANNELS.refreshTools, handlers.refreshTools);
  ipcMain.handle(COMPOSIO_IPC_CHANNELS.listToolkits, handlers.listToolkits);
  ipcMain.handle(COMPOSIO_IPC_CHANNELS.listConnectedApps, handlers.listConnectedApps);
  ipcMain.handle(COMPOSIO_IPC_CHANNELS.openAppAuth, handlers.openAppAuth);
  return { channels: COMPOSIO_IPC_CHANNELS, handlers };
}

export function createComposioRestClient(options = {}) {
  const apiKey = normalizeString(options.apiKey);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  const baseUrl = normalizeBaseUrl(options.baseUrl) || DEFAULT_COMPOSIO_API_BASE_URL;

  async function requestJson(method, pathname, { query, body } = {}) {
    if (!apiKey) {
      throw createComposioProviderError("Composio API key is required.", {
        code: "COMPOSIO_CREDENTIAL_MISSING",
      });
    }
    if (typeof fetchImpl !== "function") {
      throw createComposioProviderError("Fetch is unavailable for Composio API requests.", {
        code: "COMPOSIO_FETCH_UNAVAILABLE",
      });
    }

    const url = buildComposioUrl(baseUrl, pathname, query);
    const response = await fetchImpl(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    const payload = await readJsonResponse(response);
    if (!response?.ok) {
      throw createComposioProviderError(
        `Composio API request failed with status ${response?.status ?? "unknown"}.`,
        {
          code: "COMPOSIO_API_REQUEST_FAILED",
          cause: normalizeComposioApiError(payload),
        },
      );
    }
    return payload;
  }

  return {
    async createSession({ userId, toolkits }) {
      const payload = {
        user_id: userId,
        toolkits: { enabled: toolkits },
      };
      const session = await requestJson("POST", "/tool_router/session", { body: payload });
      return normalizeComposioSession(session, { apiKey });
    },
    async testConnection() {
      return requestJson("GET", "/toolkits", {
        query: { sort_by: "alphabetically", include_deprecated: "false" },
      });
    },
    async listToolkits(options = {}) {
      return requestJson("GET", "/toolkits", {
        query: {
          search: normalizeString(options.search) || undefined,
          sort_by: normalizeString(options.sortBy) || "alphabetically",
          include_deprecated: String(Boolean(options.includeDeprecated)),
        },
      });
    },
    async listConnectedApps(options = {}) {
      return requestJson("GET", "/connected_accounts", {
        query: {
          limit: normalizePositiveInteger(options.limit) ?? 100,
          user_ids: normalizeString(options.userId) || undefined,
          statuses: options.connectedOnly === false ? undefined : "ACTIVE",
          toolkit_slugs: normalizeToolkitSlugs(options.toolkits),
        },
      });
    },
    async openAppAuth(options = {}) {
      const session = await this.createSession({
        userId: options.userId,
        toolkits: [options.toolkit],
      });
      const payload = {
        toolkit: options.toolkit,
        ...(normalizeString(options.callbackUrl)
          ? { callback_url: normalizeString(options.callbackUrl) }
          : {}),
        ...(normalizeString(options.alias) ? { alias: normalizeString(options.alias) } : {}),
      };
      const link = await requestJson("POST", `/tool_router/session/${session.sessionId}/link`, {
        body: payload,
      });
      return normalizeAuthLink(link);
    },
  };
}

function normalizeDependencies(options) {
  const storePath = options.storePath;
  const serverStore =
    options.serverStore ?? new ServerStore({ storePath, secretCodec: options.secretCodec });
  const mcpClientManager = options.mcpClientManager ?? new MCPClientManager();
  const settingsStore = options.settingsStore ?? { getSetting, setSetting, deleteSetting };

  assertServerStore(serverStore);
  assertClientManager(mcpClientManager);

  return {
    storePath,
    serverStore,
    mcpClientManager,
    settingsStore,
    secretCodec: options.secretCodec,
    loadCredential: options.loadCredential ?? loadComposioCredential,
    createComposioClient: options.createComposioClient ?? createComposioRestClient,
    apiBaseUrl: normalizeBaseUrl(options.apiBaseUrl) || DEFAULT_COMPOSIO_API_BASE_URL,
    fetchImpl: options.fetchImpl,
    openExternal: options.openExternal,
    now: typeof options.now === "function" ? options.now : Date.now,
    permissionMetadataMaxAgeMs:
      Number.isFinite(options.permissionMetadataMaxAgeMs) && options.permissionMetadataMaxAgeMs > 0
        ? Math.trunc(options.permissionMetadataMaxAgeMs)
        : DEFAULT_PERMISSION_METADATA_MAX_AGE_MS,
  };
}

function getComposioStatus(deps) {
  const credential = readComposioCredential(deps);
  const metadata = readComposioMetadata(deps);
  const serverId = normalizeString(metadata?.serverId ?? readComposioServerId(deps));
  const server = serverId ? deps.serverStore.getServer(serverId) : null;
  const liveStatus = getLiveStatus(deps, serverId);
  const metadataFresh = isComposioMetadataFresh(metadata, serverId, deps);
  const connected = metadataFresh && liveStatus?.connected === true;

  return {
    ok: true,
    provider: COMPOSIO_PROVIDER_ID,
    configured: Boolean(credential),
    connected,
    serverId: server?.id ?? (serverId || null),
    serverName: server?.name ?? COMPOSIO_MCP_SERVER_NAME,
    refreshStatus: getRefreshStatus({ credential, metadata, metadataFresh, connected }),
    toolCount: connected ? normalizeToolCount(liveStatus?.toolCount, metadata?.toolCount) : 0,
    lastToolCount: Number.isInteger(metadata?.toolCount) ? metadata.toolCount : 0,
    refreshedAt: normalizeString(metadata?.refreshedAt) || null,
    enabledToolkits: normalizeToolkitSlugs(metadata?.enabledToolkits),
  };
}

async function testComposioConnection(payload, deps) {
  const startedAt = deps.now();
  const credential = requireComposioCredential(deps);
  const client = await createComposioClient(credential, deps);
  const result =
    typeof client.testConnection === "function"
      ? await client.testConnection({ userId: normalizeUserId(payload?.userId) })
      : await client.listToolkits({ limit: 1 });
  const items = normalizeToolkits(result);

  return {
    ok: true,
    provider: COMPOSIO_PROVIDER_ID,
    configured: true,
    connected: true,
    latencyMs: elapsedMs(deps, startedAt),
    testedAt: new Date(deps.now()).toISOString(),
    toolkitCount: items.length,
  };
}

async function refreshComposioTools(payload, deps) {
  const startedAt = deps.now();
  const credential = requireComposioCredential(deps);
  const enabledToolkits = resolveEnabledToolkits(payload, deps);
  if (enabledToolkits.length === 0) {
    throw createComposioProviderError("Select at least one Composio toolkit before refreshing.", {
      code: "COMPOSIO_TOOLKIT_SELECTION_REQUIRED",
    });
  }
  if (enabledToolkits.length > MAX_TOOLKITS_PER_SESSION) {
    throw createComposioProviderError(
      `Composio refresh is limited to ${MAX_TOOLKITS_PER_SESSION} selected toolkits.`,
      { code: "COMPOSIO_TOOLKIT_SELECTION_TOO_LARGE" },
    );
  }

  const client = await createComposioClient(credential, deps);
  const session = await client.createSession({
    userId: normalizeUserId(payload?.userId),
    toolkits: enabledToolkits,
  });
  const normalizedSession = normalizeComposioSession(session, { apiKey: credential });
  const server = ensureComposioServerEntry(normalizedSession, deps);
  let connected = false;

  try {
    await deps.mcpClientManager.connect({
      ...server,
      serverId: server.id,
      headers: normalizedSession.mcp.headers,
    });
    connected = true;
    const tools = normalizeMCPTools(await deps.mcpClientManager.listTools(server.id));
    const refreshedAtMs = deps.now();
    const refreshedAt = new Date(refreshedAtMs).toISOString();
    const metadata = {
      version: METADATA_VERSION,
      status: "ready",
      serverId: server.id,
      sessionId: normalizedSession.sessionId,
      userId: normalizedSession.userId,
      enabledToolkits,
      refreshedAt,
      expiresAt: new Date(refreshedAtMs + deps.permissionMetadataMaxAgeMs).toISOString(),
      toolCount: tools.length,
      tools,
    };
    writeComposioMetadata(metadata, deps);

    return {
      ok: true,
      provider: COMPOSIO_PROVIDER_ID,
      configured: true,
      connected: true,
      serverId: server.id,
      serverName: server.name,
      enabledToolkits,
      toolCount: tools.length,
      refreshedAt,
      latencyMs: elapsedMs(deps, startedAt),
    };
  } catch (error) {
    if (connected) {
      await disconnectQuietly(deps.mcpClientManager, server.id);
    }
    writeComposioMetadata(
      {
        version: METADATA_VERSION,
        status: "error",
        serverId: server.id,
        sessionId: normalizedSession.sessionId,
        userId: normalizedSession.userId,
        enabledToolkits,
        refreshedAt: new Date(deps.now()).toISOString(),
        expiresAt: null,
        toolCount: 0,
        tools: [],
      },
      deps,
    );
    throw createComposioMCPError("Failed to refresh Composio MCP tools.", {
      serverName: server.id,
      cause: error,
    });
  }
}

async function listComposioToolkits(payload, deps) {
  const credential = requireComposioCredential(deps);
  const client = await createComposioClient(credential, deps);
  const result = await client.listToolkits({
    search: payload?.search,
    sortBy: payload?.sortBy,
    includeDeprecated: payload?.includeDeprecated,
  });
  return {
    ok: true,
    provider: COMPOSIO_PROVIDER_ID,
    configured: true,
    toolkits: normalizeToolkits(result),
  };
}

async function listComposioConnectedApps(payload, deps) {
  const credential = requireComposioCredential(deps);
  const client = await createComposioClient(credential, deps);
  const result = await client.listConnectedApps({
    userId: normalizeUserId(payload?.userId),
    toolkits: normalizeToolkitSlugs(payload?.toolkits),
    connectedOnly: payload?.connectedOnly !== false,
    limit: normalizePositiveInteger(payload?.limit),
  });
  return {
    ok: true,
    provider: COMPOSIO_PROVIDER_ID,
    configured: true,
    apps: normalizeConnectedApps(result),
  };
}

async function openComposioAppAuth(payload, deps) {
  const credential = requireComposioCredential(deps);
  const toolkit = normalizeToolkitSlug(payload?.toolkit);
  if (!toolkit) {
    throw createComposioProviderError("Composio toolkit is required to open auth.", {
      code: "COMPOSIO_TOOLKIT_REQUIRED",
    });
  }

  const client = await createComposioClient(credential, deps);
  const authLink = normalizeAuthLink(
    await client.openAppAuth({
      toolkit,
      userId: normalizeUserId(payload?.userId),
      callbackUrl: payload?.callbackUrl,
      alias: payload?.alias,
    }),
  );
  if (!authLink.redirectUrl) {
    throw createComposioProviderError("Composio auth did not return a redirect URL.", {
      code: "COMPOSIO_AUTH_LINK_MISSING",
    });
  }

  let opened = false;
  if (payload?.open === true && typeof deps.openExternal === "function") {
    await deps.openExternal(authLink.redirectUrl);
    opened = true;
  }

  return {
    ok: true,
    provider: COMPOSIO_PROVIDER_ID,
    toolkit,
    redirectUrl: authLink.redirectUrl,
    expiresAt: authLink.expiresAt,
    opened,
  };
}

function getComposioPermissionServerConfig(serverId, deps) {
  const normalizedServerId = normalizeString(serverId);
  const metadata = readComposioMetadata(deps);
  const composioServerId = normalizeString(readComposioServerId(deps) || metadata?.serverId);
  if (!normalizedServerId || normalizedServerId !== composioServerId) {
    return null;
  }
  const storedServer = normalizedServerId ? deps.serverStore.getServer(normalizedServerId) : null;
  const { headers: _headers, ...serverMetadata } = storedServer ?? {};
  const liveStatus = getLiveStatus(deps, normalizedServerId);
  const tools =
    isComposioMetadataFresh(metadata, normalizedServerId, deps) && liveStatus?.connected === true
      ? normalizeMCPTools(metadata.tools)
      : [];

  return {
    ...serverMetadata,
    serverId: storedServer?.id ?? normalizedServerId,
    name: storedServer?.name ?? COMPOSIO_MCP_SERVER_NAME,
    permission_level: storedServer?.permission_level ?? "confirm",
    tools,
  };
}

function ensureComposioServerEntry(session, deps) {
  const existingServerId = readComposioServerId(deps);
  const existingServer = existingServerId ? deps.serverStore.getServer(existingServerId) : null;
  const config = {
    name: COMPOSIO_MCP_SERVER_NAME,
    transport: "http",
    url: session.mcp.url,
    enabled: true,
    auto_connect: false,
    permission_level: "confirm",
  };

  if (existingServer) {
    const updated = deps.serverStore.updateServer(existingServer.id, config);
    return updated ?? existingServer;
  }

  const server = deps.serverStore.addServer(config);
  writeComposioServerId(server.id, deps);
  return server;
}

function resolveEnabledToolkits(payload, deps) {
  if (isRecord(payload) && Object.hasOwn(payload, "toolkits")) {
    return normalizeToolkitSlugs(payload.toolkits);
  }
  if (isRecord(payload) && Object.hasOwn(payload, "enabledToolkits")) {
    return normalizeToolkitSlugs(payload.enabledToolkits);
  }
  return normalizeToolkitSlugs(readComposioMetadata(deps)?.enabledToolkits);
}

function normalizeComposioSession(session, options = {}) {
  if (!isRecord(session)) {
    throw createComposioMCPError("Composio session response must be an object.", {
      code: "COMPOSIO_SESSION_INVALID",
    });
  }

  const mcp = isRecord(session.mcp) ? session.mcp : {};
  const url = normalizeHttpUrl(mcp.url ?? session.mcpUrl ?? session.mcp_url);
  const sessionId = normalizeString(session.sessionId ?? session.session_id);
  if (!sessionId) {
    throw createComposioMCPError("Composio session response is missing session id.", {
      code: "COMPOSIO_SESSION_ID_MISSING",
    });
  }

  return {
    sessionId,
    userId: normalizeString(session.userId ?? session.user_id ?? session.config?.user_id),
    mcp: {
      url,
      headers: normalizeHeaders(mcp.headers ?? session.headers, options.apiKey),
    },
  };
}

function normalizeToolkits(result) {
  const items = Array.isArray(result)
    ? result
    : Array.isArray(result?.items)
      ? result.items
      : Array.isArray(result?.toolkits)
        ? result.toolkits
        : [];
  return items.map(normalizeToolkit).filter(Boolean);
}

function normalizeToolkit(toolkit) {
  if (!isRecord(toolkit)) {
    return null;
  }
  const slug = normalizeToolkitSlug(toolkit.slug ?? toolkit.name ?? toolkit.id);
  if (!slug) {
    return null;
  }
  const connection = isRecord(toolkit.connection) ? toolkit.connection : {};
  return {
    slug,
    name: normalizeString(toolkit.name ?? toolkit.displayName ?? toolkit.label) || slug,
    connected: toolkit.connected === true || connection.isActive === true,
    status: normalizeString(toolkit.status ?? connection.status) || null,
  };
}

function normalizeConnectedApps(result) {
  const items = Array.isArray(result)
    ? result
    : Array.isArray(result?.items)
      ? result.items
      : Array.isArray(result?.apps)
        ? result.apps
        : [];
  return items.map(normalizeConnectedApp).filter(Boolean);
}

function normalizeConnectedApp(app) {
  if (!isRecord(app)) {
    return null;
  }
  const toolkit = isRecord(app.toolkit) ? app.toolkit : {};
  const slug = normalizeToolkitSlug(toolkit.slug ?? app.toolkit_slug ?? app.toolkit);
  const id = normalizeString(app.id ?? app.nanoid ?? app.nanoId ?? app.connected_account_id);
  if (!slug && !id) {
    return null;
  }
  const status = normalizeString(app.status ?? app.state);
  return {
    id: id || null,
    toolkit: slug || null,
    name: normalizeString(toolkit.name ?? app.name) || slug || id,
    connected: ["active", "connected", "enabled"].includes(status.toLowerCase()),
    status: status || null,
  };
}

function normalizeAuthLink(link) {
  if (!isRecord(link)) {
    return { redirectUrl: null, expiresAt: null };
  }
  return {
    redirectUrl: normalizeString(link.redirectUrl ?? link.redirect_url) || null,
    expiresAt: normalizeString(link.expiresAt ?? link.expires_at) || null,
  };
}

function normalizeMCPTools(tools) {
  return (Array.isArray(tools) ? tools : [])
    .map((tool) => {
      if (!isRecord(tool) || !normalizeString(tool.name) || !isRecord(tool.inputSchema)) {
        return null;
      }
      return {
        name: normalizeString(tool.name),
        description: normalizeString(tool.description),
        inputSchema: structuredClone(tool.inputSchema),
      };
    })
    .filter(Boolean);
}

function isComposioMetadataFresh(metadata, serverId, deps) {
  if (!isRecord(metadata) || metadata.version !== METADATA_VERSION || metadata.status !== "ready") {
    return false;
  }
  if (normalizeString(metadata.serverId) !== normalizeString(serverId)) {
    return false;
  }
  if (!Array.isArray(metadata.tools) || metadata.tools.length !== metadata.toolCount) {
    return false;
  }
  const expiresAt = Date.parse(metadata.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > deps.now();
}

function getRefreshStatus({ credential, metadata, metadataFresh, connected }) {
  if (!credential) {
    return "missing_credential";
  }
  if (!metadata) {
    return "not_refreshed";
  }
  if (metadata.status === "error") {
    return "error";
  }
  if (metadataFresh && connected) {
    return "ready";
  }
  return "stale";
}

function readComposioCredential(deps) {
  return normalizeString(deps.loadCredential(deps.storePath, deps.secretCodec));
}

function requireComposioCredential(deps) {
  const credential = readComposioCredential(deps);
  if (!credential) {
    throw createComposioProviderError("Composio credential is required.", {
      code: "COMPOSIO_CREDENTIAL_MISSING",
    });
  }
  return credential;
}

async function createComposioClient(apiKey, deps) {
  const client = await deps.createComposioClient({
    apiKey,
    fetchImpl: deps.fetchImpl,
    baseUrl: deps.apiBaseUrl,
  });
  if (!isRecord(client)) {
    throw createComposioProviderError("Composio client factory returned an invalid client.", {
      code: "COMPOSIO_CLIENT_INVALID",
    });
  }
  return client;
}

function readComposioServerId(deps) {
  return normalizeString(readSetting(COMPOSIO_MCP_SERVER_ID_SETTING, null, deps));
}

function writeComposioServerId(serverId, deps) {
  writeSetting(COMPOSIO_MCP_SERVER_ID_SETTING, normalizeString(serverId), deps);
}

function readComposioMetadata(deps) {
  const value = readSetting(COMPOSIO_MCP_METADATA_SETTING, null, deps);
  return isRecord(value) ? value : null;
}

function writeComposioMetadata(metadata, deps) {
  writeSetting(COMPOSIO_MCP_METADATA_SETTING, metadata, deps);
}

function readSetting(key, defaultValue, deps) {
  return deps.settingsStore.getSetting(key, defaultValue, deps.storePath);
}

function writeSetting(key, value, deps) {
  return deps.settingsStore.setSetting(key, value, deps.storePath);
}

function wrapComposioHandler(handler) {
  return async (event, ...args) => {
    try {
      return await handler(event, ...args);
    } catch (error) {
      return {
        ok: false,
        error: serializeComposioError(error),
      };
    }
  };
}

function serializeComposioError(error) {
  const normalized =
    error instanceof ProviderError || error instanceof MCPError
      ? error
      : createComposioProviderError(error instanceof Error ? error.message : String(error), {
          code: "COMPOSIO_INTEGRATION_ERROR",
          cause: error,
        });
  return serializeError(normalized, { includeStack: false, redactSecrets: true });
}

function createComposioProviderError(message, options = {}) {
  return new ProviderError(message, {
    ...options,
    provider: COMPOSIO_PROVIDER_ID,
  });
}

function createComposioMCPError(message, options = {}) {
  return new MCPError(message, {
    ...options,
    serverName: options.serverName ?? COMPOSIO_MCP_SERVER_NAME,
    transport: "http",
  });
}

function normalizeComposioApiError(payload) {
  if (!isRecord(payload)) {
    return undefined;
  }
  const source = isRecord(payload.error) ? payload.error : payload;
  const message = normalizeString(source.message ?? source.error);
  return message ? new Error(message) : undefined;
}

async function readJsonResponse(response) {
  if (typeof response?.json === "function") {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  if (typeof response?.text === "function") {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  return null;
}

function buildComposioUrl(baseUrl, pathname, query = {}) {
  const url = new URL(pathname, `${baseUrl}/`);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null && item !== "") {
          url.searchParams.append(key, String(item));
        }
      }
      continue;
    }
    url.searchParams.set(key, String(value));
  }
  return url;
}

function normalizeBaseUrl(value) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return "";
  }
  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }
    return url.href.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function normalizeHttpUrl(value) {
  const normalized = normalizeString(value);
  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
    return url.href;
  } catch {
    throw createComposioMCPError("Composio MCP URL must be a valid http(s) URL.", {
      code: "COMPOSIO_MCP_URL_INVALID",
    });
  }
}

function normalizeHeaders(value, apiKey) {
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [normalizeString(key), normalizeString(item)])
        .filter(([key, item]) => key && item),
    );
  }
  const normalizedApiKey = normalizeString(apiKey);
  return normalizedApiKey ? { "x-api-key": normalizedApiKey } : {};
}

function normalizeToolkitSlugs(value) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const seen = new Set();
  const result = [];
  for (const item of values) {
    const slug = normalizeToolkitSlug(item);
    if (!slug || seen.has(slug)) {
      continue;
    }
    seen.add(slug);
    result.push(slug);
  }
  return result;
}

function normalizeToolkitSlug(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeUserId(value) {
  const normalized = normalizeString(value);
  if (!normalized || normalized.toLowerCase() === "default") {
    return COMPOSIO_DEFAULT_USER_ID;
  }
  return normalized;
}

function normalizePositiveInteger(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

function normalizeToolCount(liveToolCount, metadataToolCount) {
  if (Number.isInteger(liveToolCount)) {
    return liveToolCount;
  }
  return Number.isInteger(metadataToolCount) ? metadataToolCount : 0;
}

function getLiveStatus(deps, serverId) {
  const status = normalizeStatusMap(deps.mcpClientManager.getStatus?.());
  return status[serverId] ?? null;
}

function normalizeStatusMap(value) {
  return isRecord(value) ? value : {};
}

async function disconnectQuietly(mcpClientManager, serverId) {
  try {
    await mcpClientManager.disconnect(serverId);
  } catch {
    /* refresh cleanup best effort */
  }
}

function elapsedMs(deps, startedAt) {
  return Math.max(0, deps.now() - startedAt);
}

function assertServerStore(serverStore) {
  for (const method of ["addServer", "updateServer", "getServer"]) {
    if (typeof serverStore?.[method] !== "function") {
      throw new TypeError(`serverStore.${method} is required.`);
    }
  }
}

function assertClientManager(mcpClientManager) {
  for (const method of ["connect", "disconnect", "listTools", "getStatus"]) {
    if (typeof mcpClientManager?.[method] !== "function") {
      throw new TypeError(`mcpClientManager.${method} is required.`);
    }
  }
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
