import { randomUUID } from "node:crypto";
import { getDatabase, getDatabasePath } from "../realtime/tools/database.js";
import { LeenaError } from "../utils/errors.js";

const MCP_PERMISSION_LEVELS = new Set(["auto", "confirm", "trust"]);
const MCP_TRANSPORTS = new Set(["http", "stdio"]);
const MCP_HTTP_HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const PROTECTED_HEADERS_TYPE = "leena:mcp:headers:v1";
const STREAMABLE_HTTP_TRANSPORT_ALIASES = new Set([
  "http",
  "streamable-http",
  "streamable_http",
  "streamable",
]);
const UPDATE_FIELDS = Object.freeze([
  "name",
  "transport",
  "url",
  "headers",
  "command",
  "args",
  "enabled",
  "auto_connect",
  "permission_level",
]);

export class ServerStore {
  constructor(options = {}) {
    this.storePath = typeof options === "string" ? options : options.storePath;
    this.secretCodec = typeof options === "string" ? undefined : options.secretCodec;
  }

  addServer(config) {
    return addServer(config, this.storePath, { secretCodec: this.secretCodec });
  }

  removeServer(id) {
    return removeServer(id, this.storePath);
  }

  updateServer(id, updates) {
    return updateServer(id, updates, this.storePath, { secretCodec: this.secretCodec });
  }

  listServers(options = {}) {
    return listServers(this.storePath, {
      secretCodec: this.secretCodec,
      redactSecrets: options.redactSecrets === true,
    });
  }

  getServer(id, options = {}) {
    return getServer(id, this.storePath, {
      secretCodec: this.secretCodec,
      redactSecrets: options.redactSecrets === true,
    });
  }

  getAutoConnectServers() {
    return getAutoConnectServers(this.storePath, { secretCodec: this.secretCodec });
  }
}

export function getMCPServerStorePath() {
  return getDatabasePath();
}

export function addServer(config, storePath = getMCPServerStorePath(), options = {}) {
  const db = getServerDatabase(storePath);
  const storageOptions = normalizeStorageOptions(options);
  const server = normalizeServerConfig(config, { id: randomUUID() });
  db.prepare(
    `INSERT INTO mcp_servers
      (id, name, transport, url, headers, command, args, enabled, auto_connect, permission_level)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    server.id,
    server.name,
    server.transport,
    toStoredValue("url", server.url, storageOptions),
    toStoredValue("headers", server.headers, storageOptions),
    toStoredValue("command", server.command, storageOptions),
    JSON.stringify(server.args),
    server.enabled ? 1 : 0,
    server.auto_connect ? 1 : 0,
    server.permission_level,
  );
  return getServer(server.id, storePath, storageOptions);
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

export function updateServer(id, updates, storePath = getMCPServerStorePath(), options = {}) {
  const serverId = normalizeId(id);
  if (!serverId) {
    return null;
  }
  const storageOptions = normalizeStorageOptions(options);
  const existing = getServer(serverId, storePath, storageOptions);
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
  if (patch.transport === "stdio") {
    patch.headers = {};
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
    values.push(toStoredValue(field, next[field], storageOptions));
  }
  values.push(serverId);

  const db = getServerDatabase(storePath);
  db.prepare(`UPDATE mcp_servers SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);
  return getServer(serverId, storePath, storageOptions);
}

export function listServers(storePath = getMCPServerStorePath(), options = {}) {
  const db = getServerDatabase(storePath);
  const storageOptions = normalizeStorageOptions(options);
  return db
    .prepare(
      `SELECT id, name, transport, url, headers, command, args, enabled, auto_connect, permission_level, created_at
       FROM mcp_servers
       ORDER BY created_at ASC, name COLLATE NOCASE ASC, id ASC`,
    )
    .all()
    .map((row) => rowToServer(row, storageOptions));
}

export function getServer(id, storePath = getMCPServerStorePath(), options = {}) {
  const serverId = normalizeId(id);
  if (!serverId) {
    return null;
  }
  const storageOptions = normalizeStorageOptions(options);
  const db = getServerDatabase(storePath);
  const row = db
    .prepare(
      `SELECT id, name, transport, url, headers, command, args, enabled, auto_connect, permission_level, created_at
       FROM mcp_servers
       WHERE id = ?`,
    )
    .get(serverId);
  return rowToServer(row, storageOptions);
}

export function getAutoConnectServers(storePath = getMCPServerStorePath(), options = {}) {
  const db = getServerDatabase(storePath);
  const storageOptions = normalizeStorageOptions(options);
  return db
    .prepare(
      `SELECT id, name, transport, url, headers, command, args, enabled, auto_connect, permission_level, created_at
       FROM mcp_servers
       WHERE enabled = 1 AND auto_connect = 1
       ORDER BY created_at ASC, name COLLATE NOCASE ASC, id ASC`,
    )
    .all()
    .map((row) => rowToServer(row, storageOptions));
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
      headers TEXT,
      command TEXT,
      args TEXT,
      enabled INTEGER DEFAULT 1,
      auto_connect INTEGER DEFAULT 0,
      permission_level TEXT DEFAULT 'confirm',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  const columns = new Set(
    db
      .prepare("PRAGMA table_info(mcp_servers)")
      .all()
      .map((column) => column.name),
  );
  if (!columns.has("headers")) {
    db.exec("ALTER TABLE mcp_servers ADD COLUMN headers TEXT;");
  }
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
    headers: normalizeHeaders(config.headers),
    command: normalizeOptionalString(config.command),
    args: normalizeArgs(config.args),
    enabled: normalizeBoolean(config.enabled, true, "enabled"),
    auto_connect: normalizeBoolean(config.auto_connect, false, "auto_connect"),
    permission_level: normalizePermissionLevel(config.permission_level),
  };

  if (transport === "http") {
    server.url = normalizeRequiredHttpUrl(server.url);
  } else {
    server.headers = {};
  }
  if (transport === "stdio" && !server.command) {
    throwInvalidConfig("MCP stdio servers require a command.");
  }

  return server;
}

