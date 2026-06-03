import assert from "node:assert/strict";
import test from "node:test";
import { createOpenAIProvider, OpenAIProvider } from "../src/providers/openai-provider.js";
import { CHAT, EMBEDDINGS, REALTIME, STT, TTS } from "../src/providers/types.js";
import { ProviderError, RetryExhaustedError } from "../src/utils/errors.js";

const apiKey = "sk-test-openai-provider-1234567890";

test("declares all OpenAI provider capabilities", () => {
  const provider = createOpenAIProvider({ apiKey, fetchImpl: createMockFetch([]) });

  assert.equal(provider instanceof OpenAIProvider, true);
  assert.deepEqual(provider.capabilities, {
    [CHAT]: true,
    [EMBEDDINGS]: true,
    [REALTIME]: true,
    [TTS]: true,
    [STT]: true,
  });
});

test("chat posts OpenAI-compatible JSON and returns the assistant message", async () => {
  const fetchImpl = createMockFetch([
    jsonResponse({
      model: "gpt-4o-mini-2026-01-01",
      choices: [{ message: { role: "assistant", content: "Hello there." } }],
      usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 },
    }),
  ]);
  const provider = createOpenAIProvider({
    apiKey,
    orgId: "org-test",
    fetchImpl,
    retryOptions: testRetryOptions(),
  });

  const response = await provider.chat({
    messages: [{ role: "user", content: "Say hello" }],
    model: "gpt-4o-mini",
    temperature: 0.2,
    maxTokens: 64,
  });

  assert.equal(fetchImpl.calls.length, 1);
  const call = fetchImpl.calls[0];
  assert.equal(call.url, "https://api.openai.com/v1/chat/completions");
  assert.equal(call.init.method, "POST");
  assert.equal(call.init.headers.Authorization, `Bearer ${apiKey}`);
  assert.equal(call.init.headers["OpenAI-Organization"], "org-test");
  assert.equal(call.init.headers["Content-Type"], "application/json");
  assert.deepEqual(parseJsonBody(call), {
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Say hello" }],
    temperature: 0.2,
    max_tokens: 64,
  });
  assert.deepEqual(response, {
    role: "assistant",
    content: "Hello there.",
    model: "gpt-4o-mini-2026-01-01",
    usage: { promptTokens: 8, completionTokens: 3, totalTokens: 11 },
    raw: {
      model: "gpt-4o-mini-2026-01-01",
      choices: [{ message: { role: "assistant", content: "Hello there." } }],
      usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 },
    },
  });
});

test("chat supports messages plus options call shape", async () => {
  const fetchImpl = createMockFetch([
    jsonResponse({
      model: "gpt-4o-mini",
      choices: [{ message: { role: "assistant", content: "Compact shape works." } }],
    }),
  ]);
  const provider = createOpenAIProvider({ apiKey, fetchImpl, retryOptions: testRetryOptions() });

  const response = await provider.chat([{ role: "user", content: "Use compact shape" }], {
    model: "gpt-4o-mini",
  });

  assert.equal(response.content, "Compact shape works.");
  assert.deepEqual(parseJsonBody(fetchImpl.calls[0]).messages, [
    { role: "user", content: "Use compact shape" },
  ]);
});

test("chat streaming returns an async iterator of normalized delta chunks", async () => {
  const fetchImpl = createMockFetch([
    streamResponse([
      'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
      'data: {"model":"gpt-4o-mini","choices":[{"delta":{"content":"Hel"}}]}\n\n',
      'data: {"model":"gpt-4o-mini","choices":[{"delta":{"content":"lo"},"finish_reason":"stop"}]}\n\n',
      "data: [DONE]\n\n",
    ]),
  ]);
  const provider = createOpenAIProvider({ apiKey, fetchImpl, retryOptions: testRetryOptions() });

  const iterator = await provider.chat({
    messages: [{ role: "user", content: "Stream" }],
    model: "gpt-4o-mini",
    stream: true,
  });

  assert.deepEqual(await collectAsync(iterator), [
    {
      content: "Hel",
      delta: "Hel",
      model: "gpt-4o-mini",
      finishReason: undefined,
      usage: undefined,
    },
    {
      content: "lo",
      delta: "lo",
      model: "gpt-4o-mini",
      finishReason: "stop",
      usage: undefined,
    },
  ]);
  assert.equal(parseJsonBody(fetchImpl.calls[0]).stream, true);
});

