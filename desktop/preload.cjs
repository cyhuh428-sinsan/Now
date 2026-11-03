const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nownoteDesktop", {
  platform: process.platform,
  desktopShell: "electron",
  openWorkspace: (workspace,navigation=null)=>ipcRenderer.invoke('nownote:open-workspace',workspace,navigation),
  takeWorkspaceNavigation:()=>ipcRenderer.invoke('nownote:take-workspace-navigation'),
  onWorkspaceNavigation:listener=>{
    if(typeof listener!=='function')throw Error('화면 이동 수신 함수를 확인하세요.');
    const receive=()=>listener();ipcRenderer.on('nownote:workspace-navigation',receive);
    return ()=>ipcRenderer.removeListener('nownote:workspace-navigation',receive);
  },
  openDocumentFile: (filePath) => ipcRenderer.invoke("nownote:open-document-file", filePath),
  storage: {
    onChange:listener=>{
      if(typeof listener!=='function')throw Error('저장 변경 수신 함수를 확인하세요.');
      const receive=(_event,value)=>{
        if(value&&Object.keys(value).sort().join(',')==='key,schema_version'&&value.schema_version===1
          &&['nownote.history.v1','nownote.web.v1','nownote.web.settings.v1','nownote.library.v1'].includes(value.key))listener(value.key);
      };
      ipcRenderer.on('nownote:storage-changed',receive);return ()=>ipcRenderer.removeListener('nownote:storage-changed',receive);
    },
    history:{
      select:request=>ipcRenderer.invoke('nownote:history-select',request),
      current:account=>ipcRenderer.invoke('nownote:history-current',account),
      page:request=>ipcRenderer.invoke('nownote:history-page',request),
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
    readDirectory: (key, segments) => ipcRenderer.invoke('nownote:desktop-store-read-path', key, segments, true),
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
