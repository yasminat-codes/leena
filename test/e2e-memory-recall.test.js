import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { SQLiteMemoryStore } from "../src/memory/sqlite-memory-store.js";
import { EMBEDDINGS } from "../src/providers/types.js";
import { closeDatabase } from "../src/realtime/tools/database.js";

test("memory recall survives closing and reopening the same SQLite store", async () => {
  await withMemoryDb(async (dbPath) => {
    const providerRegistry = new MockProviderRegistry(new DeterministicEmbeddingProvider());
    const firstSession = new SQLiteMemoryStore({ dbPath, providerRegistry });

    await firstSession.remember("user likes espresso", {
      conversationId: "session-1",
      role: "user",
    });
    await firstSession.remember("user prefers quiet mornings", {
      conversationId: "session-1",
      role: "assistant",
    });
    firstSession.close();

    const secondSession = new SQLiteMemoryStore({ dbPath, providerRegistry });
    try {
      const recalled = await secondSession.recall("coffee preference", 2);

      assert.equal(recalled.length >= 1, true);
      assert.equal(recalled[0].entry.type, "episodic");
      assert.equal(recalled[0].entry.content, "user likes espresso");
      assert.ok(recalled[0].score > 0.99);
    } finally {
      secondSession.close();
    }
  });
});

async function withMemoryDb(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), "leena-e2e-memory-"));
  const dbPath = path.join(directory, "lena.db");
  try {
    await callback(dbPath);
  } finally {
    closeDatabase(dbPath);
    await rm(directory, { force: true, recursive: true });
  }
}

class MockProviderRegistry {
  constructor(embeddingProvider) {
    this.embeddingProvider = embeddingProvider;
  }

  getDefault(capability) {
    return capability === EMBEDDINGS ? this.embeddingProvider : null;
  }

  getForCapability(capability) {
    return capability === EMBEDDINGS ? [this.embeddingProvider] : [];
  }
}

class DeterministicEmbeddingProvider {
  constructor() {
    this.calls = [];
  }

  async embed(request) {
    const input = typeof request === "string" ? request : request.input;
    this.calls.push(input);
    return {
      embeddings: [vectorFor(input)],
      model: "deterministic-e2e-embedding",
    };
  }
}

function vectorFor(value) {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("espresso") || text.includes("coffee preference")) {
    return [1, 0, 0];
  }
  if (text.includes("quiet")) {
    return [0, 1, 0];
  }
  return [0, 0, 1];
}
