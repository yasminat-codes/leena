import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMAND_CENTER_STATES,
  COMMAND_CENTER_VARIANTS,
  CommandCenter,
} from "../src/renderer/components/command-center.js";
import { createOrb } from "../src/renderer/components/orb.js";
import { createWaveform } from "../src/renderer/components/waveform.js";
import { renderActivity } from "../src/renderer/screens/activity.js";
import { renderHome } from "../src/renderer/screens/home.js";
import { renderIntegrations } from "../src/renderer/screens/integrations.js";
import {
  applyAppearancePreference,
  renderSettings,
  SETTINGS_MOCK_DATA,
} from "../src/renderer/screens/settings.js";
import { renderTasks } from "../src/renderer/screens/tasks.js";
import { initShell, setActiveScreen, shellScreens } from "../src/renderer/shell.js";

const screenContracts = Object.freeze([
  Object.freeze({ name: "Home", className: "home-screen", render: renderHome }),
  Object.freeze({ name: "Activity", className: "activity-screen", render: renderActivity }),
  Object.freeze({ name: "Tasks", className: "tasks-screen", render: renderTasks }),
  Object.freeze({
    name: "Integrations",
    className: "integrations-screen",
    render: renderIntegrations,
  }),
  Object.freeze({ name: "Settings", className: "settings-screen", render: renderSettings }),
]);

class TestClassList {
  #classes = new Set();

  constructor(classes = []) {
    this.add(...classes);
  }

  add(...classes) {
    for (const className of classes) {
      this.#classes.add(className);
    }
  }

  remove(...classes) {
    for (const className of classes) {
      this.#classes.delete(className);
    }
  }

  contains(className) {
    return this.#classes.has(className);
  }

  toggle(className, force) {
    const shouldAdd = force ?? !this.contains(className);
    if (shouldAdd) {
      this.add(className);
    } else {
      this.remove(className);
    }
    return shouldAdd;
  }

  toString() {
    return [...this.#classes].join(" ");
  }
}

class TestElement {
  constructor(
    tagName = "div",
    { id = "", classes = [], dataset = {}, onSetInnerHTML = null } = {},
  ) {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.dataset = { ...dataset };
    this.attributes = new Map();
    this.children = [];
    this.listeners = new Map();
    this.parentElement = null;
    this.style = {};
    this.textContent = "";
    this._innerHTML = "";
    this.onSetInnerHTML = onSetInnerHTML;
    this.classList = new TestClassList(classes);
  }

  set className(value) {
    this.classList = new TestClassList(String(value).split(/\s+/).filter(Boolean));
  }

  get className() {
    return this.classList.toString();
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    this.onSetInnerHTML?.(this._innerHTML);
  }

  get innerHTML() {
    return this._innerHTML;
  }

  append(...children) {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }

