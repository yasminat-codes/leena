import assert from "node:assert/strict";
import test from "node:test";
import {
  createOpenRouterProvider,
  OpenRouterProvider,
} from "../src/providers/openrouter-provider.js";
import { CHAT, EMBEDDINGS, REALTIME, STT, TTS } from "../src/providers/types.js";
import { ProviderError } from "../src/utils/errors.js";

function createProvider(fetch, overrides = {}) {
  return createOpenRouterProvider({
    apiKey: "or-test-key",
    fetch,
    retryOptions: {
      baseDelay: 0,
      jitter: false,
    },
    ...overrides,
  });
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

function streamResponse(text) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(text));
        controller.close();
      },
    }),
    {
      headers: {
        "content-type": "text/event-stream",
      },
    },
  );
}

function modelsPayload() {
  return {
    data: [
      {
        id: "openai/gpt-4o-mini",
        name: "GPT-4o mini",
        context_length: 128000,
        pricing: {
          prompt: "0.00000015",
          completion: "0.0000006",
          request: "0",
        },
        architecture: {
          input_modalities: ["text"],
          output_modalities: ["text"],
          modality: "text->text",
        },
        supported_parameters: ["temperature", "max_tokens", "tools"],
        top_provider: {
          context_length: 128000,
          max_completion_tokens: 16384,
        },
      },
      {
        id: "openai/text-embedding-3-small",
        name: "Text Embedding 3 Small",
        context_length: 8191,
        pricing: {
          prompt: "0.00000002",
        },
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

test("OpenRouterProvider declares chat and embedding capabilities", () => {
  const provider = createProvider(async () => jsonResponse({}));

  assert.ok(provider instanceof OpenRouterProvider);
  assert.equal(provider.supports(CHAT), true);
  assert.equal(provider.supports(EMBEDDINGS), true);
  assert.equal(provider.supports(REALTIME), false);
  assert.equal(provider.supports(TTS), false);
  assert.equal(provider.supports(STT), false);
});

test("chat sends required OpenRouter headers and normalizes non-streaming response", async () => {
  const calls = [];
  const provider = createProvider(
    async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({
        model: "anthropic/claude-3.5-sonnet",
        choices: [
          {
            message: {
              content: "Ready.",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 8,
          completion_tokens: 2,
          total_tokens: 10,
        },
      });
    },
    {
      siteUrl: "https://example.test",
      siteName: "Leena Test",
    },
  );

  const response = await provider.chat({
    model: "anthropic/claude-3.5-sonnet",
    messages: [{ role: "user", content: "Ping" }],
    temperature: 0.2,
    maxTokens: 40,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.Authorization, "Bearer or-test-key");
  assert.equal(calls[0].options.headers["HTTP-Referer"], "https://example.test");
  assert.equal(calls[0].options.headers["X-Title"], "Leena Test");
  assert.equal(calls[0].options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    model: "anthropic/claude-3.5-sonnet",
    messages: [{ role: "user", content: "Ping" }],
    stream: false,
    temperature: 0.2,
    max_tokens: 40,
  });
  assert.deepEqual(response, {
    content: "Ready.",
    model: "anthropic/claude-3.5-sonnet",
    usage: {
      promptTokens: 8,
      completionTokens: 2,
      totalTokens: 10,
    },
    finishReason: "stop",
  });
});

test("streaming chat yields normalized SSE delta chunks and ignores comments", async () => {
  const provider = createProvider(async (_url, options) => {
    assert.equal(options.headers.Accept, "text/event-stream");
    assert.equal(JSON.parse(options.body).stream, true);
    return streamResponse(
      [
        ": openrouter processing comment",
        "",
        'data: {"model":"openrouter/auto","choices":[{"delta":{"content":"Hel"}}]}',
        "",
        'data: {"model":"openrouter/auto","choices":[{"delta":{"content":"lo"},"finish_reason":"stop"}]}',
        "",
        "data: [DONE]",
        "",
      ].join("\n"),
    );
  });

  const stream = await provider.chat({
    messages: [{ role: "user", content: "Say hello" }],
    stream: true,
  });

  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  assert.deepEqual(
    chunks.map((chunk) => chunk.delta),
    ["Hel", "lo"],
  );
  assert.deepEqual(
    chunks.map((chunk) => chunk.content),
    ["Hel", "lo"],
  );
  assert.equal(chunks[1].finishReason, "stop");
});

test("getModels caches chat and embedding-capable models for one hour", async () => {
  let calls = 0;
  let currentTime = 1_000;
  const provider = createProvider(
    async () => {
      calls += 1;
      return jsonResponse(modelsPayload());
    },
    {
      now: () => currentTime,
    },
  );

  const first = await provider.getModels();
  const second = await provider.getModels();
  currentTime += 60 * 60 * 1000 + 1;
  const third = await provider.getModels();

  assert.equal(calls, 2);
  assert.equal(first, second);
  assert.notEqual(first, third);
  assert.deepEqual(first, [
    {
      id: "openai/gpt-4o-mini",
      name: "GPT-4o mini",
      pricing: {
        prompt: "0.00000015",
        completion: "0.0000006",
        request: "0",
      },
      contextLength: 128000,
      maxCompletionTokens: 16384,
      capabilities: {
        chat: true,
        embeddings: false,
        tools: true,
        vision: false,
      },
      inputModalities: ["text"],
      outputModalities: ["text"],
      supportedParameters: ["temperature", "max_tokens", "tools"],
    },
    {
      id: "openai/text-embedding-3-small",
      name: "Text Embedding 3 Small",
      pricing: {
        prompt: "0.00000002",
      },
      contextLength: 8191,
      maxCompletionTokens: null,
      capabilities: {
        chat: false,
        embeddings: true,
        tools: false,
        vision: false,
      },
      inputModalities: ["text"],
      outputModalities: ["embeddings"],
      supportedParameters: [],
    },
  ]);
});

test("testConnection returns structured ok and error results", async () => {
  const okProvider = createProvider(async () => jsonResponse(modelsPayload()));
  const failedProvider = createProvider(async () =>
    jsonResponse(
      {
        error: {
          message: "invalid key",
        },
      },
      { status: 401 },
    ),
  );

  assert.deepEqual(await okProvider.testConnection(), {
    ok: true,
    modelCount: 2,
  });

  const result = await failedProvider.testConnection();
  assert.equal(result.ok, false);
  assert.equal(result.code, "OPENROUTER_AUTH_FAILED");
  assert.match(result.error, /invalid key/);
});

test("embed posts to OpenRouter embeddings endpoint and normalizes vectors", async () => {
  const calls = [];
  const provider = createProvider(async (url, options) => {
    calls.push({ url, options });
    return jsonResponse({
      model: "qwen/qwen3-embedding-0.6b",
      data: [
        {
          embedding: [0.1, 0.2],
        },
        {
          embedding: [0.3, 0.4],
        },
      ],
      usage: {
        prompt_tokens: 12,
        total_tokens: 12,
      },
    });
  });

  const result = await provider.embed({
    input: ["alpha", "beta"],
  });

  assert.equal(calls[0].url, "https://openrouter.ai/api/v1/embeddings");
  assert.equal(calls[0].options.headers["HTTP-Referer"], "https://leena.app");
  assert.equal(calls[0].options.headers["X-Title"], "Leena");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    model: "qwen/qwen3-embedding-0.6b",
    input: ["alpha", "beta"],
  });
  assert.deepEqual(result, {
    embeddings: [
      [0.1, 0.2],
      [0.3, 0.4],
    ],
    model: "qwen/qwen3-embedding-0.6b",
    usage: {
      promptTokens: 12,
      completionTokens: undefined,
      totalTokens: 12,
    },
  });
});

test("401 and 402 responses throw ProviderError without retrying", async () => {
  for (const { status, code } of [
    { status: 401, code: "OPENROUTER_AUTH_FAILED" },
    { status: 402, code: "OPENROUTER_INSUFFICIENT_CREDITS" },
  ]) {
    let calls = 0;
    const provider = createProvider(async () => {
      calls += 1;
      return jsonResponse(
        {
          error: {
            message: status === 401 ? "bad api key" : "insufficient credits",
          },
        },
        { status },
      );
    });

    await assert.rejects(
      () =>
        provider.chat({
          messages: [{ role: "user", content: "Ping" }],
        }),
      (error) => {
        assert.ok(error instanceof ProviderError);
        assert.equal(error.code, code);
        assert.equal(error.status, status);
        return true;
      },
    );
    assert.equal(calls, 1);
  }
});

test("429 and 5xx responses are retried before succeeding", async () => {
  const statuses = [429, 500];
  const provider = createProvider(async () => {
    const status = statuses.shift();
    if (status) {
      return jsonResponse(
        {
          error: {
            message: `temporary ${status}`,
          },
        },
        { status },
      );
    }
    return jsonResponse(modelsPayload());
  });

  const models = await provider.getModels();

  assert.equal(models.length, 2);
  assert.equal(
    models.find((model) => model.id === "openai/text-embedding-3-small").capabilities.embeddings,
    true,
  );
  assert.equal(statuses.length, 0);
});

test("getModelInfo returns pricing, context, and capabilities for cached models", async () => {
  const provider = createProvider(async () => jsonResponse(modelsPayload()));

  assert.deepEqual(await provider.getModelInfo("openai/gpt-4o-mini"), {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o mini",
    pricing: {
      prompt: "0.00000015",
      completion: "0.0000006",
      request: "0",
    },
    contextLength: 128000,
    capabilities: {
      chat: true,
      embeddings: false,
      tools: true,
      vision: false,
    },
  });
  assert.equal(await provider.getModelInfo("missing/model"), null);
});
