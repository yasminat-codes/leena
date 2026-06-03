import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { MCPClientManager } from "../src/mcp/client-manager.js";
import { namespaceMCPTool } from "../src/mcp/schema-converter.js";
import { ServerStore } from "../src/mcp/server-store.js";
import { closeDatabase } from "../src/realtime/tools/database.js";
import { executeRealtimeTool, getRealtimeToolDefinitions } from "../src/realtime/tools/index.js";

const TOOL_NAME = "create_event";

test("MCP end-to-end flow stores, connects, merges, gates, executes, and disconnects", async () => {
  await withIntegrationStore(async (storePath) => {
    const store = new ServerStore({ storePath });
    const storedServer = store.addServer({
      name: "Calendar MCP",
      transport: "http",
      url: "https://calendar.example.test/mcp",
      permission_level: "confirm",
    });
    const namespacedToolName = namespaceMCPTool(storedServer.id, TOOL_NAME);
    const { manager, state } = createIntegrationManager({
      tools: [createCalendarTool()],
      callToolResult: {
        content: [
          { type: "text", text: "Created event" },
          { type: "image", data: "ignored" },
          { type: "text", text: "Visible in calendar" },
        ],
      },
    });

    await manager.connect(storedServer);

    const mergedTools = await getRealtimeToolDefinitions(manager);
    const mcpTool = mergedTools.find((tool) => tool.name === namespacedToolName);
    assert.equal(mcpTool.description, "Create calendar event");
    assert.deepEqual(mcpTool.parameters.properties.title, { type: "string" });

    const permissionRequests = [];
    const result = await executeRealtimeTool(
      namespacedToolName,
      { title: "Planning" },
      {
        mcp: {
          clientManager: manager,
          getServerConfig: (serverId) => getPermissionServerConfig(store, manager, serverId),
        },
        requestPermission: async (request) => {
          permissionRequests.push(request);
          return { approved: true };
        },
      },
    );

    assert.deepEqual(result, {
      status: "ok",
      result: "Created event\nVisible in calendar",
    });
    assert.equal(permissionRequests.length, 1);
    assert.equal(permissionRequests[0].toolName, namespacedToolName);
    assert.match(permissionRequests[0].description, /Calendar MCP/);
    assert.deepEqual(state.callToolCalls, [
      {
        name: TOOL_NAME,
        arguments: { title: "Planning" },
      },
    ]);

    assert.equal(await manager.disconnect(storedServer.id), true);
    const afterDisconnectTools = await getRealtimeToolDefinitions(manager);
    assert.equal(
      afterDisconnectTools.some((tool) => tool.name === namespacedToolName),
      false,
    );
  });
});

test("MCP integration keeps built-in tools ahead of MCP fallback", async () => {
  const manager = {
    async callTool() {
      throw new Error("MCP manager should not receive built-in tool calls");
    },
  };

  const result = await executeRealtimeTool(
    "end_call",
    { reason: "Ken said goodbye" },
    { mcp: { clientManager: manager } },
  );

  assert.deepEqual(result, {
    status: "call_ended",
    message: "Ending the call. Goodbye.",
    reason: "Ken said goodbye",
  });
});

test("MCP integration tolerates malformed tool content without throwing", async () => {
  await withIntegrationStore(async (storePath) => {
    const store = new ServerStore({ storePath });
    const storedServer = store.addServer({
      name: "Calendar MCP",
      transport: "http",
      url: "https://calendar.example.test/mcp",
      permission_level: "trust",
    });
    const namespacedToolName = namespaceMCPTool(storedServer.id, TOOL_NAME);
    const { manager } = createIntegrationManager({
      tools: [createCalendarTool()],
      callToolResult: {
        content: { type: "text", text: "malformed" },
      },
    });

    await manager.connect(storedServer);

    const result = await executeRealtimeTool(
      namespacedToolName,
      { title: "Planning" },
      {
        mcp: {
          clientManager: manager,
          getServerConfig: (serverId) => getPermissionServerConfig(store, manager, serverId),
        },
      },
    );

    assert.deepEqual(result, {
      status: "ok",
      result: "",
    });
  });
});

async function withIntegrationStore(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), "leena-mcp-integration-"));
  const storePath = path.join(directory, "lena.db");
  try {
    await callback(storePath);
  } finally {
    closeDatabase(storePath);
    await rm(directory, { force: true, recursive: true });
  }
}

async function getPermissionServerConfig(store, manager, serverId) {
  const storedServer = store.getServer(serverId);
  const tools = await manager.listTools(serverId);
  return {
    ...(storedServer ?? {}),
    serverId: storedServer?.id ?? serverId,
    name: storedServer?.name ?? serverId,
    permission_level: storedServer?.permission_level ?? "confirm",
    tools,
  };
}

function createIntegrationManager({ tools, callToolResult }) {
  const state = {
    clients: [],
    httpTransports: [],
    callToolCalls: [],
    tools,
    callToolResult,
  };

  class MockClient {
    constructor() {
      this.transport = null;
      this.closed = false;
      state.clients.push(this);
    }

    async connect(transport) {
      this.transport = transport;
    }

    async listTools() {
      return { tools: state.tools };
    }

    async callTool(params) {
      state.callToolCalls.push(params);
      return state.callToolResult;
    }

    async close() {
      this.closed = true;
      await this.transport?.close?.();
    }
  }

  class MockHTTPTransport {
    constructor(url, options) {
      this.url = url;
      this.options = options;
      this.closed = false;
      state.httpTransports.push(this);
    }

    async close() {
      this.closed = true;
    }
  }

  class MockStdioTransport {
    async close() {}
  }

  return {
    manager: new MCPClientManager({
      Client: MockClient,
      StreamableHTTPClientTransport: MockHTTPTransport,
      StdioClientTransport: MockStdioTransport,
      retryOptions: {
        connect: { baseDelay: 0, maxDelay: 0, jitter: false },
        callTool: { baseDelay: 0, maxDelay: 0, jitter: false },
      },
    }),
    state,
  };
}

function createCalendarTool() {
  return {
    name: TOOL_NAME,
    description: "Create calendar event",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
      },
      required: ["title"],
    },
  };
}
