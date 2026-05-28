import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("brah", {
  getOpenAIStatus: () => ipcRenderer.invoke("openai:get-status"),
  loginOpenAI: () => ipcRenderer.invoke("openai:login"),
  logoutOpenAI: () => ipcRenderer.invoke("openai:logout"),
  createRealtimeSecret: (options) => ipcRenderer.invoke("openai:create-realtime-secret", options),
  getOsPermissions: () => ipcRenderer.invoke("permissions:get-status"),
  requestOsPermission: (id) => ipcRenderer.invoke("permissions:request", id),
  openOsPermissionSettings: (id) => ipcRenderer.invoke("permissions:open-settings", id),
  getDiagnosticLogPath: () => ipcRenderer.invoke("diagnostics:get-log-path"),
  openDiagnosticLog: () => ipcRenderer.invoke("diagnostics:open-log"),
  writeDiagnosticLog: (event, details) => ipcRenderer.invoke("diagnostics:write", event, details),
  getPrivacyDiagnostics: () => ipcRenderer.invoke("diagnostics:privacy"),
  getRealtimeTools: () => ipcRenderer.invoke("tools:get-definitions"),
  executeRealtimeTool: (name, args) => ipcRenderer.invoke("tools:execute", name, args),
});
