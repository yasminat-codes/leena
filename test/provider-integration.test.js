import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { ProviderRegistry, registerDefaultProviders } from "../src/providers/index.js";
import { CHAT, EMBEDDINGS, REALTIME } from "../src/providers/types.js";
import { closeDatabase } from "../src/realtime/tools/database.js";
import { ProviderError } from "../src/utils/errors.js";

const openAiKey = "sk-test-provider-integration-1234567890";
const openRouterKey = "or-test-provider-integration-1234567890";

test("registerDefaultProviders wires all providers and routes by configured capability defaults", async () => {
  await withProviderDb(async (storePath) => {
    const registry = createDefaultRegistry({ storePath });

    assert.deepEqual(
      registry.list().map((provider) => provider.name),
      ["openai", "openrouter", "ollama"],
    );
    assert.deepEqual(
      registry.getForCapability(CHAT).map((provider) => provider.name),
      ["openai", "openrouter", "ollama"],
    );
    assert.deepEqual(
      registry.getForCapability(REALTIME).map((provider) => provider.name),
      ["openai"],
    );
    assert.deepEqual(
      registry.getForCapability(EMBEDDINGS).map((provider) => provider.name),
      ["openai", "openrouter", "ollama"],
    );

    registry.setDefault(CHAT, "openrouter");
    registry.setDefault(EMBEDDINGS, "ollama");

    assert.equal(registry.getDefault(CHAT).name, "openrouter");
    assert.equal(registry.getDefault(EMBEDDINGS).name, "ollama");
    assert.deepEqual(
      routeProviders(registry, CHAT).map((provider) => provider.name),
      ["openrouter", "openai", "ollama"],
    );
    assert.deepEqual(
      routeProviders(registry, EMBEDDINGS).map((provider) => provider.name),
      ["ollama", "openai", "openrouter"],
    );
  });
});

test("provider switching updates routing immediately and keeps chat response shapes compatible", async () => {
  await withProviderDb(async (storePath) => {
    const openAiFetch = createMockFetch([
      jsonResponse({
        model: "gpt-4o-mini",
        choices: [{ message: { role: "assistant", content: "OpenAI ready." } }],
        usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
      }),
    ]);
    const openRouterFetch = createMockFetch([
      jsonResponse({
        model: "anthropic/claude-3.5-sonnet",
        choices: [{ message: { content: "OpenRouter ready." }, finish_reason: "stop" }],
        usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
      }),
    ]);
    const registry = createDefaultRegistry({ storePath, openAiFetch, openRouterFetch });

    assert.equal(registry.setDefault(CHAT, "openai").name, "openai");
    const openAiResponse = await registry.getDefault(CHAT).chat(chatRequest());

    assert.equal(registry.setDefault(CHAT, "openrouter").name, "openrouter");
    const openRouterResponse = await registry.getDefault(CHAT).chat(chatRequest());

    assert.equal(registry.getDefault(CHAT).name, "openrouter");
    assert.deepEqual(requiredChatResponseKeys(openAiResponse), ["content", "model", "usage"]);
    assert.deepEqual(requiredChatResponseKeys(openRouterResponse), ["content", "model", "usage"]);
    assert.equal(openAiResponse.content, "OpenAI ready.");
    assert.equal(openRouterResponse.content, "OpenRouter ready.");
    assert.equal(openAiFetch.calls.length, 1);
    assert.equal(openRouterFetch.calls.length, 1);
  });
});

test("fallback chat routing skips an unreachable default when fallback is enabled", async () => {
  await withProviderDb(async (storePath) => {
    const registry = createDefaultRegistry({
      storePath,
      openAiFetch: createMockFetch([
        jsonResponse({
          model: "gpt-4o-mini",
          choices: [{ message: { role: "assistant", content: "Recovered through OpenAI." } }],
        }),
      ]),
      ollamaFetch: createMockFetch(repeatedJsonResponses(3, { error: "ollama unavailable" }, 503)),
    });
    registry.setDefault(CHAT, "ollama");

    const response = await chatWithFallback(registry, {
      ...chatRequest({ model: "llama3" }),
      fallback: true,
    });

    assert.equal(response.provider, "openai");
    assert.equal(response.content, "Recovered through OpenAI.");
    assert.deepEqual(response.failures, [
      {
        provider: "ollama",
        code: "OLLAMA_HTTP_ERROR",
      },
    ]);
  });
});

