import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, promises as fs, mkdirSync, renameSync } from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  app,
  BrowserWindow,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  safeStorage,
  screen,
  shell,
  systemPreferences,
  Tray,
} from "electron";
import electronUpdater from "electron-updater";
import { PersonaEngine } from "./identity/persona-engine.js";
import { registerChatHandlers } from "./ipc/chat-handlers.js";
import { registerHotkeyHandlers } from "./ipc/hotkey.js";
import {
  createAgentProfileIdentityAdapters,
  registerIdentityHandlers,
} from "./ipc/identity-handlers.js";
import {
  applyLaunchOnLoginAtStartup,
  registerLaunchOnLoginHandlers,
} from "./ipc/launch-on-login.js";
import { registerMCPHandlers } from "./ipc/mcp-handlers.js";
import { registerMemoryHandlers } from "./ipc/memory-handlers.js";
import { createSafeStorageSecretCodec, registerProviderHandlers } from "./ipc/provider-handlers.js";
import { initMCPAutoConnect, registerMCPAutoConnectCleanup } from "./mcp/auto-connect.js";
import { MCPClientManager } from "./mcp/client-manager.js";
import {
  createComposioIntegrationService,
  registerComposioIntegrationHandlers,
} from "./mcp/composio-integration.js";
import { ServerStore } from "./mcp/server-store.js";
import { SQLiteMemoryStore } from "./memory/index.js";
import { createMemoryMiddleware } from "./memory/memory-middleware.js";
import {
  createNudgePayload,
  dismissNudge,
  generateNudges,
  NUDGE_SETTINGS,
} from "./nudges/nudge-engine.js";
import {
  computerUseBrowserDocsUrl,
  createOsPermissionSnapshot,
  getWindowsPrivacySettingsUrl,
  isKnownOsPermissionId,
} from "./os-permissions.js";
import {
  detectAppleCalendarAccessStatus,
  detectFullDiskAccessStatus,
  openMacOsPrivacySettings,
} from "./os-permissions-main.js";
import { getRegistry } from "./providers/index.js";
import { createOpenAIProvider } from "./providers/openai-provider.js";
import { REALTIME } from "./providers/types.js";
import { buildRealtimeInstructions, resolveRealtimeVoicePreference } from "./realtime/prompts.js";
import {
  listActivity,
  migrateLegacyActivityStore,
  recordActivity,
} from "./realtime/tools/activity-store.js";
import { loadAgentProfile, saveAgentProfile } from "./realtime/tools/agent-profile-store.js";
import { setDatabaseUserDataPath } from "./realtime/tools/database.js";
import { executeRealtimeTool, getRealtimeToolDefinitions } from "./realtime/tools/index.js";
import {
  loadMicrophoneDeviceId,
  saveMicrophoneDeviceId,
} from "./realtime/tools/microphone-store.js";
import {
  deleteCalendarItem,
  deleteTask,
  listCalendarItems,
  listTasks,
  migrateLegacyPlannerStore,
  updateTaskStatus,
} from "./realtime/tools/planner-store.js";
import { getAllSettings, getBool, getSetting, getString, setSetting } from "./settings-store.js";
import { createTrayController } from "./tray.js";
import { redactSensitiveText, serializeError } from "./utils/errors.js";
import {
  createPanelWindowStatePersistence,
  getWindowModeOptions,
  resolvePanelWindowBounds,
} from "./window-state.js";

const { autoUpdater } = electronUpdater;
const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

// When the launching terminal/parent closes the stdout/stderr pipe, console
// writes raise EPIPE. Without a listener Node turns that into an uncaught
// exception that kills the app, so swallow broken-pipe errors on both streams.
for (const stream of [process.stdout, process.stderr]) {
  stream.on?.("error", (error) => {
    if (error?.code !== "EPIPE" && error?.code !== "ERR_STREAM_DESTROYED") {
      throw error;
    }
  });
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDevelopment = !app.isPackaged;
const legacyAppName = ["Br", "ah"].join("");
const credentialStoreFilename = "openai-credentials.json";

const openAIAuthConfig = Object.freeze({
  clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
  authorizeUrl: "https://auth.openai.com/oauth/authorize",
  tokenUrl: "https://auth.openai.com/oauth/token",
  scope: "openid profile email offline_access api.connectors.read api.connectors.invoke",
  redirectHost: "localhost",
  redirectPort: 1455,
  redirectPath: "/auth/callback",
});

const API_KEY_EXPIRES_AT = Number.MAX_SAFE_INTEGER;
const NUDGE_REFRESH_INTERVAL_MS = 30 * 60 * 1000;

const windowModes = Object.freeze({
  // `alwaysOnTop` is only set for the transient call overlay so it stays visible
  // while the user works in other apps. The main UI (orb/panel) behaves like a
  // normal window and can be sent behind other windows.
  orb: { width: 172, height: 188, placement: "bottom-right", alwaysOnTop: false },
  call: { width: 226, height: 52, placement: "bottom-center", alwaysOnTop: true },
  panel: { width: 1060, height: 712, placement: "bottom-right", alwaysOnTop: false },
});
const onboardingCompletedSettingKey = "onboardingCompleted";

let mainWindow;
let windowMode = "panel";
let trayController = null;
let windowFadeTimer = null;
let windowFadeResolve = null;
let activeComputerUseController = null;
// User-chosen panel bounds (set by dragging/resizing the panel), persisted
// across launches. Transient call/orb modes keep their anchored placement.
let panelWindowState = null;
let userPanelBounds = null;
let suppressMoveSave = false;
let moveSaveTimer = null;
// Set while we resize the window ourselves, so the resize guard ignores it.
let suppressBoundsGuard = false;
let nudgeRefreshInterval = null;
let nudgeRefreshPromise = null;
let nudgeRefreshGeneration = 0;
let latestNudgePayload = null;
const mcpClientManager = new MCPClientManager();
const secretCodec = createSafeStorageSecretCodec(safeStorage);
const mcpServerStore = new ServerStore({ secretCodec });
const composioIntegrationService = createComposioIntegrationService({
  secretCodec,
  serverStore: mcpServerStore,
  mcpClientManager,
  openExternal: (url) => shell.openExternal(url),
});
const settingsStoreBridge = {
  getAllSettings,
  getBool,
  getSetting,
  getString,
  setSetting,
};
const personaEngine = new PersonaEngine({ settingsStore: settingsStoreBridge });
const agentProfileIdentityHandlers = createAgentProfileIdentityAdapters({
  onChanged: broadcastIdentityChanged,
  personaEngine,
  loadAgentProfile,
  saveAgentProfile,
});
let memoryStore = null;
let memoryMiddleware = null;
let latestUpdateStatus = createUpdateStatus("idle", "Updates have not been checked yet.");

process.on("uncaughtException", (error) => {
  reportGlobalError("process.uncaughtException", error);
});

process.on("unhandledRejection", (reason) => {
  reportGlobalError("process.unhandledRejection", reason);
});

function createMainWindow() {
  const panelOptions = getWindowModeOptions("panel", windowModes.panel);
  mainWindow = new BrowserWindow({
    width: panelOptions.width,
    height: panelOptions.height,
    minWidth: panelOptions.minWidth,
    minHeight: panelOptions.minHeight,
    maxWidth: panelOptions.maxWidth,
    maxHeight: panelOptions.maxHeight,
    frame: false,
    transparent: true,
    resizable: panelOptions.resizable,
    alwaysOnTop: windowModes.panel.alwaysOnTop,
    skipTaskbar: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  applyWindowBounds(getWindowBoundsForMode(windowModes.panel, "panel"));
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"), {
    query: shouldLaunchOnboarding() ? { onboarding: "1" } : {},
  });

  // Persist the position whenever the user drags the panel so it is restored on
  // the next launch. Programmatic moves (mode switches) are suppressed.
  mainWindow.on("move", handleWindowMove);
  mainWindow.on("resize", handleWindowResize);
  // macOS auto-resizes this frameless, transparent window during screen capture
  // (desktopCapturer.getSources), ignoring even maxSize — it stretched the
  // computer-use pill to ~84px. Snap any unexpected resize back to the mode size.
  mainWindow.on("resize", enforceModeBounds);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const { protocol } = new URL(url);
      if (protocol === "https:" || protocol === "http:" || protocol === "mailto:") {
        shell.openExternal(url);
      }
    } catch {
      /* ignore malformed URL */
    }
    return { action: "deny" };
  });

  // Keep the renderer pinned to the packaged index.html so the privileged
  // window.leena bridge can never be inherited by a remote origin.
  const blockOffOrigin = (event, url) => {
    if (!url.startsWith("file://")) event.preventDefault();
  };
  mainWindow.webContents.on("will-navigate", blockOffOrigin);
  mainWindow.webContents.on("will-redirect", blockOffOrigin);
}