  remove() {
    if (!this.parentElement) {
      return;
    }
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  click() {
    for (const listener of this.listeners.get("click") ?? []) {
      listener({ currentTarget: this, target: this });
    }
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

  animate(keyframes, options) {
    const animation = {
      cancelled: false,
      keyframes,
      options,
      cancel() {
        this.cancelled = true;
      },
    };
    return animation;
  }

  matches(selector) {
    return matchesSelector(this, selector);
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = (element) => {
      if (matchesSelector(element, selector)) {
        matches.push(element);
      }
      for (const child of element.children) {
        visit(child);
      }
    };
    visit(this);
    return matches;
  }
}

function matchesSelector(element, selector) {
  if (selector === "#app-shell.leena") {
    return element.id === "app-shell" && element.classList.contains("leena");
  }

  if (selector === "[data-appearance-key][data-appearance-value]") {
    return Boolean(element.dataset.appearanceKey && element.dataset.appearanceValue);
  }

  const appearanceKey = selector.match(/^\[data-appearance-key="([^"]+)"\]$/)?.[1];
  if (appearanceKey) {
    return element.dataset.appearanceKey === appearanceKey;
  }

  const linkHref = selector.match(/^link\[href="([^"]+)"\]$/)?.[1];
  if (linkHref) {
    return element.tagName === "LINK" && element.href === linkHref;
  }

  if (selector.startsWith(".")) {
    return element.classList.contains(selector.slice(1));
  }

  if (selector.startsWith("#")) {
    return element.id === selector.slice(1);
  }

  return element.tagName.toLowerCase() === selector.toLowerCase();
}

function createDocument() {
  const head = new TestElement("head");
  const body = new TestElement("body");

  return {
    body,
    head,
    createElement: (tagName) => new TestElement(tagName),
    querySelector: (selector) => head.querySelector(selector) ?? body.querySelector(selector),
    querySelectorAll: (selector) => [
      ...head.querySelectorAll(selector),
      ...body.querySelectorAll(selector),
    ],
  };
}

function installLocalStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
  return values;
}

function createShellRoot() {
  const root = new TestElement();
  const wrapper = new TestElement("main", { id: "app-shell", classes: ["leena"] });
  const title = new TestElement("h1", { id: "shell-title" });
  const date = new TestElement("time", { id: "shell-date" });
  const content = new TestElement("section", { id: "shell-content" });
  const navItems = shellScreens.map(
    (screen) => new TestElement("button", { classes: ["nav-item"], dataset: { screen } }),
  );

  root.append(wrapper, title, date, content, ...navItems);
  return { content, navItems, root, title, wrapper };
}

test.beforeEach(() => {
  globalThis.document = createDocument();
  globalThis.matchMedia = () => ({ matches: false });
});

test.afterEach(() => {
  delete globalThis.document;
  delete globalThis.localStorage;
  delete globalThis.matchMedia;
});

test("screen renderers return non-empty HTML with expected screen classes", () => {
  assert.deepEqual(
    shellScreens,
    screenContracts.map((screen) => screen.name),
  );

  for (const { className, name, render } of screenContracts) {
    const html = render();

    assert.equal(typeof html, "string", `${name} returns HTML`);
    assert.ok(html.trim().length > 0, `${name} returns non-empty HTML`);
    assert.match(html, new RegExp(`class="${className}\\b`), `${name} renders ${className}`);
  }
});

test("shell sidebar navigation switches all screens", () => {
  installLocalStorage();
  const { content, navItems, root, title, wrapper } = createShellRoot();
  const shell = initShell(root);

  assert.equal(typeof shell?.setActiveScreen, "function");
  assert.equal(title.textContent, "Home");
  assert.match(content.innerHTML, /home-screen/);
  assert.equal(wrapper.dataset.theme, "workspace");
  assert.equal(wrapper.dataset.treatment, "workspace");
  assert.equal(wrapper.dataset.density, "comfortable");

  for (const navItem of navItems) {
    const expectedScreen = navItem.dataset.screen;
    const expectedClass = screenContracts.find(
      (screen) => screen.name === expectedScreen,
    ).className;

    navItem.click();

    assert.equal(title.textContent, expectedScreen);
    assert.match(content.innerHTML, new RegExp(expectedClass));
    assert.equal(navItem.classList.contains("nav-item--active"), true);
    assert.equal(navItem.getAttribute("aria-current"), "page");
    assert.equal(setActiveScreen(expectedScreen.toLowerCase(), root), expectedScreen);
  }
});

test("command center mounts every variant and state combination", () => {
  const container = new TestElement("div");

  for (const variant of COMMAND_CENTER_VARIANTS) {
    for (const state of COMMAND_CENTER_STATES) {
      assert.doesNotThrow(() => {
        const commandCenter = new CommandCenter({ state, variant });

        assert.equal(commandCenter.variant, variant);
        assert.equal(commandCenter.state, state);
        assert.equal(commandCenter.mount(container), commandCenter);
        assert.equal(commandCenter.setVariant(variant), commandCenter);
        assert.equal(commandCenter.setState(state), commandCenter);
        assert.equal(commandCenter.setTimer("1:23"), commandCenter);
        assert.equal(commandCenter.destroy(), commandCenter);
      }, `${variant} / ${state} should mount without throwing`);
    }
  }

  assert.equal(container.children.length, 0);
});

test("orb and waveform factories expose safe DOM methods", () => {
  const orb = createOrb({ animated: true, ring: true, size: "hero" });

  for (const method of ["pulse", "breathe", "shake", "stop"]) {
    assert.equal(typeof orb[method], "function", `orb.${method} exists`);
    assert.doesNotThrow(() => orb[method]());
  }

  const waveform = createWaveform({ bars: 5, color: "currentColor", height: 18 });

  for (const method of ["play", "shimmer", "pause"]) {
    assert.equal(typeof waveform[method], "function", `waveform.${method} exists`);
    assert.doesNotThrow(() => waveform[method]());
  }
});

test("settings appearance helper applies every theme treatment density matrix", () => {
  const storage = installLocalStorage();
  const root = new TestElement();
  const exactWrapper = new TestElement("main", { id: "app-shell", classes: ["leena"] });
  const looseId = new TestElement("main", { id: "app-shell" });
  const looseClass = new TestElement("main", { classes: ["leena"] });

  root.append(looseId, looseClass, exactWrapper);

  for (const theme of SETTINGS_MOCK_DATA.appearance.theme.map((item) => item.value)) {
    for (const treatment of SETTINGS_MOCK_DATA.appearance.treatment.map((item) => item.value)) {
      for (const density of SETTINGS_MOCK_DATA.appearance.density.map((item) => item.value)) {
        assert.equal(applyAppearancePreference(root, "theme", theme), theme);
        assert.equal(applyAppearancePreference(root, "treatment", treatment), treatment);
        assert.equal(applyAppearancePreference(root, "density", density), density);

        assert.equal(exactWrapper.dataset.theme, theme);
        assert.equal(exactWrapper.dataset.treatment, treatment);
        assert.equal(exactWrapper.dataset.density, density);
        assert.equal(looseId.dataset.theme, undefined);
        assert.equal(looseClass.dataset.theme, undefined);
        assert.equal(storage.get("leena-theme"), theme);
        assert.equal(storage.get("leena-treatment"), treatment);
        assert.equal(storage.get("leena-density"), density);
      }
    }
  }
});
