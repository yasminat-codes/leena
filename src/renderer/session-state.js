export const SESSION_STATE_TRANSITION_MS = 260;

export const SESSION_STATES = Object.freeze([
  "idle",
  "listening",
  "thinking",
  "acting",
  "done",
  "error",
]);

export const SESSION_STATE_EVENTS = Object.freeze({
  stateChanged: "realtime:state-changed",
  toolExecuting: "realtime:tool-executing",
  responseComplete: "realtime:response-complete",
  error: "realtime:error",
});

const eventSubscriptions = Object.freeze([
  Object.freeze({
    name: SESSION_STATE_EVENTS.stateChanged,
    onMethod: "onRealtimeStateChanged",
    offMethod: "offRealtimeStateChanged",
  }),
  Object.freeze({
    name: SESSION_STATE_EVENTS.toolExecuting,
    onMethod: "onRealtimeToolExecuting",
    offMethod: "offRealtimeToolExecuting",
  }),
  Object.freeze({
    name: SESSION_STATE_EVENTS.responseComplete,
    onMethod: "onRealtimeResponseComplete",
    offMethod: "offRealtimeResponseComplete",
  }),
  Object.freeze({
    name: SESSION_STATE_EVENTS.error,
    onMethod: "onRealtimeError",
    offMethod: "offRealtimeError",
  }),
]);

const stateAliases = new Map(
  Object.entries({
    idle: "idle",
    inactive: "idle",
    no_session: "idle",
    session_idle: "idle",
    ready: "connected",
    open: "connected",
    connected: "connected",
    reconnected: "connected",
    session_connected: "connected",
    call_connected: "connected",
    listening: "listening",
    mic_active: "listening",
    microphone_active: "listening",
    speech_started: "listening",
    input_audio_buffer_speech_started: "listening",
    waiting_for_speech: "listening",
    session_listening: "listening",
    thinking: "thinking",
    processing: "thinking",
    responding: "thinking",
    response_created: "thinking",
    response_in_progress: "thinking",
    assistant_thinking: "thinking",
    server_processing: "thinking",
    acting: "acting",
    tool_running: "acting",
    tool_executing: "acting",
    function_call: "acting",
    tool_call: "acting",
    done: "done",
    complete: "done",
    completed: "done",
    response_complete: "done",
    response_completed: "done",
    response_done: "done",
    disconnected: "disconnected",
    connection_lost: "disconnected",
    session_disconnected: "disconnected",
    closed: "disconnected",
    closing: "disconnected",
    offline: "disconnected",
    failed: "error",
    failure: "error",
    error: "error",
    session_failed: "error",
  }),
);

const sensitiveKeyPattern =
  /(authorization|bearer|token|secret|password|api[_-]?key|access[_-]?key)/i;

function createSnapshot({
  state = "idle",
  connected = false,
  tool = null,
  error = null,
  message = "",
  updatedAt = Date.now(),
} = {}) {
  assertSessionState(state);

  return Object.freeze({
    state,
    connected: Boolean(connected),
    tool,
    error,
    message: String(message || ""),
    updatedAt,
  });
}

function assertSessionState(state) {
  if (!SESSION_STATES.includes(state)) {
    throw new RangeError(`Unsupported session state: ${state}`);
  }
}

function defaultEventSource() {
  return globalThis.window?.leena ?? globalThis.window ?? null;
}

function defaultNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function sameVisualSnapshot(first, second) {
  return (
    first.state === second.state &&
    first.connected === second.connected &&
    first.message === second.message &&
    first.error === second.error &&
    sameTool(first.tool, second.tool)
  );
}

function sameTool(first, second) {
  if (first === second) {
    return true;
  }
  if (!first || !second) {
    return false;
  }
  return (
    first.name === second.name &&
    first.argsSummary === second.argsSummary &&
    first.resultPreview === second.resultPreview
  );
}

function normalizeEventPayload(args) {
  const [first, second] = args;
  const payload = args.length > 1 && isElectronEventLike(first) ? second : first;

  if (payload && typeof payload === "object" && "detail" in payload) {
    return payload.detail;
  }

  return payload;
}