function handleWindowMove() {
  if (suppressMoveSave || windowMode !== "panel" || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  if (moveSaveTimer !== null) {
    clearTimeout(moveSaveTimer);
  }
  moveSaveTimer = setTimeout(() => {
    moveSaveTimer = null;
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    userPanelBounds = mainWindow.getBounds();
    try {
      panelWindowState?.scheduleSave(userPanelBounds);
    } catch (error) {
      safeConsole("warn", "Failed to persist window bounds", error);
    }
  }, 400);
}

function handleWindowResize() {
  if (windowMode !== "panel" || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  userPanelBounds = mainWindow.getBounds();
  try {
    panelWindowState?.scheduleSave(userPanelBounds);
  } catch (error) {
    safeConsole("warn", "Failed to persist window bounds", error);
  }
}

// Applies bounds without recording them as a user-initiated move or tripping the
// resize guard.
function applyWindowBounds(bounds) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  suppressMoveSave = true;
  suppressBoundsGuard = true;
  mainWindow.setBounds(bounds, false);
  setImmediate(() => {
    suppressMoveSave = false;
    suppressBoundsGuard = false;
  });
}

// Reverts any externally-driven resize (e.g. macOS during screen capture) back
// to the current mode's exact size, keeping the window's current position.
function enforceModeBounds() {
  if (suppressBoundsGuard || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  if (windowMode === "panel") {
    return;
  }
  const expected = windowModes[windowMode];
  if (!expected) {
    return;
  }
  const bounds = mainWindow.getBounds();
  if (bounds.width === expected.width && bounds.height === expected.height) {
    return;
  }
  suppressBoundsGuard = true;
  mainWindow.setBounds(
    { x: bounds.x, y: bounds.y, width: expected.width, height: expected.height },
    false,
  );
  setImmediate(() => {
    suppressBoundsGuard = false;
  });
}

async function setMainWindowMode(mode) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return windowMode;
  }
  const target = windowModes[mode] ?? windowModes.orb;
  windowMode = windowModes[mode] ? mode : "orb";
  const modeOptions = getWindowModeOptions(windowMode, target);
  const targetBounds = getWindowBoundsForMode(target, windowMode);
  const currentBounds = mainWindow.getBounds();
  const sizeChanged =
    currentBounds.width !== targetBounds.width || currentBounds.height !== targetBounds.height;
  if (sizeChanged) {
    await fadeMainWindowTo(0, 110);
  }
  // Pin BOTH min and max to the mode size. This frameless, transparent window
  // is otherwise auto-grown by macOS during screen capture (it stretched the
  // computer-use pill to ~84px tall); locking max prevents any such resize.
  mainWindow.setResizable(Boolean(modeOptions.resizable));
  mainWindow.setMinimumSize(modeOptions.minWidth, modeOptions.minHeight);
  mainWindow.setMaximumSize(modeOptions.maxWidth, modeOptions.maxHeight);
  // Only the transient call overlay floats above other apps; the main UI is a
  // normal window so it can be sent behind other windows.
  mainWindow.setAlwaysOnTop(Boolean(target.alwaysOnTop));
  applyWindowBounds(targetBounds);
  if (sizeChanged) {
    await fadeMainWindowTo(1, 130);
  }
  return windowMode;
}

function getWindowBoundsForMode(target, mode) {
  const display = screen.getPrimaryDisplay();
  const margin = target.placement === "bottom-center" ? 14 : 24;
  const x =
    target.placement === "bottom-center"
      ? Math.round(display.workArea.x + (display.workArea.width - target.width) / 2)
      : Math.round(display.workArea.x + display.workArea.width - target.width - margin);
  const defaultBounds = {
    x,
    y: Math.round(display.workArea.y + display.workArea.height - target.height - margin),
    width: target.width,
    height: target.height,
  };
  // The main panel is the only draggable/resizable surface, so it restores the
  // user's saved bounds; call/orb keep their anchored placement.
  if (mode === "panel") {
    return resolvePanelWindowBounds({
      savedBounds: userPanelBounds,
      defaultBounds,
      displays: screen.getAllDisplays(),
    });
  }
  return defaultBounds;
}

function endActiveFade() {
  if (windowFadeTimer !== null) {
    clearInterval(windowFadeTimer);
    windowFadeTimer = null;
  }
  // Resolve a superseded fade's promise so anything awaiting it (e.g. the
  // window:set-mode IPC handler) never hangs — a hung await leaves the IPC
  // reply unsent ("reply was never sent").
  if (windowFadeResolve !== null) {
    const resolvePrevious = windowFadeResolve;
    windowFadeResolve = null;
    resolvePrevious();
  }
}

function fadeMainWindowTo(targetOpacity, duration) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return Promise.resolve();
  }
  endActiveFade();
  const startOpacity = mainWindow.getOpacity();
  const startedAt = Date.now();

  return new Promise((resolve) => {
    windowFadeResolve = resolve;
    windowFadeTimer = setInterval(() => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        endActiveFade();
        return;
      }
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;
      const opacity = startOpacity + (targetOpacity - startOpacity) * eased;
      mainWindow.setOpacity(Math.max(0.01, Math.min(1, opacity)));
      if (progress >= 1) {
        clearInterval(windowFadeTimer);
        windowFadeTimer = null;
        windowFadeResolve = null;
        mainWindow.setOpacity(targetOpacity);
        resolve();
      }
    }, 1000 / 60);
  });
}

