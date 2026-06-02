import { getDatabase, getDatabasePath } from "../realtime/tools/database.js";
import { CHAT, EMBEDDINGS, REALTIME, STT, TTS } from "./types.js";

export const PROVIDER_DEFAULT_KEYS = Object.freeze({
  [CHAT]: "provider:default:chat",
  [EMBEDDINGS]: "provider:default:embeddings",
  [TTS]: "provider:default:tts",
  [STT]: "provider:default:stt",
  [REALTIME]: "provider:default:realtime",
});

export const PROVIDER_API_KEY_KEYS = Object.freeze({
  openai: "provider:apikey:openai",
  openrouter: "provider:apikey:openrouter",
});

export const OLLAMA_BASE_URL_KEY = "provider:ollama:baseUrl";

export function getProviderSettingsPath() {
  return getDatabasePath();
}

export function loadProviderDefault(capability, storePath = getProviderSettingsPath()) {
  return loadSetting(getProviderDefaultKey(capability), storePath);
}

export function saveProviderDefault(
  capability,
  providerName,
  storePath = getProviderSettingsPath(),
) {
  return saveSetting(getProviderDefaultKey(capability), providerName, storePath);
}

export function loadProviderApiKey(providerName, storePath = getProviderSettingsPath()) {
  const key = getProviderApiKeyKey(providerName);
  return key ? loadSetting(key, storePath) : null;
}

export function saveProviderApiKey(providerName, apiKey, storePath = getProviderSettingsPath()) {
  const key = getProviderApiKeyKey(providerName);
  if (!key) {
    return null;
  }
  return saveSetting(key, apiKey, storePath);
}

export function loadOllamaBaseUrl(storePath = getProviderSettingsPath()) {
  return loadSetting(OLLAMA_BASE_URL_KEY, storePath);
}

export function saveOllamaBaseUrl(baseUrl, storePath = getProviderSettingsPath()) {
  return saveSetting(OLLAMA_BASE_URL_KEY, baseUrl, storePath);
}

function getProviderDefaultKey(capability) {
  return PROVIDER_DEFAULT_KEYS[capability] ?? `provider:default:${capability}`;
}

function getProviderApiKeyKey(providerName) {
  return PROVIDER_API_KEY_KEYS[normalizeSettingValue(providerName)];
}

function loadSetting(key, storePath) {
  const db = getDatabase(storePath);
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return normalizeSettingValue(row?.value);
}

function saveSetting(key, value, storePath) {
  const normalized = normalizeSettingValue(value);
  const db = getDatabase(storePath);
  if (normalized === null) {
    db.prepare("DELETE FROM settings WHERE key = ?").run(key);
    return null;
  }
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, normalized);
  return normalized;
}

function normalizeSettingValue(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}
