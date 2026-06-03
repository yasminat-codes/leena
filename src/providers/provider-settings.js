import { getDatabase, getDatabasePath } from "../realtime/tools/database.js";
import { ProviderError } from "../utils/errors.js";
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
export const COMPOSIO_CREDENTIAL_KEY = "composio:credential:apiKey";

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

export function loadProviderApiKey(
  providerName,
  storePath = getProviderSettingsPath(),
  secretCodec,
) {
  const key = getProviderApiKeyKey(providerName);
  if (!key || typeof secretCodec?.reveal !== "function") {
    return null;
  }
  const protectedValue = loadSetting(key, storePath);
  return protectedValue ? normalizeSettingValue(secretCodec.reveal(protectedValue)) : null;
}

export function saveProviderApiKey(
  providerName,
  apiKey,
  storePath = getProviderSettingsPath(),
  secretCodec,
) {
  const key = getProviderApiKeyKey(providerName);
  if (!key) {
    return null;
  }
  const normalized = normalizeSettingValue(apiKey);
  if (normalized === null) {
    return saveSetting(key, null, storePath);
  }
  if (typeof secretCodec?.protect !== "function") {
    throw new ProviderError("Secure provider API key storage is unavailable", {
      code: "PROVIDER_API_KEY_STORAGE_UNAVAILABLE",
      provider: normalizeSettingValue(providerName),
    });
  }
  const protectedValue = normalizeSettingValue(secretCodec.protect(normalized));
  if (!protectedValue || protectedValue.includes(normalized)) {
    throw new ProviderError("Provider API key codec returned an unsafe payload", {
      code: "UNSAFE_PROVIDER_API_KEY_PAYLOAD",
      provider: normalizeSettingValue(providerName),
    });
  }
  return saveSetting(key, protectedValue, storePath);
}

export function loadComposioCredential(storePath = getProviderSettingsPath(), secretCodec) {
  if (typeof secretCodec?.reveal !== "function") {
    return null;
  }
  const protectedValue = loadSetting(COMPOSIO_CREDENTIAL_KEY, storePath);
  return protectedValue ? normalizeSettingValue(secretCodec.reveal(protectedValue)) : null;
}

export function saveComposioCredential(
  credential,
  storePath = getProviderSettingsPath(),
  secretCodec,
) {
  const normalized = normalizeSettingValue(credential);
  if (normalized === null) {
    return saveSetting(COMPOSIO_CREDENTIAL_KEY, null, storePath);
  }
  if (typeof secretCodec?.protect !== "function") {
    throw new ProviderError("Secure Composio credential storage is unavailable", {
      code: "COMPOSIO_CREDENTIAL_STORAGE_UNAVAILABLE",
      provider: "composio",
    });
  }
  const protectedValue = normalizeSettingValue(secretCodec.protect(normalized));
  if (!protectedValue || protectedValue.includes(normalized)) {
    throw new ProviderError("Composio credential codec returned an unsafe payload", {
      code: "UNSAFE_COMPOSIO_CREDENTIAL_PAYLOAD",
      provider: "composio",
    });
  }
  return saveSetting(COMPOSIO_CREDENTIAL_KEY, protectedValue, storePath);
}

export function clearComposioCredential(storePath = getProviderSettingsPath()) {
  return saveSetting(COMPOSIO_CREDENTIAL_KEY, null, storePath);
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
