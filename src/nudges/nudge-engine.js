const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_VISIBLE_LIMIT = 3;
const DEFAULT_PLANNER_WINDOW_MS = DAY_MS;
const DEFAULT_DISMISS_WINDOW_MS = 7 * DAY_MS;
const DEFAULT_MEMORY_STALE_MS = 3 * DAY_MS;
const DEFAULT_MEMORY_LIMIT = 24;
const MAX_TEXT_LENGTH = 160;

export const NUDGE_SETTINGS = Object.freeze({
  dismissed: "dismissedNudges",
  enabled: "nudgesEnabled",
  settingsToggle: "proactiveNudges",
});

export const NUDGE_TYPES = Object.freeze({
  followUp: "follow-up",
  reminder: "reminder",
  upcomingEvent: "upcoming-event",
  upcomingTask: "upcoming-task",
});

const FOLLOW_UP_QUERY = "follow up reminder check in circle back get back reply email";
const FOLLOW_UP_PATTERN =
  /\b(follow[-\s]?up|check in|circle back|get back|reply|respond|email|message|ping)\b/i;
const REMINDER_PATTERN = /\b(remind|reminder|due|deadline|by|before)\b/i;

export async function generateNudges(options = {}) {
  const now = normalizeNow(options.now);
  const visibleLimit = normalizePositiveInteger(options.visibleLimit, DEFAULT_VISIBLE_LIMIT);
  const plannerWindowMs = normalizePositiveInteger(
    options.plannerWindowMs,
    DEFAULT_PLANNER_WINDOW_MS,
  );
  const dismissWindowMs = normalizePositiveInteger(
    options.dismissWindowMs,
    DEFAULT_DISMISS_WINDOW_MS,
  );
  const memoryStaleMs = normalizePositiveInteger(options.memoryStaleMs, DEFAULT_MEMORY_STALE_MS);
  const memoryLimit = normalizePositiveInteger(options.memoryLimit, DEFAULT_MEMORY_LIMIT);
  const settings = options.settings ?? {};
  const enabled = await readNudgesEnabled(settings);

  if (!enabled) {
    return createNudgePayload([], { enabled: false, now, visibleLimit });
  }

  const dismissals = await readActiveDismissals(settings, now, dismissWindowMs);
  const [plannerNudges, memoryNudges] = await Promise.all([
    loadPlannerNudges(options.planner, now, plannerWindowMs),
    loadMemoryNudges(options.memory, now, plannerWindowMs, memoryStaleMs, memoryLimit),
  ]);
  const nudges = dedupeNudges([...plannerNudges, ...memoryNudges])
    .filter((nudge) => !dismissals.has(nudge.id))
    .sort(compareNudges)
    .map(stripSortFields);

  return createNudgePayload(nudges, { enabled: true, now, visibleLimit });
}

export async function dismissNudge(id, options = {}) {
  const nudgeId = normalizeText(id, 120);
  if (!nudgeId) {
    throw new TypeError("Nudge id is required.");
  }
  const now = normalizeNow(options.now);
  const settings = options.settings ?? {};
  const dismissWindowMs = normalizePositiveInteger(
    options.dismissWindowMs,
    DEFAULT_DISMISS_WINDOW_MS,
  );
  const activeDismissals = Object.fromEntries(
    await readActiveDismissals(settings, now, dismissWindowMs, { asEntries: true }),
  );
  activeDismissals[nudgeId] = now.toISOString();
  await writeSetting(settings, NUDGE_SETTINGS.dismissed, activeDismissals);
  return { dismissedAt: activeDismissals[nudgeId], id: nudgeId };
}

export async function readNudgesEnabled(settings = {}) {
  const visibleSettingsToggle = await readSetting(
    settings,
    NUDGE_SETTINGS.settingsToggle,
    undefined,
  );
  if (typeof visibleSettingsToggle === "boolean") {
    return visibleSettingsToggle;
  }
  const legacyExplicit = await readSetting(settings, NUDGE_SETTINGS.enabled, undefined);
  return legacyExplicit === true;
}

export function createNudgePayload(nudges, { enabled, now = new Date(), visibleLimit } = {}) {
  const normalizedVisibleLimit = normalizePositiveInteger(visibleLimit, DEFAULT_VISIBLE_LIMIT);
  const normalizedNudges = Array.isArray(nudges) ? nudges.map(normalizeNudge).filter(Boolean) : [];
  return {
    enabled: enabled === true,
    generatedAt: normalizeNow(now).toISOString(),
    hiddenCount: Math.max(0, normalizedNudges.length - normalizedVisibleLimit),
    nudges: normalizedNudges,
    visibleLimit: normalizedVisibleLimit,
  };
}

