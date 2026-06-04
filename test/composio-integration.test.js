import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  COMPOSIO_IPC_CHANNELS,
  COMPOSIO_MCP_METADATA_SETTING,
  COMPOSIO_MCP_SERVER_NAME,
  createComposioIntegrationHandlers,
  createComposioIntegrationService,
} from "../src/mcp/composio-integration.js";
import { namespaceMCPTool } from "../src/mcp/schema-converter.js";
import { ServerStore } from "../src/mcp/server-store.js";
import {
  getMCPToolPermissionRequest,
  shouldAutoApproveMCPTool,
} from "../src/realtime/tool-permissions.js";
import { closeDatabase, getDatabase } from "../src/realtime/tools/database.js";
import { getRealtimeToolDefinitions } from "../src/realtime/tools/index.js";
import { ProviderError } from "../src/utils/errors.js";

const COMPOSIO_SECRET = "composio-secret-api-key-1234567890";
const COMPOSIO_HEADER = "Bearer composio-session-header-abcdef";
const REFRESH_TIME = Date.parse("2026-06-04T00:10:00.000Z");
const TEST_SECRET_CODEC = Object.freeze({
  protect(value) {
    return Buffer.from(String(value), "utf8").toString("base64");
  },
  reveal(value) {
    return Buffer.from(String(value), "base64").toString("utf8");
  },
});

test("refreshTools creates a Composio MCP server and exposes tools only through MCP namespacing", async () => {
  await withComposioStore(async ({ storePath }) => {
    const client = createMockComposioClient();
    const manager = createMockMCPManager();
    const service = createService({ storePath, client, manager, now: () => REFRESH_TIME });

    const refreshed = await service.refreshTools({ toolkits: ["Gmail", "github", "gmail"] });

    assert.equal(refreshed.ok, true);
    assert.equal(refreshed.provider, "composio");
    assert.equal(refreshed.connected, true);
    assert.equal(refreshed.serverName, COMPOSIO_MCP_SERVER_NAME);
    assert.deepEqual(refreshed.enabledToolkits, ["gmail", "github"]);
    assert.equal(refreshed.toolCount, 2);
    assert.equal(client.calls.createSession.length, 1);
    assert.deepEqual(client.calls.createSession[0], {
      userId: "leena-owner",
      toolkits: ["gmail", "github"],
    });
    assert.equal(manager.connectCalls.length, 1);
    assert.equal(manager.connectCalls[0].transport, "http");
    assert.equal(manager.connectCalls[0].headers.Authorization, COMPOSIO_HEADER);

    const storedServer = new ServerStore({ storePath, secretCodec: TEST_SECRET_CODEC }).getServer(
      refreshed.serverId,
    );
    assert.equal(storedServer.name, COMPOSIO_MCP_SERVER_NAME);
    assert.equal(storedServer.transport, "http");
    assert.equal(storedServer.auto_connect, false);
    assert.equal(storedServer.permission_level, "confirm");
    assert.equal(storedServer.url, "https://app.composio.dev/tool_router/v3/trs_mock/mcp");

    const definitions = await getRealtimeToolDefinitions(manager);
    assert.ok(
      definitions.some(
        (tool) => tool.name === namespaceMCPTool(refreshed.serverId, "GMAIL_SEND_EMAIL"),
      ),
    );
    assert.equal(
      definitions.some((tool) => tool.name === "GMAIL_SEND_EMAIL"),
      false,
    );

    const permissionConfig = service.getPermissionServerConfig(refreshed.serverId);
    new ServerStore({ storePath, secretCodec: TEST_SECRET_CODEC }).updateServer(
      refreshed.serverId,
      {
        headers: { "X-API-Key": "abcdefghijklmnopqrstuvwxyz" },
      },
    );
    const permissionConfigWithStoredHeaders = service.getPermissionServerConfig(refreshed.serverId);
    assert.equal("headers" in permissionConfigWithStoredHeaders, false);
    assert.equal(
      getMCPToolPermissionRequest(
        namespaceMCPTool(refreshed.serverId, "GITHUB_CREATE_ISSUE"),
        { url: "https://github.com/example/repo" },
        permissionConfig,
      ).level,
      "network",
    );
    assert.equal(
      shouldAutoApproveMCPTool(
        namespaceMCPTool(refreshed.serverId, "GMAIL_SEND_EMAIL"),
        { to: "ken@example.com" },
        { ...permissionConfig, permission_level: "trust" },
      ),
      true,
    );
  });
});

