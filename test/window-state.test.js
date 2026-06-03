import assert from "node:assert/strict";
import test from "node:test";
import {
  centerBoundsInDisplay,
  createPanelWindowStatePersistence,
  getWindowModeOptions,
  isBoundsVisibleOnAnyDisplay,
  loadPanelWindowBounds,
  normalizeWindowBounds,
  PANEL_WINDOW_CONSTRAINTS,
  PANEL_WINDOW_SAVE_DEBOUNCE_MS,
  PANEL_WINDOW_STATE_KEY,
  resolvePanelWindowBounds,
  savePanelWindowBounds,
} from "../src/window-state.js";

test("panel mode is resizable within constraints while orb and call stay fixed", () => {
  assert.deepEqual(getWindowModeOptions("orb", { width: 172, height: 188 }), {
    width: 172,
    height: 188,
    minWidth: 172,
    maxWidth: 172,
    minHeight: 188,
    maxHeight: 188,
    resizable: false,
  });
  assert.deepEqual(getWindowModeOptions("call", { width: 226, height: 52 }), {
    width: 226,
    height: 52,
    minWidth: 226,
    maxWidth: 226,
    minHeight: 52,
    maxHeight: 52,
    resizable: false,
  });
  assert.deepEqual(getWindowModeOptions("panel", { width: 1060, height: 712 }), {
    width: 1060,
    height: 712,
    minWidth: PANEL_WINDOW_CONSTRAINTS.minWidth,
    maxWidth: PANEL_WINDOW_CONSTRAINTS.maxWidth,
    minHeight: PANEL_WINDOW_CONSTRAINTS.minHeight,
    maxHeight: PANEL_WINDOW_CONSTRAINTS.maxHeight,
    resizable: true,
  });
});

test("panel bounds round-trip through the settings-store interface", () => {
  const settingsStore = createMemorySettingsStore();
  const saved = savePanelWindowBounds(
    { x: 10.2, y: -20.8, width: 900.1, height: 450.4 },
    { settingsStore },
  );

  assert.deepEqual(saved, { x: 10, y: -21, width: 900, height: 500 });
  assert.deepEqual(settingsStore.writes, [
    {
      key: PANEL_WINDOW_STATE_KEY,
      value: { x: 10, y: -21, width: 900, height: 500 },
    },
  ]);
  assert.deepEqual(loadPanelWindowBounds({ settingsStore }), saved);
});

test("invalid saved bounds are rejected before persistence", () => {
  const settingsStore = createMemorySettingsStore();

  assert.equal(
    savePanelWindowBounds({ x: "left", y: 2, width: 700, height: 600 }, { settingsStore }),
    null,
  );
  assert.equal(
    savePanelWindowBounds({ x: 1, y: 2, width: 0, height: 600 }, { settingsStore }),
    null,
  );
  assert.equal(loadPanelWindowBounds({ settingsStore }), null);
  assert.equal(normalizeWindowBounds({ x: 1, y: 2, width: Number.NaN, height: 600 }), null);
});

test("visible saved bounds are reused across matching displays", () => {
  const displays = [
    { workArea: { x: 0, y: 0, width: 1440, height: 900 } },
    { workArea: { x: 1440, y: 0, width: 1200, height: 800 } },
  ];
  const savedBounds = { x: 1500, y: 40, width: 640, height: 680 };
  const defaultBounds = { x: 540, y: 160, width: 700, height: 600 };

  assert.equal(isBoundsVisibleOnAnyDisplay(savedBounds, displays), true);
  assert.deepEqual(resolvePanelWindowBounds({ savedBounds, defaultBounds, displays }), savedBounds);
});

test("off-screen saved bounds reset to centered defaults on the primary display", () => {
  const displays = [{ workArea: { x: 0, y: 0, width: 1400, height: 900 } }];
  const defaultBounds = { x: 976, y: 164, width: 700, height: 600 };
  const savedBounds = { x: 3000, y: 1800, width: 640, height: 680 };

  assert.equal(isBoundsVisibleOnAnyDisplay(savedBounds, displays), false);
  assert.deepEqual(resolvePanelWindowBounds({ savedBounds, defaultBounds, displays }), {
    x: 350,
    y: 150,
    width: 700,
    height: 600,
  });
});

test("missing saved bounds use the supplied default bounds without recentering", () => {
  const displays = [{ workArea: { x: 0, y: 0, width: 1400, height: 900 } }];
  const defaultBounds = { x: 980, y: 160, width: 700, height: 600 };

  assert.deepEqual(resolvePanelWindowBounds({ savedBounds: null, defaultBounds, displays }), {
    x: 980,
    y: 160,
    width: 700,
    height: 600,
  });
});

test("centerBoundsInDisplay uses display bounds when workArea is unavailable", () => {
  assert.deepEqual(
    centerBoundsInDisplay(
      { width: 700, height: 600 },
      { bounds: { x: -1200, y: 0, width: 1200, height: 900 } },
    ),
    { x: -950, y: 150, width: 700, height: 600 },
  );
});

test("panel window persistence debounces writes and flushes pending bounds", () => {
  const settingsStore = createMemorySettingsStore();
  const timers = createFakeTimers();
  const persistence = createPanelWindowStatePersistence({
    settingsStore,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });

  assert.deepEqual(persistence.scheduleSave({ x: 1, y: 2, width: 700, height: 600 }), {
    x: 1,
    y: 2,
    width: 700,
    height: 600,
  });
  assert.deepEqual(persistence.scheduleSave({ x: 3, y: 4, width: 900, height: 1300 }), {
    x: 3,
    y: 4,
    width: 900,
    height: 1200,
  });
  assert.equal(persistence.hasPending(), true);
  assert.equal(settingsStore.writes.length, 0);
  assert.deepEqual(timers.delays, [PANEL_WINDOW_SAVE_DEBOUNCE_MS, PANEL_WINDOW_SAVE_DEBOUNCE_MS]);
  assert.equal(timers.pendingCount(), 1);

  timers.runNext();
  assert.equal(persistence.hasPending(), false);
  assert.deepEqual(settingsStore.writes, [
    {
      key: PANEL_WINDOW_STATE_KEY,
      value: { x: 3, y: 4, width: 900, height: 1200 },
    },
  ]);

  persistence.scheduleSave({ x: 8, y: 9, width: 640, height: 650 });
  assert.deepEqual(persistence.flush(), { x: 8, y: 9, width: 640, height: 650 });
  assert.equal(timers.pendingCount(), 0);
  assert.deepEqual(loadPanelWindowBounds({ settingsStore }), {
    x: 8,
    y: 9,
    width: 640,
    height: 650,
  });
});

function createMemorySettingsStore(initial = {}) {
  const values = new Map(Object.entries(initial));
  const store = {
    writes: [],
    getSetting(key, defaultValue) {
      return values.has(key) ? values.get(key) : defaultValue;
    },
    setSetting(key, value) {
      values.set(key, value);
      store.writes.push({ key, value });
      return value;
    },
  };
  return store;
}

function createFakeTimers() {
  let nextId = 1;
  const callbacks = new Map();
  const timers = {
    delays: [],
    setTimer(callback, delayMs) {
      const id = nextId;
      nextId += 1;
      callbacks.set(id, callback);
      timers.delays.push(delayMs);
      return id;
    },
    clearTimer(id) {
      callbacks.delete(id);
    },
    runNext() {
      const [id, callback] = callbacks.entries().next().value;
      callbacks.delete(id);
      callback();
    },
    pendingCount() {
      return callbacks.size;
    },
  };
  return timers;
}
