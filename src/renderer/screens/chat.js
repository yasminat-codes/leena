const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 50;
const MAX_HISTORY_PAGE = 500;
const MAX_HISTORY_QUERY_LENGTH = 200;
const CHAT_HISTORY_MAX_MESSAGES = 20;
const CHAT_MESSAGE_MAX_CHARS = 8000;
const DEFAULT_CONVERSATION_ID = "default";

const ROLE_LABELS = Object.freeze({
  assistant: "Leena",
  system: "System",
  tool: "Tool",
  user: "You",
});

function getDocument() {
  return typeof document === "undefined" ? null : document;
}

function getDefaultBridge() {
  return typeof window === "undefined" ? null : window.leena;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

function limitText(value, maxLength) {
  const text = String(value ?? "");
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function normalizePositiveInteger(value, fallback, maxValue) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), maxValue);
}

function normalizeQuery(query) {
  return typeof query === "string" ? limitText(query.trim(), MAX_HISTORY_QUERY_LENGTH) : "";
}

function normalizeHistoryRequest(options = {}) {
  const record = isRecord(options) ? options : {};
  return {
    limit: normalizePositiveInteger(record.limit, DEFAULT_HISTORY_LIMIT, MAX_HISTORY_LIMIT),
    page: normalizePositiveInteger(record.page, 1, MAX_HISTORY_PAGE),
    query: normalizeQuery(record.query),
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

function truncatePreview(content, maxLength = 96) {
  const normalized = String(content ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function unwrapEntry(candidate) {
  return isRecord(candidate?.entry) ? candidate.entry : candidate;
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

function normalizeTranscriptEntry(candidate, index = 0) {
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
  const id = firstString(record.id, record.messageId, `${conversationId}-${createdAt || index}`);

  return {
    content,
    conversationId,
    createdAt,
    id,
    preview: truncatePreview(content || "Saved memory"),
    role,
    roleLabel: ROLE_LABELS[role],
    status: firstString(record.status),
    timestamp: formatTimestamp(createdAt),
  };
}

function compareCreatedAtAscending(left, right) {
  const leftTime = Date.parse(left.createdAt);
  const rightTime = Date.parse(right.createdAt);
  const normalizedLeft = Number.isNaN(leftTime) ? 0 : leftTime;
  const normalizedRight = Number.isNaN(rightTime) ? 0 : rightTime;
  if (normalizedLeft !== normalizedRight) {
    return normalizedLeft - normalizedRight;
  }
  return String(left.id).localeCompare(String(right.id));
}

function compareCreatedAtDescending(left, right) {
  return compareCreatedAtAscending(right, left);
}

function normalizeTranscriptEntries(entries = []) {
  return Array.isArray(entries)
    ? entries.map(normalizeTranscriptEntry).sort(compareCreatedAtAscending)
    : [];
}

function groupEntriesByConversation(entries = []) {
  const groupsById = new Map();
  const normalized = normalizeTranscriptEntries(entries).sort(compareCreatedAtDescending);

  for (const entry of normalized) {
    if (!groupsById.has(entry.conversationId)) {
      groupsById.set(entry.conversationId, {
        conversationId: entry.conversationId,
        entries: [],
        latest: entry,
      });
    }
    groupsById.get(entry.conversationId).entries.push(entry);
  }

  return [...groupsById.values()].map((group) => {
    const entries = group.entries.sort(compareCreatedAtAscending);
    return {
      ...group,
      count: entries.length,
      entries,
      latest: [...entries].sort(compareCreatedAtDescending)[0],
    };
  });
}

function formatConversationLabel(conversationId) {
  if (!conversationId || conversationId === DEFAULT_CONVERSATION_ID) {
    return "Conversation";
  }
  return `Conversation ${conversationId}`;
}

function renderHistoryEmptyRow() {
  return `
    <button class="row chat-screen__history-row" type="button" role="listitem" aria-current="true" data-chat-conversation-active>
      <span class="tooldot lx-mono" aria-hidden="true"><span class="dot"></span></span>
      <span class="row__txt">
        <span class="lx-body screen-text-strong">New chat</span>
        <span class="lx-sm text-dim">No saved messages yet</span>
      </span>
      <span class="lx-mono text-faint">Draft</span>
    </button>`;
}

function renderHistoryLoading() {
  return `
    <div class="row chat-screen__history-row" role="status" data-chat-history-loading="true">
      <span class="tooldot lx-mono" aria-hidden="true"><span class="dot"></span></span>
      <span class="row__txt">
        <span class="lx-body screen-text-strong">Loading conversations</span>
        <span class="lx-sm text-dim">Fetching saved chat history.</span>
      </span>
      <span class="lx-mono text-faint">Loading</span>
    </div>`;
}

function renderHistoryError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return `
    <div class="row chat-screen__history-row" role="status" data-chat-history-error="true">
      <span class="tooldot lx-mono" aria-hidden="true">--</span>
      <span class="row__txt">
        <span class="lx-body screen-text-strong">Unable to load conversations</span>
        <span class="lx-sm text-dim">${escapeHtml(message)}</span>
      </span>
      <span class="lx-mono text-faint">Error</span>
    </div>`;
}

function renderHistoryRow(group, activeConversationId) {
  const isActive = group.conversationId === activeConversationId;
  const activeAttr = isActive ? ' aria-current="true" data-chat-conversation-active' : "";
  const label = formatConversationLabel(group.conversationId);
  const countLabel = `${group.count} ${group.count === 1 ? "turn" : "turns"}`;

  return `
    <button class="row chat-screen__history-row" type="button" role="listitem" data-chat-conversation-id="${escapeHtml(group.conversationId)}"${activeAttr}>
      <span class="tooldot lx-mono" aria-hidden="true">${escapeHtml(group.latest.roleLabel.slice(0, 2).toUpperCase())}</span>
      <span class="row__txt">
        <span class="lx-body screen-text-strong">${escapeHtml(label)}</span>
        <span class="lx-sm text-dim">${escapeHtml(group.latest.preview)}</span>
      </span>
      <span class="lx-mono text-faint">${escapeHtml(countLabel)}</span>
      <time class="lx-mono text-faint" datetime="${escapeHtml(group.latest.createdAt)}">${escapeHtml(group.latest.timestamp)}</time>
    </button>`;
}

export function renderChatHistoryList(data = {}, activeConversationId = "") {
  if (data.loading === true) {
    return renderHistoryLoading();
  }
  if (data.error) {
    return renderHistoryError(data.error);
  }

  const groups = groupEntriesByConversation(getResponseEntries(data));
  if (groups.length === 0) {
    return renderHistoryEmptyRow();
  }

  return groups.map((group) => renderHistoryRow(group, activeConversationId)).join("");
}

function renderTranscriptEmpty() {
  return `
    <article class="chat-bubble chat-bubble--assistant chat-screen__empty" data-role="assistant" data-chat-empty="true">
      <div class="chat-bubble__body">
        <p class="chat-bubble__paragraph">No messages in this conversation.</p>
        <p class="chat-bubble__paragraph">Send a focused request or choose an existing conversation from the rail.</p>
      </div>
      <span class="chat-bubble__status" hidden></span>
    </article>`;
}

function renderTranscriptLoading() {
  return `
    <article class="chat-bubble chat-bubble--assistant" data-chat-transcript-loading="true">
      <div class="chat-bubble__body">
        <p class="chat-bubble__paragraph">Loading transcript...</p>
      </div>
      <span class="chat-bubble__status">Loading</span>
    </article>`;
}

function renderTranscriptError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return `
    <article class="chat-bubble chat-bubble--error" data-role="assistant" data-chat-transcript-error="true">
      <div class="chat-bubble__body">
        <p class="chat-bubble__paragraph">${escapeHtml(message)}</p>
      </div>
      <span class="chat-bubble__status">Error</span>
    </article>`;
}

function renderMessageParagraphs(content) {
  const paragraphs = String(content ?? "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const safeParagraphs = paragraphs.length > 0 ? paragraphs : [""];

  return safeParagraphs
    .map((paragraph) => `<p class="chat-bubble__paragraph">${escapeHtml(paragraph)}</p>`)
    .join("");
}

function renderChatMessage(entry) {
  const roleClass = ["assistant", "system", "tool", "user"].includes(entry.role)
    ? entry.role
    : "assistant";
  const status = firstString(entry.status);

  return `
    <article class="chat-bubble chat-bubble--${escapeHtml(roleClass)}" data-role="${escapeHtml(entry.role)}" data-chat-message-id="${escapeHtml(entry.id)}">
      <div class="chat-bubble__body">
        ${renderMessageParagraphs(entry.content)}
      </div>
      <span class="chat-bubble__status"${status ? "" : " hidden"}>${escapeHtml(status)}</span>
    </article>`;
}

export function renderChatTranscript(entries = []) {
  const transcript = normalizeTranscriptEntries(entries);
  if (transcript.length === 0) {
    return renderTranscriptEmpty();
  }
  return transcript.map(renderChatMessage).join("");
}

function normalizeHistoryResponse(response, request) {
  if (isRecord(response) && response.error) {
    throw new Error(String(response.error));
  }

  const entries = normalizeTranscriptEntries(getResponseEntries(response));
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

function resolveMemoryBridge(bridge) {
  if (!bridge) {
    return null;
  }
  return bridge.memory ?? bridge;
}

async function invokeGetEpisodes(bridge, payload) {
  const memory = resolveMemoryBridge(bridge);
  if (typeof memory?.getEpisodes === "function") {
    return memory.getEpisodes(payload);
  }
  if (typeof bridge?.invoke === "function") {
    return bridge.invoke("memory:get-episodes", payload);
  }
  if (typeof memory?.invoke === "function") {
    return memory.invoke("memory:get-episodes", payload);
  }
  return null;
}

async function invokeGetConversation(bridge, conversationId) {
  const memory = resolveMemoryBridge(bridge);
  if (typeof memory?.getConversation === "function") {
    return memory.getConversation(conversationId);
  }
  if (typeof bridge?.invoke === "function") {
    return bridge.invoke("memory:get-conversation", { conversationId });
  }
  if (typeof memory?.invoke === "function") {
    return memory.invoke("memory:get-conversation", { conversationId });
  }
  throw new Error("Chat screen requires memory:get-conversation.");
}

async function invokeChatSend(bridge, payload) {
  if (typeof bridge?.chat?.send === "function") {
    return bridge.chat.send(payload);
  }
  if (typeof bridge?.sendChat === "function") {
    return bridge.sendChat(payload);
  }
  if (typeof bridge?.invoke === "function") {
    return bridge.invoke("chat:send", payload);
  }
  throw new Error("Text chat bridge is not available.");
}

export async function loadChatHistory(options = {}, bridge = getDefaultBridge()) {
  const request = normalizeHistoryRequest(options);
  const response = await invokeGetEpisodes(bridge, request);
  return normalizeHistoryResponse(response ?? { entries: [] }, request);
}

export async function loadChatConversation(conversationId, bridge = getDefaultBridge()) {
  const normalizedConversationId = firstString(conversationId);
  if (!normalizedConversationId) {
    throw new Error("Chat conversationId must be a non-empty string.");
  }
  const response = await invokeGetConversation(bridge, normalizedConversationId);
  if (isRecord(response) && response.error) {
    throw new Error(String(response.error));
  }
  return normalizeTranscriptEntries(getResponseEntries(response));
}

function normalizeProviderId(provider) {
  return typeof provider === "string"
    ? provider
    : firstString(provider?.id, provider?.name, provider?.provider);
}

function normalizeProviderLabel(provider) {
  if (typeof provider === "string") {
    return provider;
  }
  return firstString(provider?.displayName, provider?.name, provider?.id, "Provider");
}

function providerSupportsChat(provider) {
  return (
    typeof provider === "string" ||
    provider?.capabilities?.chat === true ||
    provider?.capabilities === undefined
  );
}

function normalizeModelId(model) {
  return typeof model === "string" ? model : firstString(model?.id, model?.model, model?.name);
}

function normalizeModelLabel(model) {
  if (typeof model === "string") {
    return model;
  }
  return firstString(model?.displayName, model?.name, model?.model, model?.id, "Model");
}

function renderOptions(options, fallbackLabel) {
  return [
    `<option value="">${escapeHtml(fallbackLabel)}</option>`,
    ...options.map(
      (option) =>
        `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`,
    ),
  ].join("");
}

async function listProviders(bridge) {
  try {
    if (typeof bridge?.providers?.list === "function") {
      return bridge.providers.list();
    }
    if (typeof bridge?.invoke === "function") {
      return bridge.invoke("providers:list");
    }
  } catch {
    return [];
  }
  return [];
}

async function listModels(bridge, providerId) {
  if (!providerId) {
    return [];
  }
  try {
    if (typeof bridge?.providers?.getModels === "function") {
      return bridge.providers.getModels(providerId, "chat");
    }
    if (typeof bridge?.invoke === "function") {
      return bridge.invoke("providers:get-models", providerId, "chat");
    }
  } catch {
    return [];
  }
  return [];
}

function subscribeToChatChunks(source, callback) {
  const handler = (payload) => callback(payload?.detail ?? payload);

  if (!source) {
    return () => {};
  }

  if (typeof source.onChatChunk === "function") {
    const token = source.onChatChunk(handler);
    return () => source.offChatChunk?.(token);
  }

  if (typeof source.addEventListener === "function") {
    const listener = (event) => handler(event.detail ?? event);
    source.addEventListener("chat:chunk", listener);
    return () => source.removeEventListener?.("chat:chunk", listener);
  }

  if (typeof source.on === "function") {
    const token = source.on("chat:chunk", handler);
    return () => source.off?.("chat:chunk", token);
  }

  return () => {};
}

function createChatId(kind) {
  return `chat-${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildPayloadHistory(messages = []) {
  return normalizeTranscriptEntries(messages)
    .filter((message) => ["assistant", "user"].includes(message.role) && message.content)
    .slice(-CHAT_HISTORY_MAX_MESSAGES)
    .map((message) => ({
      content: limitText(message.content, CHAT_MESSAGE_MAX_CHARS),
      role: message.role,
    }));
}

function extractChatErrorMessage(error) {
  const serialized = error?.error ?? error;
  return (
    serialized?.message ?? (error instanceof Error ? error.message : "") ?? "Text chat failed."
  );
}

async function rememberChatExchange(result, bridge) {
  if (!result?.ok || !result.memory) {
    return;
  }

  try {
    if (typeof bridge?.memory?.remember === "function") {
      await bridge.memory.remember(result.memory.text, result.memory.metadata);
    } else if (typeof bridge?.invoke === "function") {
      await bridge.invoke("memory:remember", result.memory);
    } else if (typeof bridge?.memory?.invoke === "function") {
      await bridge.memory.invoke("memory:remember", result.memory);
    }
  } catch {
    /* Memory storage must not block chat display. */
  }
}

function setDisabled(nodes, disabled) {
  if (nodes.textarea) {
    nodes.textarea.disabled = disabled;
  }
  if (nodes.sendButton) {
    nodes.sendButton.disabled = disabled;
  }
}

function findChatScreen(root) {
  return (
    root?.querySelector?.("[data-chat-workspace]") ?? root?.querySelector?.(".chat-screen") ?? null
  );
}

function readNodes(screen) {
  return {
    form: screen.querySelector?.("[data-chat-send-path]"),
    historyList: screen.querySelector?.("[data-chat-conversation-list]"),
    modelSelect: screen.querySelector?.("[data-chat-model-select]"),
    newButton: screen.querySelector?.("[data-chat-new-conversation]"),
    providerSelect: screen.querySelector?.("[data-chat-provider-select]"),
    sendButton: screen.querySelector?.("[data-chat-send-button]"),
    textarea: screen.querySelector?.("[data-chat-message]"),
    transcript: screen.querySelector?.("[data-chat-transcript]"),
  };
}

function addListener(cleanups, element, type, listener) {
  element?.addEventListener?.(type, listener);
  if (element?.removeEventListener) {
    cleanups.push(() => element.removeEventListener(type, listener));
  }
}

export function createChatController({
  bridge = getDefaultBridge(),
  eventSource = bridge,
  historyLimit = DEFAULT_HISTORY_LIMIT,
  root = getDocument(),
} = {}) {
  const state = {
    conversationId: createChatId("conversation"),
    detailToken: 0,
    historyEntries: [],
    historyLimit: normalizePositiveInteger(historyLimit, DEFAULT_HISTORY_LIMIT, MAX_HISTORY_LIMIT),
    historyToken: 0,
    messageToken: 0,
    messages: [],
    model: "",
    pendingMessageId: "",
    provider: "",
    providerToken: 0,
  };
  const cleanups = [];
  let nodes = {};
  let unlistenChunks = null;

  const renderHistory = (data = {}) => {
    if (!nodes.historyList) {
      return;
    }
    const historyData =
      data.loading === true || data.error || data.entries
        ? data
        : { entries: state.historyEntries };
    nodes.historyList.innerHTML = renderChatHistoryList(historyData, state.conversationId);
  };

  const renderTranscript = () => {
    if (nodes.transcript) {
      nodes.transcript.innerHTML = renderChatTranscript(state.messages);
    }
  };

  const updateMessage = (messageId, updates) => {
    const index = state.messages.findIndex((message) => message.id === messageId);
    if (index === -1) {
      return null;
    }
    state.messages[index] = { ...state.messages[index], ...updates };
    renderTranscript();
    if (nodes.transcript) {
      nodes.transcript.scrollTop = nodes.transcript.scrollHeight ?? 0;
    }
    return state.messages[index];
  };

  const loadHistory = async (options = {}) => {
    const token = ++state.historyToken;
    renderHistory({ loading: true });
    try {
      const data = await loadChatHistory(
        { limit: state.historyLimit, page: 1, ...options },
        bridge,
      );
      if (token !== state.historyToken) {
        return null;
      }
      state.historyEntries = data.entries;
      renderHistory(data);
      return data;
    } catch (error) {
      if (token !== state.historyToken) {
        return null;
      }
      renderHistory({ error });
      return { error };
    }
  };

  const openConversation = async (conversationId) => {
    const normalizedConversationId = firstString(conversationId);
    if (!normalizedConversationId) {
      return null;
    }

    const token = ++state.detailToken;
    state.conversationId = normalizedConversationId;
    state.pendingMessageId = "";
    renderHistory();
    if (nodes.transcript) {
      nodes.transcript.innerHTML = renderTranscriptLoading();
    }

    try {
      const entries = await loadChatConversation(normalizedConversationId, bridge);
      if (token !== state.detailToken || state.conversationId !== normalizedConversationId) {
        return null;
      }
      state.messages = entries;
      renderTranscript();
      return entries;
    } catch (error) {
      if (token !== state.detailToken || state.conversationId !== normalizedConversationId) {
        return null;
      }
      if (nodes.transcript) {
        nodes.transcript.innerHTML = renderTranscriptError(error);
      }
      return { error };
    }
  };

  const startNewConversation = () => {
    state.conversationId = createChatId("conversation");
    state.detailToken += 1;
    state.messages = [];
    state.pendingMessageId = "";
    renderHistory();
    renderTranscript();
  };

  const sendMessage = async (rawMessage) => {
    const message = limitText(firstString(rawMessage), CHAT_MESSAGE_MAX_CHARS);
    if (!message) {
      return null;
    }

    const conversationId = state.conversationId || createChatId("conversation");
    const messageId = createChatId("message");
    const historyMessages = buildPayloadHistory(state.messages);
    const sendToken = ++state.messageToken;
    state.conversationId = conversationId;
    state.pendingMessageId = messageId;
    state.messages = [
      ...state.messages,
      {
        content: message,
        conversationId,
        createdAt: new Date().toISOString(),
        id: `${messageId}-user`,
        role: "user",
      },
      {
        content: "",
        conversationId,
        createdAt: new Date().toISOString(),
        id: messageId,
        role: "assistant",
        status: "Streaming",
      },
    ];
    renderHistory();
    renderTranscript();
    setDisabled(nodes, true);

    const payload = {
      conversationId,
      message,
      messageId,
      model: state.model || undefined,
      provider: state.provider || undefined,
    };
    if (historyMessages.length > 0) {
      payload.messages = historyMessages;
    }

    try {
      const result = await invokeChatSend(bridge, payload);
      await rememberChatExchange(result, bridge);

      if (state.conversationId === conversationId && sendToken === state.messageToken) {
        if (result?.ok === false) {
          updateMessage(messageId, {
            content: extractChatErrorMessage(result),
            status: "Error",
          });
        } else if (result?.content) {
          updateMessage(messageId, { content: result.content, status: "" });
        } else {
          updateMessage(messageId, { status: "" });
        }
      }

      void loadHistory();
      return result;
    } catch (error) {
      if (state.conversationId === conversationId && sendToken === state.messageToken) {
        updateMessage(messageId, {
          content: extractChatErrorMessage(error),
          status: "Error",
        });
      }
      return { error };
    } finally {
      setDisabled(nodes, false);
      if (state.pendingMessageId === messageId) {
        state.pendingMessageId = "";
      }
    }
  };

  const handleChunk = (payload) => {
    if (!payload || payload.conversationId !== state.conversationId) {
      return;
    }
    const messageId = firstString(payload.messageId, state.pendingMessageId);
    if (!messageId) {
      return;
    }

    if (payload.type === "delta") {
      const existing = state.messages.find((message) => message.id === messageId);
      updateMessage(messageId, {
        content: firstString(payload.content) || `${existing?.content ?? ""}${payload.delta ?? ""}`,
        status: "Streaming",
      });
    } else if (payload.type === "tool_call") {
      updateMessage(messageId, {
        status: `Running ${firstString(payload.toolCall?.name, "tool")}`,
      });
    } else if (payload.type === "tool_result") {
      updateMessage(messageId, { status: "Tool complete" });
    } else if (payload.type === "done") {
      updateMessage(messageId, {
        content:
          firstString(payload.content) ||
          state.messages.find((item) => item.id === messageId)?.content ||
          "",
        status: "",
      });
    } else if (payload.type === "error") {
      updateMessage(messageId, {
        content: extractChatErrorMessage(payload),
        status: "Error",
      });
    }
  };

  const loadModels = async () => {
    const token = ++state.providerToken;
    const models = await listModels(bridge, state.provider);
    if (token !== state.providerToken || !nodes.modelSelect) {
      return [];
    }
    const options = (Array.isArray(models) ? models : [])
      .map((model) => ({
        label: normalizeModelLabel(model),
        value: normalizeModelId(model),
      }))
      .filter((model) => model.value);
    nodes.modelSelect.innerHTML = renderOptions(options, "Default model");
    state.model = state.provider ? options[0]?.value || "" : "";
    nodes.modelSelect.value = state.model;
    nodes.modelSelect.disabled = false;
    return options;
  };

  const loadProviders = async () => {
    const token = ++state.providerToken;
    const providers = await listProviders(bridge);
    if (token !== state.providerToken || !nodes.providerSelect) {
      return [];
    }
    const options = (Array.isArray(providers) ? providers : [])
      .filter(providerSupportsChat)
      .map((provider) => ({
        label: normalizeProviderLabel(provider),
        value: normalizeProviderId(provider),
      }))
      .filter((provider) => provider.value);
    nodes.providerSelect.innerHTML = renderOptions(options, "Default provider");
    if (!options.some((provider) => provider.value === state.provider)) {
      state.provider = "";
    }
    nodes.providerSelect.value = state.provider;
    nodes.providerSelect.disabled = false;
    await loadModels();
    return options;
  };

  const bind = () => {
    const screen = findChatScreen(root);
    if (!screen) {
      return null;
    }
    if (screen.__leenaChatController) {
      return screen.__leenaChatController;
    }

    nodes = readNodes(screen);
    addListener(cleanups, nodes.form, "submit", (event) => {
      event?.preventDefault?.();
      const message = nodes.textarea?.value ?? "";
      if (nodes.textarea) {
        nodes.textarea.value = "";
      }
      void sendMessage(message);
    });
    addListener(cleanups, nodes.textarea, "keydown", (event) => {
      if (event.key !== "Enter" || (!event.metaKey && !event.ctrlKey)) {
        return;
      }
      event.preventDefault?.();
      const message = nodes.textarea?.value ?? "";
      if (nodes.textarea) {
        nodes.textarea.value = "";
      }
      void sendMessage(message);
    });
    addListener(cleanups, nodes.newButton, "click", startNewConversation);
    addListener(cleanups, nodes.historyList, "click", (event) => {
      const row = event.target?.closest?.("[data-chat-conversation-id]");
      const conversationId = firstString(row?.dataset?.chatConversationId);
      if (conversationId) {
        void openConversation(conversationId);
      }
    });
    addListener(cleanups, nodes.providerSelect, "change", () => {
      state.provider = nodes.providerSelect?.value ?? "";
      state.model = "";
      void loadModels();
    });
    addListener(cleanups, nodes.modelSelect, "change", () => {
      state.model = nodes.modelSelect?.value ?? "";
    });

    unlistenChunks = subscribeToChatChunks(eventSource, handleChunk);
    screen.__leenaChatController = controller;
    void loadProviders();
    void loadHistory();
    return controller;
  };

  const destroy = () => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
    unlistenChunks?.();
    unlistenChunks = null;
    const screen = findChatScreen(root);
    if (screen?.__leenaChatController === controller) {
      delete screen.__leenaChatController;
    }
  };

  const controller = {
    bind,
    destroy,
    loadHistory,
    loadModels,
    loadProviders,
    openConversation,
    sendMessage,
    startNewConversation,
    state,
  };

  return controller;
}

export function bindChatControls(root = getDocument(), bridge = getDefaultBridge(), options = {}) {
  const controller = createChatController({ ...options, bridge, eventSource: bridge, root });
  return controller.bind();
}

export async function refreshChatScreen(root = getDocument(), bridge = getDefaultBridge()) {
  const controller = bindChatControls(root, bridge);
  return controller?.loadHistory() ?? null;
}

function scheduleChatHydration(root = getDocument(), bridge = getDefaultBridge()) {
  if (!root || !bridge) {
    return;
  }

  const hydrate = () => {
    bindChatControls(root, bridge);
  };

  if (typeof queueMicrotask === "function") {
    queueMicrotask(hydrate);
  } else {
    setTimeout(hydrate, 0);
  }
}

export function renderChat() {
  scheduleChatHydration();
  return `
    <section class="chat-screen integrations-detail-layout" aria-labelledby="chat-heading" data-chat-workspace>
      <aside class="card settings-card chat-screen__rail" aria-labelledby="chat-history-heading" data-chat-history-rail>
        <div class="activity-screen__header">
          <div class="row__txt">
            <h2 id="chat-history-heading" class="lx-h2">Conversations</h2>
            <p class="lx-sm text-dim">Saved turns and drafts</p>
          </div>
          <button class="btn btn--ghost chat-screen__new" type="button" data-chat-new-conversation>
            New
          </button>
        </div>

        <div class="activity-screen__list chat-screen__history-list" role="list" data-chat-conversation-list>
          ${renderHistoryEmptyRow()}
        </div>
      </aside>

      <section class="card integrations-detail chat-screen__workspace" aria-labelledby="chat-heading">
        <header class="activity-screen__header chat-screen__header">
          <div class="row__txt">
            <h2 id="chat-heading" class="lx-h2">Chat</h2>
            <p class="lx-sm text-dim">Ask, review context, and continue the active thread.</p>
          </div>

          <div class="chat-screen__controls" aria-label="Chat routing">
            <label class="sr-only" for="chat-provider">Chat provider</label>
            <select id="chat-provider" class="settings-select chat-screen__select" data-chat-provider-select>
              <option value="">Default provider</option>
            </select>

            <label class="sr-only" for="chat-model">Chat model</label>
            <select id="chat-model" class="settings-select chat-screen__select" data-chat-model-select>
              <option value="">Default model</option>
            </select>
          </div>
        </header>

        <div class="chat-screen__transcript" role="log" aria-live="polite" data-chat-transcript data-chat-chunk-channel="chat:chunk">
          ${renderTranscriptEmpty()}
        </div>

        <form class="chat-input chat-screen__composer" aria-label="Message composer" data-chat-send-path="window.leena.chat.send">
          <button class="btn btn--ghost chat-input__voice chat-screen__voice" type="button" disabled aria-label="Voice input unavailable" title="Voice input not wired yet" data-chat-voice-affordance>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M10 3.5a2.5 2.5 0 0 0-2.5 2.5v4a2.5 2.5 0 0 0 5 0V6A2.5 2.5 0 0 0 10 3.5Z" stroke="currentColor" stroke-width="1.6" />
              <path d="M5.5 9.5a4.5 4.5 0 0 0 9 0M10 14v2.5M7.5 16.5h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </button>
          <textarea class="chat-input__field settings-input chat-screen__message" rows="2" placeholder="Message Leena" aria-label="Message Leena" data-chat-message></textarea>
          <button class="chat-input__send chat-screen__send" type="submit" aria-label="Send message" data-chat-send-button>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
              <path d="M5 12h13m0 0-5-5m5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </form>
      </section>
    </section>
  `;
}