function wireUpdateEvents() {
  autoUpdater.autoDownload = false;

  autoUpdater.on("checking-for-update", () => {
    emitUpdateStatus("checking", "Checking GitHub for updates.");
  });

  autoUpdater.on("update-available", (info) => {
    emitUpdateStatus("available", `Leena ${info?.version ?? "update"} is available.`, {
      updateInfo: sanitizeUpdateInfo(info),
    });
  });

  autoUpdater.on("update-not-available", () => {
    emitUpdateStatus("current", "You are running the latest version.");
  });

  autoUpdater.on("error", (error) => {
    emitUpdateStatus("error", `Update error: ${error.message}`);
  });

  autoUpdater.on("download-progress", (progress) => {
    emitUpdateStatus("downloading", formatUpdateDownloadProgress(progress), {
      percent: normalizePercent(progress?.percent),
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    emitUpdateStatus("downloaded", "Update downloaded. Restart Leena to install it.", {
      updateInfo: sanitizeUpdateInfo(info),
    });
  });
}

function createUpdateStatus(state, message, extra = {}) {
  return {
    state,
    message,
    version: app.getVersion(),
    ...extra,
  };
}

function emitUpdateStatus(state, message, extra = {}) {
  latestUpdateStatus = createUpdateStatus(state, message, extra);
  mainWindow?.webContents.send("update:status", latestUpdateStatus);
  return latestUpdateStatus;
}

function sanitizeUpdateInfo(info) {
  if (!info || typeof info !== "object") {
    return null;
  }
  return {
    files: Array.isArray(info.files)
      ? info.files.map((file) => ({ url: file?.url, size: file?.size })).filter((file) => file.url)
      : [],
    releaseDate: typeof info.releaseDate === "string" ? info.releaseDate : null,
    version: typeof info.version === "string" ? info.version : null,
  };
}

function formatUpdateDownloadProgress(progress) {
  const percent = normalizePercent(progress?.percent);
  if (percent === null) {
    return "Downloading update from GitHub.";
  }
  return `Downloading update from GitHub (${percent}%).`;
}

function normalizePercent(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : null;
}

ipcMain.handle("app:get-version", () => app.getVersion());
ipcMain.handle("app:is-development", () => isDevelopment);
ipcMain.handle("update:get-status", () => latestUpdateStatus);
ipcMain.handle("update:check", async () => {
  if (isDevelopment) {
    return emitUpdateStatus("development", "Updates are checked only in packaged builds.");
  }

  await autoUpdater.checkForUpdates();
  return latestUpdateStatus;
});
ipcMain.handle("update:download", async () => {
  if (isDevelopment) {
    return emitUpdateStatus("development", "Updates are downloaded only in packaged builds.");
  }

  const status = emitUpdateStatus("downloading", "Starting update download from GitHub.");
  await autoUpdater.downloadUpdate();
  return status;
});
ipcMain.handle("update:install", () => {
  if (isDevelopment) {
    return emitUpdateStatus("development", "Updates install only in packaged builds.");
  }

  const status = emitUpdateStatus("installing", "Restarting Leena to install the update.");
  autoUpdater.quitAndInstall(false, true);
  return status;
});

ipcMain.handle("openai:get-status", async () => {
  const credentials = await getFreshOpenAICredentials();
  return credentials ? credentialsToStatus(credentials) : { connected: false };
});

ipcMain.handle("openai:login", async () => {
  const credentials = await loginOpenAI();
  return credentialsToStatus(credentials);
});

ipcMain.handle("openai:save-api-key", async (_event, payload = {}) => {
  const credentials = await saveOpenAIApiKey(payload);
  return credentialsToStatus(credentials);
});

ipcMain.handle("openai:get-auth-type", async () => getOpenAIAuthType());

ipcMain.handle("openai:logout", async () => {
  await clearOpenAICredentials();
  return { connected: false };
});

ipcMain.handle("realtime:create-session", async (_event, options = {}) => {
  return createRealtimeProviderSession(options);
});

ipcMain.handle("openai:create-realtime-secret", async (_event, options = {}) => {
  return createRealtimeProviderSession(options);
});

ipcMain.handle("realtime:create-persona-session-update", () => createPersonaSessionUpdate());

async function createRealtimeProviderSession(options = {}) {
  const credentials = await getFreshOpenAICredentials();
  if (!credentials) {
    return createNoRealtimeProviderResponse();
  }

  const provider = createRealtimeProvider(credentials);
  if (!provider) {
    return createNoRealtimeProviderResponse();
  }
  const { session, tools } = await createRealtimeSessionConfig();

  return provider.createRealtimeSession({
    ...options,
    model: getProviderDefaultModel(provider, REALTIME, options.model),
    voice: session.audio.output.voice,
    instructions: session.instructions,
    tools,
  });
}

async function createPersonaSessionUpdate() {
  const { activePersona, session, tools } = await createRealtimeSessionConfig();
  return { activePersona, session: { ...session, tools } };
}

async function createRealtimeSessionConfig() {
  const profile = loadAgentProfile();
  const activePersona = personaEngine.getActive();
  const memories = await getMemoryMiddleware().onSessionStart(profile);
  const tools = await getRealtimeToolDefinitions(mcpClientManager);
  return {
    activePersona,
    session: {
      audio: { output: { voice: resolveRealtimeVoicePreference(profile, activePersona) } },
      instructions: buildRealtimeInstructions({ profile, memories, persona: activePersona, tools }),
    },
    tools,
  };
}

ipcMain.handle("agent:get-profile", agentProfileIdentityHandlers.getAgentProfile);
ipcMain.handle("agent:set-profile", agentProfileIdentityHandlers.setAgentProfile);
ipcMain.handle("audio:get-microphone", () => loadMicrophoneDeviceId());
ipcMain.handle("audio:set-microphone", (_event, deviceId) => saveMicrophoneDeviceId(deviceId));
ipcMain.handle("settings:get", (_event, key, defaultValue) => getSetting(key, defaultValue));
ipcMain.handle("settings:set", (_event, key, value) => {
  const saved = setSetting(key, value);
  broadcastDataChanged("settings", { type: "settings", key });
  if (isNudgeSettingKey(key)) {
    void refreshNudges("settings", { force: true });
  }
  return saved;
});
ipcMain.handle("settings:get-all", () => getAllSettings());

ipcMain.handle("planner:list-tasks", () => listTasks());
ipcMain.handle("planner:list-calendar", () => listCalendarItems());
ipcMain.handle("planner:delete-tasks", (_event, ids) => deletePlannerTasks(ids));
ipcMain.handle("planner:complete-tasks", (_event, ids) => completePlannerTasks(ids));
ipcMain.handle("planner:delete-calendar-items", (_event, ids) => deletePlannerCalendarItems(ids));
ipcMain.handle("activity:list", (_event, kind) => listActivity(kind));
ipcMain.handle("nudges:list", () => getLatestNudges());
ipcMain.handle("nudges:refresh", () => refreshNudges("manual"));
ipcMain.handle("nudges:dismiss", async (_event, id) => {
  const dismissed = await dismissNudge(id, { settings: settingsStoreBridge });
  const payload = await refreshNudges("dismiss", { force: true });
  return { ...dismissed, payload };
});
ipcMain.handle("screenshots:list", () => listScreenshots());
ipcMain.handle("screenshots:reveal", (_event, name) => revealScreenshot(name));
ipcMain.handle("screenshots:delete", (_event, names) => deleteScreenshots(names));
ipcMain.handle("window:set-mode", (_event, mode) => setMainWindowMode(mode));
ipcMain.handle("window:set-focusable", (_event, focusable) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }
  mainWindow.setFocusable(Boolean(focusable));
  return Boolean(focusable);
});
ipcMain.handle("window:minimize", () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }
  mainWindow.minimize();
  return true;
});
ipcMain.handle("window:get-state", () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null;
  }
  return mainWindow.getBounds();
});
ipcMain.handle("window:set-state", (_event, bounds) => {
  if (!mainWindow || mainWindow.isDestroyed() || windowMode !== "panel") {
    return null;
  }
  const nextBounds = resolvePanelWindowBounds({
    savedBounds: bounds,
    defaultBounds: getWindowBoundsForMode(windowModes.panel, "panel"),
    displays: screen.getAllDisplays(),
  });
  userPanelBounds = nextBounds;
  panelWindowState?.saveNow(nextBounds);
  applyWindowBounds(nextBounds);
  return nextBounds;
});
ipcMain.handle("tray:set-state", (_event, state) => setRuntimeTrayState(state));
ipcMain.handle("tray:get-state", () => trayController?.getCurrentState() ?? "idle");
ipcMain.handle("app:quit", () => {
  app.quit();
  return true;
});
ipcMain.handle("onboarding:complete", () => {
  const saved = setSetting(onboardingCompletedSettingKey, true);
  broadcastDataChanged("settings", { type: "settings", key: onboardingCompletedSettingKey });
  return saved;
});
ipcMain.handle("settings:reset-onboarding", () => {
  const saved = setSetting(onboardingCompletedSettingKey, false);
  broadcastDataChanged("settings", { type: "settings", key: onboardingCompletedSettingKey });
  return saved;
});
ipcMain.handle("permissions:get-status", async () => getOsPermissionStatus());
ipcMain.handle("permissions:request", async (_event, id) => requestOsPermission(id));
ipcMain.handle("permissions:open-settings", async (_event, id) => openOsPermissionSettings(id));
ipcMain.handle("diagnostics:get-log-path", () => getDiagnosticLogPath());
ipcMain.handle("diagnostics:open-log", async () => {
  await shell.openPath(getDiagnosticLogPath());
  return getDiagnosticLogPath();
});
ipcMain.handle("diagnostics:write", async (_event, event, details = {}) => {
  await writeDiagnosticLog(`renderer.${event}`, sanitizeDiagnosticValue(details));
  return { ok: true };
});
ipcMain.handle("diagnostics:privacy", async () => collectPrivacyDiagnostics());
ipcMain.handle("tools:get-definitions", () => getRealtimeToolDefinitions(mcpClientManager));
ipcMain.handle("tools:execute", async (_event, name, args = {}) => {
  if (typeof name !== "string" || !name.trim()) {
    return {
      status: "invalid_arguments",
      message: "Tool name must be a non-empty string.",
    };
  }
  const isComputerUse = name === "computer_use_task";
  const abortController = isComputerUse ? new AbortController() : null;
  if (abortController) {
    activeComputerUseController?.abort();
    activeComputerUseController = abortController;
  }
  try {
    return await executeRealtimeToolWithAudit(name, args, { abortController });
  } finally {
    if (abortController && activeComputerUseController === abortController) {
      activeComputerUseController = null;
    }
  }
});

