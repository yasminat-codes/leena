import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  addServer,
  getAutoConnectServers,
  getServer,
  listServers,
  removeServer,
  ServerStore,
  updateServer,
} from "../src/mcp/server-store.js";
import { closeDatabase } from "../src/realtime/tools/database.js";
import { LeenaError } from "../src/utils/errors.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function withServerStore(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), "leena-mcp-server-"));
  const filePath = path.join(directory, "lena.db");
  try {
    await callback(filePath);
  } finally {
    closeDatabase(filePath);
    await rm(directory, { force: true, recursive: true });
  }
}

test("table migration is idempotent and list returns empty on first access", async () => {
  await withServerStore((filePath) => {
    assert.deepEqual(listServers(filePath), []);
    assert.deepEqual(listServers(filePath), []);
  });
});

test("adds HTTP and stdio servers, then lists and gets them", async () => {
  await withServerStore((filePath) => {
    const httpServer = addServer(
      {
        name: "Remote MCP",
        transport: "http",
        url: "https://mcp.example.test/mcp",
        auto_connect: true,
        permission_level: "auto",
      },
      filePath,
    );
    const stdioServer = addServer(
      {
        name: "Local MCP",
        transport: "stdio",
        command: "node",
        args: ["server.js", "--flag"],
        enabled: false,
        permission_level: "trust",
      },
      filePath,
    );

    assert.match(httpServer.id, UUID_PATTERN);
    assert.equal(httpServer.name, "Remote MCP");
    assert.equal(httpServer.transport, "http");
    assert.equal(httpServer.url, "https://mcp.example.test/mcp");
    assert.equal(httpServer.command, null);
    assert.deepEqual(httpServer.args, []);
    assert.equal(httpServer.enabled, true);
    assert.equal(httpServer.auto_connect, true);
    assert.equal(httpServer.permission_level, "auto");
    assert.equal(typeof httpServer.created_at, "string");

    assert.match(stdioServer.id, UUID_PATTERN);
    assert.equal(stdioServer.transport, "stdio");
    assert.equal(stdioServer.command, "node");
    assert.deepEqual(stdioServer.args, ["server.js", "--flag"]);
    assert.equal(stdioServer.enabled, false);
    assert.equal(stdioServer.auto_connect, false);
    assert.equal(stdioServer.permission_level, "trust");

    const servers = listServers(filePath);
    assert.equal(servers.length, 2);
    assert.deepEqual(
      servers.map((server) => server.id).sort(),
      [httpServer.id, stdioServer.id].sort(),
    );
    assert.deepEqual(getServer(stdioServer.id, filePath), stdioServer);
  });
});

test("ServerStore class uses its configured database path", async () => {
  await withServerStore((filePath) => {
    const store = new ServerStore({ storePath: filePath });
    const server = store.addServer({
      name: "Class Store",
      transport: "http",
      url: "https://class-store.example.test/mcp",
    });

    assert.deepEqual(store.getServer(server.id), server);
    assert.deepEqual(store.listServers(), [server]);
  });
});

test("rejects invalid configs with LeenaError", async () => {
  await withServerStore((filePath) => {
    assert.throws(
      () => addServer({ name: "Missing URL", transport: "http" }, filePath),
      LeenaError,
    );
    assert.throws(
      () => addServer({ name: "Missing Command", transport: "stdio" }, filePath),
      LeenaError,
    );
    assert.throws(
      () =>
        addServer(
          {
            name: "Bad Args",
            transport: "stdio",
            command: "node",
            args: "server.js",
          },
          filePath,
        ),
      LeenaError,
    );
    assert.throws(
      () => addServer({ name: "Bad Transport", transport: "websocket" }, filePath),
      LeenaError,
    );
  });
});

test("removeServer returns true for existing rows and false for missing rows", async () => {
  await withServerStore((filePath) => {
    const server = addServer(
      {
        name: "Remove Me",
        transport: "http",
        url: "https://remove.example.test/mcp",
      },
      filePath,
    );

    assert.equal(removeServer(server.id, filePath), true);
    assert.equal(getServer(server.id, filePath), null);
    assert.equal(removeServer(server.id, filePath), false);
    assert.equal(removeServer("missing", filePath), false);
  });
});

test("updateServer applies partial updates and preserves omitted fields", async () => {
  await withServerStore((filePath) => {
    const server = addServer(
      {
        name: "Original",
        transport: "stdio",
        command: "node",
        args: ["old.js"],
        enabled: true,
        auto_connect: false,
        permission_level: "auto",
      },
      filePath,
    );

    const updated = updateServer(
      server.id,
      {
        name: "Updated",
        args: ["new.js", "--verbose"],
        auto_connect: true,
        permission_level: "surprise",
      },
      filePath,
    );

    assert.equal(updated.id, server.id);
    assert.equal(updated.name, "Updated");
    assert.equal(updated.transport, "stdio");
    assert.equal(updated.command, "node");
    assert.deepEqual(updated.args, ["new.js", "--verbose"]);
    assert.equal(updated.enabled, true);
    assert.equal(updated.auto_connect, true);
    assert.equal(updated.permission_level, "confirm");
    assert.equal(updated.created_at, server.created_at);
    assert.equal(updateServer("missing", { name: "Nope" }, filePath), null);
  });
});

test("updateServer validates merged transport requirements", async () => {
  await withServerStore((filePath) => {
    const server = addServer(
      {
        name: "Remote",
        transport: "http",
        url: "https://remote.example.test/mcp",
      },
      filePath,
    );

    assert.throws(() => updateServer(server.id, { url: null }, filePath), LeenaError);
    assert.throws(() => updateServer(server.id, { transport: "stdio" }, filePath), LeenaError);

    const updated = updateServer(
      server.id,
      {
        transport: "stdio",
        command: "node",
        args: ["server.js"],
      },
      filePath,
    );
    assert.equal(updated.transport, "stdio");
    assert.equal(updated.command, "node");
    assert.deepEqual(updated.args, ["server.js"]);
  });
});

test("getAutoConnectServers returns only enabled auto-connect servers", async () => {
  await withServerStore((filePath) => {
    const enabledAuto = addServer(
      {
        name: "Enabled Auto",
        transport: "http",
        url: "https://enabled-auto.example.test/mcp",
        enabled: true,
        auto_connect: true,
      },
      filePath,
    );
    addServer(
      {
        name: "Disabled Auto",
        transport: "http",
        url: "https://disabled-auto.example.test/mcp",
        enabled: false,
        auto_connect: true,
      },
      filePath,
    );
    addServer(
      {
        name: "Enabled Manual",
        transport: "stdio",
        command: "node",
        enabled: true,
        auto_connect: false,
      },
      filePath,
    );

    assert.deepEqual(getAutoConnectServers(filePath), [enabledAuto]);
  });
});
