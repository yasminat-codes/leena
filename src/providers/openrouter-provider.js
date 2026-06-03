import { ProviderError, RetryExhaustedError } from "../utils/errors.js";
import { withRetry } from "../utils/retry.js";
import { BaseProvider } from "./base-provider.js";
import { CHAT, EMBEDDINGS, REALTIME, STT, TTS } from "./types.js";

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";
const DEFAULT_SITE_URL = "https://leena.app";
const DEFAULT_SITE_NAME = "Leena";
const DEFAULT_CHAT_MODEL = "openrouter/auto";
const DEFAULT_EMBEDDING_MODEL = "qwen/qwen3-embedding-0.6b";
const MODEL_CACHE_TTL_MS = 60 * 60 * 1000;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504, 529]);

export class OpenRouterProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      name: "openrouter",
      displayName: "OpenRouter",
      capabilities: {
        [CHAT]: true,
        [EMBEDDINGS]: true,
        [REALTIME]: false,
        [TTS]: false,
        [STT]: false,
      },
      models: {
        [CHAT]: [DEFAULT_CHAT_MODEL],
        [EMBEDDINGS]: [DEFAULT_EMBEDDING_MODEL],
      },
    });

    this.apiKey = normalizeString(config.apiKey);
    this.siteUrl = normalizeString(config.siteUrl) || DEFAULT_SITE_URL;
    this.siteName = normalizeString(config.siteName) || DEFAULT_SITE_NAME;
    this.fetch = config.fetch ?? globalThis.fetch;
    this.now = typeof config.now === "function" ? config.now : Date.now;
    this.retryOptions = {
      maxAttempts: 3,
      baseDelay: 250,
      maxDelay: 2000,
      jitter: true,
      ...(isRecord(config.retryOptions) ? config.retryOptions : {}),
    };
    this.modelCache = {
      expiresAt: 0,
      value: null,
    };
  }

  async chat(request = {}) {
    const model = normalizeString(request.model) || DEFAULT_CHAT_MODEL;
    const body = {
      model,
      messages: Array.isArray(request.messages) ? request.messages : [],
      stream: request.stream === true,
    };
    copyDefined(body, "temperature", request.temperature);
    copyDefined(body, "max_tokens", request.maxTokens ?? request.max_tokens);
    copyDefined(body, "stop", request.stop);
    copyDefined(body, "tools", request.tools);
    copyDefined(body, "tool_choice", request.toolChoice ?? request.tool_choice);
    copyDefined(body, "response_format", request.responseFormat ?? request.response_format);

    const response = await this.request("/chat/completions", {
      method: "POST",
      body,
      model,
      signal: request.signal,
      stream: body.stream,
    });

    if (body.stream) {
      return parseOpenRouterStream(response.body, model);
    }

    const payload = await response.json();
    return normalizeChatResponse(payload, model);
  }

  async embed(request = {}) {
    const model = normalizeString(request.model) || DEFAULT_EMBEDDING_MODEL;
    const response = await this.request("/embeddings", {
      method: "POST",
      body: {
        model,
        input: request.input,
      },
      model,
      signal: request.signal,
    });
    const payload = await response.json();
    return {
      embeddings: Array.isArray(payload.data)
        ? payload.data.map((item) => (Array.isArray(item?.embedding) ? item.embedding : []))
        : [],
      model: payload.model ?? model,
      usage: normalizeUsage(payload.usage),
    };
  }

  async getModels(options = {}) {
    const forceRefresh = options.forceRefresh === true;
    const now = this.now();
    if (!forceRefresh && this.modelCache.value && this.modelCache.expiresAt > now) {
      return this.modelCache.value;
    }

    const response = await this.request("/models", {
      method: "GET",
      signal: options.signal,
    });
    const payload = await response.json();
    const models = Array.isArray(payload.data)
      ? payload.data.filter(isSupportedModel).map(normalizeModel)
      : [];

    this.modelCache = {
      expiresAt: now + MODEL_CACHE_TTL_MS,
      value: models,
    };
    return models;
  }

  async testConnection() {
    try {
      const models = await this.getModels({ forceRefresh: true });
      if (models.length === 0) {
        return {
          ok: false,
          error: "OpenRouter returned no chat-capable models.",
        };
      }
      return {
        ok: true,
        modelCount: models.length,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        code: typeof error?.code === "string" ? error.code : undefined,
      };
    }
  }

  async getModelInfo(modelId) {
    const normalizedId = normalizeString(modelId);
    if (!normalizedId) {
      return null;
    }
    const model = (await this.getModels()).find((item) => item.id === normalizedId);
    if (!model) {
      return null;
    }
    return {
      id: model.id,
      name: model.name,
      pricing: { ...model.pricing },
      contextLength: model.contextLength,
      capabilities: { ...model.capabilities },
    };
  }

  async request(path, { method, body, model, signal, stream = false } = {}) {
    this.assertReady(model);
    const url = `${OPENROUTER_API_BASE}${path}`;
    const headers = this.buildHeaders({ stream });
    const fetchOptions = {
      method,
      headers,
      signal,
    };
    if (body !== undefined) {
      fetchOptions.body = JSON.stringify(body);
    }

    return this.withProviderRetry(
      async () => {
        const response = await this.fetch(url, fetchOptions);
        if (!response.ok) {
          throw await this.toProviderError(response, model);
        }
        return response;
      },
      { signal },
    );
  }

  buildHeaders({ stream = false } = {}) {
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      "HTTP-Referer": this.siteUrl,
      "X-Title": this.siteName,
      "Content-Type": "application/json",
    };
    if (stream) {
      headers.Accept = "text/event-stream";
    }
    return headers;
  }

  async withProviderRetry(operation, options = {}) {
    try {
      return await withRetry(operation, {
        ...this.retryOptions,
        signal: options.signal,
        retryOn: (error) => RETRYABLE_STATUSES.has(error?.status),
      });
    } catch (error) {
      if (error instanceof RetryExhaustedError && error.lastError instanceof ProviderError) {
        throw error.lastError;
      }
      throw error;
    }
  }

  async toProviderError(response, model) {
    const detail = await readErrorDetail(response);
    const status = response.status;
    const error = new ProviderError(buildErrorMessage(status, detail.message), {
      code: getProviderErrorCode(status, detail.code),
      provider: this.name,
      model,
      cause: detail.cause,
    });
    error.status = status;
    error.headers = response.headers;
    return error;
  }

  assertReady(model) {
    if (typeof this.fetch !== "function") {
      throw new ProviderError("Fetch is not available for OpenRouter requests.", {
        code: "OPENROUTER_FETCH_UNAVAILABLE",
        provider: this.name,
        model,
      });
    }
    if (!this.apiKey) {
      throw new ProviderError("OpenRouter API key is required.", {
        code: "OPENROUTER_API_KEY_REQUIRED",
        provider: this.name,
        model,
      });
    }
  }
}