ipcMain.handle("tools:cancel-computer-use", () => cancelComputerUse());

function cancelComputerUse() {
  if (activeComputerUseController) {
    activeComputerUseController.abort();
    return { cancelled: true };
  }
  return { cancelled: false };
}

async function executeRealtimeToolWithAudit(name, args = {}, options = {}) {
  const startedAt = Date.now();
  const permissionSnapshot = await getOsPermissionStatus();
  await writeDiagnosticLog("tool.execute.start", {
    tool: name,
    args: sanitizeDiagnosticValue(args),
    permissions: summarizePermissionSnapshot(permissionSnapshot),
  });
  try {
    const result = await executeRealtimeToolWithRuntimeOptions(name, args, {
      ...options,
      permissionSnapshot,
    });
    await writeDiagnosticLog("tool.execute.finish", {
      tool: name,
      elapsedMs: Date.now() - startedAt,
      result: summarizeToolResult(result),
    });
    await recordToolActivity(name, args, result);
    broadcastDataChanged(categoryForTool(name));
    return result;
  } catch (error) {
    await writeDiagnosticLog(
      "tool.execute.error",
      sanitizeDiagnosticValue({
        tool: name,
        elapsedMs: Date.now() - startedAt,
        error: formatDiagnosticError(error),
      }),
    );
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Tool execution failed.",
    };
  }
}

async function executeRealtimeToolWithRuntimeOptions(
  name,
  args = {},
  { abortController, permissionSnapshot } = {},
) {
  const ownedAbortController =
    name === "computer_use_task" && !abortController ? new AbortController() : null;
  const toolAbortController = abortController ?? ownedAbortController;
  if (ownedAbortController) {
    activeComputerUseController?.abort();
    activeComputerUseController = ownedAbortController;
  }

  try {
    const credentials = name === "computer_use_task" ? await getFreshOpenAICredentials() : null;
    const screenshotOptions = {
      desktopCapturer,
      screen,
      userDataPath: app.getPath("userData"),
      logger: createToolLogger(name),
      ...(credentials ? { openAI: { accessToken: credentials.accessToken } } : {}),
    };

    const fullDiskAccessStatus =
      getPermissionStatusFromSnapshot(permissionSnapshot, "full-disk-access") ??
      (await detectFullDiskAccessStatus());

    return await executeRealtimeTool(name, args, {
      screenshot: screenshotOptions,
      computerUse: {
        ...(credentials
          ? {
              openAI: {
                accessToken: credentials.accessToken,
                accountId: credentials.accountId,
              },
            }
          : {}),
        originator: "ggcoder",
        logger: createToolLogger(name),
        desktopCapturer,
        screen,
        ensureOsControlAllowed,
        signal: toolAbortController?.signal,
      },
      session: {
        cancelComputerUse,
      },
      fileSystem: {
        rootPath: app.getPath("home"),
        fullDiskAccessStatus,
      },
      planner: {
        appleCalendar: {
          permissionStatus: await getAppleCalendarAccessStatus(),
        },
      },
      mcp: {
        clientManager: mcpClientManager,
        getServerConfig: getMCPServerConfigForPermission,
      },
    });
  } finally {
    if (ownedAbortController && activeComputerUseController === ownedAbortController) {
      activeComputerUseController = null;
    }
  }
}

app.whenReady().then(() => {
  initializeDataStore();
  applyConfiguredLaunchOnLogin();
  void startDiagnosticSession();
  wireUpdateEvents();
  createMainWindow();
  initializeTray();
  initializeFeatureHandlers();
  initializeMCPAutoConnect();
  initializeNudgeScheduler();

  if (!isDevelopment) {
    autoUpdater.checkForUpdates().catch((error) => {
      emitUpdateStatus("error", `Update error: ${error.message}`);
    });
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      return;
    }
    // Reopening from the Dock should restore a minimized companion window.
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isMinimized()) {
      mainWindow.restore();
      mainWindow.show();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (nudgeRefreshInterval !== null) {
    clearInterval(nudgeRefreshInterval);
    nudgeRefreshInterval = null;
  }
  try {
    panelWindowState?.flush();
  } catch (error) {
    safeConsole("warn", "Failed to flush window bounds", error);
  }
});

function initializeDataStore() {
  const currentUserDataPath = app.getPath("userData");
  const legacyUserDataPaths = getLegacyUserDataPaths(currentUserDataPath);
  migrateLegacyCredentialFile(currentUserDataPath, legacyUserDataPaths);
  setDatabaseUserDataPath(currentUserDataPath, { legacyUserDataPaths });
  try {
    migrateLegacyPlannerStore();
    migrateLegacyActivityStore();
  } catch (error) {
    safeConsole("warn", "Legacy store migration failed", error);
  }
  try {
    panelWindowState = createPanelWindowStatePersistence({ settingsStore: settingsStoreBridge });
    userPanelBounds = panelWindowState.load();
  } catch (error) {
    safeConsole("warn", "Failed to load window bounds", error);
  }
}

function applyConfiguredLaunchOnLogin() {
  try {
    applyLaunchOnLoginAtStartup({ app, settingsStore: settingsStoreBridge });
  } catch (error) {
    safeConsole("warn", "Failed to apply launch-on-login setting", error);
  }
}

function shouldLaunchOnboarding() {
  try {
    return !getBool(onboardingCompletedSettingKey, false);
  } catch (error) {
    safeConsole("warn", "Failed to read onboarding completion setting", error);
    return true;
  }
}

