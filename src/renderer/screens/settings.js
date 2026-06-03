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

export function applyAppearancePreference(root, key, value) {
  assertAppearancePreference(key, value);

  const wrapper = resolveAppearanceRoot(root);
  if (wrapper?.dataset) {
    wrapper.dataset[key] = value;
  }

  getStorage()?.setItem(APPEARANCE_STORAGE_KEYS[key], value);
  updateControlState(root, key, value);
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

export function bindSettingsControls(root) {
  if (!root?.querySelectorAll) {
    return null;
  }

  loadAppearancePreferences(root);

  for (const control of root.querySelectorAll("[data-appearance-key][data-appearance-value]")) {
    control.addEventListener("click", () => {
      applyAppearancePreference(
        root,
        control.dataset.appearanceKey,
        control.dataset.appearanceValue,
      );
    });
  }

  bindProviderModelSelector(root);
  return root;
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

function renderFeatureToggle(feature) {
  return `
    <article class="row">
      <span class="row__txt">
        <strong class="lx-body">${escapeHtml(feature.label)}</strong>
        <span class="lx-sm">${feature.enabled ? "On" : "Off"}</span>
      </span>
      <button class="btn btn--ghost" type="button" role="switch" aria-checked="${String(feature.enabled)}">
        ${feature.enabled ? "On" : "Off"}
      </button>
    </article>
  `;
}

export function renderSettings() {
  return `
    <section class="settings-screen" aria-label="Settings">
      <section class="panel-glass settings-identity" aria-labelledby="settings-identity-title">
        <div class="orb settings-avatar" aria-hidden="true"></div>
        <span class="row__txt">
          <h1 id="settings-identity-title" class="lx-h2">${escapeHtml(SETTINGS_MOCK_DATA.identity.name)}</h1>
          <span class="lx-sm text-dim">${escapeHtml(SETTINGS_MOCK_DATA.identity.email)}</span>
        </span>
        <button class="btn btn--ghost" type="button">Edit</button>
      </section>

      <section class="card settings-card" aria-labelledby="settings-appearance-title">
        <h2 id="settings-appearance-title" class="lx-h2">Appearance</h2>
        ${renderSegmentedControl("theme", "Theme", SETTINGS_MOCK_DATA.appearance.theme)}
        ${renderSegmentedControl("treatment", "Treatment", SETTINGS_MOCK_DATA.appearance.treatment)}
        ${renderSegmentedControl("density", "Density", SETTINGS_MOCK_DATA.appearance.density)}
      </section>

      <section class="card settings-card" aria-labelledby="settings-providers-title">
        <div class="settings-card__head">
          <h2 id="settings-providers-title" class="lx-h2">Providers</h2>
          <span class="lx-sm text-dim">Defaults by capability</span>
        </div>
        ${renderProviderModelSelector()}
      </section>

      <section class="card settings-card" aria-labelledby="settings-features-title">
        <h2 id="settings-features-title" class="lx-h2">Features</h2>
        <div class="settings-list">
          ${SETTINGS_MOCK_DATA.features.map(renderFeatureToggle).join("")}
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
