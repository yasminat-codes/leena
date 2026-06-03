import { randomUUID } from "node:crypto";
import { getDatabase, getDatabasePath } from "../realtime/tools/database.js";
import { LeenaError } from "../utils/errors.js";

const MCP_PERMISSION_LEVELS = new Set(["auto", "confirm", "trust"]);
const MCP_TRANSPORTS = new Set(["http", "stdio"]);
const UPDATE_FIELDS = Object.freeze([
  "name",
  "transport",
  "url",
  "command",
  "args",
  "enabled",
  "auto_connect",
  "permission_level",
]);

export class ServerStore {
  constructor(options = {}) {
    this.storePath = typeof options === "string" ? options : options.storePath;
  }

  addServer(config) {
    return addServer(config, this.storePath);
  }

  removeServer(id) {
    return removeServer(id, this.storePath);
  }

  updateServer(id, updates) {
    return updateServer(id, updates, this.storePath);
  }

  listServers() {
    return listServers(this.storePath);
  }

  getServer(id) {
    return getServer(id, this.storePath);
  }

  getAutoConnectServers() {
    return getAutoConnectServers(this.storePath);
  }
}

export function getMCPServerStorePath() {
  return getDatabasePath();
}

export function addServer(config, storePath = getMCPServerStorePath()) {
  const db = getServerDatabase(storePath);
  const server = normalizeServerConfig(config, { id: randomUUID() });
  db.prepare(
    `INSERT INTO mcp_servers
      (id, name, transport, url, command, args, enabled, auto_connect, permission_level)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    server.id,
    server.name,
    server.transport,
    toStoredValue("url", server.url),
    toStoredValue("command", server.command),
    JSON.stringify(server.args),
    server.enabled ? 1 : 0,
    server.auto_connect ? 1 : 0,
    server.permission_level,
  );
  return getServer(server.id, storePath);
}

export function removeServer(id, storePath = getMCPServerStorePath()) {
  const serverId = normalizeId(id);
  if (!serverId) {
    return false;
  }
  const existing = getServer(serverId, storePath);
  if (!existing) {
    return false;
  }
  const db = getServerDatabase(storePath);
  db.prepare("DELETE FROM mcp_servers WHERE id = ?").run(serverId);
  return true;
}

export function updateServer(id, updates, storePath = getMCPServerStorePath()) {
  const serverId = normalizeId(id);
  if (!serverId) {
    return null;
  }
  const existing = getServer(serverId, storePath);
  if (!existing) {
    return null;
  }
  if (!isRecord(updates)) {
    throwInvalidConfig("MCP server updates must be an object.");
  }

  const patch = {};
  for (const field of UPDATE_FIELDS) {
    if (Object.hasOwn(updates, field) && updates[field] !== undefined) {
      patch[field] = updates[field];
    }
  }
  if (Object.keys(patch).length === 0) {
    return existing;
  }

  const next = normalizeServerConfig({ ...existing, ...patch }, { id: existing.id });
  const setClauses = [];
  const values = [];
  for (const field of UPDATE_FIELDS) {
    if (!Object.hasOwn(patch, field)) {
      continue;
    }
    setClauses.push(`${field} = ?`);
    values.push(toStoredValue(field, next[field]));
  }
  values.push(serverId);

  const db = getServerDatabase(storePath);
  db.prepare(`UPDATE mcp_servers SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);
  return getServer(serverId, storePath);
}

export function listServers(storePath = getMCPServerStorePath()) {
  const db = getServerDatabase(storePath);
  return db
    .prepare(
      `SELECT id, name, transport, url, command, args, enabled, auto_connect, permission_level, created_at
       FROM mcp_servers
       ORDER BY created_at ASC, name COLLATE NOCASE ASC, id ASC`,
    )
    .all()
    .map(rowToServer);
}

export function getServer(id, storePath = getMCPServerStorePath()) {
  const serverId = normalizeId(id);
  if (!serverId) {
    return null;
  }
  const db = getServerDatabase(storePath);
  const row = db
    .prepare(
      `SELECT id, name, transport, url, command, args, enabled, auto_connect, permission_level, created_at
       FROM mcp_servers
       WHERE id = ?`,
    )
    .get(serverId);
  return rowToServer(row);
}

