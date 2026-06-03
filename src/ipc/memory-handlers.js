import { SQLiteMemoryStore } from "../memory/index.js";
import { getRegistry } from "../providers/index.js";
import { getDatabasePath } from "../realtime/tools/database.js";

export const MEMORY_IPC_CHANNELS = Object.freeze({
  remember: "memory:remember",
  recall: "memory:recall",
  getEpisodes: "memory:get-episodes",
  getConversation: "memory:get-conversation",
  consolidate: "memory:consolidate",
  stats: "memory:stats",
});

const MAX_EPISODES_LIMIT = 50;
const MAX_EPISODES_PAGE = 500;
const MAX_EPISODES_QUERY_LENGTH = 200;

export function registerMemoryHandlers({ ipcMain, ...options } = {}) {
  if (!ipcMain || typeof ipcMain.handle !== "function") {
    throw new TypeError("ipcMain.handle is required to register memory handlers.");
  }

  const handlers = createMemoryIpcHandlers(options);
  ipcMain.handle(MEMORY_IPC_CHANNELS.remember, handlers.remember);
  ipcMain.handle(MEMORY_IPC_CHANNELS.recall, handlers.recall);
  ipcMain.handle(MEMORY_IPC_CHANNELS.getEpisodes, handlers.getEpisodes);
  ipcMain.handle(MEMORY_IPC_CHANNELS.getConversation, handlers.getConversation);
  ipcMain.handle(MEMORY_IPC_CHANNELS.consolidate, handlers.consolidate);
  ipcMain.handle(MEMORY_IPC_CHANNELS.stats, handlers.stats);

  return {
    channels: MEMORY_IPC_CHANNELS,
    handlers,
  };
}

export function createMemoryIpcHandlers(options = {}) {
  const store = options.store ?? options.memoryStore ?? createDefaultStore(options);
  assertMemoryStore(store);

  return {
    remember: wrapMemoryIpcHandler((_event, payload, metadata) =>
      rememberMemory(store, payload, metadata),
    ),
    recall: wrapMemoryIpcHandler((_event, payload, limit) => recallMemory(store, payload, limit)),
    getEpisodes: wrapMemoryIpcHandler((_event, payload) => getEpisodes(store, payload)),
    getConversation: wrapMemoryIpcHandler((_event, payload) => getConversation(store, payload)),
    consolidate: wrapMemoryIpcHandler(() => consolidateMemory(store)),
    stats: wrapMemoryIpcHandler(() => getMemoryStats(store)),
  };
}

export function serializeMemoryIpcError(error) {
  return {
    error: error instanceof Error ? error.message : String(error),
  };
}

function createDefaultStore(options) {
  return new SQLiteMemoryStore({
    dbPath: options.dbPath ?? getDatabasePath(),
    providerRegistry: options.providerRegistry ?? getRegistry(),
  });
}

async function rememberMemory(store, payload, metadata) {
  const { text, metadata: normalizedMetadata } = parseRememberArgs(payload, metadata);
  const id = await store.remember(text, normalizedMetadata);
  return { id };
}

async function recallMemory(store, payload, limit) {
  const { query, limit: normalizedLimit } = parseRecallArgs(payload, limit);
  return store.recall(query, normalizedLimit);
}

function getConversation(store, payload) {
  const conversationId = parseConversationId(payload);
  const getConversationEntries =
    typeof store.getConversation === "function" ? store.getConversation : store.getEpisodic;
  return getConversationEntries.call(store, conversationId);
}

function getEpisodes(store, payload) {
  const options = parseEpisodesArgs(payload);
  if (typeof store.getEpisodes === "function") {
    return store.getEpisodes(options);
  }
  const conversationId =
    isRecord(payload) && typeof payload.conversationId === "string"
      ? payload.conversationId
      : "default";
  const entries = getConversation(store, { conversationId });
  const filteredEntries = options.query
    ? entries.filter((entry) => episodeMatchesQuery(entry, options.query))
    : entries;
  const offset = (options.page - 1) * options.limit;
  const pageEntries = filteredEntries.slice(offset, offset + options.limit);
  return {
    entries: pageEntries,
    hasMore: filteredEntries.length > offset + options.limit,
    limit: options.limit,
    page: options.page,
    total: filteredEntries.length,
  };
}

async function consolidateMemory(store) {
  const result = await store.consolidate();
  return { newFacts: normalizeNewFactsCount(result) };
}

