import assert from "node:assert/strict";
import test from "node:test";
import { MCPClientManager } from "../src/mcp/client-manager.js";
import { MCPError, RetryExhaustedError } from "../src/utils/errors.js";

const DEFAULT_TOOLS = [
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
  {
    name: "draft",
    description: undefined,
    inputSchema: undefined,
  },
];

test("connects, lists tools, calls tools, and disconnects HTTP transports", async () => {
  const { manager, state } = createMockManager();

  const status = await manager.connect({
    id: "remote",
    name: "Remote tools",
    transport: "http",
    url: "https://mcp.example.test/mcp",
    headers: { "X-Test": "yes" },
  });

  assert.deepEqual(status, {
    serverId: "remote",
    name: "Remote tools",
    transport: "http",
    connected: true,
    toolCount: 0,
  });
  assert.equal(state.clients[0].clientInfo.name, "leena-mcp-client");
  assert.equal(state.httpTransports[0].url.href, "https://mcp.example.test/mcp");
  assert.deepEqual(state.httpTransports[0].options, {
    requestInit: { headers: { "X-Test": "yes" } },
  });

  const tools = await manager.listTools("remote");
  assert.deepEqual(tools, [
    DEFAULT_TOOLS[0],
    {
      name: "draft",
      description: "",
      inputSchema: {},
    },
  ]);
  assert.equal(manager.getStatus().remote.toolCount, 2);

  const content = await manager.callTool("remote", "search", { query: "inbox" });
  assert.deepEqual(content, [{ type: "text", text: "done" }]);
  assert.deepEqual(state.callToolCalls, [
    {
      name: "search",
      arguments: { query: "inbox" },
    },
  ]);

  assert.equal(await manager.disconnect("remote"), true);
  assert.deepEqual(manager.getStatus(), {});
  assert.equal(state.clients[0].closeCount, 1);
  assert.equal(state.httpTransports[0].closeCount, 1);
});

test("connects, lists tools, calls tools, and disconnects stdio transports", async () => {
  const { manager, state } = createMockManager();

  await manager.connect({
    serverId: "local",
    label: "Local tools",
    transport: "stdio",
    command: "node",
    args: ["server.js"],
  });

  assert.deepEqual(state.stdioTransports[0].params, {
    command: "node",
    args: ["server.js"],
  });

  const tools = await manager.listTools("local");
  assert.equal(tools[0].name, "search");

  const content = await manager.callTool("local", "draft", null);
  assert.deepEqual(content, [{ type: "text", text: "done" }]);
  assert.deepEqual(state.callToolCalls, [{ name: "draft", arguments: {} }]);

  assert.equal(await manager.disconnect("local"), true);
  assert.equal(state.clients[0].closeCount, 1);
  assert.equal(state.stdioTransports[0].closeCount, 1);
  assert.equal(state.stdioTransports[0].processKilled, true);
});

test("retries transient connection failures", async () => {
  const { manager, state } = createMockManager({
    connectFailures: [retryableError("first reset"), retryableError("second reset")],
  });

  await manager.connect({
    id: "remote",
    transport: "http",
    url: "https://mcp.example.test/mcp",
  });

  assert.equal(state.connectCalls.length, 3);
  assert.equal(state.clients.length, 3);
  assert.equal(state.httpTransports.filter((transport) => transport.closed).length, 2);
});

test("does not retry tool calls by default because MCP tools may have side effects", async () => {
  const { manager, state } = createMockManager({
    callToolFailures: [retryableError("call reset")],
  });

  await manager.connect({
    id: "remote",
    transport: "http",
    url: "https://mcp.example.test/mcp",
  });

  await assert.rejects(manager.callTool("remote", "search", { query: "mail" }), (error) => {
    assert.ok(error instanceof MCPError);
    assert.equal(error.serverName, "remote");
    assert.match(error.message, /call reset/);
    return true;
  });

  assert.equal(state.callToolCalls.length, 1);
});

test("can opt into retrying idempotent tool calls", async () => {
  const { manager, state } = createMockManager({
    callToolFailures: [retryableError("call reset")],
    retryOptions: {
      callTool: { maxAttempts: 2, baseDelay: 0, maxDelay: 0, jitter: false },
    },
  });

  await manager.connect({
    id: "remote",
    transport: "http",
    url: "https://mcp.example.test/mcp",
  });

  const content = await manager.callTool("remote", "search", { query: "mail" });

  assert.deepEqual(content, [{ type: "text", text: "done" }]);
  assert.equal(state.callToolCalls.length, 2);
});