function initializeFeatureHandlers() {
  registerLaunchOnLoginHandlers({ ipcMain, app, settingsStore: settingsStoreBridge });
  registerIdentityHandlers({ ipcMain, onChanged: broadcastIdentityChanged, personaEngine });
  registerMemoryHandlers({ ipcMain, store: getMemoryStore() });
  registerProviderHandlers(ipcMain, {
    registerComposioTestConnection: false,
    secretCodec,
  });
  registerComposioIntegrationHandlers({
    ipcMain,
    service: composioIntegrationService,
  });
  registerChatHandlers({
    ipcMain,
    registry: getRegistry(),
    executeTool: (name, args) => executeRealtimeToolWithAudit(name, args),
    getToolDefinitions: () => getRealtimeToolDefinitions(mcpClientManager),
  });
  registerMCPHandlers({
    ipcMain,
    serverStore: mcpServerStore,
    mcpClientManager,
    webContents: mainWindow?.webContents,
  });
  const hotkeyRegistration = registerHotkeyHandlers({
    ipcMain,
    app,
    globalShortcut,
    getMainWindow: () => mainWindow,
    settingsStore: settingsStoreBridge,
    logger: console,
  });
  const hotkeyController = hotkeyRegistration.controller;
  const result = hotkeyController.registerConfiguredHotkey();
  if (!result.success) {
    safeConsole("warn", "Failed to register configured hotkey", result.error);
  }
}

function getMemoryStore() {
  if (!memoryStore) {
    memoryStore = new SQLiteMemoryStore({
      providerRegistry: getRegistry(),
    });
  }
  return memoryStore;
}

function getMemoryMiddleware() {
  if (!memoryMiddleware) {
    memoryMiddleware = createMemoryMiddleware(getMemoryStore());
  }
  return memoryMiddleware;
}

function initializeNudgeScheduler() {
  if (nudgeRefreshInterval !== null) {
    clearInterval(nudgeRefreshInterval);
  }
  const refresh = () => {
    void refreshNudges("scheduled");
  };
  mainWindow?.webContents.once("did-finish-load", () => {
    void refreshNudges("launch");
  });
  setImmediate(refresh);
  nudgeRefreshInterval = setInterval(refresh, NUDGE_REFRESH_INTERVAL_MS);
}

async function getLatestNudges() {
  if (nudgeRefreshPromise?.force) {
    return nudgeRefreshPromise.promise;
  }
  return latestNudgePayload ?? refreshNudges("initial", { broadcast: false });
}

async function refreshNudges(reason, { broadcast = true, force = false } = {}) {
  if (nudgeRefreshPromise && !force) {
    return nudgeRefreshPromise.promise;
  }

  if (force) {
    nudgeRefreshGeneration += 1;
    latestNudgePayload = createStaleNudgePayload();
  }
  const generation = nudgeRefreshGeneration;
  const promise = generateNudges({
    memory: {
      recall: (query, limit) => getMemoryStore().recall(query, limit),
    },
    planner: {
      listCalendarItems,
      listTasks,
    },
    settings: settingsStoreBridge,
  })
    .then((payload) => {
      if (generation !== nudgeRefreshGeneration) {
        return createStaleNudgePayload();
      }
      latestNudgePayload = payload;
      if (broadcast) {
        broadcastNudgesChanged(payload, reason);
      }
      return payload;
    })
    .catch((error) => {
      safeConsole("warn", "Nudge generation failed", error);
      const payload = createNudgePayload([], { enabled: false });
      payload.error = "Nudge generation failed.";
      if (generation !== nudgeRefreshGeneration) {
        return createStaleNudgePayload();
      }
      latestNudgePayload = payload;
      if (broadcast) {
        broadcastNudgesChanged(payload, reason);
      }
      return payload;
    })
    .finally(() => {
      if (nudgeRefreshPromise?.generation === generation) {
        nudgeRefreshPromise = null;
      }
    });
  nudgeRefreshPromise = { force, generation, promise };
  return promise;
}

function createStaleNudgePayload() {
  return createNudgePayload([], { enabled: false });
}

function initializeMCPAutoConnect() {
  registerMCPAutoConnectCleanup({
    app,
    mcpClientManager,
    logger: writeDiagnosticLog,
  });
  const mcpAutoConnectController = initMCPAutoConnect({
    serverStore: mcpServerStore,
    mcpClientManager,
    webContents: mainWindow?.webContents,
    logger: writeDiagnosticLog,
  });
  mcpAutoConnectController.completion.catch((error) => {
    safeConsole("warn", "MCP auto-connect failed", error);
  });
}

function initializeTray() {
  if (trayController) {
    return trayController;
  }
  trayController = createTrayController({
    Tray,
    Menu,
    nativeImage,
    app,
    getMainWindow: () => mainWindow,
    setWindowMode: setMainWindowMode,
  });
  trayController.createTray();
  trayController.wireWindowCloseToTray();
  return trayController;
}

function setRuntimeTrayState(state) {
  try {
    if (!trayController) {
      initializeTray();
    }
    if (trayController.getCurrentState() === "muted" && state !== "muted") {
      return "muted";
    }
    return trayController.setTrayState(state);
  } catch (error) {
    safeConsole("warn", "Failed to set tray state", error);
    return trayController?.getCurrentState() ?? "idle";
  }
}

async function getMCPServerConfigForPermission(serverId) {
  const composioConfig = composioIntegrationService.getPermissionServerConfig(serverId);
  if (composioConfig) {
    return composioConfig;
  }

  const storedServer = mcpServerStore.getServer(serverId);
  let tools = [];
  try {
    tools = await mcpClientManager.listTools(serverId);
  } catch {
    tools = [];
  }
  const { headers: _headers, ...serverMetadata } = storedServer ?? {};
  return {
    ...serverMetadata,
    serverId: storedServer?.id ?? serverId,
    name: storedServer?.name ?? serverId,
    permission_level: storedServer?.permission_level ?? "confirm",
    tools,
  };
}

function getLegacyUserDataPaths(currentUserDataPath) {
  const candidates = [];
  try {
    const appDataPath = app.getPath("appData");
    candidates.push(path.join(appDataPath, legacyAppName));
    candidates.push(path.join(appDataPath, legacyAppName.toLowerCase()));
  } catch {
    return [];
  }
  const currentResolved = path.resolve(currentUserDataPath);
  const seen = new Set();
  return candidates.filter((candidate) => {
    const resolved = path.resolve(candidate);
    if (resolved === currentResolved || seen.has(resolved)) {
      return false;
    }
    seen.add(resolved);
    return true;
  });
}

function migrateLegacyCredentialFile(currentUserDataPath, legacyUserDataPaths) {
  const currentPath = path.join(currentUserDataPath, credentialStoreFilename);
  if (existsSync(currentPath)) {
    return;
  }
  for (const legacyUserDataPath of legacyUserDataPaths) {
    const legacyPath = path.join(legacyUserDataPath, credentialStoreFilename);
    if (!existsSync(legacyPath)) {
      continue;
    }
    try {
      mkdirSync(currentUserDataPath, { recursive: true });
      renameSync(legacyPath, currentPath);
      return;
    } catch (error) {
      safeConsole("warn", "Legacy credential migration failed", error);
    }
  }
}

function getDiagnosticLogPath() {
  return path.join(app.getPath("userData"), "diagnostics.log");
}

function broadcastDataChanged(category, details = {}) {
  if (!category || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send("data:changed", { category, ...details });
}

function broadcastIdentityChanged(details = {}) {
  broadcastDataChanged("identity", { type: "identity", ...details });
}

function broadcastNudgesChanged(payload, reason) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send("nudges:changed", { payload, reason });
}

function isNudgeSettingKey(key) {
  return key === NUDGE_SETTINGS.enabled || key === NUDGE_SETTINGS.settingsToggle;
}

function reportGlobalError(event, error) {
  const diagnosticPayload = { event, error: serializeError(error) };
  void writeDiagnosticLog(event, sanitizeDiagnosticValue(diagnosticPayload));
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  const rendererPayload = sanitizeDiagnosticValue({
    event,
    error: serializeError(error, {
      includeStack: shouldExposeRendererErrorStack(),
      redactSecrets: true,
    }),
  });
  mainWindow.webContents.send("leena:error", rendererPayload);
}

function shouldExposeRendererErrorStack() {
  return !app.isPackaged && process.env.NODE_ENV !== "production";
}

