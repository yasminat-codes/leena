import { ProviderError } from "../utils/errors.js";
import { withRetry } from "../utils/retry.js";
import { BaseProvider } from "./base-provider.js";
import { CHAT, EMBEDDINGS, REALTIME, STT, TTS } from "./types.js";

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_EMBEDDING_MODEL = "nomic-embed-text";
const MODEL_CACHE_MS = 5 * 60 * 1000;
const HEALTH_TIMEOUT_MS = 2000;
const RETRY_OPTIONS = Object.freeze({
  maxAttempts: 3,
  baseDelay: 25,
  maxDelay: 250,
  jitter: false,
});
const FALSE_CAPABILITIES = Object.freeze({
  [CHAT]: false,
  [EMBEDDINGS]: false,
  [REALTIME]: false,
  [TTS]: false,
  [STT]: false,
});
const POTENTIAL_CAPABILITIES = Object.freeze({
  [CHAT]: true,
  [EMBEDDINGS]: true,
  [REALTIME]: false,
  [TTS]: false,
  [STT]: false,
});

export class OllamaProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      name: "ollama",
      displayName: "Ollama",
      capabilities: FALSE_CAPABILITIES,
      models: emptyModelIndex(),
    });
    this.baseUrl = normalizeBaseUrl(config.baseUrl ?? DEFAULT_BASE_URL);
    this.fetchImpl = resolveFetch(config.fetch);
    this.modelCacheMs = config.modelCacheMs ?? MODEL_CACHE_MS;
    this.healthTimeoutMs = config.healthTimeoutMs ?? HEALTH_TIMEOUT_MS;
    this.modelCache = null;
  }

  canProvide(capability) {
    return this.supports(capability) || POTENTIAL_CAPABILITIES[capability] === true;
  }

  async healthCheck() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.healthTimeoutMs);

    try {
      const data = await withRetry(
        async () => {
          const response = await this.fetchImpl(buildUrl(this.baseUrl, "/api/tags"), {
            method: "GET",
            signal: controller.signal,
          });
          if (!response.ok) {
            const error = new ProviderError(`Ollama health check failed with ${response.status}`, {
              code: "OLLAMA_HEALTH_CHECK_FAILED",
              provider: this.name,
            });
            error.status = response.status;
            throw error;
          }
          return response.json();
        },
        { ...RETRY_OPTIONS, maxAttempts: 1, signal: controller.signal },
      );
      const rawModels = normalizeRawModels(data);
      this.updateModels(rawModels);
      return { ok: true, models: rawModels };
    } catch (error) {
      this.markUnavailable();
      if (isTimeoutError(error)) {
        return { ok: false, models: [], error: "Ollama timeout", code: "ETIMEDOUT" };
      }
      if (getErrorCode(error) === "ECONNREFUSED") {
        return { ok: false, models: [], error: "Ollama not running", code: "ECONNREFUSED" };
      }
      return {
        ok: false,
        models: [],
        error: error?.message ?? "Ollama health check failed",
        code: error?.code ?? "OLLAMA_HEALTH_CHECK_FAILED",
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async *chat(request = {}) {
    const model = await this.resolveChatModel(request.model);
    const response = await this.fetchWithRetry("/api/chat", {
      method: "POST",
      body: {
        model,
        messages: normalizeMessages(request.messages),
        stream: true,
        options: buildChatOptions(request),
      },
      signal: request.signal,
    });

    for await (const item of parseNdjson(response.body, this.name)) {
      const content = item?.message?.content;
      if (typeof content === "string" && content.length > 0) {
        yield { content, delta: content, model };
      }
      if (item?.done === true) {
        break;
      }
    }
  }

  async embed(request = {}) {
    const inputs = normalizeEmbeddingInput(request.input);
    const model = await this.resolveEmbeddingModel(request.model);
    const embeddings = [];

    for (const prompt of inputs) {
      const data = await this.fetchJsonWithRetry(
        "/api/embeddings",
        {
          method: "POST",
          body: { model, prompt },
        },
        request.signal,
      );
      if (!Array.isArray(data?.embedding)) {
        throw new ProviderError("Ollama embedding response did not include an embedding array", {
          code: "INVALID_PROVIDER_RESPONSE",
          provider: this.name,
          model,
        });
      }
      embeddings.push(data.embedding);
    }

    return { embeddings, model };
  }

  async getModels(options = {}) {
    const force = options.force === true;
    if (!force && this.modelCache && Date.now() - this.modelCache.fetchedAt < this.modelCacheMs) {
      return this.modelCache.models.map(copyModel);
    }

    const data = await this.fetchJsonWithRetry("/api/tags", { method: "GET" });
    const models = this.updateModels(normalizeRawModels(data));
    return models.map(copyModel);
  }

  async pullModel(name, onProgress) {
    const modelName = normalizeModelName(name);
    if (!modelName) {
      throw new ProviderError("Ollama model name is required", {
        code: "MODEL_MISSING",
        provider: this.name,
      });
    }

    const response = await this.fetchWithRetry("/api/pull", {
      method: "POST",
      body: { name: modelName, stream: true },
    });
    let succeeded = false;

    for await (const item of parseNdjson(response.body, this.name)) {
      const status = typeof item?.status === "string" ? item.status : "";
      const progress = {
        status,
        pct: calculateProgress(item),
      };
      if (typeof onProgress === "function") {
        onProgress(progress);
      }
      if (status.toLowerCase() === "success") {
        succeeded = true;
      }
    }

    if (!succeeded) {
      throw new ProviderError(`Ollama pull did not finish successfully for ${modelName}`, {
        code: "MODEL_PULL_INCOMPLETE",
        provider: this.name,
        model: modelName,
      });
    }

    this.modelCache = null;
    return { ok: true, model: modelName };
  }

  async speak(_text, options = {}) {
    const model = await this.findModelForCapability(TTS, options.model);
    if (!model) {
      throw new ProviderError("TTS model not available - pull an outetts model", {
        code: "MODEL_MISSING",
        provider: this.name,
        model: options.model,
      });
    }
    throw new ProviderError("Ollama TTS execution is not implemented for this model yet", {
      code: "NOT_IMPLEMENTED",
      provider: this.name,
      model,
    });
  }

  async transcribe(_audioBuffer, options = {}) {
    const model = await this.findModelForCapability(STT, options.model);
    if (!model) {
      throw new ProviderError("STT model not available - pull a whisper model", {
        code: "MODEL_MISSING",
        provider: this.name,
        model: options.model,
      });
    }
    throw new ProviderError("Ollama STT execution is not implemented for this model yet", {
      code: "NOT_IMPLEMENTED",
      provider: this.name,
      model,
    });
  }

  tts(text, options = {}) {
    return this.speak(text, options);
  }

  stt(audioBuffer, options = {}) {
    return this.transcribe(audioBuffer, options);
  }

  async resolveChatModel(model) {
    const requested = normalizeModelName(model);
    if (requested) {
      return requested;
    }
    const models = await this.safeGetModels();
    const chatModel = models.find((item) => item.capabilities[CHAT]);
    if (!chatModel) {
      throw new ProviderError("Chat model not available - pull a local Ollama chat model", {
        code: "MODEL_MISSING",
        provider: this.name,
      });
    }
    return chatModel.name;
  }

  async resolveEmbeddingModel(model) {
    const requested = normalizeModelName(model);
    if (requested) {
      return requested;
    }
    const models = await this.safeGetModels();
    return (
      models.find((item) => item.name.toLowerCase().includes(DEFAULT_EMBEDDING_MODEL))?.name ??
      models.find((item) => item.capabilities[EMBEDDINGS])?.name ??
      DEFAULT_EMBEDDING_MODEL
    );
  }

  async findModelForCapability(capability, requestedModel) {
    const requested = normalizeModelName(requestedModel);
    const models = await this.safeGetModels();
    if (requested) {
      return models.some((item) => item.name === requested && item.capabilities[capability])
        ? requested
        : null;
    }
    return models.find((item) => item.capabilities[capability])?.name ?? null;
  }

  async safeGetModels() {
    try {
      return await this.getModels();
    } catch {
      this.markUnavailable();
      return [];
    }
  }

  updateModels(rawModels) {
    const taggedModels = rawModels.map(tagModel).filter(Boolean);
    const capabilities = { ...FALSE_CAPABILITIES };
    const models = emptyModelIndex();

    for (const model of taggedModels) {
      for (const capability of [CHAT, EMBEDDINGS, TTS, STT]) {
        if (model.capabilities[capability]) {
          capabilities[capability] = true;
          models[capability].push(model.name);
        }
      }
    }

    this.capabilities = capabilities;
    this.models = models;
    this.modelCache = {
      fetchedAt: Date.now(),
      models: taggedModels.map(copyModel),
    };
    return taggedModels;
  }

  markUnavailable() {
    this.capabilities = { ...FALSE_CAPABILITIES };
    this.models = emptyModelIndex();
    this.modelCache = {
      fetchedAt: Date.now(),
      models: [],
    };
  }

  async fetchJsonWithRetry(path, options = {}, signal) {
    const response = await this.fetchWithRetry(path, options, signal);
    return response.json();
  }

  fetchWithRetry(path, options = {}, signal = options.signal) {
    return withRetry(
      async () => {
        const response = await this.fetchImpl(buildUrl(this.baseUrl, path), {
          method: options.method ?? "GET",
          headers: {
            "content-type": "application/json",
            ...(options.headers ?? {}),
          },
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal,
        });
        if (!response.ok) {
          throw await createHttpError(response, this.name);
        }
        return response;
      },
      { ...RETRY_OPTIONS, signal },
    );
  }
}

export function createOllamaProvider(config = {}) {
  return new OllamaProvider(config);
}

function buildChatOptions(request) {
  const options = {};
  if (typeof request.temperature === "number") {
    options.temperature = request.temperature;
  }
  if (Number.isInteger(request.maxTokens) && request.maxTokens > 0) {
    options.num_predict = request.maxTokens;
  }
  return options;
}

function normalizeMessages(messages) {
  return Array.isArray(messages)
    ? messages.map((message) => ({
        role: message.role,
        content:
          typeof message.content === "string" ? message.content : String(message.content ?? ""),
      }))
    : [];
}

function normalizeEmbeddingInput(input) {
  if (Array.isArray(input)) {
    return input.map((item) => String(item));
  }
  if (typeof input === "string") {
    return [input];
  }
  return [String(input ?? "")];
}

function normalizeRawModels(data) {
  return Array.isArray(data?.models) ? data.models : [];
}

function tagModel(rawModel) {
  const name = normalizeModelName(rawModel?.name ?? rawModel?.model);
  if (!name) {
    return null;
  }
  const capabilities = inferCapabilities(name, rawModel?.details);
  return {
    name,
    model: name,
    displayName: name,
    capabilities,
    modifiedAt: rawModel?.modified_at,
    size: rawModel?.size,
    digest: rawModel?.digest,
    details: rawModel?.details ?? {},
  };
}

function inferCapabilities(name, details = {}) {
  const haystack = [
    name,
    details.family,
    ...(Array.isArray(details.families) ? details.families : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const capabilities = { ...FALSE_CAPABILITIES };
  capabilities[EMBEDDINGS] = /\b(embed|embedding|nomic|bge|minilm|e5)\b/.test(haystack);
  capabilities[TTS] = false;
  capabilities[STT] = false;
  capabilities[CHAT] =
    !capabilities[EMBEDDINGS] &&
    (/\b(llama|mistral|mixtral|phi|gemma|qwen|deepseek|codellama|vicuna|orca|llava)\b/.test(
      haystack,
    ) ||
      !/\b(embed|embedding|nomic|bge|minilm|e5|outetts|tts|whisper|stt)\b/.test(haystack));
  return capabilities;
}

function emptyModelIndex() {
  return {
    [CHAT]: [],
    [EMBEDDINGS]: [],
    [REALTIME]: [],
    [TTS]: [],
    [STT]: [],
  };
}

function copyModel(model) {
  return {
    ...model,
    capabilities: { ...model.capabilities },
    details: { ...model.details },
  };
}

async function createHttpError(response, provider) {
  const body = await safeResponseText(response);
  const error = new ProviderError(
    body
      ? `Ollama request failed with ${response.status}: ${body}`
      : `Ollama request failed with ${response.status}`,
    {
      code: "OLLAMA_HTTP_ERROR",
      provider,
    },
  );
  error.status = response.status;
  error.headers = response.headers;
  return error;
}

async function safeResponseText(response) {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "";
  }
}

async function* parseNdjson(body, provider) {
  if (!body) {
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of iterateBody(body, provider)) {
    buffer += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) {
        yield parseNdjsonLine(line, provider);
      }
      newlineIndex = buffer.indexOf("\n");
    }
  }

  buffer += decoder.decode();
  const remaining = buffer.trim();
  if (remaining) {
    yield parseNdjsonLine(remaining, provider);
  }
}