test("fallback chat routing returns the default provider failure when fallback is disabled", async () => {
  await withProviderDb(async (storePath) => {
    const registry = createDefaultRegistry({
      storePath,
      ollamaFetch: createMockFetch(repeatedJsonResponses(3, { error: "ollama unavailable" }, 503)),
    });
    registry.setDefault(CHAT, "ollama");

    await assert.rejects(
      () => chatWithFallback(registry, { ...chatRequest({ model: "llama3" }), fallback: false }),
      (error) =>
        error instanceof ProviderError &&
        error.provider === "ollama" &&
        error.code === "OLLAMA_HTTP_ERROR",
    );
  });
});

test("cross-provider streaming chunks use the unified chat stream contract", async () => {
  const registry = createDefaultRegistry({
    openAiFetch: createMockFetch([
      sseResponse([
        'data: {"model":"gpt-4o-mini","choices":[{"delta":{"content":"Hel"}}]}',
        'data: {"model":"gpt-4o-mini","choices":[{"delta":{"content":"lo"},"finish_reason":"stop"}]}',
        "data: [DONE]",
      ]),
    ]),
    openRouterFetch: createMockFetch([
      sseResponse([
        'data: {"model":"openrouter/auto","choices":[{"delta":{"content":"Hel"}}]}',
        'data: {"model":"openrouter/auto","choices":[{"delta":{"content":"lo"},"finish_reason":"stop"}]}',
        "data: [DONE]",
      ]),
    ]),
    ollamaFetch: createMockFetch([
      ndjsonResponse([
        { message: { content: "Hel" }, done: false },
        { message: { content: "lo" }, done: false },
        { done: true },
      ]),
    ]),
  });

  const chunksByProvider = {
    openai: await collectAsync(
      await registry.get("openai").chat({ ...chatRequest(), stream: true }),
    ),
    openrouter: await collectAsync(
      await registry.get("openrouter").chat({ ...chatRequest(), stream: true }),
    ),
    ollama: await collectAsync(registry.get("ollama").chat(chatRequest({ model: "llama3" }))),
  };

  for (const [providerName, chunks] of Object.entries(chunksByProvider)) {
    assert.deepEqual(
      chunks.map((chunk) => requiredStreamChunkKeys(chunk)),
      [
        ["content", "delta", "model"],
        ["content", "delta", "model"],
      ],
      providerName,
    );
    assert.deepEqual(
      chunks.map((chunk) => chunk.content),
      ["Hel", "lo"],
      providerName,
    );
    assert.deepEqual(
      chunks.map((chunk) => chunk.delta),
      ["Hel", "lo"],
      providerName,
    );
  }

  assert.equal(chunksByProvider.openai[1].finishReason, "stop");
  assert.equal(chunksByProvider.openrouter[1].finishReason, "stop");
});

