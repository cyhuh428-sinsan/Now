const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nownoteDesktop", {
  platform: process.platform,
  desktopShell: "electron",
  openWorkspace: workspace=>ipcRenderer.invoke('nownote:open-workspace',workspace),
  openDocumentFile: (filePath) => ipcRenderer.invoke("nownote:open-document-file", filePath),
  storage: {
    history:{
      current:account=>ipcRenderer.invoke('nownote:history-current',account),
      open:()=>ipcRenderer.invoke('nownote:history-open'),
      full:request=>ipcRenderer.invoke('nownote:history-full',request),
      note:request=>ipcRenderer.invoke('nownote:history-note',request),
    },
    original:{
      read:key=>ipcRenderer.invoke('nownote:desktop-original-read',key),
      cas:(key,value,expected)=>ipcRenderer.invoke('nownote:desktop-original-write',key,value,expected),
    },
    info: () => ipcRenderer.invoke("nownote:desktop-store-info"),
    read: (key) => ipcRenderer.invoke("nownote:desktop-store-read", key),
    readPath: (key, segments) => ipcRenderer.invoke('nownote:desktop-store-read-path', key, segments),
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
