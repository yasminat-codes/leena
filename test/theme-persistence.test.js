import assert from "node:assert/strict";
import test from "node:test";

import {
  APPEARANCE_STORAGE_KEYS,
  applyAppearancePreference,
  DEFAULT_APPEARANCE,
  loadAppearancePreferences,
  SETTINGS_MOCK_DATA,
} from "../src/renderer/screens/settings.js";
import { initShell } from "../src/renderer/shell.js";

class TestElement {
  constructor({ id = "", classes = [], dataset = {}, onSetInnerHTML = null } = {}) {
    this.classes = new Set(classes);
    this.id = id;
    this.dataset = { ...dataset };
    this.attributes = new Map();
    this.children = [];
    this.listeners = new Map();
    this._innerHTML = "";
    this.onSetInnerHTML = onSetInnerHTML;
    this.classList = {
      contains: (className) => this.classes.has(className),
      toggle: (className, force) => {
        if (force) {
          this.classes.add(className);
          return true;
        }
        this.classes.delete(className);
        return false;
      },
    };
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    this.onSetInnerHTML?.(this._innerHTML);
  }

  get innerHTML() {
    return this._innerHTML;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
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

    if (selector === ".nav-item") {
      return this.children.filter((child) => child.classList.contains("nav-item"));
    }

    if (selector === "#shell-title") {
      return this.children.filter((child) => child.id === "shell-title");
    }

    if (selector === "#shell-content") {
      return this.children.filter((child) => child.id === "shell-content");
    }

    if (selector === "#shell-date") {
      return this.children.filter((child) => child.id === "shell-date");
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

function createShellRoot({ storageSnapshotOnRender } = {}) {
  const root = new TestElement();
  const wrapper = new TestElement({ id: "app-shell", classes: ["leena"] });
  const title = new TestElement({ id: "shell-title" });
  const date = new TestElement({ id: "shell-date" });
  const content = new TestElement({
    id: "shell-content",
    onSetInnerHTML: () => storageSnapshotOnRender?.({ ...wrapper.dataset }),
  });
  const home = new TestElement({ classes: ["nav-item"], dataset: { screen: "Home" } });
  const settings = new TestElement({
    classes: ["nav-item"],
    dataset: { screen: "Settings" },
  });

  root.children.push(wrapper, title, date, content, home, settings);
  return { content, root, wrapper };
}

test.afterEach(() => {
  delete globalThis.localStorage;
});

test("shell init reads saved appearance values before first screen render", () => {
  installLocalStorage({
    [APPEARANCE_STORAGE_KEYS.theme]: "light",
    [APPEARANCE_STORAGE_KEYS.treatment]: "iris",
    [APPEARANCE_STORAGE_KEYS.density]: "compact",
  });
  let renderSnapshot = null;
  const { content, root, wrapper } = createShellRoot({
    storageSnapshotOnRender: (snapshot) => {
      renderSnapshot = snapshot;
    },
  });

  const shell = initShell(root);

  assert.equal(typeof shell?.setActiveScreen, "function");

  assert.deepEqual(renderSnapshot, {
    theme: "light",
    treatment: "iris",
    density: "compact",
  });
  assert.equal(wrapper.dataset.theme, "light");
  assert.equal(wrapper.dataset.treatment, "iris");
  assert.equal(wrapper.dataset.density, "compact");
  assert.match(content.innerHTML, /home-screen/);
});

test("appearance preferences write and read back for all keys", () => {
  const storage = installLocalStorage();
  const { root, wrapper } = createShellRoot();

  applyAppearancePreference(root, "theme", "vercel-dark");
  applyAppearancePreference(root, "treatment", "coral");
  applyAppearancePreference(root, "density", "compact");

  assert.deepEqual(Object.fromEntries(storage), {
    [APPEARANCE_STORAGE_KEYS.theme]: "vercel-dark",
    [APPEARANCE_STORAGE_KEYS.treatment]: "coral",
    [APPEARANCE_STORAGE_KEYS.density]: "compact",
  });
  assert.deepEqual(loadAppearancePreferences(root), {
    theme: "vercel-dark",
    treatment: "coral",
    density: "compact",
  });
  assert.equal(wrapper.dataset.theme, "vercel-dark");
  assert.equal(wrapper.dataset.treatment, "coral");
  assert.equal(wrapper.dataset.density, "compact");
});

test("all appearance values persist under exact localStorage keys", () => {
  const storage = installLocalStorage();
  const { root, wrapper } = createShellRoot();

  for (const [key, options] of Object.entries(SETTINGS_MOCK_DATA.appearance)) {
    for (const option of options) {
      assert.equal(applyAppearancePreference(root, key, option.value), option.value);
      assert.equal(storage.get(APPEARANCE_STORAGE_KEYS[key]), option.value);
      assert.equal(wrapper.dataset[key], option.value);
    }
  }
});

test("appearance preferences default when localStorage is empty", () => {
  installLocalStorage();
  const { root, wrapper } = createShellRoot();

  assert.deepEqual(loadAppearancePreferences(root), DEFAULT_APPEARANCE);
  assert.equal(wrapper.dataset.theme, DEFAULT_APPEARANCE.theme);
  assert.equal(wrapper.dataset.treatment, DEFAULT_APPEARANCE.treatment);
  assert.equal(wrapper.dataset.density, DEFAULT_APPEARANCE.density);
});
