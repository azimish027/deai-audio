const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("deai", {
  getVersion: () => ipcRenderer.invoke("app:get-version"),
  getBackendStatus: () => ipcRenderer.invoke("app:get-backend-status"),
});
