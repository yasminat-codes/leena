import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  closeDatabase,
  getDatabase,
  getDatabasePath,
  setDatabaseUserDataPath,
} from "../src/realtime/tools/database.js";

const currentDatabaseName = "lena.db";
const legacyDatabaseName = `${["br", "ah"].join("")}.db`;

test("default database open renames the legacy database file and preserves data", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "leena-rename-"));
  const legacyPath = path.join(directory, legacyDatabaseName);
  const currentPath = path.join(directory, currentDatabaseName);

  try {
    setDatabaseUserDataPath(directory);

    const legacyDb = getDatabase(legacyPath);
    legacyDb
      .prepare("INSERT INTO tasks (id, name, description, priority, status) VALUES (?, ?, ?, ?, ?)")
      .run("task-legacy-row", "Legacy row", "Preserved through rename", "high", "todo");
    closeDatabase(legacyPath);

    assert.equal(existsSync(legacyPath), true);
    assert.equal(existsSync(currentPath), false);
    assert.equal(getDatabasePath(), currentPath);

    const db = getDatabase();
    const row = db
      .prepare("SELECT id, name, description, priority, status FROM tasks WHERE id = ?")
      .get("task-legacy-row");

    assert.deepEqual(
      { ...row },
      {
        id: "task-legacy-row",
        name: "Legacy row",
        description: "Preserved through rename",
        priority: "high",
        status: "todo",
      },
    );
    assert.equal(existsSync(legacyPath), false);
    assert.equal(existsSync(currentPath), true);
  } finally {
    closeDatabase(currentPath);
    closeDatabase(legacyPath);
    setDatabaseUserDataPath(null);
    await rm(directory, { force: true, recursive: true });
  }
});

test("default database open imports a legacy database from the old Electron user-data root", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "leena-rename-roots-"));
  const currentDirectory = path.join(root, "Leena");
  const legacyDirectory = path.join(root, ["Br", "ah"].join(""));
  const legacyPath = path.join(legacyDirectory, legacyDatabaseName);
  const currentPath = path.join(currentDirectory, currentDatabaseName);

  try {
    setDatabaseUserDataPath(legacyDirectory);
    const legacyDb = getDatabase(legacyPath);
    legacyDb
      .prepare("INSERT INTO tasks (id, name, description, priority, status) VALUES (?, ?, ?, ?, ?)")
      .run("task-cross-root", "Cross-root row", "Preserved from old userData", "medium", "todo");
    closeDatabase(legacyPath);

    setDatabaseUserDataPath(currentDirectory, { legacyUserDataPaths: [legacyDirectory] });
    assert.equal(getDatabasePath(), currentPath);

    const db = getDatabase();
    const row = db
      .prepare("SELECT id, name, description, priority, status FROM tasks WHERE id = ?")
      .get("task-cross-root");

    assert.deepEqual(
      { ...row },
      {
        id: "task-cross-root",
        name: "Cross-root row",
        description: "Preserved from old userData",
        priority: "medium",
        status: "todo",
      },
    );
    assert.equal(existsSync(legacyPath), false);
    assert.equal(existsSync(currentPath), true);
  } finally {
    closeDatabase(currentPath);
    closeDatabase(legacyPath);
    setDatabaseUserDataPath(null);
    await rm(root, { force: true, recursive: true });
  }
});

test("cross-root legacy database migration carries SQLite sidecars with uncheckpointed data", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "leena-rename-sidecars-"));
  const currentDirectory = path.join(root, "Leena");
  const legacyDirectory = path.join(root, ["Br", "ah"].join(""));
  const legacyPath = path.join(legacyDirectory, legacyDatabaseName);
  const currentPath = path.join(currentDirectory, currentDatabaseName);
  let legacyWriter = null;

  try {
    await mkdir(legacyDirectory, { recursive: true });
    legacyWriter = new DatabaseSync(legacyPath);
    legacyWriter.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA wal_autocheckpoint = 0;
      CREATE TABLE tasks (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        priority TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'todo'
      );
    `);
    legacyWriter
      .prepare("INSERT INTO tasks (id, name, description, priority, status) VALUES (?, ?, ?, ?, ?)")
      .run("task-wal-row", "WAL row", "Preserved from legacy sidecar", "high", "todo");

    assert.equal(existsSync(`${legacyPath}-wal`), true);
    assert.equal(existsSync(`${legacyPath}-shm`), true);

    setDatabaseUserDataPath(currentDirectory, { legacyUserDataPaths: [legacyDirectory] });
    const db = getDatabase();
    const row = db
      .prepare("SELECT id, name, description, priority, status FROM tasks WHERE id = ?")
      .get("task-wal-row");

    assert.deepEqual(
      { ...row },
      {
        id: "task-wal-row",
        name: "WAL row",
        description: "Preserved from legacy sidecar",
        priority: "high",
        status: "todo",
      },
    );
    assert.equal(existsSync(legacyPath), false);
    assert.equal(existsSync(`${legacyPath}-wal`), false);
    assert.equal(existsSync(`${legacyPath}-shm`), false);
    assert.equal(existsSync(currentPath), true);
    assert.equal(existsSync(`${currentPath}-wal`), true);
    assert.equal(existsSync(`${currentPath}-shm`), true);
  } finally {
    closeDatabase(currentPath);
    closeDatabase(legacyPath);
    legacyWriter?.close();
    setDatabaseUserDataPath(null);
    await rm(root, { force: true, recursive: true });
  }
});
