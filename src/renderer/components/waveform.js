const DEFAULT_BAR_HEIGHTS = [8, 16, 24, 12, 20, 9, 18, 26, 14, 10, 22, 16];
const DEFAULT_WAVE_HEIGHT = 26;

function prefersReducedMotion() {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

function normalizeBarCount(bars) {
  return Number.isInteger(bars) && bars > 0 ? bars : DEFAULT_BAR_HEIGHTS.length;
}

function setBarMotion(barElements, state) {
  const reduced = prefersReducedMotion();

  for (const bar of barElements) {
    if (reduced) {
      bar.style.animation = "none";
      bar.style.animationPlayState = "paused";
      bar.style.opacity = "";
      bar.style.transform = "";
      continue;
    }

    if (state === "playing") {
      bar.style.animationDuration = "1.1s";
      bar.style.animationPlayState = "running";
      bar.style.opacity = "";
      bar.style.transform = "";
    } else if (state === "shimmer") {
      bar.style.animationDuration = "2.2s";
      bar.style.animationPlayState = "running";
      bar.style.opacity = "0.72";
      bar.style.transform = "scaleY(0.72)";
      bar.style.transformOrigin = "50% 50%";
    } else {
      bar.style.animationPlayState = "paused";
      bar.style.opacity = "";
      bar.style.transform = "";
    }
  }
}

export function createWaveform({
  bars = DEFAULT_BAR_HEIGHTS.length,
  height = DEFAULT_WAVE_HEIGHT,
  color,
} = {}) {
  const barCount = normalizeBarCount(bars);
  const element = document.createElement("div");
  const barElements = [];

  element.classList.add("wave");
  element.dataset.state = "paused";
  element.dataset.bars = String(barCount);
  element.style.height = `${height}px`;

  if (typeof color === "string" && color.trim() !== "") {
    element.style.color = color;
  }

  for (let index = 0; index < barCount; index += 1) {
    const bar = document.createElement("i");
    const barHeight = DEFAULT_BAR_HEIGHTS[index % DEFAULT_BAR_HEIGHTS.length];

    bar.style.height = `${barHeight}px`;
    bar.style.background = "currentColor";
    bar.style.animationPlayState = "paused";
    bar.setAttribute("aria-hidden", "true");
    element.append(bar);
    barElements.push(bar);
  }

  element.setAttribute("aria-hidden", "true");
  setBarMotion(barElements, "paused");

  element.play = () => {
    element.dataset.state = "playing";
    setBarMotion(barElements, "playing");
    return element;
  };

  element.pause = () => {
    element.dataset.state = "paused";
    setBarMotion(barElements, "paused");
    return element;
  };

  element.shimmer = () => {
    element.dataset.state = "shimmer";
    setBarMotion(barElements, "shimmer");
    return element;
  };

  return element;
}
