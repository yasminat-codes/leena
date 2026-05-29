import { getDatabase, getDatabasePath } from "./database.js";

const WINDOW_POSITION_KEY = "window_position";

export function getWindowStateStorePath() {
  return getDatabasePath();
}

export function loadWindowPosition(storePath = getWindowStateStorePath()) {
  const db = getDatabase(storePath);
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(WINDOW_POSITION_KEY);
  if (!row || typeof row.value !== "string") {
    return null;
  }
  try {
    return normalizeWindowPosition(JSON.parse(row.value));
  } catch {
    return null;
  }
}

export function saveWindowPosition(position, storePath = getWindowStateStorePath()) {
  const normalized = normalizeWindowPosition(position);
  if (!normalized) {
    return null;
  }
  const db = getDatabase(storePath);
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(
    WINDOW_POSITION_KEY,
    JSON.stringify(normalized),
  );
  return normalized;
}

export function normalizeWindowPosition(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const { x, y } = value;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return { x: Math.round(x), y: Math.round(y) };
}
