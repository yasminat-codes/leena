import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { closeDatabase, getDatabase } from "../src/realtime/tools/database.js";

async function withMemoryDb(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), "leena-memory-tables-"));
  const filePath = path.join(directory, "lena.db");
  try {
    await callback(filePath);
  } finally {
    closeDatabase(filePath);
    await rm(directory, { force: true, recursive: true });
  }
}

function tableColumns(db, tableName) {
  return new Map(
    db
      .prepare(`PRAGMA table_info(${tableName})`)
      .all()
      .map((column) => [column.name, column]),
  );
}

function indexNames(db) {
  return new Set(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
      .all()
      .map((row) => row.name),
  );
}

test("memory schema creates episodic and semantic columns", async () => {
  await withMemoryDb((filePath) => {
    const db = getDatabase(filePath);
    const episodic = tableColumns(db, "memories_episodic");
    const semantic = tableColumns(db, "memories_semantic");

    assert.deepEqual(
      [...episodic.keys()],
      ["id", "conversation_id", "role", "content", "embedding", "created_at", "metadata"],
    );
    assert.equal(episodic.get("id").type, "INTEGER");
    assert.equal(episodic.get("id").pk, 1);
    assert.equal(episodic.get("conversation_id").notnull, 1);
    assert.equal(episodic.get("role").notnull, 1);
    assert.equal(episodic.get("content").notnull, 1);
    assert.equal(episodic.get("metadata").dflt_value, "'{}'");

    assert.deepEqual(
      [...semantic.keys()],
      [
        "id",
        "category",
        "content",
        "confidence",
        "embedding",
        "source_episode_ids",
        "created_at",
        "last_seen",
        "superseded_by",
      ],
    );
    assert.equal(semantic.get("id").type, "INTEGER");
    assert.equal(semantic.get("id").pk, 1);
    assert.equal(semantic.get("category").dflt_value, "'general'");
    assert.equal(semantic.get("confidence").dflt_value, "1.0");
    assert.equal(semantic.get("source_episode_ids").dflt_value, "'[]'");
  });
});

