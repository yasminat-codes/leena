import assert from "node:assert/strict";
import test from "node:test";
import {
  createMCPHandlers,
  MCP_IPC_CHANNELS,
  registerMCPHandlers,
  serializeMCPIpcError,
} from "../src/ipc/mcp-handlers.js";
import { MCPError } from "../src/utils/errors.js";

const HTTP_SERVER = Object.freeze({
  id: "remote",
  name: "Remote MCP",
  transport: "http",
  url: "https://mcp.example.test/mcp",
  args: [],
  enabled: true,
  auto_connect: false,
  permission_level: "confirm",
});

const STDIO_SERVER = Object.freeze({
  id: "local",
  name: "Local MCP",
  transport: "stdio",
  command: "node",
  args: ["server.js"],
  enabled: true,
  auto_connect: false,
  permission_level: "auto",
});

const TOOLS = Object.freeze([
  {
    name: "search",
    description: "Search messages",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
    },
  },
]);

test("registerMCPHandlers wires every MCP channel", () => {
  const registered = new Map();
  const ipcMain = {
    handle(channel, handler) {
      registered.set(channel, handler);
    },
  };

  const { handlers, channels } = registerMCPHandlers({
    ipcMain,
    serverStore: createMockStore(),
    mcpClientManager: createMockClientManager(),
  });

  assert.deepEqual(channels, MCP_IPC_CHANNELS);
  assert.deepEqual([...registered.keys()], Object.values(MCP_IPC_CHANNELS));
  assert.equal(registered.get(MCP_IPC_CHANNELS.listServers), handlers.listServers);
  for (const handler of registered.values()) {
    assert.equal(typeof handler, "function");
  }
});

test("list/add handlers validate input before storage and auto-connect when requested", async () => {
  const store = createMockStore();
  const manager = createMockClientManager({ tools: TOOLS });
  const sentEvents = [];
  const handlers = createMCPHandlers({
    serverStore: store,
    mcpClientManager: manager,
    webContents: {
      isDestroyed: () => false,
      send: (channel, payload) => sentEvents.push({ channel, payload }),
    },
  });

  await assert.rejects(
    handlers.addServer(null, {
      name: "Missing URL",
      transport: "http",
    }),
    /MCP Streamable HTTP servers require a url/,
  );
  await assert.rejects(
    handlers.addServer(null, {
      name: "Missing Command",
      transport: "stdio",
    }),
    /MCP stdio servers require a command/,
  );
  await assert.rejects(
    handlers.addServer(null, {
      name: "Bad Transport",
      transport: "websocket",
    }),
    /transport must be streamable HTTP or stdio/,
  );
  await assert.rejects(
    handlers.addServer(null, {
      name: "Bad Header",
      transport: "http",
      url: "https://mcp.example.test/mcp",
      headers: { "Bad Header": "value" },
    }),
    /HTTP header names/,
  );
  await assert.rejects(
    handlers.addServer(null, {
      name: "Empty Header",
      transport: "http",
      url: "https://mcp.example.test/mcp",
      headers: { Authorization: " " },
    }),
    /HTTP header values/,
  );
  assert.deepEqual(store.calls.addServer, []);

  const server = await handlers.addServer(null, {
    name: "Remote MCP",
    transport: "http",
    url: "https://mcp.example.test/mcp",
    headers: { Authorization: "Bearer test-token" },
    auto_connect: true,
    permission_level: "surprise",
  });

  assert.equal(server.id, "server-1");
  assert.equal(server.url, "https://mcp.example.test/mcp");
  assert.deepEqual(server.headers, { Authorization: "[REDACTED]" });
  assert.equal(server.headers_configured, true);
  assert.equal(server.permission_level, "confirm");
  assert.deepEqual(await handlers.listServers(), [server]);
  assert.deepEqual(store.calls.addServer[0].headers, { Authorization: "Bearer test-token" });
  assert.deepEqual(manager.calls.connect, [
    {
      id: server.id,
      name: "Remote MCP",
      transport: "http",
      url: "https://mcp.example.test/mcp",
      headers: { Authorization: "Bearer test-token" },
      command: null,
      args: [],
      enabled: true,
      auto_connect: true,
      permission_level: "confirm",
      serverId: server.id,
    },
  ]);
  assert.deepEqual(manager.calls.listTools, [server.id]);
  assert.deepEqual(sentEvents, [
    {
      channel: "mcp:status-changed",
      payload: {
        type: "mcp",
        action: "add",
        serverId: server.id,
      },
    },
  ]);
});

