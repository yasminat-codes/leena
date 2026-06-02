import assert from "node:assert/strict";
import test from "node:test";
import { createOllamaProvider } from "../src/providers/ollama-provider.js";
import { CHAT, EMBEDDINGS, STT, TTS } from "../src/providers/types.js";
import { ProviderError } from "../src/utils/errors.js";

test("chat converts Ollama NDJSON chunks to unified delta events", async () => {
  const calls = [];
  const provider = createOllamaProvider({
    fetch: async (url, options) => {
      calls.push({ url, options });
      assert.equal(url, "http://localhost:11434/api/chat");
      assert.equal(options.method, "POST");
      assert.deepEqual(JSON.parse(options.body), {
        model: "llama3",
        messages: [{ role: "user", content: "Say hello" }],
        stream: true,
        options: {},
      });
      return ndjsonResponse([
        { message: { content: "Hel" }, done: false },
        { message: { content: "lo" }, done: false },
        { done: true },
      ]);
    },
  });

  const chunks = [];
  for await (const chunk of provider.chat({
    model: "llama3",
    messages: [{ role: "user", content: "Say hello" }],
  })) {
    chunks.push(chunk);
  }

  assert.equal(calls.length, 1);
  assert.deepEqual(chunks, [
    { content: "Hel", delta: "Hel", model: "llama3" },
    { content: "lo", delta: "lo", model: "llama3" },
  ]);
});

test("healthCheck reports running Ollama with models and updates capabilities", async () => {
  const provider = createOllamaProvider({
    fetch: async () =>
      jsonResponse({
        models: [
          { name: "llama3:latest", details: { family: "llama" } },
          { name: "nomic-embed-text:latest", details: { family: "nomic" } },
        ],
      }),
  });

  const result = await provider.healthCheck();

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.models.map((model) => model.name),
    ["llama3:latest", "nomic-embed-text:latest"],
  );
  assert.equal(provider.supports(CHAT), true);
  assert.equal(provider.supports(EMBEDDINGS), true);
});

test("healthCheck reports running Ollama with no models", async () => {
  const provider = createOllamaProvider({
    fetch: async () => jsonResponse({ models: [] }),
  });

  const result = await provider.healthCheck();

  assert.deepEqual(result, { ok: true, models: [] });
  assert.equal(provider.supports(CHAT), false);
  assert.equal(provider.supports(EMBEDDINGS), false);
});

test("healthCheck handles ECONNREFUSED without throwing", async () => {
  const refused = new TypeError("fetch failed", {
    cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
  });
  const provider = createOllamaProvider({
    fetch: async () => {
      throw refused;
    },
  });

  const result = await provider.healthCheck();

  assert.deepEqual(result, {
    ok: false,
    models: [],
    error: "Ollama not running",
    code: "ECONNREFUSED",
  });
  assert.equal(provider.supports(CHAT), false);
});

test("healthCheck handles timeout without throwing", async () => {
  const provider = createOllamaProvider({
    healthTimeoutMs: 1,
    fetch: (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      }),
  });

  const result = await provider.healthCheck();

  assert.deepEqual(result, {
    ok: false,
    models: [],
    error: "Ollama timeout",
    code: "ETIMEDOUT",
  });
});

test("embed batches single Ollama embedding requests sequentially", async () => {
  const prompts = [];
  const provider = createOllamaProvider({
    fetch: async (url, options) => {
      assert.equal(url, "http://localhost:11434/api/embeddings");
      const body = JSON.parse(options.body);
      prompts.push(body.prompt);
      assert.equal(body.model, "nomic-embed-text");
      return jsonResponse({ embedding: [prompts.length, prompts.length + 0.5] });
    },
  });

  const result = await provider.embed({ input: ["alpha", "beta"] });

  assert.deepEqual(prompts, ["alpha", "beta"]);
  assert.deepEqual(result, {
    model: "nomic-embed-text",
    embeddings: [
      [1, 1.5],
      [2, 2.5],
    ],
  });
});

test("getModels tags executable chat and embedding capabilities and caches results", async () => {
  let calls = 0;
  const provider = createOllamaProvider({
    fetch: async () => {
      calls += 1;
      return jsonResponse({
        models: [
          { name: "llama3:latest", details: { family: "llama" } },
          { name: "phi3:latest", details: { family: "phi" } },
          { name: "nomic-embed-text:latest", details: { family: "nomic" } },
          { name: "outetts:latest" },
          { name: "whisper:latest" },
        ],
      });
    },
  });

  const models = await provider.getModels();
  const cached = await provider.getModels();

  assert.equal(calls, 1);
  assert.deepEqual(
    cached.map((model) => model.name),
    models.map((model) => model.name),
  );
  assert.equal(findModel(models, "llama3:latest").capabilities[CHAT], true);
  assert.equal(findModel(models, "phi3:latest").capabilities[CHAT], true);
  assert.equal(findModel(models, "nomic-embed-text:latest").capabilities[EMBEDDINGS], true);
  assert.equal(findModel(models, "nomic-embed-text:latest").capabilities[CHAT], false);
  assert.equal(findModel(models, "outetts:latest").capabilities[TTS], false);
  assert.equal(findModel(models, "whisper:latest").capabilities[STT], false);
  assert.equal(provider.supports(CHAT), true);
  assert.equal(provider.supports(EMBEDDINGS), true);
  assert.equal(provider.supports(TTS), false);
  assert.equal(provider.supports(STT), false);
  assert.deepEqual(provider.models[CHAT], ["llama3:latest", "phi3:latest"]);
});

