import path from "node:path";
import { fileURLToPath } from "node:url";

export const TRAY_IPC_CHANNELS = Object.freeze({
  action: "tray:action",
  stateChanged: "tray:state-changed",
});

export const TRAY_STATES = Object.freeze(["idle", "listening", "speaking", "muted"]);

const trayStateIconNames = Object.freeze({
  idle: "iconTemplate.png",
  listening: "iconTemplate-active.png",
  muted: "iconTemplate-muted.png",
  speaking: "iconTemplate-active.png",
});

const defaultTrayDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "build",
  "tray",
);

function assertTrayState(state) {
  if (!TRAY_STATES.includes(state)) {
    throw new Error(`Unknown tray state: ${state}`);
  }
}

export function resolveTrayIconPaths(assetDirectory = defaultTrayDirectory) {
  return Object.fromEntries(
    Object.entries(trayStateIconNames).map(([state, filename]) => [
      state,
      path.join(assetDirectory, filename),
    ]),
  );
}

export function createTrayController({
  Tray,
  Menu,
  nativeImage,
  app,
  mainWindow,
  getMainWindow,
  setWindowMode,
  assetDirectory,
  emitTrayAction,
  emitTrayStateChanged,
} = {}) {
  if (typeof Tray !== "function") {
    throw new Error("Tray constructor is required.");
  }
  if (!Menu?.buildFromTemplate) {
    throw new Error("Menu.buildFromTemplate is required.");
  }
  if (!nativeImage?.createFromPath) {
    throw new Error("nativeImage.createFromPath is required.");
  }

  const iconPaths = resolveTrayIconPaths(assetDirectory);
  let tray = null;
  let currentState = "idle";
  let lastUnmutedState = "idle";
  let isQuitting = false;
  let beforeQuitWired = false;

  function getWindow() {
    return getMainWindow?.() ?? mainWindow ?? null;
  }

  function loadIcon(state) {
    assertTrayState(state);
    const image = nativeImage.createFromPath(iconPaths[state]);
    image?.setTemplateImage?.(true);
    return image;
  }

  function sendToRenderer(channel, payload) {
    const window = getWindow();
    if (!window || window.isDestroyed?.()) {
      return;
    }
    window.webContents?.send?.(channel, payload);
  }

  function notifyTrayAction(action, details = {}) {
    const payload = { action, ...details };
    emitTrayAction?.(payload);
    sendToRenderer(TRAY_IPC_CHANNELS.action, payload);
  }

  function notifyStateChanged() {
    const payload = { muted: currentState === "muted", state: currentState };
    emitTrayStateChanged?.(payload);
    sendToRenderer(TRAY_IPC_CHANNELS.stateChanged, payload);
  }

  function isWindowVisible() {
    const window = getWindow();
    return Boolean(window && !window.isDestroyed?.() && window.isVisible?.());
  }

  function buildMenuTemplate() {
    const visible = isWindowVisible();
    const muted = currentState === "muted";
    return [
      {
        label: visible ? "Hide Leena" : "Show Leena",
        click: () => {
          if (visible) {
            hideWindow();
            return;
          }
          showWindow();
        },
      },
      { type: "separator" },
      {
        label: muted ? "Unmute" : "Mute",
        click: () => setMuted(!muted),
      },
      {
        label: "Settings",
        click: () => openSettings(),
      },
      { type: "separator" },
      {
        label: "Quit Leena",
        click: () => quitApp(),
      },
    ];
  }

  function rebuildMenu() {
    if (!tray) {
      return null;
    }
    const menu = Menu.buildFromTemplate(buildMenuTemplate());
    tray.setContextMenu(menu);
    return menu;
  }

  function wireBeforeQuit() {
    if (beforeQuitWired || !app?.on) {
      return;
    }
    beforeQuitWired = true;
    app.on("before-quit", () => {
      markQuitting();
    });
  }

  function createTray() {
    if (tray) {
      return tray;
    }
    tray = new Tray(loadIcon(currentState));
    tray.setToolTip?.("Leena");
    tray.on?.("click", () => {
      showWindow();
    });
    rebuildMenu();
    wireBeforeQuit();
    return tray;
  }

  function setTrayState(state) {
    assertTrayState(state);
    if (state !== "muted") {
      lastUnmutedState = state;
    }
    currentState = state;
    if (tray) {
      tray.setImage(loadIcon(state));
      rebuildMenu();
    }
    notifyStateChanged();
    return currentState;
  }

  function setMuted(muted) {
    if (muted) {
      if (currentState !== "muted") {
        lastUnmutedState = currentState;
      }
      setTrayState("muted");
      notifyTrayAction("mute", { muted: true });
      return true;
    }
    const restoredState = lastUnmutedState === "muted" ? "idle" : lastUnmutedState;
    setTrayState(restoredState);
    notifyTrayAction("unmute", { muted: false });
    return false;
  }

  function showWindow() {
    const window = getWindow();
    if (!window || window.isDestroyed?.()) {
      return false;
    }
    if (window.isMinimized?.()) {
      window.restore?.();
    }
    window.show?.();
    window.focus?.();
    rebuildMenu();
    notifyTrayAction("show");
    return true;
  }

  function hideWindow() {
    const window = getWindow();
    if (!window || window.isDestroyed?.()) {
      return false;
    }
    window.hide?.();
    rebuildMenu();
    notifyTrayAction("hide");
    return true;
  }

  async function openSettings() {
    showWindow();
    await setWindowMode?.("panel");
    notifyTrayAction("settings");
    return true;
  }

  function markQuitting() {
    isQuitting = true;
  }

  function quitApp() {
    markQuitting();
    notifyTrayAction("quit");
    app?.quit?.();
    return true;
  }

  function wireWindowCloseToTray(window = getWindow()) {
    if (!window?.on) {
      return null;
    }
    const closeHandler = (event) => {
      if (!tray || isQuitting || window.isDestroyed?.()) {
        return;
      }
      event?.preventDefault?.();
      window.hide?.();
      rebuildMenu();
      notifyTrayAction("hide", { source: "close" });
    };
    window.on("close", closeHandler);
    return closeHandler;
  }

  return {
    createTray,
    getCurrentState: () => currentState,
    getIconPath: (state) => {
      assertTrayState(state);
      return iconPaths[state];
    },
    getTray: () => tray,
    hideWindow,
    isQuitting: () => isQuitting,
    markQuitting,
    openSettings,
    rebuildMenu,
    setMuted,
    setTrayState,
    showWindow,
    wireWindowCloseToTray,
  };
}
