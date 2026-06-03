import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { cosineSimilarity, SQLiteMemoryStore } from "../src/memory/sqlite-memory-store.js";
import { closeDatabase, getDatabase } from "../src/realtime/tools/database.js";
import {
  createMockProviderRegistry,
  MockChatProvider,
  MockEmbeddingProvider,
} from "./helpers/mock-provider.js";

async function withMemoryDb(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), "leena-memory-store-"));
  const filePath = path.join(directory, "lena.db");
  try {
    await callback(filePath);
  } finally {
    closeDatabase(filePath);
    await rm(directory, { force: true, recursive: true });
  }
}

test("remember stores episodic entries with embedding BLOBs and ranked recall", async () => {
  await withMemoryDb(async (filePath) => {
    const embeddings = new MockEmbeddingProvider({
      "Coffee is the preferred morning drink.": [1, 0, 0],
      "Calendar reviews happen every Monday.": [0, 1, 0],
      coffee: [1, 0, 0],
    });
    const store = new SQLiteMemoryStore({
      dbPath: filePath,
      providerRegistry: createMockProviderRegistry({ embeddingsProvider: embeddings }),
    });

    const coffeeId = await store.remember("Coffee is the preferred morning drink.", {
      conversationId: "conversation-1",
      role: "user",
      source: "test",
    });
    await store.remember("Calendar reviews happen every Monday.", {
      conversationId: "conversation-1",
      role: "assistant",
    });

    const db = getDatabase(filePath);
    const stored = db
      .prepare("SELECT embedding, metadata FROM memories_episodic WHERE id = ?")
      .get(coffeeId);
    assert.equal(Buffer.from(stored.embedding).byteLength, Float32Array.BYTES_PER_ELEMENT * 3);
    assert.deepEqual(JSON.parse(stored.metadata), {
      conversationId: "conversation-1",
      role: "user",
      source: "test",
    });

    const recalled = await store.recall("coffee", 2);
    assert.equal(recalled.length, 1);
    assert.equal(recalled[0].entry.id, String(coffeeId));
    assert.equal(recalled[0].entry.type, "episodic");
    assert.equal(recalled[0].score, 1);

    store.close();
  });
});

test("cosineSimilarity handles known vectors and invalid inputs", () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([1, 1], [1, 0]), 1 / Math.sqrt(2));
  assert.equal(cosineSimilarity([1, 0], [1, 0, 0]), 0);
  assert.equal(cosineSimilarity([0, 0], [1, 0]), 0);
});

test("getEpisodic returns one conversation ordered by creation and row id", async () => {
  await withMemoryDb(async (filePath) => {
    const embeddings = new MockEmbeddingProvider({
      first: [1, 0],
      second: [0, 1],
      unrelated: [1, 1],
    });
    const store = new SQLiteMemoryStore({
      dbPath: filePath,
      providerRegistry: createMockProviderRegistry({ embeddingsProvider: embeddings }),
    });

    await store.remember("first", { conversationId: "conversation-ordered", role: "user" });
    await store.remember("unrelated", { conversationId: "conversation-other", role: "user" });
    await store.remember("second", {
      conversationId: "conversation-ordered",
      role: "assistant",
      turn: 2,
    });

    assert.deepEqual(
      store.getEpisodic("conversation-ordered").map((entry) => ({
        conversationId: entry.conversationId,
        role: entry.role,
        content: entry.content,
        metadata: entry.metadata,
      })),
      [
        {
          conversationId: "conversation-ordered",
          role: "user",
          content: "first",
          metadata: { conversationId: "conversation-ordered", role: "user" },
        },
        {
          conversationId: "conversation-ordered",
          role: "assistant",
          content: "second",
          metadata: {
            conversationId: "conversation-ordered",
            role: "assistant",
            turn: 2,
          },
        },
      ],
    );

    store.close();
  });
});

test("getEpisodes returns paginated live history across conversations", async () => {
  await withMemoryDb(async (filePath) => {
    const store = new SQLiteMemoryStore({ dbPath: filePath });

    await store.remember("Default conversation note", {
      conversationId: "default",
      role: "user",
    });
    await store.remember("Generated chat conversation note", {
      conversationId: "chat-conversation-1",
      role: "assistant",
    });
    await store.remember("Realtime generated conversation note", {
      conversationId: "realtime-1",
      role: "assistant",
    });

    const firstPage = store.getEpisodes({ limit: 2, page: 1 });
    assert.equal(firstPage.total, 3);
    assert.equal(firstPage.hasMore, true);
    assert.equal(firstPage.entries.length, 2);
    assert.deepEqual(
      firstPage.entries.map((entry) => entry.conversationId),
      ["realtime-1", "chat-conversation-1"],
    );

    const searched = store.getEpisodes({ limit: 5, page: 1, query: "Generated chat" });
    assert.equal(searched.total, 1);
    assert.equal(searched.entries[0].conversationId, "chat-conversation-1");

    store.close();
  });
});

