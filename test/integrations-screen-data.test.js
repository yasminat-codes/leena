import assert from "node:assert/strict";
import test from "node:test";

import {
  addIntegrationServer,
  loadIntegrations,
  removeIntegrationServer,
  renderIntegrations,
  renderIntegrationsData,
  subscribeToMCPStatusChanges,
  toggleIntegrationConnection,
  validateMCPServerDraft,
} from "../src/renderer/screens/integrations.js";

function createMCPBridge({ permissions = [], servers = [], statuses = {} } = {}) {
  const calls = {
    addServer: [],
    connect: [],
    disconnect: [],
    getOsPermissions: 0,
    getStatus: 0,
    listServers: 0,
    removeServer: [],
  };

  return {
    calls,
    async addServer(config) {
      calls.addServer.push(config);
      return { id: "new-server", ...config };
    },
    async connect(id) {
      calls.connect.push(id);
      return { connected: true, serverId: id, toolCount: 2 };
    },
    async disconnect(id) {
      calls.disconnect.push(id);
      return { disconnected: true, serverId: id };
    },
    async getStatus() {
      calls.getStatus += 1;
      return statuses;
    },
    async getOsPermissions() {
      calls.getOsPermissions += 1;
      return permissions;
    },
    async listServers() {
      calls.listServers += 1;
      return servers;
    },
    async removeServer(id) {
      calls.removeServer.push(id);
      return { removed: true, serverId: id };
    },
  };
}

test("renderIntegrations returns mountable live MCP shell without fixture tiles", () => {
  const html = renderIntegrations();

  assert.match(html, /^\s*<section class="integrations-screen" aria-label="Integrations"/);
  assert.match(html, /data-integrations-state="loading"/);
  assert.match(html, />Add MCP Server<\/button>/);
  assert.match(html, /Composio/);
  assert.match(html, /Custom MCP/);
  assert.match(html, /Microphone/);
  assert.match(html, /Screen Recording/);
  assert.match(html, /Accessibility/);
  assert.match(html, /Full Disk Access/);
  assert.match(html, /Apple Calendar/);
  assert.match(html, />Files</);
  assert.match(html, /Provider Health/);
  assert.match(html, /Loading MCP servers/);
  assert.doesNotMatch(html, /data-integrations-add-form/);
  assert.doesNotMatch(html, /Gmail|Google Calendar|Slack|Notion|Filesystem MCP|Postgres MCP/);
});

test("loadIntegrations renders mock IPC server tiles with transport, status, and tool count", async () => {
  const bridge = createMCPBridge({
    servers: [
      {
        id: "remote-search",
        name: "Remote Search",
        transport: "http",
        url: "https://mcp.example.com/sse",
      },
      {
        command: "node local-mcp.js",
        id: "local-files",
        name: "Local Files",
        transport: "stdio",
      },
    ],
    statuses: {
      "local-files": { connected: false, toolCount: 0 },
      "remote-search": { connected: true, toolCount: 5 },
    },
  });

  const data = await loadIntegrations(bridge, bridge);
  const html = renderIntegrationsData(data);

  assert.equal(bridge.calls.listServers, 1);
  assert.equal(bridge.calls.getStatus, 1);
  assert.equal(bridge.calls.getOsPermissions, 1);
  assert.match(html, /data-integrations-detail-card/);
  assert.match(html, />2 servers<\/span>/);
  assert.match(html, />1\/2 online<\/span>/);
  assert.match(html, /data-integrations-server-id="remote-search"/);
  assert.match(html, /Remote Search/);
  assert.match(html, /https:\/\/mcp\.example\.com\/sse/);
  assert.match(html, /data-integrations-transport="http">Streamable HTTP/);
  assert.match(html, /data-integrations-status="connected">Connected/);
  assert.match(html, />5 tools<\/span>/);
  assert.match(html, /data-integrations-server-id="local-files"/);
  assert.match(html, /Local Files/);
  assert.match(html, /node local-mcp\.js/);
  assert.match(html, /data-integrations-transport="stdio">STDIO/);
  assert.match(html, /data-integrations-status="disconnected">Disconnected/);
  assert.match(html, />0 tools<\/span>/);
});

test("loadIntegrations merges OS permissions into Mac Access cards", async () => {
  const bridge = createMCPBridge({
    permissions: [
      { id: "microphone", status: "granted" },
      { id: "screen", status: "unknown" },
      { id: "accessibility", status: "unsupported" },
      { id: "full-disk-access", status: "denied" },
      { id: "apple-calendar", status: "stale" },
      { id: "files", status: "not-determined" },
    ],
  });

  const data = await loadIntegrations(bridge, bridge);
  const html = renderIntegrationsData(data);

  assert.equal(bridge.calls.getOsPermissions, 1);
  assert.equal(data.permissions.length, 7);
  assert.match(html, /data-permission-id="microphone" data-permission-status="granted"/);
  assert.match(html, /data-integrations-card-status="screen">Check status/);
  assert.match(html, /data-integrations-card-status="accessibility">Unsupported/);
  assert.match(html, /data-integrations-card-status="full-disk-access">Needs settings/);
  assert.match(html, /data-integrations-card-status="apple-calendar">Refresh/);
  assert.match(html, /data-integrations-card-status="files">Needs setup/);
});

