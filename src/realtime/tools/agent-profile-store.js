import { DEFAULT_AGENT_PROFILE, normalizeAgentProfile } from "../prompts.js";
import { getDatabase, getDatabasePath } from "./database.js";

const AGENT_PROFILE_KEY = "agent_profile";

export function getAgentProfileStorePath() {
  return getDatabasePath();
}

export function loadAgentProfile(storePath = getAgentProfileStorePath()) {
  const db = getDatabase(storePath);
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(AGENT_PROFILE_KEY);
  if (!row || typeof row.value !== "string") {
    return { ...DEFAULT_AGENT_PROFILE };
  }
  try {
    return normalizeAgentProfile(JSON.parse(row.value));
  } catch {
    return { ...DEFAULT_AGENT_PROFILE };
  }
}

export function saveAgentProfile(profile, storePath = getAgentProfileStorePath()) {
  const db = getDatabase(storePath);
  const normalized = normalizeAgentProfile(profile);
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(
    AGENT_PROFILE_KEY,
    JSON.stringify(normalized),
  );
  return normalized;
}
