import { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// Built-in SQLite (node:sqlite) backs the planner and activity stores. It is
// available in the Electron runtime (Node 24) with no native dependency, and
// its synchronous, transactional writes remove the read-modify-write races and
// file-corruption class of bugs the previous JSON files suffered from.

let userDataPathOverride = null;
let legacyUserDataPathOverrides = [];
const connections = new Map();
const databaseFilename = "lena.db";
const legacyAppSlug = ["br", "ah"].join("");
const legacyDatabaseFilename = `${legacyAppSlug}.db`;
const defaultUserDataDirectoryName = "leena-user-data";
const legacyUserDataDirectoryName = `${legacyAppSlug}-user-data`;

export function setDatabaseUserDataPath(userDataPath, options = {}) {
  userDataPathOverride = normalizePath(userDataPath);
  legacyUserDataPathOverrides = Array.isArray(options.legacyUserDataPaths)
    ? uniquePaths(options.legacyUserDataPaths.map(normalizePath).filter(Boolean))
    : [];
}

export function getDatabasePath() {
  return path.join(getUserDataPath(), databaseFilename);
}

export function getDatabase(dbPath = getDatabasePath()) {
  const databasePath = prepareDatabasePath(dbPath);
  const existing = connections.get(databasePath);
  if (existing) {
    return existing;
  }
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  applySchema(db);
  connections.set(databasePath, db);
  return db;
}

// Exposed for tests so connections do not leak across temp databases.
export function closeDatabase(dbPath = getDatabasePath()) {
  const db = connections.get(dbPath);
  if (db) {
    db.close();
    connections.delete(dbPath);
  }
}

function applySchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'todo'
    );
    CREATE TABLE IF NOT EXISTS calendar_items (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL DEFAULT '',
      time TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS activity (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      time TEXT NOT NULL,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_activity_kind_time ON activity (kind, time);
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function getUserDataPath() {
  if (userDataPathOverride) {
    return userDataPathOverride;
  }
  return path.join(os.tmpdir(), defaultUserDataDirectoryName);
}

function prepareDatabasePath(dbPath) {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  if (path.basename(dbPath) === databaseFilename) {
    migrateLegacyDatabaseFile(dbPath);
  }
  return dbPath;
}

function migrateLegacyDatabaseFile(dbPath) {
  if (existsSync(dbPath)) {
    return;
  }
  for (const legacyPath of getLegacyDatabasePaths(dbPath)) {
    if (!existsSync(legacyPath)) {
      continue;
    }
    renameSync(legacyPath, dbPath);
    renameSqliteSidecar(`${legacyPath}-wal`, `${dbPath}-wal`);
    renameSqliteSidecar(`${legacyPath}-shm`, `${dbPath}-shm`);
    return;
  }
}

function renameSqliteSidecar(from, to) {
  if (existsSync(from) && !existsSync(to)) {
    renameSync(from, to);
  }
}

// One-time import of the legacy JSON stores into SQLite. Because an earlier bug
// wrote data to the OS temp dir instead of userData, we look in both locations,
// import any valid rows the DB does not already have, and rename the source
// files so the import never repeats.
export function migrateLegacyStores(importers, dbPath = getDatabasePath()) {
  const db = getDatabase(dbPath);
  const legacyDirs = uniquePaths([
    getUserDataPath(),
    ...legacyUserDataPathOverrides,
    path.join(os.tmpdir(), legacyUserDataDirectoryName),
  ]);
  for (const { relativePath, apply } of importers) {
    for (const dir of legacyDirs) {
      const filePath = path.join(dir, relativePath);
      const parsed = readJsonFile(filePath);
      if (parsed === null) {
        continue;
      }
      try {
        apply(db, parsed);
        renameSync(filePath, `${filePath}.migrated-${Date.now()}`);
      } catch (error) {
        console.warn(`Failed to migrate legacy store ${filePath}`, error);
      }
    }
  }
}

function getLegacyDatabasePaths(dbPath) {
  return uniquePaths([
    path.join(path.dirname(dbPath), legacyDatabaseFilename),
    ...legacyUserDataPathOverrides.map((dir) => path.join(dir, legacyDatabaseFilename)),
  ]);
}

function normalizePath(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

function uniquePaths(paths) {
  const seen = new Set();
  const result = [];
  for (const item of paths) {
    if (!item || seen.has(item)) {
      continue;
    }
    seen.add(item);
    result.push(item);
  }
  return result;
}

function readJsonFile(filePath) {
  try {
    const raw = readFileSync(filePath, "utf8");
    if (!raw.trim()) {
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
