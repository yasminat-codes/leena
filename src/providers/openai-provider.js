import { buildRealtimeInstructions } from "../realtime/prompts.js";
import { getRealtimeToolDefinitions } from "../realtime/tools/tool-schemas.js";
import { ProviderError, RetryExhaustedError } from "../utils/errors.js";
import { withRetry } from "../utils/retry.js";
import { BaseProvider } from "./base-provider.js";
import { CHAT, EMBEDDINGS, REALTIME, STT, TTS } from "./types.js";

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_CHAT_MODEL = "gpt-4o-mini";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_REALTIME_MODEL = "gpt-realtime-2";
const DEFAULT_REALTIME_VOICE = "marin";
const DEFAULT_REALTIME_SAMPLE_RATE = 24_000;
const DEFAULT_TTS_MODEL = "tts-1";
const DEFAULT_TTS_VOICE = "alloy";
const DEFAULT_STT_MODEL = "gpt-4o-transcribe";
const OPENAI_MODEL_CATALOG = Object.freeze([
  Object.freeze({
    id: DEFAULT_CHAT_MODEL,
    name: "GPT-4o mini",
    model: DEFAULT_CHAT_MODEL,
    displayName: "GPT-4o mini",
    capabilities: Object.freeze({
      [CHAT]: true,
      [EMBEDDINGS]: false,
      [REALTIME]: false,
      [TTS]: false,
      [STT]: false,
    }),
  }),
  Object.freeze({
    id: DEFAULT_EMBEDDING_MODEL,
    name: "Text embedding 3 small",
    model: DEFAULT_EMBEDDING_MODEL,
    displayName: "Text embedding 3 small",
    capabilities: Object.freeze({
      [CHAT]: false,
      [EMBEDDINGS]: true,
      [REALTIME]: false,
      [TTS]: false,
      [STT]: false,
    }),
  }),
  Object.freeze({
    id: DEFAULT_REALTIME_MODEL,
    name: "GPT Realtime 2",
    model: DEFAULT_REALTIME_MODEL,
    displayName: "GPT Realtime 2",
    capabilities: Object.freeze({
      [CHAT]: false,
      [EMBEDDINGS]: false,
      [REALTIME]: true,
      [TTS]: false,
      [STT]: false,
    }),
  }),
  Object.freeze({
    id: DEFAULT_TTS_MODEL,
    name: "TTS 1",
    model: DEFAULT_TTS_MODEL,
    displayName: "TTS 1",
    capabilities: Object.freeze({
      [CHAT]: false,
      [EMBEDDINGS]: false,
      [REALTIME]: false,
      [TTS]: true,
      [STT]: false,
    }),
  }),
  Object.freeze({
    id: DEFAULT_STT_MODEL,
    name: "GPT-4o transcribe",
    model: DEFAULT_STT_MODEL,
    displayName: "GPT-4o transcribe",
    capabilities: Object.freeze({
      [CHAT]: false,
      [EMBEDDINGS]: false,
      [REALTIME]: false,
      [TTS]: false,
      [STT]: true,
    }),
  }),
]);

