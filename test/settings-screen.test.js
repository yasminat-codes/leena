import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAppearancePreference,
  applyUpdateStatus,
  bindSettingsControls,
  bindSettingsDetailRouter,
  bindUpdateControls,
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
    this.disabled = false;
    this.focusCount = 0;
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

function createUpdateRoot() {
  const root = new TestElement();
  const state = new TestElement({ dataset: { updateState: "" } });
  const version = new TestElement({ dataset: { updateVersion: "" } });
  const availableVersion = new TestElement({ dataset: { updateAvailableVersion: "" } });
  const progressLabel = new TestElement({ dataset: { updateProgressLabel: "" } });
  const progress = new TestElement({ dataset: { updateProgress: "" } });
  const status = new TestElement({ dataset: { updateStatus: "" } });
  const error = new TestElement({ dataset: { updateError: "" } });
  const check = new TestElement({ dataset: { updateCheck: "" } });
  const download = new TestElement({ dataset: { updateDownload: "" } });
  const install = new TestElement({ dataset: { updateInstall: "" } });

  root.children.push(
    state,
    version,
    availableVersion,
    progressLabel,
    progress,
    status,
    error,
    check,
    download,
    install,
  );
  return {
    availableVersion,
    check,
    download,
    error,
    install,
    progress,
    progressLabel,
    root,
    state,
    status,
    version,
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
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

function getDetailSectionHtml(html, detailId) {
  const tag = getDetailSectionTag(html, detailId);
  const start = html.indexOf(tag);
  assert.notEqual(start, -1, `expected ${detailId} section start`);
  const end = html.indexOf("</section>", start);
  assert.notEqual(end, -1, `expected ${detailId} section end`);
  return html.slice(start, end + "</section>".length);
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

test("theme detail owns exact appearance controls and previews", () => {
  const html = renderSettings();
  const expectedAppearance = {
    density: [
      { label: "Compact", value: "compact" },
      { label: "Comfortable", value: "comfortable" },
    ],
    theme: [
      { label: "Workspace", value: "workspace" },
      { label: "Light", value: "light" },
      { label: "Dark", value: "dark" },
      { label: "Vercel Dark", value: "vercel-dark" },
    ],
    treatment: [
      { label: "Workspace", value: "workspace" },
      { label: "Aurora", value: "aurora" },
      { label: "Coral", value: "coral" },
      { label: "Iris", value: "iris" },
    ],
  };
  const appearanceOptions = Object.fromEntries(
    Object.entries(SETTINGS_MOCK_DATA.appearance).map(([key, options]) => [
      key,
      options.map(({ label, value }) => ({ label, value })),
    ]),
  );

  assert.deepEqual(appearanceOptions, expectedAppearance);

  const themeHtml = getDetailSectionHtml(html, "theme");
  assert.doesNotMatch(
    themeHtml,
    /Keyboard Shortcut|Launch on Login|Notifications|OpenAI|Ollama|Wake Word|data-hotkey-input|data-provider-model-selector|data-settings-toggle|data-update-check/,
  );

  for (const [key, options] of Object.entries(expectedAppearance)) {
    const groupLabel = key === "theme" ? "Theme" : key === "treatment" ? "Treatment" : "Density";
    assert.match(themeHtml, new RegExp(`data-settings-row="${key}"`));
    for (const option of options) {
      assert.match(themeHtml, new RegExp(`data-appearance-key="${key}"`));
      assert.match(themeHtml, new RegExp(`data-appearance-value="${option.value}"`));
      assert.match(themeHtml, new RegExp(`aria-label="${groupLabel}: ${option.label}"`));
      assert.match(
        themeHtml,
        new RegExp(
          `data-appearance-preview="${key}"\\s+data-appearance-preview-value="${option.value}"`,
        ),
      );
      assert.match(themeHtml, new RegExp(`>${option.label}<\\/span>`));
    }
  }

  for (const detail of [
    "overview",
    "general",
    "updates",
    "providers",
    "mac-access",
    "integrations-health",
  ]) {
    assert.doesNotMatch(getDetailSectionHtml(html, detail), /data-appearance-key=/);
  }
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
  assert.match(html, /data-settings-detail="providers"/);
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
  assert.match(html, /class="settings-segmented__label">Workspace<\/span>/);
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
  assert.match(html, /State/);
  assert.match(html, /data-update-state/);
  assert.match(html, /App version/);
  assert.match(html, /data-update-version/);
  assert.match(html, /Available update/);
  assert.match(html, /data-update-available-version/);
  assert.match(html, /Download progress/);
  assert.match(html, /data-update-progress-label/);
  assert.match(html, /data-update-progress/);
  assert.match(html, /data-update-check/);
  assert.match(html, /Check for updates/);
  assert.match(html, /data-update-download[\s\S]*disabled/);
  assert.match(html, /Download update/);
  assert.match(html, /data-update-install[\s\S]*disabled/);
  assert.match(html, /Restart to install/);
  assert.match(html, /data-update-error[\s\S]*hidden/);
  assert.match(html, /Providers/);
  assert.match(html, /data-provider-detail/);
  assert.match(html, /data-provider-cards-section/);
  assert.match(html, /data-provider-defaults-section/);
  assert.match(html, /OpenAI/);
  assert.match(html, /settings-chip--success/);
  assert.match(html, /OpenRouter/);
  assert.match(html, /Ollama/);
  assert.match(html, /Choose a hosted model/);
  assert.match(html, /Choose a local model/);
  assert.match(html, /data-provider-refresh="openai"/);
  assert.match(html, /data-ollama-pull-panel/);
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

test("applyUpdateStatus maps required update states to detail metadata and controls", () => {
  const cases = [
    {
      state: "idle",
      expected: {
        checkDisabled: false,
        downloadDisabled: true,
        installDisabled: true,
        progressLabel: "Not started",
        progressValue: "0",
        stateLabel: "Idle",
      },
    },
    {
      state: "checking",
      expected: {
        checkDisabled: true,
        checkLabel: "Checking...",
        downloadDisabled: true,
        installDisabled: true,
        stateLabel: "Checking",
      },
    },
    {
      state: "available",
      expected: {
        availableVersion: "0.1.3",
        checkDisabled: false,
        checkLabel: "Check again",
        downloadDisabled: false,
        installDisabled: true,
        progressLabel: "Ready to download",
        stateLabel: "Available",
      },
      updateInfo: { version: "0.1.3" },
    },
    {
      state: "downloading",
      expected: {
        availableVersion: "0.1.3",
        checkDisabled: true,
        downloadDisabled: true,
        downloadLabel: "Downloading...",
        installDisabled: true,
        progressLabel: "42% downloaded",
        progressValue: "42",
        stateLabel: "Downloading",
      },
      percent: 42,
      updateInfo: { version: "0.1.3" },
    },
    {
      state: "downloaded",
      expected: {
        availableVersion: "0.1.3",
        checkDisabled: false,
        checkLabel: "Check again",
        downloadDisabled: true,
        downloadLabel: "Downloaded",
        installDisabled: false,
        installLabel: "Restart to install",
        progressLabel: "Download complete",
        progressValue: "100",
        stateLabel: "Downloaded",
      },
      updateInfo: { version: "0.1.3" },
    },
    {
      state: "installing",
      expected: {
        availableVersion: "0.1.3",
        checkDisabled: true,
        downloadDisabled: true,
        downloadLabel: "Downloaded",
        installDisabled: true,
        installLabel: "Installing...",
        progressLabel: "Download complete",
        progressValue: "100",
        stateLabel: "Installing",
      },
      updateInfo: { version: "0.1.3" },
    },
    {
      state: "error",
      error: "Signature rejected",
      expected: {
        checkDisabled: false,
        checkLabel: "Retry check",
        downloadDisabled: true,
        errorHidden: false,
        errorText: "Last error: Signature rejected",
        installDisabled: true,
        stateLabel: "Error",
      },
    },
  ];

  for (const updateCase of cases) {
    const view = createUpdateRoot();
    applyUpdateStatus(view.root, {
      error: updateCase.error,
      message: `${updateCase.state} message`,
      percent: updateCase.percent,
      state: updateCase.state,
      updateInfo: updateCase.updateInfo,
      version: "0.1.2",
    });

    assert.equal(view.state.textContent, updateCase.expected.stateLabel);
    assert.equal(view.version.textContent, "0.1.2");
    assert.equal(
      view.availableVersion.textContent,
      updateCase.expected.availableVersion ?? "Not checked",
    );
    assert.equal(view.check.disabled, updateCase.expected.checkDisabled);
    assert.equal(view.download.disabled, updateCase.expected.downloadDisabled);
    assert.equal(view.install.disabled, updateCase.expected.installDisabled);
    assert.equal(
      view.progressLabel.textContent,
      updateCase.expected.progressLabel ?? "Not started",
    );
    assert.equal(view.progress.getAttribute("value"), updateCase.expected.progressValue ?? "0");
    assert.equal(view.check.textContent, updateCase.expected.checkLabel ?? "Check for updates");
    assert.equal(view.download.textContent, updateCase.expected.downloadLabel ?? "Download update");
    assert.equal(
      view.install.textContent,
      updateCase.expected.installLabel ?? "Restart to install",
    );
    assert.equal(view.error.hidden, updateCase.expected.errorHidden ?? true);
    assert.equal(view.error.textContent, updateCase.expected.errorText ?? "");
  }
});

test("bindUpdateControls keeps download and install bridge actions separate", async () => {
  const view = createUpdateRoot();
  const calls = [];
  const bridge = {
    updates: {
      getStatus: async () => ({
        message: "Leena 0.1.3 is available.",
        state: "available",
        updateInfo: { version: "0.1.3" },
        version: "0.1.2",
      }),
      download: async () => {
        calls.push("download");
        return {
          message: "Update downloaded. Restart Leena to install it.",
          state: "downloaded",
          updateInfo: { version: "0.1.3" },
          version: "0.1.2",
        };
      },
      install: async () => {
        calls.push("install");
        return {
          message: "Restarting Leena to install the update.",
          state: "installing",
          updateInfo: { version: "0.1.3" },
          version: "0.1.2",
        };
      },
      onStatus: () => () => {},
    },
  };

  const binding = bindUpdateControls(view.root, bridge);
  assert.equal(typeof binding.dispose, "function");
  await flushPromises();

  assert.equal(view.download.disabled, false);
  assert.equal(view.install.disabled, true);

  view.download.click();
  assert.deepEqual(calls, ["download"]);

  await flushPromises();
  assert.equal(view.download.disabled, true);
  assert.equal(view.install.disabled, false);

  view.install.click();
  assert.deepEqual(calls, ["download", "install"]);
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
