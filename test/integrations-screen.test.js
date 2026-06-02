import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  MOCK_INTEGRATIONS_DATA,
  renderIntegrations,
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

test("MOCK_INTEGRATIONS_DATA defines 9 valid integration tiles", () => {
  assert.equal(MOCK_INTEGRATIONS_DATA.length, 9);

  const statuses = new Set(MOCK_INTEGRATIONS_DATA.map((integration) => integration.status));
  assert.deepEqual(statuses, new Set(["connected", "available", "mcp"]));
  assert.equal(
    MOCK_INTEGRATIONS_DATA.filter((integration) => integration.status === "connected").length,
    6,
  );

  for (const integration of MOCK_INTEGRATIONS_DATA) {
    assert.equal(typeof integration.id, "string");
    assert.equal(typeof integration.name, "string");
    assert.equal(typeof integration.description, "string");
    assert.equal(typeof integration.icon, "string");
    assert.equal(typeof integration.iconGradient, "string");
    assert.ok(integration.id.length > 0);
    assert.ok(integration.name.length > 0);
    assert.ok(integration.description.length > 0);
    assert.ok(["connected", "available", "mcp"].includes(integration.status));
  }
});

test("renderIntegrations returns mountable integrations HTML with header stats", () => {
  const html = renderIntegrations();

  assert.match(html, /^\s*<section class="integrations-screen" aria-label="Integrations">/);
  assert.match(html, /class="panel-glass integrations-header"/);
  assert.match(html, /class="lx-mono">Connections<\/p>/);
  assert.match(html, /class="lx-h1">6 connected<\/p>/);
  assert.match(html, /9 available integrations and MCP servers/);
  assert.match(html, /class="integrations-grid"/);
  assert.equal(countMatches(html, /class="card integrations-tile"/g), 9);
  assert.equal(countMatches(html, /class="tooldot integrations-tile__icon"/g), 9);
  assert.equal(countMatches(html, /class="lx-h3"/g), 9);
  assert.equal(countMatches(html, /class="lx-sm text-dim"/g), 10);
  assert.doesNotMatch(html, /#[0-9a-fA-F]{3,8}\b/);
});

test("renderIntegrations maps integration statuses to the required chip classes", () => {
  const html = renderIntegrations();

  assert.equal(countMatches(html, /class="chip chip--green">On<\/span>/g), 6);
  assert.equal(countMatches(html, /class="chip chip--accent">\+ Connect<\/span>/g), 1);
  assert.equal(countMatches(html, /class="chip chip--mcp">MCP<\/span>/g), 2);
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