test("chat streaming accumulates tool call deltas before yielding a tool call", async () => {
  const fetchImpl = createMockFetch([
    streamResponse([
      'data: {"model":"gpt-4o-mini","choices":[{"delta":{"tool_calls":[{"index":0,"id":"call-1","type":"function","function":{"name":"list_tasks","arguments":"{\\"status\\""}}]}}]}\n\n',
      'data: {"model":"gpt-4o-mini","choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":":\\"todo\\"}"}}]},"finish_reason":"tool_calls"}]}\n\n',
      "data: [DONE]\n\n",
    ]),
  ]);
  const provider = createOpenAIProvider({ apiKey, fetchImpl, retryOptions: testRetryOptions() });

  const iterator = await provider.chat({
    messages: [{ role: "user", content: "Use a tool" }],
    model: "gpt-4o-mini",
    stream: true,
    tools: [{ type: "function", function: { name: "list_tasks" } }],
  });

  assert.deepEqual(await collectAsync(iterator), [
    {
      content: "",
      delta: "",
      model: "gpt-4o-mini",
      finishReason: "tool_calls",
      usage: undefined,
      toolCalls: [
        {
          id: "call-1",
          type: "function",
          function: {
            name: "list_tasks",
            arguments: '{"status":"todo"}',
          },
        },
      ],
    },
  ]);
});

test("getModels returns tagged OpenAI model metadata for settings selectors", async () => {
  const provider = createOpenAIProvider({ apiKey, fetchImpl: createMockFetch([]) });

  const models = await provider.getModels();

  assert.deepEqual(
    models.map((model) => model.id),
    ["gpt-4o-mini", "text-embedding-3-small", "gpt-realtime-2", "tts-1", "gpt-4o-transcribe"],
  );
  assert.equal(models.find((model) => model.id === "gpt-4o-mini").capabilities[CHAT], true);
  assert.equal(
    models.find((model) => model.id === "text-embedding-3-small").capabilities[EMBEDDINGS],
    true,
  );
  assert.equal(models.find((model) => model.id === "gpt-realtime-2").capabilities[REALTIME], true);
  models[0].capabilities[EMBEDDINGS] = true;
  assert.equal((await provider.getModels())[0].capabilities[EMBEDDINGS], false);
});

test("embed posts single and batch inputs with the default embedding model", async () => {
  const fetchImpl = createMockFetch([
    jsonResponse({
      model: "text-embedding-3-small",
      data: [{ embedding: [0.1, 0.2] }],
      usage: { prompt_tokens: 2, total_tokens: 2 },
    }),
    jsonResponse({
      model: "text-embedding-3-small",
      data: [{ embedding: [0.3] }, { embedding: [0.4] }],
    }),
  ]);
  const provider = createOpenAIProvider({ apiKey, fetchImpl, retryOptions: testRetryOptions() });

  const single = await provider.embed("hello");
  const batch = await provider.embed(["hello", "world"]);

  assert.equal(fetchImpl.calls[0].url, "https://api.openai.com/v1/embeddings");
  assert.deepEqual(parseJsonBody(fetchImpl.calls[0]), {
    model: "text-embedding-3-small",
    input: "hello",
  });
  assert.deepEqual(single.embeddings, [[0.1, 0.2]]);
  assert.deepEqual(single.usage, { promptTokens: 2, totalTokens: 2 });
  assert.deepEqual(parseJsonBody(fetchImpl.calls[1]).input, ["hello", "world"]);
  assert.deepEqual(batch.embeddings, [[0.3], [0.4]]);
});

