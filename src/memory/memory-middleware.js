const DEFAULT_RECALL_LIMIT = 10;
const DEFAULT_CONSOLIDATION_THRESHOLD = 10;

export function createMemoryMiddleware(memoryStore, options = {}) {
  const recallLimit = normalizePositiveInteger(options.recallLimit, DEFAULT_RECALL_LIMIT);
  const consolidationThreshold = normalizePositiveInteger(
    options.consolidationThreshold,
    DEFAULT_CONSOLIDATION_THRESHOLD,
  );

  return {
    async onSessionStart(profile = {}) {
      if (!hasMethod(memoryStore, "recall")) {
        return [];
      }

      try {
        const memories = await memoryStore.recall(buildRecallQuery(profile), recallLimit);
        return Array.isArray(memories) ? memories : [];
      } catch {
        return [];
      }
    },

    async onExchange(conversationId, role, content) {
      if (!hasMethod(memoryStore, "remember")) {
        return null;
      }

      const normalizedContent = normalizeContent(content);
      if (!normalizedContent) {
        return null;
      }

      try {
        return await memoryStore.remember(normalizedContent, {
          conversationId: normalizeConversationId(conversationId),
          role: normalizeRole(role),
        });
      } catch {
        return null;
      }
    },

    async onSessionEnd(conversationId) {
      if (!hasMethod(memoryStore, "getEpisodic") || !hasMethod(memoryStore, "consolidate")) {
        return null;
      }

      try {
        const episodes = await memoryStore.getEpisodic(normalizeConversationId(conversationId));
        if (!Array.isArray(episodes) || episodes.length <= consolidationThreshold) {
          return null;
        }
        return await memoryStore.consolidate();
      } catch {
        return null;
      }
    },
  };
}

function buildRecallQuery(profile) {
  return [profile?.name, profile?.about]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim())
    .join(" ");
}

function normalizeContent(content) {
  return typeof content === "string" ? content.trim() : "";
}

function normalizeConversationId(conversationId) {
  return typeof conversationId === "string" && conversationId.trim()
    ? conversationId.trim()
    : "default";
}

function normalizeRole(role) {
  return typeof role === "string" && role.trim() ? role.trim() : "user";
}

function normalizePositiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function hasMethod(target, methodName) {
  return Boolean(target) && typeof target[methodName] === "function";
}