test("Composio refresh responses and persisted metadata do not expose credentials or MCP headers", async () => {
  await withComposioStore(async ({ storePath }) => {
    const service = createService({
      storePath,
      client: createMockComposioClient(),
      manager: createMockMCPManager(),
      now: () => REFRESH_TIME,
    });

    const refreshed = await service.refreshTools({ toolkits: ["gmail"] });
    const status = service.getStatus();
    const dbText = getDatabase(storePath)
      .prepare("SELECT group_concat(value, '\\n') AS value FROM settings")
      .get().value;
    const metadata = getDatabase(storePath)
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get(COMPOSIO_MCP_METADATA_SETTING).value;
    const serverText = JSON.stringify(
      new ServerStore({ storePath, secretCodec: TEST_SECRET_CODEC }).getServer(refreshed.serverId),
    );
    const publicPayload = JSON.stringify({ refreshed, status });

    for (const payload of [dbText, metadata, serverText, publicPayload]) {
      assert.equal(payload.includes(COMPOSIO_SECRET), false);
      assert.equal(payload.includes(COMPOSIO_HEADER), false);
    }
    assert.equal(status.configured, true);
    assert.equal(status.connected, true);
    assert.equal(status.toolCount, 2);
    assert.equal(status.refreshStatus, "ready");
  });
});

test("Composio refresh requires explicit toolkit selection and stale metadata fails closed", async () => {
  await withComposioStore(async ({ storePath }) => {
    let now = REFRESH_TIME;
    const manager = createMockMCPManager();
    const service = createService({
      storePath,
      client: createMockComposioClient(),
      manager,
      now: () => now,
      permissionMetadataMaxAgeMs: 1000,
    });

    await assert.rejects(
      service.refreshTools({ toolkits: [] }),
      (error) =>
        error instanceof ProviderError &&
        error.code === "COMPOSIO_TOOLKIT_SELECTION_REQUIRED" &&
        error.provider === "composio",
    );
    assert.equal(manager.connectCalls.length, 0);

    const refreshed = await service.refreshTools({ toolkits: ["gmail"] });
    const namespaced = namespaceMCPTool(refreshed.serverId, "GMAIL_SEND_EMAIL");

    assert.equal(
      shouldAutoApproveMCPTool(
        namespaced,
        {},
        service.getPermissionServerConfig(refreshed.serverId),
      ),
      false,
    );

    now = REFRESH_TIME + 1001;
    const staleConfig = service.getPermissionServerConfig(refreshed.serverId);
    assert.deepEqual(staleConfig.tools, []);
    assert.equal(shouldAutoApproveMCPTool(namespaced, {}, staleConfig), false);
    assert.equal(getMCPToolPermissionRequest(namespaced, {}, staleConfig).level, "unknown");

    manager.connected.delete(refreshed.serverId);
    now = REFRESH_TIME;
    const disconnectedConfig = service.getPermissionServerConfig(refreshed.serverId);
    assert.deepEqual(disconnectedConfig.tools, []);
  });
});

