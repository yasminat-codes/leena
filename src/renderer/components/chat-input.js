export class ChatInput {
  #disabled = false;
  #element = null;
  #nodes = {};
  #onSubmit = null;

  constructor({ onSubmit = null, placeholder = "Message Leena" } = {}) {
    this.#onSubmit = typeof onSubmit === "function" ? onSubmit : null;
    this.#element = this.#render(placeholder);
  }

  get element() {
    return this.#element;
  }

  get value() {
    return this.#nodes.input.value;
  }

  set value(value) {
    this.#nodes.input.value = String(value ?? "");
  }

  focus() {
    this.#nodes.input.focus?.();
    return this;
  }

  setDisabled(disabled) {
    this.#disabled = Boolean(disabled);
    this.#nodes.input.disabled = this.#disabled;
    this.#nodes.button.disabled = this.#disabled;
    this.#element.dataset.disabled = String(this.#disabled);
    return this;
  }

  clear() {
    this.value = "";
    return this;
  }

  submit() {
    const message = this.value.trim();
    if (this.#disabled || !message) {
      return false;
    }

    this.#onSubmit?.({ message });
    this.clear();
    return true;
  }

  #render(placeholder) {
    const form = createElement("form", "chat-input");
    form.setAttribute("aria-label", "Text chat input");

    const input = createElement("textarea", "chat-input__field");
    input.rows = 2;
    input.placeholder = placeholder;
    input.setAttribute("aria-label", "Message Leena");

    const button = createElement("button", "chat-input__send");
    button.type = "submit";
    button.title = "Send";
    button.setAttribute("aria-label", "Send message");

    const icon = createSendIcon();
    button.append(icon);

    form.append(input, button);
    form.addEventListener("submit", (event) => {
      event.preventDefault?.();
      this.submit();
    });
    input.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault?.();
        this.submit();
      }
    });

    this.#nodes = { input, button };
    return form;
  }
}

export function createChatInput(options) {
  return new ChatInput(options);
}

function createSendIcon() {
  const svg = document.createElementNS?.("http://www.w3.org/2000/svg", "svg");
  if (!svg) {
    return createElement("span", "chat-input__send-glyph", "Send");
  }

  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "15");
  svg.setAttribute("height", "15");
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M5 12h13m0 0-5-5m5 5-5 5");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  return svg;
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
