export const LAUNCH_ON_LOGIN_SETTING_KEY = "launchOnLogin";

export const LAUNCH_ON_LOGIN_IPC_CHANNELS = Object.freeze({
  get: "settings:get-launch-on-login",
  set: "settings:set-launch-on-login",
});

const loginItemOptions = Object.freeze({
  openAsHidden: true,
});

export function applyLaunchOnLoginAtStartup({ app, settingsStore } = {}) {
  assertLoginItemApp(app);
  const enabled = readStoredLaunchOnLogin(settingsStore);
  app.setLoginItemSettings({
    ...loginItemOptions,
    openAtLogin: enabled,
  });
  return enabled;
}

export function registerLaunchOnLoginHandlers({ ipcMain, app, settingsStore } = {}) {
  if (!ipcMain || typeof ipcMain.handle !== "function") {
    throw new TypeError("ipcMain.handle is required.");
  }
  assertLoginItemApp(app);

  const getLaunchOnLoginHandler = () => getLaunchOnLogin({ app, settingsStore });
  const setLaunchOnLoginHandler = (_event, payload = {}) =>
    setLaunchOnLogin({
      app,
      enabled: readEnabledPayload(payload),
      settingsStore,
    });

  ipcMain.handle(LAUNCH_ON_LOGIN_IPC_CHANNELS.get, getLaunchOnLoginHandler);
  ipcMain.handle(LAUNCH_ON_LOGIN_IPC_CHANNELS.set, setLaunchOnLoginHandler);

  return {
    channels: LAUNCH_ON_LOGIN_IPC_CHANNELS,
    handlers: {
      getLaunchOnLogin: getLaunchOnLoginHandler,
      setLaunchOnLogin: setLaunchOnLoginHandler,
    },
  };
}

export function getLaunchOnLogin({ app, settingsStore } = {}) {
  assertLoginItemApp(app);
  const storedEnabled = readStoredLaunchOnLogin(settingsStore);
  const osEnabled = Boolean(app.getLoginItemSettings().openAtLogin);
  if (storedEnabled !== osEnabled) {
    writeStoredLaunchOnLogin(settingsStore, osEnabled);
  }
  return osEnabled;
}

export function setLaunchOnLogin({ app, enabled, settingsStore } = {}) {
  assertLoginItemApp(app);
  const normalizedEnabled = normalizeEnabled(enabled);
  app.setLoginItemSettings({
    ...loginItemOptions,
    openAtLogin: normalizedEnabled,
  });
  writeStoredLaunchOnLogin(settingsStore, normalizedEnabled);
  return normalizedEnabled;
}

function assertLoginItemApp(app) {
  if (
    !app ||
    typeof app.setLoginItemSettings !== "function" ||
    typeof app.getLoginItemSettings !== "function"
  ) {
    throw new TypeError("Electron app login item methods are required.");
  }
}

function readStoredLaunchOnLogin(settingsStore) {
  if (settingsStore?.getBool) {
    return normalizeEnabled(settingsStore.getBool(LAUNCH_ON_LOGIN_SETTING_KEY, false));
  }
  if (settingsStore?.getSetting) {
    return normalizeEnabled(settingsStore.getSetting(LAUNCH_ON_LOGIN_SETTING_KEY, false));
  }
  return false;
}

function writeStoredLaunchOnLogin(settingsStore, enabled) {
  if (!settingsStore?.setSetting) {
    return enabled;
  }
  settingsStore.setSetting(LAUNCH_ON_LOGIN_SETTING_KEY, enabled);
  return enabled;
}

function readEnabledPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new TypeError("Launch-on-login payload must be an object.");
  }
  return normalizeEnabled(payload.enabled);
}

function normalizeEnabled(enabled) {
  if (typeof enabled !== "boolean") {
    throw new TypeError("Launch-on-login enabled value must be a boolean.");
  }
  return enabled;
}
