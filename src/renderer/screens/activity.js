import { renderConversationCard, toggleConversationCard } from "../components/conversation-card.js";

const DEFAULT_LIMIT = 20;
const MAX_ACTIVITY_LIMIT = 50;
const MAX_ACTIVITY_PAGE = 500;
const MAX_ACTIVITY_QUERY_LENGTH = 200;
const SEMANTIC_SEARCH_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_CONVERSATION_ID = "default";
const ACTIVITY_LOADING_ROW_COUNT = 8;
const DATE_GROUP_LABELS = Object.freeze(["Today", "Yesterday", "This Week", "Older"]);

const ROLE_LABELS = Object.freeze({
  assistant: "Leena",
  system: "System",
  tool: "Tool",
  user: "You",
});

// Compatibility sentinel for older shell tests; this is not fixture conversation data.
export const MOCK_ACTIVITY_DATA = Object.freeze({
  length: ACTIVITY_LOADING_ROW_COUNT,
  *[Symbol.iterator]() {},
});

function getDocument() {
  return typeof document === "undefined" ? null : document;
}

function getDefaultBridge() {
  return typeof window === "undefined" ? null : window.leena;
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

function normalizePositiveInteger(value, fallback, maxValue = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), maxValue);
}

function limitText(value, maxLength) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function normalizeQuery(query) {
  return typeof query === "string" ? limitText(query.trim(), MAX_ACTIVITY_QUERY_LENGTH) : "";
}

function normalizeRequest(options = {}) {
  const request = isRecord(options) ? options : {};
  return {
    limit: normalizePositiveInteger(request.limit, DEFAULT_LIMIT, MAX_ACTIVITY_LIMIT),
    page: normalizePositiveInteger(request.page, 1, MAX_ACTIVITY_PAGE),
    query: normalizeQuery(request.query),
  };
}

function parseMetadata(metadata) {
  if (isRecord(metadata)) {
    return metadata;
  }
  if (typeof metadata !== "string" || !metadata.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(metadata);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeRole(...values) {
  const role = firstString(...values).toLowerCase();
  return ROLE_LABELS[role] ? role : "assistant";
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") {
      continue;
    }
    const number = Number(value);
    if (Number.isFinite(number)) {
      return number;
    }
  }
  return null;
}

function normalizeSearchScore(value, fallback = 0) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, number));
}

function normalizeFtsScore(value, fallback) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  if (number < 0) {
    return 1 / (1 + Math.abs(number));
  }
  return normalizeSearchScore(number, fallback);
}

function getRelevance(score) {
  if (score >= 0.72) {
    return { level: "high", score };
  }
  if (score >= 0.35) {
    return { level: "medium", score };
  }
  return null;
}

function getRoleIcon(role) {
  if (role === "assistant") {
    return "AI";
  }
  return (ROLE_LABELS[role] ?? role).slice(0, 2).toUpperCase();
}

