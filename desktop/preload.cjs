const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nownoteDesktop", {
  platform: process.platform,
  desktopShell: "electron",
  storage: {
    info: () => ipcRenderer.invoke("nownote:desktop-store-info"),
    read: (key) => ipcRenderer.invoke("nownote:desktop-store-read", key),
    write: (key, value) => ipcRenderer.invoke("nownote:desktop-store-write", key, value),
    writeSync: (key, value) => ipcRenderer.sendSync("nownote:desktop-store-write-sync", key, value),
  },
  vault: {
    choose: () => ipcRenderer.invoke("nownote:vault-choose"),
    status: () => ipcRenderer.invoke("nownote:vault-status"),
    preview: ({ direction }) => ipcRenderer.invoke("nownote:vault-preview", { direction }),
    apply: ({ planId, selections }) => ipcRenderer.invoke("nownote:vault-apply", { planId, selections }),
    recoveryStatus: () => ipcRenderer.invoke("nownote:vault-recovery-status"),
    confirmRecovery: ({ operationId }) => ipcRenderer.invoke("nownote:vault-confirm-recovery", { operationId }),
  },
});
