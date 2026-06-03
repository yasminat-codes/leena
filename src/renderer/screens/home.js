const RECENT_LIMIT = 5;
const UP_NEXT_LIMIT = 3;
export const HOME_REFRESH_INTERVAL_MS = 60_000;

const HOME_COPY = Object.freeze({
  askPlaceholder: "Ask Leena anything...",
  prompt: "Brief me on my day",
  status: "READY",
  userName: "Yasmine",
});

const loadingRecentActions = Object.freeze(
  Array.from({ length: RECENT_LIMIT }, (_unused, index) =>
    Object.freeze({
      id: `loading-recent-${index + 1}`,
      label: "Loading recent activity",
      detail: "Reading memory and activity...",
      timestamp: "Syncing",
      datetime: "",
      icon: "LD",
      source: "loading",
      loading: true,
    }),
  ),
);

const loadingUpNext = Object.freeze(
  Array.from({ length: UP_NEXT_LIMIT }, (_unused, index) =>
    Object.freeze({
      id: `loading-next-${index + 1}`,
      time: `00:0${index}`,
      title: "Loading planner item",
      detail: "Checking upcoming calendar blocks...",
      type: "Sync",
      datetime: "",
      loading: true,
    }),
  ),
);

// Kept for compatibility with the existing shell test contract. Production
// rendering no longer uses static user activity or planner fixture rows.
export const MOCK_HOME_DATA = Object.freeze({
  greeting: buildGreeting(HOME_COPY.userName),
  status: HOME_COPY.status,
  askPlaceholder: HOME_COPY.askPlaceholder,
  prompt: HOME_COPY.prompt,
  recentActions: loadingRecentActions,
  upNext: loadingUpNext,
});

let activeHomeRefresh = null;

function getDefaultBridge() {
  return typeof window === "undefined" ? null : window.leena;
}

function getDefaultDocument() {
  return typeof document === "undefined" ? null : document;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return "";
}

