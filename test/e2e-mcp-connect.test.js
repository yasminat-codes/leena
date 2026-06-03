import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { MCPClientManager } from "../src/mcp/client-manager.js";
import { namespaceMCPTool } from "../src/mcp/schema-converter.js";
import { ServerStore } from "../src/mcp/server-store.js";
import { closeDatabase } from "../src/realtime/tools/database.js";
import { getRealtimeToolDefinitions } from "../src/realtime/tools/index.js";

test("MCP HTTP server tools appear in merged definitions and disappear after disconnect", async () => {
  const mockServer = await startMockMcpServer();
  try {
    await withMcpDb(async (storePath) => {
      const store = new ServerStore({ storePath });
      const storedServer = store.addServer({
        name: "Local E2E MCP",
        transport: "http",
        url: mockServer.url,
        permission_level: "trust",
      });
      const manager = createHttpBackedManager();
      const namespacedTool = namespaceMCPTool(storedServer.id, "lookup_profile");

      const status = await manager.connect(storedServer);
      assert.equal(status.connected, true);
      assert.equal(status.serverId, storedServer.id);

      const listedTools = await manager.listTools(storedServer.id);
      assert.deepEqual(
        listedTools.map((tool) => tool.name),
        ["lookup_profile", "summarize_inbox"],
      );

      const mergedTools = await getRealtimeToolDefinitions(manager);
      const mergedMcpTool = mergedTools.find((tool) => tool.name === namespacedTool);
      assert.equal(mergedMcpTool.description, "Look up a user profile");
      assert.deepEqual(mergedMcpTool.parameters.properties.topic, { type: "string" });

      assert.equal(await manager.disconnect(storedServer.id), true);
      const afterDisconnect = await getRealtimeToolDefinitions(manager);
      assert.equal(
        afterDisconnect.some((tool) => tool.name === namespacedTool),
        false,
      );
      assert.deepEqual(
        mockServer.requests.map((request) => request.method),
        ["initialize", "tools/list", "tools/list"],
      );
    });
  } finally {
    await mockServer.close();
  }
});

async function withMcpDb(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), "leena-e2e-mcp-"));
  const storePath = path.join(directory, "lena.db");
  try {
    await callback(storePath);
  } finally {
    closeDatabase(storePath);
    await rm(directory, { force: true, recursive: true });
  }
}

function createHttpBackedManager() {
  return new MCPClientManager({
    Client: LocalHttpMcpClient,
    StreamableHTTPClientTransport: LocalHttpTransport,
    StdioClientTransport: LocalStdioTransport,
    retryOptions: {
      connect: { baseDelay: 0, maxDelay: 0, jitter: false },
      callTool: { baseDelay: 0, maxDelay: 0, jitter: false },
    },
  });
}

class LocalHttpMcpClient {
  async connect(transport) {
    this.transport = transport;
    await postJson(transport.url, { method: "initialize" });
  }

  async listTools() {
    return postJson(this.transport.url, { method: "tools/list" });
  }

  async close() {
    await this.transport?.close?.();
  }
}

class LocalHttpTransport {
  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.closed = false;
  }

  async close() {
    this.closed = true;
  }
}

class LocalStdioTransport {
  async close() {}
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(response.ok, true);
  return response.json();
}

async function startMockMcpServer() {
  const requests = [];
  const tools = [
    {
      name: "lookup_profile",
      description: "Look up a user profile",
      inputSchema: {
        type: "object",
        properties: {
          topic: { type: "string" },
        },
        required: ["topic"],
      },
    },
    {
      name: "summarize_inbox",
      description: "Summarize inbox messages",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ];
  const server = createServer(async (request, response) => {
    const body = await readJsonBody(request);
    requests.push({ path: request.url, method: body.method });

    if (request.url !== "/mcp") {
      sendJson(response, 404, { error: "not found" });
      return;
    }
    if (body.method === "initialize") {
      sendJson(response, 200, { ok: true });
      return;
    }
    if (body.method === "tools/list") {
      sendJson(response, 200, { tools });
      return;
    }
    sendJson(response, 400, { error: "unsupported method" });
  });

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.equal(typeof address, "object");

  return {
    requests,
    url: `http://127.0.0.1:${address.port}/mcp`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}
