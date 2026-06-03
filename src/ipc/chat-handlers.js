import { getRegistry } from "../providers/index.js";
import { CHAT } from "../providers/types.js";
import {
  createPermissionDeniedResult,
  getToolPermissionRequest,
} from "../realtime/tool-permissions.js";
import { executeRealtimeTool, getRealtimeToolDefinitions } from "../realtime/tools/index.js";
import { LeenaError, ProviderError, serializeError } from "../utils/errors.js";

export const CHAT_IPC_CHANNELS = Object.freeze({
  send: "chat:send",
  chunk: "chat:chunk",
});

const DEFAULT_MAX_MEMORY_TEXT = 2000;
const CHAT_AUTO_TOOL_LEVELS = new Set(["low", "read"]);
const CHAT_DEFAULT_TOOL_NAMES = new Set([
  "add_task",
  "list_tasks",
  "list_calendar_items",
  "end_call",
]);
const CHAT_HISTORY_MAX_MESSAGES = 20;
const CHAT_MESSAGE_MAX_CHARS = 8000;

export function registerChatHandlers({ ipcMain, ...options } = {}) {
  if (!ipcMain || typeof ipcMain.handle !== "function") {
    throw new TypeError("ipcMain.handle is required to register chat handlers.");
  }

  const handlers = createChatIpcHandlers(options);
  ipcMain.handle(CHAT_IPC_CHANNELS.send, handlers.send);

  return {
    channels: CHAT_IPC_CHANNELS,
    handlers,
  };
}

export function createChatIpcHandlers(options = {}) {
  const deps = normalizeDependencies(options);

  return {
    send: async (event, payload) => {
      try {
        return await sendChatMessage(event, payload, deps);
      } catch (error) {
        const request = normalizePartialRequest(payload);
        const serialized = serializeChatIpcError(error);
        emitChatChunk(deps, event, {
          type: "error",
          conversationId: request.conversationId,
          messageId: request.messageId,
          sequence: 0,
          error: serialized,
        });
        return {
          ok: false,
          conversationId: request.conversationId,
          messageId: request.messageId,
          error: serialized,
        };
      }
    },
  };
}

export function serializeChatIpcError(error) {
  const leenaError =
    error instanceof LeenaError
      ? error
      : new LeenaError(error instanceof Error ? error.message : String(error), {
          code: "CHAT_IPC_ERROR",
          cause: error,
        });
  return serializeError(leenaError, { includeStack: false, redactSecrets: true });
}

export function buildChatToolDefinitions(
  toolDefinitions = getRealtimeToolDefinitions(),
  options = {},
) {
  if (!Array.isArray(toolDefinitions)) {
    return [];
  }

  return toolDefinitions
    .map((definition) => normalizeToolDefinitionForChat(definition, options))
    .filter(Boolean);
}

async function getChatToolDefinitionsForRequest(deps, options = {}) {
  const toolDefinitions = await deps.getToolDefinitions();
  return buildChatToolDefinitions(await toolDefinitions, options);
}