function categoryForTool(name) {
  switch (name) {
    case "add_task":
    case "delete_task":
    case "update_task_status":
      return "tasks";
    case "add_calendar_item":
    case "delete_calendar_item":
      return "calendar";
    case "take_screenshot":
    case "analyze_screen":
      return "screenshots";
    case "web_search":
    case "web_fetch":
      return "web";
    case "computer_use_task":
      return "computer";
    default:
      return null;
  }
}

async function recordToolActivity(name, args, result) {
  if (!isRecord(result)) {
    return;
  }
  try {
    if (name === "web_search") {
      await recordActivity({
        kind: "web_search",
        query: typeof result.query === "string" ? result.query : args?.query,
        resultCount: result.resultCount,
        results: result.results,
      });
      return;
    }
    if (name === "web_fetch") {
      await recordActivity({
        kind: "web_fetch",
        url: result.url ?? args?.url,
        title: result.title,
        text: result.text,
      });
      return;
    }
    if (name === "computer_use_task") {
      await recordActivity({
        kind: "computer_use",
        task: typeof args?.task === "string" ? args.task : "",
        statusText: result.status,
        steps: result.steps,
        finalText: result.finalText,
      });
    }
  } catch (error) {
    console.warn("Failed to record activity", error);
  }
}

function toIdList(value) {
  if (Array.isArray(value)) {
    return value.map((id) => String(id)).filter((id) => id.trim());
  }
  if (typeof value === "string" && value.trim()) {
    return [value];
  }
  return [];
}

// These handlers intentionally do not broadcastDataChanged: the panel that
// invoked them refreshes itself in place (without reanimating), so a broadcast
// would trigger a redundant animated reload.
function deletePlannerTasks(ids) {
  let deleted = 0;
  for (const id of toIdList(ids)) {
    if (deleteTask(id).status === "deleted") {
      deleted += 1;
    }
  }
  return { status: "ok", deleted };
}

function completePlannerTasks(ids) {
  let updated = 0;
  for (const id of toIdList(ids)) {
    if (updateTaskStatus(id, "completed").status === "updated") {
      updated += 1;
    }
  }
  return { status: "ok", updated };
}

function deletePlannerCalendarItems(ids) {
  let deleted = 0;
  for (const id of toIdList(ids)) {
    if (deleteCalendarItem(id).status === "deleted") {
      deleted += 1;
    }
  }
  return { status: "ok", deleted };
}

async function deleteScreenshots(names) {
  const screenshotsDir = path.join(app.getPath("userData"), "screenshots");
  let deleted = 0;
  for (const name of toIdList(names)) {
    if (name.includes("/") || name.includes("\\") || name.includes("..")) {
      continue;
    }
    const filePath = path.join(screenshotsDir, name);
    if (path.dirname(filePath) !== screenshotsDir) {
      continue;
    }
    try {
      await fs.unlink(filePath);
      deleted += 1;
    } catch (error) {
      if (error?.code !== "ENOENT") {
        safeConsole("warn", "Failed to delete screenshot", error);
      }
    }
  }
  return { status: "ok", deleted };
}

async function listScreenshots() {
  const screenshotsDir = path.join(app.getPath("userData"), "screenshots");
  let names;
  try {
    names = await fs.readdir(screenshotsDir);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
  const pngNames = names.filter((name) => name.toLowerCase().endsWith(".png"));
  const entries = await Promise.all(
    pngNames.map(async (name) => {
      const filePath = path.join(screenshotsDir, name);
      try {
        const [stats, bytes] = await Promise.all([fs.stat(filePath), fs.readFile(filePath)]);
        return {
          name,
          dataUrl: `data:image/png;base64,${bytes.toString("base64")}`,
          createdAt: stats.mtimeMs,
        };
      } catch {
        return null;
      }
    }),
  );
  return entries
    .filter(Boolean)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 30);
}

async function revealScreenshot(name) {
  if (
    typeof name !== "string" ||
    !name ||
    name.includes("/") ||
    name.includes("\\") ||
    name.includes("..")
  ) {
    throw new Error("Invalid screenshot name.");
  }
  const screenshotsDir = path.join(app.getPath("userData"), "screenshots");
  const filePath = path.join(screenshotsDir, name);
  if (path.dirname(filePath) !== screenshotsDir) {
    throw new Error("Invalid screenshot path.");
  }
  shell.showItemInFolder(filePath);
  return { revealed: true };
}

const MAX_DIAGNOSTIC_LOG_BYTES = 1_000_000;

async function writeDiagnosticLog(event, details = {}) {
  // Per-line entries stay lean (time/event/details) so the log is easy to read
  // and copy-paste; the static environment context lives in the session.start
  // header written once per launch.
  const entry = { time: new Date().toISOString(), event, details };
  const line = `${JSON.stringify(entry)}\n`;
  try {
    await fs.mkdir(path.dirname(getDiagnosticLogPath()), { recursive: true });
    await fs.appendFile(getDiagnosticLogPath(), line);
  } catch (error) {
    safeConsole("error", "diagnostic log write failed", error);
  }
  safeConsole("info", "diagnostic", event, details);
}

// Rotates the log when it grows large and writes a session header so every run
// in the log is self-describing (app version, platform, displays).
async function startDiagnosticSession() {
  const logPath = getDiagnosticLogPath();
  try {
    const stats = await fs.stat(logPath);
    if (stats.size > MAX_DIAGNOSTIC_LOG_BYTES) {
      await fs.rename(logPath, `${logPath}.prev`);
    }
  } catch {
    // No existing log to rotate.
  }
  const primary = screen.getPrimaryDisplay();
  await writeDiagnosticLog("session.start", {
    appVersion: app.getVersion(),
    electron: process.versions.electron,
    platform: `${process.platform} ${process.arch}`,
    osRelease: os.release(),
    isPackaged: app.isPackaged,
    appPath: app.getAppPath(),
    displayCount: screen.getAllDisplays().length,
    primaryWorkArea: primary.workArea,
  });
}

function safeConsole(level, ...args) {
  try {
    console[level](...args);
  } catch (error) {
    if (error?.code !== "EPIPE" && error?.code !== "ERR_STREAM_DESTROYED") {
      throw error;
    }
  }
}

function createToolLogger(tool) {
  return async (event, details = {}) => {
    await writeDiagnosticLog(event, sanitizeDiagnosticValue({ tool, ...details }));
  };
}

function summarizePermissionSnapshot(permissions) {
  return Object.fromEntries(permissions.map((permission) => [permission.id, permission.status]));
}

function summarizeToolResult(result) {
  if (!result || typeof result !== "object") {
    return result;
  }
  const summary = {
    status: result.status,
    message: typeof result.message === "string" ? result.message.slice(0, 500) : undefined,
    path: result.path,
    dimensions: result.dimensions,
    source: result.source,
    resultCount: result.resultCount,
  };
  return Object.fromEntries(Object.entries(summary).filter(([, value]) => value !== undefined));
}

const SECRET_KEY =
  /(token|secret|authorization|bearer|password|passwd|api[-_]?key|apikey|client_secret|refresh|access_token|cookie|credential|private[-_]?key)/i;

function sanitizeDiagnosticValue(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeDiagnosticValue);
  }
  if (!value || typeof value !== "object") {
    return typeof value === "string" ? redactSensitiveText(value) : value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SECRET_KEY.test(key) ? "[redacted]" : sanitizeDiagnosticValue(item),
    ]),
  );
}

function formatDiagnosticError(error) {
  return error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { message: String(error) };
}

async function collectPrivacyDiagnostics() {
  const diagnostics = {
    appPath: app.getAppPath(),
    executablePath: app.getPath("exe"),
    isPackaged: app.isPackaged,
    bundleIdentifier: app.getApplicationNameForProtocol("file") || null,
    statuses: Object.fromEntries(
      (await getOsPermissionStatus()).map((permission) => [permission.id, permission.status]),
    ),
    tccRows: process.platform === "darwin" ? await readMacOsTccRows() : [],
  };
  await writeDiagnosticLog("privacy.diagnostics", diagnostics);
  return diagnostics;
}

