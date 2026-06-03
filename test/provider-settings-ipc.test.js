import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createProviderIpcHandlers,
  createSafeStorageSecretCodec,
  getProviderDefaultModelSettingKey,
  PROVIDER_IPC_CHANNELS,
  registerProviderHandlers,
} from "../src/ipc/provider-handlers.js";
import { BaseProvider } from "../src/providers/base-provider.js";
import { ProviderRegistry } from "../src/providers/index.js";
import { COMPOSIO_CREDENTIAL_KEY } from "../src/providers/provider-settings.js";
import { CHAT, EMBEDDINGS, STT, TTS } from "../src/providers/types.js";
import { closeDatabase, getDatabase } from "../src/realtime/tools/database.js";
import { ProviderError } from "../src/utils/errors.js";

async function withProviderDb(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), "leena-provider-ipc-"));
  const filePath = path.join(directory, "lena.db");
  try {
    await callback(filePath);
  } finally {
    closeDatabase(filePath);
    await rm(directory, { force: true, recursive: true });
  }
}

function createRegistry() {
  const registry = new ProviderRegistry();
  registry.register(
    new TestProvider({
      name: "openai",
      displayName: "OpenAI",
      capabilities: {
        [CHAT]: true,
        [EMBEDDINGS]: true,
        [TTS]: true,
        [STT]: true,
      },
      models: {
        [CHAT]: ["gpt-4o-mini"],
        [EMBEDDINGS]: ["text-embedding-3-small"],
      },
    }),
  );
  registry.register(
    new TestProvider({
      name: "openrouter",
      displayName: "OpenRouter",
      capabilities: {
        [CHAT]: true,
        [EMBEDDINGS]: true,
      },
      models: {
        [CHAT]: ["openrouter/auto"],
      },
    }),
  );
  registry.register(
    new TestProvider({
      name: "ollama",
      displayName: "Ollama",
      capabilities: {
        [CHAT]: true,
        [EMBEDDINGS]: true,
      },
      models: {
        [CHAT]: ["llama3"],
        [EMBEDDINGS]: ["nomic-embed-text"],
      },
      baseUrl: "http://127.0.0.1:11434",
    }),
  );
  return registry;
}

class TestProvider extends BaseProvider {
  constructor(options = {}) {
    super(options);
    this.apiKey = options.apiKey ?? "";
    this.baseUrl = options.baseUrl;
    this.connectionResult = options.connectionResult ?? { ok: true, modelCount: 1 };
    this.modelList = options.modelList ?? [];
  }

  async testConnection() {
    return this.connectionResult;
  }

  async getModels() {
    if (this.modelList instanceof Error) {
      throw this.modelList;
    }
    return this.modelList;
  }
}

function createFakeSafeStorage() {
  return {
    encryptedValues: [],
    isEncryptionAvailable() {
      return true;
    },
    encryptString(value) {
      this.encryptedValues.push(value);
      return Buffer.from(`sealed:${value}`, "utf8");
    },
    decryptString(payload) {
      return payload.toString("utf8").replace(/^sealed:/, "");
    },
  };
}

function createHandlers(options = {}) {
  const safeStorage = options.safeStorage ?? createFakeSafeStorage();
  const registry = options.registry ?? createRegistry();
  const reconfigured = [];
  const handlers = createProviderIpcHandlers({
    registry,
    storePath: options.storePath,
    secretCodec: createSafeStorageSecretCodec(safeStorage),
    timeoutMs: options.timeoutMs,
    now: options.now,
    reconfigureProvider(providerName, runtimeConfig, { previousProvider }) {
      previousProvider.apiKey = runtimeConfig.apiKey;
      previousProvider.baseUrl = runtimeConfig.baseUrl;
      previousProvider.defaultModels = runtimeConfig.defaultModels;
      reconfigured.push({ providerName, runtimeConfig });
      return previousProvider;
    },
  });
  return { handlers, registry, safeStorage, reconfigured };
}

function readStoredSetting(filePath, key) {
  const row = getDatabase(filePath).prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row?.value ?? null;
}

test("registerProviderHandlers wires all provider IPC channels", () => {
  const registered = new Map();
  const ipcMain = {
    handle(channel, handler) {
      registered.set(channel, handler);
    },
  };

  registerProviderHandlers(ipcMain, { registry: createRegistry() });

  assert.deepEqual([...registered.keys()], Object.values(PROVIDER_IPC_CHANNELS));
  for (const handler of registered.values()) {
    assert.equal(typeof handler, "function");
  }
});

