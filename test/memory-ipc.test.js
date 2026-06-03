import assert from "node:assert/strict";
import test from "node:test";

import {
  createMemoryIpcHandlers,
  MEMORY_IPC_CHANNELS,
  registerMemoryHandlers,
  serializeMemoryIpcError,
} from "../src/ipc/memory-handlers.js";

function createIpcMain() {
  const handlers = new Map();
  return {
    handlers,
    handle(channel, handler) {
      assert.equal(handlers.has(channel), false, `duplicate IPC handler: ${channel}`);
      handlers.set(channel, handler);
    },
  };
}

function createMockMemoryStore(overrides = {}) {
  const calls = {
    remember: [],
    recall: [],
    getConversation: [],
    getEpisodic: [],
    consolidate: 0,
    stats: 0,
  };
  return {
    calls,
    async remember(text, metadata = {}) {
      calls.remember.push({ metadata, text });
      if (overrides.remember instanceof Error) {
        throw overrides.remember;
      }
      return overrides.remember ?? 42;
    },
    async recall(query, limit) {
      calls.recall.push({ limit, query });
      if (overrides.recall instanceof Error) {
        throw overrides.recall;
      }
      return (
        overrides.recall ?? [
          {
            entry: {
              id: "memory-1",
              content: "User prefers concise answers.",
              createdAt: "2026-06-03T00:00:00.000Z",
              type: "semantic",
            },
            score: 0.92,
          },
        ]
      );
    },
    getConversation(conversationId) {
      calls.getConversation.push(conversationId);
      if (overrides.getConversation instanceof Error) {
        throw overrides.getConversation;
      }
      return (
        overrides.getConversation ?? [
          {
            id: "episode-1",
            conversationId,
            role: "user",
            content: "remember this",
            createdAt: "2026-06-03T00:00:00.000Z",
            type: "episodic",
          },
        ]
      );
    },
    getEpisodic(conversationId) {
      calls.getEpisodic.push(conversationId);
      if (overrides.getEpisodic instanceof Error) {
        throw overrides.getEpisodic;
      }
      return overrides.getEpisodic ?? [];
    },
    async consolidate() {
      calls.consolidate += 1;
      if (overrides.consolidate instanceof Error) {
        throw overrides.consolidate;
      }
      return overrides.consolidate ?? { episodic: 3, semantic: 2, ids: [7, 8] };
    },
    stats() {
      calls.stats += 1;
      if (overrides.stats instanceof Error) {
        throw overrides.stats;
      }
      return overrides.stats ?? { episodic: 5, semantic: 2 };
    },
  };
}

test("registerMemoryHandlers wires every memory IPC channel", () => {
  const ipcMain = createIpcMain();
  const store = createMockMemoryStore();

  const registration = registerMemoryHandlers({ ipcMain, store });

  assert.deepEqual(registration.channels, MEMORY_IPC_CHANNELS);
  assert.deepEqual([...ipcMain.handlers.keys()], Object.values(MEMORY_IPC_CHANNELS));
  assert.equal(ipcMain.handlers.get(MEMORY_IPC_CHANNELS.remember), registration.handlers.remember);
  assert.equal(
    ipcMain.handlers.get(MEMORY_IPC_CHANNELS.getConversation),
    registration.handlers.getConversation,
  );
  for (const handler of ipcMain.handlers.values()) {
    assert.equal(typeof handler, "function");
  }
});

test("remember validates input and delegates to the memory store", async () => {
  const store = createMockMemoryStore({ remember: "episode-42" });
  const { remember } = createMemoryIpcHandlers({ store });

  const result = await remember(null, {
    text: "  User likes narrow task scopes.  ",
    metadata: { conversationId: "conversation-1", role: "user" },
  });

  assert.deepEqual(result, { id: "episode-42" });
  assert.deepEqual(store.calls.remember, [
    {
      text: "User likes narrow task scopes.",
      metadata: { conversationId: "conversation-1", role: "user" },
    },
  ]);
  assert.deepEqual(await remember(null, { text: "" }), {
    error: "Memory text must be a non-empty string.",
  });
  assert.deepEqual(await remember(null, { text: "ok", metadata: [] }), {
    error: "Memory metadata must be an object.",
  });
  assert.equal(store.calls.remember.length, 1);
});

test("recall validates query and limit before delegation", async () => {
  const store = createMockMemoryStore();
  const { recall } = createMemoryIpcHandlers({ store });

  const defaultResult = await recall(null, { query: "  coffee  " });
  assert.equal(defaultResult[0].entry.id, "memory-1");
  assert.deepEqual(store.calls.recall.at(-1), { query: "coffee", limit: 5 });

  await recall(null, { query: "planner", limit: 2 });
  assert.deepEqual(store.calls.recall.at(-1), { query: "planner", limit: 2 });

  assert.deepEqual(await recall(null, { query: "planner", limit: -1 }), {
    error: "Memory recall limit must be a positive integer.",
  });
  assert.deepEqual(await recall(null, { query: " " }), {
    error: "Memory recall query must be a non-empty string.",
  });
  assert.equal(store.calls.recall.length, 2);
});

test("get-conversation validates input and prefers explicit store getConversation", async () => {
  const store = createMockMemoryStore();
  const { getConversation } = createMemoryIpcHandlers({ store });

  const result = await getConversation(null, { conversationId: "  conversation-7 " });

  assert.equal(result[0].conversationId, "conversation-7");
  assert.deepEqual(store.calls.getConversation, ["conversation-7"]);
  assert.deepEqual(store.calls.getEpisodic, []);
  assert.deepEqual(await getConversation(null, { conversationId: "" }), {
    error: "Memory conversationId must be a non-empty string.",
  });
});

test("get-conversation falls back to SQLiteMemoryStore getEpisodic", async () => {
  const store = createMockMemoryStore({
    getEpisodic: [{ id: "episode-2", conversationId: "conversation-8" }],
  });
  delete store.getConversation;

  const { getConversation } = createMemoryIpcHandlers({ store });

  assert.deepEqual(await getConversation(null, "conversation-8"), [
    { id: "episode-2", conversationId: "conversation-8" },
  ]);
  assert.deepEqual(store.calls.getEpisodic, ["conversation-8"]);
});

test("consolidate maps store results to the IPC newFacts contract", async () => {
  const store = createMockMemoryStore({
    consolidate: { episodic: 4, semantic: 3, ids: [1, 2, 3] },
  });
  const { consolidate } = createMemoryIpcHandlers({ store });

  assert.deepEqual(await consolidate(), { newFacts: 3 });
  assert.equal(store.calls.consolidate, 1);
});

test("stats delegates to the memory store", async () => {
  const store = createMockMemoryStore({ stats: { episodic: 9, semantic: 4 } });
  const { stats } = createMemoryIpcHandlers({ store });

  assert.deepEqual(await stats(), { episodic: 9, semantic: 4 });
  assert.equal(store.calls.stats, 1);
});

test("store errors are wrapped as structured IPC errors", async () => {
  const store = createMockMemoryStore({ remember: new Error("SQLiteMemoryStore is closed") });
  const { remember } = createMemoryIpcHandlers({ store });

  assert.deepEqual(await remember(null, { text: "save me" }), {
    error: "SQLiteMemoryStore is closed",
  });
  assert.deepEqual(serializeMemoryIpcError("plain failure"), { error: "plain failure" });
});
