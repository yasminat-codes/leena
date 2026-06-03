import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { SQLiteMemoryStore } from "../src/memory/sqlite-memory-store.js";
import { closeDatabase, getDatabase } from "../src/realtime/tools/database.js";
import { createMockProviderRegistry } from "./helpers/mock-provider.js";

async function withTempMemoryDb(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), "leena-memory-cross-session-"));
  const filePath = path.join(directory, "lena.db");
  try {
    await callback(filePath);
  } finally {
    closeDatabase(filePath);
    await rm(directory, { force: true, recursive: true });
  }
}

function countEpisodicRows(filePath) {
  return Number(
    getDatabase(filePath).prepare("SELECT COUNT(*) AS count FROM memories_episodic").get().count,
  );
}

test("fact remembered in session one is recalled by a fresh session two store", async () => {
  await withTempMemoryDb(async (filePath) => {
    const providerRegistry = createMockProviderRegistry({
      embeddingVectors: {
        "User likes espresso": [1, 0, 0],
        "coffee preference": [1, 0, 0],
      },
    });

    const sessionOneStore = new SQLiteMemoryStore({ dbPath: filePath, providerRegistry });
    const rememberedId = await sessionOneStore.remember("User likes espresso", {
      conversationId: "sess-1",
      role: "user",
    });
    assert.equal(countEpisodicRows(filePath), 1);
    sessionOneStore.close();

    const sessionTwoStore = new SQLiteMemoryStore({ dbPath: filePath, providerRegistry });
    const recalled = await sessionTwoStore.recall("coffee preference", 1);

    assert.equal(countEpisodicRows(filePath), 1);
    assert.equal(recalled.length, 1);
    assert.equal(recalled[0].entry.id, String(rememberedId));
    assert.equal(recalled[0].entry.conversationId, "sess-1");
    assert.match(recalled[0].entry.content, /espresso/i);

    sessionTwoStore.close();
  });
});
