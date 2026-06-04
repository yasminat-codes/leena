import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  COMMAND_CENTER_VARIANTS,
  CommandCenter,
} from "../src/renderer/components/command-center.js";
import {
  SESSION_STATE_EVENTS,
  SESSION_STATE_TRANSITION_MS,
  SessionStateManager,
} from "../src/renderer/session-state.js";

const rendererSource = readFileSync(
  new URL("../src/renderer/renderer.js", import.meta.url),
  "utf8",
);

class FakeEventSource {
  #listeners = new Map();

  on(eventName, listener) {
    const listeners = this.#listeners.get(eventName) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(eventName, listeners);
    return listener;
  }

  off(eventName, listener) {
    this.#listeners.get(eventName)?.delete(listener);
  }

  emit(eventName, payload) {
    for (const listener of this.#listeners.get(eventName) ?? []) {
      listener(payload);
    }
  }
}

class FakeClock {
  #now = 1000;
  #nextTimerId = 1;
  #timers = new Map();

  now = () => this.#now;

  setTimeout = (callback, delay) => {
    const timerId = this.#nextTimerId;
    this.#nextTimerId += 1;
    this.#timers.set(timerId, {
      callback,
      dueAt: this.#now + Math.max(0, delay),
    });
    return timerId;
  };

  clearTimeout = (timerId) => {
    this.#timers.delete(timerId);
  };

  advance(ms) {
    this.#now += ms;

    for (const [timerId, timer] of [...this.#timers.entries()].sort(
      (first, second) => first[1].dueAt - second[1].dueAt,
    )) {
      if (timer.dueAt > this.#now) {
        continue;
      }

      this.#timers.delete(timerId);
      timer.callback();
    }
  }
}

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

function createManager({ eventSource = new FakeEventSource(), debounceMs = 0, clock = null } = {}) {
  return new SessionStateManager({
    eventSource,
    debounceMs,
    now: clock?.now,
    setTimeout: clock?.setTimeout,
    clearTimeout: clock?.clearTimeout,
  });
}

test.afterEach(() => {
  delete globalThis.document;
});

test("SessionStateManager maps realtime push events to all assistant states", () => {
  const eventSource = new FakeEventSource();
  const manager = createManager({ eventSource });
  const snapshots = [];

  manager.subscribe((snapshot) => snapshots.push(snapshot));

  eventSource.emit(SESSION_STATE_EVENTS.stateChanged, { state: "connected" });
  eventSource.emit(SESSION_STATE_EVENTS.stateChanged, { state: "listening" });
  eventSource.emit(SESSION_STATE_EVENTS.stateChanged, { state: "response.created" });
  eventSource.emit(SESSION_STATE_EVENTS.toolExecuting, {
    name: "web_search",
    args: { query: "Leena realtime docs", apiKey: "sk-secret" },
  });
  eventSource.emit(SESSION_STATE_EVENTS.responseComplete, {
    result: { message: "Found three candidate docs." },
  });
  eventSource.emit(SESSION_STATE_EVENTS.error, { message: "Socket failed" });

  assert.deepEqual(
    snapshots.map((snapshot) => snapshot.state),
    ["idle", "listening", "thinking", "acting", "done", "error"],
  );
  assert.equal(snapshots[0].connected, true);
  assert.match(snapshots[3].tool.argsSummary, /query: Leena realtime docs/);
  assert.match(snapshots[3].tool.argsSummary, /apiKey: \[redacted\]/);
  assert.equal(snapshots[4].tool.resultPreview, "Found three candidate docs.");
  assert.equal(snapshots[5].error, "Socket failed");

  manager.destroy();
});

