const ORB_SIZE_BY_NAME = new Map([
  ["mini", 28],
  ["bar", 40],
  ["medium", 64],
  ["hero", 104],
]);

const ORB_SIZES = new Set(ORB_SIZE_BY_NAME.values());
const DEFAULT_ORB_SIZE = 40;

function normalizeOrbSize(size) {
  if (ORB_SIZE_BY_NAME.has(size)) {
    return ORB_SIZE_BY_NAME.get(size);
  }

  return ORB_SIZES.has(size) ? size : DEFAULT_ORB_SIZE;
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

export function createOrb({ size = DEFAULT_ORB_SIZE, animated = true, ring = false } = {}) {
  const sizePx = normalizeOrbSize(size);
  const element = document.createElement("div");
  const animations = [];

  element.classList.add("orb");
  element.dataset.size = String(sizePx);
  element.dataset.state = "idle";
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

  element.pulse = () => {
    element.dataset.state = "success";
    element.style.filter = "brightness(1.12) saturate(1.12)";

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
    element.dataset.state = listening ? "listening" : "idle";
    element.style.transform = listening ? "scale(1.03)" : "scale(1)";
    return element;
  };

  element.shake = () => {
    element.dataset.state = "error";

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
    element.dataset.state = "idle";
    element.style.filter = "";
    element.style.transform = "";
    return element;
  };

  return element;
}