test("add handler accepts Streamable HTTP transport aliases", async () => {
  const store = createMockStore();
  const handlers = createMCPHandlers({
    serverStore: store,
    mcpClientManager: createMockClientManager(),
  });

  const server = await handlers.addServer(null, {
    name: "Streamable MCP",
    transport: "streamable",
    url: "https://streamable.example.test/mcp",
  });

  assert.equal(server.transport, "http");
  assert.deepEqual(store.calls.addServer, [
    {
      args: [],
      auto_connect: false,
      enabled: true,
      name: "Streamable MCP",
      permission_level: "confirm",
      transport: "http",
      url: "https://streamable.example.test/mcp",
      headers: {},
    },
  ]);
});

test("remove disconnects before deleting and tolerates stale client cleanup", async () => {
  const events = [];
  const store = createMockStore([HTTP_SERVER], { events });
  const manager = createMockClientManager({ events });
  const handlers = createMCPHandlers({ serverStore: store, mcpClientManager: manager });

  const removed = await handlers.removeServer(null, "remote");

  assert.deepEqual(removed, { serverId: "remote", removed: true });
  assert.deepEqual(events, ["disconnect:remote", "remove:remote"]);
  assert.equal(await store.getServer("remote"), null);

  const disconnectError = new MCPError("disconnect failed", { serverName: "local" });
  const blockedStore = createMockStore([STDIO_SERVER], { events: [] });
  const blockedManager = createMockClientManager({
    disconnectError,
    events: [],
  });
  const blockedHandlers = createMCPHandlers({
    serverStore: blockedStore,
    mcpClientManager: blockedManager,
  });

  assert.deepEqual(await blockedHandlers.removeServer(null, "local"), {
    serverId: "local",
    removed: true,
  });
  assert.deepEqual(blockedManager.calls.disconnect, ["local"]);
  assert.deepEqual(blockedStore.calls.removeServer, ["local"]);
  assert.equal(await blockedStore.getServer("local"), null);
});

test("update validates merged server configs before persisting", async () => {
  const store = createMockStore([HTTP_SERVER]);
  const handlers = createMCPHandlers({
    serverStore: store,
    mcpClientManager: createMockClientManager(),
  });

  await assert.rejects(
    handlers.updateServer(null, "remote", { url: null }),
    /MCP Streamable HTTP servers require a url/,
  );
  await assert.rejects(
    handlers.updateServer(null, "remote", { transport: "stdio" }),
    /MCP stdio servers require a command/,
  );
  assert.deepEqual(store.calls.updateServer, []);

  const updated = await handlers.updateServer(null, {
    id: "remote",
    updates: {
      name: "Local MCP",
      transport: "stdio",
      command: "node",
      args: ["server.js"],
      enabled: false,
      headers: { "X-MCP-Team": "Wave19" },
    },
  });

  assert.equal(updated.id, "remote");
  assert.equal(updated.name, "Local MCP");
  assert.equal(updated.transport, "stdio");
  assert.equal(updated.command, "node");
  assert.deepEqual(updated.args, ["server.js"]);
  assert.deepEqual(updated.headers, {});
  assert.equal(updated.enabled, false);
});

test("update redacts existing headers when no fields change", async () => {
  const store = createMockStore([
    {
      ...HTTP_SERVER,
      headers: { Authorization: "Bearer persisted-token" },
    },
  ]);
  const handlers = createMCPHandlers({
    serverStore: store,
    mcpClientManager: createMockClientManager(),
  });

  const unchanged = await handlers.updateServer(null, { id: "remote", updates: {} });

  assert.deepEqual(unchanged.headers, { Authorization: "[REDACTED]" });
  assert.equal(unchanged.headers_configured, true);
});

