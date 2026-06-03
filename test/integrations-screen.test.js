import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  renderIntegrations,
  renderIntegrationsData,
} from "../src/renderer/screens/integrations.js";

const leenaCss = readFileSync(new URL("../src/renderer/leena.css", import.meta.url), "utf8");

function countMatches(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

function extractRuleBody(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));

  assert.ok(match, `${selector} rule exists`);
  return match[1];
}

test("renderIntegrations returns a mountable live MCP loading shell", () => {
  const html = renderIntegrations();

  assert.match(html, /^\s*<section class="integrations-screen" aria-label="Integrations"/);
  assert.match(html, /class="panel-glass integrations-header"/);
  assert.match(html, /class="lx-mono">Connections<\/p>/);
  assert.match(html, /data-integrations-connected-count>0 connected<\/p>/);
  assert.match(html, /0 configured MCP servers/);
  assert.match(html, /data-integrations-action="open-add"/);
  assert.match(html, /Loading MCP servers/);
  assert.match(html, /class="integrations-grid"/);
  assert.equal(countMatches(html, /class="card integrations-tile"/g), 1);
  assert.doesNotMatch(html, /#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(html, /Gmail|Google Calendar|Slack|Notion|Postgres MCP/);
});

test("renderIntegrationsData maps live MCP statuses to tile classes", () => {
  const html = renderIntegrationsData({
    servers: [
      { id: "remote", name: "Remote MCP", transport: "http", url: "https://mcp.example.com" },
      { command: "node local.js", id: "local", name: "Local MCP", transport: "stdio" },
    ],
    statuses: {
      local: { connected: false, toolCount: 0 },
      remote: { connected: true, toolCount: 3 },
    },
  });

  assert.match(html, /data-integrations-connected-count>1 connected<\/p>/);
  assert.match(html, /2 configured MCP servers/);
  assert.equal(countMatches(html, /class="card integrations-tile"/g), 2);
  assert.equal(countMatches(html, /data-integrations-status="connected">Connected<\/span>/g), 1);
  assert.equal(
    countMatches(html, /data-integrations-status="disconnected">Disconnected<\/span>/g),
    1,
  );
  assert.equal(
    countMatches(html, /data-integrations-transport="http">Streamable HTTP<\/span>/g),
    1,
  );
  assert.equal(countMatches(html, /data-integrations-transport="stdio">STDIO<\/span>/g), 1);
  assert.match(html, />3 tools<\/span>/);
  assert.match(html, />0 tools<\/span>/);
});

test("integrations header CSS protects approval-gate stats from clipping", () => {
  const headerBody = extractRuleBody(leenaCss, ".integrations-header");
  const copyBody = extractRuleBody(leenaCss, ".integrations-header__copy");

  assert.match(headerBody, /display:\s*flex/);
  assert.match(headerBody, /min-height:\s*94px/);
  assert.match(headerBody, /align-items:\s*center/);
  assert.match(headerBody, /overflow:\s*visible/);
  assert.match(copyBody, /padding-block:\s*2px/);
});