function normalizeLimit(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function buildGreeting(name = HOME_COPY.userName, now = null) {
  const hour = now instanceof Date && !Number.isNaN(now.getTime()) ? now.getHours() : 9;
  const period = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const trimmedName = firstString(name, HOME_COPY.userName);
  return `Good ${period}, ${trimmedName}`;
}

function unwrapList(value, keys = ["entries", "items"]) {
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

function unwrapMemoryResult(value) {
  const record = isRecord(value?.entry) ? value.entry : value;
  return isRecord(record) ? record : {};
}

function clampText(value, max = 120) {
  const text = firstString(value);
  return text.length > max ? `${text.slice(0, Math.max(0, max - 1)).trim()}...` : text;
}

function initials(value, fallback = "LN") {
  const text = firstString(value, fallback);
  const letters = text
    .split(/[\s_-]+/)
    .map((part) => part.at(0))
    .filter(Boolean)
    .join("")
    .toUpperCase();
  return (letters || fallback).slice(0, 2);
}

function parseTime(value) {
  const raw = firstString(value);
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatClock(date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function sameLocalDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTimestamp(value, now = new Date()) {
  const raw = firstString(value);
  const parsed = parseTime(raw);
  if (!parsed) {
    return raw;
  }
  const label = sameLocalDay(parsed, now)
    ? "Today"
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }).format(parsed);
  return `${label} · ${formatClock(parsed)}`;
}

function sortNewestFirst(items) {
  return [...items].sort((left, right) => {
    const leftTime = parseTime(left.sortTime)?.getTime() ?? 0;
    const rightTime = parseTime(right.sortTime)?.getTime() ?? 0;
    if (leftTime === rightTime) {
      return left.index - right.index;
    }
    return rightTime - leftTime;
  });
}

function normalizeActivityEntry(entry, index, now) {
  const kind = firstString(entry.kind, entry.type, "activity");
  const time = firstString(entry.time, entry.timestamp, entry.createdAt, entry.created_at);
  const title = firstString(
    entry.title,
    entry.summary,
    entry.query ? `Web search: ${entry.query}` : "",
    entry.task,
    entry.url,
    kind.replaceAll("_", " "),
    "Recent activity",
  );
  const detail = firstString(
    entry.preview,
    entry.detail,
    entry.statusText,
    entry.finalText,
    entry.text,
    entry.snippet,
    entry.url,
    Number.isInteger(entry.resultCount) ? `${entry.resultCount} results` : "",
    "Activity recorded by Leena",
  );

  return {
    id: firstString(entry.id, `activity-${index + 1}`),
    label: clampText(title, 96),
    detail: clampText(detail, 132),
    timestamp: formatTimestamp(time, now),
    datetime: parseTime(time)?.toISOString() ?? "",
    icon: initials(kind, "AC"),
    source: "activity",
    sortTime: time,
    index,
  };
}

function normalizeMemoryEntry(value, index, now) {
  const entry = unwrapMemoryResult(value);
  const time = firstString(entry.createdAt, entry.created_at, entry.timestamp, entry.time);
  const content = firstString(entry.summary, entry.content, entry.text, "Memory saved");
  const memoryType = firstString(entry.type, entry.category, "memory");

  return {
    id: firstString(entry.id, `memory-${index + 1}`),
    label: clampText(content, 96),
    detail: clampText(`Memory · ${memoryType}`, 132),
    timestamp: formatTimestamp(time, now),
    datetime: parseTime(time)?.toISOString() ?? "",
    icon: "ME",
    source: "memory",
    sortTime: time,
    index: index + 10_000,
  };
}

function normalizePlannerItem(item, index) {
  const title = firstString(item.title, item.name, "Untitled planner item");
  const date = firstString(item.date, item.day);
  const time = firstString(item.time, item.startTime, item.start_time, item.dueDate, item.due_date);
  const startsAt = firstString(item.startsAt, item.startAt, item.start_at, item.datetime);
  const parsedStart = parseTime(startsAt);
  const displayTime = firstString(time, parsedStart ? formatClock(parsedStart) : "", date, "Soon");
  const detail = firstString(item.description, item.detail, date, "Planner item");
  const type = firstString(item.type, item.kind, item.status ? "Task" : "Event");

  return {
    id: firstString(item.id, `planner-${index + 1}`),
    title: clampText(title, 72),
    detail: clampText(detail, 96),
    time: clampText(displayTime, 24),
    type: clampText(type, 20),
    datetime: parsedStart?.toISOString() ?? "",
    sortTime: startsAt || `${date} ${time}`,
    index,
  };
}

function normalizePreferences(value = {}) {
  const record = isRecord(value) ? value : {};
  return {
    prompt: firstString(record.prompt, record.briefPrompt, HOME_COPY.prompt),
    status: firstString(record.status, HOME_COPY.status).toUpperCase(),
    userName: firstString(record.userName, record.name, record.identity?.name, HOME_COPY.userName),
  };
}

function normalizeError(error) {
  if (!error) {
    return null;
  }
  return error instanceof Error ? error.message : String(error);
}

export function normalizeHomeData(data = {}, options = {}) {
  const recentLimit = normalizeLimit(options.recentLimit, RECENT_LIMIT);
  const upNextLimit = normalizeLimit(options.upNextLimit, UP_NEXT_LIMIT);
  const now = options.now instanceof Date ? options.now : new Date();
  const greetingNow = options.now instanceof Date ? options.now : null;
  const preferences = normalizePreferences(data.preferences);
  const errors = Array.isArray(data.errors) ? data.errors.map(normalizeError).filter(Boolean) : [];

  if (Array.isArray(data.recentActions) || Array.isArray(data.upNext)) {
    return {
      askPlaceholder: firstString(data.askPlaceholder, HOME_COPY.askPlaceholder),
      errors,
      greeting: firstString(data.greeting, buildGreeting(preferences.userName, greetingNow)),
      loading: data.loading === true,
      prompt: firstString(data.prompt, preferences.prompt),
      recentActions: Array.isArray(data.recentActions)
        ? data.recentActions.slice(0, recentLimit)
        : [],
      status: firstString(data.status, preferences.status).toUpperCase(),
      upNext: Array.isArray(data.upNext) ? data.upNext.slice(0, upNextLimit) : [],
    };
  }

  if (data.loading === true) {
    return {
      askPlaceholder: HOME_COPY.askPlaceholder,
      errors,
      greeting: buildGreeting(preferences.userName, greetingNow),
      loading: true,
      prompt: preferences.prompt,
      recentActions: loadingRecentActions.slice(0, recentLimit),
      status: preferences.status,
      upNext: loadingUpNext.slice(0, upNextLimit),
    };
  }

  const activity = unwrapList(data.activity ?? data.recentActivity, [
    "entries",
    "items",
    "activity",
  ]).map((entry, index) => normalizeActivityEntry(entry, index, now));
  const memories = unwrapList(data.memory ?? data.memoryEntries, [
    "entries",
    "items",
    "results",
  ]).map((entry, index) => normalizeMemoryEntry(entry, index, now));
  const plannerItems = unwrapList(data.planner ?? data.upcoming ?? data.calendarItems, [
    "items",
    "calendarItems",
    "tasks",
  ]).map((item, index) => normalizePlannerItem(item, index));

  return {
    askPlaceholder: HOME_COPY.askPlaceholder,
    errors,
    greeting: buildGreeting(preferences.userName, greetingNow),
    loading: false,
    prompt: preferences.prompt,
    recentActions: sortNewestFirst([...activity, ...memories])
      .slice(0, recentLimit)
      .map(({ index, sortTime, ...item }) => item),
    status: preferences.status,
    upNext: plannerItems.slice(0, upNextLimit).map(({ index, sortTime, ...item }) => item),
  };
}

async function callOptional(label, callback) {
  try {
    return { label, value: await callback() };
  } catch (error) {
    return { error, label, value: null };
  }
}

function isUnavailableIpcError(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /no handler|not.*registered|unknown.*channel|not available|not found/i.test(message);
}

async function loadRecentActivity(bridge, limit) {
  if (typeof bridge?.invoke === "function") {
    const result = await callOptional("activity:get-recent", () =>
      bridge.invoke("activity:get-recent", { limit }),
    );
    if (!result.error || !isUnavailableIpcError(result.error)) {
      return result;
    }
  }
  if (typeof bridge?.getActivity === "function") {
    return callOptional("activity:list", () => bridge.getActivity());
  }
  return { label: "activity:none", value: [] };
}

async function loadMemoryEntries(bridge, limit, query) {
  if (typeof bridge?.memory?.recall === "function") {
    return callOptional("memory:recall", () => bridge.memory.recall(query, limit));
  }
  if (typeof bridge?.invoke === "function") {
    return callOptional("memory:recall", () => bridge.invoke("memory:recall", { limit, query }));
  }
  return { label: "memory:none", value: [] };
}

async function loadPlannerItems(bridge, limit) {
  if (typeof bridge?.invoke === "function") {
    const result = await callOptional("planner:get-upcoming", () =>
      bridge.invoke("planner:get-upcoming", { limit }),
    );
    if (!result.error || !isUnavailableIpcError(result.error)) {
      return result;
    }
  }
  if (typeof bridge?.getCalendarItems === "function") {
    return callOptional("planner:list-calendar", () => bridge.getCalendarItems());
  }
  if (typeof bridge?.getPlannerTasks === "function") {
    return callOptional("planner:list-tasks", () => bridge.getPlannerTasks());
  }
  return { label: "planner:none", value: [] };
}

async function loadHomePreferences(bridge) {
  if (typeof bridge?.getSetting !== "function") {
    return { label: "settings:none", value: {} };
  }

  return callOptional("settings:get", async () => {
    const [userName, prompt] = await Promise.all([
      bridge.getSetting("home:user-name", HOME_COPY.userName),
      bridge.getSetting("home:brief-prompt", HOME_COPY.prompt),
    ]);
    return { prompt, userName };
  });
}

export async function loadHomeData(bridge = getDefaultBridge(), options = {}) {
  const recentLimit = normalizeLimit(options.recentLimit, RECENT_LIMIT);
  const upNextLimit = normalizeLimit(options.upNextLimit, UP_NEXT_LIMIT);
  const memoryQuery = firstString(options.memoryQuery, "recent activity planner calendar");

  if (!bridge) {
    return normalizeHomeData({ activity: [], memory: [], planner: [] }, options);
  }

  const [activity, memory, planner, preferences] = await Promise.all([
    loadRecentActivity(bridge, recentLimit),
    loadMemoryEntries(bridge, recentLimit, memoryQuery),
    loadPlannerItems(bridge, upNextLimit),
    loadHomePreferences(bridge),
  ]);

  return normalizeHomeData(
    {
      activity: activity.value,
      errors: [activity.error, memory.error, planner.error, preferences.error],
      memory: memory.value,
      planner: planner.value,
      preferences: preferences.value,
    },
    options,
  );
}

function renderRecentAction(action) {
  const loadingAttribute = action.loading ? ' data-home-loading="true" aria-busy="true"' : "";
  const datetime = action.datetime
    ? `<time class="lx-mono text-faint" datetime="${escapeHtml(action.datetime)}">${escapeHtml(action.timestamp)}</time>`
    : `<span class="lx-mono text-faint">${escapeHtml(action.timestamp)}</span>`;
  return `
    <article class="row" data-home-recent-id="${escapeHtml(action.id)}" data-home-source="${escapeHtml(action.source)}"${loadingAttribute}>
      <span class="home-marker" data-home-icon="${escapeHtml(action.icon)}" aria-hidden="true"></span>
      <span class="row__txt">
        <strong class="lx-body screen-text-strong">${escapeHtml(action.label)}</strong>
        <span class="lx-sm text-dim">${escapeHtml(action.detail)}</span>
        ${datetime}
      </span>
    </article>
  `;
}

function renderEmptyRecent() {
  return `
    <article class="row" data-home-empty="recent">
      <span class="home-marker" aria-hidden="true"></span>
      <span class="row__txt">
        <strong class="lx-body screen-text-strong">No recent activity yet</strong>
        <span class="lx-sm text-dim">Memory and tool activity will appear here after Leena helps.</span>
      </span>
    </article>
  `;
}

function renderRecentList(data) {
  return data.recentActions.length > 0
    ? data.recentActions.map(renderRecentAction).join("")
    : renderEmptyRecent();
}

function renderTimelineEntry(item) {
  const loadingAttribute = item.loading ? ' data-home-loading="true" aria-busy="true"' : "";
  const type = item.type ? `<span class="chip">${escapeHtml(item.type)}</span>` : "";
  return `
    <article class="row" data-home-up-next-id="${escapeHtml(item.id)}"${loadingAttribute}>
      <span class="lx-mono">${escapeHtml(item.time)}</span>
      <span class="row__txt">
        <strong class="lx-body screen-text-strong">${escapeHtml(item.title)}</strong>
        <span class="lx-sm text-dim">${escapeHtml(item.detail)}</span>
      </span>
      ${type}
    </article>
  `;
}

function renderEmptyUpNext() {
  return `
    <article class="row" data-home-empty="up-next">
      <span class="lx-mono">Soon</span>
      <span class="row__txt">
        <strong class="lx-body screen-text-strong">Nothing planned next</strong>
        <span class="lx-sm text-dim">Planner and calendar items will appear here when available.</span>
      </span>
    </article>
  `;
}

function renderUpNextList(data) {
  return data.upNext.length > 0
    ? data.upNext.map(renderTimelineEntry).join("")
    : renderEmptyUpNext();
}

export function renderHomeData(data = {}) {
  const normalized = normalizeHomeData(data);
  const isLoading = normalized.loading === true;

  return `
    <section class="home-screen" aria-label="Home">
      <section class="home-command" aria-labelledby="home-greeting">
        <div class="home-command__surface">
          <div class="home-command__meta">
            <span class="home-status">
              <span class="home-status__dot" aria-hidden="true"></span>
              <span data-home-status-label>${escapeHtml(normalized.status)}</span>
            </span>
          </div>

          <div class="home-command__center">
            <div class="home-command__copy">
              <h1 id="home-greeting" class="lx-display">${escapeHtml(normalized.greeting)}</h1>
              <p class="lx-body text-dim">Start with voice, type a command, or let Leena prepare the next move.</p>
              <button class="home-command__input" type="button">
                <span class="home-command__input-mark" aria-hidden="true"></span>
                <span class="home-command__input-text">${escapeHtml(normalized.askPlaceholder)}</span>
                <span class="home-command__input-hint">Return</span>
              </button>
            </div>
            <div class="home-command__orb-well" aria-hidden="true">
              <div class="orb home-command__orb">
                <span class="orb__ring" aria-hidden="true"></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="home-context home-context--recent" aria-labelledby="recent-actions-title">
        <div class="home-context__header">
          <h2 id="recent-actions-title" class="lx-h2">Recent actions</h2>
          <span class="lx-mono text-faint">Memory</span>
        </div>
        <div class="home-list" data-home-recent-list${isLoading ? ' aria-busy="true"' : ""}>
          ${renderRecentList(normalized)}
        </div>
      </section>

      <section class="home-context home-context--next" aria-labelledby="up-next-title">
        <div class="home-context__header">
          <h2 id="up-next-title" class="lx-h2">Up next</h2>
          <span class="lx-mono text-faint">Today</span>
        </div>
        <div class="home-list" data-home-up-next-list${isLoading ? ' aria-busy="true"' : ""}>
          ${renderUpNextList(normalized)}
        </div>
        <button class="home-brief" type="button">
          <span class="lx-h3">${escapeHtml(normalized.prompt)}</span>
        </button>
      </section>
    </section>
  `;
}

export function renderHome() {
  scheduleHomeHydration();
  return renderHomeData({ loading: true });
}

function findHomeScreen(root) {
  return root?.querySelector?.(".home-screen") ?? null;
}

function updateText(node, value) {
  if (node) {
    node.textContent = value;
  }
}

export function updateHomeScreen(root, data = {}) {
  const screen = findHomeScreen(root);
  if (!screen) {
    return null;
  }
  const normalized = normalizeHomeData(data);
  updateText(screen.querySelector?.("#home-greeting"), normalized.greeting);
  updateText(screen.querySelector?.("[data-home-status-label]"), normalized.status);
  updateText(screen.querySelector?.(".home-brief .lx-h3"), normalized.prompt);

  const recentList = screen.querySelector?.("[data-home-recent-list]");
  if (recentList) {
    recentList.innerHTML = renderRecentList(normalized);
    recentList.removeAttribute?.("aria-busy");
  }

  const upNextList = screen.querySelector?.("[data-home-up-next-list]");
  if (upNextList) {
    upNextList.innerHTML = renderUpNextList(normalized);
    upNextList.removeAttribute?.("aria-busy");
  }

  return normalized;
}

export async function refreshHomeScreen(root = getDefaultDocument(), bridge = getDefaultBridge()) {
  if (!root || !findHomeScreen(root)) {
    return null;
  }
  const data = await loadHomeData(bridge);
  return updateHomeScreen(root, data);
}

export function startHomeAutoRefresh(
  root = getDefaultDocument(),
  bridge = getDefaultBridge(),
  intervalMs = HOME_REFRESH_INTERVAL_MS,
) {
  if (!root || !bridge || typeof setInterval !== "function") {
    return () => {};
  }

  const screen = findHomeScreen(root);
  if (!screen) {
    return () => {};
  }

  if (activeHomeRefresh?.screen === screen) {
    return activeHomeRefresh.dispose;
  }

  activeHomeRefresh?.dispose();
  let disposed = false;
  const refresh = () => {
    if (disposed) {
      return;
    }
    if (!findHomeScreen(root)) {
      activeHomeRefresh?.dispose();
      return;
    }
    void refreshHomeScreen(root, bridge).catch(() => {
      /* The loading or last-rendered state remains usable if IPC is temporarily unavailable. */
    });
  };
  const intervalId = setInterval(refresh, intervalMs);

  activeHomeRefresh = {
    dispose() {
      disposed = true;
      clearInterval(intervalId);
      if (activeHomeRefresh?.screen === screen) {
        activeHomeRefresh = null;
      }
    },
    screen,
  };
  return activeHomeRefresh.dispose;
}

export function scheduleHomeHydration(root = getDefaultDocument(), bridge = getDefaultBridge()) {
  if (!root || !bridge) {
    return;
  }

  const hydrate = () => {
    if (!findHomeScreen(root)) {
      return;
    }
    void refreshHomeScreen(root, bridge).catch(() => {
      /* Initial render remains usable if the home data bridge is unavailable. */
    });
    startHomeAutoRefresh(root, bridge);
  };

  if (typeof queueMicrotask === "function") {
    queueMicrotask(hydrate);
  } else {
    setTimeout(hydrate, 0);
  }
}

export function bindHomeDomReady(root = getDefaultDocument(), bridge = getDefaultBridge()) {
  if (!root || !bridge) {
    return null;
  }

  const hydrate = () => scheduleHomeHydration(root, bridge);
  if (root.readyState === "loading" && typeof root.addEventListener === "function") {
    root.addEventListener("DOMContentLoaded", hydrate, { once: true });
    return hydrate;
  }

  hydrate();
  return hydrate;
}

bindHomeDomReady();
