import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAppearancePreference,
  bindSettingsControls,
  loadAppearancePreferences,
  renderSettings,
  SETTINGS_MOCK_DATA,
} from "../src/renderer/screens/settings.js";

class TestElement {
  constructor({ id = "", classes = [], dataset = {} } = {}) {
    this.id = id;
    this.dataset = { ...dataset };
    this.attributes = new Map();
    this.listeners = new Map();
    this.children = [];
    this.classList = {
      contains: (className) => classes.includes(className),
    };
  }

  matches(selector) {
    if (selector === "#app-shell.leena") {
      return this.id === "app-shell" && this.classList.contains("leena");
    }

    return false;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  click() {
    this.listeners.get("click")?.();
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    if (selector === "#app-shell.leena") {
      return this.children.filter(
        (child) => child.id === "app-shell" && child.classList.contains("leena"),
      );
    }

    if (selector === ".leena") {
      return this.children.filter((child) => child.classList.contains("leena"));
    }

    if (selector === "#app-shell") {
      return this.children.filter((child) => child.id === "app-shell");
    }

    if (selector === "[data-appearance-key][data-appearance-value]") {
      return this.children.filter(
        (child) => child.dataset.appearanceKey && child.dataset.appearanceValue,
      );
    }

    const appearanceKey = selector.match(/^\[data-appearance-key="([^"]+)"\]$/)?.[1];
    if (appearanceKey) {
      return this.children.filter((child) => child.dataset.appearanceKey === appearanceKey);
    }

    return [];
  }
}

function installLocalStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
  return values;
}

function createSettingsRoot() {
  const root = new TestElement();
  const wrapper = new TestElement({ id: "app-shell", classes: ["leena"] });
  const themeLight = new TestElement({
    dataset: { appearanceKey: "theme", appearanceValue: "light" },
  });
  const themeDark = new TestElement({
    dataset: { appearanceKey: "theme", appearanceValue: "dark" },
  });
  const themeWorkspace = new TestElement({
    dataset: { appearanceKey: "theme", appearanceValue: "workspace" },
  });
  const treatmentWorkspace = new TestElement({
    dataset: { appearanceKey: "treatment", appearanceValue: "workspace" },
  });
  const treatmentCoral = new TestElement({
    dataset: { appearanceKey: "treatment", appearanceValue: "coral" },
  });
  const densityCompact = new TestElement({
    dataset: { appearanceKey: "density", appearanceValue: "compact" },
  });

  root.children.push(
    wrapper,
    themeLight,
    themeDark,
    themeWorkspace,
    treatmentWorkspace,
    treatmentCoral,
    densityCompact,
  );
  return { densityCompact, root, themeDark, themeLight, treatmentCoral, wrapper };
}

test.afterEach(() => {
  delete globalThis.localStorage;
});

test("applyAppearancePreference sets wrapper attributes and persists exact keys", () => {
  const storage = installLocalStorage();
  const { root, themeDark, themeLight, wrapper } = createSettingsRoot();

  assert.equal(applyAppearancePreference(root, "theme", "dark"), "dark");

  assert.equal(wrapper.dataset.theme, "dark");
  assert.equal(storage.get("leena-theme"), "dark");
  assert.equal(themeDark.getAttribute("aria-pressed"), "true");
  assert.equal(themeLight.getAttribute("aria-pressed"), "false");
});

test("applyAppearancePreference only targets the exact app-shell leena wrapper", () => {
  const storage = installLocalStorage();
  const root = new TestElement();
  const looseWrapper = new TestElement({ id: "app-shell" });
  const unrelatedLeena = new TestElement({ classes: ["leena"] });
  const directLooseWrapper = new TestElement({ id: "app-shell" });
  const directUnrelatedLeena = new TestElement({ classes: ["leena"] });
  root.children.push(looseWrapper, unrelatedLeena);

  assert.equal(applyAppearancePreference(root, "theme", "dark"), "dark");
  assert.equal(applyAppearancePreference(directLooseWrapper, "theme", "dark"), "dark");
  assert.equal(applyAppearancePreference(directUnrelatedLeena, "theme", "dark"), "dark");

  assert.equal(looseWrapper.dataset.theme, undefined);
  assert.equal(unrelatedLeena.dataset.theme, undefined);
  assert.equal(directLooseWrapper.dataset.theme, undefined);
  assert.equal(directUnrelatedLeena.dataset.theme, undefined);
  assert.equal(storage.get("leena-theme"), "dark");
});

test("loadAppearancePreferences uses workspace mode comfortable defaults", () => {
  installLocalStorage();
  const { root, wrapper } = createSettingsRoot();

  assert.deepEqual(loadAppearancePreferences(root), {
    theme: "workspace",
    treatment: "workspace",
    density: "comfortable",
  });
  assert.equal(wrapper.dataset.theme, "workspace");
  assert.equal(wrapper.dataset.treatment, "workspace");
  assert.equal(wrapper.dataset.density, "comfortable");
});