test("get-config redacts API keys and set-config stores encrypted secrets", async () => {
  await withProviderDb(async (filePath) => {
    const openaiKey = "sk-openai-secret-1234567890";
    const { handlers, safeStorage, reconfigured } = createHandlers({ storePath: filePath });

    const saved = await handlers.setConfig(null, "openai", {
      apiKey: openaiKey,
      baseUrl: "https://api.openai.test/v1",
      defaultModels: {
        [CHAT]: "gpt-4o",
        [EMBEDDINGS]: "text-embedding-3-large",
      },
    });

    assert.deepEqual(safeStorage.encryptedValues, [openaiKey]);
    assert.equal(saved.ok, true);
    assert.equal(saved.configured, true);
    assert.equal(reconfigured[0].providerName, "openai");
    assert.equal(reconfigured[0].runtimeConfig.apiKey, openaiKey);

    const storedApiKey = readStoredSetting(filePath, "provider:apikey:openai");
    assert.equal(storedApiKey.includes(openaiKey), false);
    assert.equal(
      readStoredSetting(filePath, getProviderDefaultModelSettingKey("openai", CHAT)),
      JSON.stringify("gpt-4o"),
    );

    const config = await handlers.getConfig(null, "openai");
    assert.equal(config.apiKey, "[REDACTED]7890");
    assert.equal(config.apiKey.includes(openaiKey), false);
    assert.equal(config.baseUrl, "https://api.openai.test/v1");
    assert.equal(config.defaultModels[CHAT], "gpt-4o");
    assert.equal(config.defaultModels[EMBEDDINGS], "text-embedding-3-large");

    const providers = await handlers.listProviders(null);
    assert.equal(providers.find((provider) => provider.id === "openai").configured, true);
  });
});

test("set-config preserves existing API key when receiving a redacted placeholder", async () => {
  await withProviderDb(async (filePath) => {
    const openaiKey = "sk-openai-secret-1234567890";
    const { handlers, safeStorage, reconfigured } = createHandlers({ storePath: filePath });

    await handlers.setConfig(null, "openai", {
      apiKey: openaiKey,
      baseUrl: "https://api.openai.test/v1",
    });
    const redactedConfig = await handlers.getConfig(null, "openai");
    const saved = await handlers.setConfig(null, "openai", {
      apiKey: redactedConfig.apiKey,
      baseUrl: "https://proxy.openai.test/v1",
      defaultModels: {
        [CHAT]: "gpt-4o",
      },
    });

    assert.equal(saved.ok, true);
    assert.deepEqual(safeStorage.encryptedValues, [openaiKey]);
    assert.equal(reconfigured.at(-1).runtimeConfig.apiKey, openaiKey);
    assert.equal(reconfigured.at(-1).runtimeConfig.baseUrl, "https://proxy.openai.test/v1");
    assert.equal(
      readStoredSetting(filePath, getProviderDefaultModelSettingKey("openai", CHAT)),
      JSON.stringify("gpt-4o"),
    );
  });
});

test("composio credential IPC stores protected credential and returns redacted status", async () => {
  await withProviderDb(async (filePath) => {
    const composioCredential = "composio-test-credential-1234567890";
    const { handlers, safeStorage } = createHandlers({ storePath: filePath });

    const missingStatus = await handlers.getComposioCredentialStatus(null);
    assert.equal(missingStatus.ok, true);
    assert.equal(missingStatus.provider, "composio");
    assert.equal(missingStatus.configured, false);
    assert.equal(missingStatus.connected, false);
    assert.equal(missingStatus.apiKey, null);

    const saved = await handlers.saveComposioCredential(null, {
      apiKey: `  ${composioCredential}  `,
    });

    assert.deepEqual(safeStorage.encryptedValues, [composioCredential]);
    assert.equal(saved.ok, true);
    assert.equal(saved.provider, "composio");
    assert.equal(saved.configured, true);
    assert.equal(saved.connected, false);
    assert.equal(saved.apiKey, "[REDACTED]7890");
    assert.equal(saved.apiKey.includes(composioCredential), false);

    const storedCredential = readStoredSetting(filePath, COMPOSIO_CREDENTIAL_KEY);
    assert.equal(storedCredential.includes(composioCredential), false);

    const status = await handlers.getComposioCredentialStatus(null);
    assert.equal(status.configured, true);
    assert.equal(status.apiKey, "[REDACTED]7890");

    const connection = await handlers.testComposioConnection(null);
    assert.equal(connection.ok, true);
    assert.equal(connection.provider, "composio");
    assert.equal(connection.configured, true);
    assert.equal(connection.connected, true);
    assert.equal(connection.message.includes(composioCredential), false);

    const connectedStatus = await handlers.getComposioCredentialStatus(null);
    assert.equal(connectedStatus.connected, true);
    assert.notEqual(connectedStatus.testedAt, null);
  });
});

