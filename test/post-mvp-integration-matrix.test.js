import assert from "node:assert/strict";
import { constants as fsConstants } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { MCPClientManager } from "../src/mcp/client-manager.js";
import { createComposioIntegrationService } from "../src/mcp/composio-integration.js";
import { namespaceMCPTool } from "../src/mcp/schema-converter.js";
import { ServerStore } from "../src/mcp/server-store.js";
import { isOsPermissionGranted } from "../src/os-permissions.js";
import {
  detectAppleCalendarAccessStatus,
  detectFullDiskAccessStatus,
} from "../src/os-permissions-main.js";
import {
  createPermissionConfirmationState,
  getMCPToolPermissionRequest,
  getToolPermissionRequest,
  shouldRequireToolConfirmation,
} from "../src/realtime/tool-permissions.js";
import { closeDatabase } from "../src/realtime/tools/database.js";
import { executeFileSystemTool } from "../src/realtime/tools/filesystem-tools.js";
import { executeRealtimeTool, getRealtimeToolDefinitions } from "../src/realtime/tools/index.js";

const MATRIX_ARTIFACT = "tasks/artifacts/post-mvp-integration-test-matrix.md";
const TOOL_NAME = "create_event";
const FIXED_NOW = Date.parse("2026-06-04T05:30:00.000Z");
const TEST_SECRET_CODEC = Object.freeze({
  protect(value) {
    return Buffer.from(String(value), "utf8").toString("base64");
  },
  reveal(value) {
    return Buffer.from(String(value), "base64").toString("utf8");
  },
});

