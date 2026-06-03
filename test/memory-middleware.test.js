import assert from "node:assert/strict";
import test from "node:test";

import { createMemoryMiddleware } from "../src/memory/memory-middleware.js";

function createMockMemoryStore(overrides = {}) {
  const calls = [];
  return {
    calls,
    async recall(query, limit) {
      calls.push({ method: "recall", query, limit });
      if (overrides.recall instanceof Error) {
        throw overrides.recall;
      }
      return overrides.recall ?? [];
    },
    async remember(content, metadata) {
      calls.push({ method: "remember", content, metadata });
      if (overrides.remember instanceof Error) {
        throw overrides.remember;
      }
      return overrides.remember ?? 42;
    },
    async getEpisodic(conversationId) {
      calls.push({ method: "getEpisodic", conversationId });
      if (overrides.getEpisodic instanceof Error) {
        throw overrides.getEpisodic;
      }
      return overrides.getEpisodic ?? [];
    },
    async consolidate() {
      calls.push({ method: "consolidate" });
      if (overrides.consolidate instanceof Error) {
        throw overrides.consolidate;
      }
      return overrides.consolidate ?? { episodic: 11, semantic: 1, ids: [7] };
    },
  };
}

function createEpisodes(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: String(index + 1),
    conversationId: "conversation-1",
    role: index % 2 === 0 ? "user" : "assistant",
    content: `message ${index + 1}`,
  }));
}

test("onSessionStart recalls memories from profile context", async () => {
  const memories = [
    {
      entry: { id: "1", content: "Ken prefers direct answers.", type: "semantic" },
      score: 0.91,
    },
  ];
  const store = createMockMemoryStore({ recall: memories });
  const middleware = createMemoryMiddleware(store);

  const recalled = await middleware.onSessionStart({
    name: " Ken ",
    about: " Builds Leena ",
  });

  assert.deepEqual(recalled, memories);
  assert.deepEqual(store.calls, [
    {
      method: "recall",
      query: "Ken Builds Leena",
      limit: 10,
    },
  ]);
});

test("onExchange stores each non-empty conversation exchange", async () => {
  const store = createMockMemoryStore({ remember: 99 });
  const middleware = createMemoryMiddleware(store);

  const id = await middleware.onExchange(" conversation-1 ", "assistant", "  Done.  ");

  assert.equal(id, 99);
  assert.deepEqual(store.calls, [
    {
      method: "remember",
      content: "Done.",
      metadata: {
        conversationId: "conversation-1",
        role: "assistant",
      },
    },
  ]);
});

test("onSessionEnd consolidates only after the episodic threshold is exceeded", async () => {
  const store = createMockMemoryStore({
    getEpisodic: createEpisodes(11),
    consolidate: { episodic: 11, semantic: 2, ids: [1, 2] },
  });
  const middleware = createMemoryMiddleware(store);

  const result = await middleware.onSessionEnd("conversation-1");

  assert.deepEqual(result, { episodic: 11, semantic: 2, ids: [1, 2] });
  assert.deepEqual(store.calls, [
    { method: "getEpisodic", conversationId: "conversation-1" },
    { method: "consolidate" },
  ]);
});

test("onSessionEnd skips consolidation at the threshold", async () => {
  const store = createMockMemoryStore({
    getEpisodic: createEpisodes(10),
  });
  const middleware = createMemoryMiddleware(store);

  assert.equal(await middleware.onSessionEnd("conversation-1"), null);
  assert.deepEqual(store.calls, [{ method: "getEpisodic", conversationId: "conversation-1" }]);
});

test("middleware gracefully degrades without a memory store", async () => {
  const middleware = createMemoryMiddleware(null);

  assert.deepEqual(await middleware.onSessionStart({ name: "Ken" }), []);
  assert.equal(await middleware.onExchange("conversation-1", "user", "remember this"), null);
  assert.equal(await middleware.onSessionEnd("conversation-1"), null);
});

test("middleware swallows store failures and skips blank exchanges", async () => {
  const store = createMockMemoryStore({
    recall: new Error("provider unavailable"),
    remember: new Error("store closed"),
    getEpisodic: new Error("db closed"),
  });
  const middleware = createMemoryMiddleware(store);

  assert.deepEqual(await middleware.onSessionStart({ name: "Ken" }), []);
  assert.equal(await middleware.onExchange("conversation-1", "user", "   "), null);
  assert.equal(await middleware.onExchange("conversation-1", "user", "remember this"), null);
  assert.equal(await middleware.onSessionEnd("conversation-1"), null);
  assert.deepEqual(store.calls, [
    { method: "recall", query: "Ken", limit: 10 },
    {
      method: "remember",
      content: "remember this",
      metadata: { conversationId: "conversation-1", role: "user" },
    },
    { method: "getEpisodic", conversationId: "conversation-1" },
  ]);
});