async function readMacOsTccRows() {
  const dbPath = "/Library/Application Support/com.apple.TCC/TCC.db";
  const legacyAppSlug = ["br", "ah"].join("");
  const clientPatterns = ["leena", legacyAppSlug];
  const bundleIds = ["com.leena.app", ["com.unstablemind", legacyAppSlug].join(".")];
  const whereClause = [
    ...clientPatterns.map((client) => `client like '%${client}%'`),
    ...bundleIds.map((client) => `client='${client}'`),
  ].join(" or ");
  try {
    const { stdout } = await execFileAsync("sqlite3", [
      dbPath,
      `select service,client,client_type,auth_value,auth_reason,flags,last_modified from access where ${whereClause} order by service,client;`,
    ]);
    return stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [service, client, clientType, authValue, authReason, flags, lastModified] =
          line.split("|");
        return { service, client, clientType, authValue, authReason, flags, lastModified };
      });
  } catch (error) {
    return [{ error: error instanceof Error ? error.message : String(error) }];
  }
}

async function getAppleCalendarAccessStatus() {
  return detectAppleCalendarAccessStatus();
}

async function getOsPermissionStatus() {
  return createOsPermissionSnapshot({
    microphone: getMediaAccessStatus("microphone"),
    screen: getMediaAccessStatus("screen"),
    accessibility: getAccessibilityStatus(),
    "apple-calendar": await getAppleCalendarAccessStatus(),
    computer: await getComputerUseBrowserStatus(),
    "full-disk-access": await detectFullDiskAccessStatus(),
  });
}

function getPermissionStatusFromSnapshot(snapshot, id) {
  if (!Array.isArray(snapshot)) {
    return null;
  }
  return snapshot.find((permission) => permission?.id === id)?.status ?? null;
}

async function requestOsPermission(id) {
  if (!isKnownOsPermissionId(id)) {
    throw new Error("Unknown OS permission.");
  }
  if (id === "microphone") {
    if (process.platform === "darwin") {
      await systemPreferences.askForMediaAccess("microphone");
    } else if (process.platform === "win32") {
      await openOsPermissionSettings("microphone");
    }
    return getOsPermissionStatus();
  }
  if (id === "screen") {
    await requestScreenRecordingAccess();
    return getOsPermissionStatus();
  }
  if (id === "accessibility" && process.platform === "darwin") {
    systemPreferences.isTrustedAccessibilityClient(true);
    return getOsPermissionStatus();
  }
  if (id === "computer") {
    await installComputerUseBrowser();
    return getOsPermissionStatus();
  }
  await openOsPermissionSettings(id);
  return getOsPermissionStatus();
}

async function openOsPermissionSettings(id) {
  if (!isKnownOsPermissionId(id)) {
    throw new Error("Unknown OS permission.");
  }
  if (id === "computer") {
    await shell.openExternal(computerUseBrowserDocsUrl);
    return { opened: true };
  }
  if (process.platform === "darwin") {
    return openMacOsPrivacySettings(id, (url) => shell.openExternal(url));
  }
  if (process.platform === "win32") {
    await shell.openExternal(getWindowsPrivacySettingsUrl(id));
    return { opened: true };
  }
  return { opened: false, message: "Open your system privacy settings manually." };
}

async function requestScreenRecordingAccess() {
  try {
    await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1, height: 1 },
      fetchWindowIcons: false,
    });
  } catch {
    // The status check below reports the meaningful permission state.
  }
  if (process.platform === "darwin" && getMediaAccessStatus("screen") !== "granted") {
    await openOsPermissionSettings("screen");
  }
}

function getMediaAccessStatus(mediaType) {
  try {
    return systemPreferences.getMediaAccessStatus(mediaType);
  } catch {
    return process.platform === "linux" ? "unsupported" : "unknown";
  }
}

function ensureOsControlAllowed() {
  // OS-level mouse/keyboard control only requires platform privacy grants on macOS.
  // Windows (and other platforms) drive nut-js without Screen Recording or Accessibility grants.
  if (process.platform !== "darwin") {
    return { ok: true };
  }
  const screenGranted = getMediaAccessStatus("screen") === "granted";
  const accessibilityGranted = getAccessibilityStatus() === "granted";
  if (screenGranted && accessibilityGranted) {
    return { ok: true };
  }
  const missing = [
    screenGranted ? "" : "Screen Recording",
    accessibilityGranted ? "" : "Accessibility Control",
  ].filter(Boolean);
  return {
    ok: false,
    message: `Grant ${missing.join(" and ")} in the permissions screen before controlling the computer.`,
  };
}

function getAccessibilityStatus() {
  if (process.platform !== "darwin") {
    return "unsupported";
  }
  return systemPreferences.isTrustedAccessibilityClient(false) ? "granted" : "not-determined";
}

async function getComputerUseBrowserStatus() {
  try {
    const { chromium } = await import("playwright");
    const executablePath = chromium.executablePath();
    return executablePath && existsSync(executablePath) ? "granted" : "not-determined";
  } catch {
    return "unknown";
  }
}

async function installComputerUseBrowser() {
  let cliPath;
  try {
    cliPath = require.resolve("playwright/cli.js");
  } catch {
    throw new Error("Playwright is not installed. Run `npm install` then retry.");
  }
  try {
    await execFileAsync(process.execPath, [cliPath, "install", "chromium"], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      timeout: 300_000,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (error) {
    const detail = error instanceof Error && error.message ? error.message : String(error);
    throw new Error(`Failed to install the automation browser: ${detail}`);
  }
}

async function loginOpenAI() {
  const redirectUri = createOpenAIRedirectUri();
  const verifier = createPkceVerifier();
  const challenge = createPkceChallenge(verifier);
  const state = randomBytes(24).toString("base64url");
  const callbackServer = await startOAuthCallbackServer({ state });
  const authUrl = new URL(openAIAuthConfig.authorizeUrl);
  authUrl.searchParams.set("client_id", openAIAuthConfig.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", openAIAuthConfig.scope);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("id_token_add_organizations", "true");
  authUrl.searchParams.set("codex_cli_simplified_flow", "true");
  authUrl.searchParams.set("originator", "ggcoder");

  try {
    await shell.openExternal(authUrl.toString());
    const callback = await callbackServer.waitForCallback;
    if (callback.error) {
      throw new Error(`OpenAI login failed: ${callback.error}`);
    }
    if (!callback.code) {
      throw new Error("OpenAI login did not return an authorization code.");
    }

    const credentials = await exchangeOpenAICode({
      code: callback.code,
      codeVerifier: verifier,
      redirectUri,
    });
    await saveOpenAICredentials(credentials);
    return credentials;
  } finally {
    callbackServer.close();
  }
}

function createOpenAIRedirectUri() {
  return `http://localhost:${openAIAuthConfig.redirectPort}${openAIAuthConfig.redirectPath}`;
}

function createPkceVerifier() {
  return randomBytes(48).toString("base64url");
}

function createPkceChallenge(verifier) {
  return createHash("sha256").update(verifier).digest("base64url");
}

async function startOAuthCallbackServer({ state }) {
  let server;
  let timeout;
  let resolveCallback;
  let rejectCallback;
  const waitForCallback = new Promise((resolve, reject) => {
    resolveCallback = resolve;
    rejectCallback = reject;
  });

  await new Promise((resolve, reject) => {
    server = http.createServer((request, response) => {
      try {
        const callback = parseOAuthCallbackRequest(request.url ?? "/");
        const responseBody = callback.error
          ? "<html><body><h1>OpenAI login failed</h1><p>You can close this tab.</p></body></html>"
          : "<html><body><h1>OpenAI login complete</h1><p>You can return to Leena.</p></body></html>";
        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Length": Buffer.byteLength(responseBody),
          Connection: "close",
        });
        response.end(responseBody);
        if (callback.state !== state) {
          rejectCallback(new Error("OpenAI login state mismatch."));
          return;
        }
        resolveCallback(callback);
      } catch (error) {
        response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Invalid OpenAI login callback.");
        rejectCallback(error);
      }
    });

    server.once("error", reject);
    server.listen(openAIAuthConfig.redirectPort, "127.0.0.1", () => {
      server.off("error", reject);
      timeout = setTimeout(() => {
        rejectCallback(new Error("OpenAI login callback timed out."));
        server.close();
      }, 120_000);
      resolve();
    });
  });

  return {
    waitForCallback,
    close() {
      clearTimeout(timeout);
      server?.close();
    },
  };
}

function parseOAuthCallbackRequest(rawUrl) {
  const url = new URL(rawUrl, createOpenAIRedirectUri());
  if (url.pathname !== openAIAuthConfig.redirectPath) {
    throw new Error(`Unexpected OpenAI OAuth callback path: ${url.pathname}`);
  }

  return {
    code: url.searchParams.get("code") ?? undefined,
    state: url.searchParams.get("state") ?? undefined,
    error: url.searchParams.get("error") ?? undefined,
  };
}

async function exchangeOpenAICode({ code, codeVerifier, redirectUri }) {
  return tokenJsonToCredentials(
    await postOpenAIForm(
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: openAIAuthConfig.clientId,
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
      "OpenAI token exchange",
    ),
  );
}

async function refreshOpenAICredentials(credentials) {
  const refreshed = tokenJsonToCredentials(
    await postOpenAIForm(
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credentials.refreshToken,
        client_id: openAIAuthConfig.clientId,
      }),
      "OpenAI token refresh",
    ),
    credentials.refreshToken,
  );
  await saveOpenAICredentials(refreshed);
  return refreshed;
}

