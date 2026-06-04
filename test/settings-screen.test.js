import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAppearancePreference,
  bindSettingsControls,
  bindSettingsDetailRouter,
  loadAppearancePreferences,
  renderSettings,
  SETTINGS_MOCK_DATA,
  showSettingsDetail,
} from "../src/renderer/screens/settings.js";

class TestElement {
  constructor({ id = "", classes = [], dataset = {} } = {}) {
    this.id = id;
    this.dataset = { ...dataset };
    this.attributes = new Map();
    this.listeners = new Map();
    this.children = [];
    this.hidden = false;
    this.focusCount = 0;
    this.classList = {
      contains: (className) => classes.includes(className),
    };
  }

  matches(selector) {
    if (selector === "#app-shell.leena") {
      return this.id === "app-shell" && this.classList.contains("leena");
    }

    if (selector === ".leena") {
      return this.classList.contains("leena");
    }

    if (selector.startsWith("#")) {
      return this.id === selector.slice(1);
    }

    return matchesDatasetSelector(this, selector);
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  click() {
    this.listeners.get("click")?.({ preventDefault() {} });
  }

  keydown(key) {
    this.listeners.get("keydown")?.({ key, preventDefault() {} });
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

  focus() {
    this.focusCount += 1;
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

function createSettingsRouterRoot() {
  const root = new TestElement({
    dataset: { settingsActiveDetail: "overview", settingsDetailRouter: "" },
  });
  const overview = new TestElement({ dataset: { settingsDetail: "overview" } });
  const general = new TestElement({ dataset: { settingsDetail: "general" } });
  const theme = new TestElement({ dataset: { settingsDetail: "theme" } });
  const providers = new TestElement({ dataset: { settingsDetail: "providers" } });
  const generalCard = new TestElement({ dataset: { settingsDetailTarget: "general" } });
  const themeCard = new TestElement({ dataset: { settingsDetailTarget: "theme" } });
  const back = new TestElement({ dataset: { settingsDetailBack: "general" } });
  const close = new TestElement({ dataset: { settingsDetailClose: "theme" } });

  root.children.push(overview, general, theme, providers, generalCard, themeCard, back, close);
  return { back, close, general, generalCard, overview, providers, root, theme, themeCard };
}

function getHtmlTags(html, tagName) {
  return html.match(new RegExp(`<${tagName}\\b[^>]*>`, "g")) ?? [];
}

function getDetailSectionTags(html) {
  return getHtmlTags(html, "section").filter((tag) => tag.includes("data-settings-detail="));
}

function getDetailSectionTag(html, detailId) {
  const tag = getDetailSectionTags(html).find((sectionTag) =>
    sectionTag.includes(`data-settings-detail="${detailId}"`),
  );
  assert.ok(tag, `expected ${detailId} detail section`);
  return tag;
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

  assert.match(
    html,
    /^\s*<section\s+class="settings-screen"\s+aria-label="Settings"\s+data-settings-detail-router/s,
  );
  assert.match(html, /data-settings-active-detail="overview"/);
  assert.match(html, /class="panel-glass settings-identity"/);
  assert.match(html, /class="settings-identity__fields"/);
  assert.match(html, /data-settings-primitive="detail-section"/);
  assert.match(html, /data-settings-detail="general"/);
  assert.match(html, /data-settings-detail="overview"/);
  assert.match(html, /data-settings-detail="theme"/);
  assert.match(html, /data-settings-detail="mac-access"/);
  assert.match(html, /data-settings-detail="integrations-health"/);
  assert.match(html, /data-settings-primitive="overview-card"/);
  assert.match(html, /data-settings-detail-target="general"/);
  assert.match(html, /data-settings-detail-target="theme"/);
  assert.match(html, /data-settings-detail-target="providers"/);
  assert.match(html, /data-settings-detail-target="updates"/);
  assert.match(html, /data-settings-detail-target="mac-access"/);
  assert.match(html, /data-settings-detail-target="integrations-health"/);
  assert.match(html, /aria-label="Open General settings detail"/);
  assert.match(html, /aria-label="Open Integrations Health settings detail"/);
  assert.match(html, /data-settings-detail-back="general"/);
  assert.match(html, /data-settings-detail-close="general"/);
  assert.match(html, /class="orb settings-avatar"/);
  assert.match(html, /class="lx-h2">Yasmine<\/h3>/);
  assert.match(html, /class="lx-sm text-dim">yasmine@leena\.local<\/span>/);
  assert.match(html, /data-settings-action="edit-identity"/);
  assert.match(html, /data-agent-name/);
  assert.match(html, /data-persona-select/);
  assert.match(html, /data-persona-tone/);
  assert.match(html, /Theme/);
  assert.match(html, /data-settings-primitive="detail-row"/);
  assert.match(html, /data-settings-primitive="segmented-option"/);
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
  assert.match(html, /data-update-download[\s\S]*disabled/);
  assert.match(html, /data-update-install[\s\S]*disabled/);
  assert.match(html, /Providers/);
  assert.match(html, /OpenAI/);
  assert.match(html, /settings-chip--success/);
  assert.match(html, /OpenRouter/);
  assert.match(html, /Ollama/);
  assert.match(html, /Choose a hosted model/);
  assert.match(html, /Choose a local model/);
  assert.match(html, /Mac Access/);
  assert.match(html, /Integrations Health/);
  assert.match(html, /Wake Word/);
  assert.match(html, /Always Listening/);
  assert.match(html, /Launch on Login/);
  assert.match(html, /Notifications/);
  assert.match(html, /role="switch" aria-checked="true"/);
  assert.match(html, /data-settings-primitive="toggle"/);
  assert.match(html, /data-settings-primitive="status-callout"/);
  assert.doesNotMatch(html, /#[0-9a-fA-F]{3,8}\b/);

  const overviewTag = getDetailSectionTag(html, "overview");
  assert.doesNotMatch(overviewTag, /\shidden(?:\s|>)/);
  assert.match(overviewTag, /aria-hidden="false"/);

  for (const detail of [
    "general",
    "theme",
    "updates",
    "providers",
    "mac-access",
    "integrations-health",
  ]) {
    const detailTag = getDetailSectionTag(html, detail);
    assert.match(detailTag, /\shidden(?:\s|>)/);
    assert.match(detailTag, /aria-hidden="true"/);
  }

  for (const group of Object.values(SETTINGS_MOCK_DATA.appearance)) {
    for (const option of group) {
      assert.match(html, new RegExp(`data-appearance-value="${option.value}"`));
    }
  }

  const inputTags = getHtmlTags(html, "input");
  assert.ok(inputTags.length >= 5);
  for (const tag of inputTags) {
    assert.match(tag, /\bclass="[^"]*\bsettings-input\b[^"]*"/);
    assert.match(tag, /data-settings-primitive="input"/);
    assert.match(tag, /aria-label="/);
  }

  const selectTags = getHtmlTags(html, "select");
  assert.ok(selectTags.length >= 3);
  for (const tag of selectTags) {
    assert.match(tag, /\bclass="[^"]*\bsettings-select\b[^"]*"/);
    assert.match(tag, /data-settings-primitive="select"/);
    assert.match(tag, /aria-label="/);
  }

  const buttonTags = getHtmlTags(html, "button");
  assert.ok(buttonTags.length >= 12);
  for (const tag of buttonTags) {
    assert.match(tag, /data-settings-primitive="(?:action-button|segmented-option|toggle)"/);
  }
});

test("settings detail router opens cards and returns to overview", () => {
  const { back, general, generalCard, overview, providers, root, theme, themeCard } =
    createSettingsRouterRoot();

  assert.equal(bindSettingsDetailRouter(root), root);

  assert.equal(root.dataset.settingsActiveDetail, "overview");
  assert.equal(overview.hidden, false);
  assert.equal(general.hidden, true);
  assert.equal(theme.hidden, true);
  assert.equal(providers.hidden, true);

  generalCard.click();

  assert.equal(root.dataset.settingsActiveDetail, "general");
  assert.equal(overview.hidden, true);
  assert.equal(general.hidden, false);
  assert.equal(theme.hidden, true);
  assert.equal(general.getAttribute("aria-hidden"), "false");
  assert.equal(generalCard.getAttribute("aria-pressed"), "true");
  assert.equal(general.focusCount, 1);

  back.click();

  assert.equal(root.dataset.settingsActiveDetail, "overview");
  assert.equal(overview.hidden, false);
  assert.equal(general.hidden, true);

  themeCard.keydown("Enter");

  assert.equal(root.dataset.settingsActiveDetail, "theme");
  assert.equal(overview.hidden, true);
  assert.equal(theme.hidden, false);
  assert.equal(themeCard.getAttribute("aria-pressed"), "true");
});

test("settings detail close and invalid routes fall back to overview", () => {
  const { close, general, overview, root, theme } = createSettingsRouterRoot();

  assert.equal(showSettingsDetail(root, "appearance"), "theme");
  assert.equal(root.dataset.settingsActiveDetail, "theme");
  assert.equal(theme.hidden, false);
  assert.equal(overview.hidden, true);

  assert.equal(bindSettingsDetailRouter(root), root);
  close.click();

  assert.equal(root.dataset.settingsActiveDetail, "overview");
  assert.equal(overview.hidden, false);
  assert.equal(theme.hidden, true);

  assert.equal(showSettingsDetail(root, "unknown-detail"), "overview");
  assert.equal(root.dataset.settingsActiveDetail, "overview");
  assert.equal(overview.hidden, false);
  assert.equal(general.hidden, true);
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