function isElectronEventLike(value) {
  return Boolean(
    value && typeof value === "object" && ("sender" in value || "senderFrame" in value),
  );
}

function subscribeToEvent(source, config, callback) {
  const handler = (...args) => callback(normalizeEventPayload(args));

  if (!source) {
    return () => {};
  }

  if (typeof source[config.onMethod] === "function") {
    const token = source[config.onMethod](handler);

    if (typeof token === "function") {
      return token;
    }

    if (typeof source[config.offMethod] === "function") {
      return () => source[config.offMethod](token ?? handler);
    }

    return () => {};
  }

  if (typeof source.addEventListener === "function") {
    source.addEventListener(config.name, handler);
    return () => source.removeEventListener?.(config.name, handler);
  }

  if (typeof source.on === "function") {
    const token = source.on(config.name, handler);

    if (typeof token === "function") {
      return token;
    }

    if (typeof source.off === "function") {
      return () => source.off(config.name, handler);
    }

    if (typeof source.removeListener === "function") {
      return () => source.removeListener(config.name, handler);
    }
  }

  if (typeof source.addListener === "function") {
    source.addListener(config.name, handler);
    return () => source.removeListener?.(config.name, handler);
  }

  return () => {};
}

function normalizeStateToken(payload) {
  const rawToken =
    typeof payload === "string"
      ? payload
      : (payload?.sessionState ??
        payload?.state ??
        payload?.status ??
        payload?.phase ??
        payload?.connectionState ??
        payload?.mode ??
        payload?.type);

  if (typeof rawToken !== "string" || !rawToken.trim()) {
    return null;
  }

  const key = rawToken
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return stateAliases.get(key) ?? (SESSION_STATES.includes(key) ? key : null);
}

function normalizeToolPayload(payload) {
  const source = payload?.tool ?? payload?.toolCall ?? payload?.call ?? payload ?? {};
  const name = source.name ?? source.toolName ?? payload?.name ?? payload?.toolName ?? "tool";
  const args = source.args ?? source.arguments ?? payload?.args ?? payload?.arguments ?? null;
  const result =
    source.result ??
    source.output ??
    source.response ??
    payload?.result ??
    payload?.output ??
    payload?.response ??
    null;

  return Object.freeze({
    name: String(name || "tool"),
    args,
    argsSummary: limitText(
      source.argsSummary ?? payload?.argsSummary ?? summarizeArguments(args),
      120,
    ),
    resultPreview: limitText(
      source.resultPreview ?? payload?.resultPreview ?? summarizeResult(result),
      140,
    ),
  });
}

function normalizeToolResultPayload(payload, existingTool) {
  if (!existingTool && !payload?.tool && !payload?.toolCall) {
    return null;
  }

  const nextTool = normalizeToolPayload(payload);
  const hasPayloadToolName = Boolean(
    payload?.tool?.name ||
      payload?.tool?.toolName ||
      payload?.toolCall?.name ||
      payload?.toolCall?.toolName ||
      payload?.call?.name ||
      payload?.call?.toolName ||
      payload?.name ||
      payload?.toolName,
  );
  const resultPreview = nextTool.resultPreview || existingTool?.resultPreview || "";

  return Object.freeze({
    name: hasPayloadToolName ? nextTool.name : (existingTool?.name ?? nextTool.name),
    args: hasPayloadToolName ? nextTool.args : (existingTool?.args ?? nextTool.args),
    argsSummary: hasPayloadToolName
      ? nextTool.argsSummary
      : (existingTool?.argsSummary ?? nextTool.argsSummary),
    resultPreview,
  });
}

function normalizeErrorMessage(payload) {
  if (payload instanceof Error) {
    return payload.message || "Realtime session error";
  }

  if (typeof payload === "string") {
    return payload || "Realtime session error";
  }

  if (payload?.error) {
    return normalizeErrorMessage(payload.error);
  }

  if (typeof payload?.message === "string") {
    return payload.message;
  }

  if (typeof payload?.reason === "string") {
    return payload.reason;
  }

  return "Realtime session error";
}

