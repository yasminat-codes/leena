import assert from "node:assert/strict";
import test from "node:test";

import {
  createProviderModelSelectorController,
  createSettingsScreenController,
  loadSettingsScreenData,
} from "../src/renderer/screens/settings.js";

class TestElement {
  constructor({ classes = [], dataset = {}, id = "", selectors = [] } = {}) {
    this.attributes = new Map();
    this.children = [];
    this.dataset = { ...dataset };
    this.disabled = false;
    this.id = id;
    this.innerHTML = "";
    this.selectors = new Set(selectors);
    this.textContent = "";
    this.value = "";
    this.classList = {
      contains: (className) => classes.includes(className),
    };
  }

  matches(selector) {
    if (selector === "#app-shell.leena") {
      return this.id === "app-shell" && this.classList.contains("leena");
    }
    return this.selectors.has(selector) || matchesDatasetSelector(this, selector);
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = (node) => {
      if (node.matches(selector)) {
        matches.push(node);
      }
      for (const child of node.children) {
        visit(child);
      }
    };
    visit(this);
    return matches;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }
}

class ProviderMount {
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

function matchesDatasetSelector(element, selector) {
  if (selector === "[data-appearance-key][data-appearance-value]") {
    return Boolean(element.dataset.appearanceKey && element.dataset.appearanceValue);
  }

  const dataMatch = selector.match(/^\[data-([a-z-]+)(?:="([^"]+)")?\]$/);
  if (!dataMatch) {
    return false;
  }

  const key = dataMatch[1].replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
  const expectedValue = dataMatch[2];
  if (!(key in element.dataset)) {
    return false;
  }
  return typeof expectedValue === "undefined" || element.dataset[key] === expectedValue;
}

function createSettingsDom() {
  const root = new TestElement();
  const wrapper = new TestElement({ classes: ["leena"], id: "app-shell" });
  const identityName = new TestElement({ selectors: ["[data-settings-identity-name]"] });
  const identityEmail = new TestElement({ selectors: ["[data-settings-identity-email]"] });
  const agentName = new TestElement({ selectors: ["[data-agent-name]"] });
  const personaSelect = new TestElement({ selectors: ["[data-persona-select]"] });
  const personaTone = new TestElement({ selectors: ["[data-persona-tone]"] });
  const wakeStatus = new TestElement({ selectors: ["[data-wake-status]"] });
  const wakeEnabled = new TestElement({
    selectors: ['[data-settings-toggle-status="wake:enabled"]', "[data-wake-enabled]"],
  });
  const wakeMuted = new TestElement({
    selectors: ['[data-settings-toggle-status="wake:muted"]', "[data-wake-muted]"],
  });
  const launchToggle = new TestElement({
    dataset: { settingsToggle: "launchOnLogin" },
  });
  const launchStatus = new TestElement({
    dataset: { settingsToggleStatus: "launchOnLogin" },
  });
  const themeDark = new TestElement({
    dataset: { appearanceKey: "theme", appearanceValue: "dark" },
  });
  const themeLight = new TestElement({
    dataset: { appearanceKey: "theme", appearanceValue: "light" },
  });
  const treatmentAurora = new TestElement({
    dataset: { appearanceKey: "treatment", appearanceValue: "aurora" },
  });
  const densityCompact = new TestElement({
    dataset: { appearanceKey: "density", appearanceValue: "compact" },
  });

  root.children.push(
    wrapper,
    identityName,
    identityEmail,
    agentName,
    personaSelect,
    personaTone,
    wakeStatus,
    wakeEnabled,
    wakeMuted,
    launchToggle,
    launchStatus,
    themeDark,
    themeLight,
    treatmentAurora,
    densityCompact,
  );

  return {
    agentName,
    densityCompact,
    identityEmail,
    identityName,
    launchStatus,
    launchToggle,
    personaSelect,
    personaTone,
    root,
    themeDark,
    themeLight,
    treatmentAurora,
    wakeEnabled,
    wakeMuted,
    wakeStatus,
    wrapper,
  };
}

function createBridge() {
  const calls = [];
  const settings = {
    active_persona_id: "coach",
    density: "compact",
    launchOnLogin: true,
    notificationsEnabled: true,
    proactiveNudges: false,
    theme: "dark",
    treatment: "aurora",
    wakeEnabled: true,
    wakeMuted: true,
  };
  const personas = [
    { id: "default", name: "Leena", tone: "warm, direct" },
    { id: "coach", name: "Coach", tone: "focused coach" },
  ];
  let profile = {
    activePersona: personas[1],
    name: "Yasmine",
    persona: "coach",
    personaId: "coach",
  };

  return {
    calls,
    getAgentProfile: async () => {
      calls.push({ type: "getAgentProfile" });
      return { ...profile };
    },
    getAllSettings: async () => {
      calls.push({ type: "getAllSettings" });
      return { ...settings };
    },
    identity: {
      listPersonas: async () => {
        calls.push({ type: "listPersonas" });
        return personas.map((persona) => ({ ...persona }));
      },
      switchPersona: async (personaId) => {
        calls.push({ personaId, type: "switchPersona" });
        const persona = personas.find((item) => item.id === personaId);
        profile = {
          ...profile,
          activePersona: persona,
          persona: personaId,
          personaId,
        };
        return { ...persona };
      },
    },
    setAgentProfile: async (nextProfile) => {
      calls.push({ profile: nextProfile, type: "setAgentProfile" });
      profile = { ...nextProfile };
      return { ...profile };
    },
    setLaunchOnLogin: async (enabled) => {
      calls.push({ enabled, type: "setLaunchOnLogin" });
      settings.launchOnLogin = enabled;
      return enabled;
    },
    setSetting: async (key, value) => {
      calls.push({ key, type: "setSetting", value });
      settings[key] = value;
      return value;
    },
  };
}

function createProviderBridge() {
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
        embeddings: "text-embedding-3-small",
        realtime: "gpt-realtime",
        stt: "gpt-4o-transcribe",
        tts: "tts-1",
      },
    },
    openrouter: {
      apiKey: "[REDACTED]5678",
      baseUrl: "https://openrouter.test/api/v1",
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
      chat: [{ id: "gpt-4o", displayName: "GPT-4o", capabilities: { chat: true } }],
      embeddings: [
        {
          id: "text-embedding-3-small",
          displayName: "Text embedding 3 small",
          capabilities: { embeddings: true },
        },
      ],
      realtime: [
        {
          id: "gpt-realtime",
          displayName: "GPT Realtime",
          capabilities: { realtime: true },
        },
      ],
      stt: [
        {
          id: "gpt-4o-transcribe",
          displayName: "GPT-4o transcribe",
          capabilities: { stt: true },
        },
      ],
      tts: [{ id: "tts-1", displayName: "TTS 1", capabilities: { tts: true } }],
    },
    openrouter: {
      chat: [{ id: "openrouter/auto", displayName: "Auto", capabilities: { chat: true } }],
      embeddings: [
        {
          id: "qwen/qwen3-embedding-0.6b",
          displayName: "Qwen Embedding",
          capabilities: { embeddings: true },
        },
      ],
    },
    ollama: {
      chat: [{ id: "llama3.2", displayName: "llama3.2", capabilities: { chat: true } }],
      embeddings: [
        {
          id: "nomic-embed-text",
          displayName: "nomic-embed-text",
          capabilities: { embeddings: true },
        },
      ],
    },
  };

  return {
    calls,
    getSetting: async (key, fallback) => {
      calls.push({ key, type: "getSetting" });
      return settings.get(key) ?? fallback;
    },
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
      pullModel: async (model) => {
        calls.push({ model, type: "pullModel" });
        return { ok: true, model };
      },
    },
    providers: {
      getConfig: async (providerId) => {
        calls.push({ providerId, type: "getConfig" });
        return { ...configs[providerId] };
      },
      getModels: async (providerId, capability) => {
        calls.push({ capability, providerId, type: "getModels" });
        return models[providerId]?.[capability] ?? [];
      },
      list: async () => {
        calls.push({ type: "listProviders" });
        return [
          {
            id: "openai",
            name: "OpenAI",
            capabilities: {
              chat: true,
              embeddings: true,
              realtime: true,
              stt: true,
              tts: true,
            },
            configured: true,
            connected: true,
          },
          {
            id: "openrouter",
            name: "OpenRouter",
            capabilities: {
              chat: true,
              embeddings: true,
              realtime: false,
              stt: false,
              tts: false,
            },
            configured: true,
            connected: false,
          },
          {
            id: "ollama",
            name: "Ollama",
            capabilities: {
              chat: true,
              embeddings: true,
              realtime: false,
              stt: false,
              tts: false,
            },
            configured: true,
            connected: false,
          },
        ];
      },
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
      testConnection: async (providerId) => {
        calls.push({ providerId, type: "testConnection" });
        return { ok: true, latencyMs: 25, modelCount: 2 };
      },
    },
  };
}

