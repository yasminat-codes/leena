import assert from "node:assert/strict";
import test from "node:test";

import { MOCK_HOME_DATA, renderHome } from "../src/renderer/screens/home.js";

function countMatches(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

test("MOCK_HOME_DATA contains the home screen content contract", () => {
  assert.equal(MOCK_HOME_DATA.greeting, "Good morning, Yasmine");
  assert.equal(MOCK_HOME_DATA.status, "READY");
  assert.equal(MOCK_HOME_DATA.askPlaceholder, "Ask Leena anything...");
  assert.equal(MOCK_HOME_DATA.prompt, "Brief me on my day");
  assert.ok(MOCK_HOME_DATA.recentActions.length >= 4);
  assert.ok(MOCK_HOME_DATA.upNext.length >= 2);

  for (const action of MOCK_HOME_DATA.recentActions) {
    assert.equal(typeof action.label, "string");
    assert.equal(typeof action.detail, "string");
    assert.ok(action.label.length > 0);
    assert.ok(action.detail.length > 0);
  }

  for (const item of MOCK_HOME_DATA.upNext) {
    assert.match(item.time, /^\d{2}:\d{2}$/);
    assert.equal(typeof item.title, "string");
    assert.equal(typeof item.detail, "string");
  }
});

test("renderHome returns mountable home screen HTML using design-system classes", () => {
  const html = renderHome();

  assert.match(html, /^\s*<section class="home-screen" aria-label="Home">/);
  assert.match(html, /class="panel-glass home-hero"/);
  assert.match(html, /class="lx-h1">Good morning, Yasmine<\/h1>/);
  assert.match(html, /class="lx-mono">READY<\/p>/);
  assert.match(html, /class="orb home-hero__orb"/);
  assert.match(html, /class="btn btn--ghost home-ask"/);
  assert.match(html, />\s*Ask Leena anything\.\.\.\s*<\/button>/);
  assert.match(html, /class="home-grid"/);
  assert.match(html, /Recent Actions/);
  assert.match(html, /Up Next/);
  assert.match(html, /class="grad home-brief"/);
  assert.match(html, /Brief me on my day/);
  assert.equal(
    countMatches(html, /class="row"/g),
    MOCK_HOME_DATA.recentActions.length + MOCK_HOME_DATA.upNext.length,
  );
  assert.ok(countMatches(html, /class="tooldot"/g) >= 4);
  assert.doesNotMatch(html, /#[0-9a-fA-F]{3,8}\b/);
});