test("renderIntegrationsData can open provider health and Custom MCP details in place", () => {
  const providerHealthHtml = renderIntegrationsData({
    selectedDetail: "provider-health",
    servers: [
      { id: "remote-search", name: "Remote Search", transport: "http" },
      { id: "local-files", name: "Local Files", transport: "stdio" },
    ],
    statuses: {
      "local-files": { connected: true, toolCount: 8 },
      "remote-search": { connected: false, toolCount: 3 },
    },
  });
  const customMcpHtml = renderIntegrationsData({ selectedDetail: "custom-mcp" });

  assert.match(providerHealthHtml, /data-integrations-detail-active="provider-health"/);
  assert.match(providerHealthHtml, /Provider health summarizes the live MCP bridge/);
  assert.match(providerHealthHtml, /<strong class="lx-body">2<\/strong>/);
  assert.match(providerHealthHtml, /<strong class="lx-body">1<\/strong>/);
  assert.match(providerHealthHtml, /<strong class="lx-body">11<\/strong>/);

  assert.match(customMcpHtml, /data-integrations-detail-active="custom-mcp"/);
  assert.match(customMcpHtml, /data-integrations-add-form/);
  assert.match(customMcpHtml, /Streamable HTTP URL/);
  assert.match(customMcpHtml, /Stdio command/);
});

test("Mac Access detail panels keep permission actions scoped by id", () => {
  for (const permissionId of ["microphone", "screen", "accessibility", "apple-calendar"]) {
    const html = renderIntegrationsData({ selectedDetail: permissionId });

    assert.match(html, new RegExp(`data-integrations-detail-active="${permissionId}"`));
    assert.match(
      html,
      new RegExp(
        `data-integrations-action="request-permission" data-permission-id="${permissionId}"`,
      ),
    );
    assert.match(
      html,
      new RegExp(
        `data-integrations-action="open-permission-settings" data-permission-id="${permissionId}"`,
      ),
    );
  }

  for (const permissionId of ["full-disk-access", "files"]) {
    const html = renderIntegrationsData({ selectedDetail: permissionId });

    assert.match(html, new RegExp(`data-integrations-detail-active="${permissionId}"`));
    assert.doesNotMatch(html, /data-integrations-action="request-permission"/);
    assert.match(
      html,
      new RegExp(
        `data-integrations-action="open-permission-settings" data-permission-id="${permissionId}">Open Settings`,
      ),
    );
  }
});

test("validateMCPServerDraft enforces Streamable HTTP URL and stdio command requirements", () => {
  assert.deepEqual(validateMCPServerDraft({ name: "", transport: "http" }), {
    error: "MCP server name is required.",
  });
  assert.deepEqual(validateMCPServerDraft({ name: "Remote", transport: "http" }), {
    error: "Streamable HTTP MCP servers require a URL.",
  });
  assert.deepEqual(
    validateMCPServerDraft({ name: "Remote", transport: "http", url: "ftp://example.com" }),
    { error: "Streamable HTTP MCP server URL must use http or https." },
  );
  assert.deepEqual(validateMCPServerDraft({ name: "Local", transport: "stdio" }), {
    error: "Stdio MCP servers require a command.",
  });
  assert.deepEqual(
    validateMCPServerDraft({
      args: "--project /tmp/leena",
      command: "node",
      name: "Local",
      transport: "stdio",
    }),
    {
      config: {
        args: ["--project", "/tmp/leena"],
        command: "node",
        name: "Local",
        transport: "stdio",
      },
    },
  );
  assert.deepEqual(
    validateMCPServerDraft({
      name: "Remote",
      transport: "streamable-http",
      url: "https://mcp.example.com/sse",
    }),
    {
      config: {
        name: "Remote",
        transport: "http",
        url: "https://mcp.example.com/sse",
      },
    },
  );
});

test("add remove connect and disconnect flows call current MCP bridge APIs", async () => {
  const bridge = createMCPBridge();

  await addIntegrationServer(
    { name: "Remote", transport: "http", url: "https://mcp.example.com" },
    bridge,
  );
  await toggleIntegrationConnection({ connected: false, id: "remote" }, bridge);
  await toggleIntegrationConnection({ connected: true, id: "remote" }, bridge);

  const cancelled = await removeIntegrationServer("remote", bridge, () => false);
  const removed = await removeIntegrationServer("remote", bridge, () => true);

  assert.deepEqual(bridge.calls.addServer, [
    { name: "Remote", transport: "http", url: "https://mcp.example.com/" },
  ]);
  assert.deepEqual(bridge.calls.connect, ["remote"]);
  assert.deepEqual(bridge.calls.disconnect, ["remote"]);
  assert.deepEqual(cancelled, { cancelled: true, removed: false, serverId: "remote" });
  assert.deepEqual(bridge.calls.removeServer, ["remote"]);
  assert.deepEqual(removed, { removed: true, serverId: "remote" });
});

test("subscribeToMCPStatusChanges reconciles status and changed event names", () => {
  const bridge = {
    changedListeners: [],
    statusListeners: [],
    offChanged(listener) {
      this.changedListeners = this.changedListeners.filter((item) => item !== listener);
    },
    offStatusChanged(listener) {
      this.statusListeners = this.statusListeners.filter((item) => item !== listener);
    },
    onChanged(listener) {
      this.changedListeners.push(listener);
      return listener;
    },
    onStatusChanged(listener) {
      this.statusListeners.push(listener);
      return listener;
    },
  };
  const events = [];

  const cleanup = subscribeToMCPStatusChanges(bridge, (event) => events.push(event));
  bridge.statusListeners[0]({ connected: ["remote"] });
  bridge.changedListeners[0]({ action: "connect", serverId: "remote", type: "mcp" });
  cleanup();

  assert.deepEqual(events, [
    { connected: ["remote"] },
    { action: "connect", serverId: "remote", type: "mcp" },
  ]);
  assert.deepEqual(bridge.statusListeners, []);
  assert.deepEqual(bridge.changedListeners, []);
});
