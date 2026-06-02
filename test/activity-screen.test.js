import assert from "node:assert/strict";
import test from "node:test";

import { MOCK_ACTIVITY_DATA, renderActivity } from "../src/renderer/screens/activity.js";

test("renderActivity returns an Activity screen with a conversation search input", () => {
  const html = renderActivity();

  assert.match(html, /<h2[^>]*class="lx-h2"[^>]*>Activity<\/h2>/);
  assert.match(html, /type="search"/);
  assert.match(html, /placeholder="Search conversations\.\.\."/);
  assert.match(html, /aria-label="Search conversations"/);
  assert.match(html, /class="btn btn--ghost activity-screen__search"/);
});

test("renderActivity renders every mock conversation as a tokenized row", () => {
  const html = renderActivity();
  const rowMatches = html.match(/class="row"/g) ?? [];

  assert.equal(rowMatches.length, MOCK_ACTIVITY_DATA.length);
  assert.ok(rowMatches.length >= 8);

  for (const item of MOCK_ACTIVITY_DATA) {
    assert.match(html, new RegExp(`data-activity-id="${item.id}"`));
    assert.match(html, new RegExp(`>${item.title}<`));
    assert.match(html, new RegExp(`>${item.preview}<`));
    assert.match(html, new RegExp(`>${item.timestamp}<`));
  }
});

test("renderActivity rows include icon, title, preview, and timestamp classes", () => {
  const html = renderActivity();

  assert.match(html, /class="tooldot lx-mono"/);
  assert.match(html, /class="lx-body screen-text-strong"/);
  assert.match(html, /class="lx-sm text-dim"/);
  assert.match(html, /class="lx-mono text-faint"/);
  assert.match(html, /class="card activity-screen__list" role="list"/);
});
