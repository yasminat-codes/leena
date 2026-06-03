import { MCPClientManager } from "../mcp/client-manager.js";
import { ServerStore } from "../mcp/server-store.js";
import { MCPError, serializeError } from "../utils/errors.js";

export const MCP_IPC_CHANNELS = Object.freeze({
  listServers: "mcp:list-servers",
  addServer: "mcp:add-server",
  removeServer: "mcp:remove-server",
  updateServer: "mcp:update-server",
  connect: "mcp:connect",
  disconnect: "mcp:disconnect",
  listTools: "mcp:list-tools",
  testConnection: "mcp:test-connection",
  getStatus: "mcp:get-status",
});

export const DEFAULT_MCP_TEST_TIMEOUT_MS = 10_000;

const MCP_TRANSPORTS = new Set(["http", "stdio"]);
const STREAMABLE_HTTP_TRANSPORT_ALIASES = new Set([
  "http",
  "streamable-http",
  "streamable_http",
  "streamable",
]);
const MCP_PERMISSION_LEVELS = new Set(["auto", "confirm", "trust"]);
const MCP_UPDATE_FIELDS = Object.freeze([
  "name",
  "transport",
  "url",
  "command",
  "args",
  "enabled",
  "auto_connect",
  "permission_level",
]);
const TEST_SERVER_ID = "mcp-test-connection";
const MCP_CHANGED_CHANNEL = "mcp:changed";

export function registerMCPHandlers(options = {}) {
  const { ipcMain } = options;
  if (!ipcMain || typeof ipcMain.handle !== "function") {
    throw new TypeError("ipcMain.handle is required to register MCP handlers.");
  }

  const handlers = createMCPHandlers(options);
  ipcMain.handle(MCP_IPC_CHANNELS.listServers, handlers.listServers);
  ipcMain.handle(MCP_IPC_CHANNELS.addServer, handlers.addServer);
  ipcMain.handle(MCP_IPC_CHANNELS.removeServer, handlers.removeServer);
  ipcMain.handle(MCP_IPC_CHANNELS.updateServer, handlers.updateServer);
  ipcMain.handle(MCP_IPC_CHANNELS.connect, handlers.connect);
  ipcMain.handle(MCP_IPC_CHANNELS.disconnect, handlers.disconnect);
  ipcMain.handle(MCP_IPC_CHANNELS.listTools, handlers.listTools);
  ipcMain.handle(MCP_IPC_CHANNELS.testConnection, handlers.testConnection);
  ipcMain.handle(MCP_IPC_CHANNELS.getStatus, handlers.getStatus);

  return {
    channels: MCP_IPC_CHANNELS,
    handlers,
  };
}

export function createMCPHandlers(options = {}) {
  const deps = normalizeDependencies(options);

  return {
    listServers: () => deps.serverStore.listServers(),
    addServer: async (_event, payload) => addServer(payload, deps),
    removeServer: async (_event, idOrPayload) => removeServer(idOrPayload, deps),
    updateServer: async (_event, idOrPayload, updates) => updateServer(idOrPayload, updates, deps),
    connect: async (_event, idOrPayload) => connectServer(idOrPayload, deps),
    disconnect: async (_event, idOrPayload) => disconnectServer(idOrPayload, deps),
    listTools: async (_event, idOrPayload) => listTools(idOrPayload, deps),
    testConnection: async (_event, payload) => testConnection(payload, deps),
    getStatus: () => getStatus(deps),
  };
}

export function serializeMCPIpcError(error) {
  const mcpError =
    error instanceof MCPError
      ? error
      : new MCPError(error instanceof Error ? error.message : String(error), {
          cause: error,
        });
  return serializeError(mcpError, { includeStack: false, redactSecrets: true });
}

function normalizeDependencies(options) {
  const serverStore = options.serverStore ?? new ServerStore(options.storePath);
  const mcpClientManager = options.mcpClientManager ?? new MCPClientManager();
  const createTempClientManager =
    typeof options.createTempClientManager === "function"
      ? options.createTempClientManager
      : () => new MCPClientManager();

  assertStore(serverStore);
  assertClientManager(mcpClientManager);

  return {
    serverStore,
    mcpClientManager,
    createTempClientManager,
    webContents: options.webContents,
    now: typeof options.now === "function" ? options.now : Date.now,
    timeoutMs: normalizeTimeout(options.timeoutMs),
  };
}

