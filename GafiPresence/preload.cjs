const { contextBridge, ipcRenderer } = require("electron");

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("gafiPresence", {
  getState: () => ipcRenderer.invoke("presence:get-state"),
  saveSettings: (settings) => ipcRenderer.invoke("presence:save-settings", settings),
  connect: () => ipcRenderer.invoke("presence:connect"),
  disconnect: () => ipcRenderer.invoke("presence:disconnect"),
  apply: (activity) => ipcRenderer.invoke("presence:apply", activity),
  clear: () => ipcRenderer.invoke("presence:clear"),
  pickImage: (kind) => ipcRenderer.invoke("presence:pick-image", kind),
  loadImage: (imagePath) => ipcRenderer.invoke("presence:load-image", imagePath),
  savePreset: (preset) => ipcRenderer.invoke("presence:save-preset", preset),
  deletePreset: (id) => ipcRenderer.invoke("presence:delete-preset", id),
  exportConfig: () => ipcRenderer.invoke("presence:export"),
  importConfig: () => ipcRenderer.invoke("presence:import"),
  openDeveloperPortal: () => ipcRenderer.invoke("presence:open-developer-portal"),
  onInitial: (callback) => subscribe("presence:initial", callback),
  onStatus: (callback) => subscribe("presence:status", callback)
});