async function postOpenAIForm(body, label) {
  const response = await fetch(openAIAuthConfig.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return parseJsonResponse(response, label);
}

async function parseJsonResponse(response, label) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${label} failed (${response.status}): ${String(text).slice(0, 200)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
}

async function saveOpenAIApiKey(payload = {}) {
  const apiKey = typeof payload.apiKey === "string" ? payload.apiKey.trim() : "";
  if (!apiKey) {
    throw new Error("OpenAI API key is required.");
  }
  const credentials = {
    accessToken: apiKey,
    refreshToken: null,
    expiresAt: API_KEY_EXPIRES_AT,
  };
  await saveOpenAICredentials(credentials);
  return credentials;
}

async function getOpenAIAuthType() {
  const credentials = await loadOpenAICredentials();
  if (!credentials) {
    return "none";
  }
  return isOpenAIApiKeyCredentials(credentials) ? "api-key" : "oauth";
}

function createRealtimeProvider(credentials) {
  const provider = getRegistry().getDefault(REALTIME);
  if (!provider) {
    return null;
  }
  if (provider.name === "openai") {
    return createOpenAIProvider({
      apiKey: credentials.accessToken,
      fetchImpl: fetch,
    });
  }
  return provider;
}

function getProviderDefaultModel(provider, capability, requestedModel) {
  if (typeof requestedModel === "string" && requestedModel.trim()) {
    return requestedModel;
  }
  const [defaultModel] = Array.isArray(provider.models?.[capability])
    ? provider.models[capability]
    : [];
  return defaultModel;
}

function createNoRealtimeProviderResponse() {
  return {
    error: "NO_REALTIME_PROVIDER",
    message: "Configure an OpenAI API key to use voice mode",
  };
}

async function getFreshOpenAICredentials() {
  const credentials = await loadOpenAICredentials();
  if (!credentials) {
    return null;
  }
  if (isOpenAIApiKeyCredentials(credentials)) {
    return credentials;
  }
  const refreshMarginMs = 5 * 60 * 1000;
  if (credentials.expiresAt - refreshMarginMs > Date.now()) {
    return credentials;
  }
  return refreshOpenAICredentials(credentials);
}

async function loadOpenAICredentials() {
  try {
    const raw = await fs.readFile(credentialsPath(), "utf8");
    const payload = JSON.parse(raw);
    const serialized = typeof payload.data === "string" ? payload.data : undefined;
    if (!serialized) {
      return null;
    }
    const json = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(Buffer.from(serialized, "base64"))
      : Buffer.from(serialized, "base64").toString("utf8");
    return parseCredentials(JSON.parse(json));
  } catch {
    return null;
  }
}

async function saveOpenAICredentials(credentials) {
  if (!safeStorage.isEncryptionAvailable()) {
    await writeDiagnosticLog("openai.credentials.encryption_unavailable", {
      backend: safeStorage.getSelectedStorageBackend?.() ?? "unknown",
    });
    throw new Error(
      "Secure credential storage is unavailable; refusing to store OpenAI tokens in cleartext.",
    );
  }
  await fs.mkdir(path.dirname(credentialsPath()), { recursive: true });
  const json = JSON.stringify(credentials);
  const data = safeStorage.encryptString(json).toString("base64");
  await fs.writeFile(credentialsPath(), JSON.stringify({ data }, null, 2), { mode: 0o600 });
}

async function clearOpenAICredentials() {
  await fs.rm(credentialsPath(), { force: true });
}

function credentialsPath() {
  return path.join(app.getPath("userData"), "openai-credentials.json");
}

function tokenJsonToCredentials(response, fallbackRefreshToken) {
  if (!isRecord(response)) {
    throw new Error("OpenAI token response was not an object.");
  }
  if (typeof response.access_token !== "string") {
    throw new Error("OpenAI token response did not include an access token.");
  }
  const refreshToken = response.refresh_token ?? fallbackRefreshToken;
  if (typeof refreshToken !== "string") {
    throw new Error("OpenAI token response did not include a refresh token.");
  }
  if (typeof response.expires_in !== "number") {
    throw new Error("OpenAI token response did not include expires_in.");
  }
  const credentials = {
    accessToken: response.access_token,
    refreshToken,
    expiresAt: Date.now() + response.expires_in * 1000,
  };
  const accountId = getAccountId(response.access_token);
  return accountId ? { ...credentials, accountId } : credentials;
}

function parseCredentials(value) {
  if (
    !isRecord(value) ||
    typeof value.accessToken !== "string" ||
    (typeof value.refreshToken !== "string" && value.refreshToken !== null) ||
    typeof value.expiresAt !== "number"
  ) {
    return null;
  }
  return {
    accessToken: value.accessToken,
    refreshToken: value.refreshToken,
    expiresAt: value.expiresAt,
    ...(typeof value.accountId === "string" ? { accountId: value.accountId } : {}),
  };
}

function isOpenAIApiKeyCredentials(credentials) {
  return credentials.refreshToken === null;
}

function credentialsToStatus(credentials) {
  return {
    connected: true,
    expiresAt: credentials.expiresAt,
    accountId: credentials.accountId ?? null,
    authType: isOpenAIApiKeyCredentials(credentials) ? "api-key" : "oauth",
  };
}

function getAccountId(accessToken) {
  const payload = decodeJwt(accessToken);
  const auth = isRecord(payload?.["https://api.openai.com/auth"])
    ? payload["https://api.openai.com/auth"]
    : null;
  return typeof auth?.chatgpt_account_id === "string" ? auth.chatgpt_account_id : undefined;
}

function decodeJwt(token) {
  try {
    const parts = token.split(".");
    const payload = parts[1];
    if (parts.length !== 3 || !payload) {
      return null;
    }
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