async function addServer(payload, deps) {
  const config = normalizeServerConfig(payload, { requireName: true });
  const server = await deps.serverStore.addServer(config);

  if (server?.auto_connect === true) {
    await connectStoredServer(server, deps);
  }

  broadcastMCPChanged(deps, "add", server?.id);
  return server;
}

async function removeServer(idOrPayload, deps) {
  const serverId = extractServerId(idOrPayload);
  await disconnectQuietly(deps.mcpClientManager, serverId);
  const removed = await deps.serverStore.removeServer(serverId);
  broadcastMCPChanged(deps, "remove", serverId);
  return { serverId, removed: Boolean(removed) };
}

async function updateServer(idOrPayload, maybeUpdates, deps) {
  const { serverId, updates } = parseUpdateArgs(idOrPayload, maybeUpdates);
  const existing = await deps.serverStore.getServer(serverId);
  if (!existing) {
    return null;
  }

  if (Object.keys(updates).length === 0) {
    return existing;
  }

  normalizeServerConfig({ ...existing, ...updates }, { requireName: true });
  const updated = await deps.serverStore.updateServer(serverId, updates);
  broadcastMCPChanged(deps, "update", serverId);
  return updated;
}

async function connectServer(idOrPayload, deps) {
  const server = await getRequiredServer(extractServerId(idOrPayload), deps);
  const result = await connectStoredServer(server, deps);
  broadcastMCPChanged(deps, "connect", server.id);
  return result;
}

async function connectStoredServer(server, deps) {
  const clientConfig = toClientConfig(server);
  let connected = false;
  try {
    await deps.mcpClientManager.connect(clientConfig);
    connected = true;
    const tools = await deps.mcpClientManager.listTools(clientConfig.serverId);
    return {
      serverId: clientConfig.serverId,
      name: clientConfig.name,
      transport: clientConfig.transport,
      connected: true,
      toolCount: tools.length,
    };
  } catch (error) {
    if (connected) {
      await disconnectQuietly(deps.mcpClientManager, clientConfig.serverId);
    }
    throw error;
  }
}

async function disconnectServer(idOrPayload, deps) {
  const serverId = extractServerId(idOrPayload);
  const disconnected = await deps.mcpClientManager.disconnect(serverId);
  broadcastMCPChanged(deps, "disconnect", serverId);
  return { serverId, disconnected: Boolean(disconnected) };
}

async function listTools(idOrPayload, deps) {
  const serverId = extractServerId(idOrPayload);
  await getRequiredServer(serverId, deps);
  return deps.mcpClientManager.listTools(serverId);
}

async function testConnection(payload, deps) {
  const startedAt = deps.now();
  const config = normalizeServerConfig(payload, {
    requireName: false,
    fallbackId: TEST_SERVER_ID,
    fallbackName: "Temporary MCP server",
  });
  const clientConfig = toClientConfig(config);
  const tempClientManager = deps.createTempClientManager();
  assertClientManager(tempClientManager);

  const operation = (async () => {
    await tempClientManager.connect(clientConfig);
    return tempClientManager.listTools(clientConfig.serverId);
  })();
  operation
    .finally(() => disconnectQuietly(tempClientManager, clientConfig.serverId))
    .catch(() => {});

  try {
    const tools = await withTimeout(
      operation,
      deps.timeoutMs,
      `MCP test connection timed out after ${deps.timeoutMs}ms.`,
      clientConfig,
    );
    return {
      reachable: true,
      toolCount: tools.length,
      latencyMs: elapsedMs(deps, startedAt),
    };
  } catch (error) {
    return {
      reachable: false,
      error: error instanceof Error ? error.message : String(error),
      latencyMs: elapsedMs(deps, startedAt),
    };
  } finally {
    await disconnectQuietly(tempClientManager, clientConfig.serverId);
  }
}