function summarizeArguments(args) {
  const parsedArgs = parseJsonObject(args);

  if (!parsedArgs || Object.keys(parsedArgs).length === 0) {
    return "No arguments";
  }

  return Object.entries(parsedArgs)
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${summarizeValue(key, value)}`)
    .join(", ");
}

function summarizeResult(result) {
  if (result === undefined || result === null || result === "") {
    return "";
  }

  if (typeof result === "string") {
    return limitText(result, 140);
  }

  if (typeof result !== "object") {
    return String(result);
  }

  for (const key of ["message", "finalText", "summary", "text", "status", "error"]) {
    if (typeof result[key] === "string" && result[key].trim()) {
      return limitText(result[key], 140);
    }
  }

  const entries = Object.entries(result).slice(0, 3);
  return entries.map(([key, value]) => `${key}: ${summarizeValue(key, value)}`).join(", ");
}

function parseJsonObject(value) {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parseJsonObject(parsed);
    } catch {
      return value.trim() ? { value } : {};
    }
  }

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value;
  }

  return {};
}

function summarizeValue(key, value) {
  if (sensitiveKeyPattern.test(key)) {
    return "[redacted]";
  }

  if (typeof value === "string") {
    return limitText(value, 42);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.length} items]`;
  }

  if (value && typeof value === "object") {
    return "{...}";
  }

  return String(value);
}