test("connect/list-tools/get-status use configured servers and propagate client errors", async () => {
  const store = createMockStore([HTTP_SERVER, STDIO_SERVER]);
  const manager = createMockClientManager({
    tools: TOOLS,
    status: {
      local: {
        serverId: "local",
        name: "Local MCP",
        transport: "stdio",
        connected: true,
        toolCount: 3,
      },
    },
  });
  const handlers = createMCPHandlers({ serverStore: store, mcpClientManager: manager });

  const connected = await handlers.connect(null, { serverId: "remote" });

  assert.deepEqual(connected, {
    serverId: "remote",
    name: "Remote MCP",
    transport: "http",
    connected: true,
    toolCount: 1,
  });
  assert.deepEqual(await handlers.listTools(null, "remote"), TOOLS);
  assert.deepEqual(handlers.getStatus(), {
    remote: {
      serverId: "remote",
      name: "Remote MCP",
      transport: "http",
      enabled: true,
      auto_connect: false,
      connected: true,
      toolCount: 1,
    },
    local: {
      serverId: "local",
      name: "Local MCP",
      transport: "stdio",
      enabled: true,
      auto_connect: false,
      connected: true,
      toolCount: 3,
    },
  });

  const connectError = new MCPError("connect failed", { serverName: "remote" });
  const failingHandlers = createMCPHandlers({
    serverStore: createMockStore([HTTP_SERVER]),
    mcpClientManager: createMockClientManager({ connectError }),
  });
  await assert.rejects(failingHandlers.connect(null, "remote"), connectError);

  const secretError = new MCPError("connect failed Authorization: Bearer connect-secret-token", {
    serverName: "remote",
    transport: "http",
  });
  const secretHandlers = createMCPHandlers({
    serverStore: createMockStore([HTTP_SERVER]),
    mcpClientManager: createMockClientManager({ connectError: secretError }),
  });
  await assert.rejects(secretHandlers.connect(null, "remote"), {
    message: "connect failed Authorization: [redacted]",
  });

  const directListError = new MCPError("list failed Authorization: Bearer direct-list-token", {
    serverName: "remote",
    transport: "http",
  });
  const directListHandlers = createMCPHandlers({
    serverStore: createMockStore([HTTP_SERVER]),
    mcpClientManager: createMockClientManager({ listToolsError: directListError }),
  });
  await assert.rejects(directListHandlers.listTools(null, "remote"), {
    message: "list failed Authorization: [redacted]",
  });
});

test("connect disconnects again if post-connect tool listing fails", async () => {
  const store = createMockStore([HTTP_SERVER]);
  const listToolsError = new MCPError("list failed", { serverName: "remote" });
  const manager = createMockClientManager({ listToolsError });
  const handlers = createMCPHandlers({ serverStore: store, mcpClientManager: manager });

  await assert.rejects(handlers.connect(null, "remote"), listToolsError);

  assert.deepEqual(
    manager.calls.connect.map((config) => config.serverId),
    ["remote"],
  );
  assert.deepEqual(manager.calls.disconnect, ["remote"]);
});

test("disconnect returns connection state without requiring a configured server", async () => {
  const manager = createMockClientManager({ disconnectResult: true });
  const handlers = createMCPHandlers({
    serverStore: createMockStore(),
    mcpClientManager: manager,
  });

  assert.deepEqual(await handlers.disconnect(null, { id: "remote" }), {
    serverId: "remote",
    disconnected: true,
  });
  assert.deepEqual(manager.calls.disconnect, ["remote"]);
});

test("test-connection uses a temporary client manager and returns success/failure details", async () => {
  const tempManager = createMockClientManager({ tools: TOOLS });
  const handlers = createMCPHandlers({
    serverStore: createMockStore(),
    mcpClientManager: createMockClientManager(),
    createTempClientManager: () => tempManager,
    now: createNow([100, 134]),
  });

  const result = await handlers.testConnection(null, {
    transport: "http",
    url: "https://mcp.example.test/mcp",
    headers: { Authorization: "Bearer temporary-token" },
  });

  assert.deepEqual(result, {
    reachable: true,
    toolCount: 1,
    latencyMs: 34,
  });
  assert.deepEqual(tempManager.calls.connect, [
    {
      id: "mcp-test-connection",
      serverId: "mcp-test-connection",
      name: "Temporary MCP server",
      transport: "http",
      url: "https://mcp.example.test/mcp",
      headers: { Authorization: "Bearer temporary-token" },
      args: [],
      enabled: true,
      auto_connect: false,
      permission_level: "confirm",
    },
  ]);
  assert.deepEqual(tempManager.calls.disconnect, ["mcp-test-connection", "mcp-test-connection"]);

  const failure = new MCPError("probe refused Authorization: Bearer temporary-token", {
    serverName: "mcp-test-connection",
  });
  const failureHandlers = createMCPHandlers({
    serverStore: createMockStore(),
    mcpClientManager: createMockClientManager(),
    createTempClientManager: () => createMockClientManager({ connectError: failure }),
    now: createNow([200, 211]),
  });

  assert.deepEqual(
    await failureHandlers.testConnection(null, {
      name: "Remote MCP",
      transport: "http",
      url: "https://mcp.example.test/mcp",
    }),
    {
      reachable: false,
      error: "probe refused Authorization: [redacted]",
      latencyMs: 11,
    },
  );
});