test("getModels returns capability-tagged models across OpenAI, OpenRouter, and Ollama", async () => {
  const registry = createDefaultRegistry({
    openRouterFetch: createMockFetch([jsonResponse(openRouterModelsPayload())]),
    ollamaFetch: createMockFetch([
      jsonResponse({
        models: [
          { name: "llama3:latest", details: { family: "llama" } },
          { name: "nomic-embed-text:latest", details: { family: "nomic" } },
        ],
      }),
    ]),
  });

  const openAiModels = await registry.get("openai").getModels();
  const openRouterModels = await registry.get("openrouter").getModels();
  const ollamaModels = await registry.get("ollama").getModels();

  assert.equal(openAiModels.find((model) => model.id === "gpt-4o-mini").capabilities[CHAT], true);
  assert.equal(
    openAiModels.find((model) => model.id === "text-embedding-3-small").capabilities[EMBEDDINGS],
    true,
  );
  assert.equal(
    openRouterModels.find((model) => model.id === "openai/gpt-4o-mini").capabilities.chat,
    true,
  );
  assert.equal(
    openRouterModels.find((model) => model.id === "openai/text-embedding-3-small").capabilities
      .embeddings,
    true,
  );
  assert.equal(
    ollamaModels.find((model) => model.name === "llama3:latest").capabilities[CHAT],
    true,
  );
  assert.equal(
    ollamaModels.find((model) => model.name === "nomic-embed-text:latest").capabilities[EMBEDDINGS],
    true,
  );
});

test("Ollama can be routed before probing while supports reflects the last known health", async () => {
  const registry = createDefaultRegistry({
    ollamaFetch: createMockFetch([
      jsonResponse({ error: "not running" }, { status: 503 }),
      jsonResponse({
        models: [
          { name: "llama3:latest", details: { family: "llama" } },
          { name: "nomic-embed-text:latest", details: { family: "nomic" } },
        ],
      }),
    ]),
  });
  const ollama = registry.get("ollama");

  assert.equal(ollama.supports(CHAT), false);
  assert.equal(ollama.supports(EMBEDDINGS), false);
  assert.equal(ollama.canProvide(CHAT), true);
  assert.equal(ollama.canProvide(EMBEDDINGS), true);

  const down = await ollama.healthCheck();
  assert.equal(down.ok, false);
  assert.equal(ollama.supports(CHAT), false);
  assert.equal(ollama.canProvide(CHAT), true);
  assert.deepEqual(
    registry.getForCapability(CHAT).map((provider) => provider.name),
    ["openai", "openrouter", "ollama"],
  );

  const up = await ollama.healthCheck();
  assert.equal(up.ok, true);
  assert.equal(ollama.supports(CHAT), true);
  assert.equal(ollama.supports(EMBEDDINGS), true);
});

test("provider errors keep consistent ProviderError metadata", async () => {
  const cases = [
    {
      name: "openai",
      provider: createDefaultRegistry({
        openAiFetch: createMockFetch([
          jsonResponse({ error: { message: "bad key" } }, { status: 401 }),
        ]),
      }).get("openai"),
      request: chatRequest({ model: "gpt-4o-mini" }),
      code: "OPENAI_REQUEST_FAILED",
    },
    {
      name: "openrouter",
      provider: createDefaultRegistry({
        openRouterFetch: createMockFetch([
          jsonResponse({ error: { message: "bad key" } }, { status: 401 }),
        ]),
      }).get("openrouter"),
      request: chatRequest({ model: "openrouter/auto" }),
      code: "OPENROUTER_AUTH_FAILED",
    },
    {
      name: "ollama",
      provider: createDefaultRegistry({
        ollamaFetch: createMockFetch([jsonResponse({ models: [] })]),
      }).get("ollama"),
      request: chatRequest(),
      code: "MODEL_MISSING",
    },
  ];

  for (const item of cases) {
    await assert.rejects(
      () => consumeChat(item.provider.chat(item.request)),
      (error) =>
        error instanceof ProviderError && error.provider === item.name && error.code === item.code,
    );
  }
});

async function withProviderDb(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), "leena-provider-integration-"));
  const storePath = path.join(directory, "leena.db");
  try {
    await callback(storePath);
  } finally {
    closeDatabase(storePath);
    await rm(directory, { force: true, recursive: true });
  }
}

function createDefaultRegistry({
  storePath,
  openAiFetch = createMockFetch([]),
  openRouterFetch = createMockFetch([]),
  ollamaFetch = createMockFetch([]),
} = {}) {
  return registerDefaultProviders(new ProviderRegistry({ storePath }), {
    openai: { apiKey: openAiKey, fetchImpl: openAiFetch, retryOptions: testRetryOptions() },
    openrouter: { apiKey: openRouterKey, fetch: openRouterFetch, retryOptions: testRetryOptions() },
    ollama: { fetch: ollamaFetch },
  });
}

