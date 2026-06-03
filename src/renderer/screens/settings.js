import {
  DEFAULT_HOTKEY_ACCELERATOR,
  formatHotkeyAccelerator,
  normalizeHotkeyAccelerator,
} from "../../hotkey-accelerator.js";

export const APPEARANCE_STORAGE_KEYS = Object.freeze({
  theme: "leena-theme",
  treatment: "leena-treatment",
  density: "leena-density",
});

export const SETTINGS_MOCK_DATA = Object.freeze({
  identity: Object.freeze({
    name: "Yasmine",
    email: "yasmine@leena.local",
  }),
  appearance: Object.freeze({
    theme: Object.freeze([
      Object.freeze({ label: "Workspace", value: "workspace" }),
      Object.freeze({ label: "Light", value: "light" }),
      Object.freeze({ label: "Dark", value: "dark" }),
      Object.freeze({ label: "Vercel Dark", value: "vercel-dark" }),
    ]),
    treatment: Object.freeze([
      Object.freeze({ label: "Workspace", value: "workspace" }),
      Object.freeze({ label: "Aurora", value: "aurora" }),
      Object.freeze({ label: "Coral", value: "coral" }),
      Object.freeze({ label: "Iris", value: "iris" }),
    ]),
    density: Object.freeze([
      Object.freeze({ label: "Compact", value: "compact" }),
      Object.freeze({ label: "Comfortable", value: "comfortable" }),
    ]),
  }),
  providers: Object.freeze([
    Object.freeze({
      id: "openai",
      name: "OpenAI",
      status: "Active",
      tone: "success",
      model: "Realtime + GPT-5",
      capabilities: Object.freeze({
        chat: true,
        realtime: true,
        embeddings: true,
        tts: true,
        stt: true,
      }),
    }),
    Object.freeze({
      id: "openrouter",
      name: "OpenRouter",
      status: "Available",
      tone: "accent",
      model: "Choose a hosted model",
      capabilities: Object.freeze({
        chat: true,
        realtime: false,
        embeddings: true,
        tts: false,
        stt: false,
      }),
    }),
    Object.freeze({
      id: "ollama",
      name: "Ollama",
      status: "Available",
      tone: "accent",
      model: "Choose a local model",
      capabilities: Object.freeze({
        chat: true,
        realtime: false,
        embeddings: true,
        tts: false,
        stt: false,
      }),
    }),
  ]),
  features: Object.freeze([
    Object.freeze({ label: "Wake Word", enabled: false }),
    Object.freeze({ label: "Always Listening", enabled: false }),
    Object.freeze({ label: "Launch on Login", enabled: false }),
    Object.freeze({ label: "Notifications", enabled: true }),
  ]),
});

export const DEFAULT_APPEARANCE = Object.freeze({
  theme: "workspace",
  treatment: "workspace",
  density: "comfortable",
});

export const GENERAL_SETTING_CONTROLS = Object.freeze([
  Object.freeze({
    key: "launchOnLogin",
    label: "Launch on Login",
    description: "Open Leena when the computer starts",
  }),
  Object.freeze({
    key: "proactiveNudges",
    label: "Proactive Nudges",
    description: "Allow timely reminders and follow-ups",
  }),
  Object.freeze({
    key: "notificationsEnabled",
    label: "Notifications",
    description: "Show local app notifications",
  }),
]);

export const PROVIDER_SELECTOR_CAPABILITIES = Object.freeze([
  Object.freeze({ id: "chat", label: "Chat", settingKey: "provider:default:chat" }),
  Object.freeze({ id: "realtime", label: "Realtime", settingKey: "provider:default:realtime" }),
  Object.freeze({
    id: "embeddings",
    label: "Embeddings",
    settingKey: "provider:default:embeddings",
  }),
  Object.freeze({ id: "tts", label: "TTS", settingKey: "provider:default:tts" }),
  Object.freeze({ id: "stt", label: "STT", settingKey: "provider:default:stt" }),
]);

const OLLAMA_POTENTIAL_CAPABILITIES = Object.freeze({
  chat: true,
  embeddings: true,
  realtime: false,
  tts: false,
  stt: false,
});
const STATUS_TONES = Object.freeze({
  connected: "success",
  configured: "warning",
  missing: "danger",
});
const MODEL_SETTING_PREFIX = "provider";
const ACTIVE_PERSONA_SETTING_KEY = "active_persona_id";
const WAKE_UNAVAILABLE_MESSAGE =
  "Wake controls are unavailable until the wake runtime and IPC bridge are installed.";