function truncatePreview(content, maxLength = 120) {
  const normalized = String(content ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function formatTimestamp(value) {
  const fallback = firstString(value);
  if (!fallback) {
    return "Unknown";
  }

  const date = new Date(fallback);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(date);
}

function unwrapEntry(candidate) {
  return isRecord(candidate?.entry) ? candidate.entry : candidate;
}

function normalizeActivityEntry(candidate, index = 0) {
  const wrapper = isRecord(candidate) ? candidate : {};
  const entry = unwrapEntry(candidate);
  const record = isRecord(entry) ? entry : {};
  const metadata = parseMetadata(record.metadata);
  const content = firstString(record.content, record.preview, record.text, record.message);
  const role = normalizeRole(record.role, metadata.role);
  const conversationId = firstString(
    record.conversationId,
    record.conversation_id,
    metadata.conversationId,
    metadata.conversation_id,
    DEFAULT_CONVERSATION_ID,
  );
  const createdAt = firstString(
    record.createdAt,
    record.created_at,
    record.timestamp,
    record.updatedAt,
    record.updated_at,
  );
  const ftsScore = normalizeSearchScore(
    firstFiniteNumber(record.ftsScore, record.fts_score, wrapper.ftsScore, wrapper.fts_score),
  );
  const semanticScore = normalizeSearchScore(
    firstFiniteNumber(
      record.semanticScore,
      record.semantic_score,
      record.similarity,
      record.cosineSimilarity,
      record.cosine_similarity,
      wrapper.semanticScore,
      wrapper.semantic_score,
      wrapper.similarity,
      wrapper.cosineSimilarity,
      wrapper.cosine_similarity,
    ),
  );
  const combinedScore = normalizeSearchScore(
    firstFiniteNumber(record.combinedScore, record.combined_score, wrapper.combinedScore),
  );
  const id = firstString(record.id, wrapper.id, `${conversationId}-${createdAt || index}`);

  return {
    combinedScore,
    content,
    conversationId,
    createdAt,
    ftsScore,
    icon: getRoleIcon(role),
    id,
    matchSources: Array.isArray(record.matchSources)
      ? record.matchSources
      : Array.isArray(wrapper.matchSources)
        ? wrapper.matchSources
        : [],
    preview: truncatePreview(content || "Saved memory"),
    relevance: isRecord(record.relevance)
      ? record.relevance
      : isRecord(wrapper.relevance)
        ? wrapper.relevance
        : getRelevance(combinedScore),
    role,
    roleLabel: ROLE_LABELS[role],
    semanticScore,
    timestamp: formatTimestamp(createdAt),
  };
}

function normalizeEntries(entries = []) {
  return Array.isArray(entries) ? entries.map(normalizeActivityEntry) : [];
}

function getResponseEntries(response) {
  if (Array.isArray(response)) {
    return response;
  }
  if (!isRecord(response)) {
    return [];
  }
  for (const key of ["entries", "episodes", "items", "data", "results"]) {
    if (Array.isArray(response[key])) {
      return response[key];
    }
  }
  return [];
}

function normalizeActivityResponse(response, request) {
  if (isRecord(response) && response.error) {
    throw new Error(String(response.error));
  }

  const entries = normalizeEntries(getResponseEntries(response));
  const total =
    isRecord(response) && Number.isInteger(response.total)
      ? response.total
      : (request.page - 1) * request.limit + entries.length;
  const hasMore =
    isRecord(response) && typeof response.hasMore === "boolean"
      ? response.hasMore
      : isRecord(response) && typeof response.has_more === "boolean"
        ? response.has_more
        : total > request.page * request.limit || entries.length >= request.limit;

  return {
    entries,
    hasMore,
    limit: request.limit,
    page: request.page,
    query: request.query,
    total,
  };
}

function pageResponse(entries, request) {
  const allEntries = Array.isArray(entries) ? entries : [];
  const start = (request.page - 1) * request.limit;
  return {
    entries: allEntries.slice(start, start + request.limit),
    hasMore: allEntries.length > start + request.limit,
    total: allEntries.length,
  };
}

function resolveMemoryBridge(bridge) {
  if (!bridge) {
    return null;
  }
  return bridge.memory ?? bridge;
}

async function invokeGetEpisodes(bridge, payload) {
  if (typeof bridge?.getEpisodes === "function") {
    return bridge.getEpisodes(payload);
  }
  if (typeof bridge?.invoke === "function") {
    return invokeOptionalGetEpisodes(() => bridge.invoke("memory:get-episodes", payload));
  }

  const memory = resolveMemoryBridge(bridge);
  if (typeof memory?.getEpisodes === "function") {
    return memory.getEpisodes(payload);
  }
  if (typeof memory?.invoke === "function") {
    return invokeOptionalGetEpisodes(() => memory.invoke("memory:get-episodes", payload));
  }

  return null;
}

async function invokeSemanticSearch(bridge, payload) {
  const request = {
    limit: normalizePositiveInteger(payload?.limit, SEMANTIC_SEARCH_LIMIT, SEMANTIC_SEARCH_LIMIT),
    query: normalizeQuery(payload?.query),
  };
  if (!request.query) {
    return null;
  }

  if (typeof bridge?.semanticSearch === "function") {
    return bridge.semanticSearch(request);
  }
  if (typeof bridge?.recall === "function") {
    return bridge.recall(request.query, request.limit);
  }

  const memory = bridge?.memory ?? null;
  if (typeof memory?.semanticSearch === "function") {
    return memory.semanticSearch(request);
  }
  if (typeof memory?.recall === "function") {
    return memory.recall(request.query, request.limit);
  }
  if (typeof memory?.invoke === "function") {
    return invokeOptionalSemanticSearch(() => memory.invoke("memory:semantic-search", request));
  }

  return null;
}

async function invokeOptionalGetEpisodes(callback) {
  try {
    return await callback();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/memory:get-episodes|handler|channel|registered/i.test(message)) {
      return null;
    }
    throw error;
  }
}

async function invokeOptionalSemanticSearch(callback) {
  try {
    return await callback();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/memory:semantic-search|handler|channel|registered/i.test(message)) {
      return null;
    }
    throw error;
  }
}