function getStatus(deps) {
  const liveStatuses = normalizeStatusMap(deps.mcpClientManager.getStatus());
  const statuses = {};

  for (const server of deps.serverStore.listServers()) {
    const liveStatus = liveStatuses[server.id] ?? {};
    statuses[server.id] = {
      serverId: server.id,
      name: server.name,
      transport: server.transport,
      enabled: server.enabled,
      auto_connect: server.auto_connect,
      connected: liveStatus.connected === true,
      toolCount: Number.isInteger(liveStatus.toolCount) ? liveStatus.toolCount : 0,
    };
  }

  for (const [serverId, liveStatus] of Object.entries(liveStatuses)) {
    if (statuses[serverId]) {
      continue;
    }
    statuses[serverId] = {
      serverId,
      name: normalizeString(liveStatus.name) || serverId,
      transport: normalizeTransportOrUnknown(liveStatus.transport),
      enabled: false,
      auto_connect: false,
      connected: liveStatus.connected === true,
      toolCount: Number.isInteger(liveStatus.toolCount) ? liveStatus.toolCount : 0,
    };
  }

  return statuses;
}

async function getRequiredServer(serverId, deps) {
  const server = await deps.serverStore.getServer(serverId);
  if (!server) {
    throw new MCPError(`MCP server "${serverId}" is not configured.`, { serverName: serverId });
  }
  normalizeServerConfig(server, { requireName: true });
  return server;
}

function normalizeServerConfig(payload, options = {}) {
  if (!isRecord(payload)) {
    throw new MCPError("MCP server config must be an object.");
  }

  const transport = normalizeTransport(payload.transport);
  const id = normalizeString(payload.id ?? payload.serverId) || options.fallbackId;
  const name = normalizeString(payload.name) || options.fallbackName;
  if (options.requireName && !name) {
    throw new MCPError("MCP server name is required.", { transport });
  }

  const config = {
    name,
    transport,
    args: normalizeArgs(payload.args),
    enabled: normalizeBoolean(payload.enabled, true, "enabled"),
    auto_connect: normalizeBoolean(payload.auto_connect, false, "auto_connect"),
    permission_level: normalizePermissionLevel(payload.permission_level),
  };
  if (id) {
    config.id = id;
  }

  if (transport === "http") {
    config.url = normalizeHttpUrl(payload.url);
    return config;
  }

  config.command = normalizeCommand(payload.command);
  return config;
}

function parseUpdateArgs(idOrPayload, maybeUpdates) {
  const serverId = extractServerId(idOrPayload);
  let source = maybeUpdates;

  if (source === undefined && isRecord(idOrPayload)) {
    source = isRecord(idOrPayload.updates) ? idOrPayload.updates : omitIdFields(idOrPayload);
  }

  if (!isRecord(source)) {
    throw new MCPError("MCP server updates must be an object.", { serverName: serverId });
  }

  const updates = {};
  for (const field of MCP_UPDATE_FIELDS) {
    if (Object.hasOwn(source, field) && source[field] !== undefined) {
      updates[field] = normalizeUpdateField(field, source[field]);
    }
  }

  return { serverId, updates };
}

function normalizeUpdateField(field, value) {
  if (field === "transport") {
    return normalizeTransport(value);
  }
  if (field === "url" && value !== null) {
    return normalizeHttpUrl(value);
  }
  if (field === "command" && value !== null) {
    return normalizeCommand(value);
  }
  if (field === "args") {
    return normalizeArgs(value);
  }
  if (field === "enabled" || field === "auto_connect") {
    return normalizeBoolean(value, false, field);
  }
  if (field === "permission_level") {
    return normalizePermissionLevel(value);
  }
  if (field === "name") {
    const name = normalizeString(value);
    if (!name) {
      throw new MCPError("MCP server name is required.");
    }
    return name;
  }
  return value;
}

function extractServerId(idOrPayload) {
  const serverId = isRecord(idOrPayload)
    ? normalizeString(idOrPayload.id ?? idOrPayload.serverId)
    : normalizeString(idOrPayload);
  if (!serverId) {
    throw new MCPError("MCP server id is required.");
  }
  return serverId;
}