test.afterEach(() => {
  delete globalThis.localStorage;
});

test("loadSettingsScreenData populates appearance, profile, persona, general, and disabled wake controls", async () => {
  const dom = createSettingsDom();
  const bridge = createBridge();
  let localStorageWrites = 0;
  globalThis.localStorage = {
    setItem() {
      localStorageWrites += 1;
    },
  };

  const state = await loadSettingsScreenData(dom.root, bridge);

  assert.equal(state.settings.theme, "dark");
  assert.equal(dom.wrapper.dataset.theme, "dark");
  assert.equal(dom.wrapper.dataset.treatment, "aurora");
  assert.equal(dom.wrapper.dataset.density, "compact");
  assert.equal(dom.themeDark.getAttribute("aria-pressed"), "true");
  assert.equal(dom.themeLight.getAttribute("aria-pressed"), "false");
  assert.equal(dom.identityName.textContent, "Yasmine");
  assert.equal(dom.identityEmail.textContent, "Persona: Coach");
  assert.equal(dom.agentName.value, "Yasmine");
  assert.equal(dom.personaSelect.value, "coach");
  assert.match(dom.personaSelect.innerHTML, /value="coach" selected/);
  assert.equal(dom.personaTone.value, "focused coach");
  assert.equal(dom.launchToggle.getAttribute("aria-checked"), "true");
  assert.equal(dom.launchStatus.textContent, "On");
  assert.equal(dom.wakeEnabled.disabled, true);
  assert.equal(dom.wakeEnabled.getAttribute("aria-checked"), "true");
  assert.match(dom.wakeEnabled.getAttribute("title"), /Wake controls are unavailable/);
  assert.match(dom.wakeStatus.textContent, /Wake controls are unavailable/);
  assert.equal(localStorageWrites, 0);
  assert.deepEqual(
    bridge.calls.map((call) => call.type),
    ["getAllSettings", "getAgentProfile", "listPersonas"],
  );
});