function getMemoryStats(store) {
  const getStats = typeof store.stats === "function" ? store.stats : store.getStats;
  return getStats.call(store);
}

function wrapMemoryIpcHandler(handler) {
  return async (event, ...args) => {
    try {
      return await handler(event, ...args);
    } catch (error) {
      return serializeMemoryIpcError(error);
    }
  };
}

function parseRememberArgs(payload, metadata) {
  if (typeof payload === "string") {
    return {
      text: normalizeNonEmptyString(payload, "Memory text"),
      metadata: normalizeMetadata(metadata),
    };
  }
  if (!isRecord(payload)) {
    throw new TypeError("Memory remember payload must be an object.");
  }
  return {
    text: normalizeNonEmptyString(payload.text, "Memory text"),
    metadata: normalizeMetadata(payload.metadata),
  };
}

function parseRecallArgs(payload, limit) {
  if (typeof payload === "string") {
    return {
      query: normalizeNonEmptyString(payload, "Memory recall query"),
      limit: normalizeLimit(limit),
    };
  }
  if (!isRecord(payload)) {
    throw new TypeError("Memory recall payload must be an object.");
  }
  return {
    query: normalizeNonEmptyString(payload.query, "Memory recall query"),
    limit: normalizeLimit(payload.limit),
  };
}

function parseConversationId(payload) {
  if (typeof payload === "string") {
    return normalizeNonEmptyString(payload, "Memory conversationId");
  }
  if (!isRecord(payload)) {
    throw new TypeError("Memory conversation payload must be an object.");
  }
  return normalizeNonEmptyString(payload.conversationId, "Memory conversationId");
}

function parseEpisodesArgs(payload) {
  const record = isRecord(payload) ? payload : {};
  return {
    limit: normalizeBoundedPositiveInteger(
      record.limit ?? 20,
      "Memory episodes limit",
      MAX_EPISODES_LIMIT,
    ),
    page: normalizeBoundedPositiveInteger(
      record.page ?? 1,
      "Memory episodes page",
      MAX_EPISODES_PAGE,
    ),
    query: limitText(
      typeof record.query === "string" ? record.query.trim() : "",
      MAX_EPISODES_QUERY_LENGTH,
    ),
  };
}

function normalizeMetadata(metadata = {}) {
  if (metadata === undefined) {
    return {};
  }
  if (!isRecord(metadata)) {
    throw new TypeError("Memory metadata must be an object.");
  }
  return { ...metadata };
}

function normalizeLimit(limit = 5) {
  if (limit === undefined) {
    return 5;
  }
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new TypeError("Memory recall limit must be a positive integer.");
  }
  return limit;
}

function normalizePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer.`);
  }
  return value;
}

function normalizeBoundedPositiveInteger(value, label, maxValue) {
  const normalized = normalizePositiveInteger(value, label);
  return Math.min(normalized, maxValue);
}

function limitText(value, maxLength) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function episodeMatchesQuery(entry, query) {
  const haystack = [entry?.content, entry?.role, entry?.conversationId, entry?.conversation_id]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function normalizeNewFactsCount(result) {
  if (Number.isInteger(result)) {
    return result;
  }
  if (!isRecord(result)) {
    return 0;
  }
  if (Number.isInteger(result.newFacts)) {
    return result.newFacts;
  }
  if (Number.isInteger(result.semantic)) {
    return result.semantic;
  }
  return 0;
}

function normalizeNonEmptyString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function assertMemoryStore(store) {
  if (!store || typeof store !== "object") {
    throw new TypeError("Memory store is required.");
  }
  assertStoreMethod(store, "remember");
  assertStoreMethod(store, "recall");
  assertStoreMethod(store, "consolidate");
  if (
    typeof store.getEpisodes !== "function" &&
    typeof store.getConversation !== "function" &&
    typeof store.getEpisodic !== "function"
  ) {
    throw new TypeError(
      "Memory store getEpisodes, getConversation, or getEpisodic method is required.",
    );
  }
  if (typeof store.stats !== "function" && typeof store.getStats !== "function") {
    throw new TypeError("Memory store stats or getStats method is required.");
  }
}

function assertStoreMethod(store, methodName) {
  if (typeof store[methodName] !== "function") {
    throw new TypeError(`Memory store ${methodName} method is required.`);
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
