/* Real HTTP QA host. No static server, response replacement, synthetic API, or production profile. */
const {app,BrowserWindow,ipcMain,session}=require('electron');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const config=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const qaRoot=path.resolve('D:/tmp/now-240-e4b3a-http');
if(!path.resolve(config.profile).startsWith(qaRoot+path.sep))throw Error('profile_boundary');
app.setPath('userData',config.profile);app.disableHardwareAcceleration();
const credentials=JSON.parse(fs.readFileSync(config.secrets,'utf8'));
const tokenLine=fs.readFileSync(config.envFile,'utf8').split(/\r?\n/).find(v=>v.startsWith('NOW_QA_API_TOKEN='));
let apiToken=tokenLine?.slice('NOW_QA_API_TOKEN='.length).trim();
if(apiToken?.startsWith('"')&&apiToken.endsWith('"'))apiToken=apiToken.slice(1,-1);
if(!apiToken)throw Error('qa_api_token_missing');
const storeFile=path.join(config.profile,'nownote-desktop-store.json');
const {readStoreFile,updateStoreFile,compareAndSetStoreValue}=require(path.join(config.root,'desktop/store-file.cjs'));
const source=fs.readFileSync(path.join(config.root,'desktop/main.cjs'),'utf8');
const from=source.indexOf('function updateRendererStoreValue('),to=source.indexOf('function registerVaultHandlers(',from);
const keys=new Set(['nownote.web.v1','nownote.web.settings.v1','nownote.history.v1','nownote.library.v1']);
const box={compareAndSetStoreValue,updateStoreFile,desktopStorePath:()=>storeFile,assertRendererStoreKey:k=>{if(!keys.has(k))throw Error('store_key');}};
vm.runInNewContext(source.slice(from,to)+'\nglobalThis.write=updateRendererStoreValue;',box);
let failData=config.phase===1;
let failEditor=config.editorRestart&&config.phase===2;
let failImport=config.importRestart&&config.phase===2;
function hasProtectedTarget(tree,owner,local){
  const pending=Array.isArray(tree)?[...tree]:[];
  while(pending.length){
    const node=pending.pop(),scope=node?.protection_record?.scope;
    if(scope?.owner===owner&&scope.local_id===local)return true;
    if(Array.isArray(node?.children))pending.push(...node.children);
  }
  return false;
}
function write(key,value,options){
  if(failData&&key==='nownote.web.v1'&&options&&Object.hasOwn(options,'expectedValue')&&hasProtectedTarget(value.tree,credentials.a.owner,'qa-http-'+config.run+'-target')){failData=false;persistEvidence({mode:config.mode,phase:config.phase,localFailure:'own_data_CAS_once'});throw Error('qa_local_CAS_failure');}
  if(failEditor&&key==='nownote.history.v1'&&options?.expectedValue){
    const target='qa-http-'+config.run+'-target',markers=Object.values(value.protection_operations||{}).filter(m=>m.scope.local_id===target);
    const changed=Object.entries(value.contexts||{}).some(([k,c])=>{const before=options.expectedValue.contexts?.[k]?.notes?.[target]?.protection_record,after=c.notes?.[target]?.protection_record;return before&&after&&before.operation_id!==after.operation_id;});
    if(markers.length===4&&markers.some(m=>m.phase==='applying')&&changed){failEditor=false;persistEvidence({mode:config.mode,phase:config.phase,localFailure:'own_MW_journal_CAS_once'});throw Error('qa_MW_journal_CAS_failure');}
  }
  if(failImport&&key==='nownote.history.v1'&&options?.expectedValue){
    const target='qa-http-'+config.run+'-target',markers=Object.values(value.protection_operations||{}).filter(m=>m.scope.local_id===target);
    const changed=Object.entries(value.contexts||{}).some(([k,c])=>{const before=options.expectedValue.contexts?.[k]?.notes?.[target]?.protection_record,after=c.notes?.[target]?.protection_record;return before&&after&&before.operation_id!==after.operation_id;});
    if(markers.length===5&&markers.some(m=>m.phase==='applying')&&changed){failImport=false;persistEvidence({mode:config.mode,phase:config.phase,localFailure:'own_MI_journal_CAS_once'});throw Error('qa_MI_journal_CAS_failure');}
  }
  const r=box.write(key,value,options);return {ok:true,updatedAt:r.store.updatedAt};
}
ipcMain.handle('nownote:desktop-store-read',(_e,k)=>{if(!keys.has(k))throw Error('store_key');return readStoreFile(storeFile).store.values[k]??null;});
ipcMain.handle('nownote:desktop-store-write',(_e,k,v,o)=>write(k,v,o));
ipcMain.on('nownote:desktop-store-write-sync',(e,k,v,o)=>{try{e.returnValue=write(k,v,o);}catch{e.returnValue={ok:false,error:'qa_local_CAS_failure'};}});
ipcMain.handle('nownote:desktop-store-info',()=>({path:storeFile,version:1,keys:Object.keys(readStoreFile(storeFile).store.values)}));
ipcMain.handle('nownote:vault-status',()=>({connected:false}));ipcMain.handle('nownote:vault-recovery-status',()=>({pending:false}));
const persistEvidence=evidence=>{const m=JSON.parse(fs.readFileSync(config.manifestFile,'utf8'));m.clientEvidence ||= [];m.clientEvidence.push(evidence);fs.writeFileSync(config.manifestFile,JSON.stringify(m,null,2));};
let blockQaApi=false;
app.whenReady().then(async()=>{
  const proxy=await session.defaultSession.resolveProxy('http://127.0.0.1:8750');
  persistEvidence({mode:config.mode,phase:config.phase,proxyDirect:proxy==='DIRECT'});
  session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(d,done)=>{const u=new URL(d.url);done({cancel:blockQaApi||!(['localhost.','127.0.0.1'].includes(u.hostname)&&u.port==='8750')});});
  session.defaultSession.webRequest.onCompleted({urls:['http://*/*','https://*/*']},d=>{const u=new URL(d.url);if(u.pathname.startsWith('/api/'))persistEvidence({mode:config.mode,phase:config.phase,method:d.method,path:u.pathname,status:d.statusCode});});
  session.defaultSession.webRequest.onErrorOccurred({urls:['http://*/*','https://*/*']},d=>{const u=new URL(d.url);if(['localhost.','127.0.0.1'].includes(u.hostname)&&u.port==='8750')persistEvidence({mode:config.mode,phase:config.phase,method:d.method,path:u.pathname,error:/^net::ERR_[A-Z_]+$/.test(d.error)?d.error:'network_error'});});
  const window=new BrowserWindow({show:false,width:1280,height:900,webPreferences:{contextIsolation:true,nodeIntegration:false,...(config.mode==='desktop'?{preload:path.join(config.root,'desktop/preload.cjs')}:{})}});
  window.webContents.on('console-message',(...args)=>{
    const message=args.find(v=>typeof v==='string'&&v.startsWith('HTTP_QA_EVENT ')) || args[1]?.message;
    if(typeof message!=='string'||!message.startsWith('HTTP_QA_EVENT '))return;
    try{const event=JSON.parse(message.slice(14));const allowed=['stage','owner','local_id','operation_id','local_operation_id','phase','server_instance_id','code'];if(Object.keys(event).some(k=>!allowed.includes(k)))return;persistEvidence({mode:config.mode,phase:config.phase,event});
      if(config.offlineDraft&&config.phase===8&&event.stage==='offline_draft_start'&&event.owner===credentials.a.owner&&event.local_id==='qa-http-'+config.run+'-target'){
        blockQaApi=true;void window.webContents.executeJavaScript('globalThis.__HTTP_QA_OFFLINE_ACK__=true');
      }
      if(event.stage==='related_create_ready'&&config.relatedOnly || event.stage==='editor_ready'&&config.editorWrite || ['import_ready','comparison_ready'].includes(event.stage)&&config.importWrite)void(async()=>{
        for(const [size,width,height] of [['desktop',1280,900],['mobile',390,844]]){
          window.setContentSize(width,height);
          await window.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
          const name=(event.stage==='related_create_ready'?'related-create':event.stage==='comparison_ready'?'comparison':event.stage==='import_ready'?'import':'editor')+'-'+config.run+'-'+config.mode+'-'+size+'.png';
          fs.writeFileSync(path.join(path.dirname(config.manifestFile),name),(await window.webContents.capturePage()).toPNG());
          persistEvidence({mode:config.mode,phase:config.phase,screenshot:name});
        }
        window.setContentSize(1280,900);await window.webContents.executeJavaScript('globalThis.__HTTP_CAPTURE_DONE__=true');
      })().catch(()=>{void window.webContents.executeJavaScript('globalThis.__HTTP_CAPTURE_DONE__=false');});
    }catch{}
  });
  try {
    if(config.mode==='web')await window.loadURL('http://localhost.:8750/');else await window.loadFile(path.join(config.root,'desktop/app/index.html'));
    for(let i=0;i<240;i++){if(await window.webContents.executeJavaScript('typeof noteHistory!=="undefined"&&Boolean(noteHistory&&noteProtection)'))break;await new Promise(r=>setTimeout(r,50));if(i===239)throw Error('app_init_timeout');}
    await window.webContents.executeJavaScript('globalThis.__HTTP_QA__='+JSON.stringify({...config,credentials,apiToken}));
    const result=await window.webContents.executeJavaScript(fs.readFileSync(path.join(config.root,'web/scripts/note_protection_http_fixture.js'),'utf8'));
    fs.writeFileSync(config.result,JSON.stringify(result));persistEvidence({mode:config.mode,phase:config.phase,result});
    window.destroy();app.exit(0);
  }catch(error){const code=/^[a-zA-Z0-9_:.-]+$/.test(error.message)?error.message:'client_error';persistEvidence({mode:config.mode,phase:config.phase,failure:code});window.destroy();app.exit(1);}
});
setTimeout(()=>{persistEvidence({mode:config.mode,phase:config.phase,failure:'client_timeout_uncertain'});app.exit(1);},120000).unref();
