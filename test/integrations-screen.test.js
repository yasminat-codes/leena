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
  assert.match(html, /data-integrations-detail="composio"/);
  assert.match(html, /data-integrations-detail-active="composio"/);
  assert.match(html, /Composio/);
  assert.match(html, /Custom MCP/);
  assert.match(html, /Microphone/);
  assert.match(html, /Screen Recording/);
  assert.match(html, /Accessibility/);
  assert.match(html, /Full Disk Access/);
  assert.match(html, /Apple Calendar/);
  assert.match(html, />Files</);
  assert.match(html, /Provider Health/);
  assert.match(html, /data-integrations-card-grid/);
  assert.match(html, /Loading MCP servers/);
  assert.match(html, /class="integrations-grid"/);
  assert.equal(countMatches(html, /class="card integrations-card"/g), 9);
  assert.equal(countMatches(html, /data-integrations-permission-card/g), 6);
  assert.equal(countMatches(html, /data-integrations-loading="true"/g), 1);
  assert.doesNotMatch(html, /data-integrations-add-form/);
  assert.doesNotMatch(html, /<input\b|<select\b/);
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
  assert.match(html, /data-integrations-detail-active="composio"/);
  assert.match(html, /data-integrations-detail="custom-mcp" aria-pressed="false"/);
  assert.match(html, />2 servers<\/span>/);
  assert.match(html, />1\/2 online<\/span>/);
  assert.equal(countMatches(html, /data-integrations-detail-card/g), 9);
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

test("renderIntegrationsData keeps Custom MCP setup inside the detail shell", () => {
  const html = renderIntegrationsData({ selectedDetail: "custom-mcp" });

  assert.match(html, /data-integrations-detail="custom-mcp"/);
  assert.match(html, /data-integrations-detail-active="custom-mcp"/);
  assert.match(html, /data-integrations-add-form/);
  assert.match(html, /class="settings-input" name="name"/);
  assert.match(html, /class="settings-select" name="transport"/);
  assert.match(html, /data-integrations-field="command" hidden/);
  assert.match(html, /Add MCP Server/);
  assert.match(html, /No MCP servers/);
  assert.equal(countMatches(html, /class="card integrations-card"/g), 9);
});

test("renderIntegrationsData shows Mac Access card states and scoped actions", () => {
  const html = renderIntegrationsData({
    permissions: [
      { id: "microphone", status: "granted" },
      { id: "screen", status: "denied" },
      { id: "accessibility", status: "restricted" },
      { id: "full-disk-access", status: "stale" },
      { id: "apple-calendar", status: "not-determined" },
      { id: "files", status: "unsupported" },
    ],
    selectedDetail: "full-disk-access",
  });

  assert.equal(countMatches(html, /data-integrations-permission-card/g), 6);
  assert.match(
    html,
    /data-permission-id="microphone" data-permission-status="granted"[\s\S]*data-integrations-card-status="microphone">Allowed/,
  );
  assert.match(
    html,
    /data-permission-id="screen" data-permission-status="denied"[\s\S]*data-integrations-card-status="screen">Needs settings/,
  );
  assert.match(
    html,
    /data-permission-id="accessibility" data-permission-status="restricted"[\s\S]*data-integrations-card-status="accessibility">Restricted/,
  );
  assert.match(
    html,
    /data-permission-id="full-disk-access" data-permission-status="stale"[\s\S]*data-integrations-card-status="full-disk-access">Refresh/,
  );
  assert.match(
    html,
    /data-permission-id="apple-calendar" data-permission-status="not-determined"[\s\S]*data-integrations-card-status="apple-calendar">Needs setup/,
  );
  assert.match(
    html,
    /data-permission-id="files" data-permission-status="unsupported"[\s\S]*data-integrations-card-status="files">Unsupported/,
  );
  assert.match(html, /data-integrations-detail-active="full-disk-access"/);
  assert.match(html, /High-power broad read\/search capability/);
  assert.match(html, /macOS System Settings; Leena only guides setup/);
  assert.match(
    html,
    /data-integrations-action="open-permission-settings" data-permission-id="full-disk-access">Open Settings/,
  );
  assert.doesNotMatch(html, /grant automatically|auto-grant|Grant now/i);
});

test("renderIntegrationsData renders Request and Open Settings for guided Mac Access", () => {
  const html = renderIntegrationsData({
    permissions: [{ id: "apple-calendar", status: "unknown" }],
    selectedDetail: "apple-calendar",
  });

  assert.match(html, /data-integrations-detail-active="apple-calendar"/);
  assert.match(html, /Read access/);
  assert.match(html, /Write actions/);
  assert.match(html, /Separate confirmation path; not implied by read access/);
  assert.match(
    html,
    /data-integrations-action="request-permission" data-permission-id="apple-calendar" >Request/,
  );
  assert.match(
    html,
    /data-integrations-action="open-permission-settings" data-permission-id="apple-calendar">Open Settings/,
  );
  assert.match(html, /Request only uses approved OS prompts or opens guided settings/);
});

test("integrations header CSS protects approval-gate stats from clipping", () => {
  const headerBody = extractRuleBody(leenaCss, ".integrations-header");
  const copyBody = extractRuleBody(leenaCss, ".integrations-header__copy");
  const marketplaceBody = extractRuleBody(leenaCss, ".integrations-marketplace");
  const detailLayoutBody = extractRuleBody(leenaCss, ".integrations-detail-layout");
  const cardBody = extractRuleBody(leenaCss, ".integrations-card");
  const cardChipBody = extractRuleBody(leenaCss, ".integrations-card > .chip");

  assert.match(headerBody, /display:\s*flex/);
  assert.match(headerBody, /min-height:\s*94px/);
  assert.match(headerBody, /align-items:\s*center/);
  assert.match(headerBody, /justify-content:\s*space-between/);
  assert.match(headerBody, /overflow:\s*visible/);
  assert.match(copyBody, /padding-block:\s*2px/);
  assert.match(marketplaceBody, /display:\s*grid/);
  assert.match(marketplaceBody, /grid-auto-flow:\s*column/);
  assert.match(marketplaceBody, /grid-auto-columns:\s*minmax\(142px,\s*1fr\)/);
  assert.match(marketplaceBody, /overflow-x:\s*auto/);
  assert.match(detailLayoutBody, /minmax\(284px,\s*0\.78fr\)/);
  assert.match(cardBody, /min-height:\s*112px/);
  assert.match(cardBody, /grid-template-columns:\s*auto minmax\(0,\s*1fr\)/);
  assert.match(cardChipBody, /max-width:\s*100%/);
  assert.match(cardChipBody, /overflow:\s*hidden/);
  assert.match(cardChipBody, /text-overflow:\s*ellipsis/);
});
