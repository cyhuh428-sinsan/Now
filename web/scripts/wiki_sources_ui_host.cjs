/* Actual renderer/HTML file input and own durable storage; no API or model fixtures. */
const {app,BrowserWindow,ipcMain,session}=require('electron');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),own=path.resolve(process.argv[2]),mode=process.argv[3],phase=Number(process.argv[4]);
if(!own.startsWith(path.resolve('D:/tmp/now-240-wiki-sources')+path.sep)||!['web','desktop'].includes(mode)||![1,2].includes(phase))throw Error('qa_boundary');
app.setPath('userData',path.join(own,mode));app.disableHardwareAcceleration();
const {readStoreFile,updateStoreFile,compareAndSetStoreValue}=require(path.join(root,'desktop/store-file.cjs'));
const main=fs.readFileSync(path.join(root,'desktop/main.cjs'),'utf8'),start=main.indexOf('function updateRendererStoreValue('),end=main.indexOf('function registerVaultHandlers(',start);
const store=path.join(own,mode,'nownote-desktop-store.json'),keys=new Set(['nownote.web.v1','nownote.web.settings.v1','nownote.history.v1','nownote.library.v1']);
const box={compareAndSetStoreValue,updateStoreFile,desktopStorePath:()=>store,assertRendererStoreKey:k=>{if(!keys.has(k))throw Error('store_key');}};
vm.runInNewContext(main.slice(start,end)+'\nglobalThis.write=updateRendererStoreValue;',box);
ipcMain.handle('nownote:desktop-store-read',(_e,k)=>{if(!keys.has(k))throw Error('store_key');return readStoreFile(store).store.values[k]??null;});
const write=(k,v,o)=>{const r=box.write(k,v,o);return {ok:true,updatedAt:r.store.updatedAt};};
ipcMain.handle('nownote:desktop-store-write',(_e,k,v,o)=>write(k,v,o));
ipcMain.on('nownote:desktop-store-write-sync',(e,k,v,o)=>{try{e.returnValue=write(k,v,o);}catch{e.returnValue={ok:false,error:'qa_CAS'};}});
ipcMain.handle('nownote:desktop-store-info',()=>({version:1,keys:[...keys]}));
ipcMain.handle('nownote:vault-status',()=>({connected:false}));ipcMain.handle('nownote:vault-recovery-status',()=>({pending:false}));
let window,result={ok:false},network=0;
app.whenReady().then(async()=>{
  try{
    session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_d,done)=>{network++;done({cancel:true});});
    window=new BrowserWindow({show:false,width:1200,height:900,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,
      ...(mode==='desktop'?{preload:path.join(root,'desktop/preload.cjs')}:{})}});
    await window.loadFile(path.join(root,mode==='desktop'?'desktop/app/index.html':'web/index.html'));
    const run=code=>window.webContents.executeJavaScript(code),wait=async(code,label)=>{
      for(let i=0;i<300;i++){if(await run(code))return;await new Promise(r=>setTimeout(r,25));}throw Error(label);
    };
    await wait('Boolean(wikiSources&&wikiUI&&noteHistory&&!noteHistory.suspended())','startup_timeout');
    await run('wikiUI.open()');await wait('Boolean(document.querySelector("#wikiDialog [data-wiki-action=sources]"))','sources_button');
    await run('document.querySelector("#wikiDialog [data-wiki-action=sources]").click()');
    await wait('Boolean(document.querySelector("#wikiDialog [name=wiki-files]"))','file_input');
    const assert=(v,code)=>{if(!v)throw Error(code);};
    const choose=async names=>{
      if(!window.webContents.debugger.isAttached())window.webContents.debugger.attach('1.3');
      const {root:doc}=await window.webContents.debugger.sendCommand('DOM.getDocument');
      const {nodeId}=await window.webContents.debugger.sendCommand('DOM.querySelector',{nodeId:doc.nodeId,selector:'#wikiDialog [name=wiki-files]'});
      await window.webContents.debugger.sendCommand('DOM.setFileInputFiles',{nodeId,files:names.map(n=>path.join(own,n))});
      await wait('!document.querySelector("#wikiDialog [data-wiki-action=capture-files]").disabled','capture_ready');
      await run('document.querySelector("#wikiDialog [data-wiki-action=capture-files]").click()');
    };
    if(phase===1){
      await choose(['source.md','other.txt']);
      await wait('document.querySelector("#wikiDialog [role=status]").textContent.includes("원본 2개 저장")','capture_status');
      assert(await run('(async()=>{const rows=await wikiSources.list();return rows.length===2&&rows.every(s=>noteHistory.view(s.manifest.note_ref.local_id).localOnly);})()'),'durable_sources');
    }else{
      assert(await run('(async()=>{const rows=await wikiSources.list();return rows.length===2&&rows.every(s=>noteHistory.view(s.manifest.note_ref.local_id).revisions.length===1);})()'),'cold_sources');
      await choose(['source.md','other.txt']);await wait('document.querySelector("#wikiDialog [role=status]").textContent.includes("변경 없음 2개")','duplicate_status');
      await choose(['unsupported.pdf']);await wait('document.querySelector("#wikiDialog [role=status]").textContent.includes("지원하지 않는 파일")','unsupported_status');
      assert(await run('(async()=>(await wikiSources.list()).length===2)()'),'unsupported_partial_write');
    }
    await run('document.querySelector("#wikiDialog [data-wiki-source-id]").click()');
    assert(await run('document.querySelector("#wikiDialog .wiki-source-preview").textContent.includes("<script>")&&!globalThis.WIKI_SOURCE_EXECUTED'),'exact_text_not_executed');
    assert(await run('!flattenTree(state.data.tree).some(n=>String(n.id).startsWith("wiki-source:"))'),'source_tree_projection');
    const before=await run('(async()=>{await noteHistory.idle();await Promise.all([...storagePendingWrites]);return Object.keys(noteHistory.entries()).filter(k=>k.startsWith("wiki-source:")).sort();})()');
    const screenshotRoot='D:/Project/Now/docs/2.4.0/qa';
    for(const [size,width,height] of [['desktop',1200,900],['mobile',390,844]]){
      window.setContentSize(width,height);await run('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      assert(await run('(()=>{const d=document.querySelector("#wikiDialog");return d.scrollWidth<=d.clientWidth+1&&d.getBoundingClientRect().right<=innerWidth;})()'),'source_layout_'+size);
      fs.writeFileSync(path.join(screenshotRoot,'wiki-sources-'+mode+'-'+size+'.png'),(await window.webContents.capturePage()).toPNG());
    }
    assert(await run('(async()=>{const previous=state.settings.server.ownerId;state.settings.server.ownerId="qa-source-b";wikiUI.check();const hidden=!document.querySelector("#wikiDialog").open;const empty=(await wikiSources.list()).length===0;state.settings.server.ownerId=previous;return hidden&&empty;})()'),'account_b_leak');
    await run('noteHistory.idle()');result={ok:true,sources:2,ids:before,phase,blockedNetworkAttempts:network,realProviderCalls:0};
  }catch(error){
    const status=window&&!window.isDestroyed()?await window.webContents.executeJavaScript('document.querySelector("#wikiDialog [role=status]")?.textContent||""').catch(()=>''):'';
    result={ok:false,error:error.message,status};
  }
  finally{fs.writeFileSync(path.join(own,mode+'-'+phase+'.json'),JSON.stringify(result));window?.destroy();app.exit(result.ok?0:1);}
});
