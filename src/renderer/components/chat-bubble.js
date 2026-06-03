export class ChatBubble {
  #content = "";
  #element = null;
  #nodes = {};
  #role = "assistant";

  constructor({ role = "assistant", content = "", status = "" } = {}) {
    this.#role = normalizeRole(role);
    this.#content = String(content ?? "");
    this.#element = this.#render(status);
    this.setContent(this.#content);
  }

  get element() {
    return this.#element;
  }

  get content() {
    return this.#content;
  }

  appendContent(delta) {
    return this.setContent(`${this.#content}${String(delta ?? "")}`);
  }

  setContent(content) {
    this.#content = String(content ?? "");
    renderMarkdown(this.#nodes.body, this.#content);
    return this;
  }

  setStatus(status) {
    const normalized = String(status ?? "");
    this.#nodes.status.textContent = normalized;
    this.#nodes.status.hidden = normalized.length === 0;
    return this;
  }

  #render(status) {
    const root = createElement("article", `chat-bubble chat-bubble--${this.#role}`);
    root.dataset.role = this.#role;

    const body = createElement("div", "chat-bubble__body");
    const statusNode = createElement("span", "chat-bubble__status", String(status ?? ""));
    statusNode.hidden = !status;

    root.append(body, statusNode);
    this.#nodes = { body, status: statusNode };
    return root;
  }
}

export function createChatBubble(options) {
  return new ChatBubble(options);
}

export function renderMarkdown(target, markdown) {
  if (!target || typeof target.replaceChildren !== "function") {
    throw new TypeError("renderMarkdown requires a replaceChildren-capable target element.");
  }

  const fragment = createFragment();
  for (const block of splitFencedCode(String(markdown ?? ""))) {
    if (block.type === "code") {
      fragment.append(createCodeBlock(block));
    } else {
      appendTextBlocks(fragment, block.content);
    }
  }

  if (fragment.children.length === 0) {
    const empty = createElement("p", "chat-bubble__paragraph");
    empty.textContent = "";
    fragment.append(empty);
  }

  target.replaceChildren(...fragment.children);
  return target;
}

function splitFencedCode(markdown) {
  const blocks = [];
  const codePattern = /```([a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g;
  let cursor = 0;
  let match = codePattern.exec(markdown);

  while (match !== null) {
    if (match.index > cursor) {
      blocks.push({ type: "text", content: markdown.slice(cursor, match.index) });
    }
    blocks.push({
      type: "code",
      language: match[1] ?? "",
      content: match[2] ?? "",
    });
    cursor = match.index + match[0].length;
    match = codePattern.exec(markdown);
  }

  if (cursor < markdown.length) {
    blocks.push({ type: "text", content: markdown.slice(cursor) });
  }

  return blocks.length > 0 ? blocks : [{ type: "text", content: markdown }];
}

function appendTextBlocks(fragment, text) {
  const lines = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n");
  let paragraphLines = [];
  let list = null;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }
    const paragraph = createElement("p", "chat-bubble__paragraph");
    appendInlineMarkdown(paragraph, paragraphLines.join(" "));
    fragment.append(paragraph);
    paragraphLines = [];
  };

  const flushList = () => {
    if (!list) {
      return;
    }
    fragment.append(list);
    list = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      flushParagraph();
      if (!list) {
        list = createElement("ul", "chat-bubble__list");
      }
      const item = createElement("li", "chat-bubble__list-item");
      appendInlineMarkdown(item, listMatch[1]);
      list.append(item);
      continue;
    }

    flushList();
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();
}

function appendInlineMarkdown(target, value) {
  const text = String(value ?? "");
  const tokenPattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let cursor = 0;
  let match = tokenPattern.exec(text);

  while (match !== null) {
    if (match.index > cursor) {
      target.append(createText(text.slice(cursor, match.index)));
    }

    const token = match[0];
    if (token.startsWith("`")) {
      const code = createElement("code", "chat-bubble__inline-code");
      code.textContent = token.slice(1, -1);
      target.append(code);
    } else if (token.startsWith("**")) {
      const strong = createElement("strong");
      strong.textContent = token.slice(2, -2);
      target.append(strong);
    } else {
      const emphasis = createElement("em");
      emphasis.textContent = token.slice(1, -1);
      target.append(emphasis);
    }

    cursor = match.index + token.length;
    match = tokenPattern.exec(text);
  }

  if (cursor < text.length) {
    target.append(createText(text.slice(cursor)));
  }
}

function createCodeBlock(block) {
  const pre = createElement("pre", "chat-bubble__code");
  const code = createElement("code");
  if (block.language) {
    code.dataset.language = block.language;
  }
  code.textContent = block.content.replace(/\n$/, "");
  pre.append(code);
  return pre;
}

function normalizeRole(role) {
  const normalized = String(role || "assistant")
    .trim()
    .toLowerCase();
  return ["assistant", "user", "system", "tool", "error"].includes(normalized)
    ? normalized
    : "assistant";
}

function createFragment() {
  if (typeof document.createDocumentFragment === "function") {
    return document.createDocumentFragment();
  }
  return {
    children: [],
    append(...children) {
      this.children.push(...children);
    },
  };
}

function createText(value) {
  if (typeof document.createTextNode === "function") {
    return document.createTextNode(value);
  }
  const text = createElement("#text");
  text.textContent = value;
  return text;
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