test("Composio integration handlers serialize errors and register IPC channels", async () => {
  const patternedSecret = "Bearer abcdefghijklmnopqrstuvwxyz";
  const registered = new Map();
  const service = {
    getStatus: () => ({ ok: true }),
    testConnection: () => {
      throw new ProviderError(`Missing ${patternedSecret}`, {
        code: "COMPOSIO_TEST_FAILURE",
        provider: "composio",
      });
    },
    refreshTools: () => ({ ok: true }),
    listToolkits: () => ({ ok: true, toolkits: [] }),
    listConnectedApps: () => ({ ok: true, apps: [] }),
    openAppAuth: () => ({ ok: true, redirectUrl: "https://auth.example.test" }),
  };
  const handlers = createComposioIntegrationHandlers({ service });

  const failed = await handlers.testConnection(null);
  assert.equal(failed.ok, false);
  assert.equal(failed.error.code, "COMPOSIO_TEST_FAILURE");
  assert.equal(failed.error.message.includes(patternedSecret), false);

  const { registerComposioIntegrationHandlers } = await import(
    "../src/mcp/composio-integration.js"
  );
  registerComposioIntegrationHandlers({
    ipcMain: {
      handle(channel, handler) {
        registered.set(channel, handler);
      },
    },
    service,
  });

  assert.deepEqual([...registered.keys()], Object.values(COMPOSIO_IPC_CHANNELS));
});

async function withComposioStore(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), "leena-composio-integration-"));
  const storePath = path.join(directory, "lena.db");
  try {
    await callback({ storePath });
  } finally {
    closeDatabase(storePath);
    await rm(directory, { force: true, recursive: true });
  }
}

function createService({
  storePath,
  client,
  manager,
  now = () => REFRESH_TIME,
  permissionMetadataMaxAgeMs,
}) {
  return createComposioIntegrationService({
    storePath,
    serverStore: new ServerStore({ storePath, secretCodec: TEST_SECRET_CODEC }),
    mcpClientManager: manager,
    loadCredential: () => COMPOSIO_SECRET,
    createComposioClient: () => client,
    now,
    permissionMetadataMaxAgeMs,
  });
}

function createMockComposioClient() {
  const calls = {
    createSession: [],
  };
  return {
    calls,
    async createSession(payload) {
      calls.createSession.push(payload);
      return {
        sessionId: "trs_mock",
        userId: payload.userId,
        mcp: {
          url: "https://app.composio.dev/tool_router/v3/trs_mock/mcp",
          headers: {
            Authorization: COMPOSIO_HEADER,
          },
        },
      };
    },
    async testConnection() {
      return { items: [{ slug: "gmail", name: "Gmail" }] };
    },
    async listToolkits() {
      return { items: [{ slug: "gmail", name: "Gmail", connected: true }] };
    },
    async listConnectedApps() {
      return {
        items: [
          {
            id: "ca_mock",
            toolkit: { slug: "gmail", name: "Gmail" },
            status: "ACTIVE",
          },
        ],
      };
    },
    async openAppAuth() {
      return {
        redirectUrl: "https://auth.composio.dev/connect",
        expiresAt: "2026-06-04T01:00:00Z",
      };
    },
  };
}

function createMockMCPManager() {
  const tools = [
    {
      name: "GMAIL_SEND_EMAIL",
      description: "Send an email through Gmail",
      inputSchema: {
        type: "object",
        properties: {
          to: { type: "string" },
          subject: { type: "string" },
        },
      },
    },
    {
      name: "GITHUB_CREATE_ISSUE",
      description: "Create a GitHub issue",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string" },
        },
      },
    },
  ];
  const connected = new Map();
  return {
    connected,
    connectCalls: [],
    async connect(config) {
      this.connectCalls.push(config);
      connected.set(config.serverId, { config, tools });
      return {
        serverId: config.serverId,
        name: config.name,
        transport: config.transport,
        connected: true,
        toolCount: 0,
      };
    },
    async disconnect(serverId) {
      return connected.delete(serverId);
    },
    async listTools(serverId) {
      return connected.get(serverId)?.tools ?? [];
    },
    getStatus() {
      return Object.fromEntries(
        Array.from(connected.entries()).map(([serverId, entry]) => [
          serverId,
          {
            serverId,
            name: entry.config.name,
            transport: entry.config.transport,
            connected: true,
            toolCount: entry.tools.length,
          },
        ]),
      );
    },
  };
}