test("createRealtimeSession matches the current client secret session shape", async () => {
  const fetchImpl = createMockFetch([
    jsonResponse({ value: "rt-secret", expires_at: 1_800_000_000 }),
  ]);
  const provider = createOpenAIProvider({ apiKey, fetchImpl, retryOptions: testRetryOptions() });

  const session = await provider.createRealtimeSession({
    instructions: "Use the test profile.",
    tools: [{ type: "function", name: "test_tool", parameters: { type: "object" } }],
  });

  assert.equal(fetchImpl.calls[0].url, "https://api.openai.com/v1/realtime/client_secrets");
  const body = parseJsonBody(fetchImpl.calls[0]);
  assert.equal(body.session.type, "realtime");
  assert.equal(body.session.model, "gpt-realtime-2");
  assert.equal(body.session.instructions, "Use the test profile.");
  assert.deepEqual(body.session.output_modalities, ["audio"]);
  assert.deepEqual(body.session.audio.input.format, { type: "audio/pcm", rate: 24_000 });
  assert.deepEqual(body.session.audio.input.noise_reduction, { type: "near_field" });
  assert.deepEqual(body.session.audio.input.transcription, { model: "gpt-4o-transcribe" });
  assert.deepEqual(body.session.audio.input.turn_detection, {
    type: "semantic_vad",
    eagerness: "high",
    create_response: true,
    interrupt_response: true,
  });
  assert.deepEqual(body.session.audio.output, {
    format: { type: "audio/pcm", rate: 24_000 },
    voice: "marin",
    speed: 1.0,
  });
  assert.equal(body.session.max_output_tokens, 4096);
  assert.deepEqual(body.session.reasoning, { effort: "minimal" });
  assert.deepEqual(body.session.tools, [
    { type: "function", name: "test_tool", parameters: { type: "object" } },
  ]);
  assert.equal(body.session.tool_choice, "auto");
  assert.equal(body.session.tracing, "auto");
  assert.deepEqual(session, {
    value: "rt-secret",
    expiresAt: 1_800_000_000_000,
    raw: { value: "rt-secret", expires_at: 1_800_000_000 },
  });
});

test("speak posts speech options and returns a Buffer", async () => {
  const fetchImpl = createMockFetch([new Response(Buffer.from("audio-bytes"))]);
  const provider = createOpenAIProvider({ apiKey, fetchImpl, retryOptions: testRetryOptions() });

  const audio = await provider.speak("Read this", {
    model: "tts-1-hd",
    voice: "nova",
    responseFormat: "mp3",
    speed: 1.1,
  });

  assert.equal(fetchImpl.calls[0].url, "https://api.openai.com/v1/audio/speech");
  assert.deepEqual(parseJsonBody(fetchImpl.calls[0]), {
    model: "tts-1-hd",
    input: "Read this",
    voice: "nova",
    response_format: "mp3",
    speed: 1.1,
  });
  assert.equal(Buffer.isBuffer(audio), true);
  assert.equal(audio.toString("utf8"), "audio-bytes");
});

test("transcribe posts multipart form data and returns text", async () => {
  const fetchImpl = createMockFetch([jsonResponse({ text: "transcribed text" })]);
  const provider = createOpenAIProvider({ apiKey, fetchImpl, retryOptions: testRetryOptions() });
  const audio = Buffer.from("wav-data");

  const text = await provider.transcribe(audio, {
    model: "whisper-1",
    filename: "input.wav",
    language: "en",
    prompt: "Names: Leena",
    responseFormat: "json",
    temperature: 0,
  });

  const call = fetchImpl.calls[0];
  assert.equal(call.url, "https://api.openai.com/v1/audio/transcriptions");
  assert.equal(call.init.headers.Authorization, `Bearer ${apiKey}`);
  assert.equal(call.init.headers["Content-Type"], undefined);
  assert.equal(call.init.body instanceof FormData, true);
  assert.equal(call.init.body.get("model"), "whisper-1");
  assert.equal(call.init.body.get("language"), "en");
  assert.equal(call.init.body.get("prompt"), "Names: Leena");
  assert.equal(call.init.body.get("response_format"), "json");
  assert.equal(call.init.body.get("temperature"), "0");
  assert.equal(await call.init.body.get("file").text(), "wav-data");
  assert.equal(text, "transcribed text");
});

