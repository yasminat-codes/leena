import assert from "node:assert/strict";
import test from "node:test";

import {
  createProviderModelSelectorController,
  createProviderSelectorState,
  filterProvidersForCapability,
  renderProviderModelSelector,
  toggleApiKeyInputMask,
} from "../src/renderer/screens/settings.js";

const providers = Object.freeze([
  Object.freeze({
    id: "openai",
    name: "OpenAI",
    capabilities: Object.freeze({
      chat: true,
      realtime: true,
      embeddings: true,
      tts: true,
      stt: true,
    }),
    configured: true,
    connected: true,
  }),
  Object.freeze({
    id: "openrouter",
    name: "OpenRouter",
    capabilities: Object.freeze({
      chat: true,
      realtime: false,
      embeddings: true,
      tts: false,
      stt: false,
    }),
    configured: true,
    connected: false,
  }),
  Object.freeze({
    id: "ollama",
    name: "Ollama",
    capabilities: Object.freeze({
      chat: false,
      realtime: false,
      embeddings: false,
      tts: false,
      stt: false,
    }),
    configured: true,
    connected: false,
  }),
]);

class TestMount {
  constructor() {
    this.dataset = { providerModelSelector: "" };
    this.innerHTML = "";
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  querySelector() {
    return null;
  }
}

function createBridge() {
  const calls = [];
  const settings = new Map([
    ["provider:default:chat", "openai"],
    ["provider:default:realtime", "openai"],
    ["provider:default:embeddings", "openai"],
    ["provider:default:tts", "openai"],
    ["provider:default:stt", "openai"],
  ]);
  const configs = {
    openai: {
      apiKey: "[REDACTED]1234",
      baseUrl: "https://api.openai.test/v1",
      defaultModels: {
        chat: "gpt-4o",
        realtime: "gpt-realtime-2",
        embeddings: "text-embedding-3-small",
        tts: "tts-1",
        stt: "gpt-4o-transcribe",
      },
    },
    openrouter: {
      apiKey: "[REDACTED]5678",
      baseUrl: "",
      defaultModels: {
        chat: "openrouter/auto",
        embeddings: "qwen/qwen3-embedding-0.6b",
      },
    },
    ollama: {
      apiKey: "",
      baseUrl: "http://localhost:11434",
      defaultModels: {},
    },
  };
  const models = {
    openai: {
      chat: [
        {
          id: "gpt-4o",
          displayName: "GPT-4o",
          capabilities: { chat: true },
        },
      ],
      realtime: [
        {
          id: "gpt-realtime-2",
          displayName: "GPT Realtime 2",
          capabilities: { realtime: true },
        },
      ],
      embeddings: [
        {
          id: "text-embedding-3-small",
          displayName: "Text embedding 3 small",
          capabilities: { embeddings: true },
        },
      ],
      tts: [{ id: "tts-1", displayName: "TTS 1", capabilities: { tts: true } }],
      stt: [
        {
          id: "gpt-4o-transcribe",
          displayName: "GPT-4o transcribe",
          capabilities: { stt: true },
        },
      ],
    },
    openrouter: {
      chat: [{ id: "openrouter/auto", capabilities: { chat: true } }],
      embeddings: [{ id: "qwen/qwen3-embedding-0.6b", capabilities: { embeddings: true } }],
    },
    ollama: {
      chat: [],
      embeddings: [],
    },
  };

  return {
    calls,
    getSetting: async (key, fallback) => settings.get(key) ?? fallback,
    setSetting: async (key, value) => {
      calls.push({ key, type: "setSetting", value });
      settings.set(key, value);
      return value;
    },
    ollama: {
      offPullProgress() {},
      onPullProgress(callback) {
        calls.push({ callback, type: "onPullProgress" });
        return callback;
      },
      async pullModel(model, onProgress) {
        calls.push({ model, type: "pullModel" });
        onProgress?.({ model, pct: 35, status: "downloading" });
        onProgress?.({ model, pct: 100, status: "success" });
        return { ok: true, model };
      },
    },
    providers: {
      getConfig: async (providerId) => configs[providerId] ?? {},
      getModels: async (providerId, capability) => {
        calls.push({ capability, providerId, type: "getModels" });
        return models[providerId]?.[capability] ?? [];
      },
      list: async () => providers.map((provider) => ({ ...provider })),
      setConfig: async (providerId, config) => {
        calls.push({ config, providerId, type: "setConfig" });
        configs[providerId] = {
          ...(configs[providerId] ?? {}),
          ...config,
          defaultModels: {
            ...(configs[providerId]?.defaultModels ?? {}),
            ...(config.defaultModels ?? {}),
          },
        };
        return { ok: true, configured: true, provider: providerId };
      },
      testConnection: async () => ({ ok: true, latencyMs: 42, modelCount: 3 }),
    },
  };
}

test("provider selector renders provider cards and capability rows", () => {
  const html = renderProviderModelSelector(createProviderSelectorState({ providers }));

  assert.match(html, /data-provider-model-selector/);
  assert.match(html, /data-provider-detail/);
  assert.match(html, /data-provider-cards-section/);
  assert.match(html, /data-provider-defaults-section/);
  assert.match(html, /OpenAI/);
  assert.match(html, /OpenRouter/);
  assert.match(html, /Ollama/);
  assert.match(html, /5 defaults/);
  assert.match(html, /data-provider-configure="openai"/);
  assert.match(html, /data-provider-refresh="openai"/);
  assert.match(html, /data-capability-provider="chat"/);
  assert.match(html, /data-capability-provider="realtime"/);
  assert.match(html, /data-ollama-pull-panel/);
  assert.match(html, /data-ollama-download/);
});

test("capability filtering restricts realtime to OpenAI while keeping Ollama chat potential", () => {
  assert.deepEqual(
    filterProvidersForCapability(providers, "realtime").map((provider) => provider.id),
    ["openai"],
  );
  assert.deepEqual(
    filterProvidersForCapability(providers, "chat").map((provider) => provider.id),
    ["openai", "openrouter", "ollama"],
  );
});

test("controller load populates model dropdown state from provider model responses", async () => {
  const mount = new TestMount();
  const bridge = createBridge();
  const controller = createProviderModelSelectorController(mount, bridge);

  controller.bind();
  await controller.load();

  assert.equal(controller.state.selectedProviders.chat, "openai");
  assert.equal(controller.state.selectedModels.chat, "gpt-4o");
  assert.equal(controller.state.models.openai.chat[0].id, "gpt-4o");
  assert.match(mount.innerHTML, /GPT-4o/);
  assert.match(mount.innerHTML, /GPT Realtime 2/);
  assert.equal(
    bridge.calls.some((call) => call.type === "setSetting"),
    false,
  );
});

test("API key input masks by default and the toggle switches to text", () => {
  const input = { type: "password" };
  const attributes = new Map();
  const button = {
    textContent: "Show",
    setAttribute(name, value) {
      attributes.set(name, value);
    },
  };

  assert.equal(toggleApiKeyInputMask(input, button), "text");
  assert.equal(input.type, "text");
  assert.equal(button.textContent, "Hide");
  assert.equal(attributes.get("aria-pressed"), "true");

  assert.equal(toggleApiKeyInputMask(input, button), "password");
  assert.equal(input.type, "password");
  assert.equal(button.textContent, "Show");
  assert.equal(attributes.get("aria-pressed"), "false");
});

test("test connection displays latency and model count on success", async () => {
  const mount = new TestMount();
  const controller = createProviderModelSelectorController(mount, createBridge());

  controller.bind();
  await controller.load();
  const result = await controller.testProviderConnection("openai");

  assert.deepEqual(result, { ok: true, latencyMs: 42, modelCount: 3 });
  assert.match(mount.innerHTML, /42 ms/);
  assert.match(mount.innerHTML, /3 models/);
});

test("save provider config sends set-config payload with selected default models", async () => {
  const mount = new TestMount();
  const bridge = createBridge();
  const controller = createProviderModelSelectorController(mount, bridge);

  controller.bind();
  await controller.load();
  controller.state.selectedProviders.chat = "openai";
  controller.state.selectedModels.chat = "gpt-4o";
  await controller.saveProviderConfig("openai", {
    apiKey: "sk-openai-new",
    baseUrl: "https://api.openai.test/v1",
  });

  const saveCall = bridge.calls.find(
    (call) => call.type === "setConfig" && call.providerId === "openai" && call.config.apiKey,
  );
  assert.equal(saveCall.config.apiKey, "sk-openai-new");
  assert.equal(saveCall.config.baseUrl, "https://api.openai.test/v1");
  assert.equal(saveCall.config.defaultModels.chat, "gpt-4o");
});

test("refresh provider models reloads supported capabilities without changing defaults", async () => {
  const mount = new TestMount();
  const bridge = createBridge();
  const controller = createProviderModelSelectorController(mount, bridge);

  controller.bind();
  await controller.load();
  bridge.calls.length = 0;

  await controller.refreshProviderModels("openrouter");

  assert.deepEqual(
    bridge.calls
      .filter((call) => call.type === "getModels")
      .map((call) => `${call.providerId}:${call.capability}`),
    ["openrouter:chat", "openrouter:embeddings"],
  );
  assert.equal(
    bridge.calls.some((call) => call.type === "setSetting"),
    false,
  );
  assert.match(mount.innerHTML, /OpenRouter/);
});

test("Ollama download reports progress and makes chat and embedding models selectable", async () => {
  const mount = new TestMount();
  const bridge = createBridge();
  const controller = createProviderModelSelectorController(mount, bridge);

  controller.bind();
  await controller.load();
  await controller.selectProvider("chat", "ollama");
  await controller.startOllamaDownload("llama3.2");

  assert.equal(controller.state.pull.state, "complete");
  assert.equal(controller.state.pull.pct, 100);
  assert.equal(controller.state.selectedProviders.chat, "ollama");
  assert.equal(controller.state.selectedModels.chat, "llama3.2");
  assert.equal(controller.state.models.ollama.chat.at(-1).id, "llama3.2");
  assert.match(mount.innerHTML, /llama3\.2/);

  await controller.selectProvider("embeddings", "ollama");
  await controller.startOllamaDownload("nomic-embed-text");

  assert.equal(controller.state.selectedProviders.embeddings, "ollama");
  assert.equal(controller.state.selectedModels.embeddings, "nomic-embed-text");
  assert.equal(controller.state.models.ollama.embeddings.at(-1).id, "nomic-embed-text");
  assert.equal(
    bridge.calls.some((call) => call.type === "pullModel"),
    true,
  );
});