test("loadAppearancePreferences round-trips localStorage values and defaults missing values", () => {
  installLocalStorage({
    "leena-theme": "vercel-dark",
    "leena-treatment": "iris",
  });
  const { root, wrapper } = createSettingsRoot();

  assert.deepEqual(loadAppearancePreferences(root), {
    theme: "vercel-dark",
    treatment: "iris",
    density: "comfortable",
  });
  assert.equal(wrapper.dataset.theme, "vercel-dark");
  assert.equal(wrapper.dataset.treatment, "iris");
  assert.equal(wrapper.dataset.density, "comfortable");
});

test("bindSettingsControls loads preferences and wires segmented clicks", () => {
  const storage = installLocalStorage({
    "leena-theme": "light",
    "leena-treatment": "aurora",
    "leena-density": "comfortable",
  });
  const { densityCompact, root, themeDark, treatmentCoral, wrapper } = createSettingsRoot();

  assert.equal(bindSettingsControls(root), root);
  themeDark.click();
  treatmentCoral.click();
  densityCompact.click();

  assert.equal(wrapper.dataset.theme, "dark");
  assert.equal(wrapper.dataset.treatment, "coral");
  assert.equal(wrapper.dataset.density, "compact");
  assert.equal(storage.get("leena-theme"), "dark");
  assert.equal(storage.get("leena-treatment"), "coral");
  assert.equal(storage.get("leena-density"), "compact");
});

test("renderSettings returns settings sections, providers, toggles, and no inline hex colors", () => {
  const html = renderSettings();

  assert.match(html, /^\s*<section class="settings-screen" aria-label="Settings">/);
  assert.match(html, /class="panel-glass settings-identity"/);
  assert.match(html, /class="orb settings-avatar"/);
  assert.match(html, /class="lx-h2">Yasmine<\/h1>/);
  assert.match(html, /class="lx-sm text-dim">yasmine@leena\.local<\/span>/);
  assert.match(html, /class="btn btn--ghost" type="button">Edit<\/button>/);
  assert.match(html, /Appearance/);
  assert.match(html, /data-appearance-key="theme"/);
  assert.match(html, /data-appearance-value="workspace"/);
  assert.match(html, /data-appearance-value="vercel-dark"/);
  assert.match(html, /data-appearance-key="treatment"/);
  assert.match(html, />\s*Workspace\s*<\/button>/);
  assert.match(html, /data-appearance-value="coral"/);
  assert.match(html, /data-appearance-key="density"/);
  assert.match(html, /data-appearance-value="compact"/);
  assert.match(html, /Keyboard Shortcut/);
  assert.match(html, /Cmd\+Shift\+L/);
  assert.match(html, /data-hotkey-input/);
  assert.match(html, /value="CommandOrControl\+Shift\+L"/);
  assert.match(html, /data-hotkey-record/);
  assert.match(html, /data-hotkey-default/);
  assert.match(html, /data-hotkey-save/);
  assert.match(html, /Updates/);
  assert.match(html, /data-update-version/);
  assert.match(html, /data-update-check/);
  assert.match(html, /data-update-download disabled/);
  assert.match(html, /data-update-install disabled/);
  assert.match(html, /Providers/);
  assert.match(html, /OpenAI/);
  assert.match(html, /settings-chip--success/);
  assert.match(html, /OpenRouter/);
  assert.match(html, /Ollama/);
  assert.match(html, /Choose a hosted model/);
  assert.match(html, /Choose a local model/);
  assert.match(html, /Features/);
  assert.match(html, /Wake Word/);
  assert.match(html, /Always Listening/);
  assert.match(html, /Launch on Login/);
  assert.match(html, /Notifications/);
  assert.match(html, /role="switch" aria-checked="true"/);
  assert.doesNotMatch(html, /#[0-9a-fA-F]{3,8}\b/);

  for (const group of Object.values(SETTINGS_MOCK_DATA.appearance)) {
    for (const option of group) {
      assert.match(html, new RegExp(`data-appearance-value="${option.value}"`));
    }
  }
});

test("invalid preferences are rejected before storage or dataset changes", () => {
  const storage = installLocalStorage();
  const { root, wrapper } = createSettingsRoot();

  assert.throws(() => applyAppearancePreference(root, "theme", "midnight"), /Unknown theme value/);
  assert.throws(
    () => applyAppearancePreference(root, "color", "dark"),
    /Unknown appearance preference/,
  );
  assert.equal(wrapper.dataset.theme, undefined);
  assert.equal(storage.size, 0);
});
