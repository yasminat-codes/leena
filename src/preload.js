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
  identity: {
    listPersonas: () => ipcRenderer.invoke("identity:list-personas"),
    switchPersona: (id) => ipcRenderer.invoke("identity:switch-persona", { personaId: id }),
    createPersona: (data) => ipcRenderer.invoke("identity:create-persona", data),
    updatePersona: (id, changes) => ipcRenderer.invoke("identity:update-persona", { id, changes }),
    deletePersona: (id) => ipcRenderer.invoke("identity:delete-persona", { id }),
  },
  memory: {
    remember: (text, metadata) => ipcRenderer.invoke("memory:remember", { text, metadata }),
    recall: (query, limit) => ipcRenderer.invoke("memory:recall", { query, limit }),
    getConversation: (conversationId) =>
      ipcRenderer.invoke("memory:get-conversation", { conversationId }),
    consolidate: () => ipcRenderer.invoke("memory:consolidate"),
    stats: () => ipcRenderer.invoke("memory:stats"),
  },
  getMicrophoneDevice: () => ipcRenderer.invoke("audio:get-microphone"),
  setMicrophoneDevice: (deviceId) => ipcRenderer.invoke("audio:set-microphone", deviceId),
  getSetting: (key, defaultValue) => ipcRenderer.invoke("settings:get", key, defaultValue),
  setSetting: (key, value) => ipcRenderer.invoke("settings:set", key, value),
  getAllSettings: () => ipcRenderer.invoke("settings:get-all"),
  completeOnboarding: () => ipcRenderer.invoke("onboarding:complete"),
  resetOnboarding: () => ipcRenderer.invoke("settings:reset-onboarding"),
  setLaunchOnLogin: (enabled) => ipcRenderer.invoke("settings:set-launch-on-login", { enabled }),
  getLaunchOnLogin: () => ipcRenderer.invoke("settings:get-launch-on-login"),
  setHotkey: (accelerator) => ipcRenderer.invoke("settings:set-hotkey", { accelerator }),
  getHotkey: () => ipcRenderer.invoke("settings:get-hotkey"),
  providers: {
    list: () => ipcRenderer.invoke("providers:list"),
    getConfig: (providerId) => ipcRenderer.invoke("providers:get-config", providerId),
    setConfig: (providerId, config) =>
      ipcRenderer.invoke("providers:set-config", providerId, config),
    testConnection: (providerId) => ipcRenderer.invoke("providers:test-connection", providerId),
    getModels: (providerId, capability) =>
      ipcRenderer.invoke("providers:get-models", providerId, capability),
  },
  ollama: {
    pullModel: (model) => ipcRenderer.invoke("ollama:pull-model", { model }),
    onPullProgress: (callback) => onIpc("ollama:pull-progress", callback),
    offPullProgress: (listener) => offIpc("ollama:pull-progress", listener),
  },
  mcp: {
    listServers: () => ipcRenderer.invoke("mcp:list-servers"),
    addServer: (config) => ipcRenderer.invoke("mcp:add-server", config),
    removeServer: (id) => ipcRenderer.invoke("mcp:remove-server", id),
    updateServer: (id, updates) => ipcRenderer.invoke("mcp:update-server", id, updates),
    connect: (id) => ipcRenderer.invoke("mcp:connect", id),
    disconnect: (id) => ipcRenderer.invoke("mcp:disconnect", id),
    listTools: (id) => ipcRenderer.invoke("mcp:list-tools", id),
    testConnection: (config) => ipcRenderer.invoke("mcp:test-connection", config),
    getStatus: () => ipcRenderer.invoke("mcp:get-status"),
    onStatusChanged: (callback) => onIpc("mcp:status-changed", callback),
    offStatusChanged: (listener) => offIpc("mcp:status-changed", listener),
  },
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
  getWindowState: () => ipcRenderer.invoke("window:get-state"),
  setWindowState: (bounds) => ipcRenderer.invoke("window:set-state", bounds),
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
  onHotkeyActivated: (callback) => onIpc("hotkey:activated", callback),
  offHotkeyActivated: (listener) => offIpc("hotkey:activated", listener),
  onTrayAction: (callback) => onIpc("tray:action", callback),
  offTrayAction: (listener) => offIpc("tray:action", listener),
  onTrayStateChanged: (callback) => onIpc("tray:state-changed", callback),
  offTrayStateChanged: (listener) => offIpc("tray:state-changed", listener),
});
