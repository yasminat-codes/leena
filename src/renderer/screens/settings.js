const APPEARANCE_STORAGE_KEYS = Object.freeze({
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
      Object.freeze({ label: "Light", value: "light" }),
      Object.freeze({ label: "Dark", value: "dark" }),
      Object.freeze({ label: "Vercel Dark", value: "vercel-dark" }),
    ]),
    treatment: Object.freeze([
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
      name: "OpenAI",
      status: "Active",
      tone: "success",
      model: "Realtime + GPT-5",
    }),
    Object.freeze({
      name: "OpenRouter",
      status: "Available",
      tone: "accent",
      model: "Choose a hosted model",
    }),
    Object.freeze({
      name: "Ollama",
      status: "Available",
      tone: "accent",
      model: "Choose a local model",
    }),
  ]),
  features: Object.freeze([
    Object.freeze({ label: "Wake Word", enabled: false }),
    Object.freeze({ label: "Always Listening", enabled: false }),
    Object.freeze({ label: "Launch on Login", enabled: false }),
    Object.freeze({ label: "Notifications", enabled: true }),
  ]),
});

const DEFAULT_APPEARANCE = Object.freeze({
  theme: "dark",
  treatment: "aurora",
  density: "comfortable",
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

  return root;
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

function renderProvider(provider) {
  const chipClass =
    provider.tone === "success" ? "chip settings-chip--success" : "chip settings-chip--accent";
  return `
    <article class="row">
      <span class="tooldot" aria-hidden="true">${escapeHtml(provider.name.at(0))}</span>
      <span class="row__txt">
        <strong class="lx-body">${escapeHtml(provider.name)}</strong>
        <span class="lx-sm">${escapeHtml(provider.model)}</span>
      </span>
      <span class="${chipClass}">
        <span class="dot" aria-hidden="true"></span>
        ${escapeHtml(provider.status)}
      </span>
    </article>
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
        <h2 id="settings-providers-title" class="lx-h2">Providers</h2>
        <div class="settings-list">
          ${SETTINGS_MOCK_DATA.providers.map(renderProvider).join("")}
        </div>
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