test("post-MVP integration matrix artifact maps day-one integrations to automated anchors", async () => {
  const artifact = await readFile(MATRIX_ARTIFACT, "utf8");
  const requiredRows = [
    "Composio",
    "Custom MCP",
    "Mac access",
    "Full Disk Access",
    "Apple Calendar",
    "File access",
    "Central permission confirmations",
  ];
  const requiredColumns = [
    "Integration",
    "Happy path",
    "Missing credential",
    "Denied permission",
    "Unknown or stale status",
    "Write-confirmation case",
    "Automated anchors",
  ];

  assert.match(artifact, /^# Post-MVP Integration Test Matrix/m);
  for (const column of requiredColumns) {
    assert.match(artifact, new RegExp(escapeRegExp(column)));
  }
  for (const row of requiredRows) {
    assert.match(artifact, new RegExp(`\\| ${escapeRegExp(row)} \\|`));
  }
  for (const anchor of [
    "test/post-mvp-integration-matrix.test.js",
    "test/mcp-integration.test.js",
    "test/mcp-permission-gate.test.js",
    "test/os-permissions.test.js",
    "test/filesystem-tools.test.js",
    "test/tool-permissions.test.js",
  ]) {
    assert.match(artifact, new RegExp(escapeRegExp(anchor)));
  }
  assert.match(artifact, /No automated row requires real Composio credentials/);
  assert.match(artifact, /Unknown and stale states are expected to fail closed/);
});

test("Composio refresh uses mocked MCP, requires credentials, and stale metadata fails closed", async () => {
  await withIntegrationStore(async (storePath) => {
    let now = FIXED_NOW;
    const settingsStore = createSettingsStore();
    const store = new ServerStore({ storePath, secretCodec: TEST_SECRET_CODEC });
    const { manager, state } = createMockMCPManager({
      tools: [
        createMCPTool({
          properties: {
            title: { type: "string" },
            filePath: { type: "string" },
          },
        }),
      ],
      callToolResult: [{ type: "text", text: "Created by Composio MCP" }],
    });
    const service = createComposioIntegrationService({
      storePath,
      serverStore: store,
      mcpClientManager: manager,
      settingsStore,
      loadCredential: () => "fake-composio-api-key",
      createComposioClient: () => ({
        async createSession({ toolkits, userId }) {
          return {
            sessionId: "trs_matrix",
            userId,
            mcp: {
              url: "https://composio.example.test/tool-router/mcp",
              headers: { "X-Composio-Session": `session:${toolkits.join(",")}` },
            },
          };
        },
      }),
      now: () => now,
    });
    const missingCredentialService = createComposioIntegrationService({
      storePath,
      serverStore: store,
      mcpClientManager: manager,
      settingsStore: createSettingsStore(),
      loadCredential: () => "",
      createComposioClient: () => ({ async createSession() {} }),
      now: () => now,
    });

    assert.equal(missingCredentialService.getStatus().refreshStatus, "missing_credential");
    await assert.rejects(
      () => missingCredentialService.refreshTools({ toolkits: ["gmail"] }),
      /credential is required/i,
    );

    const refreshed = await service.refreshTools({ toolkits: ["gmail"] });
    const namespacedTool = namespaceMCPTool(refreshed.serverId, TOOL_NAME);

    assert.equal(refreshed.connected, true);
    assert.deepEqual(state.httpTransports[0].options, {
      requestInit: { headers: { "X-Composio-Session": "session:gmail" } },
    });
    assert.equal(service.getStatus().refreshStatus, "ready");
    assert.equal(service.getPermissionServerConfig(refreshed.serverId).tools.length, 1);

    const permissionRequests = [];
    assert.deepEqual(
      await executeRealtimeTool(
        namespacedTool,
        { title: "Planning", filePath: "event.ics" },
        {
          mcp: {
            clientManager: manager,
            getServerConfig: (serverId) => service.getPermissionServerConfig(serverId),
          },
          requestPermission: async (request) => {
            permissionRequests.push(request);
            return { approved: true };
          },
        },
      ),
      { status: "ok", result: "Created by Composio MCP" },
    );
    assert.equal(permissionRequests.length, 1);
    assert.equal(permissionRequests[0].level, "write");
    assert.equal(permissionRequests[0].summary, "title: Planning, filePath: event.ics");
    assert.deepEqual(state.callToolCalls, [
      { name: TOOL_NAME, arguments: { title: "Planning", filePath: "event.ics" } },
    ]);

    const denied = await executeRealtimeTool(
      namespacedTool,
      { title: "Denied", filePath: "denied.ics" },
      {
        mcp: {
          clientManager: manager,
          getServerConfig: (serverId) => service.getPermissionServerConfig(serverId),
        },
        requestPermission: async () => ({ approved: false }),
      },
    );
    assert.equal(denied.status, "permission_denied");
    assert.equal(state.callToolCalls.length, 1);

    now += 7 * 60 * 60 * 1000;
    const staleConfig = service.getPermissionServerConfig(refreshed.serverId);
    assert.deepEqual(staleConfig.tools, []);
    assert.deepEqual(
      await executeRealtimeTool(
        namespacedTool,
        { title: "Stale" },
        {
          mcp: {
            clientManager: manager,
            getServerConfig: () => staleConfig,
          },
          requestPermission: async () => ({ approved: true }),
        },
      ),
      {
        status: "permission_denied",
        message: "Leena blocked MCP tool because its permission metadata is unknown or stale.",
        tool: namespacedTool,
        permission: {
          toolName: namespacedTool,
          label: "MCP tool",
          level: "unknown",
          description: "MCP tool requires confirmation.",
          summary: "title: Stale",
        },
      },
    );
  });
});

test("Custom MCP lifecycle exposes namespaced tools and blocks stale write metadata", async () => {
  const { manager, state } = createMockMCPManager({
    tools: [
      createMCPTool({
        properties: {
          title: { type: "string" },
          path: { type: "string" },
        },
      }),
    ],
    callToolResult: [{ type: "text", text: "MCP ok" }],
  });
  const httpServer = {
    serverId: "calendar",
    name: "Calendar MCP",
    transport: "http",
    url: "https://calendar.example.test/mcp",
    permission_level: "confirm",
  };
  const stdioServer = {
    ...httpServer,
    transport: "stdio",
    command: "node",
    args: ["calendar-mcp.js"],
  };
  const namespacedTool = namespaceMCPTool(httpServer.serverId, TOOL_NAME);

  await manager.connect(httpServer);
  assert.equal(state.clients[0].closed, false);
  assert.equal(String(state.httpTransports[0].url), "https://calendar.example.test/mcp");
  assert.ok(
    (await getRealtimeToolDefinitions(manager)).some((tool) => tool.name === namespacedTool),
  );

  await manager.connect(stdioServer);
  assert.equal(state.clients[0].closed, true);
  assert.equal(state.stdioTransports.length, 1);
  assert.equal(manager.getStatus().calendar.transport, "stdio");

  const staleRequest = getMCPToolPermissionRequest(
    namespacedTool,
    { path: "notes.md" },
    {
      ...stdioServer,
      tools: [createMCPTool({ name: "old_event", properties: { path: { type: "string" } } })],
    },
  );
  assert.equal(staleRequest.level, "unknown");
  assert.deepEqual(createPermissionConfirmationState(staleRequest), {
    state: "blocked",
    toolName: namespacedTool,
    label: "MCP tool",
    level: "unknown",
    source: "mcp",
    title: "Blocked MCP tool",
    message: "Leena could not verify current, central permission metadata for this tool.",
    description: "MCP tool requires confirmation.",
    summary: "path: notes.md",
    actions: [{ id: "refresh_permissions", label: "Refresh permissions", kind: "secondary" }],
    affordances: { trustIntegration: false, trustedWriteMode: false },
  });

  assert.equal(await manager.disconnect(httpServer.serverId), true);
  assert.equal(manager.getStatus().calendar, undefined);
});

test("Mac access, Full Disk Access, and Apple Calendar statuses use fakes and fail closed", async () => {
  assert.equal(
    await detectFullDiskAccessStatus({
      platform: "darwin",
      probePaths: ["/Users/test/Library/Mail"],
      access: async (_probePath, mode) => {
        assert.equal(mode, fsConstants.R_OK);
      },
    }),
    "granted",
  );
  assert.equal(
    await detectFullDiskAccessStatus({
      platform: "darwin",
      probePaths: ["/Users/test/Library/Mail"],
      access: async () => {
        throw createFsError("EPERM", "protected");
      },
    }),
    "denied",
  );
  const fullDiskUnknown = await detectFullDiskAccessStatus({
    platform: "darwin",
    probePaths: ["/Users/test/Library/Missing"],
    access: async () => {
      throw createFsError("ENOENT", "missing");
    },
  });
  assert.equal(fullDiskUnknown, "unknown");
  assert.equal(isOsPermissionGranted(fullDiskUnknown), false);

  assert.equal(
    await detectAppleCalendarAccessStatus({
      platform: "darwin",
      dbPaths: ["/tmp/TCC.db"],
      execFile: async () => ({
        stdout: "kTCCServiceCalendarFullAccess|com.leena.app|0|2\n",
      }),
    }),
    "granted",
  );
  assert.equal(
    await detectAppleCalendarAccessStatus({
      platform: "darwin",
      dbPaths: ["/tmp/TCC.db"],
      execFile: async () => ({
        stdout: "kTCCServiceCalendar|com.leena.app|0|0\n",
      }),
    }),
    "denied",
  );
  const writeOnly = await detectAppleCalendarAccessStatus({
    platform: "darwin",
    dbPaths: ["/tmp/TCC.db"],
    execFile: async () => ({
      stdout: "kTCCServiceCalendarWriteOnly|com.leena.app|0|2\n",
    }),
  });
  assert.equal(writeOnly, "restricted");
  assert.equal(isOsPermissionGranted(writeOnly), false);
  assert.equal(
    await detectAppleCalendarAccessStatus({
      platform: "darwin",
      dbPaths: ["/tmp/TCC.db"],
      execFile: async () => {
        throw createFsError("EACCES", "TCC denied");
      },
    }),
    "unknown",
  );

  const macControlRequest = getToolPermissionRequest("computer_use_task", {
    target: "computer",
    task: "Open System Settings",
  });
  assert.equal(macControlRequest.level, "destructive");
  assert.equal(
    shouldRequireToolConfirmation("computer_use_task", {
      target: "computer",
      task: "Open System Settings",
    }),
    true,
  );
  assert.equal(
    createPermissionConfirmationState(macControlRequest, { status: "unknown" }).state,
    "blocked",
  );
});

test("File access allows trusted reads but gates writes and broad unknown access", async () => {
  await withTempDir(async (rootPath) => {
    await writeFile(path.join(rootPath, "notes.txt"), "safe note", "utf8");
    const options = { rootPath };

    assert.deepEqual(await executeFileSystemTool("read_file", { path: "notes.txt" }, options), {
      status: "read",
      path: "notes.txt",
      bytes: 9,
      truncated: false,
      content: "safe note",
    });
    const broadUnknown = await executeFileSystemTool(
      "read_file",
      { path: "notes.txt" },
      {
        ...options,
        fileAccessScope: "full-disk",
        fullDiskAccessStatus: "unknown",
      },
    );
    assert.equal(broadUnknown.status, "permission_denied");
    assert.equal("content" in broadUnknown, false);

    assert.equal(
      (
        await executeFileSystemTool(
          "read_file",
          { path: "notes.txt" },
          {
            ...options,
            fileAccessScope: "explicit",
            fullDiskAccessStatus: "unknown",
          },
        )
      ).status,
      "read",
    );

    const pendingWrite = await executeFileSystemTool(
      "write_file",
      { path: "pending.md", content: "blocked" },
      options,
    );
    assert.equal(pendingWrite.status, "permission_pending");
    assert.equal(
      (
        await executeFileSystemTool(
          "write_file",
          { path: "model.md", content: "blocked", confirmed: true },
          options,
        )
      ).status,
      "permission_pending",
    );
    assert.equal(
      (
        await executeFileSystemTool(
          "write_file",
          { path: "approved.md", content: "allowed" },
          { ...options, confirmed: true },
        )
      ).status,
      "created",
    );
    assert.equal(
      (
        await executeFileSystemTool(
          "write_file",
          { path: "trusted.md", content: "allowed" },
          { ...options, trustedMacAccess: true, trustedWriteMode: true },
        )
      ).status,
      "created",
    );
    assert.equal(
      (
        await executeFileSystemTool(
          "write_file",
          { path: "broad.md", content: "blocked" },
          {
            ...options,
            fileAccessScope: "full-disk",
            fullDiskAccessStatus: "unknown",
            trustedMacAccess: true,
            trustedWriteMode: true,
          },
        )
      ).status,
      "permission_denied",
    );
  });
});

test("Central permission confirmations distinguish MCP, Composio, Apple Calendar, and unknown tools", () => {
  const mcpWriteRequest = getMCPToolPermissionRequest(
    namespaceMCPTool("calendar", TOOL_NAME),
    { title: "Planning", filePath: "/Users/example/private.ics" },
    {
      serverId: "calendar",
      name: "Calendar MCP",
      permission_level: "confirm",
      tools: [
        createMCPTool({
          properties: {
            title: { type: "string" },
            filePath: { type: "string" },
          },
        }),
      ],
    },
  );
  assert.equal(mcpWriteRequest.level, "write");
  const mcpState = createPermissionConfirmationState(mcpWriteRequest, {
    trustIntegrationAvailable: true,
    trustedWriteAvailable: true,
  });
  assert.equal(mcpState.state, "confirmation_required");
  assert.equal(mcpState.source, "mcp");
  assert.equal(mcpState.affordances.trustIntegration, true);
  assert.equal(mcpState.affordances.trustedWriteMode, true);

  const composioState = createPermissionConfirmationState(
    { ...mcpWriteRequest, source: "composio" },
    { trustIntegrationAvailable: true, trustedWriteAvailable: true },
  );
  assert.equal(composioState.source, "composio");
  assert.equal(composioState.affordances.trustIntegration, true);

  const appleState = createPermissionConfirmationState(
    getToolPermissionRequest("add_calendar_item", {
      source: "apple",
      title: "Planning Review",
    }),
    { trustIntegrationAvailable: true, trustedWriteAvailable: true },
  );
  assert.equal(appleState.source, "apple-calendar");
  assert.equal(appleState.state, "confirmation_required");
  assert.equal(appleState.affordances.trustIntegration, true);

  const unknownState = createPermissionConfirmationState(
    getToolPermissionRequest("unmapped_tool", {}),
    { trustIntegrationAvailable: true, trustedWriteAvailable: true },
  );
  assert.equal(unknownState.state, "blocked");
  assert.deepEqual(
    unknownState.actions.map((action) => action.id),
    ["refresh_permissions"],
  );
  assert.equal(unknownState.affordances.trustIntegration, false);
  assert.equal(unknownState.affordances.trustedWriteMode, false);
});

async function withIntegrationStore(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), "leena-post-mvp-matrix-"));
  const storePath = path.join(directory, "leena.db");
  try {
    await callback(storePath);
  } finally {
    closeDatabase(storePath);
    await rm(directory, { force: true, recursive: true });
  }
}

