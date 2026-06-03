import assert from "node:assert/strict";
import test from "node:test";

import {
  createDebouncedSearch,
  groupActivityEntriesByConversation,
  loadActivity,
  mergeActivityPages,
  renderActivityData,
} from "../src/renderer/screens/activity.js";

function episode(overrides = {}) {
  return {
    content: "Leena remembered the follow-up.",
    conversationId: "conversation-a",
    createdAt: "2026-06-03T14:41:00.000Z",
    id: "episode-1",
    role: "assistant",
    ...overrides,
  };
}

test("loadActivity calls memory:get-episodes with pagination and search payload", async () => {
  const calls = [];
  const bridge = {
    async invoke(channel, payload) {
      calls.push({ channel, payload });
      return {
        entries: [
          episode({
            content: "Launch search result from live episodic memory.",
            id: "episode-3",
            role: "user",
          }),
        ],
        total: 5,
      };
    },
  };

  const data = await loadActivity({ limit: 2, page: 2, query: "  launch  " }, bridge);

  assert.deepEqual(calls, [
    {
      channel: "memory:get-episodes",
      payload: { limit: 2, page: 2, query: "launch" },
    },
  ]);
  assert.equal(data.page, 2);
  assert.equal(data.limit, 2);
  assert.equal(data.query, "launch");
  assert.equal(data.total, 5);
  assert.equal(data.hasMore, true);
  assert.deepEqual(
    data.entries.map((entry) => entry.id),
    ["episode-3"],
  );
  assert.equal(data.entries[0].roleLabel, "You");
  assert.equal(data.entries[0].conversationId, "conversation-a");
});

test("loadActivity falls back to the current memory bridge when get-episodes is missing", async () => {
  const calls = [];
  const bridge = {
    async invoke() {
      throw new Error("No handler registered for memory:get-episodes");
    },
    memory: {
      async getConversation(conversationId) {
        calls.push(conversationId);
        return [
          episode({ id: "episode-1" }),
          episode({ id: "episode-2" }),
          episode({ id: "episode-3" }),
        ];
      },
    },
  };

  const data = await loadActivity({ limit: 2, page: 2 }, bridge);

  assert.deepEqual(calls, ["default"]);
  assert.deepEqual(
    data.entries.map((entry) => entry.id),
    ["episode-3"],
  );
  assert.equal(data.total, 3);
  assert.equal(data.hasMore, false);
});

test("loadActivity reads live memory episodes across generated conversation ids", async () => {
  const calls = [];
  const bridge = {
    memory: {
      async getEpisodes(payload) {
        calls.push(payload);
        return {
          entries: [
            episode({
              conversationId: "cc-chat-conversation-abc",
              content: "Generated chat history entry.",
              id: "episode-generated",
            }),
          ],
          hasMore: false,
          total: 1,
        };
      },
    },
  };

  const data = await loadActivity({ limit: 20, page: 1, query: "chat" }, bridge);

  assert.deepEqual(calls, [{ limit: 20, page: 1, query: "chat" }]);
  assert.equal(data.entries[0].conversationId, "cc-chat-conversation-abc");
  assert.equal(data.entries[0].preview, "Generated chat history entry.");
});

test("mergeActivityPages appends new pages without duplicating episodes", () => {
  const merged = mergeActivityPages(
    [episode({ id: "episode-1" })],
    [episode({ id: "episode-2" }), episode({ id: "episode-1" })],
  );

  assert.deepEqual(
    merged.map((entry) => entry.id),
    ["episode-1", "episode-2"],
  );
});

test("createDebouncedSearch fires only the last search term", () => {
  const scheduled = [];
  const cleared = [];
  const fired = [];
  const timers = {
    clearTimeout(id) {
      cleared.push(id);
    },
    setTimeout(callback, delay) {
      const timer = { callback, delay, id: scheduled.length + 1 };
      scheduled.push(timer);
      return timer;
    },
  };
  const search = createDebouncedSearch((query) => fired.push(query), 300, timers);

  search("l");
  search("le");
  search("lee");
  scheduled.at(-1).callback();

  assert.deepEqual(
    scheduled.map((timer) => timer.delay),
    [300, 300, 300],
  );
  assert.deepEqual(
    cleared.map((timer) => timer.id),
    [1, 2],
  );
  assert.deepEqual(fired, ["lee"]);
});

test("renderActivityData renders conversation and search empty states", () => {
  const empty = renderActivityData({ entries: [] });
  const searched = renderActivityData({ entries: [], query: "ops <plan> & review" });

  assert.match(empty, /No conversations yet/);
  assert.match(empty, /Saved conversations will appear/);
  assert.match(searched, /No results for/);
  assert.match(searched, /ops &lt;plan&gt; &amp; review/);
  assert.doesNotMatch(searched, /ops <plan> & review/);
});

test("renderActivityData escapes live data and groups entries by conversation", () => {
  const longContent = `${"a".repeat(121)} unsafe <script>`;
  const entries = [
    episode({
      content: "User said <script>alert(1)</script> & keep going.",
      conversation_id: "conv<&>",
      conversationId: undefined,
      id: 'episode-"1"',
      role: "user",
    }),
    episode({
      content: longContent,
      conversationId: "conv<&>",
      id: "episode-2",
      role: "assistant",
    }),
    episode({
      content: "Tool output",
      conversationId: "conv-b",
      id: "episode-3",
      role: "tool",
    }),
  ];

  const groups = groupActivityEntriesByConversation(entries);
  const html = renderActivityData({ entries, hasMore: true });

  assert.deepEqual(
    groups.map((group) => ({ conversationId: group.conversationId, count: group.entries.length })),
    [
      { conversationId: "conv<&>", count: 2 },
      { conversationId: "conv-b", count: 1 },
    ],
  );
  assert.match(html, /data-activity-conversation="conv&lt;&amp;&gt;"/);
  assert.match(html, /data-activity-id="episode-&quot;1&quot;"/);
  assert.match(html, /User said &lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; keep going\./);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, new RegExp(longContent));
  assert.match(html, /Load more/);
  assert.doesNotMatch(html, /data-activity-load-more hidden/);
});