test("settings controller saves appearance, general settings, profile name, and persona switches through bridges", async () => {
  const dom = createSettingsDom();
  const bridge = createBridge();
  globalThis.localStorage = {
    setItem() {
      throw new Error("live settings path should not write localStorage");
    },
  };
  const controller = createSettingsScreenController(dom.root, bridge);

  await controller.load();
  await controller.saveAppearance("theme", "light");
  await controller.saveSetting("launchOnLogin", false);
  await controller.saveProfileName("Maya");
  await controller.switchPersona("default");

  assert.equal(dom.wrapper.dataset.theme, "light");
  assert.equal(dom.launchToggle.getAttribute("aria-checked"), "false");
  assert.equal(dom.identityName.textContent, "Maya");
  assert.equal(dom.personaSelect.value, "default");
  assert.deepEqual(
    bridge.calls
      .filter((call) =>
        ["setSetting", "setLaunchOnLogin", "setAgentProfile", "switchPersona"].includes(call.type),
      )
      .map((call) => ({
        enabled: call.enabled,
        key: call.key,
        personaId: call.personaId,
        type: call.type,
        value: call.value,
      })),
    [
      {
        enabled: undefined,
        key: "theme",
        personaId: undefined,
        type: "setSetting",
        value: "light",
      },
      {
        enabled: false,
        key: undefined,
        personaId: undefined,
        type: "setLaunchOnLogin",
        value: undefined,
      },
      {
        enabled: undefined,
        key: undefined,
        personaId: undefined,
        type: "setAgentProfile",
        value: undefined,
      },
      {
        enabled: undefined,
        key: undefined,
        personaId: "default",
        type: "switchPersona",
        value: undefined,
      },
      {
        enabled: undefined,
        key: undefined,
        personaId: undefined,
        type: "setAgentProfile",
        value: undefined,
      },
    ],
  );
  assert.equal(
    bridge.calls.some((call) => call.type === "setAgentProfile" && call.profile.name === "Maya"),
    true,
  );
  assert.equal(
    bridge.calls.some(
      (call) => call.type === "setAgentProfile" && call.profile.persona === "default",
    ),
    true,
  );
});

