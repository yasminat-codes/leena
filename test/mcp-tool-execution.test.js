import assert from "node:assert/strict";
import test from "node:test";
import { namespaceMCPTool } from "../src/mcp/schema-converter.js";
import { executeRealtimeTool, getRealtimeToolDefinitions } from "../src/realtime/tools/index.js";
import { MCPError } from "../src/utils/errors.js";

const SERVER_ID = "calendar";
const TOOL_NAME = "create_event";
const NAMESPACED_TOOL_NAME = namespaceMCPTool(SERVER_ID, TOOL_NAME);

test("getRealtimeToolDefinitions merges static and connected MCP tools", async () => {
  const manager = createMockMCPManager();

  const tools = await getRealtimeToolDefinitions(manager);

  assert.ok(tools.some((tool) => tool.name === "web_search"));
  const mcpTool = tools.find((tool) => tool.name === NAMESPACED_TOOL_NAME);
  assert.equal(mcpTool.description, "Create calendar event");
  assert.deepEqual(mcpTool.parameters.properties.title, { type: "string" });
  assert.deepEqual(manager.calls.listTools, [SERVER_ID]);
});

test("MCP execution auto-approves low-risk auto-policy tools and returns text content", async () => {
  const manager = createMockMCPManager({
    content: [
      { type: "text", text: "Created event" },
      { type: "image", data: "ignored" },
      { type: "text", text: "Visible in calendar" },
    ],
  });
  const permissionCalls = [];

  const result = await executeRealtimeTool(
    NAMESPACED_TOOL_NAME,
    { title: "Planning" },
    {
      mcp: createMCPOptions(manager),
      requestPermission: async (request) => {
        permissionCalls.push(request);
        return false;
      },
    },
  );

  assert.deepEqual(result, {
    status: "ok",
    result: "Created event\nVisible in calendar",
  });
  assert.deepEqual(permissionCalls, []);
  assert.deepEqual(manager.calls.callTool, [
    { serverId: SERVER_ID, toolName: TOOL_NAME, args: { title: "Planning" } },
  ]);
});

test("MCP execution routes confirm-policy tools through requestPermission and denies safely", async () => {
  const manager = createMockMCPManager({
    serverConfig: createServerConfig({ permission_level: "confirm" }),
  });
  const permissionCalls = [];

  const result = await executeRealtimeTool(
    NAMESPACED_TOOL_NAME,
    { title: "Planning" },
    {
      mcp: createMCPOptions(manager),
      requestPermission: async (request) => {
        permissionCalls.push(request);
        return false;
      },
    },
  );

  assert.deepEqual(result, {
    status: "permission_denied",
    message: "Ken did not approve Create calendar event. Ask before trying this tool again.",
    tool: NAMESPACED_TOOL_NAME,
  });
  assert.equal(permissionCalls.length, 1);
  assert.equal(permissionCalls[0].toolName, NAMESPACED_TOOL_NAME);
  assert.deepEqual(manager.calls.callTool, []);
});

test("MCP execution returns permission_pending when approval callback is unavailable", async () => {
  const manager = createMockMCPManager({
    serverConfig: createServerConfig({ permission_level: "confirm" }),
  });

  const result = await executeRealtimeTool(
    NAMESPACED_TOOL_NAME,
    { title: "Planning" },
    {
      mcp: createMCPOptions(manager),
    },
  );

  assert.equal(result.status, "permission_pending");
  assert.equal(result.permission.toolName, NAMESPACED_TOOL_NAME);
  assert.deepEqual(manager.calls.callTool, []);
});

