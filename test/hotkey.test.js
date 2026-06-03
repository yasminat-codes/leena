import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { normalizeHotkeyAccelerator } from "../src/hotkey-accelerator.js";
import {
  createHotkeyController,
  DEFAULT_HOTKEY_ACCELERATOR,
  HOTKEY_IPC_CHANNELS,
  HOTKEY_SETTING_KEY,
  registerHotkeyHandlers,
} from "../src/ipc/hotkey.js";

function createFakeGlobalShortcut() {
  const callbacks = new Map();
  return {
    callbacks,
    conflicts: new Set(),
    registerCalls: [],
    unregisterAllCalls: 0,
    unregisterCalls: [],
    register(accelerator, callback) {
      this.registerCalls.push(accelerator);
      if (this.conflicts.has(accelerator)) {
        return false;
      }
      callbacks.set(accelerator, callback);
      return true;
    },
    trigger(accelerator) {
      callbacks.get(accelerator)?.();
    },
    unregister(accelerator) {
      this.unregisterCalls.push(accelerator);
      callbacks.delete(accelerator);
    },
    unregisterAll() {
      this.unregisterAllCalls += 1;
      callbacks.clear();
    },
  };
}

function createFakeWindow({ focused = false, minimized = false, visible = true } = {}) {
  const sent = [];
  return {
    focusCalls: 0,
    focused,
    hideCalls: 0,
    minimized,
    restoreCalls: 0,
    sent,
    showCalls: 0,
    visible,
    focus() {
      this.focusCalls += 1;
      this.focused = true;
    },
    hide() {
      this.hideCalls += 1;
      this.visible = false;
      this.focused = false;
    },
    isDestroyed() {
      return false;
    },
    isFocused() {
      return this.focused;
    },
    isMinimized() {
      return this.minimized;
    },
    isVisible() {
      return this.visible;
    },
    restore() {
      this.restoreCalls += 1;
      this.minimized = false;
    },
    show() {
      this.showCalls += 1;
      this.visible = true;
    },
    webContents: {
      send(channel, payload) {
        sent.push({ channel, payload });
      },
    },
  };
}

function createSettingsStore(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));
  const writes = [];
  return {
    values,
    writes,
    getString(key, defaultValue) {
      return values.has(key) ? values.get(key) : defaultValue;
    },
    setSetting(key, value) {
      writes.push({ key, value });
      values.set(key, value);
      return value;
    },
  };
}

function createIpcMain() {
  const handlers = new Map();
  return {
    handlers,
    handle(channel, handler) {
      assert.equal(handlers.has(channel), false, `duplicate IPC handler: ${channel}`);
      handlers.set(channel, handler);
    },
  };
}

function createHarness({ settings = {}, window = createFakeWindow() } = {}) {
  const app = new EventEmitter();
  const activations = [];
  const globalShortcut = createFakeGlobalShortcut();
  const settingsStore = createSettingsStore(settings);
  const controller = createHotkeyController({
    app,
    emitHotkeyActivated: (payload) => activations.push(payload),
    globalShortcut,
    mainWindow: window,
    settingsStore,
  });
  return { activations, app, controller, globalShortcut, settingsStore, window };
}

test("registers the default CommandOrControl+Shift+L hotkey from settings defaults", () => {
  const { controller, globalShortcut } = createHarness();

  const result = controller.registerConfiguredHotkey();

  assert.deepEqual(result, {
    accelerator: DEFAULT_HOTKEY_ACCELERATOR,
    changed: true,
    previousAccelerator: null,
    success: true,
  });
  assert.deepEqual(globalShortcut.registerCalls, [DEFAULT_HOTKEY_ACCELERATOR]);
  assert.equal(globalShortcut.callbacks.has(DEFAULT_HOTKEY_ACCELERATOR), true);
  assert.equal(controller.getHotkey(), DEFAULT_HOTKEY_ACCELERATOR);
});

test("uses a persisted hotkey accelerator when present", () => {
  const storedAccelerator = "Command+Option+L";
  const normalizedAccelerator = "CommandOrControl+Alt+L";
  const { controller, globalShortcut } = createHarness({
    settings: { [HOTKEY_SETTING_KEY]: storedAccelerator },
  });

  assert.equal(controller.readConfiguredHotkey(), normalizedAccelerator);
  assert.equal(controller.registerConfiguredHotkey().accelerator, normalizedAccelerator);
  assert.deepEqual(globalShortcut.registerCalls, [normalizedAccelerator]);
});

test("hotkey accelerator normalization rejects bare or shift-only global keys", () => {
  assert.equal(normalizeHotkeyAccelerator("Cmd + Option + q"), "CommandOrControl+Alt+Q");
  assert.equal(normalizeHotkeyAccelerator("Control+Alt+Space"), "Control+Alt+Space");

  for (const accelerator of ["A", "Escape", "Shift+A", "Shift+F1"]) {
    assert.throws(
      () => normalizeHotkeyAccelerator(accelerator),
      /Hotkey must include Command, Control, or Option/,
    );
  }
});