test("wake controls degrade gracefully when the wake bridge is absent", async () => {
  const dom = createSettingsDom();
  const bridge = createBridge();
  const controller = createSettingsScreenController(dom.root, bridge);

  await controller.load();
  assert.equal(controller.state.wakeAvailable, false);
  assert.equal(dom.wakeMuted.disabled, true);
  assert.match(dom.wakeMuted.getAttribute("title"), /Wake controls are unavailable/);

  assert.equal(await controller.setWakeEnabled(false), null);
  assert.equal(await controller.setWakeMuted(false), null);
  assert.equal(
    bridge.calls.some((call) => call.type.startsWith("wake")),
    false,
  );
  assert.match(dom.wakeStatus.textContent, /Wake controls are unavailable/);
});

test("wake controls reflect live wake bridge status and call wake methods", async () => {
  const dom = createSettingsDom();
  const bridge = createBridge();
  bridge.wake = {
    getStatus: async () => {
      bridge.calls.push({ type: "wake:getStatus" });
      return { enabled: true, listening: false, muted: false, running: true };
    },
    mute: async (muted) => {
      bridge.calls.push({ muted, type: "wake:mute" });
      return { muted };
    },
    setEnabled: async (enabled) => {
      bridge.calls.push({ enabled, type: "wake:setEnabled" });
      return { enabled, listening: false, muted: false, running: enabled };
    },
  };
  const controller = createSettingsScreenController(dom.root, bridge);

  await controller.load();

  assert.equal(controller.state.wakeAvailable, true);
  assert.equal(dom.wakeEnabled.disabled, false);
  assert.equal(dom.wakeEnabled.getAttribute("aria-checked"), "true");
  assert.equal(dom.wakeMuted.disabled, false);
  assert.equal(dom.wakeMuted.getAttribute("aria-checked"), "false");
  assert.match(dom.wakeStatus.textContent, /Wake runtime ready/);

  await controller.setWakeEnabled(false);
  await controller.setWakeMuted(true);

  assert.equal(dom.wakeEnabled.getAttribute("aria-checked"), "false");
  assert.equal(dom.wakeMuted.getAttribute("aria-checked"), "true");
  assert.deepEqual(
    bridge.calls.filter((call) => call.type.startsWith("wake")),
    [
      { type: "wake:getStatus" },
      { enabled: false, type: "wake:setEnabled" },
      { muted: true, type: "wake:mute" },
    ],
  );
});

test("provider selector loads real providers, refreshes models, and persists selection keys", async () => {
  const mount = new ProviderMount();
  const bridge = createProviderBridge();
  const controller = createProviderModelSelectorController(mount, bridge);

  controller.bind();
  await controller.load();

  assert.deepEqual(
    controller.state.providers.map((provider) => provider.id),
    ["openai", "openrouter", "ollama"],
  );
  assert.equal(controller.state.selectedProviders.chat, "openai");
  assert.equal(controller.state.selectedModels.chat, "gpt-4o");
  assert.match(mount.innerHTML, /OpenRouter/);
  assert.match(mount.innerHTML, /GPT Realtime/);

  await controller.selectProvider("chat", "openrouter");
  await controller.selectModel("chat", "openrouter/auto");

  assert.equal(controller.state.selectedProviders.chat, "openrouter");
  assert.equal(controller.state.selectedModels.chat, "openrouter/auto");
  assert.deepEqual(
    bridge.calls
      .filter((call) => call.type === "setSetting")
      .map((call) => ({ key: call.key, value: call.value })),
    [
      { key: "provider:default:chat", value: "openrouter" },
      { key: "provider:openrouter:defaultModel:chat", value: "openrouter/auto" },
      { key: "provider:default:chat", value: "openrouter" },
      { key: "provider:openrouter:defaultModel:chat", value: "openrouter/auto" },
    ],
  );
  assert.equal(
    bridge.calls.some(
      (call) =>
        call.type === "setConfig" &&
        call.providerId === "openrouter" &&
        call.config.defaultModels.chat === "openrouter/auto",
    ),
    true,
  );
});

test("provider config save preserves redacted stored API keys", async () => {
  const mount = new ProviderMount();
  const bridge = createProviderBridge();
  const controller = createProviderModelSelectorController(mount, bridge);

  controller.bind();
  await controller.load();
  const config = await controller.openProviderConfig("openai");
  await controller.saveProviderConfig("openai", {
    apiKey: config.apiKey,
    baseUrl: "https://api.openai.test/v1",
  });

  const saveCall = bridge.calls.find(
    (call) => call.type === "setConfig" && call.providerId === "openai" && call.config.apiKey,
  );
  assert.equal(saveCall.config.apiKey, "[REDACTED]1234");
  assert.equal(saveCall.config.baseUrl, "https://api.openai.test/v1");
  assert.equal(saveCall.config.defaultModels.chat, "gpt-4o");
});