test("test-connection fails closed on timeout", async () => {
  const hangingManager = {
    calls: { disconnect: [] },
    connect() {
      return new Promise(() => {});
    },
    async disconnect(serverId) {
      this.calls.disconnect.push(serverId);
      return false;
    },
    async listTools() {
      return TOOLS;
    },
    getStatus() {
      return {};
    },
  };
  const handlers = createMCPHandlers({
    serverStore: createMockStore(),
    mcpClientManager: createMockClientManager(),
    createTempClientManager: () => hangingManager,
    timeoutMs: 5,
    now: createNow([500, 529]),
  });

  const result = await handlers.testConnection(null, {
    name: "Remote MCP",
    transport: "http",
    url: "https://mcp.example.test/mcp",
  });

  assert.equal(result.reachable, false);
  assert.equal(result.latencyMs, 29);
  assert.match(result.error, /timed out after 5ms/);
  assert.deepEqual(hangingManager.calls.disconnect, ["mcp-test-connection"]);
});

test("serializeMCPIpcError preserves structured MCP error details with secret redaction", () => {
  const error = new MCPError("failed with sk-secretsecretsecret", {
    serverName: "remote",
    transport: "http",
  });

  const serialized = serializeMCPIpcError(error);

  assert.equal(serialized.name, "MCPError");
  assert.equal(serialized.serverName, "remote");
  assert.equal(serialized.transport, "http");
  assert.equal(serialized.message.includes("sk-secretsecretsecret"), false);
});

function createMockStore(initialServers = [], options = {}) {
  const servers = new Map(initialServers.map((server) => [server.id, clone(server)]));
  let counter = servers.size;
  const calls = {
    listServers: 0,
    addServer: [],
    removeServer: [],
    updateServer: [],
    getServer: [],
  };
  const events = options.events;

  return {
    calls,
    listServers() {
      calls.listServers += 1;
      return Array.from(servers.values()).map(clone);
    },
    addServer(config) {
      calls.addServer.push(clone(config));
      const id = config.id ?? `server-${++counter}`;
      const server = {
        id,
        name: config.name,
        transport: config.transport,
        url: config.url ?? null,
        headers: clone(config.headers ?? {}),
        command: config.command ?? null,
        args: [...(config.args ?? [])],
        enabled: config.enabled !== false,
        auto_connect: config.auto_connect === true,
        permission_level: config.permission_level ?? "confirm",
      };
      servers.set(id, server);
      return clone(server);
    },
    removeServer(id) {
      events?.push(`remove:${id}`);
      calls.removeServer.push(id);
      return servers.delete(id);
    },
    updateServer(id, updates) {
      calls.updateServer.push({ id, updates: clone(updates) });
      const existing = servers.get(id);
      if (!existing) {
        return null;
      }
      const updated = { ...existing, ...clone(updates) };
      servers.set(id, updated);
      return clone(updated);
    },
    getServer(id) {
      calls.getServer.push(id);
      return clone(servers.get(id) ?? null);
    },
  };
}

function createMockClientManager(options = {}) {
  const calls = {
    connect: [],
    disconnect: [],
    listTools: [],
    getStatus: 0,
  };
  const status = clone(options.status ?? {});
  const events = options.events;

  return {
    calls,
    async connect(config) {
      calls.connect.push(clone(config));
      if (options.connectError) {
        throw options.connectError;
      }
      status[config.serverId] = {
        serverId: config.serverId,
        name: config.name,
        transport: config.transport,
        connected: true,
        toolCount: Array.isArray(options.tools) ? options.tools.length : 0,
      };
      return status[config.serverId];
    },
    async disconnect(serverId) {
      events?.push(`disconnect:${serverId}`);
      calls.disconnect.push(serverId);
      if (options.disconnectError) {
        throw options.disconnectError;
      }
      const wasConnected = status[serverId]?.connected === true;
      delete status[serverId];
      return options.disconnectResult ?? wasConnected;
    },
    async listTools(serverId) {
      calls.listTools.push(serverId);
      if (options.listToolsError) {
        throw options.listToolsError;
      }
      const tools = Array.isArray(options.tools) ? options.tools : [];
      if (status[serverId]) {
        status[serverId].toolCount = tools.length;
      }
      return tools;
    },
    getStatus() {
      calls.getStatus += 1;
      return clone(status);
    },
  };
}

function createNow(values) {
  const queue = [...values];
  return () => queue.shift() ?? values.at(-1) ?? 0;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}
