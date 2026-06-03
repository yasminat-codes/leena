import { CHAT, EMBEDDINGS } from "../../src/providers/types.js";

const DEFAULT_DIMENSIONS = 8;
const DEFAULT_CHAT_CONTENT = "- User prefers direct answers.";

export function createMockProviderRegistry(options = {}) {
  const embeddingsProvider = createEmbeddingsProvider(options);
  const chatProvider = createChatProvider(options);

  return {
    embeddingsProvider,
    chatProvider,
    getDefault(capability) {
      if (capability === EMBEDDINGS) {
        return embeddingsProvider;
      }
      if (capability === CHAT) {
        return chatProvider;
      }
      return null;
    },
    getForCapability(capability) {
      const provider = this.getDefault(capability);
      return provider ? [provider] : [];
    },
  };
}

export class MockEmbeddingProvider {
  constructor(options = {}) {
    const normalizedOptions = looksLikeVectorMap(options) ? { vectors: options } : options;
    this.vectors = normalizeVectorMap(normalizedOptions.vectors ?? {});
    this.mode = normalizedOptions.mode ?? "hash";
    this.dimensions = normalizedOptions.dimensions ?? DEFAULT_DIMENSIONS;
    this.calls = [];
  }

  async embed(request) {
    const input = normalizeEmbeddingInput(request);
    this.calls.push(input);

    if (this.mode === "throw") {
      throw new Error("Mock embedding provider failure");
    }
    if (this.mode === "empty") {
      return { embeddings: [], model: "mock-embedding" };
    }

    const inputs = Array.isArray(input) ? input : [input];
    return {
      embeddings: inputs.map((item) => this.vectorFor(item)),
      model: "mock-embedding",
    };
  }

  vectorFor(input) {
    const key = String(input ?? "");
    return this.vectors.get(key) ?? hashEmbedding(key, this.dimensions);
  }
}

export class MockChatProvider {
  constructor(content = DEFAULT_CHAT_CONTENT) {
    this.content = content;
    this.calls = [];
  }

  async chat(request) {
    this.calls.push(request);
    return {
      content: typeof this.content === "function" ? await this.content(request) : this.content,
      model: "mock-chat",
    };
  }
}

function createEmbeddingsProvider(options) {
  if (options.embeddings === false || options.embeddingMode === "none") {
    return null;
  }
  if (options.embeddingsProvider) {
    return options.embeddingsProvider;
  }
  if (isProvider(options.embeddings, "embed")) {
    return options.embeddings;
  }
  return new MockEmbeddingProvider({
    dimensions: options.dimensions,
    mode: options.embeddingMode,
    vectors: options.embeddingVectors ?? options.embeddings ?? {},
  });
}

function createChatProvider(options) {
  if (options.chat === false) {
    return null;
  }
  if (options.chatProvider) {
    return options.chatProvider;
  }
  if (isProvider(options.chat, "chat")) {
    return options.chat;
  }
  return new MockChatProvider(options.chatContent ?? options.chat ?? DEFAULT_CHAT_CONTENT);
}

function normalizeEmbeddingInput(request) {
  if (typeof request === "string" || Array.isArray(request)) {
    return request;
  }
  if (request && typeof request === "object" && "input" in request) {
    return request.input;
  }
  return "";
}

function normalizeVectorMap(vectors) {
  const entries = vectors instanceof Map ? vectors.entries() : Object.entries(vectors);
  return new Map(Array.from(entries, ([key, value]) => [String(key), Float32Array.from(value)]));
}

function looksLikeVectorMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every(
    (candidate) => Array.isArray(candidate) || ArrayBuffer.isView(candidate),
  );
}

function hashEmbedding(input, dimensions) {
  const vector = new Float32Array(dimensions);
  const text = String(input ?? "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
    vector[Math.abs(hash) % dimensions] += ((hash >>> 8) % 17) + 1;
  }
  if (text.length === 0) {
    vector[0] = 1;
  }
  return vector;
}

function isProvider(value, methodName) {
  return Boolean(value) && typeof value === "object" && typeof value[methodName] === "function";
}
