import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import path from "node:path";
import test from "node:test";

import { createTrayController, resolveTrayIconPaths, TRAY_IPC_CHANNELS } from "../src/tray.js";

function createFakeWindow({ visible = true } = {}) {
  const events = new EventEmitter();
  const sent = [];
  return {
    focusCalls: 0,
    hideCalls: 0,
    restoreCalls: 0,
    sent,
    showCalls: 0,
    destroyed: false,
    minimized: false,
    visible,
    emitClose(event) {
      events.emit("close", event);
    },
    focus() {
      this.focusCalls += 1;
    },
    hide() {
      this.hideCalls += 1;
      this.visible = false;
    },
    isDestroyed() {
      return this.destroyed;
    },
    isMinimized() {
      return this.minimized;
    },
    isVisible() {
      return this.visible;
    },
    on(event, handler) {
      events.on(event, handler);
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

function createHarness({ visible = true } = {}) {
  const trayInstances = [];
  const actions = [];
  const stateChanges = [];
  const app = new EventEmitter();
  app.quitCalls = 0;
  app.quit = () => {
    app.quitCalls += 1;
  };
  const mainWindow = createFakeWindow({ visible });

  class FakeTray {
    constructor(image) {
      this.contextMenu = null;
      this.handlers = new Map();
      this.image = image;
      this.images = [image];
      this.tooltip = null;
      trayInstances.push(this);
    }

    on(event, handler) {
      this.handlers.set(event, handler);
    }

    setContextMenu(menu) {
      this.contextMenu = menu;
    }

    setImage(image) {
      this.image = image;
      this.images.push(image);
    }

    setToolTip(tooltip) {
      this.tooltip = tooltip;
    }
  }

  const Menu = {
    buildFromTemplate(template) {
      return { template };
    },
  };

  const nativeImage = {
    createFromPath(filePath) {
      return {
        filePath,
        templateImage: false,
        setTemplateImage(value) {
          this.templateImage = value;
        },
      };
    },
  };

  const controller = createTrayController({
    Menu,
    Tray: FakeTray,
    app,
    assetDirectory: "/tray-assets",
    emitTrayAction: (payload) => actions.push(payload),
    emitTrayStateChanged: (payload) => stateChanges.push(payload),
    mainWindow,
    nativeImage,
    setWindowMode: async (mode) => {
      actions.push({ action: "set-window-mode", mode });
    },
  });

  return { actions, app, controller, mainWindow, stateChanges, trayInstances };
}

function menuLabels(tray) {
  return tray.contextMenu.template.map((item) => item.label ?? item.type);
}

function clickMenuLabel(tray, label) {
  const item = tray.contextMenu.template.find((menuItem) => menuItem.label === label);
  assert.ok(item, `Missing menu item: ${label}`);
  return item.click();
}

test("resolves idle, active, speaking, and muted tray icon paths", () => {
  assert.deepEqual(resolveTrayIconPaths("/assets"), {
    idle: path.join("/assets", "iconTemplate.png"),
    listening: path.join("/assets", "iconTemplate-active.png"),
    muted: path.join("/assets", "iconTemplate-muted.png"),
    speaking: path.join("/assets", "iconTemplate-active.png"),
  });
});

test("creates Leena tray menu with visibility, mute, settings, and quit actions", async () => {
  const { actions, app, controller, mainWindow, trayInstances } = createHarness();

  const tray = controller.createTray();

  assert.equal(trayInstances.length, 1);
  assert.equal(tray.tooltip, "Leena");
  assert.equal(tray.image.filePath, path.join("/tray-assets", "iconTemplate.png"));
  assert.equal(tray.image.templateImage, true);
  assert.deepEqual(menuLabels(tray), [
    "Hide Leena",
    "separator",
    "Mute",
    "Settings",
    "separator",
    "Quit Leena",
  ]);

  clickMenuLabel(tray, "Hide Leena");
  assert.equal(mainWindow.hideCalls, 1);
  assert.deepEqual(menuLabels(tray), [
    "Show Leena",
    "separator",
    "Mute",
    "Settings",
    "separator",
    "Quit Leena",
  ]);

  clickMenuLabel(tray, "Show Leena");
  assert.equal(mainWindow.showCalls, 1);
  assert.equal(mainWindow.focusCalls, 1);

  await clickMenuLabel(tray, "Settings");
  assert.equal(
    actions.some((action) => action.action === "settings"),
    true,
  );
  assert.deepEqual(
    actions.find((action) => action.action === "set-window-mode"),
    {
      action: "set-window-mode",
      mode: "panel",
    },
  );

  clickMenuLabel(tray, "Quit Leena");
  assert.equal(controller.isQuitting(), true);
  assert.equal(app.quitCalls, 1);
});

test("setTrayState swaps state icons and updates the mute menu label", () => {
  const { controller, mainWindow, stateChanges } = createHarness();
  const tray = controller.createTray();

  assert.equal(controller.setTrayState("listening"), "listening");
  assert.equal(tray.image.filePath, path.join("/tray-assets", "iconTemplate-active.png"));

  assert.equal(controller.setTrayState("speaking"), "speaking");
  assert.equal(tray.image.filePath, path.join("/tray-assets", "iconTemplate-active.png"));

  assert.equal(controller.setMuted(true), true);
  assert.equal(controller.getCurrentState(), "muted");
  assert.equal(tray.image.filePath, path.join("/tray-assets", "iconTemplate-muted.png"));
  assert.deepEqual(menuLabels(tray), [
    "Hide Leena",
    "separator",
    "Unmute",
    "Settings",
    "separator",
    "Quit Leena",
  ]);

  assert.equal(controller.setMuted(false), false);
  assert.equal(controller.getCurrentState(), "speaking");
  assert.equal(tray.image.filePath, path.join("/tray-assets", "iconTemplate-active.png"));
  assert.deepEqual(
    stateChanges.map((change) => change.state),
    ["listening", "speaking", "muted", "speaking"],
  );
  assert.deepEqual(
    mainWindow.sent.filter((event) => event.channel === TRAY_IPC_CHANNELS.stateChanged),
    stateChanges.map((payload) => ({ channel: TRAY_IPC_CHANNELS.stateChanged, payload })),
  );
});

test("window close hides to tray until before-quit marks real shutdown", () => {
  const { app, controller, mainWindow } = createHarness();
  controller.createTray();
  controller.wireWindowCloseToTray();

  let prevented = false;
  mainWindow.emitClose({
    preventDefault() {
      prevented = true;
    },
  });

  assert.equal(prevented, true);
  assert.equal(mainWindow.hideCalls, 1);
  assert.deepEqual(mainWindow.sent.at(-1), {
    channel: TRAY_IPC_CHANNELS.action,
    payload: { action: "hide", source: "close" },
  });

  app.emit("before-quit");
  prevented = false;
  mainWindow.emitClose({
    preventDefault() {
      prevented = true;
    },
  });

  assert.equal(prevented, false);
  assert.equal(mainWindow.hideCalls, 1);
});
