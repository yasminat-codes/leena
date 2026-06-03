import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import {
  initMCPAutoConnect,
  MCP_STATUS_CHANGED_CHANNEL,
  registerMCPAutoConnectCleanup,
} from "../src/mcp/auto-connect.js";

const RETRY_OPTIONS = Object.freeze({
  maxAttempts: 3,
  baseDelay: 0,
  maxDelay: 0,
  jitter: false,
});

test("auto-connect attempts all enabled servers, retries failures, and emits status", async () => {
  const servers = [
    { id: "ok-http", name: "HTTP MCP", transport: "http", url: "https://mcp.example.test" },
    { id: "bad-stdio", name: "Broken MCP", transport: "stdio", command: "missing" },
    { id: "ok-stdio", name: "Local MCP", transport: "stdio", command: "node" },
  ];
  const attempts = new Map();
  const logs = [];
  const webContents = createMockWebContents();

  const controller = initMCPAutoConnect({
    serverStore: {
      getAutoConnectServers: () => servers,
    },
    mcpClientManager: {
      async connect(server) {
        attempts.set(server.id, (attempts.get(server.id) ?? 0) + 1);
        if (server.id === "bad-stdio") {
          throw retryableError(`spawn failed ${attempts.get(server.id)}`);
        }
        return { connected: true, serverId: server.id };
      },
    },
    webContents,
    logger: (event, details) => logs.push({ event, details }),
    retryOptions: RETRY_OPTIONS,
  });

  const summary = await controller.completion;

  assert.deepEqual(Object.fromEntries(attempts), {
    "ok-http": 1,
    "bad-stdio": 3,
    "ok-stdio": 1,
  });
  assert.deepEqual(summary, {
    connected: ["ok-http", "ok-stdio"],
    failed: ["bad-stdio"],
  });
  assert.deepEqual(webContents.sent, [
    {
      channel: MCP_STATUS_CHANGED_CHANNEL,
      payload: summary,
    },
  ]);
  assert.ok(logs.some((entry) => entry.event === "mcp:auto-connect:ok:HTTP MCP"));
  assert.ok(logs.some((entry) => entry.event === "mcp:auto-connect:ok:Local MCP"));
  assert.ok(
    logs.some((entry) => entry.event.startsWith("mcp:auto-connect:fail:Broken MCP:spawn failed")),
  );
});

test("initMCPAutoConnect returns before background connections settle", async () => {
  const webContents = createMockWebContents();
  const deferred = createDeferred();

  const controller = initMCPAutoConnect({
    serverStore: {
      getAutoConnectServers: () => [
        { id: "slow", name: "Slow MCP", transport: "http", url: "https://slow.example.test" },
      ],
    },
    mcpClientManager: {
      connect: () => deferred.promise,
    },
    webContents,
    retryOptions: RETRY_OPTIONS,
  });

  assert.equal(typeof controller.cleanup, "function");
  assert.equal(webContents.sent.length, 0);

  deferred.resolve({ connected: true });
  assert.deepEqual(await controller.completion, {
    connected: ["slow"],
    failed: [],
  });
  assert.equal(webContents.sent.length, 1);
});

test("server-store failures do not crash startup and still emit status", async () => {
  const logs = [];
  const webContents = createMockWebContents();

  const controller = initMCPAutoConnect({
    serverStore: {
      getAutoConnectServers() {
        throw new Error("database locked");
      },
    },
    mcpClientManager: {
      async connect() {
        throw new Error("connect should not be called");
      },
    },
    webContents,
    logger: (event, details) => logs.push({ event, details }),
    retryOptions: RETRY_OPTIONS,
  });

  assert.deepEqual(await controller.completion, {
    connected: [],
    failed: [],
  });
  assert.deepEqual(webContents.sent, [
    {
      channel: MCP_STATUS_CHANGED_CHANNEL,
      payload: { connected: [], failed: [] },
    },
  ]);
  assert.ok(
    logs.some((entry) => entry.event === "mcp:auto-connect:fail:server-store:database locked"),
  );
});

test("before-quit cleanup disconnects all MCP clients and can be disposed", async () => {
  const app = new EventEmitter();
  const logs = [];
  let disconnectAllCalls = 0;

  const registration = registerMCPAutoConnectCleanup({
    app,
    mcpClientManager: {
      async disconnectAll() {
        disconnectAllCalls += 1;
      },
    },
    logger: (event, details) => logs.push({ event, details }),
  });

  app.emit("before-quit");
  await registration.cleanup();

  assert.equal(disconnectAllCalls, 1);
  assert.ok(logs.some((entry) => entry.event === "mcp:auto-connect:cleanup:ok"));

  registration.dispose();
  app.emit("before-quit");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(disconnectAllCalls, 1);
});

test("before-quit cleanup logs disconnect failures without throwing", async () => {
  const result = await registerMCPAutoConnectCleanup({
    app: new EventEmitter(),
    mcpClientManager: {
      async disconnectAll() {
        throw new Error("close failed");
      },
    },
  }).cleanup();

  assert.equal(result.ok, false);
  assert.match(result.error.message, /close failed/);
});

function createMockWebContents() {
  return {
    sent: [],
    send(channel, payload) {
      this.sent.push({ channel, payload });
    },
    isDestroyed() {
      return false;
    },
  };
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function retryableError(message) {
  const error = new Error(message);
  error.code = "ECONNRESET";
  return error;
}
