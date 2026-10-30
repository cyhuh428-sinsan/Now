/* Isolated QA host only. Never loads production main or the user's profile. */
const { app,BrowserWindow,ipcMain,session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const config = JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const qaRoot = path.resolve('D:/tmp/now-240-e4b2');
if (!path.resolve(config.profile).startsWith(qaRoot + path.sep)) throw Error('profile boundary');
app.setPath('userData',config.profile);
app.disableHardwareAcceleration();
let failSettings = config.phase === 1;
const storeFile = path.join(config.profile,'nownote-desktop-store.json');
const { readStoreFile,updateStoreFile,compareAndSetStoreValue } = require(path.join(config.root,'desktop/store-file.cjs'));
const source = fs.readFileSync(path.join(config.root,'desktop/main.cjs'),'utf8');
const start = source.indexOf('function updateRendererStoreValue('),end = source.indexOf('function registerVaultHandlers(',start);
const keys = new Set(['nownote.web.v1','nownote.web.settings.v1','nownote.history.v1','nownote.library.v1']);
const box = { compareAndSetStoreValue,updateStoreFile,desktopStorePath:()=>storeFile,
  assertRendererStoreKey:key => { if (!keys.has(key)) throw Error('key boundary'); } };
vm.runInNewContext(source.slice(start,end)+'\nglobalThis.write=updateRendererStoreValue;',box);
const write = (key,value,options) => {
  if (failSettings && key === 'nownote.web.settings.v1' && options && Object.hasOwn(options,'expectedValue')) { failSettings = false; throw Error('synthetic CAS quota failure'); }
  const result = box.write(key,value,options); return {ok:true,updatedAt:result.store.updatedAt};
};
ipcMain.handle('nownote:desktop-store-read',(_event,key)=>{if(!keys.has(key))throw Error('key boundary');return readStoreFile(storeFile).store.values[key] ?? null;});
ipcMain.handle('nownote:desktop-store-write',(_event,key,value,options)=>write(key,value,options));
ipcMain.on('nownote:desktop-store-write-sync',(event,key,value,options)=>{try{event.returnValue=write(key,value,options);}catch(error){event.returnValue={ok:false,error:error.message};}});
ipcMain.handle('nownote:desktop-store-info',()=>({path:storeFile,version:1,keys:Object.keys(readStoreFile(storeFile).store.values)}));
ipcMain.handle('nownote:vault-status',()=>({connected:false}));
ipcMain.handle('nownote:vault-recovery-status',()=>({pending:false}));
app.whenReady().then(async()=>{
  session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(details,done)=>{
    const url = new URL(details.url); done({cancel:!(['localhost.','127.0.0.1'].includes(url.hostname) && url.port === '8750')});
  });
  const window = new BrowserWindow({show:false,width:1280,height:900,webPreferences:{contextIsolation:true,nodeIntegration:false,
    ...(config.mode === 'desktop' ? {preload:path.join(config.root,'desktop/preload.cjs')} : {})}});
  try {
    if(config.mode === 'web') await window.loadURL('http://localhost.:8750/index.html');
    else await window.loadFile(path.join(config.root,'desktop/app/index.html'));
    for(let i=0;i<240;i++) {
      if(await window.webContents.executeJavaScript('typeof noteHistory !== "undefined" && Boolean(noteHistory && noteProtection)' + (config.mode === 'web' ? ' && noteHistory.suspended()' : '')))break;
      await new Promise(r=>setTimeout(r,50)); if(i===239)throw Error('app initialization timeout');
    }
    await window.webContents.executeJavaScript('globalThis.__PROTECTION_QA__='+JSON.stringify(config));
    const fixture = fs.readFileSync(path.join(config.root,'web/scripts/note_protection_client_fixture.js'),'utf8');
    const result = await window.webContents.executeJavaScript(fixture);
    fs.writeFileSync(config.result,JSON.stringify(result));
    console.log('E4B2_CLIENT '+JSON.stringify(result));
    window.destroy(); app.exit(0);
  } catch(error) { console.error('E4B2_CLIENT_FAIL '+error.message); window.destroy(); app.exit(1); }
});
setTimeout(()=>{console.error('E4B2_CLIENT_FAIL bounded timeout');app.exit(1);},90000).unref();