export function createOpenRouterProvider(config = {}) {
  return new OpenRouterProvider(config);
}

async function* parseOpenRouterStream(body, fallbackModel) {
  if (!body) {
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let sawDone = false;
  const toolCallAccumulator = createStreamingToolCallAccumulator();

  for await (const chunk of iterateBody(body)) {
    buffer += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? "";
    for (const event of events) {
      const parsed = parseSseEvent(event);
      if (parsed === null) {
        continue;
      }
      if (parsed === "[DONE]") {
        sawDone = true;
        buffer = "";
        break;
      }
      const payload = parseJsonChunk(parsed);
      const choice = payload.choices?.[0];
      const delta = choice?.delta?.content ?? "";
      const finishReason = choice?.finish_reason;
      const usage = normalizeUsage(payload.usage);
      const toolCallDeltas = Array.isArray(choice?.delta?.tool_calls)
        ? choice.delta.tool_calls
        : [];
      appendStreamingToolCallDeltas(toolCallAccumulator, toolCallDeltas);
      const toolCalls =
        finishReason === "tool_calls" ? flushStreamingToolCalls(toolCallAccumulator) : [];
      if (delta || finishReason || usage || toolCalls.length > 0) {
        yield {
          content: delta,
          delta,
          model: payload.model ?? fallbackModel,
          finishReason,
          usage,
          ...(toolCalls.length > 0 ? { toolCalls } : {}),
        };
      }
    }
    if (sawDone) {
      break;
    }
  }

  if (!sawDone) {
    buffer += decoder.decode();
  }
  if (!sawDone && buffer.trim()) {
    const parsed = parseSseEvent(buffer);
    if (parsed && parsed !== "[DONE]") {
      const payload = parseJsonChunk(parsed);
      const choice = payload.choices?.[0];
      const delta = choice?.delta?.content ?? "";
      const usage = normalizeUsage(payload.usage);
      const finishReason = choice?.finish_reason;
      const toolCallDeltas = Array.isArray(choice?.delta?.tool_calls)
        ? choice.delta.tool_calls
        : [];
      appendStreamingToolCallDeltas(toolCallAccumulator, toolCallDeltas);
      const toolCalls =
        finishReason === "tool_calls" ? flushStreamingToolCalls(toolCallAccumulator) : [];
      if (delta || finishReason || usage || toolCalls.length > 0) {
        yield {
          content: delta,
          delta,
          model: payload.model ?? fallbackModel,
          finishReason,
          usage,
          ...(toolCalls.length > 0 ? { toolCalls } : {}),
        };
      }
    }
  }

  const remainingToolCalls = flushStreamingToolCalls(toolCallAccumulator);
  if (remainingToolCalls.length > 0) {
    yield {
      content: "",
      delta: "",
      model: fallbackModel,
      finishReason: "tool_calls",
      usage: undefined,
      toolCalls: remainingToolCalls,
    };
  }
}

function createStreamingToolCallAccumulator() {
  return new Map();
}

function appendStreamingToolCallDeltas(accumulator, deltas = []) {
  if (!Array.isArray(deltas)) {
    return;
  }

  for (const delta of deltas) {
    if (!isRecord(delta)) {
      continue;
    }
    const key = Number.isInteger(delta.index)
      ? String(delta.index)
      : typeof delta.id === "string"
        ? delta.id
        : String(accumulator.size);
    const existing = accumulator.get(key) ?? {
      id: "",
      name: "",
      arguments: "",
      type: "function",
    };
    if (typeof delta.id === "string") {
      existing.id = delta.id;
    }
    if (typeof delta.type === "string") {
      existing.type = delta.type;
    }
    if (typeof delta.function?.name === "string") {
      existing.name += delta.function.name;
    }
    if (typeof delta.function?.arguments === "string") {
      existing.arguments += delta.function.arguments;
    }
    accumulator.set(key, existing);
  }
}

function flushStreamingToolCalls(accumulator) {
  const calls = [...accumulator.entries()]
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([, call]) => ({
      id: call.id || undefined,
      type: call.type || "function",
      function: {
        name: call.name,
        arguments: call.arguments,
      },
    }))
    .filter((call) => call.function.name);
  accumulator.clear();
  return calls;
}