test("speak and transcribe throw MODEL_MISSING when local speech models are absent", async () => {
  let calls = 0;
  const provider = createOllamaProvider({
    fetch: async () => {
      calls += 1;
      return jsonResponse({ models: [{ name: "llama3:latest" }] });
    },
  });

  await assert.rejects(
    () => provider.speak("hello"),
    (error) =>
      error instanceof ProviderError &&
      error.code === "MODEL_MISSING" &&
      error.provider === "ollama",
  );
  await assert.rejects(
    () => provider.transcribe(Buffer.from("audio")),
    (error) =>
      error instanceof ProviderError &&
      error.code === "MODEL_MISSING" &&
      error.provider === "ollama",
  );
  assert.equal(calls, 1);
});

test("unreachable Ollama keeps all capabilities false", async () => {
  const provider = createOllamaProvider({
    fetch: async () => {
      throw new TypeError("fetch failed", {
        cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
      });
    },
  });

  assert.equal(provider.supports(CHAT), false);
  assert.equal(provider.supports(EMBEDDINGS), false);
  const result = await provider.healthCheck();
  assert.equal(result.ok, false);
  assert.equal(provider.supports(CHAT), false);
  assert.equal(provider.supports(EMBEDDINGS), false);
});

test("dynamic Ollama capabilities remain registry candidates before health probe", () => {
  const provider = createOllamaProvider({
    fetch: async () => jsonResponse({ models: [] }),
  });

  assert.equal(provider.supports(CHAT), false);
  assert.equal(provider.supports(EMBEDDINGS), false);
  assert.equal(provider.canProvide(CHAT), true);
  assert.equal(provider.canProvide(EMBEDDINGS), true);
  assert.equal(provider.canProvide(TTS), false);
  assert.equal(provider.canProvide(STT), false);
});

test("getModels retries transient errors before returning models", async () => {
  let calls = 0;
  const provider = createOllamaProvider({
    fetch: async () => {
      calls += 1;
      if (calls === 1) {
        throw Object.assign(new Error("socket reset"), { code: "ECONNRESET" });
      }
      return jsonResponse({ models: [{ name: "mistral:latest" }] });
    },
  });

  const models = await provider.getModels();

  assert.equal(calls, 2);
  assert.deepEqual(
    models.map((model) => model.name),
    ["mistral:latest"],
  );
});

test("chat MODEL_MISSING is raised before an Ollama chat request is retried", async () => {
  const urls = [];
  const provider = createOllamaProvider({
    fetch: async (url) => {
      urls.push(url);
      return jsonResponse({ models: [] });
    },
  });

  await assert.rejects(
    async () => {
      for await (const _chunk of provider.chat({ messages: [{ role: "user", content: "hi" }] })) {
        // no chunks expected
      }
    },
    (error) => error instanceof ProviderError && error.code === "MODEL_MISSING",
  );

  assert.deepEqual(urls, ["http://localhost:11434/api/tags"]);
});

test("pullModel reports progress and resolves chat and embedding model pulls independently", async () => {
  const requestedModels = [];
  const provider = createOllamaProvider({
    fetch: async (url, options) => {
      assert.equal(url, "http://localhost:11434/api/pull");
      const body = JSON.parse(options.body);
      requestedModels.push(body.name);
      return ndjsonResponse([
        { status: "pulling manifest" },
        { status: "downloading", completed: 25, total: 100 },
        { status: "downloading", completed: 100, total: 100 },
        { status: "success" },
      ]);
    },
  });
  const chatProgress = [];
  const embeddingProgress = [];

  assert.deepEqual(await provider.pullModel("llama3", (progress) => chatProgress.push(progress)), {
    ok: true,
    model: "llama3",
  });
  assert.deepEqual(
    await provider.pullModel("nomic-embed-text", (progress) => embeddingProgress.push(progress)),
    { ok: true, model: "nomic-embed-text" },
  );

  assert.deepEqual(requestedModels, ["llama3", "nomic-embed-text"]);
  assert.deepEqual(chatProgress, [
    { status: "pulling manifest", pct: undefined },
    { status: "downloading", pct: 25 },
    { status: "downloading", pct: 100 },
    { status: "success", pct: 100 },
  ]);
  assert.deepEqual(embeddingProgress, chatProgress);
});

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function ndjsonResponse(items, init = {}) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const item of items) {
        controller.enqueue(encoder.encode(`${JSON.stringify(item)}\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "application/x-ndjson" },
    ...init,
  });
}

function findModel(models, name) {
  return models.find((model) => model.name === name);
}