const DEFAULT_PERSONA_STATE = Object.freeze({
  id: "default",
  name: "Leena",
  tone: "warm, direct, conversational",
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function getAppearanceValues(key) {
  return SETTINGS_MOCK_DATA.appearance[key]?.map((item) => item.value) ?? [];
}

function assertAppearancePreference(key, value) {
  if (!Object.hasOwn(APPEARANCE_STORAGE_KEYS, key)) {
    throw new Error(`Unknown appearance preference: ${key}`);
  }

  if (!getAppearanceValues(key).includes(value)) {
    throw new Error(`Unknown ${key} value: ${value}`);
  }
}

function isLeenaWrapper(node) {
  return Boolean(
    node?.dataset &&
      (node.matches?.("#app-shell.leena") ??
        (node.id === "app-shell" && node.classList?.contains?.("leena"))),
  );
}

function resolveAppearanceRoot(root) {
  if (isLeenaWrapper(root)) {
    return root;
  }

  if (root?.querySelector) {
    return root.querySelector("#app-shell.leena");
  }

  if (typeof document !== "undefined") {
    return document.querySelector("#app-shell.leena");
  }

  return null;
}

function updateControlState(root, key, value) {
  if (!root?.querySelectorAll) {
    return;
  }

  for (const control of root.querySelectorAll(`[data-appearance-key="${key}"]`)) {
    control.setAttribute("aria-pressed", String(control.dataset.appearanceValue === value));
  }
}

export function applyAppearancePreference(root, key, value, options = {}) {
  assertAppearancePreference(key, value);
  const { persistLocalStorage = true } = options;

  const wrapper = resolveAppearanceRoot(root);
  if (wrapper?.dataset) {
    wrapper.dataset[key] = value;
  }

  if (persistLocalStorage) {
    getStorage()?.setItem(APPEARANCE_STORAGE_KEYS[key], value);
  }
  updateControlState(root, key, value);
  return value;
}

export async function persistAppearancePreference(root, key, value, bridge = getLeenaBridge()) {
  applyAppearancePreference(root, key, value, { persistLocalStorage: !hasSettingsBridge(bridge) });
  if (hasSettingsBridge(bridge)) {
    await writeSetting(bridge, key, value);
  }
  return value;
}

export function loadAppearancePreferences(root) {
  const storage = getStorage();
  const loaded = {};

  for (const [key, storageKey] of Object.entries(APPEARANCE_STORAGE_KEYS)) {
    const storedValue = storage?.getItem(storageKey);
    const value = getAppearanceValues(key).includes(storedValue)
      ? storedValue
      : DEFAULT_APPEARANCE[key];
    applyAppearancePreference(root, key, value);
    loaded[key] = value;
  }

  return loaded;
}

export function createSettingsScreenController(root, bridge = getLeenaBridge()) {
  const state = {
    activePersona: { ...DEFAULT_PERSONA_STATE },
    personas: [],
    profile: {},
    settings: {},
    hotkey: DEFAULT_HOTKEY_ACCELERATOR,
    wakeAvailable: hasWakeBridge(bridge),
    wakeStatus: {
      enabled: false,
      muted: false,
      running: false,
      listening: false,
    },
  };

  const controller = {
    state,
    async load() {
      const data = await loadSettingsScreenData(root, bridge);
      Object.assign(state, data);
      return state;
    },
    async saveAppearance(key, value) {
      await persistAppearancePreference(root, key, value, bridge);
      state.settings[key] = value;
      return value;
    },
    async saveSetting(key, value) {
      await saveSettingsValue(root, bridge, key, value);
      state.settings[key] = value;
      return value;
    },
    async saveHotkey(accelerator) {
      const previousHotkey = state.hotkey || DEFAULT_HOTKEY_ACCELERATOR;
      try {
        const normalizedAccelerator = normalizeHotkeyAccelerator(accelerator);
        const result = await writeHotkey(bridge, normalizedAccelerator);
        if (result.success === false) {
          applyHotkeyState(root, previousHotkey, result);
          return result;
        }

        const savedAccelerator = normalizeHotkeyOrDefault(
          result.accelerator,
          normalizedAccelerator,
        );
        state.hotkey = savedAccelerator;
        state.settings.hotkey = savedAccelerator;
        const savedResult = { ...result, accelerator: savedAccelerator, success: true };
        applyHotkeyState(root, savedAccelerator, savedResult);
        return savedResult;
      } catch (error) {
        const failure = {
          accelerator: String(accelerator ?? ""),
          error: getErrorMessage(error),
          success: false,
        };
        applyHotkeyState(root, previousHotkey, failure);
        return failure;
      }
    },
    async saveProfileName(name) {
      const nextName = normalizeString(name);
      const currentProfile =
        (await callOptionalBridge(bridge?.getAgentProfile, bridge)) ?? state.profile ?? {};
      state.profile = await callRequiredBridge(bridge?.setAgentProfile, bridge, {
        ...currentProfile,
        name: nextName,
      });
      applyIdentityState(root, state.profile, state.activePersona);
      return state.profile;
    },
    async switchPersona(personaId) {
      const normalizedPersonaId = normalizeString(personaId);
      if (!normalizedPersonaId) {
        return null;
      }
      const previousPersona = state.activePersona;
      const switchedPersona =
        (await callRequiredBridge(
          bridge?.identity?.switchPersona,
          bridge?.identity,
          normalizedPersonaId,
        )) ??
        state.personas.find((persona) => persona.id === normalizedPersonaId) ??
        null;
      state.activePersona = normalizePersona(switchedPersona) ?? state.activePersona;
      const currentProfile =
        (await callOptionalBridge(bridge?.getAgentProfile, bridge)) ?? state.profile ?? {};
      if (typeof bridge?.setAgentProfile === "function") {
        state.profile = await bridge.setAgentProfile({
          ...currentProfile,
          persona: normalizedPersonaId,
          personaId: normalizedPersonaId,
        });
      } else {
        state.profile = {
          ...currentProfile,
          persona: normalizedPersonaId,
          personaId: normalizedPersonaId,
        };
      }
      applyIdentityState(root, state.profile, state.activePersona);
      applyPersonaOptions(root, state.personas, normalizedPersonaId);
      emitPersonaChanged(root, {
        activePersona: state.activePersona,
        previousPersona,
        profile: state.profile,
      });
      return state.activePersona;
    },
    async setWakeEnabled(enabled) {
      if (!hasWakeBridge(bridge)) {
        applyWakeState(root, state.wakeStatus, false);
        return null;
      }
      const result = await setWakeEnabled(bridge, enabled);
      state.wakeStatus = normalizeWakeStatus({
        ...state.wakeStatus,
        ...(isRecord(result) ? result : {}),
        enabled: Boolean(result?.enabled ?? enabled),
      });
      applyWakeState(root, state.wakeStatus, true);
      return state.wakeStatus;
    },
    async setWakeMuted(muted) {
      if (!hasWakeBridge(bridge)) {
        applyWakeState(root, state.wakeStatus, false);
        return null;
      }
      const result = await setWakeMuted(bridge, muted);
      state.wakeStatus = normalizeWakeStatus({
        ...state.wakeStatus,
        ...(isRecord(result) ? result : {}),
        muted: Boolean(result?.muted ?? muted),
      });
      applyWakeState(root, state.wakeStatus, true);
      return state.wakeStatus;
    },
  };

  return controller;
}

export async function loadSettingsScreenData(root, bridge = getLeenaBridge()) {
  const settings = await readAllSettings(bridge);
  applySettingsAppearance(root, settings);
  applyGeneralSettings(root, settings);

  const hotkey = await readHotkey(bridge, settings.hotkey);
  applyHotkeyState(root, hotkey);

  const profile = normalizeProfile(
    (await callOptionalBridge(bridge?.getAgentProfile, bridge)) ?? {},
  );
  const personas = normalizePersonas(
    (await callOptionalBridge(bridge?.identity?.listPersonas, bridge?.identity)) ?? [],
  );
  const activePersonaId =
    normalizeString(profile.personaId ?? profile.persona ?? settings[ACTIVE_PERSONA_SETTING_KEY]) ||
    personas[0]?.id ||
    DEFAULT_PERSONA_STATE.id;
  const activePersona = normalizePersona(
    profile.activePersona ?? personas.find((persona) => persona.id === activePersonaId),
  ) ?? { ...DEFAULT_PERSONA_STATE, id: activePersonaId };
  applyIdentityState(root, profile, activePersona);
  applyPersonaOptions(root, personas, activePersona.id);

  const wakeAvailable = hasWakeBridge(bridge);
  const wakeStatus = wakeAvailable
    ? normalizeWakeStatus(await getWakeStatus(bridge))
    : normalizeWakeStatus({
        enabled: settings.wakeEnabled,
        muted: settings.wakeMuted,
        running: false,
        listening: false,
      });
  applyWakeState(root, wakeStatus, wakeAvailable);

  return {
    activePersona,
    hotkey,
    personas,
    profile,
    settings,
    wakeAvailable,
    wakeStatus,
  };
}

export async function saveSettingsValue(root, bridge, key, value) {
  const settingKey = normalizeString(key);
  if (!settingKey) {
    throw new Error("Setting key is required.");
  }
  const savedValue = await writeSetting(bridge, settingKey, value);
  applyGeneralSetting(root, settingKey, savedValue);
  return savedValue;
}

export function bindSettingsControls(root, bridge = getLeenaBridge()) {
  if (!root?.querySelectorAll) {
    return null;
  }

  const controller = createSettingsScreenController(root, bridge);

  if (hasSettingsBridge(bridge)) {
    void controller.load().catch((error) => {
      setSettingsStatus(root, `Settings unavailable: ${getErrorMessage(error)}`);
    });
  } else {
    loadAppearancePreferences(root);
    applyHotkeyState(root, DEFAULT_HOTKEY_ACCELERATOR);
    applyWakeState(root, { enabled: false, muted: false, running: false, listening: false }, false);
  }

  for (const control of root.querySelectorAll("[data-appearance-key][data-appearance-value]")) {
    control.addEventListener("click", () => {
      void controller.saveAppearance(
        control.dataset.appearanceKey,
        control.dataset.appearanceValue,
      );
    });
  }

  for (const control of root.querySelectorAll("[data-settings-toggle]")) {
    control.addEventListener("click", () => {
      const key = control.dataset.settingsToggle;
      const nextValue = control.getAttribute?.("aria-checked") !== "true";
      void controller.saveSetting(key, nextValue);
    });
  }

  root.querySelector?.("[data-agent-name]")?.addEventListener?.("change", (event) => {
    void controller.saveProfileName(event.target?.value ?? "");
  });

  root.querySelector?.("[data-persona-select]")?.addEventListener?.("change", (event) => {
    void controller.switchPersona(event.target?.value ?? "");
  });

  root.querySelector?.("[data-wake-enabled]")?.addEventListener?.("click", () => {
    const button = root.querySelector?.("[data-wake-enabled]");
    const enabled = button?.getAttribute?.("aria-checked") !== "true";
    void controller.setWakeEnabled(enabled);
  });

  root.querySelector?.("[data-wake-muted]")?.addEventListener?.("click", () => {
    const button = root.querySelector?.("[data-wake-muted]");
    const muted = button?.getAttribute?.("aria-checked") !== "true";
    void controller.setWakeMuted(muted);
  });

  bindHotkeyControls(root, controller);
  bindProviderModelSelector(root, bridge);
  return root;
}

function bindHotkeyControls(root, controller) {
  const input = queryOne(root, "[data-hotkey-input]");
  const saveButton = queryOne(root, "[data-hotkey-save]");
  const defaultButton = queryOne(root, "[data-hotkey-default]");
  const recordButton = queryOne(root, "[data-hotkey-record]");
  let recording = false;

  saveButton?.addEventListener?.("click", () => {
    void controller.saveHotkey(input?.value ?? "");
  });

  defaultButton?.addEventListener?.("click", () => {
    setNodeValue(input, DEFAULT_HOTKEY_ACCELERATOR);
    applyHotkeyPreview(root, DEFAULT_HOTKEY_ACCELERATOR);
    void controller.saveHotkey(DEFAULT_HOTKEY_ACCELERATOR);
  });

  recordButton?.addEventListener?.("click", () => {
    recording = true;
    setNodeText(queryOne(root, "[data-hotkey-status]"), "Press shortcut");
    input?.focus?.();
  });

  input?.addEventListener?.("input", () => {
    applyHotkeyPreview(root, input.value);
  });

  input?.addEventListener?.("keydown", (event) => {
    if (!recording && event.key === "Enter") {
      event.preventDefault?.();
      void controller.saveHotkey(input.value);
      return;
    }

    if (!recording) {
      return;
    }

    event.preventDefault?.();
    const accelerator = createAcceleratorFromKeyboardEvent(event);
    if (!accelerator) {
      return;
    }
    recording = false;
    setNodeValue(input, accelerator);
    applyHotkeyPreview(root, accelerator);
  });
}

export function bindProviderModelSelector(root, bridge = getLeenaBridge()) {
  const mount = resolveProviderSelectorMount(root);
  if (!mount) {
    return null;
  }

  const controller = createProviderModelSelectorController(mount, bridge);
  controller.bind();
  if (bridge?.providers?.list) {
    void controller.load().catch((error) => {
      controller.setStatus(`Provider setup unavailable: ${getErrorMessage(error)}`, "error");
    });
  }
  return controller;
}

export function createProviderSelectorState(overrides = {}) {
  return {
    activeProviderId: "",
    configs: {},
    loadingModels: {},
    maskedApiKey: true,
    modelErrors: {},
    models: {},
    modalOpen: false,
    pull: {
      model: "",
      pct: 0,
      state: "idle",
      status: "",
    },
    selectedModels: {},
    selectedProviders: {},
    statusMessage: "",
    statusTone: "neutral",
    testResults: {},
    ...overrides,
    providers: normalizeProviders(overrides.providers ?? SETTINGS_MOCK_DATA.providers),
  };
}

export function createProviderModelSelectorController(mount, bridge = getLeenaBridge()) {
  const state = createProviderSelectorState();
  let pullProgressListener = null;

  const controller = {
    state,
    bind() {
      render();
      mount.addEventListener?.("click", handleClick);
      mount.addEventListener?.("change", handleChange);
      mount.addEventListener?.("input", handleInput);
      pullProgressListener =
        bridge?.ollama?.onPullProgress?.((payload) => controller.handlePullProgress(payload)) ??
        null;
      return controller;
    },
    destroy() {
      if (pullProgressListener) {
        bridge?.ollama?.offPullProgress?.(pullProgressListener);
        pullProgressListener = null;
      }
    },
    async load() {
      state.providers = normalizeProviders(await bridge.providers.list());
      state.configs = Object.fromEntries(
        await Promise.all(
          state.providers.map(async (provider) => [
            provider.id,
            normalizeProviderConfig(await bridge.providers.getConfig(provider.id)),
          ]),
        ),
      );
      await loadCapabilitySelections();
      await refreshSelectedModels();
      render();
      return state;
    },
    setStatus(message, tone = "neutral") {
      state.statusMessage = message;
      state.statusTone = tone;
      render();
      return state.statusMessage;
    },
    async openProviderConfig(providerId) {
      state.activeProviderId = normalizeProviderId(providerId);
      state.configs[state.activeProviderId] = normalizeProviderConfig(
        state.configs[state.activeProviderId] ??
          (await bridge?.providers?.getConfig?.(state.activeProviderId)),
      );
      state.maskedApiKey = true;
      state.modalOpen = true;
      render();
      return state.configs[state.activeProviderId];
    },
    closeProviderConfig() {
      state.modalOpen = false;
      state.activeProviderId = "";
      render();
    },
    async testProviderConnection(providerId = state.activeProviderId) {
      const normalizedProviderId = normalizeProviderId(providerId);
      state.testResults[normalizedProviderId] = { loading: true };
      render();
      const result = await bridge.providers.testConnection(normalizedProviderId);
      state.testResults[normalizedProviderId] = normalizeConnectionResult(result);
      state.providers = state.providers.map((provider) =>
        provider.id === normalizedProviderId && state.testResults[normalizedProviderId].ok
          ? { ...provider, connected: true }
          : provider,
      );
      render();
      return state.testResults[normalizedProviderId];
    },
    async saveProviderConfig(providerId = state.activeProviderId, values = {}) {
      const normalizedProviderId = normalizeProviderId(providerId);
      const currentConfig = normalizeProviderConfig(state.configs[normalizedProviderId]);
      const payload = {
        ...currentConfig,
        ...values,
        defaultModels: {
          ...currentConfig.defaultModels,
          ...collectDefaultModelsForProvider(state, normalizedProviderId),
          ...(values.defaultModels ?? {}),
        },
      };
      const result = await bridge.providers.setConfig(normalizedProviderId, payload);
      if (result?.ok === false) {
        throw new Error(result.error?.message ?? "Provider config failed to save.");
      }
      state.configs[normalizedProviderId] = normalizeProviderConfig(payload);
      state.providers = state.providers.map((provider) =>
        provider.id === normalizedProviderId
          ? { ...provider, configured: result?.configured ?? provider.configured }
          : provider,
      );
      state.modalOpen = false;
      state.statusMessage = "Provider settings saved.";
      state.statusTone = "success";
      render();
      return result;
    },
    async selectProvider(capability, providerId) {
      const normalizedCapability = normalizeCapabilityId(capability);
      const normalizedProviderId = normalizeProviderId(providerId);
      state.selectedProviders[normalizedCapability] = normalizedProviderId;
      state.selectedModels[normalizedCapability] =
        state.configs[normalizedProviderId]?.defaultModels?.[normalizedCapability] ?? "";
      await refreshModels(normalizedProviderId, normalizedCapability);
      await persistCapabilitySelection(normalizedCapability);
      render();
      return state.selectedProviders[normalizedCapability];
    },
    async selectModel(capability, modelId) {
      const normalizedCapability = normalizeCapabilityId(capability);
      state.selectedModels[normalizedCapability] = normalizeString(modelId);
      await persistCapabilitySelection(normalizedCapability);
      render();
      return state.selectedModels[normalizedCapability];
    },
    async refreshProviderModels(providerId) {
      const normalizedProviderId = normalizeProviderId(providerId);
      const provider = getProvider(state.providers, normalizedProviderId);
      const capabilities = PROVIDER_SELECTOR_CAPABILITIES.filter((capability) =>
        providerSupportsCapability(provider, capability.id),
      );
      await Promise.all(
        capabilities.map((capability) => refreshModels(normalizedProviderId, capability.id)),
      );
      render();
    },
    async startOllamaDownload(modelName) {
      const model = normalizeString(modelName);
      if (!model) {
        state.statusMessage = "Enter an Ollama model name.";
        state.statusTone = "error";
        render();
        return null;
      }
      state.pull = {
        model,
        pct: 0,
        state: "pulling",
        status: "starting",
      };
      render();
      const result = await bridge.ollama.pullModel(model, (progress) =>
        controller.handlePullProgress({ ...progress, model }),
      );
      if (result?.ok === false) {
        state.pull = {
          model,
          pct: state.pull.pct,
          state: "error",
          status: result.error?.message ?? "Download failed",
        };
        render();
        return result;
      }
      controller.handlePullSuccess(result?.model ?? model);
      return result;
    },
    handlePullProgress(payload) {
      const model = normalizeString(payload?.model) || state.pull.model;
      if (!model || (state.pull.model && state.pull.model !== model)) {
        return state.pull;
      }
      state.pull = {
        model,
        pct: normalizePercent(payload?.pct, state.pull.pct),
        state: payload?.status === "success" ? "complete" : "pulling",
        status: normalizeString(payload?.status) || state.pull.status,
      };
      render();
      return state.pull;
    },
    handlePullSuccess(modelName) {
      const model = normalizeString(modelName);
      const capabilities = inferOllamaPullCapabilities(model);
      for (const capability of Object.keys(capabilities)) {
        addModelForCapability(state, "ollama", capability, {
          id: model,
          name: model,
          model,
          displayName: model,
          capabilities,
        });
        state.selectedProviders[capability] = "ollama";
        state.selectedModels[capability] = model;
        void persistCapabilitySelection(capability);
      }
      state.pull = {
        model,
        pct: 100,
        state: "complete",
        status: "success",
      };
      state.statusMessage = `${model} is ready.`;
      state.statusTone = "success";
      render();
      return state.pull;
    },
    render,
  };

  async function loadCapabilitySelections() {
    for (const capability of PROVIDER_SELECTOR_CAPABILITIES) {
      const savedProvider = normalizeProviderId(
        (await bridge?.getSetting?.(capability.settingKey, "")) ?? "",
      );
      const providerId = providerSupportsCapability(
        getProvider(state.providers, savedProvider),
        capability.id,
      )
        ? savedProvider
        : getDefaultProviderForCapability(state.providers, capability.id)?.id;
      state.selectedProviders[capability.id] = providerId ?? "";
      state.selectedModels[capability.id] = await loadSelectedModel(capability.id, providerId);
    }
  }

  async function loadSelectedModel(capability, providerId) {
    const normalizedProviderId = normalizeProviderId(providerId);
    if (!normalizedProviderId) {
      return "";
    }
    const configModel = state.configs[normalizedProviderId]?.defaultModels?.[capability];
    if (configModel) {
      return configModel;
    }
    return normalizeString(
      await bridge?.getSetting?.(getProviderModelSettingKey(normalizedProviderId, capability), ""),
    );
  }

  async function refreshSelectedModels() {
    await Promise.all(
      PROVIDER_SELECTOR_CAPABILITIES.map((capability) => {
        const providerId = state.selectedProviders[capability.id];
        return providerId ? refreshModels(providerId, capability.id) : null;
      }),
    );
  }

  async function refreshModels(providerId, capability) {
    const normalizedProviderId = normalizeProviderId(providerId);
    const normalizedCapability = normalizeCapabilityId(capability);
    const key = getProviderCapabilityKey(normalizedProviderId, normalizedCapability);
    state.loadingModels[key] = true;
    state.modelErrors[key] = "";
    render();
    const result = await bridge.providers.getModels(normalizedProviderId, normalizedCapability);
    if (result?.ok === false) {
      state.modelErrors[key] = result.error?.message ?? "Models could not be loaded.";
      setProviderModels(state, normalizedProviderId, normalizedCapability, []);
      state.loadingModels[key] = false;
      render();
      return [];
    }
    const models = normalizeProviderModels(result, normalizedCapability);
    setProviderModels(state, normalizedProviderId, normalizedCapability, models);
    const selectedModel = state.selectedModels[normalizedCapability];
    if (!selectedModel && models[0]?.id) {
      state.selectedModels[normalizedCapability] = models[0].id;
    }
    state.loadingModels[key] = false;
    render();
    return models;
  }

  async function persistCapabilitySelection(capability) {
    const providerId = state.selectedProviders[capability];
    const model = state.selectedModels[capability];
    if (!providerId) {
      return;
    }
    await bridge?.setSetting?.(`provider:default:${capability}`, providerId);
    if (model) {
      await bridge?.setSetting?.(getProviderModelSettingKey(providerId, capability), model);
    }
    const currentConfig = normalizeProviderConfig(state.configs[providerId]);
    state.configs[providerId] = {
      ...currentConfig,
      defaultModels: {
        ...currentConfig.defaultModels,
        [capability]: model,
      },
    };
    await bridge?.providers?.setConfig?.(providerId, {
      defaultModels: state.configs[providerId].defaultModels,
    });
  }

  function handleClick(event) {
    const target = event.target;
    const configure = target?.closest?.("[data-provider-configure]");
    if (configure) {
      void controller.openProviderConfig(configure.dataset.providerConfigure);
      return;
    }

    if (target?.closest?.("[data-provider-modal-close]")) {
      controller.closeProviderConfig();
      return;
    }

    if (target?.closest?.("[data-api-key-toggle]")) {
      toggleApiKeyMaskFromMount();
      return;
    }

    const testButton = target?.closest?.("[data-provider-test]");
    if (testButton) {
      void controller.testProviderConnection(testButton.dataset.providerTest);
      return;
    }

    const saveButton = target?.closest?.("[data-provider-save]");
    if (saveButton) {
      void controller.saveProviderConfig(saveButton.dataset.providerSave, readProviderForm());
      return;
    }

    const refreshButton = target?.closest?.("[data-provider-refresh]");
    if (refreshButton) {
      void controller.refreshProviderModels(refreshButton.dataset.providerRefresh);
      return;
    }

    if (target?.closest?.("[data-ollama-download]")) {
      const input = mount.querySelector?.("[data-ollama-model-input]");
      void controller.startOllamaDownload(input?.value);
    }
  }

  function handleChange(event) {
    const target = event.target;
    if (target?.dataset?.capabilityProvider) {
      void controller.selectProvider(target.dataset.capabilityProvider, target.value);
      return;
    }
    if (target?.dataset?.capabilityModel) {
      void controller.selectModel(target.dataset.capabilityModel, target.value);
    }
  }

  function handleInput(event) {
    const target = event.target;
    if (target?.dataset?.providerApiKey) {
      state.configs[state.activeProviderId] = {
        ...normalizeProviderConfig(state.configs[state.activeProviderId]),
        apiKey: target.value,
      };
    }
    if (target?.dataset?.providerBaseUrl) {
      state.configs[state.activeProviderId] = {
        ...normalizeProviderConfig(state.configs[state.activeProviderId]),
        baseUrl: target.value,
      };
    }
  }

  function readProviderForm() {
    return {
      apiKey: mount.querySelector?.("[data-provider-api-key]")?.value ?? "",
      baseUrl: mount.querySelector?.("[data-provider-base-url]")?.value ?? "",
    };
  }

  function toggleApiKeyMaskFromMount() {
    state.maskedApiKey = !state.maskedApiKey;
    const input = mount.querySelector?.("[data-provider-api-key]");
    const button = mount.querySelector?.("[data-api-key-toggle]");
    if (input && button) {
      toggleApiKeyInputMask(input, button);
    } else {
      render();
    }
  }

  function render() {
    mount.innerHTML = renderProviderModelSelectorContent(state);
    return mount.innerHTML;
  }

  return controller;
}

function renderSegmentedControl(key, label, options) {
  return `
    <div class="row settings-row">
      <span class="row__txt">
        <strong class="lx-body">${escapeHtml(label)}</strong>
        <span class="lx-sm">Saved across Leena windows</span>
      </span>
      <div class="settings-segmented" role="group" aria-label="${escapeHtml(label)}">
        ${options
          .map(
            (option) => `
              <button
                class="btn btn--ghost"
                type="button"
                data-appearance-key="${escapeHtml(key)}"
                data-appearance-value="${escapeHtml(option.value)}"
                aria-pressed="${String(option.value === DEFAULT_APPEARANCE[key])}"
              >
                ${escapeHtml(option.label)}
              </button>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

export function renderProviderModelSelector(state = createProviderSelectorState()) {
  const normalizedState = {
    ...createProviderSelectorState(),
    ...state,
    providers: normalizeProviders(state.providers ?? SETTINGS_MOCK_DATA.providers),
  };
  return `
    <div class="settings-provider-selector" data-provider-model-selector>
      ${renderProviderModelSelectorContent(normalizedState)}
    </div>
  `;
}

function renderProviderModelSelectorContent(state) {
  return `
      <div class="settings-provider-grid" data-provider-cards>
        ${state.providers.map((provider) => renderProviderCard(provider, state)).join("")}
      </div>
      <div class="settings-capability-map" data-capability-rows>
        ${PROVIDER_SELECTOR_CAPABILITIES.map((capability) =>
          renderCapabilityRow(capability, state),
        ).join("")}
      </div>
      <div class="settings-ollama-download" aria-label="Ollama model download">
        <label class="settings-field">
          <span class="lx-sm">Ollama model</span>
          <input
            class="settings-input"
            type="text"
            data-ollama-model-input
            value="${escapeHtml(state.pull.model)}"
            placeholder="llama3.2 or nomic-embed-text"
          />
        </label>
        <button class="btn btn--primary" type="button" data-ollama-download>Download</button>
        ${renderPullProgress(state.pull)}
      </div>
      <p class="lx-sm settings-status settings-status--${escapeHtml(state.statusTone)}" ${
        state.statusMessage ? "" : "hidden"
      }>
        ${escapeHtml(state.statusMessage)}
      </p>
      ${renderProviderModal(state)}
  `;
}

function renderSwitchControl({
  checked = false,
  description = "",
  disabled = false,
  label,
  toggleAttribute,
  title = "",
}) {
  const disabledAttribute = disabled ? "disabled" : "";
  const titleAttribute = title ? `title="${escapeHtml(title)}"` : "";
  return `
    <article class="row">
      <span class="row__txt">
        <strong class="lx-body">${escapeHtml(label)}</strong>
        <span class="lx-sm" data-settings-toggle-status="${escapeHtml(
          toggleAttribute,
        )}">${escapeHtml(description || (checked ? "On" : "Off"))}</span>
      </span>
      <button
        class="btn btn--ghost"
        type="button"
        role="switch" aria-checked="${String(checked)}"
        ${
          toggleAttribute.startsWith("wake:")
            ? `data-wake-${escapeHtml(toggleAttribute.slice(5))}`
            : `data-settings-toggle="${escapeHtml(toggleAttribute)}"`
        }
        ${disabledAttribute}
        ${titleAttribute}
      >
        ${checked ? "On" : "Off"}
      </button>
    </article>
  `;
}

function renderHotkeySettings() {
  return `
      <section class="card settings-card" aria-labelledby="settings-hotkey-title">
        <div class="settings-card__head">
          <h2 id="settings-hotkey-title" class="lx-h2">Keyboard Shortcut</h2>
          <span class="lx-sm text-dim" data-hotkey-display>${escapeHtml(
            formatHotkeyAccelerator(DEFAULT_HOTKEY_ACCELERATOR),
          )}</span>
        </div>
        <div class="settings-hotkey-row">
          <label class="settings-field">
            <span class="lx-sm">Shortcut</span>
            <input
              class="settings-input"
              type="text"
              data-hotkey-input
              value="${escapeHtml(DEFAULT_HOTKEY_ACCELERATOR)}"
              autocomplete="off"
              spellcheck="false"
            />
          </label>
          <div class="settings-provider-actions settings-hotkey-actions">
            <button class="btn btn--ghost" type="button" data-hotkey-record>Record</button>
            <button class="btn btn--ghost" type="button" data-hotkey-default>Default</button>
            <button class="btn btn--primary" type="button" data-hotkey-save>Save</button>
          </div>
        </div>
        <p class="lx-sm settings-status" data-hotkey-status></p>
      </section>
  `;
}

export function renderSettings() {
  return `
    <section class="settings-screen" aria-label="Settings">
      <section class="panel-glass settings-identity" aria-labelledby="settings-identity-title">
        <div class="orb settings-avatar" aria-hidden="true"></div>
        <span class="row__txt">
          <h1 data-settings-identity-name id="settings-identity-title" class="lx-h2">${escapeHtml(SETTINGS_MOCK_DATA.identity.name)}</h1>
          <span data-settings-identity-email class="lx-sm text-dim">${escapeHtml(SETTINGS_MOCK_DATA.identity.email)}</span>
        </span>
        <button class="btn btn--ghost" type="button">Edit</button>
        <label class="settings-field">
          <span class="lx-sm">Your name</span>
          <input
            class="settings-input"
            type="text"
            data-agent-name
            value="${escapeHtml(SETTINGS_MOCK_DATA.identity.name)}"
            autocomplete="name"
          />
        </label>
        <label class="settings-field">
          <span class="lx-sm">Persona</span>
          <select class="settings-select" data-persona-select>
            <option value="">Loading personas</option>
          </select>
        </label>
        <label class="settings-field">
          <span class="lx-sm">Tone</span>
          <input
            class="settings-input"
            type="text"
            data-persona-tone
            value=""
            readonly
          />
        </label>
      </section>

      <section class="card settings-card" aria-labelledby="settings-appearance-title">
        <h2 id="settings-appearance-title" class="lx-h2">Appearance</h2>
        ${renderSegmentedControl("theme", "Theme", SETTINGS_MOCK_DATA.appearance.theme)}
        ${renderSegmentedControl("treatment", "Treatment", SETTINGS_MOCK_DATA.appearance.treatment)}
        ${renderSegmentedControl("density", "Density", SETTINGS_MOCK_DATA.appearance.density)}
      </section>

      ${renderHotkeySettings()}

      <section class="card settings-card" aria-labelledby="settings-providers-title">
        <div class="settings-card__head">
          <h2 id="settings-providers-title" class="lx-h2">Providers</h2>
          <span class="lx-sm text-dim">Defaults by capability</span>
        </div>
        ${renderProviderModelSelector()}
      </section>

      <section class="card settings-card" aria-labelledby="settings-features-title">
        <div class="settings-card__head">
          <h2 id="settings-features-title" class="lx-h2">Features</h2>
          <span class="lx-sm text-dim" data-settings-status></span>
        </div>
        <div class="settings-list">
          ${renderSwitchControl({
            checked: false,
            description: WAKE_UNAVAILABLE_MESSAGE,
            disabled: true,
            label: "Wake Word",
            title: WAKE_UNAVAILABLE_MESSAGE,
            toggleAttribute: "wake:enabled",
          })}
          ${renderSwitchControl({
            checked: false,
            description: "Muted until wake runtime is available",
            disabled: true,
            label: "Always Listening",
            title: WAKE_UNAVAILABLE_MESSAGE,
            toggleAttribute: "wake:muted",
          })}
          ${GENERAL_SETTING_CONTROLS.map((control) =>
            renderSwitchControl({
              checked: control.key === "notificationsEnabled",
              description: control.description,
              label: control.label,
              toggleAttribute: control.key,
            }),
          ).join("")}
          <p class="lx-sm text-dim" data-wake-status>${escapeHtml(WAKE_UNAVAILABLE_MESSAGE)}</p>
        </div>
      </section>
    </section>
  `;
}

function renderProviderCard(provider, state) {
  const status = getProviderStatus(provider);
  const testResult = state.testResults[provider.id];
  return `
    <article class="settings-provider-cardlet" data-provider-card="${escapeHtml(provider.id)}">
      <div class="settings-provider-cardlet__head">
        <span class="tooldot" aria-hidden="true">${escapeHtml(provider.name.at(0))}</span>
        <span class="row__txt">
          <strong class="lx-body">${escapeHtml(provider.name)}</strong>
          <span class="lx-sm">${escapeHtml(provider.model)}</span>
        </span>
        <span class="chip settings-chip--${escapeHtml(status.tone)}">
          <span class="dot" aria-hidden="true"></span>
          ${escapeHtml(status.label)}
        </span>
      </div>
      <div class="settings-provider-capabilities" aria-label="${escapeHtml(provider.name)} capabilities">
        ${PROVIDER_SELECTOR_CAPABILITIES.filter((capability) =>
          providerSupportsCapability(provider, capability.id),
        )
          .map((capability) => `<span class="chip">${escapeHtml(capability.label)}</span>`)
          .join("")}
      </div>
      <div class="settings-provider-actions">
        <button class="btn btn--ghost" type="button" data-provider-configure="${escapeHtml(
          provider.id,
        )}">Configure</button>
        <button class="btn btn--ghost" type="button" data-provider-test="${escapeHtml(
          provider.id,
        )}">Test</button>
        <button class="btn btn--ghost" type="button" data-provider-refresh="${escapeHtml(
          provider.id,
        )}">Refresh Models</button>
      </div>
      <p class="lx-sm settings-provider-result" ${testResult ? "" : "hidden"}>
        ${escapeHtml(formatTestResult(testResult))}
      </p>
    </article>
  `;
}

function renderCapabilityRow(capability, state) {
  const providers = filterProvidersForCapability(state.providers, capability.id);
  const selectedProviderId =
    state.selectedProviders[capability.id] ||
    getDefaultProviderForCapability(state.providers, capability.id)?.id ||
    providers[0]?.id ||
    "";
  const selectedModel = state.selectedModels[capability.id] ?? "";
  const models = getModelsForCapability(state, selectedProviderId, capability.id);
  const key = getProviderCapabilityKey(selectedProviderId, capability.id);
  const loading = state.loadingModels[key] === true;
  const error = state.modelErrors[key];

  return `
    <article class="settings-capability-row">
      <span class="row__txt">
        <strong class="lx-body">${escapeHtml(capability.label)}</strong>
        <span class="lx-sm">${escapeHtml(getCapabilityHint(capability.id))}</span>
      </span>
      <label class="settings-field">
        <span class="sr-only">${escapeHtml(capability.label)} provider</span>
        <select class="settings-select" data-capability-provider="${escapeHtml(capability.id)}" ${
          providers.length === 0 ? "disabled" : ""
        }>
          ${providers
            .map(
              (provider) => `
                <option value="${escapeHtml(provider.id)}" ${
                  provider.id === selectedProviderId ? "selected" : ""
                }>${escapeHtml(provider.name)}</option>
              `,
            )
            .join("")}
        </select>
      </label>
      <label class="settings-field">
        <span class="sr-only">${escapeHtml(capability.label)} model</span>
        <select class="settings-select" data-capability-model="${escapeHtml(capability.id)}" ${
          loading || !selectedProviderId ? "disabled" : ""
        }>
          ${renderModelOptions(models, selectedModel, loading, error)}
        </select>
      </label>
    </article>
  `;
}

function renderModelOptions(models, selectedModel, loading, error) {
  if (loading) {
    return '<option value="">Loading models</option>';
  }
  if (error) {
    return `<option value="">${escapeHtml(error)}</option>`;
  }
  if (models.length === 0) {
    return '<option value="">No models found</option>';
  }
  const options =
    selectedModel && !models.some((model) => model.id === selectedModel)
      ? [{ id: selectedModel, displayName: selectedModel }, ...models]
      : models;
  return options
    .map(
      (model) => `
        <option value="${escapeHtml(model.id)}" ${model.id === selectedModel ? "selected" : ""}>
          ${escapeHtml(model.displayName ?? model.name ?? model.id)}
        </option>
      `,
    )
    .join("");
}

function renderPullProgress(pull) {
  if (pull.state === "idle") {
    return '<span class="lx-sm text-dim">Ready for local chat or embedding models</span>';
  }
  return `
    <progress
      class="settings-progress"
      data-state="${escapeHtml(pull.state)}"
      max="100"
      value="${escapeHtml(normalizePercent(pull.pct, 0))}"
    >${escapeHtml(normalizePercent(pull.pct, 0))}%</progress>
    <span class="lx-sm">${escapeHtml(pull.status || `${pull.pct}%`)}</span>
  `;
}

function renderProviderModal(state) {
  const provider = getProvider(state.providers, state.activeProviderId);
  const config = normalizeProviderConfig(state.configs[state.activeProviderId]);
  const testResult = state.testResults[state.activeProviderId];
  return `
    <div class="settings-provider-modal" data-provider-config-modal ${
      state.modalOpen ? "" : "hidden"
    }>
      <div class="settings-provider-modal__dialog" role="dialog" aria-modal="true">
        <div class="settings-card__head">
          <span>
            <h3 class="lx-h3">${escapeHtml(provider?.name ?? "Provider")}</h3>
            <span class="lx-sm text-dim">Connection and default models</span>
          </span>
          <button class="btn btn--ghost" type="button" data-provider-modal-close>Close</button>
        </div>
        <label class="settings-field">
          <span class="lx-sm">API key</span>
          <span class="settings-secret">
            <input
              class="settings-input"
              type="${state.maskedApiKey ? "password" : "text"}"
              data-provider-api-key
              value="${escapeHtml(config.apiKey ?? "")}"
              autocomplete="off"
            />
            <button
              class="btn btn--ghost"
              type="button"
              data-api-key-toggle
              aria-pressed="${String(!state.maskedApiKey)}"
            >${state.maskedApiKey ? "Show" : "Hide"}</button>
          </span>
        </label>
        <label class="settings-field">
          <span class="lx-sm">Base URL</span>
          <input
            class="settings-input"
            type="url"
            data-provider-base-url
            value="${escapeHtml(config.baseUrl ?? "")}"
            placeholder="http://localhost:11434"
          />
        </label>
        <div class="settings-provider-actions">
          <button class="btn btn--ghost" type="button" data-provider-test="${escapeHtml(
            state.activeProviderId,
          )}">Test Connection</button>
          <button class="btn btn--primary" type="button" data-provider-save="${escapeHtml(
            state.activeProviderId,
          )}">Save</button>
        </div>
        <p class="lx-sm settings-provider-result" ${testResult ? "" : "hidden"}>
          ${escapeHtml(formatTestResult(testResult))}
        </p>
      </div>
    </div>
  `;
}

export function providerSupportsCapability(provider, capability) {
  const normalizedCapability = normalizeCapabilityId(capability);
  const normalizedProviderId = normalizeProviderId(provider?.id ?? provider?.name);
  if (normalizedProviderId === "ollama") {
    return provider?.capabilities?.[normalizedCapability] === true
      ? true
      : OLLAMA_POTENTIAL_CAPABILITIES[normalizedCapability] === true;
  }
  return provider?.capabilities?.[normalizedCapability] === true;
}

export function filterProvidersForCapability(providers, capability) {
  return normalizeProviders(providers).filter((provider) =>
    providerSupportsCapability(provider, capability),
  );
}

export function normalizeProviderModels(models, capability) {
  if (!Array.isArray(models)) {
    return [];
  }
  const normalizedCapability = normalizeCapabilityId(capability);
  return models
    .map((model) => normalizeProviderModel(model, normalizedCapability))
    .filter((model) => model.id && model.capabilities[normalizedCapability] === true);
}

export function inferOllamaPullCapabilities(modelName) {
  const haystack = normalizeString(modelName).toLowerCase();
  const isEmbedding = /\b(embed|embedding|nomic|bge|minilm|e5)\b/.test(haystack);
  return isEmbedding ? { embeddings: true } : { chat: true };
}

export function toggleApiKeyInputMask(input, button) {
  const nextType = input.type === "password" ? "text" : "password";
  input.type = nextType;
  button?.setAttribute?.("aria-pressed", String(nextType === "text"));
  if (button && "textContent" in button) {
    button.textContent = nextType === "text" ? "Hide" : "Show";
  }
  return nextType;
}

function resolveProviderSelectorMount(root) {
  if (root?.dataset?.providerModelSelector !== undefined) {
    return root;
  }
  return root?.querySelector?.("[data-provider-model-selector]") ?? null;
}

function getLeenaBridge() {
  return globalThis.window?.leena ?? globalThis.leena ?? null;
}

function hasSettingsBridge(bridge) {
  return typeof bridge?.getAllSettings === "function" || typeof bridge?.invoke === "function";
}

function hasWakeBridge(bridge) {
  return Boolean(
    bridge?.wake &&
      (typeof bridge.wake.getStatus === "function" || typeof bridge.invoke === "function") &&
      (typeof bridge.wake.setEnabled === "function" || typeof bridge.invoke === "function") &&
      (typeof bridge.wake.mute === "function" || typeof bridge.invoke === "function"),
  );
}

async function readAllSettings(bridge) {
  if (typeof bridge?.getAllSettings === "function") {
    return normalizeSettingsRecord(await bridge.getAllSettings());
  }
  if (typeof bridge?.invoke === "function") {
    return normalizeSettingsRecord(await bridge.invoke("settings:get-all"));
  }
  return {};
}

async function writeSetting(bridge, key, value) {
  if (key === "launchOnLogin" && typeof bridge?.setLaunchOnLogin === "function") {
    return bridge.setLaunchOnLogin(Boolean(value));
  }
  if (key === "launchOnLogin" && typeof bridge?.invoke === "function") {
    return bridge.invoke("settings:set-launch-on-login", { enabled: Boolean(value) });
  }
  if (typeof bridge?.setSetting === "function") {
    return bridge.setSetting(key, value);
  }
  if (typeof bridge?.invoke === "function") {
    return bridge.invoke("settings:set", key, value);
  }
  return value;
}

async function readHotkey(bridge, fallback = DEFAULT_HOTKEY_ACCELERATOR) {
  const fallbackAccelerator = normalizeHotkeyOrDefault(fallback);
  if (typeof bridge?.getHotkey === "function") {
    return normalizeHotkeyOrDefault(await bridge.getHotkey(), fallbackAccelerator);
  }
  if (typeof bridge?.invoke === "function") {
    return normalizeHotkeyOrDefault(
      await bridge.invoke("settings:get-hotkey"),
      fallbackAccelerator,
    );
  }
  return fallbackAccelerator;
}

async function writeHotkey(bridge, accelerator) {
  const normalizedAccelerator = normalizeHotkeyAccelerator(accelerator);
  if (typeof bridge?.setHotkey === "function") {
    return normalizeHotkeyResult(
      await bridge.setHotkey(normalizedAccelerator),
      normalizedAccelerator,
    );
  }
  if (typeof bridge?.invoke === "function") {
    return normalizeHotkeyResult(
      await bridge.invoke("settings:set-hotkey", { accelerator: normalizedAccelerator }),
      normalizedAccelerator,
    );
  }
  throw new Error("Hotkey controls are unavailable.");
}

async function getWakeStatus(bridge) {
  if (typeof bridge?.wake?.getStatus === "function") {
    return bridge.wake.getStatus();
  }
  if (typeof bridge?.invoke === "function") {
    return bridge.invoke("wake:get-status");
  }
  return null;
}

async function setWakeEnabled(bridge, enabled) {
  if (typeof bridge?.wake?.setEnabled === "function") {
    return bridge.wake.setEnabled(Boolean(enabled));
  }
  if (typeof bridge?.invoke === "function") {
    return bridge.invoke("wake:set-enabled", { enabled: Boolean(enabled) });
  }
  return { enabled: Boolean(enabled) };
}

async function setWakeMuted(bridge, muted) {
  if (typeof bridge?.wake?.mute === "function") {
    return bridge.wake.mute(Boolean(muted));
  }
  if (typeof bridge?.invoke === "function") {
    return bridge.invoke("wake:mute", { muted: Boolean(muted) });
  }
  return { muted: Boolean(muted) };
}

async function callOptionalBridge(fn, receiver, ...args) {
  if (typeof fn !== "function") {
    return undefined;
  }
  return fn.apply(receiver, args);
}

async function callRequiredBridge(fn, receiver, ...args) {
  if (typeof fn !== "function") {
    throw new Error("Required settings bridge method is unavailable.");
  }
  return fn.apply(receiver, args);
}

function applySettingsAppearance(root, settings) {
  for (const key of Object.keys(APPEARANCE_STORAGE_KEYS)) {
    const value = getAppearanceValues(key).includes(settings[key])
      ? settings[key]
      : DEFAULT_APPEARANCE[key];
    applyAppearancePreference(root, key, value, { persistLocalStorage: false });
  }
}

function applyGeneralSettings(root, settings) {
  for (const control of GENERAL_SETTING_CONTROLS) {
    applyGeneralSetting(root, control.key, Boolean(settings[control.key]));
  }
}

function applyHotkeyState(root, accelerator, result = null) {
  const normalizedAccelerator = normalizeHotkeyOrDefault(accelerator);
  const failed = result?.success === false;
  const inputValue =
    failed && typeof result?.accelerator === "string" ? result.accelerator : normalizedAccelerator;

  setNodeValue(queryOne(root, "[data-hotkey-input]"), inputValue);
  setNodeText(
    queryOne(root, "[data-hotkey-display]"),
    formatHotkeyAccelerator(normalizedAccelerator),
  );

  const status = queryOne(root, "[data-hotkey-status]");
  if (!status) {
    return;
  }
  if (!result) {
    setNodeText(status, "");
  } else if (failed) {
    setNodeText(status, result.error ?? "Shortcut unavailable");
  } else {
    setNodeText(status, "Shortcut saved");
  }
}

function applyHotkeyPreview(root, accelerator) {
  try {
    const normalizedAccelerator = normalizeHotkeyAccelerator(accelerator);
    setNodeText(
      queryOne(root, "[data-hotkey-display]"),
      formatHotkeyAccelerator(normalizedAccelerator),
    );
    setNodeText(queryOne(root, "[data-hotkey-status]"), "");
  } catch (error) {
    setNodeText(queryOne(root, "[data-hotkey-status]"), getErrorMessage(error));
  }
}

function applyGeneralSetting(root, key, value) {
  const checked = Boolean(value);
  for (const button of queryAll(root, `[data-settings-toggle="${key}"]`)) {
    button.setAttribute?.("aria-checked", String(checked));
    setNodeText(button, checked ? "On" : "Off");
  }
  for (const status of queryAll(root, `[data-settings-toggle-status="${key}"]`)) {
    setNodeText(status, checked ? "On" : "Off");
  }
}

function applyIdentityState(root, profile, activePersona) {
  const normalizedProfile = normalizeProfile(profile);
  const persona = normalizePersona(activePersona) ?? DEFAULT_PERSONA_STATE;
  const displayName = normalizedProfile.name || SETTINGS_MOCK_DATA.identity.name;

  setNodeText(queryOne(root, "[data-settings-identity-name]"), displayName);
  setNodeText(queryOne(root, "[data-settings-identity-email]"), `Persona: ${persona.name}`);
  setNodeValue(queryOne(root, "[data-agent-name]"), displayName);
  setNodeValue(queryOne(root, "[data-persona-tone]"), persona.tone);
}

function applyPersonaOptions(root, personas, activePersonaId) {
  const select = queryOne(root, "[data-persona-select]");
  if (!select) {
    return;
  }
  const normalizedPersonas = normalizePersonas(personas);
  const options = normalizedPersonas.length > 0 ? normalizedPersonas : [DEFAULT_PERSONA_STATE];
  select.innerHTML = options
    .map(
      (persona) =>
        `<option value="${escapeHtml(persona.id)}" ${
          persona.id === activePersonaId ? "selected" : ""
        }>${escapeHtml(persona.name)}</option>`,
    )
    .join("");
  setNodeValue(select, activePersonaId);
}

function emitPersonaChanged(root, detail) {
  if (typeof CustomEvent !== "function") {
    return;
  }
  const eventName = "leena:persona-changed";
  const target = typeof globalThis.dispatchEvent === "function" ? globalThis : root;
  target?.dispatchEvent?.(new CustomEvent(eventName, { detail }));
}

function applyWakeState(root, wakeStatus, wakeAvailable) {
  const normalizedStatus = normalizeWakeStatus(wakeStatus);
  updateWakeButton(root, "enabled", normalizedStatus.enabled, wakeAvailable);
  updateWakeButton(root, "muted", normalizedStatus.muted, wakeAvailable);
  setNodeText(
    queryOne(root, "[data-wake-status]"),
    wakeAvailable ? formatWakeStatus(normalizedStatus) : WAKE_UNAVAILABLE_MESSAGE,
  );
  for (const status of queryAll(root, '[data-settings-toggle-status="wake:enabled"]')) {
    setNodeText(
      status,
      wakeAvailable
        ? normalizedStatus.enabled
          ? "Enabled"
          : "Disabled"
        : WAKE_UNAVAILABLE_MESSAGE,
    );
  }
  for (const status of queryAll(root, '[data-settings-toggle-status="wake:muted"]')) {
    setNodeText(
      status,
      wakeAvailable
        ? normalizedStatus.muted
          ? "Muted"
          : "Not muted"
        : "Muted until wake runtime is available",
    );
  }
}

function updateWakeButton(root, kind, checked, wakeAvailable) {
  for (const button of queryAll(root, `[data-wake-${kind}]`)) {
    button.setAttribute?.("aria-checked", String(Boolean(checked)));
    setNodeText(button, checked ? "On" : "Off");
    if (wakeAvailable) {
      button.disabled = false;
      button.removeAttribute?.("disabled");
      button.removeAttribute?.("title");
    } else {
      button.disabled = true;
      button.setAttribute?.("disabled", "");
      button.setAttribute?.("title", WAKE_UNAVAILABLE_MESSAGE);
    }
  }
}

function formatWakeStatus(status) {
  if (status.listening) {
    return "Listening for wake phrase";
  }
  if (status.running) {
    return status.muted ? "Wake runtime running, muted" : "Wake runtime ready";
  }
  return status.enabled ? "Wake enabled, waiting for runtime" : "Wake disabled";
}

function setSettingsStatus(root, message) {
  setNodeText(queryOne(root, "[data-settings-status]"), message);
}

function queryOne(root, selector) {
  return root?.querySelector?.(selector) ?? null;
}

function queryAll(root, selector) {
  return Array.from(root?.querySelectorAll?.(selector) ?? []);
}

function setNodeText(node, value) {
  if (node && "textContent" in node) {
    node.textContent = String(value ?? "");
  }
}

function setNodeValue(node, value) {
  if (node && "value" in node) {
    node.value = String(value ?? "");
  }
}

function normalizeSettingsRecord(settings) {
  return isRecord(settings) ? { ...settings } : {};
}

function normalizeHotkeyResult(result, fallbackAccelerator) {
  if (isRecord(result)) {
    return {
      ...result,
      accelerator: normalizeHotkeyOrDefault(result.accelerator, fallbackAccelerator),
      success: result.success !== false,
    };
  }
  return {
    accelerator: normalizeHotkeyOrDefault(result, fallbackAccelerator),
    success: true,
  };
}

function normalizeHotkeyOrDefault(accelerator, fallback = DEFAULT_HOTKEY_ACCELERATOR) {
  try {
    return normalizeHotkeyAccelerator(accelerator);
  } catch {
    return fallback === accelerator
      ? DEFAULT_HOTKEY_ACCELERATOR
      : normalizeHotkeyOrDefault(fallback);
  }
}

export function createAcceleratorFromKeyboardEvent(event) {
  if (!event?.key || isModifierKey(event.key)) {
    return "";
  }

  const parts = [];
  if (event.metaKey) {
    parts.push("CommandOrControl");
  } else if (event.ctrlKey) {
    parts.push("Control");
  }
  if (event.altKey) {
    parts.push("Alt");
  }
  if (event.shiftKey) {
    parts.push("Shift");
  }
  parts.push(normalizeKeyboardEventKey(event.key));

  try {
    return normalizeHotkeyAccelerator(parts.join("+"));
  } catch {
    return "";
  }
}

function isModifierKey(key) {
  return ["Alt", "Control", "Meta", "Shift"].includes(key);
}

function normalizeKeyboardEventKey(key) {
  return key === " " ? "Space" : key;
}

function normalizeProfile(profile) {
  return isRecord(profile) ? { ...profile } : {};
}

function normalizePersonas(personas) {
  return Array.isArray(personas)
    ? personas.map((persona) => normalizePersona(persona)).filter(Boolean)
    : [];
}

function normalizePersona(persona) {
  if (!isRecord(persona)) {
    return null;
  }
  const id = normalizeString(persona.id);
  if (!id) {
    return null;
  }
  return {
    id,
    name: normalizeString(persona.name) || id,
    tone: normalizeString(persona.tone) || "",
  };
}

function normalizeWakeStatus(status) {
  return {
    enabled: Boolean(status?.enabled),
    muted: Boolean(status?.muted),
    running: Boolean(status?.running),
    listening: Boolean(status?.listening),
  };
}

function normalizeProviders(providers) {
  return Array.isArray(providers)
    ? providers.map((provider) => normalizeProvider(provider)).filter(Boolean)
    : [];
}

function normalizeProvider(provider) {
  if (!provider) {
    return null;
  }
  const id = normalizeProviderId(provider.id ?? provider.name);
  if (!id) {
    return null;
  }
  const mockProvider = SETTINGS_MOCK_DATA.providers.find((item) => item.id === id);
  return {
    id,
    name: normalizeString(provider.name) || mockProvider?.name || id,
    model: normalizeString(provider.model) || mockProvider?.model || "Choose a model",
    capabilities: {
      ...(mockProvider?.capabilities ?? {}),
      ...(provider.capabilities ?? {}),
    },
    configured: provider.configured ?? provider.tone === "success" ?? false,
    connected: provider.connected ?? provider.tone === "success" ?? false,
  };
}

function normalizeProviderConfig(config) {
  return {
    apiKey: normalizeNullableString(config?.apiKey) ?? "",
    baseUrl: normalizeNullableString(config?.baseUrl) ?? "",
    defaultModels: isRecord(config?.defaultModels) ? { ...config.defaultModels } : {},
  };
}

function normalizeProviderModel(model, capability) {
  if (typeof model === "string") {
    return {
      id: model,
      name: model,
      model,
      displayName: model,
      capabilities: { [capability]: true },
    };
  }
  const id = normalizeString(model?.id ?? model?.model ?? model?.name);
  const displayName = normalizeString(model?.displayName ?? model?.name ?? id);
  return {
    ...model,
    id,
    name: normalizeString(model?.name) || id,
    model: normalizeString(model?.model) || id,
    displayName: displayName || id,
    capabilities: isRecord(model?.capabilities)
      ? { ...model.capabilities }
      : { [capability]: true },
  };
}

function normalizeConnectionResult(result) {
  if (result?.ok === false) {
    return {
      ok: false,
      error: result.error?.message ?? "Connection failed",
      latencyMs: result.latencyMs,
      modelCount: result.modelCount,
    };
  }
  return {
    ok: true,
    latencyMs: Number.isFinite(result?.latencyMs) ? result.latencyMs : undefined,
    modelCount: Number.isInteger(result?.modelCount) ? result.modelCount : undefined,
  };
}

function getProviderStatus(provider) {
  if (provider.connected) {
    return { label: "Connected", tone: STATUS_TONES.connected };
  }
  if (provider.configured) {
    return { label: "Configured", tone: STATUS_TONES.configured };
  }
  return { label: "Needs setup", tone: STATUS_TONES.missing };
}

function formatTestResult(result) {
  if (!result) {
    return "";
  }
  if (result.loading) {
    return "Testing connection";
  }
  if (result.ok) {
    const latency = Number.isFinite(result.latencyMs) ? `${result.latencyMs} ms` : "ready";
    const modelCount = Number.isInteger(result.modelCount)
      ? `${result.modelCount} models`
      : "models ready";
    return `Connection OK - ${latency}, ${modelCount}`;
  }
  return `Connection failed - ${result.error ?? "unknown error"}`;
}

function getDefaultProviderForCapability(providers, capability) {
  return filterProvidersForCapability(providers, capability)[0] ?? null;
}

function getModelsForCapability(state, providerId, capability) {
  return state.models?.[providerId]?.[capability] ?? [];
}

function setProviderModels(state, providerId, capability, models) {
  state.models[providerId] = {
    ...(state.models[providerId] ?? {}),
    [capability]: models,
  };
}

function addModelForCapability(state, providerId, capability, model) {
  const models = getModelsForCapability(state, providerId, capability);
  if (models.some((item) => item.id === model.id)) {
    return;
  }
  setProviderModels(state, providerId, capability, [...models, model]);
}

function collectDefaultModelsForProvider(state, providerId) {
  const defaults = {};
  for (const capability of PROVIDER_SELECTOR_CAPABILITIES) {
    if (state.selectedProviders[capability.id] === providerId) {
      defaults[capability.id] = state.selectedModels[capability.id] ?? "";
    }
  }
  return defaults;
}

function getProvider(providers, providerId) {
  const normalizedProviderId = normalizeProviderId(providerId);
  return normalizeProviders(providers).find((provider) => provider.id === normalizedProviderId);
}

function getCapabilityHint(capability) {
  switch (capability) {
    case "chat":
      return "Text responses";
    case "realtime":
      return "Voice session";
    case "embeddings":
      return "Memory search";
    case "tts":
      return "Speech output";
    case "stt":
      return "Speech input";
    default:
      return "Default route";
  }
}

function getProviderCapabilityKey(providerId, capability) {
  return `${providerId}:${capability}`;
}

function getProviderModelSettingKey(providerId, capability) {
  return `${MODEL_SETTING_PREFIX}:${normalizeProviderId(providerId)}:defaultModel:${normalizeCapabilityId(
    capability,
  )}`;
}

function normalizePercent(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(0, Math.min(100, Math.round(number)));
}

function normalizeProviderId(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeCapabilityId(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeNullableString(value) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