async function* iterateBody(body) {
  if (typeof body.getReader === "function") {
    const reader = body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
    return;
  }

  if (typeof body[Symbol.asyncIterator] === "function") {
    yield* body;
  }
}

function parseSseEvent(event) {
  const dataLines = [];
  for (const line of event.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) {
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  return dataLines.length > 0 ? dataLines.join("\n") : null;
}

function parseJsonChunk(value) {
  try {
    return JSON.parse(value);
  } catch (cause) {
    throw new ProviderError("OpenRouter returned an invalid streaming chunk.", {
      code: "OPENROUTER_STREAM_PARSE_ERROR",
      provider: "openrouter",
      cause,
    });
  }
}

function normalizeChatResponse(payload, fallbackModel) {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const content = choices
    .map((choice) => choice?.message?.content ?? choice?.delta?.content ?? "")
    .join("");
  return {
    content,
    model: payload.model ?? fallbackModel,
    usage: normalizeUsage(payload.usage),
    finishReason: choices[0]?.finish_reason,
  };
}

function normalizeUsage(usage) {
  if (!isRecord(usage)) {
    return undefined;
  }
  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  };
}

function normalizeModel(model) {
  const inputModalities = Array.isArray(model.architecture?.input_modalities)
    ? [...model.architecture.input_modalities]
    : [];
  const outputModalities = Array.isArray(model.architecture?.output_modalities)
    ? [...model.architecture.output_modalities]
    : [];
  const supportedParameters = Array.isArray(model.supported_parameters)
    ? [...model.supported_parameters]
    : [];
  return {
    id: model.id,
    name: normalizeString(model.name) || model.id,
    pricing: isRecord(model.pricing) ? { ...model.pricing } : {},
    contextLength: model.context_length ?? model.top_provider?.context_length ?? null,
    maxCompletionTokens: model.top_provider?.max_completion_tokens ?? null,
    capabilities: {
      chat: isChatCapableModel(model),
      embeddings: outputModalities.includes("embeddings"),
      tools: supportedParameters.includes("tools"),
      vision: inputModalities.includes("image"),
    },
    inputModalities,
    outputModalities,
    supportedParameters,
  };
}