function rowToServer(row, options = {}) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    transport: row.transport,
    url: normalizeStoredOptionalString(row.url),
    headers: parseHeaders(row.headers, options),
    command: normalizeStoredOptionalString(row.command),
    args: parseArgs(row.args),
    enabled: row.enabled !== 0,
    auto_connect: row.auto_connect === 1,
    permission_level: normalizePermissionLevel(row.permission_level),
    created_at: row.created_at,
  };
}

function toStoredValue(field, value, options = {}) {
  if (field === "headers") {
    return serializeHeaders(value, options);
  }
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
  if (STREAMABLE_HTTP_TRANSPORT_ALIASES.has(transport)) {
    return "http";
  }
  if (!MCP_TRANSPORTS.has(transport)) {
    throwInvalidConfig("MCP server transport must be streamable HTTP or stdio.");
  }
  return transport;
}

function normalizeRequiredHttpUrl(value) {
  const url = normalizeOptionalString(value);
  if (!url) {
    throwInvalidConfig("MCP Streamable HTTP servers require a url.");
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
    return parsed.href;
  } catch {
    throwInvalidConfig("MCP Streamable HTTP server url must be a valid http(s) URL.");
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

function normalizeHeaders(value) {
  if (value === undefined || value === null) {
    return {};
  }
  if (!isRecord(value)) {
    throwInvalidConfig("MCP HTTP headers must be an object with string values.");
  }

  const headers = {};
  for (const [rawName, rawValue] of Object.entries(value)) {
    const name = normalizeOptionalString(rawName);
    if (!MCP_HTTP_HEADER_NAME_PATTERN.test(name)) {
      throwInvalidConfig("MCP HTTP header names must be non-empty HTTP tokens.");
    }
    if (typeof rawValue !== "string") {
      throwInvalidConfig("MCP HTTP header values must be strings.");
    }
    const headerValue = rawValue.trim();
    if (!headerValue) {
      throwInvalidConfig("MCP HTTP header values must be non-empty strings.");
    }
    headers[name] = headerValue;
  }
  return headers;
}

function serializeHeaders(value, options = {}) {
  const headers = normalizeHeaders(value);
  const names = Object.keys(headers);
  if (names.length === 0) {
    return JSON.stringify({});
  }

  const secretCodec = options.secretCodec;
  assertSecretCodec(secretCodec);
  return JSON.stringify({
    type: PROTECTED_HEADERS_TYPE,
    names,
    payload: secretCodec.protect(JSON.stringify(headers)),
  });
}

function parseHeaders(value, options = {}) {
  if (typeof value !== "string" || !value.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    if (isProtectedHeadersPayload(parsed)) {
      return parseProtectedHeaders(parsed, options);
    }
    const headers = normalizeHeaders(parsed);
    return options.redactSecrets === true ? redactHeaders(headers) : headers;
  } catch {
    return {};
  }
}

function parseProtectedHeaders(payload, options = {}) {
  const names = normalizeHeaderNames(payload.names);
  if (options.redactSecrets === true) {
    return namesToRedactedHeaders(names);
  }
  const secretCodec = options.secretCodec;
  if (!secretCodec || typeof secretCodec.reveal !== "function") {
    return {};
  }
  try {
    return normalizeHeaders(JSON.parse(secretCodec.reveal(payload.payload)));
  } catch {
    return {};
  }
}

function isProtectedHeadersPayload(value) {
  return (
    isRecord(value) &&
    value.type === PROTECTED_HEADERS_TYPE &&
    Array.isArray(value.names) &&
    typeof value.payload === "string" &&
    value.payload.trim().length > 0
  );
}

function normalizeHeaderNames(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const names = [];
  for (const rawName of value) {
    const name = normalizeOptionalString(rawName);
    if (!name || /[\s:]/.test(name)) {
      continue;
    }
    names.push(name);
  }
  return [...new Set(names)];
}

function namesToRedactedHeaders(names) {
  const headers = {};
  for (const name of names) {
    headers[name] = "[REDACTED]";
  }
  return headers;
}

function redactHeaders(headers) {
  return namesToRedactedHeaders(Object.keys(headers));
}

function assertSecretCodec(secretCodec) {
  if (
    !secretCodec ||
    typeof secretCodec.protect !== "function" ||
    typeof secretCodec.reveal !== "function"
  ) {
    throwInvalidConfig("MCP HTTP headers require protected storage.");
  }
}

function normalizeStorageOptions(options) {
  return isRecord(options)
    ? {
        secretCodec: options.secretCodec,
        redactSecrets: options.redactSecrets === true,
      }
    : {};
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
