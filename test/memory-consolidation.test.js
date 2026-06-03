import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { SQLiteMemoryStore } from "../src/memory/sqlite-memory-store.js";
import { closeDatabase, getDatabase } from "../src/realtime/tools/database.js";
import { createMockProviderRegistry } from "./helpers/mock-provider.js";

async function withTempMemoryDb(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), "leena-memory-consolidation-"));
  const filePath = path.join(directory, "lena.db");
  try {
    await callback(filePath);
  } finally {
    closeDatabase(filePath);
    await rm(directory, { force: true, recursive: true });
  }
}

test("consolidation creates recallable semantic facts linked to source episodes", async () => {
  await withTempMemoryDb(async (filePath) => {
    const espressoFact = "User likes espresso.";
    const directFact = "User prefers direct planning updates.";
    const providerRegistry = createMockProviderRegistry({
      chatContent: `- ${espressoFact}\n- ${directFact}`,
      embeddingVectors: {
        [espressoFact]: [1, 0, 0],
        [directFact]: [0, 1, 0],
        "espresso preference": [1, 0, 0],
      },
    });
    const store = new SQLiteMemoryStore({ dbPath: filePath, providerRegistry });
    const episodeIds = [];

    for (let index = 0; index < 15; index += 1) {
      const content =
        index === 3
          ? "User said espresso is their favorite coffee."
          : `Conversation turn ${index + 1} about durable assistant memory.`;
      episodeIds.push(
        await store.remember(content, {
          conversationId: "conversation-consolidation",
          role: index % 2 === 0 ? "user" : "assistant",
          turn: index + 1,
        }),
      );
    }

    const result = await store.consolidate();
    assert.equal(result.episodic, 15);
    assert.ok(result.semantic >= 1);
    assert.equal(result.ids.length, result.semantic);
    assert.equal(providerRegistry.chatProvider.calls.length, 1);

    const semanticRows = getDatabase(filePath)
      .prepare(
        `
          SELECT id, content, source_episode_ids
          FROM memories_semantic
          ORDER BY id ASC
        `,
      )
      .all()
      .map((row) => ({
        id: String(row.id),
        content: row.content,
        sourceEpisodeIds: JSON.parse(row.source_episode_ids),
      }));
    const expectedEpisodeIds = episodeIds.map((id) => String(id));

    assert.ok(semanticRows.some((row) => row.content === espressoFact));
    for (const row of semanticRows) {
      assert.deepEqual(row.sourceEpisodeIds, expectedEpisodeIds);
    }

    const recalled = await store.recall("espresso preference", 3);
    assert.ok(
      recalled.some(
        (resultItem) =>
          resultItem.entry.type === "semantic" && resultItem.entry.content === espressoFact,
      ),
    );

    store.close();
  });
});