async function loadPlannerNudges(planner, now, windowMs) {
  if (!planner) {
    return [];
  }
  const upcoming = await readPlannerUpcoming(planner);
  const tasks = unwrapList(upcoming?.tasks ?? upcoming?.taskItems ?? upcoming, ["tasks", "items"]);
  const events = unwrapList(upcoming?.calendarItems ?? upcoming?.events ?? upcoming?.calendar, [
    "calendarItems",
    "events",
    "items",
  ]);

  return [
    ...tasks.map((task) => createPlannerNudge(task, now, windowMs, "task")),
    ...events.map((event) => createPlannerNudge(event, now, windowMs, "event")),
  ].filter(Boolean);
}

async function readPlannerUpcoming(planner) {
  if (typeof planner.getUpcoming === "function") {
    return planner.getUpcoming();
  }
  const [tasks, calendarItems] = await Promise.all([
    typeof planner.listTasks === "function" ? planner.listTasks() : [],
    typeof planner.listCalendarItems === "function" ? planner.listCalendarItems() : [],
  ]);
  return { calendarItems, tasks };
}

function createPlannerNudge(item, now, windowMs, kind) {
  const record = isRecord(item) ? item : {};
  if (kind === "task" && isCompletedTask(record)) {
    return null;
  }
  const dueAt = resolveScheduledTime(record, now);
  if (!dueAt || !isWithinWindow(dueAt, now, windowMs)) {
    return null;
  }
  const title = firstText(record.title, record.name, "Untitled");
  const detail = firstText(
    record.description,
    record.detail,
    kind === "task" ? "Planner task" : "Calendar event",
  );
  const type = kind === "task" ? NUDGE_TYPES.upcomingTask : NUDGE_TYPES.upcomingEvent;
  return normalizeNudge({
    datetime: dueAt.toISOString(),
    detail,
    id: `${type}:${stableId(record, title, dueAt)}`,
    meta: formatRelativeTime(dueAt, now),
    sortRank: kind === "event" ? 10 : 20,
    sortTime: dueAt.getTime(),
    source: kind === "task" ? "planner" : "calendar",
    title: kind === "task" ? `Task due: ${title}` : `Event soon: ${title}`,
    type,
  });
}

async function loadMemoryNudges(memory, now, windowMs, staleMs, limit) {
  if (!memory || typeof memory.recall !== "function") {
    return [];
  }
  const results = unwrapList(await memory.recall(FOLLOW_UP_QUERY, limit), [
    "entries",
    "items",
    "results",
  ]);
  const nudges = [];
  for (const [index, result] of results.entries()) {
    const entry = unwrapMemoryEntry(result);
    if (!entry || !isSemanticEntry(entry)) {
      continue;
    }
    const content = normalizeText(
      firstText(entry.content, entry.summary, entry.text),
      MAX_TEXT_LENGTH,
    );
    if (!content || !hasFollowUpSignal(content)) {
      continue;
    }
    const reminderAt = resolveMemoryReminderTime(entry, now);
    if (reminderAt && isWithinWindow(reminderAt, now, windowMs)) {
      nudges.push(createMemoryNudge(entry, content, index, now, NUDGE_TYPES.reminder, reminderAt));
      continue;
    }
    const lastSeen = parseDate(
      firstText(entry.lastSeen, entry.last_seen, entry.updatedAt, entry.createdAt),
      now,
    );
    if (!lastSeen || now.getTime() - lastSeen.getTime() <= staleMs) {
      continue;
    }
    nudges.push(createMemoryNudge(entry, content, index, now, NUDGE_TYPES.followUp, lastSeen));
  }
  return nudges;
}

function createMemoryNudge(entry, content, index, now, type, date) {
  const isReminder = type === NUDGE_TYPES.reminder;
  const entryId = firstText(entry.id, `memory-${index + 1}`);
  return normalizeNudge({
    datetime: isReminder ? date.toISOString() : "",
    detail: content,
    id: `${type}:memory:${entryId}`,
    meta: isReminder ? formatRelativeTime(date, now) : "Memory follow-up",
    sortRank: isReminder ? 30 : 40,
    sortTime: isReminder ? date.getTime() : Number.MAX_SAFE_INTEGER - index,
    source: "memory",
    title: isReminder ? "Reminder" : "Follow up",
    type,
  });
}

