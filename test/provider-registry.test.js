import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { BaseProvider } from "../src/providers/base-provider.js";
import { getRegistry, ProviderRegistry } from "../src/providers/index.js";
import {
  loadOllamaBaseUrl,
  loadProviderApiKey,
  loadProviderDefault,
  saveOllamaBaseUrl,
  saveProviderApiKey,
} from "../src/providers/provider-settings.js";
import { CHAT, EMBEDDINGS, REALTIME, STT, TTS } from "../src/providers/types.js";
import { closeDatabase } from "../src/realtime/tools/database.js";
import { ProviderError } from "../src/utils/errors.js";

async function withProviderDb(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), "brah-provider-"));
  const filePath = path.join(directory, "brah.db");
  try {
    await callback(filePath);
  } finally {
    closeDatabase(filePath);
    await rm(directory, { force: true, recursive: true });
  }
}

function createProvider(overrides = {}) {
  return new BaseProvider({
    name: "mock",
    displayName: "Mock Provider",
    capabilities: {
      [CHAT]: true,
      [EMBEDDINGS]: false,
    },
    models: {
      [CHAT]: ["mock-chat"],
    },
    ...overrides,
  });
}

test("registers and retrieves a mock provider by name", () => {
  const registry = new ProviderRegistry();
  const provider = createProvider();

  assert.equal(registry.register(provider), provider);
  assert.equal(registry.get("mock"), provider);
});

test("rejects provider registrations that do not extend BaseProvider", () => {
  const registry = new ProviderRegistry();

  assert.throws(
    () => registry.register({ name: "plain-object", capabilities: { [CHAT]: true } }),
    (error) => error instanceof ProviderError && error.code === "INVALID_PROVIDER",
  );
});

test("getForCapability returns only providers with that capability", () => {
  const registry = new ProviderRegistry();
  const chatProvider = createProvider({ name: "chat", capabilities: { [CHAT]: true } });
  const embeddingProvider = createProvider({
    name: "embedding",
    capabilities: { [CHAT]: false, [EMBEDDINGS]: true },
  });
  registry.register(chatProvider);
  registry.register(embeddingProvider);

  assert.deepEqual(registry.getForCapability(CHAT), [chatProvider]);
  assert.deepEqual(registry.getForCapability(EMBEDDINGS), [embeddingProvider]);
});

test("unknown provider lookup throws ProviderError", () => {
  const registry = new ProviderRegistry();

  assert.throws(
    () => registry.get("missing"),
    (error) =>
      error instanceof ProviderError &&
      error.code === "PROVIDER_NOT_FOUND" &&
      error.provider === "missing",
  );
});

test("BaseProvider abstract methods throw NOT_IMPLEMENTED ProviderError", async () => {
  const provider = createProvider({ name: "abstract" });

  await assert.rejects(
    () => provider.chat({ model: "mock-chat", messages: [] }),
    (error) =>
      error instanceof ProviderError &&
      error.code === "NOT_IMPLEMENTED" &&
      error.provider === "abstract" &&
      error.model === "mock-chat",
  );
  await assert.rejects(
    () => provider.embed({ model: "mock-embedding", input: "hello" }),
    (error) =>
      error instanceof ProviderError &&
      error.code === "NOT_IMPLEMENTED" &&
      error.model === "mock-embedding",
  );
  await assert.rejects(
    () => provider.speak("hello", { model: "voice" }),
    (error) => error instanceof ProviderError && error.code === "NOT_IMPLEMENTED",
  );
  await assert.rejects(
    () => provider.transcribe(Buffer.from("audio"), { model: "whisper" }),
    (error) => error instanceof ProviderError && error.code === "NOT_IMPLEMENTED",
  );
  assert.throws(
    () => provider.createRealtimeSession({ model: "realtime" }),
    (error) =>
      error instanceof ProviderError &&
      error.code === "NOT_IMPLEMENTED" &&
      error.model === "realtime",
  );
});

test("list returns provider summaries without exposing mutable capability objects", () => {
  const registry = new ProviderRegistry();
  const provider = createProvider({
    name: "mock-a",
    displayName: "Mock A",
    capabilities: { [CHAT]: true, [TTS]: true },
  });
  registry.register(provider);

  const summaries = registry.list();

  assert.deepEqual(summaries, [
    {
      name: "mock-a",
      displayName: "Mock A",
      capabilities: { [CHAT]: true, [TTS]: true },
    },
  ]);
  summaries[0].capabilities[STT] = true;
  assert.equal(provider.supports(STT), false);
});

test("setDefault and getDefault round-trip through the settings store", async () => {
  await withProviderDb((filePath) => {
    const registry = new ProviderRegistry({ storePath: filePath });
    const provider = createProvider({ name: "mock-default", capabilities: { [CHAT]: true } });
    registry.register(provider);

    assert.equal(registry.setDefault(CHAT, "mock-default"), provider);
    closeDatabase(filePath);

    const reloadedRegistry = new ProviderRegistry({ storePath: filePath });
    reloadedRegistry.register(provider);
    assert.equal(loadProviderDefault(CHAT, filePath), "mock-default");
    assert.equal(reloadedRegistry.getDefault(CHAT), provider);
  });
});

test("getDefault falls back to first registered capable provider", async () => {
  await withProviderDb((filePath) => {
    const registry = new ProviderRegistry({ storePath: filePath });
    const chatProvider = createProvider({ name: "chat", capabilities: { [CHAT]: true } });
    const realtimeProvider = createProvider({
      name: "realtime",
      capabilities: { [REALTIME]: true },
    });
    registry.register(chatProvider);
    registry.register(realtimeProvider);

    assert.equal(registry.getDefault(CHAT), chatProvider);
    assert.equal(registry.getDefault(REALTIME), realtimeProvider);
    assert.equal(registry.getDefault(TTS), null);
  });
});

test("setDefault rejects a provider that does not support the capability", async () => {
  await withProviderDb((filePath) => {
    const registry = new ProviderRegistry({ storePath: filePath });
    registry.register(createProvider({ name: "chat-only", capabilities: { [CHAT]: true } }));

    assert.throws(
      () => registry.setDefault(EMBEDDINGS, "chat-only"),
      (error) =>
        error instanceof ProviderError &&
        error.code === "CAPABILITY_NOT_SUPPORTED" &&
        error.provider === "chat-only",
    );
    assert.equal(loadProviderDefault(EMBEDDINGS, filePath), null);
  });
});

test("provider settings round-trip API keys and Ollama base URL", async () => {
  await withProviderDb((filePath) => {
    assert.equal(saveProviderApiKey("openai", "  sk-openai  ", filePath), "sk-openai");
    assert.equal(saveProviderApiKey("openrouter", "  sk-openrouter  ", filePath), "sk-openrouter");
    assert.equal(
      saveOllamaBaseUrl("  http://127.0.0.1:11434  ", filePath),
      "http://127.0.0.1:11434",
    );
    closeDatabase(filePath);

    assert.equal(loadProviderApiKey("openai", filePath), "sk-openai");
    assert.equal(loadProviderApiKey("openrouter", filePath), "sk-openrouter");
    assert.equal(loadOllamaBaseUrl(filePath), "http://127.0.0.1:11434");

    assert.equal(saveProviderApiKey("openai", "", filePath), null);
    assert.equal(loadProviderApiKey("openai", filePath), null);
  });
});

test("getRegistry returns a singleton ProviderRegistry instance", () => {
  assert.equal(getRegistry(), getRegistry());
  assert.ok(getRegistry() instanceof ProviderRegistry);
});
