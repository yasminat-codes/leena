import assert from "node:assert/strict";
import test from "node:test";

import { toggleConversationCard } from "../src/renderer/components/conversation-card.js";
import {
  getActivityDateGroupLabel,
  groupActivityEntriesByConversation,
  groupConversationsByDate,
  loadActivity,
  mergeAndRankSearchResults,
  renderActivityData,
} from "../src/renderer/screens/activity.js";

const fixedNow = new Date(2026, 5, 3, 15, 0, 0);

function episode(overrides = {}) {
  return {
    content: "Leena remembered the espresso preference.",
    conversationId: "conversation-a",
    createdAt: "2026-06-03T14:00:00.000Z",
    id: "episode-1",
    role: "assistant",
    ...overrides,
  };
}

class FakeElement {
  constructor({ card = null, dataset = {}, transcript = null } = {}) {
    this.attributes = new Map();
    this.dataset = dataset;
    this.hidden = false;
    this.innerHTML = "";
    this.card = card;
    this.transcript = transcript;
  }

  closest(selector) {
    return selector === "[data-conversation-card]" ? this.card : null;
  }

  querySelector(selector) {
    return selector === "[data-conversation-transcript]" ? this.transcript : null;
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
}

test("loadActivity merges keyword episodes with semantic recall using bounded search input", async () => {
  const calls = [];
  const longQuery = `${"espresso ".repeat(30)}tail`;
  const bridge = {
    memory: {
      async getEpisodes(payload) {
        calls.push(["getEpisodes", payload]);
        return {
          entries: [
            episode({
              content: "Keyword match for espresso.",
              ftsScore: 0.5,
              id: "episode-keyword",
            }),
          ],
          hasMore: false,
          total: 1,
        };
      },
      async recall(query, limit) {
        calls.push(["recall", query, limit]);
        return [
          {
            entry: episode({
              content: "Semantic match: user prefers ristretto in the morning.",
              id: "episode-semantic",
            }),
            score: 0.95,
          },
        ];
      },
    },
  };

  const data = await loadActivity({ limit: 500, page: 999, query: longQuery }, bridge);

  assert.equal(calls[0][1].limit, 50);
  assert.equal(calls[0][1].page, 500);
  assert.equal(calls[0][1].query.length, 200);
  assert.deepEqual(calls[1], ["recall", calls[0][1].query, 20]);
  assert.deepEqual(
    data.entries.map((entry) => entry.id),
    ["episode-semantic", "episode-keyword"],
  );
  assert.deepEqual(data.entries[0].matchSources, ["semantic"]);
  assert.equal(data.query.length, 200);
});

test("mergeAndRankSearchResults de-duplicates by entry id and combines scores", () => {
  const ranked = mergeAndRankSearchResults(
    [episode({ ftsScore: 0.7, id: "episode-a" }), episode({ ftsScore: 0.4, id: "episode-b" })],
    [
      {
        entry: episode({
          content: "Semantic duplicate with higher conceptual match.",
          id: "episode-a",
        }),
        score: 0.9,
      },
      {
        entry: episode({ conversationId: "conversation-c", id: "episode-c" }),
        score: 0.9,
      },
    ],
  );

  assert.deepEqual(
    ranked.map((entry) => entry.id),
    ["episode-a", "episode-c", "episode-b"],
  );
  assert.equal(ranked.length, 3);
  assert.equal(ranked[0].combinedScore, 0.78);
  assert.deepEqual(ranked[0].matchSources, ["keyword", "semantic"]);
  assert.equal(ranked[0].relevance.level, "high");
  assert.equal(ranked[1].relevance.level, "medium");
  assert.equal(ranked[2].relevance, null);
});

test("conversation groups are bucketed into local date headers", () => {
  const groups = groupActivityEntriesByConversation([
    episode({ conversationId: "today", createdAt: "2026-06-03T00:10:00", id: "today" }),
    episode({
      conversationId: "yesterday",
      createdAt: "2026-06-02T23:50:00",
      id: "yesterday",
    }),
    episode({ conversationId: "week", createdAt: "2026-05-30T12:00:00", id: "week" }),
    episode({ conversationId: "older", createdAt: "2026-05-20T12:00:00", id: "older" }),
  ]);

  assert.equal(getActivityDateGroupLabel("2026-06-03T00:01:00", fixedNow), "Today");
  assert.equal(getActivityDateGroupLabel("2026-06-02T23:59:00", fixedNow), "Yesterday");
  assert.equal(getActivityDateGroupLabel("2026-05-30T12:00:00", fixedNow), "This Week");
  assert.equal(getActivityDateGroupLabel("2026-05-20T12:00:00", fixedNow), "Older");
  assert.deepEqual(
    groupConversationsByDate(groups, fixedNow).map((group) => group.label),
    ["Today", "Yesterday", "This Week", "Older"],
  );
});

test("renderActivityData shows date headers, relevance badges, and search empty state", () => {
  const html = renderActivityData({
    entries: [
      {
        ...episode({
          content: "Unsafe <script>alert(1)</script> transcript preview.",
          id: "episode-rendered",
        }),
        combinedScore: 0.82,
        matchSources: ["keyword", "semantic"],
        relevance: { level: "high", score: 0.82 },
      },
    ],
    now: fixedNow,
    query: "espresso",
  });
  const empty = renderActivityData({ entries: [], query: "coffee <milk>" });

  assert.match(html, /data-activity-date-group="Today"/);
  assert.match(html, /data-conversation-toggle/);
  assert.match(html, /data-activity-relevance="high"/);
  assert.match(html, /Unsafe &lt;script&gt;alert\(1\)&lt;\/script&gt; transcript preview\./);
  assert.doesNotMatch(html, /<script>/);
  assert.match(empty, /No results for/);
  assert.match(empty, /coffee &lt;milk&gt;/);
});

test("toggleConversationCard lazily loads, escapes, caches, and collapses transcripts", async () => {
  const transcript = new FakeElement();
  const card = new FakeElement({ transcript });
  const toggle = new FakeElement({ card, dataset: { conversationId: "conversation-a" } });
  const calls = [];
  const bridge = {
    memory: {
      async getConversation(conversationId) {
        calls.push(conversationId);
        return [
          episode({
            content: "Second unsafe <script>alert(1)</script> turn.",
            createdAt: "2026-06-03T14:10:00.000Z",
            id: "turn-2",
            role: "assistant",
          }),
          episode({
            content: "First user turn.",
            createdAt: "2026-06-03T14:00:00.000Z",
            id: "turn-1",
            role: "user",
          }),
        ];
      },
    },
  };

  const expanded = await toggleConversationCard(toggle, bridge);

  assert.deepEqual(expanded, { expanded: true, loaded: true });
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
  assert.equal(transcript.hidden, false);
  assert.deepEqual(calls, ["conversation-a"]);
  assert.ok(
    transcript.innerHTML.indexOf("First user turn.") <
      transcript.innerHTML.indexOf("Second unsafe"),
  );
  assert.match(
    transcript.innerHTML,
    /Second unsafe &lt;script&gt;alert\(1\)&lt;\/script&gt; turn\./,
  );
  assert.doesNotMatch(transcript.innerHTML, /<script>/);

  const collapsed = await toggleConversationCard(toggle, bridge);
  assert.deepEqual(collapsed, { expanded: false, loaded: true });
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.equal(transcript.hidden, true);

  const expandedAgain = await toggleConversationCard(toggle, bridge);
  assert.deepEqual(expandedAgain, { expanded: true, loaded: true });
  assert.deepEqual(calls, ["conversation-a"]);
});