test("composio credential IPC preserves redacted placeholders and clears credential", async () => {
  await withProviderDb(async (filePath) => {
    const composioCredential = "composio-test-credential-abcdef123456";
    const { handlers, safeStorage } = createHandlers({ storePath: filePath });

    await handlers.saveComposioCredential(null, { credential: composioCredential });
    const storedCredential = readStoredSetting(filePath, COMPOSIO_CREDENTIAL_KEY);
    const redactedStatus = await handlers.getComposioCredentialStatus(null);

    const preserved = await handlers.saveComposioCredential(null, {
      credential: redactedStatus.apiKey,
    });

    assert.deepEqual(safeStorage.encryptedValues, [composioCredential]);
    assert.equal(readStoredSetting(filePath, COMPOSIO_CREDENTIAL_KEY), storedCredential);
    assert.equal(preserved.configured, true);
    assert.equal(preserved.apiKey, redactedStatus.apiKey);

    const cleared = await handlers.clearComposioCredential(null);

    assert.equal(cleared.ok, true);
    assert.equal(cleared.provider, "composio");
    assert.equal(cleared.configured, false);
    assert.equal(cleared.connected, false);
    assert.equal(cleared.apiKey, null);
    assert.equal(readStoredSetting(filePath, COMPOSIO_CREDENTIAL_KEY), null);

    const missingConnection = await handlers.testComposioConnection(null);
    assert.equal(missingConnection.ok, false);
    assert.equal(missingConnection.error.name, "ProviderError");
    assert.equal(missingConnection.error.code, "COMPOSIO_CREDENTIAL_MISSING");
    assert.equal(missingConnection.error.provider, "composio");
  });
});

test("test-connection measures latency and updates connected status", async () => {
  const registry = createRegistry();
  registry.get("openai").connectionResult = { ok: true, modelCount: 3 };
  const nowValues = [1_000, 1_042];
  const { handlers } = createHandlers({
    registry,
    now: () => nowValues.shift(),
  });

  const result = await handlers.testConnection(null, "openai");

  assert.equal(result.ok, true);
  assert.equal(result.latencyMs, 42);
  assert.equal(result.modelCount, 3);

  const providers = await handlers.listProviders(null);
  assert.equal(providers.find((provider) => provider.id === "openai").connected, true);
});

test("test-connection returns a serialized timeout error", async () => {
  const registry = createRegistry();
  registry.register(
    new TestProvider({
      name: "slow",
      displayName: "Slow",
      capabilities: { [CHAT]: true },
      connectionResult: new Promise(() => {}),
    }),
  );
  registry.get("slow").testConnection = () => new Promise(() => {});
  const nowValues = [10, 25];
  const { handlers } = createHandlers({
    registry,
    timeoutMs: 5,
    now: () => nowValues.shift(),
  });

  const result = await handlers.testConnection(null, "slow");

  assert.equal(result.ok, false);
  assert.equal(result.latencyMs, 15);
  assert.equal(result.error.name, "ProviderError");
  assert.equal(result.error.code, "PROVIDER_TEST_TIMEOUT");
  assert.equal(result.error.provider, "slow");
});

test("get-models filters provider models by capability", async () => {
  const registry = createRegistry();
  registry.get("openai").modelList = [
    {
      id: "gpt-4o",
      name: "GPT-4o",
      capabilities: { [CHAT]: true, [EMBEDDINGS]: false, tools: true, vision: true },
    },
    {
      id: "text-embedding-3-small",
      name: "Text embedding 3 small",
      capabilities: { [CHAT]: false, [EMBEDDINGS]: true },
    },
    {
      id: "tts-1",
      name: "TTS 1",
      capabilities: { [TTS]: true },
    },
  ];
  const { handlers } = createHandlers({ registry });

  const chatModels = await handlers.getModels(null, "openai", CHAT);
  const embeddingModels = await handlers.getModels(null, "openai", EMBEDDINGS);

  assert.deepEqual(
    chatModels.map((model) => model.id),
    ["gpt-4o"],
  );
  assert.deepEqual(
    embeddingModels.map((model) => model.id),
    ["text-embedding-3-small"],
  );
});

test("provider IPC errors are serialized and redact secrets", async () => {
  const registry = createRegistry();
  const secret = "sk-openai-secret-1234567890";
  const error = new ProviderError(`Upstream rejected ${secret}`, {
    code: "OPENAI_AUTH_FAILED",
    provider: "openai",
  });
  error.apiKey = secret;
  registry.get("openai").modelList = error;
  const { handlers } = createHandlers({ registry });

  const result = await handlers.getModels(null, "openai", CHAT);

  assert.equal(result.ok, false);
  assert.equal(result.error.name, "ProviderError");
  assert.equal(result.error.code, "OPENAI_AUTH_FAILED");
  assert.equal(result.error.provider, "openai");
  assert.equal(result.error.message.includes(secret), false);
  assert.equal(result.error.apiKey, "[redacted]");
});

test("ollama pull-model streams progress through the event sender", async () => {
  const registry = createRegistry();
  registry.get("ollama").pullModel = async (model, onProgress) => {
    onProgress({ pct: 25, status: "downloading" });
    onProgress({ pct: 100, status: "success" });
    return { ok: true, model };
  };
  const { handlers } = createHandlers({ registry });
  const sent = [];
  const event = {
    sender: {
      send(channel, payload) {
        sent.push({ channel, payload });
      },
    },
  };

  const result = await handlers.pullOllamaModel(event, { model: "llama3.2" });

  assert.deepEqual(result, { ok: true, model: "llama3.2" });
  assert.deepEqual(sent, [
    {
      channel: "ollama:pull-progress",
      payload: { model: "llama3.2", pct: 25, status: "downloading" },
    },
    {
      channel: "ollama:pull-progress",
      payload: { model: "llama3.2", pct: 100, status: "success" },
    },
  ]);
});