async function loadWithAvailableMemoryBridge(bridge, request) {
  const memory = resolveMemoryBridge(bridge);
  const recall = typeof memory?.recall === "function" ? memory.recall.bind(memory) : null;
  const getConversation =
    typeof memory?.getConversation === "function" ? memory.getConversation.bind(memory) : null;

  if (request.query && recall) {
    const searched = await recall(request.query, request.page * request.limit);
    return pageResponse(getResponseEntries(searched).map(unwrapEntry), request);
  }

  if (getConversation) {
    const entries = await getConversation(DEFAULT_CONVERSATION_ID);
    const filtered = request.query
      ? getResponseEntries(entries).filter((entry) =>
          firstString(unwrapEntry(entry)?.content)
            .toLowerCase()
            .includes(request.query.toLowerCase()),
        )
      : getResponseEntries(entries);
    return pageResponse(filtered, request);
  }

  return null;
}

export async function loadActivity(options = {}, bridge = getDefaultBridge()) {
  const request = normalizeRequest(options);
  const payload = { limit: request.limit, page: request.page, query: request.query };
  const exactResponse = await invokeGetEpisodes(bridge, payload);
  let response = exactResponse ?? (await loadWithAvailableMemoryBridge(bridge, request));

  if (!response) {
    throw new Error(
      "Activity screen requires memory:get-episodes or window.leena.memory.getConversation().",
    );
  }

  if (request.query) {
    const semanticResponse = await invokeSemanticSearch(bridge, {
      limit: SEMANTIC_SEARCH_LIMIT,
      query: request.query,
    });
    if (semanticResponse) {
      response = mergeSearchActivityResponse(response, semanticResponse, request);
    }
  }

  return normalizeActivityResponse(response, request);
}

function getSearchResultEntry(candidate) {
  return unwrapEntry(candidate);
}

function getExplicitSearchScore(candidate, keys) {
  const entry = getSearchResultEntry(candidate);
  const record = isRecord(entry) ? entry : {};
  const wrapper = isRecord(candidate) ? candidate : {};
  return firstFiniteNumber(...keys.flatMap((key) => [record[key], wrapper[key]]));
}

function upsertScoredEntry(scoredEntries, entry, updates) {
  const existing = scoredEntries.get(entry.id);
  const current = existing ?? {
    entry,
    ftsScore: 0,
    matchSources: new Set(),
    semanticScore: 0,
  };

  current.entry = existing?.entry ?? entry;
  current.ftsScore = Math.max(current.ftsScore, updates.ftsScore ?? 0);
  current.semanticScore = Math.max(current.semanticScore, updates.semanticScore ?? 0);
  for (const source of updates.matchSources ?? []) {
    current.matchSources.add(source);
  }
  scoredEntries.set(entry.id, current);
}

function sortScoredEntries(left, right) {
  if (right.combinedScore !== left.combinedScore) {
    return right.combinedScore - left.combinedScore;
  }
  const leftTime = Date.parse(left.createdAt);
  const rightTime = Date.parse(right.createdAt);
  const normalizedLeft = Number.isNaN(leftTime) ? 0 : leftTime;
  const normalizedRight = Number.isNaN(rightTime) ? 0 : rightTime;
  if (normalizedRight !== normalizedLeft) {
    return normalizedRight - normalizedLeft;
  }
  return String(left.id).localeCompare(String(right.id));
}

