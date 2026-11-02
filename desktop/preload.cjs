const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nownoteDesktop", {
  platform: process.platform,
  desktopShell: "electron",
  openDocumentFile: (filePath) => ipcRenderer.invoke("nownote:open-document-file", filePath),
  storage: {
    info: () => ipcRenderer.invoke("nownote:desktop-store-info"),
    read: (key) => ipcRenderer.invoke("nownote:desktop-store-read", key),
    write: (key, value, options) => ipcRenderer.invoke("nownote:desktop-store-write", key, value, options),
    writeSync: (key, value, options) => ipcRenderer.sendSync("nownote:desktop-store-write-sync", key, value, options),
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