test("getEpisodes clamps page and limit and escapes literal LIKE wildcards", async () => {
  await withMemoryDb(async (filePath) => {
    const store = new SQLiteMemoryStore({ dbPath: filePath });

    await store.remember("Budget is 100% confirmed.", {
      conversationId: "percent",
      role: "user",
    });
    await store.remember("Budget is 1000 confirmed.", {
      conversationId: "plain",
      role: "user",
    });

    const wildcardSearch = store.getEpisodes({ limit: 500, page: 1, query: "100%" });
    assert.equal(wildcardSearch.limit, 50);
    assert.equal(wildcardSearch.total, 1);
    assert.equal(wildcardSearch.entries[0].conversationId, "percent");

    const boundedPage = store.getEpisodes({ limit: 500, page: 999 });
    assert.equal(boundedPage.limit, 50);
    assert.equal(boundedPage.page, 500);
    assert.equal(boundedPage.entries.length, 0);

    store.close();
  });
});

test("consolidate creates semantic facts with embeddings and source episode links", async () => {
  await withMemoryDb(async (filePath) => {
    const embeddings = new MockEmbeddingProvider({
      "User says they prefer direct answers.": [1, 0, 0],
      "Assistant confirmed it will be concise.": [0.8, 0.2, 0],
      "User prefers direct answers.": [1, 0, 0],
      "User is building SQLite memory.": [0, 1, 0],
      "direct answers": [1, 0, 0],
    });
    const chat = new MockChatProvider(
      "- User prefers direct answers.\n- User is building SQLite memory.",
    );
    const store = new SQLiteMemoryStore({
      dbPath: filePath,
      providerRegistry: createMockProviderRegistry({
        chatProvider: chat,
        embeddingsProvider: embeddings,
      }),
    });

    const userEpisode = await store.remember("User says they prefer direct answers.", {
      conversationId: "conversation-consolidate",
      role: "user",
    });
    const assistantEpisode = await store.remember("Assistant confirmed it will be concise.", {
      conversationId: "conversation-consolidate",
      role: "assistant",
    });

    const result = await store.consolidate();
    assert.equal(result.episodic, 2);
    assert.equal(result.semantic, 2);
    assert.equal(result.ids.length, 2);
    assert.equal(chat.calls.length, 1);
    assert.equal(chat.calls[0].messages[0].role, "system");

    const db = getDatabase(filePath);
    const semanticRows = db
      .prepare(
        "SELECT category, content, embedding, source_episode_ids FROM memories_semantic ORDER BY id",
      )
      .all();
    assert.deepEqual(
      semanticRows.map((row) => ({
        category: row.category,
        content: row.content,
        sourceEpisodeIds: JSON.parse(row.source_episode_ids),
        hasEmbedding: row.embedding !== null,
      })),
      [
        {
          category: "preference",
          content: "User prefers direct answers.",
          sourceEpisodeIds: [String(userEpisode), String(assistantEpisode)],
          hasEmbedding: true,
        },
        {
          category: "general",
          content: "User is building SQLite memory.",
          sourceEpisodeIds: [String(userEpisode), String(assistantEpisode)],
          hasEmbedding: true,
        },
      ],
    );

    const recalled = await store.recall("direct answers", 1);
    assert.equal(recalled[0].entry.type, "semantic");
    assert.equal(recalled[0].entry.content, "User prefers direct answers.");

    store.close();
  });
});

test("stats count rows and close is idempotent", async () => {
  await withMemoryDb(async (filePath) => {
    const store = new SQLiteMemoryStore({ dbPath: filePath });

    assert.deepEqual(store.stats(), { episodic: 0, semantic: 0 });
    await store.remember("No provider is configured.", {
      conversationId: "conversation-stats",
      role: "tool",
    });
    getDatabase(filePath)
      .prepare("INSERT INTO memories_semantic (content) VALUES (?)")
      .run("Manual semantic fact.");
    assert.deepEqual(store.stats(), { episodic: 1, semantic: 1 });

    assert.equal(store.close(), undefined);
    assert.equal(store.close(), undefined);
  });
});