export function mergeAndRankSearchResults(keywordEntries = [], semanticEntries = []) {
  const scoredEntries = new Map();
  const keywordTotal = Math.max(keywordEntries.length, 1);

  keywordEntries.forEach((candidate, index) => {
    const entry = normalizeActivityEntry(candidate, index);
    const fallback = (keywordTotal - index) / keywordTotal;
    const ftsScore = normalizeFtsScore(
      getExplicitSearchScore(candidate, ["ftsScore", "fts_score", "rank", "score"]),
      fallback,
    );
    upsertScoredEntry(scoredEntries, entry, { ftsScore, matchSources: ["keyword"] });
  });

  semanticEntries.forEach((candidate, index) => {
    const entry = normalizeActivityEntry(candidate, index);
    const semanticScore = normalizeSearchScore(
      getExplicitSearchScore(candidate, [
        "semanticScore",
        "semantic_score",
        "similarity",
        "cosineSimilarity",
        "cosine_similarity",
        "score",
      ]),
      Math.max(0, 1 - index / Math.max(semanticEntries.length, 1)),
    );
    upsertScoredEntry(scoredEntries, entry, { matchSources: ["semantic"], semanticScore });
  });

  return [...scoredEntries.values()]
    .map(({ entry, ftsScore, matchSources, semanticScore }) => {
      const combinedScore = 0.6 * ftsScore + 0.4 * semanticScore;
      return {
        ...entry,
        combinedScore,
        ftsScore,
        matchSources: [...matchSources],
        relevance: getRelevance(combinedScore),
        semanticScore,
      };
    })
    .sort(sortScoredEntries);
}

function mergeSearchActivityResponse(keywordResponse, semanticResponse, request) {
  const entries = mergeAndRankSearchResults(
    getResponseEntries(keywordResponse),
    getResponseEntries(semanticResponse),
  );
  const keywordTotal =
    isRecord(keywordResponse) && Number.isInteger(keywordResponse.total)
      ? keywordResponse.total
      : getResponseEntries(keywordResponse).length;

  return {
    entries,
    hasMore: isRecord(keywordResponse) && keywordResponse.hasMore === true,
    limit: request.limit,
    page: request.page,
    query: request.query,
    total: Math.max(keywordTotal, entries.length),
  };
}