function normalizeDependencies(options) {
  const registry = options.registry ?? getRegistry();

  return {
    registry,
    executeTool:
      typeof options.executeTool === "function" ? options.executeTool : executeRealtimeTool,
    getToolDefinitions:
      typeof options.getToolDefinitions === "function"
        ? options.getToolDefinitions
        : getRealtimeToolDefinitions,
    chunkSender: options.chunkSender,
    now: typeof options.now === "function" ? options.now : Date.now,
    createId:
      typeof options.createId === "function"
        ? options.createId
        : (prefix) =>
            `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    toolOptions: options.toolOptions,
  };
}

async function sendChatMessage(event, payload, deps) {
  const request = normalizeChatRequest(payload, deps);
  const provider = selectProvider(deps.registry, request.provider);
  const model = selectModel(provider, request.model);
  const tools = request.toolsEnabled
    ? await getChatToolDefinitionsForRequest(deps, {
        allowedLevels: CHAT_AUTO_TOOL_LEVELS,
        allowedNames: CHAT_DEFAULT_TOOL_NAMES,
      })
    : [];
  const allowedToolNames = new Set(tools.map(getChatToolName).filter(Boolean));
  const toolResults = [];
  const contextMessages = [...request.messages];
  let content = "";
  let sequence = 0;

  emitChatChunk(deps, event, {
    type: "start",
    conversationId: request.conversationId,
    messageId: request.messageId,
    provider: provider.name,
    model,
    sequence,
  });
  sequence += 1;

  const firstTurn = await runChatProviderTurn({
    allowedToolNames,
    deps,
    event,
    messages: request.messages,
    model,
    provider,
    request,
    sequence,
    tools,
  });
  sequence = firstTurn.sequence;
  content += firstTurn.content;
  toolResults.push(...firstTurn.toolResults);

  if (firstTurn.toolResults.length > 0) {
    contextMessages.push(buildAssistantToolCallMessage(firstTurn));
    contextMessages.push(...firstTurn.toolResults.map(buildToolResultMessage));

    const followUpTurn = await runChatProviderTurn({
      allowedToolNames: new Set(),
      deps,
      event,
      messages: contextMessages,
      model,
      provider,
      request,
      sequence,
      tools: [],
    });
    sequence = followUpTurn.sequence;
    content += followUpTurn.content;
    toolResults.push(...followUpTurn.toolResults);
    contextMessages.push({ role: "assistant", content: followUpTurn.content });
  } else {
    contextMessages.push({ role: "assistant", content });
  }

  const response = {
    ok: true,
    conversationId: request.conversationId,
    messageId: request.messageId,
    provider: provider.name,
    model,
    content,
    messages: contextMessages,
    toolResults,
    memory: buildMemorySuggestion(request, { provider, model, content }),
  };

  emitChatChunk(deps, event, {
    type: "done",
    conversationId: request.conversationId,
    messageId: request.messageId,
    provider: provider.name,
    model,
    sequence,
    content,
    toolResults,
    memory: response.memory,
  });

  return response;
}

async function runChatProviderTurn({
  allowedToolNames,
  deps,
  event,
  messages,
  model,
  provider,
  request,
  sequence,
  tools,
}) {
  const providerResponse = await provider.chat({
    messages: messages.map(copyChatMessage),
    model,
    stream: true,
    tools,
    toolChoice: tools.length > 0 ? "auto" : undefined,
  });
  const toolResults = [];
  let content = "";

  for await (const chunk of iterateProviderResponse(providerResponse)) {
    const normalized = normalizeChatChunk(chunk, { fallbackModel: model });

    if (normalized.delta) {
      content += normalized.delta;
      emitChatChunk(deps, event, {
        type: "delta",
        conversationId: request.conversationId,
        messageId: request.messageId,
        provider: provider.name,
        model: normalized.model ?? model,
        sequence,
        delta: normalized.delta,
        content,
        finishReason: normalized.finishReason,
        usage: normalized.usage,
      });
      sequence += 1;
    }

    for (const toolCall of normalized.toolCalls) {
      const result = await runToolCall(toolCall, {
        allowedToolNames,
        deps,
        event,
        model,
        provider,
        request,
        sequence,
      });
      sequence = result.nextSequence;
      toolResults.push(result.toolResult);
    }
  }

  return {
    content,
    sequence,
    toolResults,
  };
}

function buildAssistantToolCallMessage(turn) {
  return {
    role: "assistant",
    content: turn.content,
    tool_calls: turn.toolResults.map((toolResult) => ({
      id: toolResult.id,
      type: "function",
      function: {
        name: toolResult.name,
        arguments: stringifyToolArgs(toolResult.args),
      },
    })),
  };
}

function buildToolResultMessage(toolResult) {
  return {
    role: "tool",
    name: toolResult.name,
    tool_call_id: toolResult.id,
    content: stringifyToolResult(toolResult.result),
  };
}

function copyChatMessage(message) {
  if (!isRecord(message)) {
    return message;
  }
  return { ...message };
}

async function runToolCall(
  toolCall,
  { allowedToolNames, deps, event, request, provider, model, sequence },
) {
  const executableToolCall = {
    ...toolCall,
    id: toolCall.id || `${toolCall.name}-${sequence}`,
  };
  emitChatChunk(deps, event, {
    type: "tool_call",
    conversationId: request.conversationId,
    messageId: request.messageId,
    provider: provider.name,
    model,
    sequence,
    toolCall: executableToolCall,
  });

  let nextSequence = sequence + 1;
  let result;
  if (!allowedToolNames.has(executableToolCall.name)) {
    result = createPermissionDeniedResult(
      getToolPermissionRequest(executableToolCall.name, executableToolCall.args),
    );
  } else {
    try {
      result = await deps.executeTool(
        executableToolCall.name,
        executableToolCall.args,
        deps.toolOptions,
      );
    } catch (error) {
      result = {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const toolResult = {
    id: executableToolCall.id,
    name: executableToolCall.name,
    args: executableToolCall.args,
    result,
  };

  emitChatChunk(deps, event, {
    type: "tool_result",
    conversationId: request.conversationId,
    messageId: request.messageId,
    provider: provider.name,
    model,
    sequence: nextSequence,
    toolResult,
  });
  nextSequence += 1;

  return {
    nextSequence,
    toolResult,
  };
}

async function* iterateProviderResponse(providerResponse) {
  if (typeof providerResponse === "string") {
    yield { delta: providerResponse, content: providerResponse };
    return;
  }

  if (isAsyncIterable(providerResponse)) {
    yield* providerResponse;
    return;
  }

  if (isIterable(providerResponse)) {
    yield* providerResponse;
    return;
  }

  if (isRecord(providerResponse)) {
    yield providerResponse;
  }
}

function normalizeChatChunk(chunk, { fallbackModel }) {
  if (typeof chunk === "string") {
    return {
      delta: chunk,
      model: fallbackModel,
      toolCalls: [],
    };
  }

  if (!isRecord(chunk)) {
    return {
      delta: "",
      model: fallbackModel,
      toolCalls: [],
    };
  }

  const delta = normalizeContentString(
    chunk.delta ??
      chunk.content ??
      chunk.text ??
      chunk.message?.content ??
      chunk.choices?.[0]?.delta?.content ??
      chunk.raw?.choices?.[0]?.delta?.content,
  );

  return {
    delta,
    model: normalizeString(chunk.model) || fallbackModel,
    finishReason: normalizeString(chunk.finishReason ?? chunk.finish_reason) || undefined,
    usage: isRecord(chunk.usage) ? { ...chunk.usage } : undefined,
    toolCalls: extractToolCalls(chunk),
  };
}

function extractToolCalls(chunk) {
  const candidates = [
    chunk.toolCalls,
    chunk.tool_calls,
    chunk.toolCall,
    chunk.tool_call,
    chunk.delta?.tool_calls,
    chunk.message?.tool_calls,
    chunk.raw?.choices?.[0]?.delta?.tool_calls,
    chunk.raw?.choices?.[0]?.message?.tool_calls,
  ];

  return candidates.flatMap(normalizeToolCallCandidate).filter(Boolean);
}

function normalizeToolCallCandidate(candidate) {
  const calls = Array.isArray(candidate) ? candidate : candidate ? [candidate] : [];
  return calls.map(normalizeToolCall).filter(Boolean);
}

function normalizeToolCall(call) {
  if (!isRecord(call)) {
    return null;
  }

  const name = normalizeString(
    call.name ?? call.toolName ?? call.function?.name ?? call.tool?.name,
  );
  if (!name) {
    return null;
  }

  return {
    id: normalizeString(call.id ?? call.callId ?? call.tool_call_id) || undefined,
    name,
    args: normalizeToolArgs(call.args ?? call.arguments ?? call.function?.arguments),
  };
}

function normalizeToolArgs(value) {
  if (isRecord(value)) {
    return { ...value };
  }
  if (typeof value !== "string") {
    return {};
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }
  try {
    const parsed = JSON.parse(trimmed);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isToolAllowedByName(name, allowedNames) {
  if (!(allowedNames instanceof Set)) {
    return true;
  }
  return allowedNames.has(name);
}

function normalizeToolDefinitionForChat(definition, options = {}) {
  if (!isRecord(definition) || definition.type !== "function") {
    return null;
  }

  const name = getRawToolDefinitionName(definition);
  if (
    !name ||
    !isToolAllowedByName(name, options.allowedNames) ||
    !isToolAllowedForChat(name, options.allowedLevels)
  ) {
    return null;
  }

  if (isRecord(definition.function)) {
    return {
      type: "function",
      function: {
        name,
        description: normalizeString(definition.function.description),
        parameters: definition.function.parameters ?? { type: "object", properties: {} },
      },
    };
  }

  return {
    type: "function",
    function: {
      name,
      description: normalizeString(definition.description),
      parameters: definition.parameters ?? { type: "object", properties: {} },
    },
  };
}

function getRawToolDefinitionName(definition) {
  return normalizeString(definition.function?.name ?? definition.name);
}

function getChatToolName(definition) {
  return normalizeString(definition?.function?.name);
}

function isToolAllowedForChat(name, allowedLevels) {
  if (!(allowedLevels instanceof Set)) {
    return true;
  }
  return allowedLevels.has(getToolPermissionRequest(name).level);
}

function normalizeChatRequest(payload, deps) {
  if (!isRecord(payload)) {
    throw new LeenaError("Chat payload must be an object.", { code: "CHAT_PAYLOAD_INVALID" });
  }

  const conversationId =
    normalizeString(payload.conversationId) || deps.createId("chat-conversation");
  const messageId = normalizeString(payload.messageId) || deps.createId("chat-message");
  const userMessage = limitText(
    normalizeString(payload.message ?? payload.text ?? payload.prompt),
    CHAT_MESSAGE_MAX_CHARS,
  );
  const messages = normalizeMessages(payload.messages);

  if (userMessage) {
    messages.push({ role: "user", content: userMessage });
  }

  if (messages.length === 0) {
    throw new LeenaError("Chat message must be a non-empty string.", {
      code: "CHAT_MESSAGE_REQUIRED",
    });
  }

  return {
    conversationId,
    messageId,
    provider: normalizeString(payload.provider),
    model: normalizeString(payload.model),
    messages,
    userMessage: userMessage || messages.at(-1)?.content || "",
    toolsEnabled: payload.tools !== false,
  };
}

function normalizePartialRequest(payload) {
  return {
    conversationId:
      (isRecord(payload) && normalizeString(payload.conversationId)) || "chat-conversation",
    messageId: (isRecord(payload) && normalizeString(payload.messageId)) || "chat-message",
  };
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .slice(-CHAT_HISTORY_MAX_MESSAGES)
    .map((message) => {
      if (!isRecord(message)) {
        return null;
      }
      const role = normalizeRole(message.role);
      const content = limitText(normalizeString(message.content), CHAT_MESSAGE_MAX_CHARS);
      if (!role || !content) {
        return null;
      }
      return {
        role,
        content,
        name: normalizeString(message.name) || undefined,
      };
    })
    .filter(Boolean);
}

function normalizeRole(role) {
  const normalized = normalizeString(role);
  return ["user", "assistant"].includes(normalized) ? normalized : null;
}

function selectProvider(registry, providerName) {
  assertProviderRegistry(registry);

  const provider = providerName ? registry.get(providerName) : selectDefaultProvider(registry);
  if (!provider || !providerCanProvide(provider, CHAT)) {
    throw new ProviderError("No chat-capable provider is available.", {
      code: "CHAT_PROVIDER_UNAVAILABLE",
      provider: providerName || undefined,
    });
  }
  return provider;
}

function selectDefaultProvider(registry) {
  if (typeof registry.getDefault === "function") {
    const provider = registry.getDefault(CHAT);
    if (provider) {
      return provider;
    }
  }
  const providers =
    typeof registry.getForCapability === "function" ? registry.getForCapability(CHAT) : [];
  return Array.isArray(providers) ? (providers[0] ?? null) : null;
}

function selectModel(provider, requestedModel) {
  if (requestedModel) {
    return requestedModel;
  }
  if (typeof provider.getDefaultModel === "function") {
    return provider.getDefaultModel(CHAT) ?? undefined;
  }
  const models = provider.models?.[CHAT];
  return Array.isArray(models) ? (models[0] ?? undefined) : undefined;
}

function providerCanProvide(provider, capability) {
  if (typeof provider.canProvide === "function") {
    return provider.canProvide(capability);
  }
  if (typeof provider.supports === "function") {
    return provider.supports(capability);
  }
  return provider.capabilities?.[capability] === true;
}

function assertProviderRegistry(registry) {
  if (
    !registry ||
    typeof registry !== "object" ||
    (typeof registry.get !== "function" && typeof registry.getForCapability !== "function")
  ) {
    throw new TypeError("Chat handler requires a provider registry.");
  }
}

function emitChatChunk(deps, event, payload) {
  const normalizedPayload = {
    ...payload,
    at: deps.now(),
  };

  if (typeof deps.chunkSender === "function") {
    deps.chunkSender(normalizedPayload, event);
    return;
  }

  event?.sender?.send?.(CHAT_IPC_CHANNELS.chunk, normalizedPayload);
}

function buildMemorySuggestion(request, { provider, model, content }) {
  const text = limitText(
    `User: ${request.userMessage}\nLeena: ${content}`,
    DEFAULT_MAX_MEMORY_TEXT,
  );

  return {
    text,
    metadata: {
      kind: "chat_exchange",
      conversationId: request.conversationId,
      provider: provider.name,
      model,
    },
  };
}

function stringifyToolResult(result) {
  if (typeof result === "string") {
    return limitText(result, 4000);
  }
  try {
    return limitText(JSON.stringify(result), 4000);
  } catch {
    return "";
  }
}

function stringifyToolArgs(args) {
  try {
    return JSON.stringify(isRecord(args) ? args : {});
  } catch {
    return "{}";
  }
}

function limitText(value, maxLength) {
  const text = String(value ?? "");
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeContentString(value) {
  return typeof value === "string" ? value : "";
}

function isAsyncIterable(value) {
  return Boolean(value && typeof value[Symbol.asyncIterator] === "function");
}

function isIterable(value) {
  return Boolean(value && typeof value[Symbol.iterator] === "function");
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