export class OpenAIProvider extends BaseProvider {
  constructor({
    apiKey,
    orgId,
    baseUrl = OPENAI_BASE_URL,
    fetchImpl = globalThis.fetch,
    retryOptions = {},
  } = {}) {
    super({
      name: "openai",
      displayName: "OpenAI",
      capabilities: {
        [CHAT]: true,
        [EMBEDDINGS]: true,
        [REALTIME]: true,
        [TTS]: true,
        [STT]: true,
      },
      models: {
        [CHAT]: [DEFAULT_CHAT_MODEL],
        [EMBEDDINGS]: [DEFAULT_EMBEDDING_MODEL],
        [REALTIME]: [DEFAULT_REALTIME_MODEL],
        [TTS]: [DEFAULT_TTS_MODEL],
        [STT]: [DEFAULT_STT_MODEL],
      },
    });
    this.apiKey = typeof apiKey === "string" ? apiKey.trim() : "";
    this.orgId = typeof orgId === "string" ? orgId.trim() : "";
    this.baseUrl = String(baseUrl || OPENAI_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = fetchImpl;
    this.retryOptions = { ...retryOptions };
  }

  async chat(request = {}, options = {}) {
    const chatRequest = normalizeChatRequest(request, options);
    const model = chatRequest.model ?? DEFAULT_CHAT_MODEL;
    const body = omitUndefined({
      model,
      messages: chatRequest.messages,
      stream: chatRequest.stream || undefined,
      temperature: chatRequest.temperature,
      max_tokens: chatRequest.maxTokens ?? chatRequest.max_tokens,
      top_p: chatRequest.topP ?? chatRequest.top_p,
      tools: chatRequest.tools,
      tool_choice: chatRequest.toolChoice ?? chatRequest.tool_choice,
      response_format: chatRequest.responseFormat ?? chatRequest.response_format,
    });

    if (chatRequest.stream) {
      const response = await this.fetchOpenAI("/chat/completions", {
        body,
        label: "OpenAI chat stream request",
        model,
        signal: chatRequest.signal,
        retryOptions: chatRequest.retryOptions,
        raw: true,
      });
      return parseChatStream(response.body, { model, provider: this.name });
    }

    const raw = await this.fetchOpenAI("/chat/completions", {
      body,
      label: "OpenAI chat request",
      model,
      signal: chatRequest.signal,
      retryOptions: chatRequest.retryOptions,
    });
    const message = raw.choices?.[0]?.message ?? {};
    return {
      role: typeof message.role === "string" ? message.role : "assistant",
      content: typeof message.content === "string" ? message.content : "",
      model: typeof raw.model === "string" ? raw.model : model,
      usage: normalizeUsage(raw.usage),
      raw,
    };
  }

  async embed(request = {}, options = {}) {
    const embeddingRequest = normalizeEmbeddingRequest(request, options);
    const model = embeddingRequest.model ?? DEFAULT_EMBEDDING_MODEL;
    const raw = await this.fetchOpenAI("/embeddings", {
      body: { model, input: embeddingRequest.input },
      label: "OpenAI embeddings request",
      model,
      signal: embeddingRequest.signal,
      retryOptions: embeddingRequest.retryOptions,
    });
    return {
      embeddings: Array.isArray(raw.data) ? raw.data.map((item) => item.embedding) : [],
      model: typeof raw.model === "string" ? raw.model : model,
      usage: normalizeUsage(raw.usage),
      raw,
    };
  }

  async createRealtimeSession(options = {}) {
    const model = typeof options.model === "string" ? options.model : DEFAULT_REALTIME_MODEL;
    const raw = await this.fetchOpenAI("/realtime/client_secrets", {
      body: { session: buildRealtimeSessionConfig(options) },
      label: "OpenAI realtime client secret request",
      model,
      signal: options.signal,
      retryOptions: options.retryOptions,
    });
    const value = typeof raw.value === "string" ? raw.value : undefined;
    if (!value) {
      throw new ProviderError("OpenAI realtime client secret response did not include a value.", {
        code: "OPENAI_INVALID_RESPONSE",
        provider: this.name,
        model,
      });
    }
    return {
      value,
      expiresAt: parseExpiresAt(raw.expires_at),
      raw,
    };
  }

  getDefaultModel(capability) {
    const models = this.models[capability];
    return Array.isArray(models) ? (models[0] ?? null) : null;
  }

  async getModels() {
    return OPENAI_MODEL_CATALOG.map(copyModel);
  }

  async speak(text, options = {}) {
    const model = typeof options.model === "string" ? options.model : DEFAULT_TTS_MODEL;
    const response = await this.fetchOpenAI("/audio/speech", {
      body: omitUndefined({
        model,
        input: String(text ?? ""),
        voice: typeof options.voice === "string" ? options.voice : DEFAULT_TTS_VOICE,
        response_format: options.responseFormat ?? options.response_format,
        speed: options.speed,
      }),
      label: "OpenAI speech request",
      model,
      signal: options.signal,
      retryOptions: options.retryOptions,
      raw: true,
    });
    return Buffer.from(await response.arrayBuffer());
  }

  tts(text, options = {}) {
    return this.speak(text, options);
  }

  async transcribe(audioBuffer, options = {}) {
    const model = typeof options.model === "string" ? options.model : DEFAULT_STT_MODEL;
    const formData = new FormData();
    formData.set("model", model);
    formData.set(
      "file",
      new Blob([audioBuffer], { type: options.mimeType ?? "audio/wav" }),
      options.filename ?? "audio.wav",
    );
    for (const [key, value] of Object.entries(
      omitUndefined({
        language: options.language,
        prompt: options.prompt,
        response_format: options.responseFormat ?? options.response_format,
        temperature: options.temperature,
      }),
    )) {
      formData.set(key, String(value));
    }

    const raw = await this.fetchOpenAI("/audio/transcriptions", {
      body: formData,
      label: "OpenAI transcription request",
      model,
      signal: options.signal,
      retryOptions: options.retryOptions,
      rawBody: true,
    });
    if (typeof raw.text !== "string") {
      throw new ProviderError("OpenAI transcription response did not include text.", {
        code: "OPENAI_INVALID_RESPONSE",
        provider: this.name,
        model,
      });
    }
    return raw.text;
  }

  stt(audioBuffer, options = {}) {
    return this.transcribe(audioBuffer, options);
  }

  async fetchOpenAI(path, options) {
    this.assertReady(options.model);
    const url = `${this.baseUrl}${path}`;
    try {
      return await withRetry(
        async () => {
          const response = await this.fetchImpl(url, {
            method: "POST",
            headers: this.buildHeaders({ json: !options.rawBody }),
            body: options.rawBody ? options.body : JSON.stringify(options.body),
            signal: options.signal,
          });
          if (!response.ok) {
            throw await createHttpError(response, options.label);
          }
          return options.raw ? response : parseJsonResponse(response, options.label);
        },
        {
          ...this.retryOptions,
          ...options.retryOptions,
          signal: options.signal,
        },
      );
    } catch (error) {
      throw wrapProviderError(error, {
        label: options.label,
        provider: this.name,
        model: options.model,
      });
    }
  }

  buildHeaders({ json }) {
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (json) {
      headers["Content-Type"] = "application/json";
    }
    if (this.orgId) {
      headers["OpenAI-Organization"] = this.orgId;
    }
    return headers;
  }

  assertReady(model) {
    if (!this.apiKey) {
      throw new ProviderError("OpenAI API key is required.", {
        code: "OPENAI_API_KEY_REQUIRED",
        provider: this.name,
        model,
      });
    }
    if (typeof this.fetchImpl !== "function") {
      throw new ProviderError("OpenAI provider requires a fetch implementation.", {
        code: "OPENAI_FETCH_UNAVAILABLE",
        provider: this.name,
        model,
      });
    }
  }
}

export function createOpenAIProvider(config = {}) {
  return new OpenAIProvider(config);
}

function normalizeChatRequest(request, options) {
  if (Array.isArray(request)) {
    return { ...options, messages: request };
  }
  return {
    ...(isRecord(request) ? request : {}),
    ...(isRecord(options) ? options : {}),
  };
}

function normalizeEmbeddingRequest(request, options) {
  if (typeof request === "string" || Array.isArray(request)) {
    return { ...options, input: request };
  }
  return {
    ...(isRecord(request) ? request : {}),
    ...(isRecord(options) ? options : {}),
  };
}

function buildRealtimeSessionConfig(options = {}) {
  const model = typeof options.model === "string" ? options.model : DEFAULT_REALTIME_MODEL;
  const voice = typeof options.voice === "string" ? options.voice : DEFAULT_REALTIME_VOICE;
  const instructions =
    typeof options.instructions === "string" && options.instructions.trim()
      ? options.instructions.trim()
      : buildRealtimeInstructions();

  return {
    type: "realtime",
    model,
    instructions,
    output_modalities: ["audio"],
    audio: {
      input: {
        format: { type: "audio/pcm", rate: DEFAULT_REALTIME_SAMPLE_RATE },
        noise_reduction: { type: "near_field" },
        transcription: { model: "gpt-4o-transcribe" },
        turn_detection: {
          type: "semantic_vad",
          eagerness: "high",
          create_response: true,
          interrupt_response: true,
        },
      },
      output: {
        format: { type: "audio/pcm", rate: DEFAULT_REALTIME_SAMPLE_RATE },
        voice,
        speed: 1.0,
      },
    },
    max_output_tokens: 4096,
    reasoning: { effort: "minimal" },
    tools: Array.isArray(options.tools) ? options.tools : getRealtimeToolDefinitions(),
    tool_choice: "auto",
    tracing: "auto",
  };
}

async function parseJsonResponse(response, label) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    throw new ProviderError(`${label} returned invalid JSON.`, {
      code: "OPENAI_INVALID_RESPONSE",
      cause: error,
    });
  }
}

