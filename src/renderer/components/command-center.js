export const COMMAND_CENTER_CSS_HREF = new URL("./command-center.css", import.meta.url).href;

export const COMMAND_CENTER_VARIANTS = Object.freeze([
  "mini-orb",
  "mini-pill",
  "compact",
  "expanded",
]);

export const COMMAND_CENTER_STATES = Object.freeze([
  "idle",
  "listening",
  "thinking",
  "acting",
  "done",
  "error",
]);

export const COMMAND_CENTER_DIMENSIONS = Object.freeze({
  "mini-orb": Object.freeze({ width: 44, height: 44 }),
  "mini-pill": Object.freeze({ width: 176, height: 44 }),
  compact: Object.freeze({ width: 480, height: 60 }),
  expanded: Object.freeze({ width: 520, height: null }),
});

const variantClasses = {
  "mini-orb": "cc--mini-orb",
  "mini-pill": "cc--mini",
  compact: "cc--compact",
  expanded: "cc--expanded",
};

const stateCopy = {
  idle: {
    label: "READY",
    transcript: "Ready when you are.",
    hint: "Ask Leena to search, plan, or control your computer.",
    preview: "Computer control preview",
  },
  listening: {
    label: "LISTENING",
    transcript: "Listening...",
    hint: "Keep speaking naturally.",
    preview: "Listening for your request",
  },
  thinking: {
    label: "THINKING...",
    transcript: "Working through that.",
    hint: "Leena is deciding the next step.",
    preview: "Realtime response in progress",
  },
  acting: {
    label: "ACTING",
    transcript: "Taking action now.",
    hint: "Previewing the active tool before it runs.",
    preview: "Tool execution in progress",
  },
  done: {
    label: "DONE",
    transcript: "Done.",
    hint: "The last step completed successfully.",
    preview: "Response complete",
  },
  error: {
    label: "DIDN'T CATCH THAT",
    transcript: "I didn't catch that.",
    hint: "Try again with a little more context.",
    preview: "Realtime session needs attention",
  },
};

const waveHeights = [8, 15, 22, 12, 18, 9, 21, 14, 10, 19];

function assertValue(kind, value, allowed) {
  if (!allowed.includes(value)) {
    throw new RangeError(`Unsupported command center ${kind}: ${value}`);
  }
}

function createElement(tagName, className, textContent) {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (textContent !== undefined) {
    element.textContent = textContent;
  }

  return element;
}

function ensureCommandCenterCss() {
  if (!globalThis.document?.head || typeof document.querySelector !== "function") {
    return null;
  }

  const existing = document.querySelector(`link[href="${COMMAND_CENTER_CSS_HREF}"]`);

  if (existing) {
    return existing;
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = COMMAND_CENTER_CSS_HREF;
  link.dataset.commandCenterCss = "true";
  document.head.append(link);
  return link;
}

function createOrb() {
  const orb = createElement("span", "cc__orb");
  orb.setAttribute("aria-hidden", "true");

  for (const className of ["cc__orb-aurora", "cc__orb-surface", "cc__orb-core", "cc__orb-check"]) {
    const layer = createElement("span", className);
    layer.setAttribute("aria-hidden", "true");
    orb.append(layer);
  }

  return orb;
}

function createWave() {
  const wave = createElement("span", "cc__wave");
  wave.setAttribute("aria-hidden", "true");

  waveHeights.forEach((height, index) => {
    const bar = createElement("i");
    bar.style.height = `${height}px`;
    bar.style.animationDelay = `${index * 54}ms`;
    wave.append(bar);
  });

  return wave;
}

function normalizeSessionSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }

  const state = snapshot.state;

  if (!COMMAND_CENTER_STATES.includes(state)) {
    return null;
  }

  return {
    state,
    tool: normalizeToolSnapshot(snapshot.tool),
    error: typeof snapshot.error === "string" ? snapshot.error : "",
    message: typeof snapshot.message === "string" ? snapshot.message : "",
  };
}