function limitText(value, maxLength) {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

export class SessionStateManager {
  #clearTimeout;
  #connected = false;
  #debounceMs;
  #eventSource = null;
  #hasCommitted = false;
  #lastCommitAt = 0;
  #now;
  #pendingSnapshot = null;
  #setTimeout;
  #snapshot = createSnapshot();
  #subscribers = new Set();
  #timerId = null;
  #unsubscribers = [];

  constructor({
    eventSource = defaultEventSource(),
    debounceMs = SESSION_STATE_TRANSITION_MS,
    autoConnect = true,
    setTimeout: setTimeoutFn = globalThis.setTimeout?.bind(globalThis),
    clearTimeout: clearTimeoutFn = globalThis.clearTimeout?.bind(globalThis),
    now = defaultNow,
  } = {}) {
    this.#debounceMs = Math.max(0, Number(debounceMs) || 0);
    this.#setTimeout = setTimeoutFn;
    this.#clearTimeout = clearTimeoutFn;
    this.#now = now;
    this.#eventSource = eventSource;

    if (autoConnect && eventSource) {
      this.connect(eventSource);
    }
  }

  get snapshot() {
    return this.#snapshot;
  }

  get state() {
    return this.#snapshot.state;
  }

  connect(eventSource = this.#eventSource) {
    if (!eventSource || this.#unsubscribers.length > 0) {
      return this;
    }

    this.#eventSource = eventSource;
    this.#unsubscribers = eventSubscriptions.map((config) =>
      subscribeToEvent(eventSource, config, (payload) => this.receive(config.name, payload)),
    );
    return this;
  }

  disconnect() {
    for (const unsubscribe of this.#unsubscribers.splice(0)) {
      unsubscribe();
    }

    this.#clearPending();
    return this;
  }

  destroy() {
    this.disconnect();
    this.#subscribers.clear();
  }

  subscribe(listener, { emitCurrent = false } = {}) {
    if (typeof listener !== "function") {
      throw new TypeError("SessionStateManager.subscribe requires a listener");
    }

    this.#subscribers.add(listener);

    if (emitCurrent) {
      listener(this.#snapshot);
    }

    return () => {
      this.#subscribers.delete(listener);
    };
  }

  receive(eventName, payload = {}) {
    switch (eventName) {
      case SESSION_STATE_EVENTS.stateChanged:
        this.#handleStateChanged(payload);
        break;
      case SESSION_STATE_EVENTS.toolExecuting:
        this.#handleToolExecuting(payload);
        break;
      case SESSION_STATE_EVENTS.responseComplete:
        this.#handleResponseComplete(payload);
        break;
      case SESSION_STATE_EVENTS.error:
        this.#handleError(payload);
        break;
      default:
        throw new RangeError(`Unsupported realtime session event: ${eventName}`);
    }

    return this.#snapshot;
  }

  reset() {
    this.#connected = false;
    this.#clearPending();
    this.#commit(createSnapshot({ state: "idle" }), { force: true });
    return this;
  }

  #handleStateChanged(payload) {
    const normalized = normalizeStateToken(payload);

    if (!normalized) {
      return;
    }

    if (normalized === "connected") {
      this.#connected = true;
      this.#requestCommit(createSnapshot({ state: "idle", connected: true }));
      return;
    }

    if (normalized === "disconnected") {
      const activeSnapshot = this.#pendingSnapshot ?? this.#snapshot;
      this.#connected = false;

      if (activeSnapshot.state === "acting") {
        this.#requestCommit(
          createSnapshot({
            state: "error",
            error: "Realtime session disconnected during tool execution.",
          }),
        );
        return;
      }

      this.#requestCommit(createSnapshot({ state: "idle" }));
      return;
    }

    if (normalized === "error") {
      this.#handleError(payload);
      return;
    }

    this.#connected = normalized !== "idle";
    this.#requestCommit(
      createSnapshot({
        state: normalized,
        connected: this.#connected,
        message: typeof payload?.message === "string" ? payload.message : "",
      }),
    );
  }

  #handleToolExecuting(payload) {
    this.#connected = true;
    this.#requestCommit(
      createSnapshot({
        state: "acting",
        connected: true,
        tool: normalizeToolPayload(payload),
      }),
    );
  }

  #handleResponseComplete(payload) {
    this.#connected = true;
    const activeSnapshot = this.#pendingSnapshot ?? this.#snapshot;
    const tool = normalizeToolResultPayload(payload, activeSnapshot.tool);
    const message =
      typeof payload?.message === "string"
        ? payload.message
        : summarizeResult(payload?.response ?? payload?.result ?? payload?.output);

    this.#requestCommit(
      createSnapshot({
        state: "done",
        connected: true,
        tool,
        message,
      }),
    );
  }

  #handleError(payload) {
    this.#connected = false;
    this.#requestCommit(
      createSnapshot({
        state: "error",
        error: normalizeErrorMessage(payload),
      }),
    );
  }

  #requestCommit(nextSnapshot) {
    if (sameVisualSnapshot(nextSnapshot, this.#snapshot)) {
      this.#pendingSnapshot = null;
      return;
    }

    if (this.#debounceMs === 0 || !this.#hasCommitted || !this.#setTimeout) {
      this.#commit(nextSnapshot);
      return;
    }

    const elapsed = Math.max(0, this.#now() - this.#lastCommitAt);

    if (elapsed >= this.#debounceMs) {
      this.#clearPending();
      this.#commit(nextSnapshot);
      return;
    }

    this.#pendingSnapshot = nextSnapshot;

    if (this.#timerId !== null) {
      return;
    }

    this.#timerId = this.#setTimeout(() => {
      const snapshot = this.#pendingSnapshot;
      this.#timerId = null;
      this.#pendingSnapshot = null;

      if (snapshot) {
        this.#commit(snapshot);
      }
    }, this.#debounceMs - elapsed);
  }

  #commit(snapshot, { force = false } = {}) {
    if (!force && sameVisualSnapshot(snapshot, this.#snapshot)) {
      return;
    }

    this.#snapshot = snapshot;
    this.#hasCommitted = true;
    this.#lastCommitAt = this.#now();

    for (const subscriber of this.#subscribers) {
      subscriber(this.#snapshot);
    }
  }

  #clearPending() {
    if (this.#timerId !== null) {
      this.#clearTimeout?.(this.#timerId);
      this.#timerId = null;
    }

    this.#pendingSnapshot = null;
  }
}

export function createSessionStateManager(options) {
  return new SessionStateManager(options);
}