function normalizeNudge(nudge) {
  if (!isRecord(nudge)) {
    return null;
  }
  const id = normalizeText(nudge.id, 120);
  const type = normalizeText(nudge.type, 40);
  const title = normalizeText(nudge.title, 96);
  const detail = normalizeText(nudge.detail, MAX_TEXT_LENGTH);
  if (!id || !type || !title || !detail) {
    return null;
  }
  return {
    datetime: normalizeText(nudge.datetime, 40),
    detail,
    id,
    meta: normalizeText(nudge.meta, 80),
    source: normalizeText(nudge.source, 40),
    title,
    type,
    ...(Number.isFinite(nudge.sortRank) ? { sortRank: nudge.sortRank } : {}),
    ...(Number.isFinite(nudge.sortTime) ? { sortTime: nudge.sortTime } : {}),
  };
}

async function readActiveDismissals(settings, now, dismissWindowMs, { asEntries = false } = {}) {
  const stored = await readSetting(settings, NUDGE_SETTINGS.dismissed, {});
  const entries = normalizeDismissalEntries(stored).filter(([, timestamp]) => {
    const dismissedAt = parseDate(timestamp, now);
    return dismissedAt && now.getTime() - dismissedAt.getTime() < dismissWindowMs;
  });
  return asEntries ? entries : new Set(entries.map(([id]) => id));
}

function normalizeDismissalEntries(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!isRecord(item)) {
          return null;
        }
        const id = normalizeText(item.id, 120);
        const timestamp = firstText(item.timestamp, item.dismissedAt, item.time);
        return id && timestamp ? [id, timestamp] : null;
      })
      .filter(Boolean);
  }
  if (!isRecord(value)) {
    return [];
  }
  return Object.entries(value)
    .map(([id, timestamp]) => [normalizeText(id, 120), firstText(timestamp)])
    .filter(([id, timestamp]) => id && timestamp);
}

function stripSortFields(nudge) {
  const { sortRank, sortTime, ...publicNudge } = nudge;
  return publicNudge;
}

function dedupeNudges(nudges) {
  const seen = new Set();
  const unique = [];
  for (const nudge of nudges) {
    if (!nudge || seen.has(nudge.id)) {
      continue;
    }
    seen.add(nudge.id);
    unique.push(nudge);
  }
  return unique;
}

function compareNudges(left, right) {
  const leftRank = Number.isFinite(left.sortRank) ? left.sortRank : 99;
  const rightRank = Number.isFinite(right.sortRank) ? right.sortRank : 99;
  const leftTime = Number.isFinite(left.sortTime) ? left.sortTime : Number.MAX_SAFE_INTEGER;
  const rightTime = Number.isFinite(right.sortTime) ? right.sortTime : Number.MAX_SAFE_INTEGER;
  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  return left.id.localeCompare(right.id);
}

function isCompletedTask(task) {
  return /^(completed|done|cancelled|canceled)$/i.test(firstText(task.status, task.state));
}

function hasFollowUpSignal(content) {
  return FOLLOW_UP_PATTERN.test(content) || REMINDER_PATTERN.test(content);
}

function isSemanticEntry(entry) {
  const type = firstText(entry.type, entry.memoryType);
  return !type || type === "semantic";
}

function unwrapMemoryEntry(value) {
  const entry = isRecord(value?.entry) ? value.entry : value;
  return isRecord(entry) ? entry : null;
}

function resolveMemoryReminderTime(entry, now) {
  const metadata = isRecord(entry.metadata) ? entry.metadata : {};
  return resolveScheduledTime({ ...metadata, ...entry }, now);
}

function resolveScheduledTime(record, now) {
  const directKeys = [
    "dueAt",
    "dueDate",
    "due_date",
    "startsAt",
    "startAt",
    "start_at",
    "datetime",
    "remindAt",
    "reminderAt",
    "followUpAt",
    "follow_up_at",
  ];
  for (const key of directKeys) {
    const parsed = parseDate(record[key], now);
    if (parsed) {
      return parsed;
    }
  }

  const date = firstText(record.date, record.day);
  const time = firstText(record.time, record.startTime, record.start_time);
  if (date || time) {
    return parseDateAndTime(date, time, now);
  }
  return null;
}

