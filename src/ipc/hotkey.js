import {
  DEFAULT_HOTKEY_ACCELERATOR,
  HOTKEY_SETTING_KEY,
  normalizeHotkeyAccelerator,
} from "../hotkey-accelerator.js";

export { DEFAULT_HOTKEY_ACCELERATOR, HOTKEY_SETTING_KEY } from "../hotkey-accelerator.js";

export const HOTKEY_IPC_CHANNELS = Object.freeze({
  activated: "hotkey:activated",
  get: "settings:get-hotkey",
  set: "settings:set-hotkey",
});

const conflictError = "Hotkey is already in use.";

export function createHotkeyController({
  app,
  defaultAccelerator = DEFAULT_HOTKEY_ACCELERATOR,
  emitHotkeyActivated,
  getMainWindow,
  globalShortcut,
  logger,
  mainWindow,
  settingsStore,
} = {}) {
  assertGlobalShortcut(globalShortcut);

  let currentAccelerator = null;
  let quitCleanupWired = false;

  function getWindow() {
    return getMainWindow?.() ?? mainWindow ?? null;
  }

  function readConfiguredHotkey() {
    try {
      return normalizeAccelerator(readStoredHotkey(settingsStore, defaultAccelerator));
    } catch {
      return normalizeAccelerator(defaultAccelerator);
    }
  }

  function getHotkey() {
    return currentAccelerator ?? readConfiguredHotkey();
  }

  function registerConfiguredHotkey() {
    wireQuitCleanup();
    return registerHotkey(readConfiguredHotkey());
  }

  function setHotkey(payload) {
    try {
      return registerHotkey(extractAccelerator(payload), { persist: true });
    } catch (error) {
      return {
        error: getErrorMessage(error),
        success: false,
      };
    }
  }

  function registerHotkey(accelerator, { persist = false } = {}) {
    const normalizedAccelerator = normalizeAccelerator(accelerator);
    wireQuitCleanup();

    if (normalizedAccelerator === currentAccelerator) {
      if (persist) {
        writeStoredHotkey(settingsStore, normalizedAccelerator);
      }
      return {
        accelerator: normalizedAccelerator,
        changed: false,
        success: true,
      };
    }

    const previousAccelerator = currentAccelerator;
    if (previousAccelerator) {
      globalShortcut.unregister(previousAccelerator);
    }

    const registered = tryRegister(normalizedAccelerator);
    if (!registered) {
      restorePreviousHotkey(previousAccelerator);
      return {
        accelerator: normalizedAccelerator,
        error: conflictError,
        previousAccelerator,
        success: false,
      };
    }

    currentAccelerator = normalizedAccelerator;
    if (persist) {
      writeStoredHotkey(settingsStore, normalizedAccelerator);
    }

    return {
      accelerator: normalizedAccelerator,
      changed: previousAccelerator !== normalizedAccelerator,
      previousAccelerator,
      success: true,
    };
  }

  function tryRegister(accelerator) {
    try {
      return Boolean(globalShortcut.register(accelerator, () => activateHotkey({ accelerator })));
    } catch (error) {
      logger?.warn?.("Failed to register hotkey", error);
      return false;
    }
  }

  function restorePreviousHotkey(previousAccelerator) {
    if (!previousAccelerator) {
      currentAccelerator = null;
      return false;
    }
    if (!tryRegister(previousAccelerator)) {
      currentAccelerator = null;
      return false;
    }
    currentAccelerator = previousAccelerator;
    return true;
  }

  function activateHotkey({ accelerator = currentAccelerator } = {}) {
    const window = getWindow();
    if (!window || window.isDestroyed?.()) {
      return notifyHotkeyActivated("missing-window", accelerator, false);
    }

    const minimized = Boolean(window.isMinimized?.());
    const visible = !minimized && Boolean(window.isVisible?.());
    const focused = Boolean(window.isFocused?.());

    if (!visible) {
      if (minimized) {
        window.restore?.();
      }
      window.show?.();
      window.focus?.();
      return notifyHotkeyActivated("show", accelerator, true);
    }

    if (focused) {
      window.hide?.();
      return notifyHotkeyActivated("hide", accelerator, true);
    }

    window.focus?.();
    return notifyHotkeyActivated("focus", accelerator, true);
  }

  function notifyHotkeyActivated(action, accelerator, handled) {
    const payload = { accelerator, action, handled };
    emitHotkeyActivated?.(payload);
    sendToRenderer(HOTKEY_IPC_CHANNELS.activated, payload);
    return payload;
  }

  function sendToRenderer(channel, payload) {
    const window = getWindow();
    if (!window || window.isDestroyed?.()) {
      return;
    }
    window.webContents?.send?.(channel, payload);
  }

  function cleanupHotkeys() {
    if (typeof globalShortcut.unregisterAll === "function") {
      globalShortcut.unregisterAll();
    } else if (currentAccelerator) {
      globalShortcut.unregister(currentAccelerator);
    }
    currentAccelerator = null;
  }

  function wireQuitCleanup() {
    if (quitCleanupWired || typeof app?.on !== "function") {
      return;
    }
    quitCleanupWired = true;
    app.on("will-quit", cleanupHotkeys);
  }

  return {
    activateHotkey,
    cleanupHotkeys,
    getHotkey,
    readConfiguredHotkey,
    registerConfiguredHotkey,
    registerHotkey,
    setHotkey,
    wireQuitCleanup,
  };
}

export function registerHotkeyHandlers({ controller, ipcMain, ...options } = {}) {
  if (!ipcMain || typeof ipcMain.handle !== "function") {
    throw new TypeError("ipcMain.handle is required.");
  }

  const hotkeyController = controller ?? createHotkeyController(options);
  const getHandler = () => hotkeyController.getHotkey();
  const setHandler = (_event, payload) => hotkeyController.setHotkey(payload);

  ipcMain.handle(HOTKEY_IPC_CHANNELS.get, getHandler);
  ipcMain.handle(HOTKEY_IPC_CHANNELS.set, setHandler);

  return {
    channels: HOTKEY_IPC_CHANNELS,
    controller: hotkeyController,
    handlers: {
      getHotkey: getHandler,
      setHotkey: setHandler,
    },
  };
}

function readStoredHotkey(settingsStore, defaultAccelerator) {
  if (settingsStore?.getString) {
    return settingsStore.getString(HOTKEY_SETTING_KEY, defaultAccelerator);
  }
  if (settingsStore?.getSetting) {
    const value = settingsStore.getSetting(HOTKEY_SETTING_KEY, defaultAccelerator);
    return typeof value === "string" ? value : defaultAccelerator;
  }
  return defaultAccelerator;
}

function writeStoredHotkey(settingsStore, accelerator) {
  settingsStore?.setSetting?.(HOTKEY_SETTING_KEY, accelerator);
  return accelerator;
}

function extractAccelerator(payload) {
  if (typeof payload === "string") {
    return payload;
  }
  if (payload && typeof payload === "object" && "accelerator" in payload) {
    return payload.accelerator;
  }
  throw new TypeError("Hotkey accelerator must be a string.");
}

function normalizeAccelerator(accelerator) {
  return normalizeHotkeyAccelerator(accelerator);
}

function assertGlobalShortcut(globalShortcut) {
  if (
    !globalShortcut ||
    typeof globalShortcut.register !== "function" ||
    typeof globalShortcut.unregister !== "function"
  ) {
    throw new TypeError("Electron globalShortcut register/unregister methods are required.");
  }
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
