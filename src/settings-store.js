import { getDatabase, getDatabasePath } from "./realtime/tools/database.js";

export const DEFAULT_SETTINGS = Object.freeze({
  theme: "dark",
  treatment: "aurora",
  density: "comfortable",
  hotkey: "CommandOrControl+Shift+L",
  launchOnLogin: false,
  onboardingCompleted: false,
  defaultProvider: "openai",
  defaultChatModel: "gpt-4o",
  defaultEmbeddingModel: "text-embedding-3-small",
  ollamaBaseUrl: "http://localhost:11434",
  wakeMuted: false,
  wakeEnabled: false,
});

export function getSettingsStorePath() {
  return getDatabasePath();
}

export function getSetting(
  key,
  defaultValue = getDefaultValue(key),
  storePath = getSettingsStorePath(),
) {
  const row = getDatabase(storePath)
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(normalizeKey(key));
  if (!row || typeof row.value !== "string") {
    return defaultValue;
  }
  return parseStoredValue(row.value);
}

export function setSetting(key, value, storePath = getSettingsStorePath()) {
  const storedValue = serializeSettingValue(value);
  getDatabase(storePath)
    .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
    .run(normalizeKey(key), storedValue);
  return value;
}

export function getAllSettings(storePath = getSettingsStorePath()) {
  const settings = { ...DEFAULT_SETTINGS };
  const rows = getDatabase(storePath).prepare("SELECT key, value FROM settings ORDER BY key").all();
  for (const row of rows) {
    if (typeof row.key !== "string" || typeof row.value !== "string") {
      continue;
    }
    settings[row.key] = parseStoredValue(row.value);
  }
  return settings;
}

export function deleteSetting(key, storePath = getSettingsStorePath()) {
  const result = getDatabase(storePath)
    .prepare("DELETE FROM settings WHERE key = ?")
    .run(normalizeKey(key));
  return result.changes > 0;
}

export function getString(
  key,
  defaultValue = getDefaultValue(key),
  storePath = getSettingsStorePath(),
) {
  const value = getSetting(key, defaultValue, storePath);
  return typeof value === "string" ? value : defaultValue;
}

export function getBool(
  key,
  defaultValue = getDefaultValue(key),
  storePath = getSettingsStorePath(),
) {
  const value = getSetting(key, defaultValue, storePath);
  return typeof value === "boolean" ? value : defaultValue;
}

export function getNumber(
  key,
  defaultValue = getDefaultValue(key),
  storePath = getSettingsStorePath(),
) {
  const value = getSetting(key, defaultValue, storePath);
  return Number.isFinite(value) ? value : defaultValue;
}

export function getJSON(
  key,
  defaultValue = getDefaultValue(key),
  storePath = getSettingsStorePath(),
) {
  const value = getSetting(key, defaultValue, storePath);
  return isJsonContainer(value) ? value : defaultValue;
}

function getDefaultValue(key) {
  return DEFAULT_SETTINGS[normalizeKey(key)];
}

function normalizeKey(key) {
  if (typeof key !== "string" || !key.trim()) {
    throw new TypeError("Setting key must be a non-empty string.");
  }
  return key.trim();
}

function parseStoredValue(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function serializeSettingValue(value) {
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") {
    throw new TypeError("Setting value must be JSON-serializable.");
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new TypeError("Setting number value must be finite.");
  }
  const storedValue = JSON.stringify(value);
  if (typeof storedValue !== "string") {
    throw new TypeError("Setting value must be JSON-serializable.");
  }
  return storedValue;
}

function isJsonContainer(value) {
  return Boolean(value) && typeof value === "object";
}