function normalizeToolSnapshot(tool) {
  if (!tool || typeof tool !== "object") {
    return null;
  }

  return {
    name: typeof tool.name === "string" && tool.name ? tool.name : "tool",
    argsSummary: typeof tool.argsSummary === "string" ? tool.argsSummary : "",
    resultPreview: typeof tool.resultPreview === "string" ? tool.resultPreview : "",
  };
}

function createStateCopy(state, snapshot) {
  const copy = { ...stateCopy[state] };

  if (!snapshot || snapshot.state !== state) {
    return copy;
  }

  if (state === "error" && snapshot.error) {
    copy.transcript = snapshot.error;
    copy.hint = "Reconnect or try the request again.";
    copy.preview = snapshot.error;
    return copy;
  }

  if (state === "acting" && snapshot.tool) {
    const toolName = formatToolName(snapshot.tool.name);
    copy.transcript = `Running ${toolName}.`;
    copy.hint = snapshot.tool.argsSummary || "No tool arguments.";
    copy.preview = formatToolPreview(snapshot.tool);
    return copy;
  }

  if (state === "done") {
    if (snapshot.message) {
      copy.transcript = snapshot.message;
    }

    if (snapshot.tool?.resultPreview) {
      copy.preview = `Result: ${snapshot.tool.resultPreview}`;
    } else if (snapshot.message) {
      copy.preview = snapshot.message;
    }
  }

  return copy;
}

function formatToolName(name) {
  return String(name || "tool").replace(/[_-]+/g, " ");
}

function formatToolPreview(tool) {
  const name = formatToolName(tool.name);

  if (tool.argsSummary) {
    return `${name} · ${tool.argsSummary}`;
  }

  return name;
}

export class CommandCenter {
  #container = null;
  #element = null;
  #sessionSnapshot = null;
  #sessionStateUnsubscribe = null;
  #variant = "compact";
  #state = "idle";
  #timer = "0:00";
  #nodes = {};

  constructor({
    variant = "compact",
    state = "idle",
    timer = "0:00",
    sessionStateManager = null,
  } = {}) {
    assertValue("variant", variant, COMMAND_CENTER_VARIANTS);
    assertValue("state", state, COMMAND_CENTER_STATES);

    this.#variant = variant;
    this.#state = state;
    this.#timer = timer;
    this.#element = this.#render();
    this.#applyVariant();
    this.#applyState();

    if (sessionStateManager) {
      this.bindSessionStateManager(sessionStateManager);
    }
  }

  get element() {
    return this.#element;
  }

  get variant() {
    return this.#variant;
  }

  get state() {
    return this.#state;
  }

  mount(container) {
    if (!container || typeof container.append !== "function") {
      throw new TypeError("CommandCenter.mount requires a container element");
    }

    ensureCommandCenterCss();
    container.append(this.#element);
    this.#container = container;
    return this;
  }

  destroy() {
    this.unbindSessionStateManager();

    if (typeof this.#element.remove === "function") {
      this.#element.remove();
    } else if (this.#container?.children) {
      this.#container.children = this.#container.children.filter(
        (child) => child !== this.#element,
      );
    }

    this.#container = null;
    return this;
  }

  setVariant(variant) {
    assertValue("variant", variant, COMMAND_CENTER_VARIANTS);
    this.#variant = variant;
    this.#applyVariant();
    return this;
  }

  setState(state) {
    assertValue("state", state, COMMAND_CENTER_STATES);
    this.#state = state;
    this.#applyState();
    return this;
  }

  setSessionSnapshot(snapshot) {
    const normalized = normalizeSessionSnapshot(snapshot);

    if (!normalized) {
      return this;
    }

    this.#sessionSnapshot = normalized;
    return this.setState(normalized.state);
  }