test("reconfiguring hotkey unregisters the old shortcut and persists the new value", () => {
  const { controller, globalShortcut, settingsStore } = createHarness();
  const nextAccelerator = "Command+Option+Space";
  const normalizedAccelerator = "CommandOrControl+Alt+Space";
  controller.registerConfiguredHotkey();

  const result = controller.setHotkey(nextAccelerator);

  assert.deepEqual(result, {
    accelerator: normalizedAccelerator,
    changed: true,
    previousAccelerator: DEFAULT_HOTKEY_ACCELERATOR,
    success: true,
  });
  assert.deepEqual(globalShortcut.unregisterCalls, [DEFAULT_HOTKEY_ACCELERATOR]);
  assert.deepEqual(globalShortcut.registerCalls, [
    DEFAULT_HOTKEY_ACCELERATOR,
    normalizedAccelerator,
  ]);
  assert.equal(globalShortcut.callbacks.has(DEFAULT_HOTKEY_ACCELERATOR), false);
  assert.equal(globalShortcut.callbacks.has(normalizedAccelerator), true);
  assert.deepEqual(settingsStore.writes, [
    { key: HOTKEY_SETTING_KEY, value: normalizedAccelerator },
  ]);
});

test("conflicting hotkey reconfiguration returns an error without losing the old shortcut", () => {
  const { controller, globalShortcut, settingsStore } = createHarness();
  const conflictingAccelerator = "CommandOrControl+Alt+L";
  controller.registerConfiguredHotkey();
  globalShortcut.conflicts.add(conflictingAccelerator);

  const result = controller.setHotkey({ accelerator: conflictingAccelerator });

  assert.deepEqual(result, {
    accelerator: conflictingAccelerator,
    error: "Hotkey is already in use.",
    previousAccelerator: DEFAULT_HOTKEY_ACCELERATOR,
    success: false,
  });
  assert.deepEqual(globalShortcut.unregisterCalls, [DEFAULT_HOTKEY_ACCELERATOR]);
  assert.deepEqual(globalShortcut.registerCalls, [
    DEFAULT_HOTKEY_ACCELERATOR,
    conflictingAccelerator,
    DEFAULT_HOTKEY_ACCELERATOR,
  ]);
  assert.equal(globalShortcut.callbacks.has(DEFAULT_HOTKEY_ACCELERATOR), true);
  assert.equal(globalShortcut.callbacks.has(conflictingAccelerator), false);
  assert.deepEqual(settingsStore.writes, []);
  assert.equal(controller.getHotkey(), DEFAULT_HOTKEY_ACCELERATOR);
});

test("hotkey cleanup unregisters shortcuts on app will-quit", () => {
  const { app, controller, globalShortcut } = createHarness();
  controller.registerConfiguredHotkey();

  app.emit("will-quit");

  assert.equal(globalShortcut.unregisterAllCalls, 1);
  assert.equal(globalShortcut.callbacks.size, 0);
  assert.equal(controller.getHotkey(), DEFAULT_HOTKEY_ACCELERATOR);
});

test("hotkey activation shows hidden windows, hides focused windows, and focuses unfocused windows", () => {
  const window = createFakeWindow({ focused: false, visible: false });
  const { activations, controller, globalShortcut } = createHarness({ window });
  controller.registerConfiguredHotkey();

  globalShortcut.trigger(DEFAULT_HOTKEY_ACCELERATOR);

  assert.equal(window.showCalls, 1);
  assert.equal(window.focusCalls, 1);
  assert.equal(window.hideCalls, 0);
  assert.deepEqual(activations.at(-1), {
    accelerator: DEFAULT_HOTKEY_ACCELERATOR,
    action: "show",
    handled: true,
  });
  assert.deepEqual(window.sent.at(-1), {
    channel: HOTKEY_IPC_CHANNELS.activated,
    payload: activations.at(-1),
  });

  globalShortcut.trigger(DEFAULT_HOTKEY_ACCELERATOR);

  assert.equal(window.hideCalls, 1);
  assert.deepEqual(activations.at(-1), {
    accelerator: DEFAULT_HOTKEY_ACCELERATOR,
    action: "hide",
    handled: true,
  });

  window.visible = true;
  window.focused = false;
  globalShortcut.trigger(DEFAULT_HOTKEY_ACCELERATOR);

  assert.equal(window.showCalls, 1);
  assert.equal(window.focusCalls, 2);
  assert.deepEqual(activations.at(-1), {
    accelerator: DEFAULT_HOTKEY_ACCELERATOR,
    action: "focus",
    handled: true,
  });
});

test("hotkey activation restores minimized windows before showing and focusing", () => {
  const window = createFakeWindow({ focused: false, minimized: true, visible: true });
  const { controller, globalShortcut } = createHarness({ window });
  controller.registerConfiguredHotkey();

  globalShortcut.trigger(DEFAULT_HOTKEY_ACCELERATOR);

  assert.equal(window.restoreCalls, 1);
  assert.equal(window.showCalls, 1);
  assert.equal(window.focusCalls, 1);
  assert.equal(window.hideCalls, 0);
});

test("registered IPC handlers expose get and set hotkey channels", async () => {
  const { controller, globalShortcut } = createHarness();
  const ipcMain = createIpcMain();

  const registration = registerHotkeyHandlers({ controller, ipcMain });

  assert.deepEqual(registration.channels, HOTKEY_IPC_CHANNELS);
  assert.equal(ipcMain.handlers.has(HOTKEY_IPC_CHANNELS.get), true);
  assert.equal(ipcMain.handlers.has(HOTKEY_IPC_CHANNELS.set), true);

  assert.equal(await ipcMain.handlers.get(HOTKEY_IPC_CHANNELS.get)(), DEFAULT_HOTKEY_ACCELERATOR);
  assert.deepEqual(
    await ipcMain.handlers.get(HOTKEY_IPC_CHANNELS.set)(null, "CommandOrControl+Shift+J"),
    {
      accelerator: "CommandOrControl+Shift+J",
      changed: true,
      previousAccelerator: null,
      success: true,
    },
  );
  assert.deepEqual(globalShortcut.registerCalls, ["CommandOrControl+Shift+J"]);
});