export function getAutoConnectServers(storePath = getMCPServerStorePath()) {
  const db = getServerDatabase(storePath);
  return db
    .prepare(
      `SELECT id, name, transport, url, command, args, enabled, auto_connect, permission_level, created_at
       FROM mcp_servers
       WHERE enabled = 1 AND auto_connect = 1
       ORDER BY created_at ASC, name COLLATE NOCASE ASC, id ASC`,
    )
    .all()
    .map(rowToServer);
}

function getServerDatabase(storePath) {
  const db = getDatabase(storePath);
  ensureMCPServersTable(db);
  return db;
}

function ensureMCPServersTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      transport TEXT NOT NULL CHECK(transport IN ('http','stdio')),
      url TEXT,
      command TEXT,
      args TEXT,
      enabled INTEGER DEFAULT 1,
      auto_connect INTEGER DEFAULT 0,
      permission_level TEXT DEFAULT 'confirm',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function normalizeServerConfig(config, { id }) {
  if (!isRecord(config)) {
    throwInvalidConfig("MCP server config must be an object.");
  }

  const transport = normalizeTransport(config.transport);
  const server = {
    id,
    name: normalizeName(config.name),
    transport,
    url: normalizeOptionalString(config.url),
    command: normalizeOptionalString(config.command),
    args: normalizeArgs(config.args),
    enabled: normalizeBoolean(config.enabled, true, "enabled"),
    auto_connect: normalizeBoolean(config.auto_connect, false, "auto_connect"),
    permission_level: normalizePermissionLevel(config.permission_level),
  };

  if (transport === "http") {
    server.url = normalizeRequiredHttpUrl(server.url);
  }
  if (transport === "stdio" && !server.command) {
    throwInvalidConfig("MCP stdio servers require a command.");
  }

  return server;
}

function rowToServer(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    transport: row.transport,
    url: normalizeStoredOptionalString(row.url),
    command: normalizeStoredOptionalString(row.command),
    args: parseArgs(row.args),
    enabled: row.enabled !== 0,
    auto_connect: row.auto_connect === 1,
    permission_level: normalizePermissionLevel(row.permission_level),
    created_at: row.created_at,
  };
}

function toStoredValue(field, value) {
  if (field === "args") {
    return JSON.stringify(value);
  }
  if (field === "enabled" || field === "auto_connect") {
    return value ? 1 : 0;
  }
  if ((field === "url" || field === "command") && !value) {
    return null;
  }
  return value;
}

function normalizeId(value) {
  return normalizeOptionalString(value);
}

function normalizeName(value) {
  const name = normalizeOptionalString(value);
  if (!name) {
    throwInvalidConfig("MCP server name is required.");
  }
  return name;
}

function normalizeTransport(value) {
  const transport = normalizeOptionalString(value).toLowerCase();
  if (!MCP_TRANSPORTS.has(transport)) {
    throwInvalidConfig("MCP server transport must be http or stdio.");
  }
  return transport;
}

function normalizeRequiredHttpUrl(value) {
  const url = normalizeOptionalString(value);
  if (!url) {
    throwInvalidConfig("MCP HTTP servers require a url.");
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
    return parsed.href;
  } catch {
    throwInvalidConfig("MCP HTTP server url must be a valid http(s) URL.");
  }
}

function normalizeArgs(value) {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throwInvalidConfig("MCP stdio args must be an array of strings.");
  }
  return value.map((item) => {
    if (typeof item !== "string" || item.includes("\0")) {
      throwInvalidConfig("MCP stdio args must be an array of strings.");
    }
    return item;
  });
}

function parseArgs(value) {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }
  try {
    return normalizeArgs(JSON.parse(value));
  } catch {
    return [];
  }
}

function normalizeBoolean(value, defaultValue, field) {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (value === 1 || value === 0) {
    return Boolean(value);
  }
  throwInvalidConfig(`MCP server ${field} must be a boolean.`);
}

function normalizePermissionLevel(value) {
  const normalized = normalizeOptionalString(value).toLowerCase();
  return MCP_PERMISSION_LEVELS.has(normalized) ? normalized : "confirm";
}

function normalizeOptionalString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStoredOptionalString(value) {
  const normalized = normalizeOptionalString(value);
  return normalized || null;
}

function throwInvalidConfig(message) {
  throw new LeenaError(message);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