async function* iterateBody(body, provider) {
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
    return;
  }

  throw new ProviderError("Ollama streaming response body is not readable", {
    code: "INVALID_PROVIDER_RESPONSE",
    provider,
  });
}

function parseNdjsonLine(line, provider) {
  try {
    return JSON.parse(line);
  } catch (cause) {
    throw new ProviderError("Ollama streaming response contained invalid JSON", {
      code: "INVALID_PROVIDER_RESPONSE",
      provider,
      cause,
    });
  }
}

function calculateProgress(item) {
  const completed = Number(item?.completed);
  const total = Number(item?.total);
  if (Number.isFinite(completed) && Number.isFinite(total) && total > 0) {
    return Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
  }
  return typeof item?.status === "string" && item.status.toLowerCase() === "success"
    ? 100
    : undefined;
}

function normalizeModelName(name) {
  return typeof name === "string" ? name.trim() : "";
}

function normalizeBaseUrl(baseUrl) {
  const value = typeof baseUrl === "string" ? baseUrl.trim() : "";
  if (!value) {
    return DEFAULT_BASE_URL;
  }
  return value.replace(/\/+$/, "");
}

function resolveFetch(fetchImpl) {
  const resolvedFetch = fetchImpl ?? globalThis.fetch;
  if (typeof resolvedFetch !== "function") {
    throw new ProviderError("Fetch is unavailable for the Ollama provider", {
      code: "FETCH_UNAVAILABLE",
      provider: "ollama",
    });
  }
  return resolvedFetch;
}

function buildUrl(baseUrl, path) {
  return `${baseUrl}${path}`;
}

function getErrorCode(error) {
  let fallback;
  for (const value of [
    error?.lastError?.cause?.code,
    error?.lastError?.code,
    error?.cause?.code,
    error?.code,
  ]) {
    if (typeof value === "string") {
      if (value !== "RETRY_EXHAUSTED") {
        return value;
      }
      fallback = value;
    }
  }
  return fallback;
}

function isTimeoutError(error) {
  return (
    error?.name === "AbortError" ||
    error?.lastError?.name === "AbortError" ||
    getErrorCode(error) === "ETIMEDOUT"
  );
}