function parseDateAndTime(dateValue, timeValue, now) {
  const date = normalizeCalendarDate(dateValue, now);
  const time = parseTimeOfDay(timeValue);
  if (!date && !time) {
    return null;
  }
  const resolved = date ?? new Date(now);
  if (time) {
    resolved.setHours(time.hours, time.minutes, 0, 0);
  } else if (sameLocalDay(resolved, now) && resolved.getTime() < now.getTime()) {
    resolved.setTime(now.getTime());
  }
  return Number.isNaN(resolved.getTime()) ? null : resolved;
}

function normalizeCalendarDate(value, now) {
  const text = firstText(value).toLowerCase();
  if (!text) {
    return null;
  }
  if (text === "today") {
    return startOfLocalDay(now);
  }
  if (text === "tomorrow") {
    const tomorrow = startOfLocalDay(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
  const ymd = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 0, 0, 0, 0);
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseTimeOfDay(value) {
  const text = firstText(value);
  if (!text) {
    return null;
  }
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]m)?$/i);
  if (!match) {
    return null;
  }
  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  const meridiem = match[3]?.toLowerCase();
  if (hours > 24 || minutes > 59) {
    return null;
  }
  if (meridiem === "pm" && hours < 12) {
    hours += 12;
  }
  if (meridiem === "am" && hours === 12) {
    hours = 0;
  }
  return { hours, minutes };
}

function parseDate(value, now) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const text = firstText(value);
  if (!text) {
    return null;
  }
  const lower = text.toLowerCase();
  if (lower === "today") {
    return new Date(now);
  }
  if (lower === "tomorrow") {
    const tomorrow = startOfLocalDay(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
  const ymd = lower.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const localDate = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 0, 0, 0, 0);
    return sameLocalDay(localDate, now) && localDate.getTime() < now.getTime()
      ? new Date(now)
      : localDate;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWithinWindow(date, now, windowMs) {
  const elapsed = date.getTime() - now.getTime();
  return elapsed >= 0 && elapsed <= windowMs;
}

function formatRelativeTime(date, now) {
  const minutes = Math.max(0, Math.round((date.getTime() - now.getTime()) / 60_000));
  if (minutes < 60) {
    return minutes <= 1 ? "In 1 minute" : `In ${minutes} minutes`;
  }
  const hours = Math.round(minutes / 60);
  return hours <= 1 ? "In 1 hour" : `In ${hours} hours`;
}

function stableId(record, title, date) {
  return firstText(record.id, `${title}:${date.toISOString()}`)
    .toLowerCase()
    .replace(/[^a-z0-9:._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function unwrapList(value, keys) {
  if (Array.isArray(value)) {
    return value;
  }
  if (!isRecord(value)) {
    return [];
  }
  for (const key of keys) {
    if (Array.isArray(value[key])) {
      return value[key];
    }
  }
  return [];
}

async function readSetting(settings, key, fallback) {
  if (typeof settings.getBool === "function") {
    const value = await settings.getBool(key, fallback);
    if (typeof value === "boolean") {
      return value;
    }
  }
  if (typeof settings.getSetting === "function") {
    return settings.getSetting(key, fallback);
  }
  if (typeof settings.get === "function") {
    return settings.has?.(key) ? settings.get(key) : fallback;
  }
  return Object.hasOwn(settings, key) ? settings[key] : fallback;
}

async function writeSetting(settings, key, value) {
  if (typeof settings.setSetting === "function") {
    return settings.setSetting(key, value);
  }
  if (typeof settings.set === "function") {
    settings.set(key, value);
    return value;
  }
  settings[key] = value;
  return value;
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value !== "string" && typeof value !== "number") {
      continue;
    }
    const text = String(value).trim();
    if (text) {
      return text;
    }
  }
  return "";
}

function normalizeText(value, maxLength) {
  const text = firstText(value).replace(/\s+/g, " ");
  if (text.length <= maxLength) {
    return text;
  }
  const suffix = "...";
  const limit = Math.max(0, maxLength - suffix.length);
  return `${text.slice(0, limit).trim()}${suffix}`;
}

function normalizeNow(value) {
  const parsed = value instanceof Date ? new Date(value) : new Date(value ?? Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function startOfLocalDay(value) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
}

function sameLocalDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