test("memory schema preserves existing tables and rows", async () => {
  await withMemoryDb((filePath) => {
    const oldDb = new DatabaseSync(filePath);
    oldDb.exec(`
      CREATE TABLE tasks (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        priority TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'todo'
      );
      CREATE TABLE calendar_items (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        date TEXT NOT NULL DEFAULT '',
        time TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE activity (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        kind TEXT NOT NULL,
        time TEXT NOT NULL,
        data TEXT NOT NULL
      );
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    oldDb
      .prepare("INSERT INTO tasks (id, name, description, priority, status) VALUES (?, ?, ?, ?, ?)")
      .run("task-before-memory", "Existing task", "Keep me", "high", "todo");
    oldDb
      .prepare(
        "INSERT INTO calendar_items (id, title, description, date, time) VALUES (?, ?, ?, ?, ?)",
      )
      .run("calendar-before-memory", "Existing event", "Keep me too", "2026-06-03", "09:00");
    oldDb
      .prepare("INSERT INTO activity (id, kind, time, data) VALUES (?, ?, ?, ?)")
      .run("activity-before-memory", "web_search", "2026-06-03T00:00:00.000Z", "{}");
    oldDb
      .prepare("INSERT INTO settings (key, value) VALUES (?, ?)")
      .run("existing_setting", "value");
    oldDb.close();

    const db = getDatabase(filePath);
    assert.equal(
      db.prepare("SELECT name FROM tasks WHERE id = ?").get("task-before-memory").name,
      "Existing task",
    );
    assert.equal(
      db.prepare("SELECT title FROM calendar_items WHERE id = ?").get("calendar-before-memory")
        .title,
      "Existing event",
    );
    assert.equal(
      db.prepare("SELECT kind FROM activity WHERE id = ?").get("activity-before-memory").kind,
      "web_search",
    );
    assert.equal(
      db.prepare("SELECT value FROM settings WHERE key = ?").get("existing_setting").value,
      "value",
    );
    assert.deepEqual([...tableColumns(db, "memories_episodic").keys()].slice(0, 4), [
      "id",
      "conversation_id",
      "role",
      "content",
    ]);
  });
});

test("memory tables round-trip episodic and semantic rows", async () => {
  await withMemoryDb((filePath) => {
    const db = getDatabase(filePath);
    const episodicEmbedding = Buffer.from([1, 2, 3, 4]);
    const semanticEmbedding = Buffer.from([9, 8, 7, 6]);

    const episodicResult = db
      .prepare(
        `
          INSERT INTO memories_episodic (conversation_id, role, content, embedding, metadata)
          VALUES (?, ?, ?, ?, ?)
        `,
      )
      .run(
        "conversation-1",
        "user",
        "Remember that I prefer direct answers.",
        episodicEmbedding,
        '{"source":"test"}',
      );
    const episodic = db
      .prepare(
        `
          SELECT id, conversation_id, role, content, embedding, created_at, metadata
          FROM memories_episodic
          WHERE id = ?
        `,
      )
      .get(episodicResult.lastInsertRowid);

    assert.equal(episodic.conversation_id, "conversation-1");
    assert.equal(episodic.role, "user");
    assert.equal(episodic.content, "Remember that I prefer direct answers.");
    assert.deepEqual(Buffer.from(episodic.embedding), episodicEmbedding);
    assert.equal(episodic.metadata, '{"source":"test"}');
    assert.equal(typeof episodic.created_at, "string");
    assert.ok(episodic.created_at.length > 0);

    const semanticResult = db
      .prepare(
        `
          INSERT INTO memories_semantic (category, content, confidence, embedding, source_episode_ids)
          VALUES (?, ?, ?, ?, ?)
        `,
      )
      .run("preference", "User prefers direct answers.", 0.75, semanticEmbedding, "[1]");
    const semantic = db
      .prepare(
        `
          SELECT id, category, content, confidence, embedding, source_episode_ids, created_at, last_seen
          FROM memories_semantic
          WHERE id = ?
        `,
      )
      .get(semanticResult.lastInsertRowid);

    assert.equal(semantic.category, "preference");
    assert.equal(semantic.content, "User prefers direct answers.");
    assert.equal(semantic.confidence, 0.75);
    assert.deepEqual(Buffer.from(semantic.embedding), semanticEmbedding);
    assert.equal(semantic.source_episode_ids, "[1]");
    assert.equal(typeof semantic.created_at, "string");
    assert.ok(semantic.created_at.length > 0);
    assert.equal(typeof semantic.last_seen, "string");
    assert.ok(semantic.last_seen.length > 0);

    db.prepare("INSERT INTO memories_semantic (content) VALUES (?)").run("Default category fact.");
    const defaultSemantic = db
      .prepare(
        `
          SELECT category, confidence, source_episode_ids
          FROM memories_semantic
          WHERE content = ?
        `,
      )
      .get("Default category fact.");
    assert.deepEqual(
      { ...defaultSemantic },
      { category: "general", confidence: 1, source_episode_ids: "[]" },
    );
  });
});

test("memory schema creates indexes and enforces semantic supersession foreign key", async () => {
  await withMemoryDb((filePath) => {
    const db = getDatabase(filePath);
    const indexes = indexNames(db);

    assert.equal(indexes.has("idx_episodic_conversation"), true);
    assert.equal(indexes.has("idx_episodic_created"), true);
    assert.equal(indexes.has("idx_semantic_category"), true);
    assert.equal(indexes.has("idx_semantic_last_seen"), true);

    const foreignKeys = db.prepare("PRAGMA foreign_key_list(memories_semantic)").all();
    assert.deepEqual(
      foreignKeys.map((key) => ({
        from: key.from,
        table: key.table,
        to: key.to,
      })),
      [
        {
          from: "superseded_by",
          table: "memories_semantic",
          to: "id",
        },
      ],
    );

    const replacement = db
      .prepare("INSERT INTO memories_semantic (content) VALUES (?)")
      .run("Updated memory.").lastInsertRowid;
    db.prepare("INSERT INTO memories_semantic (content, superseded_by) VALUES (?, ?)").run(
      "Outdated memory.",
      replacement,
    );
    const invalidSupersededBy = Number(replacement) + 1000;

    assert.throws(
      () =>
        db
          .prepare("INSERT INTO memories_semantic (content, superseded_by) VALUES (?, ?)")
          .run("Invalid supersession.", invalidSupersededBy),
      /FOREIGN KEY constraint failed/,
    );
  });
});