  bindSessionStateManager(sessionStateManager) {
    if (!sessionStateManager || typeof sessionStateManager.subscribe !== "function") {
      throw new TypeError("CommandCenter.bindSessionStateManager requires a session manager");
    }

    this.unbindSessionStateManager();
    this.#sessionStateUnsubscribe = sessionStateManager.subscribe(
      (snapshot) => this.setSessionSnapshot(snapshot),
      { emitCurrent: true },
    );
    return this;
  }

  unbindSessionStateManager() {
    if (typeof this.#sessionStateUnsubscribe === "function") {
      this.#sessionStateUnsubscribe();
    }

    this.#sessionStateUnsubscribe = null;
    return this;
  }

  setTimer(timer) {
    this.#timer = String(timer);
    this.#nodes.timer.textContent = this.#timer;
    return this;
  }

  #render() {
    const root = createElement("section", "cc");
    root.setAttribute("aria-label", "Leena command center");
    root.setAttribute("role", "status");
    root.setAttribute("aria-live", "polite");

    const orbWrap = createElement("div", "cc__orb-wrap");
    const orb = createOrb();
    orbWrap.append(orb);

    const liveDot = createElement("span", "cc__live-dot");
    liveDot.setAttribute("aria-hidden", "true");

    const status = createElement("span", "cc__status");
    const timer = createElement("span", "cc__timer", this.#timer);
    const miniText = createElement("span", "cc__mini-text");
    miniText.append(liveDot, status);

    const wave = createWave();

    const transcript = createElement("p", "cc__transcript");
    const preview = createElement("div", "cc__preview");
    const previewIcon = createElement("span", "cc__preview-icon");
    const previewText = createElement("span", "cc__preview-text", "Computer control preview");
    preview.append(previewIcon, previewText);

    const hint = createElement("p", "cc__hint");
    const content = createElement("div", "cc__content");
    content.append(miniText, timer, transcript, wave);

    const expanded = createElement("div", "cc__expanded");
    expanded.append(preview, hint);

    root.append(orbWrap, content, expanded);

    this.#nodes = {
      root,
      status,
      timer,
      transcript,
      hint,
      wave,
      preview,
      previewIcon,
      previewText,
    };

    return root;
  }

  #applyVariant() {
    const dimensions = COMMAND_CENTER_DIMENSIONS[this.#variant];

    for (const className of Object.values(variantClasses)) {
      this.#element.classList.remove(className);
    }

    this.#element.classList.add(variantClasses[this.#variant]);
    this.#element.dataset.variant = this.#variant;
    this.#element.style.width = `${dimensions.width}px`;
    this.#element.style.height = dimensions.height === null ? "" : `${dimensions.height}px`;
    this.#element.dataset.width = String(dimensions.width);
    this.#element.dataset.height = dimensions.height === null ? "auto" : String(dimensions.height);
  }

  #applyState() {
    const copy = createStateCopy(this.#state, this.#sessionSnapshot);
    const activeTool =
      this.#state === "acting" || this.#state === "done" ? this.#sessionSnapshot?.tool : null;

    this.#element.dataset.state = this.#state;
    this.#element.dataset.hasTool = String(Boolean(activeTool));

    if (activeTool?.name) {
      this.#element.dataset.toolName = activeTool.name;
    } else {
      delete this.#element.dataset.toolName;
    }

    this.#nodes.status.textContent = copy.label;
    this.#nodes.transcript.textContent = copy.transcript;
    this.#nodes.hint.textContent = copy.hint;
    this.#nodes.previewText.textContent = copy.preview;
  }
}

export function createCommandCenter(options) {
  return new CommandCenter(options);
}

export function demoAllStates(container, { interval = 900 } = {}) {
  const commandCenter = new CommandCenter({ variant: "mini-orb", state: "idle" });
  let index = 0;

  if (container) {
    commandCenter.mount(container);
  }

  const combinations = COMMAND_CENTER_VARIANTS.flatMap((variant) =>
    COMMAND_CENTER_STATES.map((state) => ({ variant, state })),
  );

  const tick = () => {
    const next = combinations[index % combinations.length];
    commandCenter.setVariant(next.variant).setState(next.state);
    index += 1;
  };

  tick();
  const timerId = globalThis.setInterval?.(tick, interval) ?? null;

  return {
    commandCenter,
    stop() {
      if (timerId !== null) {
        clearInterval(timerId);
      }
    },
    destroy() {
      this.stop();
      commandCenter.destroy();
    },
  };
}