test("throws MCPError for permanent connection and tool-call failures", async () => {
  const permanentConnect = permanentError("unauthorized", 401);
  const { manager, state } = createMockManager({
    connectFailures: [permanentConnect],
  });

  await assert.rejects(
    manager.connect({
      id: "remote",
      transport: "http",
      url: "https://mcp.example.test/mcp",
    }),
    (error) => {
      assert.ok(error instanceof MCPError);
      assert.equal(error.serverName, "remote");
      assert.equal(error.transport, "http");
      assert.ok(error.cause instanceof RetryExhaustedError);
      assert.match(error.message, /unauthorized/);
      return true;
    },
  );
  assert.equal(state.connectCalls.length, 1);

  const callFailure = permanentError("bad request", 400);
  const second = createMockManager({ callToolFailures: [callFailure] });
  await second.manager.connect({
    id: "remote",
    transport: "http",
    url: "https://mcp.example.test/mcp",
  });

  await assert.rejects(second.manager.callTool("remote", "search", {}), (error) => {
    assert.ok(error instanceof MCPError);
    assert.equal(error.serverName, "remote");
    assert.equal(error.transport, "http");
    assert.ok(error.cause instanceof RetryExhaustedError);
    assert.match(error.message, /bad request/);
    return true;
  });
  assert.equal(second.state.callToolCalls.length, 1);
});

test("throws MCPError when listing or calling tools on disconnected servers", async () => {
  const { manager } = createMockManager();

  await assert.rejects(manager.listTools("missing"), (error) => {
    assert.ok(error instanceof MCPError);
    assert.equal(error.serverName, "missing");
    assert.match(error.message, /not connected/);
    return true;
  });

  await assert.rejects(manager.callTool("missing", "search", {}), (error) => {
    assert.ok(error instanceof MCPError);
    assert.equal(error.serverName, "missing");
    assert.match(error.message, /not connected/);
    return true;
  });
});

test("disconnectAll closes every connection and clears status", async () => {
  const { manager, state } = createMockManager();

  await manager.connect({
    id: "remote",
    name: "Remote tools",
    transport: "http",
    url: "https://mcp.example.test/mcp",
  });
  await manager.connect({
    id: "local",
    name: "Local tools",
    transport: "stdio",
    command: "node",
    args: ["server.js"],
  });

  await manager.disconnectAll();

  assert.deepEqual(manager.getStatus(), {});
  assert.equal(
    state.clients.every((client) => client.closed),
    true,
  );
  assert.equal(state.httpTransports[0].closed, true);
  assert.equal(state.stdioTransports[0].processKilled, true);
});

function createMockManager(overrides = {}) {
  const state = {
    clients: [],
    httpTransports: [],
    stdioTransports: [],
    connectCalls: [],
    listToolsCalls: [],
    callToolCalls: [],
    connectFailures: [...(overrides.connectFailures ?? [])],
    listToolsFailure: overrides.listToolsFailure,
    callToolFailures: [...(overrides.callToolFailures ?? [])],
    tools: overrides.tools ?? DEFAULT_TOOLS,
    callToolResult: overrides.callToolResult ?? { content: [{ type: "text", text: "done" }] },
  };

  class MockClient {
    constructor(clientInfo) {
      this.clientInfo = clientInfo;
      this.closeCount = 0;
      this.closed = false;
      this.transport = null;
      state.clients.push(this);
    }

    async connect(transport) {
      this.transport = transport;
      state.connectCalls.push({ client: this, transport });
      const failure = state.connectFailures.shift();
      if (failure) {
        throw failure;
      }
    }

    async listTools() {
      state.listToolsCalls.push(this);
      if (state.listToolsFailure) {
        throw state.listToolsFailure;
      }
      return { tools: state.tools };
    }

    async callTool(params) {
      state.callToolCalls.push(params);
      const failure = state.callToolFailures.shift();
      if (failure) {
        throw failure;
      }
      return state.callToolResult;
    }

    async close() {
      this.closeCount += 1;
      this.closed = true;
      await this.transport?.close?.();
    }
  }

  class MockHTTPTransport {
    constructor(url, options) {
      this.url = url;
      this.options = options;
      this.closeCount = 0;
      this.closed = false;
      state.httpTransports.push(this);
    }

    async close() {
      if (this.closed) {
        return;
      }
      this.closeCount += 1;
      this.closed = true;
    }
  }

  class MockStdioTransport {
    constructor(params) {
      this.params = params;
      this.closeCount = 0;
      this.closed = false;
      this.processKilled = false;
      state.stdioTransports.push(this);
    }

    async close() {
      if (this.closed) {
        return;
      }
      this.closeCount += 1;
      this.closed = true;
      this.processKilled = true;
    }
  }

  const manager = new MCPClientManager({
    Client: MockClient,
    StreamableHTTPClientTransport: MockHTTPTransport,
    StdioClientTransport: MockStdioTransport,
    retryOptions: {
      connect: { baseDelay: 0, maxDelay: 0, jitter: false },
      callTool: { baseDelay: 0, maxDelay: 0, jitter: false },
      ...(overrides.retryOptions ?? {}),
    },
  });

  return { manager, state };
}

function retryableError(message) {
  const error = new Error(message);
  error.code = "ECONNRESET";
  return error;
}

function permanentError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
