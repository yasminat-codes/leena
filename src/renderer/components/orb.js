const ORB_SIZE_BY_NAME = new Map([
  ["mini", 28],
  ["bar", 40],
  ["medium", 64],
  ["hero", 104],
]);

const ORB_SIZES = new Set(ORB_SIZE_BY_NAME.values());
const DEFAULT_ORB_SIZE = 40;

export const ORB_STATES = Object.freeze([
  "idle",
  "starting",
  "listening",
  "speaking",
  "tool",
  "error",
]);

const ORB_STATE_ALIASES = new Map(
  Object.entries({
    idle: "idle",
    inactive: "idle",
    ready: "idle",
    connected: "idle",
    disconnected: "idle",
    closed: "idle",
    no_session: "idle",
    connecting: "starting",
    starting: "starting",
    startup: "starting",
    thinking: "starting",
    processing: "starting",
    response_created: "starting",
    listening: "listening",
    speech_started: "listening",
    input_audio_buffer_speech_started: "listening",
    speaking: "speaking",
    responding: "speaking",
    output_audio: "speaking",
    output_audio_delta: "speaking",
    response_output_audio_delta: "speaking",
    tool: "tool",
    acting: "tool",
    tool_running: "tool",
    tool_executing: "tool",
    function_call: "tool",
    failed: "error",
    failure: "error",
    error: "error",
  }),
);

const ORB_STATE_TREATMENTS = Object.freeze({
  idle: Object.freeze({ scale: "1", filter: "none", intensity: "0" }),
  starting: Object.freeze({
    scale: "1.015",
    filter: "brightness(1.04) saturate(1.08)",
    intensity: "0.28",
  }),
  listening: Object.freeze({
    scale: "1.03",
    filter: "brightness(1.08) saturate(1.14)",
    intensity: "0.44",
  }),
  speaking: Object.freeze({
    scale: "1.055",
    filter: "brightness(1.12) saturate(1.22)",
    intensity: "0.72",
  }),
  tool: Object.freeze({
    scale: "1.025",
    filter: "brightness(1.02) saturate(1.1)",
    intensity: "0.56",
  }),
  error: Object.freeze({
    scale: "1.01",
    filter: "brightness(1.02) saturate(0.86)",
    intensity: "0.36",
  }),
});

function normalizeOrbSize(size) {
  if (ORB_SIZE_BY_NAME.has(size)) {
    return ORB_SIZE_BY_NAME.get(size);
  }

  return ORB_SIZES.has(size) ? size : DEFAULT_ORB_SIZE;
}

function normalizeStateToken(state) {
  return String(state ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeOrbState(state) {
  const token = normalizeStateToken(state);
  return ORB_STATE_ALIASES.get(token) ?? (ORB_STATES.includes(token) ? token : "idle");
}

function prefersReducedMotion() {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

function canAnimate(element, animated) {
  return animated && !prefersReducedMotion() && typeof element.animate === "function";
}

function cancelAnimations(animations) {
  for (const animation of animations.splice(0)) {
    animation.cancel?.();
  }
}

function setStyleProperty(style, property, value) {
  if (typeof style.setProperty === "function") {
    style.setProperty(property, value);
    return;
  }

  style[property] = value;
}

function applyOrbState(element, state, { animated = true } = {}) {
  const normalized = normalizeOrbState(state);
  const treatment = ORB_STATE_TREATMENTS[normalized];

  element.dataset.state = normalized;
  element.dataset.motion = animated && !prefersReducedMotion() ? "animated" : "reduced";
  setStyleProperty(element.style, "--orb-state-filter", treatment.filter);
  setStyleProperty(element.style, "--orb-state-intensity", treatment.intensity);
  setStyleProperty(element.style, "--orb-state-scale", treatment.scale);

  if (normalized === "idle") {
    element.style.filter = "";
    element.style.transform = "";
  } else {
    element.style.filter = "var(--orb-state-filter)";
    element.style.transform = "scale(var(--orb-state-scale))";
  }

  return normalized;
}

export function createOrb({ size = DEFAULT_ORB_SIZE, animated = true, ring = false } = {}) {
  const sizePx = normalizeOrbSize(size);
  const element = document.createElement("div");
  const animations = [];

  element.classList.add("orb");
  element.dataset.size = String(sizePx);
  element.dataset.animated = String(Boolean(animated));
  element.style.width = `${sizePx}px`;
  element.style.height = `${sizePx}px`;
  element.style.transition =
    animated && !prefersReducedMotion()
      ? "transform var(--dur-base) var(--ease-standard), filter var(--dur-base) var(--ease-out)"
      : "none";
  element.setAttribute("aria-hidden", "true");

  if (ring) {
    const ringElement = document.createElement("div");
    ringElement.classList.add("orb__ring");
    ringElement.setAttribute("aria-hidden", "true");
    element.append(ringElement);
  }

  element.setState = (state) => {
    cancelAnimations(animations);
    applyOrbState(element, state, { animated });
    return element;
  };

  element.pulse = () => {
    applyOrbState(element, "speaking", { animated });

    if (canAnimate(element, animated)) {
      animations.push(
        element.animate(
          [{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }],
          { duration: 260, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
        ),
      );
    }

    return element;
  };

  element.breathe = (on = true) => {
    const listening = Boolean(on);
    applyOrbState(element, listening ? "listening" : "idle", { animated });
    return element;
  };

  element.shake = () => {
    applyOrbState(element, "error", { animated });

    if (canAnimate(element, animated)) {
      animations.push(
        element.animate(
          [
            { transform: "translateX(0)" },
            { transform: "translateX(-2px)" },
            { transform: "translateX(2px)" },
            { transform: "translateX(-2px)" },
            { transform: "translateX(0)" },
          ],
          { duration: 180, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" },
        ),
      );
    }

    return element;
  };

  element.stop = () => {
    cancelAnimations(animations);
    applyOrbState(element, "idle", { animated });
    return element;
  };

  applyOrbState(element, "idle", { animated });
  return element;
}
