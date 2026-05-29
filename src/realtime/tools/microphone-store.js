import { getDatabase, getDatabasePath } from "./database.js";

const MICROPHONE_DEVICE_KEY = "microphone_device_id";

export function getMicrophoneStorePath() {
  return getDatabasePath();
}

export function loadMicrophoneDeviceId(storePath = getMicrophoneStorePath()) {
  const db = getDatabase(storePath);
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(MICROPHONE_DEVICE_KEY);
  return normalizeDeviceId(row?.value);
}

export function saveMicrophoneDeviceId(deviceId, storePath = getMicrophoneStorePath()) {
  const db = getDatabase(storePath);
  const normalized = normalizeDeviceId(deviceId);
  if (normalized === null) {
    db.prepare("DELETE FROM settings WHERE key = ?").run(MICROPHONE_DEVICE_KEY);
    return null;
  }
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(
    MICROPHONE_DEVICE_KEY,
    normalized,
  );
  return normalized;
}

export function normalizeDeviceId(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  // "default"/"communications" are OS-managed aliases that should not pin a
  // specific device; treat them (and empty) as "follow the system default".
  if (!trimmed || trimmed === "default" || trimmed === "communications") {
    return null;
  }
  return trimmed;
}
