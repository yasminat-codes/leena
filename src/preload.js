import { contextBridge, ipcRenderer } from "electron";

function onIpc(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return listener;
}

function offIpc(channel, listener) {
  ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("leena", {
  getOpenAIStatus: () => ipcRenderer.invoke("openai:get-status"),
  loginOpenAI: () => ipcRenderer.invoke("openai:login"),
  saveApiKey: (apiKey) => ipcRenderer.invoke("openai:save-api-key", { apiKey }),
  getAuthType: () => ipcRenderer.invoke("openai:get-auth-type"),
  logoutOpenAI: () => ipcRenderer.invoke("openai:logout"),
  createRealtimeSession: (options) => ipcRenderer.invoke("realtime:create-session", options),
  createRealtimeSecret: (options) => ipcRenderer.invoke("openai:create-realtime-secret", options),
  getAgentProfile: () => ipcRenderer.invoke("agent:get-profile"),
  setAgentProfile: (profile) => ipcRenderer.invoke("agent:set-profile", profile),
  getMicrophoneDevice: () => ipcRenderer.invoke("audio:get-microphone"),
  setMicrophoneDevice: (deviceId) => ipcRenderer.invoke("audio:set-microphone", deviceId),
  getSetting: (key, defaultValue) => ipcRenderer.invoke("settings:get", key, defaultValue),
  setSetting: (key, value) => ipcRenderer.invoke("settings:set", key, value),
  getAllSettings: () => ipcRenderer.invoke("settings:get-all"),
  getOsPermissions: () => ipcRenderer.invoke("permissions:get-status"),
  requestOsPermission: (id) => ipcRenderer.invoke("permissions:request", id),
  openOsPermissionSettings: (id) => ipcRenderer.invoke("permissions:open-settings", id),
  getDiagnosticLogPath: () => ipcRenderer.invoke("diagnostics:get-log-path"),
  openDiagnosticLog: () => ipcRenderer.invoke("diagnostics:open-log"),
  writeDiagnosticLog: (event, details) => ipcRenderer.invoke("diagnostics:write", event, details),
  getPrivacyDiagnostics: () => ipcRenderer.invoke("diagnostics:privacy"),
  getRealtimeTools: () => ipcRenderer.invoke("tools:get-definitions"),
  executeRealtimeTool: (name, args) => ipcRenderer.invoke("tools:execute", name, args),
  cancelComputerUse: () => ipcRenderer.invoke("tools:cancel-computer-use"),
  getPlannerTasks: () => ipcRenderer.invoke("planner:list-tasks"),
  getCalendarItems: () => ipcRenderer.invoke("planner:list-calendar"),
  deletePlannerTasks: (ids) => ipcRenderer.invoke("planner:delete-tasks", ids),
  completePlannerTasks: (ids) => ipcRenderer.invoke("planner:complete-tasks", ids),
  deleteCalendarItems: (ids) => ipcRenderer.invoke("planner:delete-calendar-items", ids),
  listScreenshots: () => ipcRenderer.invoke("screenshots:list"),
  revealScreenshot: (name) => ipcRenderer.invoke("screenshots:reveal", name),
  deleteScreenshots: (names) => ipcRenderer.invoke("screenshots:delete", names),
  getActivity: (kind) => ipcRenderer.invoke("activity:list", kind),
  setWindowMode: (mode) => ipcRenderer.invoke("window:set-mode", mode),
  setWindowFocusable: (focusable) => ipcRenderer.invoke("window:set-focusable", focusable),
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  setTrayState: (state) => ipcRenderer.invoke("tray:set-state", state),
  getTrayState: () => ipcRenderer.invoke("tray:get-state"),
  quitApp: () => ipcRenderer.invoke("app:quit"),
  isDevelopment: () => ipcRenderer.invoke("app:is-development"),
  onDataChanged: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("data:changed", listener);
    return listener;
  },
  offDataChanged: (listener) => {
    ipcRenderer.removeListener("data:changed", listener);
  },
  onLeenaError: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("leena:error", listener);
    return listener;
  },
  offLeenaError: (listener) => {
    ipcRenderer.removeListener("leena:error", listener);
  },
  onRealtimeStateChanged: (callback) => onIpc("realtime:state-changed", callback),
  offRealtimeStateChanged: (listener) => offIpc("realtime:state-changed", listener),
  onRealtimeToolExecuting: (callback) => onIpc("realtime:tool-executing", callback),
  offRealtimeToolExecuting: (listener) => offIpc("realtime:tool-executing", listener),
  onRealtimeResponseComplete: (callback) => onIpc("realtime:response-complete", callback),
  offRealtimeResponseComplete: (listener) => offIpc("realtime:response-complete", listener),
  onRealtimeError: (callback) => onIpc("realtime:error", callback),
  offRealtimeError: (listener) => offIpc("realtime:error", listener),
  onTrayAction: (callback) => onIpc("tray:action", callback),
  offTrayAction: (listener) => offIpc("tray:action", listener),
  onTrayStateChanged: (callback) => onIpc("tray:state-changed", callback),
  offTrayStateChanged: (listener) => offIpc("tray:state-changed", listener),
});