function toClientConfig(server) {
  const serverId = normalizeString(server.id ?? server.serverId);
  if (!serverId) {
    throw new MCPError("MCP server id is required.");
  }
  return {
    ...server,
    serverId,
    id: serverId,
    args: normalizeArgs(server.args),
  };
}

function normalizeTransport(value) {
  const transport = normalizeString(value).toLowerCase();
  if (STREAMABLE_HTTP_TRANSPORT_ALIASES.has(transport)) {
    return "http";
  }
  if (!MCP_TRANSPORTS.has(transport)) {
    throw new MCPError("MCP server transport must be streamable HTTP or stdio.", { transport });
  }
  return transport;
}

function normalizeTransportOrUnknown(value) {
  const transport = normalizeString(value).toLowerCase();
  return MCP_TRANSPORTS.has(transport) ? transport : "unknown";
}

function normalizeHttpUrl(value) {
  const url = normalizeString(value);
  if (!url) {
    throw new MCPError("MCP Streamable HTTP servers require a url.", { transport: "http" });
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
    return parsed.href;
  } catch {
    throw new MCPError("MCP Streamable HTTP server url must be a valid http(s) URL.", {
      transport: "http",
    });
  }
}

function normalizeCommand(value) {
  const command = normalizeString(value);
  if (!command) {
    throw new MCPError("MCP stdio servers require a command.", { transport: "stdio" });
  }
  if (command.includes("\0")) {
    throw new MCPError("MCP stdio command cannot contain null bytes.", { transport: "stdio" });
  }
  return command;
}

function normalizeArgs(value) {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new MCPError("MCP stdio args must be an array of strings.");
  }
  return value.map((item) => {
    if (typeof item !== "string" || item.includes("\0")) {
      throw new MCPError("MCP stdio args must be an array of strings.");
    }
    return item;
  });
}

function normalizeBoolean(value, defaultValue, field) {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value !== "boolean") {
    throw new MCPError(`MCP server ${field} must be a boolean.`);
  }
  return value;
}

function normalizePermissionLevel(value) {
  const normalized = normalizeString(value).toLowerCase();
  return MCP_PERMISSION_LEVELS.has(normalized) ? normalized : "confirm";
}

function normalizeTimeout(value) {
  return Number.isFinite(value) && value > 0
    ? Math.min(Math.trunc(value), DEFAULT_MCP_TEST_TIMEOUT_MS)
    : DEFAULT_MCP_TEST_TIMEOUT_MS;
}

function normalizeStatusMap(status) {
  return isRecord(status) ? status : {};
}

function omitIdFields(payload) {
  const { id: _id, serverId: _serverId, updates: _updates, ...rest } = payload;
  return rest;
}

function assertStore(serverStore) {
  for (const method of ["listServers", "addServer", "removeServer", "updateServer", "getServer"]) {
    if (typeof serverStore?.[method] !== "function") {
      throw new TypeError(`serverStore.${method} is required.`);
    }
  }
}

function assertClientManager(clientManager) {
  for (const method of ["connect", "disconnect", "listTools", "getStatus"]) {
    if (typeof clientManager?.[method] !== "function") {
      throw new TypeError(`mcpClientManager.${method} is required.`);
    }
  }
}

function withTimeout(promise, timeoutMs, message, config) {
  let timeout;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeout = setTimeout(() => {
        reject(
          new MCPError(message, {
            code: "MCP_TEST_TIMEOUT",
            serverName: config?.serverId ?? config?.id,
            transport: config?.transport,
          }),
        );
      }, timeoutMs);
    }),
  ]).finally(() => {
    clearTimeout(timeout);
  });
}

async function disconnectQuietly(clientManager, serverId) {
  try {
    await clientManager.disconnect(serverId);
  } catch {
    /* best-effort cleanup */
  }
}

function broadcastMCPChanged(deps, action, serverId) {
  if (!deps.webContents || typeof deps.webContents.send !== "function") {
    return;
  }
  if (typeof deps.webContents.isDestroyed === "function" && deps.webContents.isDestroyed()) {
    return;
  }
  deps.webContents.send(MCP_CHANGED_CHANNEL, {
    type: "mcp",
    action,
    serverId,
  });
}

function elapsedMs(deps, startedAt) {
  return Math.max(0, deps.now() - startedAt);
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