async function createHttpError(response, label) {
  const text = await response.text();
  const message = `${label} failed (${response.status}): ${text.slice(0, 200)}`;
  const error = new Error(message);
  error.status = response.status;
  error.statusCode = response.status;
  error.headers = response.headers;
  error.body = text;
  return error;
}

async function* parseChatStream(body, { model, provider }) {
  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const content = parseChatStreamLine(line, { model, provider });
      if (content !== undefined) {
        yield content;
      }
    }
  }

  buffer += decoder.decode();
  if (buffer) {
    const content = parseChatStreamLine(buffer, { model, provider });
    if (content !== undefined) {
      yield content;
    }
  }
}

function parseChatStreamLine(line, { model, provider }) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) {
    return undefined;
  }
  const payload = trimmed.slice("data:".length).trim();
  if (!payload || payload === "[DONE]") {
    return undefined;
  }
  let parsed;
  try {
    parsed = JSON.parse(payload);
  } catch (error) {
    throw new ProviderError("OpenAI chat stream returned invalid JSON.", {
      code: "OPENAI_INVALID_RESPONSE",
      provider,
      model,
      cause: error,
    });
  }
  if (parsed.error) {
    throw new ProviderError(parsed.error.message ?? "OpenAI chat stream failed.", {
      code: parsed.error.code ?? "OPENAI_STREAM_ERROR",
      provider,
      model,
    });
  }
  const content = parsed.choices?.[0]?.delta?.content;
  if (typeof content !== "string" || content.length === 0) {
    return undefined;
  }
  return {
    content,
    delta: content,
    model: typeof parsed.model === "string" ? parsed.model : model,
    finishReason: parsed.choices?.[0]?.finish_reason,
    usage: normalizeUsage(parsed.usage),
  };
}

function wrapProviderError(error, { label, provider, model }) {
  if (error instanceof ProviderError) {
    if (error.provider === undefined) {
      error.provider = provider;
    }
    if (error.model === undefined && model !== undefined) {
      error.model = model;
    }
    return error;
  }

  const lastError = error instanceof RetryExhaustedError ? error.lastError : error;
  const status = lastError?.status ?? lastError?.statusCode;
  return new ProviderError(`${label} failed${status ? ` (${status})` : ""}.`, {
    code: "OPENAI_REQUEST_FAILED",
    provider,
    model,
    cause: error,
  });
}

function normalizeUsage(usage) {
  if (!isRecord(usage)) {
    return undefined;
  }
  return omitUndefined({
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  });
}

function parseExpiresAt(value) {
  if (typeof value !== "number") {
    return undefined;
  }
  return value > 10_000_000_000 ? value : value * 1000;
}

function omitUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function copyModel(model) {
  return {
    ...model,
    capabilities: { ...model.capabilities },
  };
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