test("missing providers store without embeddings and use keyword recall fallback", async () => {
  await withMemoryDb(async (filePath) => {
    const store = new SQLiteMemoryStore({ dbPath: filePath });

    assert.deepEqual(await store.recall("anything", 5), []);
    await store.remember("Leena should remember keyword-only facts.", {
      conversationId: "conversation-fallback",
      role: "user",
    });

    const raw = getDatabase(filePath)
      .prepare("SELECT embedding FROM memories_episodic WHERE content = ?")
      .get("Leena should remember keyword-only facts.");
    assert.equal(raw.embedding, null);

    const recalled = await store.recall("keyword facts", 5);
    assert.equal(recalled.length, 1);
    assert.equal(recalled[0].entry.content, "Leena should remember keyword-only facts.");
    assert.ok(recalled[0].score > 0);

    const consolidation = await store.consolidate();
    assert.deepEqual(consolidation, { episodic: 1, semantic: 0, ids: [] });

    store.close();
  });
});

test("recall clamps direct store limits to a bounded result set", async () => {
  await withMemoryDb(async (filePath) => {
    const store = new SQLiteMemoryStore({ dbPath: filePath });

    for (let index = 0; index < 60; index += 1) {
      await store.remember(`bounded recall fact ${index + 1}`, {
        conversationId: "bounded-recall",
        role: "user",
      });
    }

    const recalled = await store.recall("bounded recall fact", 500);
    assert.equal(recalled.length, 50);

    store.close();
  });
});

test("recall on an empty database returns no matches", async () => {
  await withMemoryDb(async (filePath) => {
    const store = new SQLiteMemoryStore({
      dbPath: filePath,
      providerRegistry: createMockProviderRegistry(),
    });

    assert.deepEqual(await store.recall("coffee preference", 3), []);

    store.close();
  });
});

test("empty embedding provider stores content and falls back to keyword recall", async () => {
  await withMemoryDb(async (filePath) => {
    const registry = createMockProviderRegistry({ chat: false, embeddingMode: "empty" });
    const store = new SQLiteMemoryStore({ dbPath: filePath, providerRegistry: registry });

    const id = await store.remember("User likes espresso without embeddings.", {
      conversationId: "conversation-empty-embedding",
      role: "user",
    });
    const stored = getDatabase(filePath)
      .prepare("SELECT id, embedding FROM memories_episodic WHERE id = ?")
      .get(id);
    assert.equal(Number(stored.id), id);
    assert.equal(stored.embedding, null);

    const recalled = await store.recall("espresso", 1);
    assert.equal(recalled.length, 1);
    assert.equal(recalled[0].entry.id, String(id));
    assert.equal(recalled[0].entry.content, "User likes espresso without embeddings.");
    assert.ok(registry.embeddingsProvider.calls.length >= 2);

    store.close();
  });
});

test("concurrent remember calls persist distinct episodic rows", async () => {
  await withMemoryDb(async (filePath) => {
    const store = new SQLiteMemoryStore({
      dbPath: filePath,
      providerRegistry: createMockProviderRegistry(),
    });
    const count = 12;

    const ids = await Promise.all(
      Array.from({ length: count }, (_unused, index) =>
        store.remember(`Concurrent memory ${index + 1}`, {
          conversationId: "conversation-concurrent",
          role: "user",
          turn: index + 1,
        }),
      ),
    );

    assert.equal(ids.length, count);
    assert.equal(new Set(ids).size, count);
    const rows = getDatabase(filePath)
      .prepare(
        `
          SELECT id, content
          FROM memories_episodic
          WHERE conversation_id = ?
          ORDER BY id ASC
        `,
      )
      .all("conversation-concurrent");
    assert.equal(rows.length, count);
    assert.deepEqual(
      rows.map((row) => row.content),
      Array.from({ length: count }, (_unused, index) => `Concurrent memory ${index + 1}`),
    );

    store.close();
  });
});

test("large content stores and retrieves intact", async () => {
  await withMemoryDb(async (filePath) => {
    const store = new SQLiteMemoryStore({
      dbPath: filePath,
      providerRegistry: createMockProviderRegistry(),
    });
    const largeContent = `User likes espresso. ${"Detailed memory payload. ".repeat(520)}`;
    assert.ok(Buffer.byteLength(largeContent, "utf8") > 10 * 1024);

    const id = await store.remember(largeContent, {
      conversationId: "conversation-large-content",
      role: "user",
    });
    const [episode] = store.getEpisodic("conversation-large-content");
    assert.equal(episode.id, String(id));
    assert.equal(episode.content, largeContent);

    const recalled = await store.recall("espresso", 1);
    assert.equal(recalled.length, 1);
    assert.equal(recalled[0].entry.id, String(id));

    store.close();
  });
});
