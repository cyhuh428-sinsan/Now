const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nownoteDesktop", {
  platform: process.platform,
  desktopShell: "electron",
  storage: {
    info: () => ipcRenderer.invoke("nownote:desktop-store-info"),
    read: (key) => ipcRenderer.invoke("nownote:desktop-store-read", key),
    write: (key, value) => ipcRenderer.invoke("nownote:desktop-store-write", key, value),
  },
});