test("retries transient 429 and 5xx failures", async () => {
  const fetchImpl = createMockFetch([
    jsonResponse(
      { error: { message: "rate limited" } },
      { status: 429, headers: { "retry-after": "0" } },
    ),
    jsonResponse({
      model: "gpt-4o-mini",
      choices: [{ message: { role: "assistant", content: "retried" } }],
    }),
    jsonResponse({ error: { message: "server unavailable" } }, { status: 503 }),
    jsonResponse({ model: "text-embedding-3-small", data: [{ embedding: [1, 2, 3] }] }),
  ]);
  const provider = createOpenAIProvider({ apiKey, fetchImpl, retryOptions: testRetryOptions() });

  const chat = await provider.chat({ messages: [{ role: "user", content: "retry" }] });
  const embedding = await provider.embed("retry embedding");

  assert.equal(chat.content, "retried");
  assert.deepEqual(embedding.embeddings, [[1, 2, 3]]);
  assert.equal(fetchImpl.calls.length, 4);
});

test("wraps 401 responses in ProviderError without retrying", async () => {
  const fetchImpl = createMockFetch([
    jsonResponse({ error: { message: "unauthorized" } }, { status: 401 }),
  ]);
  const provider = createOpenAIProvider({ apiKey, fetchImpl, retryOptions: testRetryOptions() });

  await assert.rejects(
    () => provider.chat({ messages: [{ role: "user", content: "fail" }], model: "gpt-4o-mini" }),
    (error) =>
      error instanceof ProviderError &&
      error.code === "OPENAI_REQUEST_FAILED" &&
      error.provider === "openai" &&
      error.model === "gpt-4o-mini" &&
      error.cause instanceof RetryExhaustedError &&
      error.cause.lastError.status === 401,
  );
  assert.equal(fetchImpl.calls.length, 1);
});

test("wraps retried network failures in ProviderError", async () => {
  const fetchImpl = createMockFetch([new TypeError("fetch failed"), new TypeError("fetch failed")]);
  const provider = createOpenAIProvider({
    apiKey,
    fetchImpl,
    retryOptions: testRetryOptions({ maxAttempts: 2 }),
  });

  await assert.rejects(
    () => provider.embed({ input: "network fail", model: "text-embedding-3-small" }),
    (error) =>
      error instanceof ProviderError &&
      error.code === "OPENAI_REQUEST_FAILED" &&
      error.provider === "openai" &&
      error.model === "text-embedding-3-small" &&
      error.cause instanceof RetryExhaustedError &&
      error.cause.lastError instanceof TypeError,
  );
  assert.equal(fetchImpl.calls.length, 2);
});

function createMockFetch(responses) {
  const queue = [...responses];
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const response = queue.shift();
    if (response instanceof Error) {
      throw response;
    }
    if (typeof response === "function") {
      return response(url, init);
    }
    assert.ok(response, `Unexpected fetch call to ${url}`);
    return response;
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function streamResponse(chunks) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
    {
      headers: { "Content-Type": "text/event-stream" },
    },
  );
}

function parseJsonBody(call) {
  return JSON.parse(call.init.body);
}

async function collectAsync(iterator) {
  const chunks = [];
  for await (const chunk of iterator) {
    chunks.push(chunk);
  }
  return chunks;
}

function testRetryOptions(overrides = {}) {
  return {
    baseDelay: 0,
    jitter: false,
    ...overrides,
  };
}
