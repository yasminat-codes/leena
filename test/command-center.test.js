import assert from "node:assert/strict";
import test from "node:test";
import {
  COMMAND_CENTER_CSS_HREF,
  COMMAND_CENTER_DIMENSIONS,
  COMMAND_CENTER_STATES,
  COMMAND_CENTER_VARIANTS,
  CommandCenter,
  createCommandCenter,
  demoAllStates,
} from "../src/renderer/components/command-center.js";

class TestClassList {
  #classes = new Set();

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

  toString() {
    return [...this.#classes].join(" ");
  }
}

class TestElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.classList = new TestClassList();
    this.dataset = {};
    this.parentElement = null;
    this.style = {};
    this.textContent = "";
  }

  set className(value) {
    this.classList = new TestClassList();

    for (const className of String(value).split(/\s+/).filter(Boolean)) {
      this.classList.add(className);
    }
  }

  get className() {
    return this.classList.toString();
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
  if (selector.startsWith(".")) {
    return element.classList.contains(selector.slice(1));
  }

  if (selector.startsWith("link[")) {
    return element.tagName === "LINK" && element.href === COMMAND_CENTER_CSS_HREF;
  }

  return element.tagName.toLowerCase() === selector.toLowerCase();
}

function createDocument() {
  const head = new TestElement("head");
  const body = new TestElement("body");

  return {
    head,
    body,
    createElement: (tagName) => new TestElement(tagName),
    querySelector: (selector) => head.querySelector(selector) ?? body.querySelector(selector),
  };
}

test.beforeEach(() => {
  globalThis.document = createDocument();
});

test.afterEach(() => {
  delete globalThis.document;
});

test("CommandCenter exposes the required API and default DOM", () => {
  const commandCenter = new CommandCenter();

  assert.equal(commandCenter.variant, "compact");
  assert.equal(commandCenter.state, "idle");
  assert.equal(commandCenter.element.classList.contains("cc"), true);
  assert.equal(commandCenter.element.classList.contains("cc--compact"), true);
  assert.equal(commandCenter.element.dataset.state, "idle");
  assert.equal(commandCenter.element.getAttribute("role"), "status");
  assert.equal(commandCenter.element.querySelector(".cc__orb") !== null, true);
  assert.equal(commandCenter.element.querySelectorAll(".cc__wave i").length, 0);
  assert.equal(commandCenter.element.querySelectorAll("i").length, 10);

  for (const method of ["mount", "destroy", "setVariant", "setState", "setTimer"]) {
    assert.equal(typeof commandCenter[method], "function", `${method} should be exposed`);
  }
});

test("createCommandCenter returns a CommandCenter instance", () => {
  const commandCenter = createCommandCenter({ variant: "mini-orb", state: "done" });

  assert.equal(commandCenter instanceof CommandCenter, true);
  assert.equal(commandCenter.variant, "mini-orb");
  assert.equal(commandCenter.state, "done");
});

test("setVariant validates variants and applies dimension mapping", () => {
  const commandCenter = new CommandCenter();

  for (const variant of COMMAND_CENTER_VARIANTS) {
    const dimensions = COMMAND_CENTER_DIMENSIONS[variant];

    assert.equal(commandCenter.setVariant(variant), commandCenter);
    assert.equal(commandCenter.variant, variant);
    assert.equal(commandCenter.element.dataset.variant, variant);
    assert.equal(commandCenter.element.dataset.width, String(dimensions.width));
    assert.equal(
      commandCenter.element.dataset.height,
      dimensions.height === null ? "auto" : String(dimensions.height),
    );
    assert.equal(commandCenter.element.style.width, `${dimensions.width}px`);
    assert.equal(
      commandCenter.element.style.height,
      dimensions.height === null ? "" : `${dimensions.height}px`,
    );
  }

  assert.throws(() => commandCenter.setVariant("wide"), /Unsupported command center variant/);
});

test("setState validates states and updates visible copy", () => {
  const commandCenter = new CommandCenter();

  for (const state of COMMAND_CENTER_STATES) {
    assert.equal(commandCenter.setState(state), commandCenter);
    assert.equal(commandCenter.state, state);
    assert.equal(commandCenter.element.dataset.state, state);
  }

  assert.equal(
    commandCenter.setState("done").element.querySelector(".cc__status").textContent,
    "DONE",
  );
  assert.equal(
    commandCenter.setState("error").element.querySelector(".cc__status").textContent,
    "DIDN'T CATCH THAT",
  );
  assert.throws(() => commandCenter.setState("sleeping"), /Unsupported command center state/);
});

test("mount self-loads CSS once and destroy removes the component", () => {
  const container = new TestElement("div");
  const first = new CommandCenter();
  const second = new CommandCenter();

  assert.equal(first.mount(container), first);
  assert.equal(second.mount(container), second);
  assert.equal(container.children.length, 2);
  assert.equal(document.head.children.length, 1);
  assert.equal(document.head.children[0].tagName, "LINK");
  assert.equal(document.head.children[0].href, COMMAND_CENTER_CSS_HREF);

  assert.equal(first.destroy(), first);
  assert.equal(container.children.length, 1);
  assert.equal(container.children[0], second.element);
  second.destroy();
  assert.equal(container.children.length, 0);
});

test("mount rejects invalid containers", () => {
  const commandCenter = new CommandCenter();

  assert.throws(() => commandCenter.mount(null), /requires a container element/);
  assert.throws(() => commandCenter.mount({}), /requires a container element/);
});

test("setTimer updates timer copy", () => {
  const commandCenter = new CommandCenter();

  assert.equal(commandCenter.setTimer("2:31"), commandCenter);
  assert.equal(commandCenter.element.querySelector(".cc__timer").textContent, "2:31");
});

test("demoAllStates cycles all combinations and exposes controls", () => {
  const container = new TestElement("div");
  const previousSetInterval = globalThis.setInterval;
  const previousClearInterval = globalThis.clearInterval;
  const callbacks = [];
  const cleared = [];

  globalThis.setInterval = (callback, interval) => {
    callbacks.push({ callback, interval });
    return callbacks.length;
  };
  globalThis.clearInterval = (timerId) => {
    cleared.push(timerId);
  };

  try {
    const demo = demoAllStates(container, { interval: 123 });

    assert.equal(typeof demo.stop, "function");
    assert.equal(typeof demo.destroy, "function");
    assert.equal(demo.commandCenter instanceof CommandCenter, true);
    assert.equal(container.children.length, 1);
    assert.equal(callbacks.length, 1);
    assert.equal(callbacks[0].interval, 123);
    assert.equal(demo.commandCenter.variant, "mini-orb");
    assert.equal(demo.commandCenter.state, "idle");

    callbacks[0].callback();
    assert.equal(demo.commandCenter.variant, "mini-orb");
    assert.equal(demo.commandCenter.state, "listening");

    demo.destroy();
    assert.deepEqual(cleared, [1]);
    assert.equal(container.children.length, 0);
  } finally {
    globalThis.setInterval = previousSetInterval;
    globalThis.clearInterval = previousClearInterval;
  }
});
