import { execFile } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { getMacOsPrivacySettingsUrls } from "./os-permissions.js";

const execFileAsync = promisify(execFile);

const fullDiskAccessProbeRelativePaths = Object.freeze([
  Object.freeze(["Library", "Mail"]),
  Object.freeze(["Library", "Safari"]),
  Object.freeze(["Library", "Messages"]),
  Object.freeze(["Library", "Application Support", "AddressBook"]),
]);

export async function openMacOsPrivacySettings(id, openExternal) {
  if (typeof openExternal !== "function") {
    throw new TypeError("openExternal callback is required.");
  }
  for (const url of getMacOsPrivacySettingsUrls(id)) {
    try {
      await openExternal(url);
      return { opened: true, url };
    } catch {
      // Try the next known System Settings/System Preferences URL.
    }
  }
  return { opened: false, message: "Open your system privacy settings manually." };
}

export function createDefaultFullDiskAccessProbePaths(homeDir = homedir()) {
  if (!homeDir || typeof homeDir !== "string") {
    return [];
  }
  return fullDiskAccessProbeRelativePaths.map((segments) => join(homeDir, ...segments));
}

export async function detectFullDiskAccessStatus(options = {}) {
  const platform = options.platform ?? process.platform;
  if (platform !== "darwin") {
    return "unsupported";
  }
  const probePaths = options.probePaths ?? createDefaultFullDiskAccessProbePaths(options.homeDir);
  if (!Array.isArray(probePaths) || probePaths.length === 0) {
    return "unknown";
  }
  const accessImpl = options.access ?? access;
  for (const probePath of probePaths) {
    if (!probePath || typeof probePath !== "string") {
      continue;
    }
    try {
      await accessImpl(probePath, fsConstants.R_OK);
      return "granted";
    } catch (error) {
      if (isFullDiskAccessDeniedError(error)) {
        return "denied";
      }
      if (isMissingProbePathError(error)) {
        continue;
      }
      return "unknown";
    }
  }
  return "unknown";
}

export async function detectAppleCalendarAccessStatus(options = {}) {
  const platform = options.platform ?? process.platform;
  if (platform !== "darwin") {
    return "unsupported";
  }

  const rows = await readAppleCalendarTccRows(options);
  const readCapableRows = rows.filter((row) => isReadCapableCalendarService(row.service));
  if (readCapableRows.some((row) => ["0", "1"].includes(String(row.authValue)))) {
    return "denied";
  }
  if (readCapableRows.some((row) => String(row.authValue) === "2")) {
    return "granted";
  }
  if (
    rows.some((row) => isWriteOnlyCalendarService(row.service) && String(row.authValue) === "2")
  ) {
    return "restricted";
  }
  return "unknown";
}

async function readAppleCalendarTccRows(options = {}) {
  const execFileImpl = options.execFile ?? execFileAsync;
  const dbPaths =
    options.dbPaths ??
    createDefaultTccDatabasePaths(options.homeDir ?? homedir(), options.systemDbPath);
  const clients = normalizeTccClients(options.clients ?? createDefaultTccClients());
  const rows = [];
  for (const dbPath of dbPaths) {
    if (!dbPath || typeof dbPath !== "string") {
      continue;
    }
    try {
      const { stdout } = await execFileImpl("sqlite3", [
        dbPath,
        buildAppleCalendarTccQuery(clients),
      ]);
      rows.push(...parseTccRows(stdout));
    } catch {
      // TCC databases may be unreadable without the right grants. Keep this probe fail-closed.
    }
  }
  return rows;
}

export function createDefaultTccDatabasePaths(homeDir = homedir(), systemDbPath) {
  const paths = [];
  if (homeDir && typeof homeDir === "string") {
    paths.push(join(homeDir, "Library", "Application Support", "com.apple.TCC", "TCC.db"));
  }
  paths.push(systemDbPath ?? "/Library/Application Support/com.apple.TCC/TCC.db");
  return paths;
}

function createDefaultTccClients() {
  const legacyAppSlug = ["br", "ah"].join("");
  return {
    bundleIds: ["com.leena.app", ["com.unstablemind", legacyAppSlug].join(".")],
    clientPatterns: ["leena", legacyAppSlug],
  };
}

function normalizeTccClients(clients) {
  return {
    bundleIds: Array.isArray(clients.bundleIds) ? clients.bundleIds.filter(Boolean) : [],
    clientPatterns: Array.isArray(clients.clientPatterns)
      ? clients.clientPatterns.filter(Boolean)
      : [],
  };
}

function buildAppleCalendarTccQuery(clients) {
  const clientPredicates = [
    ...clients.clientPatterns.map((client) => `client like '%${escapeSqlLike(client)}%'`),
    ...clients.bundleIds.map((client) => `client='${escapeSqlLiteral(client)}'`),
  ];
  const clientWhere = clientPredicates.length > 0 ? ` and (${clientPredicates.join(" or ")})` : "";
  return `select service,client,client_type,auth_value from access where service like '%Calendar%'${clientWhere} order by service,client;`;
}

function parseTccRows(stdout) {
  if (typeof stdout !== "string") {
    return [];
  }
  return stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [service, client, clientType, authValue] = line.split("|");
      return { service, client, clientType, authValue };
    });
}

function isReadCapableCalendarService(service) {
  const normalized = String(service ?? "");
  return /Calendar/i.test(normalized) && !isWriteOnlyCalendarService(normalized);
}

function isWriteOnlyCalendarService(service) {
  return /CalendarWriteOnly/i.test(String(service ?? ""));
}

function escapeSqlLiteral(value) {
  return String(value).replaceAll("'", "''");
}

function escapeSqlLike(value) {
  return escapeSqlLiteral(value).replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function isFullDiskAccessDeniedError(error) {
  return ["EACCES", "EPERM", "ERR_ACCESS_DENIED"].includes(error?.code);
}

function isMissingProbePathError(error) {
  return ["ENOENT", "ENOTDIR"].includes(error?.code);
}
