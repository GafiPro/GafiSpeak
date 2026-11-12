const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gafiSpeakManager", {
  getState: () => ipcRenderer.invoke("manager:get-state"),
  start: () => ipcRenderer.invoke("manager:start"),
  stop: () => ipcRenderer.invoke("manager:stop"),
  clearLogs: () => ipcRenderer.invoke("manager:clear-logs"),
  copyLogs: () => ipcRenderer.invoke("manager:copy-logs"),
  onInitialState: (callback) => ipcRenderer.on("manager:initial-state", (_event, value) => callback(value)),
  onLog: (callback) => ipcRenderer.on("manager:log", (_event, value) => callback(value)),
  onStatus: (callback) => ipcRenderer.on("manager:status", (_event, value) => callback(value))
});