function isChatCapableModel(model) {
  if (!isRecord(model) || !normalizeString(model.id)) {
    return false;
  }
  const outputModalities = model.architecture?.output_modalities;
  if (Array.isArray(outputModalities) && !outputModalities.includes("text")) {
    return false;
  }
  const modality = normalizeString(model.architecture?.modality).toLowerCase();
  return !modality.includes("embedding");
}

function isSupportedModel(model) {
  if (!isRecord(model) || !normalizeString(model.id)) {
    return false;
  }
  return isChatCapableModel(model) || isEmbeddingCapableModel(model);
}

function isEmbeddingCapableModel(model) {
  const outputModalities = model.architecture?.output_modalities;
  if (Array.isArray(outputModalities) && outputModalities.includes("embeddings")) {
    return true;
  }
  return normalizeString(model.architecture?.modality).toLowerCase().includes("embedding");
}

async function readErrorDetail(response) {
  const text = await response.text();
  if (!text) {
    return { message: response.statusText || "OpenRouter request failed." };
  }

  try {
    const payload = JSON.parse(text);
    const error = payload.error ?? payload;
    return {
      message:
        normalizeString(error.message) ||
        normalizeString(error.detail) ||
        response.statusText ||
        "OpenRouter request failed.",
      code: normalizeString(error.code),
    };
  } catch (cause) {
    return {
      message: text.slice(0, 500),
      cause,
    };
  }
}

function buildErrorMessage(status, detail) {
  const prefix = `OpenRouter request failed with HTTP ${status}`;
  return detail ? `${prefix}: ${detail}` : `${prefix}.`;
}

function getProviderErrorCode(status, upstreamCode) {
  if (status === 401) {
    return "OPENROUTER_AUTH_FAILED";
  }
  if (status === 402) {
    return "OPENROUTER_INSUFFICIENT_CREDITS";
  }
  if (status === 429) {
    return "OPENROUTER_RATE_LIMITED";
  }
  if (status === 529) {
    return "OPENROUTER_PROVIDER_OVERLOADED";
  }
  if (status >= 500) {
    return "OPENROUTER_UPSTREAM_ERROR";
  }
  return upstreamCode || "OPENROUTER_HTTP_ERROR";
}

function copyDefined(target, key, value) {
  if (value !== undefined) {
    target[key] = value;
  }
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