function routeProviders(registry, capability) {
  const defaultProvider = registry.getDefault(capability);
  const providers = registry.getForCapability(capability);
  if (!defaultProvider) {
    return providers;
  }
  return [defaultProvider, ...providers.filter((provider) => provider !== defaultProvider)];
}

async function chatWithFallback(registry, request = {}) {
  const providers = routeProviders(registry, CHAT);
  const failures = [];

  for (const provider of providers) {
    try {
      const response = await consumeChat(provider.chat(request));
      return { ...response, provider: provider.name, failures };
    } catch (error) {
      const providerError = unwrapProviderError(error);
      if (!request.fallback) {
        throw providerError;
      }
      failures.push({ provider: provider.name, code: providerError.code });
    }
  }

  throw new ProviderError("No chat provider succeeded.", {
    code: "PROVIDER_FALLBACK_EXHAUSTED",
    provider: failures.at(-1)?.provider,
  });
}

async function consumeChat(value) {
  const resolved = await value;
  if (isAsyncIterable(resolved)) {
    const chunks = await collectAsync(resolved);
    return {
      content: chunks.map((chunk) => chunk.content).join(""),
      model: chunks.at(-1)?.model,
      usage: chunks.find((chunk) => chunk.usage)?.usage,
    };
  }
  return resolved;
}

function unwrapProviderError(error) {
  if (error instanceof ProviderError) {
    return error;
  }
  if (error?.lastError instanceof ProviderError) {
    return error.lastError;
  }
  if (error?.cause instanceof ProviderError) {
    return error.cause;
  }
  return error;
}

function requiredChatResponseKeys(response) {
  return ["content", "model", "usage"].filter((key) => key in response);
}

function requiredStreamChunkKeys(chunk) {
  return ["content", "delta", "model"].filter((key) => key in chunk);
}

function chatRequest(overrides = {}) {
  return {
    messages: [{ role: "user", content: "Say hello" }],
    ...overrides,
  };
}

function openRouterModelsPayload() {
  return {
    data: [
      {
        id: "openai/gpt-4o-mini",
        name: "GPT-4o mini",
        context_length: 128000,
        architecture: {
          input_modalities: ["text"],
          output_modalities: ["text"],
          modality: "text->text",
        },
        supported_parameters: ["tools"],
      },
      {
        id: "openai/text-embedding-3-small",
        name: "Text Embedding 3 Small",
        context_length: 8191,
        architecture: {
          input_modalities: ["text"],
          output_modalities: ["embeddings"],
          modality: "text->embedding",
        },
        supported_parameters: [],
      },
    ],
  };
}

function createMockFetch(responses) {
  const queue = [...responses];
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const response = queue.shift();
    if (response instanceof Error) {
      throw response;
    }
    assert.ok(response, `Unexpected fetch call to ${url}`);
    return response;
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

function repeatedJsonResponses(count, payload, status) {
  return Array.from({ length: count }, () => jsonResponse(payload, { status }));
}

function sseResponse(events) {
  return new Response(events.map((event) => `${event}\n\n`).join(""), {
    headers: { "content-type": "text/event-stream" },
  });
}

function ndjsonResponse(items) {
  return new Response(items.map((item) => `${JSON.stringify(item)}\n`).join(""), {
    headers: { "content-type": "application/x-ndjson" },
  });
}

async function collectAsync(iterator) {
  const chunks = [];
  for await (const chunk of iterator) {
    chunks.push(chunk);
  }
  return chunks;
}

function isAsyncIterable(value) {
  return value && typeof value[Symbol.asyncIterator] === "function";
}

function testRetryOptions(overrides = {}) {
  return { maxAttempts: 1, baseDelay: 0, maxDelay: 0, jitter: false, ...overrides };
}