test("MCP execution fails closed for malformed names and stale metadata", async () => {
  const manager = createMockMCPManager({
    serverConfig: createServerConfig({
      permission_level: "trust",
      tool: {
        name: "stale_event",
        description: "Stale event",
        inputSchema: schemaWithProperties({ title: { type: "string" } }),
      },
    }),
  });
  const permissionCalls = [];

  const malformed = await executeRealtimeTool(
    "mcp__calendar__",
    {},
    {
      mcp: createMCPOptions(manager),
      requestPermission: async (request) => {
        permissionCalls.push(request);
        return true;
      },
    },
  );
  const stale = await executeRealtimeTool(
    NAMESPACED_TOOL_NAME,
    {},
    {
      mcp: createMCPOptions(manager),
      requestPermission: async (request) => {
        permissionCalls.push(request);
        return true;
      },
    },
  );

  assert.deepEqual(malformed, {
    status: "error",
    message: "Invalid MCP tool name: mcp__calendar__",
  });
  assert.deepEqual(stale, {
    status: "permission_denied",
    message: "Ken did not approve MCP tool. Ask before trying this tool again.",
    tool: NAMESPACED_TOOL_NAME,
  });
  assert.deepEqual(permissionCalls, []);
  assert.deepEqual(manager.calls.callTool, []);
});

test("MCP execution wraps MCP call errors without crashing realtime dispatch", async () => {
  const manager = createMockMCPManager({
    callError: new MCPError("calendar server failed", { serverName: SERVER_ID }),
  });

  const result = await executeRealtimeTool(
    NAMESPACED_TOOL_NAME,
    { title: "Planning" },
    {
      mcp: createMCPOptions(manager),
    },
  );

  assert.deepEqual(result, {
    status: "error",
    message: "MCP tool failed: calendar server failed",
  });

  const secretManager = createMockMCPManager({
    callError: new MCPError("upstream failed Authorization: Bearer topsecret-token", {
      serverName: SERVER_ID,
    }),
  });

  assert.deepEqual(
    await executeRealtimeTool(
      NAMESPACED_TOOL_NAME,
      { title: "Planning" },
      {
        mcp: createMCPOptions(secretManager),
      },
    ),
    {
      status: "error",
      message: "MCP tool failed: upstream failed Authorization: [redacted]",
    },
  );
});

test("built-in dispatch remains unchanged before MCP fallback", async () => {
  const manager = createMockMCPManager({
    callError: new Error("MCP should not be called"),
  });

  const result = await executeRealtimeTool(
    "end_call",
    { reason: "Ken said goodbye" },
    { mcp: createMCPOptions(manager) },
  );

  assert.deepEqual(result, {
    status: "call_ended",
    message: "Ending the call. Goodbye.",
    reason: "Ken said goodbye",
  });
  assert.deepEqual(manager.calls.callTool, []);
});

test("static definitions and unknown tools stay backward compatible without MCP manager", async () => {
  const tools = getRealtimeToolDefinitions();

  assert.ok(Array.isArray(tools));
  assert.equal(
    tools.some((tool) => tool.name.startsWith("mcp__")),
    false,
  );
  assert.deepEqual(await executeRealtimeTool("missing_tool", {}), {
    status: "error",
    message: "Unknown realtime tool: missing_tool",
  });
  assert.deepEqual(await executeRealtimeTool(NAMESPACED_TOOL_NAME, {}), {
    status: "error",
    message: "MCP tool unavailable: missing MCP client manager.",
  });
});

function createMockMCPManager({
  serverConfig = createServerConfig(),
  content = [{ type: "text", text: "Created event" }],
  callError,
} = {}) {
  const calls = {
    callTool: [],
    getServerConfig: [],
    listTools: [],
  };
  return {
    calls,
    serverConfig,
    getStatus() {
      return {
        [SERVER_ID]: { connected: true },
      };
    },
    async listTools(serverId) {
      calls.listTools.push(serverId);
      return serverConfig.tools;
    },
    async callTool(serverId, toolName, args) {
      calls.callTool.push({ serverId, toolName, args });
      if (callError) {
        throw callError;
      }
      return content;
    },
  };
}

function createMCPOptions(manager) {
  return {
    clientManager: manager,
    async getServerConfig(serverId) {
      manager.calls.getServerConfig.push(serverId);
      return manager.serverConfig;
    },
  };
}

function createServerConfig({
  permission_level = "auto",
  tool = {
    name: TOOL_NAME,
    description: "Create calendar event",
    inputSchema: schemaWithProperties({ title: { type: "string" } }),
  },
} = {}) {
  return {
    serverId: SERVER_ID,
    name: "Calendar",
    permission_level,
    tools: [tool],
  };
}

function schemaWithProperties(properties) {
  return {
    type: "object",
    properties,
  };
}