async function withTempDir(callback) {
  const rootPath = await mkdtemp(path.join(tmpdir(), "leena-matrix-files-"));
  try {
    await callback(rootPath);
  } finally {
    await rm(rootPath, { force: true, recursive: true });
  }
}

function createMockMCPManager({ tools = [], callToolResult = [] } = {}) {
  const state = {
    clients: [],
    httpTransports: [],
    stdioTransports: [],
    callToolCalls: [],
    tools,
    callToolResult,
  };

  class MockClient {
    constructor() {
      this.closed = false;
      this.transport = null;
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
      return { content: state.callToolResult };
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
    constructor(options) {
      this.options = options;
      this.closed = false;
      state.stdioTransports.push(this);
    }

    async close() {
      this.closed = true;
    }
  }

  return {
    manager: new MCPClientManager({
      Client: MockClient,
      StreamableHTTPClientTransport: MockHTTPTransport,
      StdioClientTransport: MockStdioTransport,
      retryOptions: {
        connect: { maxAttempts: 1, baseDelay: 0, maxDelay: 0, jitter: false },
        callTool: { maxAttempts: 1, baseDelay: 0, maxDelay: 0, jitter: false },
      },
    }),
    state,
  };
}

function createSettingsStore() {
  const values = new Map();
  return {
    getSetting(key, defaultValue) {
      return values.has(key) ? values.get(key) : defaultValue;
    },
    setSetting(key, value) {
      values.set(key, value);
      return value;
    },
    deleteSetting(key) {
      return values.delete(key);
    },
  };
}

function createMCPTool({ name = TOOL_NAME, properties = {} } = {}) {
  return {
    name,
    description: "Create calendar event",
    inputSchema: {
      type: "object",
      properties,
      required: Object.keys(properties),
    },
  };
}

function createFsError(code, message) {
  return Object.assign(new Error(message), { code });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
