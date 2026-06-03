import assert from "node:assert/strict";
import test from "node:test";
import { createOrb } from "../src/renderer/components/orb.js";
import { createWaveform } from "../src/renderer/components/waveform.js";

const defaultWaveHeights = [8, 16, 24, 12, 20, 9, 18, 26, 14, 10, 22, 16];

class TestClassList {
  #classes = new Set();

  add(...classes) {
    for (const className of classes) {
      this.#classes.add(className);
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
    this.style = {};
    this.animations = [];
  }

  append(...children) {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  animate(keyframes, options) {
    const animation = {
      cancelled: false,
      keyframes,
      options,
      cancel() {
        this.cancelled = true;
      },
    };
    this.animations.push(animation);
    return animation;
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

test.beforeEach(() => {
  globalThis.document = {
    createElement: (tagName) => new TestElement(tagName),
  };
  globalThis.matchMedia = () => ({ matches: false });
});

test.afterEach(() => {
  delete globalThis.document;
  delete globalThis.matchMedia;
});

test("createOrb returns an orb element with the expected methods", () => {
  const orb = createOrb();

  assert.equal(orb.tagName, "DIV");
  assert.equal(orb.classList.contains("orb"), true);
  assert.equal(orb.dataset.state, "idle");
  assert.equal(orb.dataset.size, "40");
  assert.equal(orb.style.width, "40px");
  assert.equal(orb.style.height, "40px");
  assert.equal(orb.getAttribute("aria-hidden"), "true");

  for (const method of ["pulse", "breathe", "shake", "stop"]) {
    assert.equal(typeof orb[method], "function", `${method} should be exposed`);
  }
});

test("createOrb supports all design-system sizes and optional rings", () => {
  for (const size of [28, 40, 64, 104]) {
    const orb = createOrb({ size, ring: true });
    const ring = orb.querySelector(".orb__ring");

    assert.equal(orb.dataset.size, String(size));
    assert.equal(orb.style.width, `${size}px`);
    assert.equal(orb.style.height, `${size}px`);
    assert.ok(ring, `size ${size} should render a ring`);
    assert.equal(ring.getAttribute("aria-hidden"), "true");
  }
});

test("createOrb leaves orb material, color, and glow to CSS tokens", () => {
  const orb = createOrb({ ring: true });
  const ring = orb.querySelector(".orb__ring");

  assert.equal("background" in orb.style, false);
  assert.equal("boxShadow" in orb.style, false);
  assert.equal("border" in orb.style, false);
  assert.equal("background" in ring.style, false);
  assert.equal("boxShadow" in ring.style, false);

  orb.breathe(true);
  orb.pulse();
  orb.shake();

  assert.equal("background" in orb.style, false);
  assert.equal("boxShadow" in orb.style, false);
  assert.equal("border" in orb.style, false);
});

test("createOrb accepts named sizes and falls back to the bar size for unknown values", () => {
  assert.equal(createOrb({ size: "mini" }).dataset.size, "28");
  assert.equal(createOrb({ size: "bar" }).dataset.size, "40");
  assert.equal(createOrb({ size: "medium" }).dataset.size, "64");
  assert.equal(createOrb({ size: "hero" }).dataset.size, "104");
  assert.equal(createOrb({ size: 999 }).dataset.size, "40");
});

test("orb state methods update visual state and return the element", () => {
  const orb = createOrb();

  assert.equal(orb.breathe(true), orb);
  assert.equal(orb.dataset.state, "listening");
  assert.equal(orb.style.transform, "scale(1.03)");

  assert.equal(orb.breathe(false), orb);
  assert.equal(orb.dataset.state, "idle");
  assert.equal(orb.style.transform, "scale(1)");

  assert.equal(orb.pulse(), orb);
  assert.equal(orb.dataset.state, "success");
  assert.equal(orb.style.filter, "brightness(1.12) saturate(1.12)");
  assert.equal(orb.animations.length, 1);

  assert.equal(orb.shake(), orb);
  assert.equal(orb.dataset.state, "error");
  assert.equal(orb.animations.length, 2);

  const animations = [...orb.animations];
  assert.equal(orb.stop(), orb);
  assert.equal(orb.dataset.state, "idle");
  assert.equal(orb.style.filter, "");
  assert.equal(orb.style.transform, "");
  assert.deepEqual(
    animations.map((animation) => animation.cancelled),
    [true, true],
  );
});

test("orb does not force animations when disabled or reduced motion is requested", () => {
  const disabledOrb = createOrb({ animated: false });
  disabledOrb.pulse();
  disabledOrb.shake();
  assert.equal(disabledOrb.animations.length, 0);

  globalThis.matchMedia = () => ({ matches: true });
  const reducedOrb = createOrb();
  reducedOrb.pulse();
  reducedOrb.shake();
  assert.equal(reducedOrb.animations.length, 0);
  assert.equal(reducedOrb.style.transition, "none");
});

test("createWaveform renders default bars with currentColor and configured heights", () => {
  const waveform = createWaveform();
  const bars = waveform.querySelectorAll("i");

  assert.equal(waveform.classList.contains("wave"), true);
  assert.equal(waveform.dataset.state, "paused");
  assert.equal(waveform.dataset.bars, "12");
  assert.equal(waveform.style.height, "26px");
  assert.equal(waveform.getAttribute("aria-hidden"), "true");
  assert.equal(bars.length, 12);
  assert.deepEqual(
    bars.map((bar) => bar.style.height),
    defaultWaveHeights.map((height) => `${height}px`),
  );

  for (const bar of bars) {
    assert.equal(bar.style.background, "currentColor");
    assert.equal(bar.style.animationPlayState, "paused");
    assert.equal(bar.getAttribute("aria-hidden"), "true");
  }
});

test("createWaveform supports custom bar count, height, and color", () => {
  const waveform = createWaveform({ bars: 5, height: 18, color: "rgb(255, 255, 255)" });
  const bars = waveform.querySelectorAll("i");

  assert.equal(waveform.dataset.bars, "5");
  assert.equal(waveform.style.height, "18px");
  assert.equal(waveform.style.color, "rgb(255, 255, 255)");
  assert.deepEqual(
    bars.map((bar) => bar.style.height),
    ["8px", "16px", "24px", "12px", "20px"],
  );
});

test("waveform play, pause, and shimmer update state and bar motion", () => {
  const waveform = createWaveform();
  const bars = waveform.querySelectorAll("i");

  assert.equal(waveform.play(), waveform);
  assert.equal(waveform.dataset.state, "playing");
  for (const bar of bars) {
    assert.equal(bar.style.animationPlayState, "running");
    assert.equal(bar.style.animationDuration, "1.1s");
    assert.equal(bar.style.transform, "");
  }

  assert.equal(waveform.shimmer(), waveform);
  assert.equal(waveform.dataset.state, "shimmer");
  for (const bar of bars) {
    assert.equal(bar.style.animationPlayState, "running");
    assert.equal(bar.style.animationDuration, "2.2s");
    assert.equal(bar.style.opacity, "0.72");
    assert.equal(bar.style.transform, "scaleY(0.72)");
    assert.equal(bar.style.transformOrigin, "50% 50%");
  }

  assert.equal(waveform.pause(), waveform);
  assert.equal(waveform.dataset.state, "paused");
  for (const bar of bars) {
    assert.equal(bar.style.animationPlayState, "paused");
    assert.equal(bar.style.opacity, "");
    assert.equal(bar.style.transform, "");
  }
});

test("waveform does not run bar animation when reduced motion is requested", () => {
  globalThis.matchMedia = () => ({ matches: true });
  const waveform = createWaveform();
  const bars = waveform.querySelectorAll("i");

  waveform.play();
  waveform.shimmer();

  assert.equal(waveform.dataset.state, "shimmer");
  for (const bar of bars) {
    assert.equal(bar.style.animation, "none");
    assert.equal(bar.style.animationPlayState, "paused");
    assert.equal(bar.style.opacity, "");
    assert.equal(bar.style.transform, "");
  }
});
