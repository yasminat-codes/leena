import assert from "node:assert/strict";
import test from "node:test";

import {
  applyLaunchOnLoginAtStartup,
  getLaunchOnLogin,
  LAUNCH_ON_LOGIN_IPC_CHANNELS,
  LAUNCH_ON_LOGIN_SETTING_KEY,
  registerLaunchOnLoginHandlers,
  setLaunchOnLogin,
} from "../src/ipc/launch-on-login.js";

function createFakeApp({ openAtLogin = false } = {}) {
  const setCalls = [];
  return {
    getCalls: 0,
    openAtLogin,
    setCalls,
    getLoginItemSettings() {
      this.getCalls += 1;
      return { openAtLogin: this.openAtLogin };
    },
    setLoginItemSettings(options) {
      setCalls.push(options);
      this.openAtLogin = Boolean(options.openAtLogin);
    },
  };
}

function createSettingsStore(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));
  const writes = [];
  return {
    values,
    writes,
    getBool(key, defaultValue) {
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

test("startup applies the stored launch-on-login preference with default off", () => {
  const app = createFakeApp({ openAtLogin: true });
  const settingsStore = createSettingsStore();

  const enabled = applyLaunchOnLoginAtStartup({ app, settingsStore });

  assert.equal(enabled, false);
  assert.deepEqual(app.setCalls, [{ openAsHidden: true, openAtLogin: false }]);
  assert.equal(app.openAtLogin, false);
});

test("startup applies a stored opt-in value", () => {
  const app = createFakeApp();
  const settingsStore = createSettingsStore({ [LAUNCH_ON_LOGIN_SETTING_KEY]: true });

  const enabled = applyLaunchOnLoginAtStartup({ app, settingsStore });

  assert.equal(enabled, true);
  assert.deepEqual(app.setCalls, [{ openAsHidden: true, openAtLogin: true }]);
});

test("setLaunchOnLogin toggles the OS login item and persists the setting", () => {
  const app = createFakeApp();
  const settingsStore = createSettingsStore();

  assert.equal(setLaunchOnLogin({ app, enabled: true, settingsStore }), true);
  assert.deepEqual(app.setCalls, [{ openAsHidden: true, openAtLogin: true }]);
  assert.deepEqual(settingsStore.writes, [{ key: LAUNCH_ON_LOGIN_SETTING_KEY, value: true }]);

  assert.equal(setLaunchOnLogin({ app, enabled: false, settingsStore }), false);
  assert.deepEqual(app.setCalls.at(-1), { openAsHidden: true, openAtLogin: false });
  assert.deepEqual(settingsStore.writes.at(-1), {
    key: LAUNCH_ON_LOGIN_SETTING_KEY,
    value: false,
  });
});

test("getLaunchOnLogin returns the OS value and re-syncs divergent settings", () => {
  const app = createFakeApp({ openAtLogin: false });
  const settingsStore = createSettingsStore({ [LAUNCH_ON_LOGIN_SETTING_KEY]: true });

  assert.equal(getLaunchOnLogin({ app, settingsStore }), false);
  assert.equal(app.getCalls, 1);
  assert.deepEqual(app.setCalls, []);
  assert.deepEqual(settingsStore.writes, [{ key: LAUNCH_ON_LOGIN_SETTING_KEY, value: false }]);
  assert.equal(settingsStore.values.get(LAUNCH_ON_LOGIN_SETTING_KEY), false);
});

test("getLaunchOnLogin avoids redundant settings writes when states already match", () => {
  const app = createFakeApp({ openAtLogin: true });
  const settingsStore = createSettingsStore({ [LAUNCH_ON_LOGIN_SETTING_KEY]: true });

  assert.equal(getLaunchOnLogin({ app, settingsStore }), true);
  assert.equal(app.getCalls, 1);
  assert.deepEqual(settingsStore.writes, []);
});

test("registered IPC handlers expose get and set launch-on-login channels", async () => {
  const app = createFakeApp({ openAtLogin: false });
  const ipcMain = createIpcMain();
  const settingsStore = createSettingsStore();

  const registration = registerLaunchOnLoginHandlers({ app, ipcMain, settingsStore });

  assert.deepEqual(registration.channels, LAUNCH_ON_LOGIN_IPC_CHANNELS);
  assert.equal(ipcMain.handlers.has(LAUNCH_ON_LOGIN_IPC_CHANNELS.get), true);
  assert.equal(ipcMain.handlers.has(LAUNCH_ON_LOGIN_IPC_CHANNELS.set), true);

  assert.equal(
    await ipcMain.handlers.get(LAUNCH_ON_LOGIN_IPC_CHANNELS.set)(null, { enabled: true }),
    true,
  );
  assert.deepEqual(app.setCalls, [{ openAsHidden: true, openAtLogin: true }]);
  assert.equal(settingsStore.values.get(LAUNCH_ON_LOGIN_SETTING_KEY), true);

  app.openAtLogin = false;

  assert.equal(await ipcMain.handlers.get(LAUNCH_ON_LOGIN_IPC_CHANNELS.get)(), false);
  assert.equal(settingsStore.values.get(LAUNCH_ON_LOGIN_SETTING_KEY), false);
});

test("set IPC handler rejects non-boolean enabled payloads", () => {
  const app = createFakeApp();
  const ipcMain = createIpcMain();
  const settingsStore = createSettingsStore();
  registerLaunchOnLoginHandlers({ app, ipcMain, settingsStore });

  assert.throws(
    () => ipcMain.handlers.get(LAUNCH_ON_LOGIN_IPC_CHANNELS.set)(null, { enabled: "true" }),
    /must be a boolean/,
  );
  assert.deepEqual(app.setCalls, []);
  assert.deepEqual(settingsStore.writes, []);
});
