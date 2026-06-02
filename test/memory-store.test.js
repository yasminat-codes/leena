import assert from "node:assert/strict";
import test from "node:test";
import { MemoryStore } from "../src/memory/index.js";
import { MemoryStore as DirectMemoryStore } from "../src/memory/memory-store.js";

const abstractCalls = [
  ["remember", (store) => store.remember("Ken likes direct answers", { source: "test" })],
  ["recall", (store) => store.recall("direct answers", 3)],
  ["getEpisodic", (store) => store.getEpisodic("conversation-1")],
  ["consolidate", (store) => store.consolidate()],
  ["stats", (store) => store.stats()],
  ["close", (store) => store.close()],
];

class MinimalMemoryStore extends MemoryStore {
  constructor() {
    super();
    this.closed = false;
    this.entries = [];
  }

  remember(text, metadata = {}) {
    const entry = {
      id: `memory-${this.entries.length + 1}`,
      content: text,
      type: "episodic",
      embedding: null,
      createdAt: "2026-06-02T00:00:00.000Z",
      metadata: { ...metadata },
    };
    this.entries.push(entry);
    return entry;
  }

  recall(query, limit = 10) {
    return this.entries
      .filter((entry) => entry.content.includes(query))
      .slice(0, limit)
      .map((entry) => ({ entry, score: 1 }));
  }

  getEpisodic(conversationId) {
    return this.entries.filter((entry) => entry.metadata.conversationId === conversationId);
  }

  consolidate() {
    return {
      episodicCount: this.entries.length,
      semanticCount: 0,
    };
  }

  stats() {
    return {
      closed: this.closed,
      count: this.entries.length,
    };
  }

  close() {
    this.closed = true;
  }
}

test("barrel export exposes the MemoryStore class", () => {
  assert.equal(MemoryStore, DirectMemoryStore);
});

test("abstract MemoryStore methods throw Not implemented", () => {
  const store = new MemoryStore();

  for (const [method, call] of abstractCalls) {
    assert.throws(
      call.bind(null, store),
      {
        message: "Not implemented",
      },
      `${method} should throw`,
    );
  }
});

test("minimal subclass implements the memory interface", () => {
  const store = new MinimalMemoryStore();
  const remembered = store.remember("Ken likes direct answers", {
    conversationId: "conversation-1",
  });

  assert.deepEqual(remembered, {
    id: "memory-1",
    content: "Ken likes direct answers",
    type: "episodic",
    embedding: null,
    createdAt: "2026-06-02T00:00:00.000Z",
    metadata: {
      conversationId: "conversation-1",
    },
  });
  assert.deepEqual(store.recall("direct", 1), [{ entry: remembered, score: 1 }]);
  assert.deepEqual(store.getEpisodic("conversation-1"), [remembered]);
  assert.deepEqual(store.consolidate(), {
    episodicCount: 1,
    semanticCount: 0,
  });
  assert.deepEqual(store.stats(), {
    closed: false,
    count: 1,
  });
});

test("minimal subclass close is callable and idempotent", () => {
  const store = new MinimalMemoryStore();

  assert.equal(store.close(), undefined);
  assert.equal(store.close(), undefined);
  assert.deepEqual(store.stats(), {
    closed: true,
    count: 0,
  });
});