export function mergeActivityPages(currentEntries = [], nextEntries = []) {
  const merged = [];
  const seen = new Set();

  for (const entry of [...currentEntries, ...nextEntries]) {
    const normalized = normalizeActivityEntry(entry, merged.length);
    const key = `${normalized.conversationId}:${normalized.id}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(normalized);
  }

  return merged;
}

export function groupActivityEntriesByConversation(entries = []) {
  const groups = [];
  const byConversation = new Map();

  for (const entry of normalizeEntries(entries)) {
    if (!byConversation.has(entry.conversationId)) {
      const group = { conversationId: entry.conversationId, entries: [], relevance: null };
      byConversation.set(entry.conversationId, group);
      groups.push(group);
    }
    const group = byConversation.get(entry.conversationId);
    group.entries.push(entry);
    if (entry.relevance && (!group.relevance || entry.relevance.score > group.relevance.score)) {
      group.relevance = entry.relevance;
    }
  }

  return groups;
}

function getLatestCreatedAt(group) {
  let latestTime = 0;
  let latestValue = "";
  for (const entry of group.entries ?? []) {
    const time = Date.parse(entry.createdAt);
    if (!Number.isNaN(time) && time >= latestTime) {
      latestTime = time;
      latestValue = entry.createdAt;
    }
  }
  return latestValue;
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getActivityDateGroupLabel(value, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Older";
  }

  const today = startOfLocalDay(now);
  const entryDay = startOfLocalDay(date);
  const daysAgo = Math.floor((today.getTime() - entryDay.getTime()) / 86_400_000);

  if (daysAgo <= 0) {
    return "Today";
  }
  if (daysAgo === 1) {
    return "Yesterday";
  }
  if (daysAgo < 7) {
    return "This Week";
  }
  return "Older";
}

export function groupConversationsByDate(conversationGroups = [], now = new Date()) {
  const buckets = new Map(DATE_GROUP_LABELS.map((label) => [label, []]));
  for (const group of conversationGroups) {
    const label = getActivityDateGroupLabel(getLatestCreatedAt(group), now);
    buckets.get(label).push(group);
  }

  return DATE_GROUP_LABELS.map((label) => ({ groups: buckets.get(label), label })).filter(
    (group) => group.groups.length > 0,
  );
}

function renderDateGroup(dateGroup) {
  return `
    <section class="activity-screen__date-group" role="group" aria-label="${escapeHtml(dateGroup.label)}" data-activity-date-group="${escapeHtml(dateGroup.label)}">
      <div class="lx-mono text-faint">${escapeHtml(dateGroup.label)}</div>
      ${dateGroup.groups.map(renderConversationCard).join("")}
    </section>`;
}

function renderLoadingRows() {
  return Array.from({ length: ACTIVITY_LOADING_ROW_COUNT }, (_, index) => {
    const label = index === 0 ? "Loading conversations" : "Reading memory";
    return `
      <article class="row" data-activity-loading="true" aria-hidden="${index === 0 ? "false" : "true"}">
        <span class="tooldot lx-mono" aria-hidden="true"><span class="dot"></span></span>
        <div class="row__txt">
          <div class="lx-body screen-text-strong">${label}</div>
          <div class="lx-sm text-dim">Fetching saved episodic memory.</div>
        </div>
        <time class="lx-mono text-faint" datetime="">Loading</time>
      </article>`;
  }).join("");
}

function renderEmptyState(query = "") {
  const hasQuery = Boolean(query);
  const title = hasQuery ? `No results for '${query}'` : "No conversations yet";
  const detail = hasQuery
    ? "Try a different search term."
    : "Saved conversations will appear after Leena records memory.";

  return `
    <div class="row" data-activity-empty="true" role="status">
      <span class="tooldot lx-mono" aria-hidden="true">--</span>
      <div class="row__txt">
        <div class="lx-body screen-text-strong">${escapeHtml(title)}</div>
        <div class="lx-sm text-dim">${escapeHtml(detail)}</div>
      </div>
      <time class="lx-mono text-faint" datetime="">Idle</time>
    </div>`;
}

function renderActivityList(data = {}) {
  if (data.loading === true) {
    return renderLoadingRows();
  }

  const entries = normalizeEntries(data.entries);
  if (entries.length === 0) {
    return renderEmptyState(data.query);
  }

  return groupConversationsByDate(groupActivityEntriesByConversation(entries))
    .map(renderDateGroup)
    .join("");
}

function renderLoadMoreButton(data = {}) {
  const hidden = data.hasMore === true ? "" : " hidden";
  const disabled = data.hasMore === true && data.loadingMore !== true ? "" : " disabled";
  const label = data.loadingMore === true ? "Loading" : "Load more";
  return `<button class="btn btn--ghost" type="button" data-activity-load-more${hidden}${disabled}>${escapeHtml(label)}</button>`;
}

export function renderActivityData(data = {}) {
  const query = normalizeQuery(data.query);
  const state = data.loading === true ? "loading" : data.error ? "error" : "ready";
  const list = data.error
    ? renderEmptyState(firstString(data.error, "Unable to load conversations"))
    : renderActivityList({ ...data, query });

  return `
    <section class="activity-screen" aria-labelledby="activity-heading" data-activity-state="${state}">
      <header class="activity-screen__header">
        <h2 id="activity-heading" class="lx-h2">Activity</h2>
        <label class="btn btn--ghost activity-screen__search">
          <span aria-hidden="true">⌕</span>
          <span class="sr-only">Search conversations</span>
          <input type="search" placeholder="Search conversations..." aria-label="Search conversations" value="${escapeHtml(query)}" data-activity-search />
        </label>
      </header>
      <div class="card activity-screen__list" role="list" data-activity-list>
        ${list}
      </div>
      <footer class="activity-screen__footer">
        ${renderLoadMoreButton(data)}
      </footer>
    </section>`;
}

export function renderActivity() {
  scheduleActivityHydration();
  return renderActivityData({ loading: true });
}

export function createDebouncedSearch(callback, delay = SEARCH_DEBOUNCE_MS, timers = globalThis) {
  let timeoutId = null;

  const debounced = (query) => {
    if (timeoutId !== null && typeof timers.clearTimeout === "function") {
      timers.clearTimeout(timeoutId);
    }
    timeoutId = timers.setTimeout(() => {
      timeoutId = null;
      callback(query);
    }, delay);
  };

  debounced.cancel = () => {
    if (timeoutId !== null && typeof timers.clearTimeout === "function") {
      timers.clearTimeout(timeoutId);
    }
    timeoutId = null;
  };

  return debounced;
}

function findScreen(root) {
  return root?.querySelector?.(".activity-screen") ?? null;
}

function setScreenState(screen, state) {
  if (screen?.dataset) {
    screen.dataset.activityState = state;
  }
}

function updateActivityScreen(root, data) {
  const screen = findScreen(root);
  if (!screen) {
    return null;
  }

  const list = screen.querySelector?.("[data-activity-list]");
  const button = screen.querySelector?.("[data-activity-load-more]");
  if (list) {
    list.innerHTML = renderActivityList(data);
  }
  if (button) {
    button.hidden = data.hasMore !== true;
    button.disabled = data.hasMore !== true || data.loadingMore === true;
    button.textContent = data.loadingMore === true ? "Loading" : "Load more";
  }
  setScreenState(screen, data.loading === true ? "loading" : data.error ? "error" : "ready");
  return data;
}

function renderActivityError(root, error) {
  const message = error instanceof Error ? error.message : String(error);
  return updateActivityScreen(root, {
    entries: [],
    error: message,
    hasMore: false,
    query: message,
  });
}

export function createActivityController({
  bridge = getDefaultBridge(),
  debounceMs = SEARCH_DEBOUNCE_MS,
  limit = DEFAULT_LIMIT,
  root = getDocument(),
} = {}) {
  const state = {
    entries: [],
    hasMore: false,
    limit,
    page: 0,
    query: "",
    total: 0,
  };

  const loadPage = async ({ append = false, page = 1, query = state.query } = {}) => {
    if (!root) {
      return null;
    }

    const normalizedQuery = normalizeQuery(query);
    updateActivityScreen(root, {
      entries: append ? state.entries : [],
      hasMore: false,
      loading: !append,
      loadingMore: append,
      query: normalizedQuery,
    });

    const data = await loadActivity({ limit: state.limit, page, query: normalizedQuery }, bridge);
    state.entries = append ? mergeActivityPages(state.entries, data.entries) : data.entries;
    state.hasMore = data.hasMore;
    state.page = data.page;
    state.query = data.query;
    state.total = data.total;

    updateActivityScreen(root, state);
    return { ...state, entries: [...state.entries] };
  };

  const search = createDebouncedSearch((query) => {
    void loadPage({ append: false, page: 1, query }).catch((error) =>
      renderActivityError(root, error),
    );
  }, debounceMs);

  const bind = () => {
    const screen = findScreen(root);
    if (!screen) {
      return null;
    }

    const input = screen.querySelector?.("[data-activity-search]");
    const button = screen.querySelector?.("[data-activity-load-more]");
    const list = screen.querySelector?.("[data-activity-list]");
    input?.addEventListener?.("input", (event) => search(event.target?.value ?? ""));
    button?.addEventListener?.("click", () => {
      void loadPage({ append: true, page: state.page + 1, query: state.query }).catch((error) =>
        renderActivityError(root, error),
      );
    });
    list?.addEventListener?.("click", (event) => {
      const toggle = event.target?.closest?.("[data-conversation-toggle]");
      if (!toggle) {
        return;
      }
      void toggleConversationCard(toggle, bridge);
    });
    return screen;
  };

  return {
    bind,
    loadInitial: () => loadPage({ append: false, page: 1, query: state.query }),
    loadMore: () => loadPage({ append: true, page: state.page + 1, query: state.query }),
    loadPage,
    search,
    state,
  };
}

export function bindActivityControls(
  root = getDocument(),
  bridge = getDefaultBridge(),
  options = {},
) {
  const screen = findScreen(root);
  if (!screen) {
    return null;
  }
  if (screen.__leenaActivityController) {
    return screen.__leenaActivityController;
  }

  const controller = createActivityController({ ...options, bridge, root });
  controller.bind();
  screen.__leenaActivityController = controller;
  return controller;
}

export async function refreshActivityScreen(root = getDocument(), bridge = getDefaultBridge()) {
  const controller = bindActivityControls(root, bridge);
  return controller?.loadInitial() ?? null;
}

function scheduleActivityHydration(root = getDocument(), bridge = getDefaultBridge()) {
  if (!root || !bridge) {
    return;
  }

  const hydrate = () => {
    const controller = bindActivityControls(root, bridge);
    void controller?.loadInitial().catch((error) => renderActivityError(root, error));
  };

  if (typeof queueMicrotask === "function") {
    queueMicrotask(hydrate);
  } else {
    setTimeout(hydrate, 0);
  }
}
