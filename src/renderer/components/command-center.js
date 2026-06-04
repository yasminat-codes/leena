import { createChatBubble } from "./chat-bubble.js";
import { createChatInput } from "./chat-input.js";

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

function createOption(value, label) {
  const option = createElement("option", null, label || value);
  option.value = value;
  return option;
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

  const resultPreview =
    typeof tool.resultPreview === "string" ? tool.resultPreview : summarizePermissionResult(tool);

  return {
    name: typeof tool.name === "string" && tool.name ? tool.name : "tool",
    argsSummary: typeof tool.argsSummary === "string" ? tool.argsSummary : "",
    resultPreview,
    permission: normalizePermissionSnapshot(
      tool.permission ?? tool.result?.permission ?? tool.result,
      tool.name,
      resultPreview,
    ),
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

  if ((state === "acting" || state === "done") && snapshot.tool) {
    const permissionCopy = createPermissionStateCopy(snapshot.tool);
    if (permissionCopy) {
      return permissionCopy;
    }
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

function createPermissionStateCopy(tool) {
  const permission = tool.permission ?? inferPermissionFromPreview(tool);
  if (!permission) {
    return null;
  }

  const blocked = ["blocked", "setup_required", "denied"].includes(permission.kind);
  const label = blocked ? "BLOCKED" : "CONFIRM";
  const toolName = formatToolName(permission.toolName || tool.name);
  const action = blocked ? "blocked" : "needs approval";
  const details = permission.summary || tool.argsSummary || "No tool arguments.";

  return {
    label,
    transcript: `${toolName} ${action}.`,
    hint: permission.message || "Review the permission request before continuing.",
    preview: `Risk: ${permission.level || "unknown"} · ${details}`,
  };
}

function inferPermissionFromPreview(tool) {
  const preview = String(tool.resultPreview || "");
  const lowerPreview = preview.toLowerCase();
  if (!preview) {
    return null;
  }

  if (lowerPreview.includes("requires") && /approval|confirmation/.test(lowerPreview)) {
    return {
      kind: "confirmation_required",
      toolName: tool.name,
      level: inferPermissionLevelForTool(tool.name),
      message: preview,
      summary: tool.argsSummary,
    };
  }

  if (
    lowerPreview.includes("permission metadata is unknown or stale") ||
    lowerPreview.includes("blocked") ||
    lowerPreview.includes("grant ")
  ) {
    return {
      kind: "blocked",
      toolName: tool.name,
      level: inferPermissionLevelForTool(tool.name),
      message: preview,
      summary: tool.argsSummary,
    };
  }

  return null;
}

function normalizePermissionSnapshot(permission, toolName, resultPreview = "") {
  if (!permission || typeof permission !== "object") {
    return inferPermissionFromPreview({ name: toolName, argsSummary: "", resultPreview });
  }

  const status = typeof permission.status === "string" ? permission.status : "";
  const source = typeof permission.source === "string" ? permission.source : "";
  const nested =
    permission.permission && typeof permission.permission === "object"
      ? permission.permission
      : permission;
  const normalizedToolName =
    typeof nested.toolName === "string" && nested.toolName
      ? nested.toolName
      : typeof toolName === "string" && toolName
        ? toolName
        : "tool";
  const level =
    typeof nested.level === "string" && nested.level
      ? nested.level
      : inferPermissionLevelForTool(normalizedToolName);
  const kind =
    status === "permission_pending" || status === "confirmation_required"
      ? "confirmation_required"
      : status === "permission_required"
        ? "setup_required"
        : status === "permission_denied"
          ? level === "unknown"
            ? "blocked"
            : "denied"
          : level === "unknown"
            ? "blocked"
            : "";

  if (!kind) {
    return null;
  }

  return {
    kind,
    toolName: normalizedToolName,
    label:
      typeof nested.label === "string" && nested.label
        ? nested.label
        : formatToolName(normalizedToolName),
    level,
    message:
      typeof permission.message === "string" && permission.message
        ? permission.message
        : resultPreview,
    summary: typeof nested.summary === "string" ? nested.summary : "",
    source:
      typeof nested.source === "string" && nested.source
        ? nested.source
        : typeof nested.integration === "string" && nested.integration
          ? nested.integration
          : source,
    actions: getPermissionActions(normalizedToolName, level, nested),
  };
}

function summarizePermissionResult(tool) {
  if (!tool?.result || typeof tool.result !== "object") {
    return "";
  }
  for (const key of ["message", "summary", "status"]) {
    if (typeof tool.result[key] === "string" && tool.result[key]) {
      return tool.result[key];
    }
  }
  return "";
}

function getPermissionActions(toolName, level, permission) {
  if (level === "unknown") {
    return ["Refresh permissions"];
  }

  const actions = ["Allow once", "Deny"];
  const source = String(permission?.source ?? permission?.integration ?? "").toLowerCase();
  if (["apple-calendar", "composio", "mcp"].includes(source) || toolName.startsWith("mcp__")) {
    actions.push("Trust this integration");
  }
  if (["write", "destructive", "control"].includes(level)) {
    actions.push("Allow trusted write actions");
  }
  return actions;
}

function inferPermissionLevelForTool(toolName) {
  if (["write_file", "edit_file", "update_task_status", "add_calendar_item"].includes(toolName)) {
    return "write";
  }
  if (["delete_task", "delete_calendar_item"].includes(toolName)) {
    return "destructive";
  }
  if (toolName === "computer_use_task") {
    return "control";
  }
  if (String(toolName || "").startsWith("mcp__")) {
    return "unknown";
  }
  return "unknown";
}

function createPermissionMarkdown(permission) {
  const lines = [
    `**${permission.kind === "confirmation_required" ? "Confirm" : "Blocked"} ${permission.label}**`,
    permission.message,
    `- Risk: \`${permission.level}\``,
  ];

  if (permission.source) {
    lines.push(`- Source: ${permission.source}`);
  }
  if (permission.summary) {
    lines.push(`- Details: ${permission.summary}`);
  }
  if (permission.actions.length > 0) {
    lines.push(`- Actions: ${permission.actions.join(", ")}`);
  }

  return lines.filter(Boolean).join("\n");
}

function getPermissionNoticeFromToolResult(toolResult) {
  if (!toolResult || typeof toolResult !== "object") {
    return null;
  }

  const result = toolResult.result;
  if (!result || typeof result !== "object") {
    return null;
  }

  const permission = normalizePermissionSnapshot(result, toolResult.name, result.message);
  if (!permission) {
    return null;
  }

  return {
    status: permission.kind === "confirmation_required" ? "Needs confirmation" : "Blocked",
    markdown: createPermissionMarkdown(permission),
  };
}

function normalizeChatOptions(chat) {
  if (chat === true) {
    return { bridge: defaultChatBridge(), providers: [] };
  }

  if (!chat || typeof chat !== "object") {
    return null;
  }

  return {
    bridge: chat.bridge ?? defaultChatBridge(),
    eventSource: chat.eventSource ?? chat.bridge ?? defaultChatBridge(),
    providers: Array.isArray(chat.providers) ? chat.providers : [],
    models: Array.isArray(chat.models) ? chat.models : [],
    provider: typeof chat.provider === "string" ? chat.provider : "",
    model: typeof chat.model === "string" ? chat.model : "",
    conversationId:
      typeof chat.conversationId === "string" && chat.conversationId
        ? chat.conversationId
        : createChatId("conversation"),
  };
}

function defaultChatBridge() {
  return globalThis.window?.leena ?? null;
}

function createChatId(kind) {
  return `cc-chat-${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeProviderId(provider) {
  return typeof provider === "string"
    ? provider
    : (provider?.id ?? provider?.name ?? provider?.provider ?? "");
}

function normalizeProviderLabel(provider) {
  if (typeof provider === "string") {
    return provider;
  }
  return provider?.displayName ?? provider?.name ?? provider?.id ?? "Provider";
}

function providerSupportsChat(provider) {
  return (
    typeof provider === "string" ||
    provider?.capabilities?.chat === true ||
    provider?.capabilities === undefined
  );
}

function normalizeModelId(model) {
  return typeof model === "string" ? model : (model?.id ?? model?.model ?? model?.name ?? "");
}

function normalizeModelLabel(model) {
  if (typeof model === "string") {
    return model;
  }
  return model?.displayName ?? model?.name ?? model?.model ?? model?.id ?? "Model";
}

function subscribeToChatChunks(source, callback) {
  const handler = (payload) => callback(normalizeChatChunkPayload(payload));

  if (!source) {
    return () => {};
  }

  if (typeof source.onChatChunk === "function") {
    const token = source.onChatChunk(handler);
    return typeof source.offChatChunk === "function" ? () => source.offChatChunk(token) : () => {};
  }

  if (typeof source.addEventListener === "function") {
    const listener = (event) => handler(event.detail ?? event);
    source.addEventListener("chat:chunk", listener);
    return () => source.removeEventListener?.("chat:chunk", listener);
  }

  if (typeof source.on === "function") {
    const token = source.on("chat:chunk", handler);
    return typeof source.off === "function" ? () => source.off("chat:chunk", token) : () => {};
  }

  return () => {};
}

function normalizeChatChunkPayload(payload) {
  if (payload && typeof payload === "object" && "detail" in payload) {
    return payload.detail;
  }
  return payload;
}

async function invokeChatBridge(bridge, payload) {
  if (typeof bridge?.invoke === "function") {
    return bridge.invoke("chat:send", payload);
  }
  if (typeof bridge?.chat?.send === "function") {
    return bridge.chat.send(payload);
  }
  if (typeof bridge?.sendChat === "function") {
    return bridge.sendChat(payload);
  }
  throw new Error("Text chat bridge is not available.");
}

function extractChatErrorMessage(error) {
  const serialized = error?.error ?? error;
  return (
    serialized?.message ?? (error instanceof Error ? error.message : "") ?? "Text chat failed."
  );
}

export class CommandCenter {
  #chat = null;
  #chatOptions = null;
  #chatUnsubscribe = null;
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
    chat = null,
  } = {}) {
    assertValue("variant", variant, COMMAND_CENTER_VARIANTS);
    assertValue("state", state, COMMAND_CENTER_STATES);

    this.#chatOptions = normalizeChatOptions(chat);
    this.#variant = variant;
    this.#state = state;
    this.#timer = timer;
    this.#element = this.#render();
    this.#applyVariant();
    this.#applyState();

    if (sessionStateManager) {
      this.bindSessionStateManager(sessionStateManager);
    }

    if (this.#chatOptions) {
      this.enableTextChat(this.#chatOptions);
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
    this.disableTextChat();

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

  enableTextChat(options = {}) {
    const normalized = normalizeChatOptions(options) ?? {
      bridge: defaultChatBridge(),
      eventSource: defaultChatBridge(),
      providers: [],
      models: [],
      provider: "",
      model: "",
      conversationId: createChatId("conversation"),
    };

    if (this.#chat) {
      return this;
    }

    const panel = createElement("section", "cc-chat");
    panel.setAttribute("aria-label", "Text chat");

    const header = createElement("div", "cc-chat__header");
    const providerSelect = createElement("select", "cc-chat__select");
    providerSelect.setAttribute("aria-label", "Chat provider");
    const modelSelect = createElement("select", "cc-chat__select");
    modelSelect.setAttribute("aria-label", "Chat model");
    header.append(providerSelect, modelSelect);

    const messages = createElement("div", "cc-chat__messages");
    messages.setAttribute("role", "log");
    messages.setAttribute("aria-live", "polite");

    const input = createChatInput({
      onSubmit: ({ message }) => void this.#sendTextChatMessage(message),
    });

    panel.append(header, messages, input.element);
    this.#nodes.expanded.append(panel);

    this.#chat = {
      bridge: normalized.bridge,
      conversationId: normalized.conversationId,
      input,
      messageById: new Map(),
      messages,
      model: normalized.model,
      modelSelect,
      panel,
      pendingBubble: null,
      pendingMessageId: "",
      provider: normalized.provider,
      providerSelect,
    };

    providerSelect.addEventListener("change", () => {
      this.#chat.provider = providerSelect.value;
      this.#chat.model = "";
      void this.#loadChatModels();
    });
    modelSelect.addEventListener("change", () => {
      this.#chat.model = modelSelect.value;
    });

    this.#chatUnsubscribe = subscribeToChatChunks(
      normalized.eventSource ?? normalized.bridge,
      (payload) => this.#handleChatChunk(payload),
    );
    this.#element.dataset.chat = "true";
    void this.#loadChatProviders(normalized.providers, normalized.models);
    return this;
  }

  disableTextChat() {
    if (typeof this.#chatUnsubscribe === "function") {
      this.#chatUnsubscribe();
    }
    this.#chatUnsubscribe = null;

    if (this.#chat?.panel && typeof this.#chat.panel.remove === "function") {
      this.#chat.panel.remove();
    }

    this.#chat = null;
    delete this.#element.dataset.chat;
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
      expanded,
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

  async #loadChatProviders(initialProviders = [], initialModels = []) {
    if (!this.#chat) {
      return;
    }

    let providers = Array.isArray(initialProviders) ? initialProviders : [];
    if (providers.length === 0 && typeof this.#chat.bridge?.providers?.list === "function") {
      try {
        providers = await this.#chat.bridge.providers.list();
      } catch {
        providers = [];
      }
    }

    const chatProviders = providers.filter(providerSupportsChat);
    this.#chat.providerSelect.replaceChildren(
      createOption("", "Default provider"),
      ...chatProviders.map((provider) =>
        createOption(normalizeProviderId(provider), normalizeProviderLabel(provider)),
      ),
    );

    if (chatProviders.length === 0) {
      this.#chat.providerSelect.replaceChildren(createOption("", "No chat provider"));
      this.#chat.providerSelect.disabled = true;
      this.#chat.modelSelect.disabled = true;
      return;
    }

    this.#chat.providerSelect.disabled = false;
    const selectedProvider = chatProviders.some(
      (provider) => normalizeProviderId(provider) === this.#chat.provider,
    )
      ? this.#chat.provider
      : "";
    this.#chat.provider = selectedProvider;
    this.#chat.providerSelect.value = selectedProvider;
    await this.#loadChatModels(initialModels);
  }

  async #loadChatModels(initialModels = []) {
    if (!this.#chat) {
      return;
    }

    let models = this.#chat.provider && Array.isArray(initialModels) ? initialModels : [];
    if (
      models.length === 0 &&
      this.#chat.provider &&
      typeof this.#chat.bridge?.providers?.getModels === "function"
    ) {
      try {
        models = await this.#chat.bridge.providers.getModels(this.#chat.provider, "chat");
      } catch {
        models = [];
      }
    }

    this.#chat.modelSelect.replaceChildren(
      ...models.map((model) => createOption(normalizeModelId(model), normalizeModelLabel(model))),
    );

    if (models.length === 0) {
      this.#chat.modelSelect.replaceChildren(createOption("", "Default model"));
    }

    const selectedModel =
      this.#chat.model || (this.#chat.provider ? normalizeModelId(models[0]) : "") || "";
    this.#chat.model = selectedModel;
    this.#chat.modelSelect.value = selectedModel;
    this.#chat.modelSelect.disabled = false;
  }

  async #sendTextChatMessage(message) {
    if (!this.#chat) {
      return;
    }

    const messageId = createChatId("message");
    this.#appendChatBubble({
      id: `${messageId}-user`,
      role: "user",
      content: message,
    });
    const assistantBubble = this.#appendChatBubble({
      id: messageId,
      role: "assistant",
      content: "",
      status: "Streaming",
    });

    this.#chat.pendingBubble = assistantBubble;
    this.#chat.pendingMessageId = messageId;
    this.#chat.input.setDisabled(true);

    try {
      const result = await invokeChatBridge(this.#chat.bridge, {
        message,
        provider: this.#chat.provider || undefined,
        model: this.#chat.model || undefined,
        conversationId: this.#chat.conversationId,
        messageId,
      });

      if (result?.ok === false) {
        assistantBubble.setStatus("Error").setContent(extractChatErrorMessage(result));
      } else if (result?.content && !assistantBubble.content) {
        assistantBubble.setContent(result.content).setStatus("");
      }

      await this.#rememberChatExchange(result);
    } catch (error) {
      assistantBubble.setStatus("Error").setContent(extractChatErrorMessage(error));
    } finally {
      this.#chat.input.setDisabled(false);
      this.#chat.pendingBubble = null;
      this.#chat.pendingMessageId = "";
    }
  }

  #handleChatChunk(payload) {
    if (!this.#chat || !payload || payload.conversationId !== this.#chat.conversationId) {
      return;
    }

    const bubble =
      this.#chat.messageById.get(payload.messageId) ?? this.#chat.pendingBubble ?? null;
    if (!bubble) {
      return;
    }

    if (payload.type === "delta") {
      bubble.setContent(payload.content ?? `${bubble.content}${payload.delta ?? ""}`);
      bubble.setStatus("Streaming");
    } else if (payload.type === "tool_call") {
      bubble.setStatus(`Running ${formatToolName(payload.toolCall?.name)}`);
    } else if (payload.type === "tool_result") {
      const permissionNotice = getPermissionNoticeFromToolResult(payload.toolResult);
      if (permissionNotice) {
        bubble.setContent(permissionNotice.markdown).setStatus(permissionNotice.status);
      } else {
        bubble.setStatus("Tool complete");
      }
    } else if (payload.type === "done") {
      bubble.setContent(payload.content ?? bubble.content).setStatus("");
    } else if (payload.type === "error") {
      bubble.setContent(extractChatErrorMessage(payload)).setStatus("Error");
    }

    this.#scrollChatToBottom();
  }

  #appendChatBubble({ id, role, content, status = "" }) {
    const bubble = createChatBubble({ role, content, status });
    this.#chat.messages.append(bubble.element);
    this.#chat.messageById.set(id, bubble);
    this.#scrollChatToBottom();
    return bubble;
  }

  async #rememberChatExchange(result) {
    if (!result?.ok || !result.memory) {
      return;
    }

    try {
      if (typeof this.#chat.bridge?.memory?.remember === "function") {
        await this.#chat.bridge.memory.remember(result.memory.text, result.memory.metadata);
      } else if (typeof this.#chat.bridge?.invoke === "function") {
        await this.#chat.bridge.invoke("memory:remember", result.memory);
      }
    } catch {
      /* Memory storage must not block chat display. */
    }
  }

  #scrollChatToBottom() {
    if (!this.#chat?.messages) {
      return;
    }

    this.#chat.messages.scrollTop = this.#chat.messages.scrollHeight ?? 0;
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