test("SessionStateManager coalesces rapid state changes over the 260ms transition window", () => {
  const eventSource = new FakeEventSource();
  const clock = new FakeClock();
  const manager = createManager({
    eventSource,
    debounceMs: SESSION_STATE_TRANSITION_MS,
    clock,
  });
  const snapshots = [];

  manager.subscribe((snapshot) => snapshots.push(snapshot));

  eventSource.emit(SESSION_STATE_EVENTS.stateChanged, { state: "listening" });
  clock.advance(10);
  eventSource.emit(SESSION_STATE_EVENTS.stateChanged, { state: "thinking" });
  clock.advance(10);
  eventSource.emit(SESSION_STATE_EVENTS.toolExecuting, {
    name: "take_screenshot",
    args: { sourceId: "display-1" },
  });

  assert.deepEqual(
    snapshots.map((snapshot) => snapshot.state),
    ["listening"],
  );

  clock.advance(SESSION_STATE_TRANSITION_MS - 21);
  assert.deepEqual(
    snapshots.map((snapshot) => snapshot.state),
    ["listening"],
  );

  clock.advance(1);
  assert.deepEqual(
    snapshots.map((snapshot) => snapshot.state),
    ["listening", "acting"],
  );
  assert.equal(snapshots.at(-1).tool.name, "take_screenshot");

  manager.destroy();
});

test("SessionStateManager reports disconnect during action as error and reconnect as idle", () => {
  const eventSource = new FakeEventSource();
  const manager = createManager({ eventSource });

  eventSource.emit(SESSION_STATE_EVENTS.toolExecuting, {
    name: "computer_use_task",
    args: { task: "Open the dashboard" },
  });
  assert.equal(manager.snapshot.state, "acting");

  eventSource.emit(SESSION_STATE_EVENTS.stateChanged, { state: "disconnected" });
  assert.equal(manager.snapshot.state, "error");
  assert.match(manager.snapshot.error, /disconnected during tool execution/);

  eventSource.emit(SESSION_STATE_EVENTS.stateChanged, { state: "reconnected" });
  assert.equal(manager.snapshot.state, "idle");
  assert.equal(manager.snapshot.error, null);
  assert.equal(manager.snapshot.connected, true);

  manager.destroy();
});

test("CommandCenter consumes SessionStateManager snapshots across every variant", () => {
  globalThis.document = createDocument();

  const eventSource = new FakeEventSource();
  const manager = createManager({ eventSource });
  const commandCenters = COMMAND_CENTER_VARIANTS.map(
    (variant) => new CommandCenter({ variant, sessionStateManager: manager }),
  );

  eventSource.emit(SESSION_STATE_EVENTS.toolExecuting, {
    name: "take_screenshot",
    args: { reason: "inspect current screen" },
  });

  for (const commandCenter of commandCenters) {
    assert.equal(commandCenter.state, "acting");
    assert.equal(commandCenter.element.dataset.state, "acting");
    assert.equal(commandCenter.element.dataset.hasTool, "true");
    assert.equal(commandCenter.element.dataset.toolName, "take_screenshot");
    assert.match(
      commandCenter.element.querySelector(".cc__preview-text").textContent,
      /take screenshot .*reason: inspect current screen/,
    );
  }

  eventSource.emit(SESSION_STATE_EVENTS.responseComplete, {
    result: { message: "Screenshot captured and attached." },
  });

  for (const commandCenter of commandCenters) {
    assert.equal(commandCenter.state, "done");
    assert.match(
      commandCenter.element.querySelector(".cc__preview-text").textContent,
      /Screenshot captured and attached\./,
    );
    commandCenter.destroy();
  }

  manager.destroy();
});

test("renderer binds the global voice dock to normalized orb state attributes", () => {
  assert.match(rendererSource, /import \{ normalizeOrbState \} from "\.\/components\/orb\.js";/);
  assert.match(rendererSource, /"--legacy-nebula-2", "var\(--orb-b\)"/);
  assert.match(rendererSource, /"--legacy-orb-core", "var\(--orb-signal\)"/);
  assert.match(rendererSource, /bindVoiceDockOrbTokens\(\);/);
  assert.match(rendererSource, /appShellElement\.dataset\.orbState = normalized;/);
  assert.match(rendererSource, /callStageOrbButton/);
  assert.match(rendererSource, /element\.dataset\.state = normalized;/);
  assert.match(rendererSource, /surface\.style\.setProperty\(\s*"--orb-scale"/);
  assert.match(rendererSource, /surface\.style\.setProperty\("--orb-brightness"/);
  assert.match(rendererSource, /surface\.style\.setProperty\("--orb-saturation"/);
  assert.match(rendererSource, /setVoiceOrbState\("tool"\);/);
  assert.match(rendererSource, /syncVoiceOrbStateForMode\(appShellElement\.dataset\.mode\);/);
});
