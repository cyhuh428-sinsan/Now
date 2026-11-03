const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const qaRoot='D:/tmp/nownote-241-idb';
async function child(){
  const {app,BrowserWindow}=require('electron');
  app.setPath('userData',process.env.NOWNOTE_DOCUMENT_QA_PROFILE);
  await app.whenReady();
  const window=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  try{
    await window.loadFile(path.join(process.env.NOWNOTE_DOCUMENT_QA_PROFILE,'fixture.html'));
    for(const name of ['document-parts.js','document-idb.js','note-protection-state.js','browser-history-storage.js'])
      await window.webContents.executeJavaScript(fs.readFileSync(path.join(root,'web/vendor',name),'utf8'));
    if(process.env.NOWNOTE_DOCUMENT_QA_COLD==='1'){
      const result=await window.webContents.executeJavaScript(`(async()=>{
        const key='qa.history',account=JSON.stringify(['https://qa.invalid','A']);
        const storage=NowBrowserHistoryStorage.create({indexedDB,localStorage,key,lock:action=>navigator.locks.request(key,action)});
        const value=JSON.parse(await storage.read());
        if(value.contexts[account].notes.a.protection_record.ciphertext!=='NOW_ENCRYPTED_V1:opaque'||value.contexts[account].notes.b.draft.content!=='unrelated'.repeat(10000))throw Error('Cold process document recovery failed');
        const retained=NowBrowserHistoryStorage.create({indexedDB,localStorage,key:'qa.history.retained',lock:action=>navigator.locks.request('qa.history.retained',action)});
        const original=JSON.parse(await retained.readOriginal());
        if(original.contexts[JSON.stringify(['https://qa.invalid','alice'])].notes.a.protection_record.ciphertext!=='NOW_ENCRYPTED_V1:synthetic')throw Error('Cold retained original protection failed');
        if(!(await retained.readDirectory(['contexts'])).found)throw Error('Cold retained selective read failed');
        return {coldProcess:true,protected:true,unrelatedPreserved:true,retainedOriginal:true};
      })()`);
      console.log(JSON.stringify(result));return;
    }
    const result=await window.webContents.executeJavaScript(`(async()=>{
      const assert=(value,message)=>{if(!value)throw Error(message);};
      const request=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      const key='qa.history',account=JSON.stringify(['https://qa.invalid','A']);
      const old={schema_version:1,contexts:{[account]:{notes:{a:{draft:{content:'one'},revisions:[{content:'history'.repeat(10000)}]},b:{draft:{content:'unrelated'.repeat(10000)}}}}},extra:{unknown:[true,null]}};
      localStorage.setItem(key,JSON.stringify(old,null,2));const original=localStorage.getItem(key);
      const create=()=>NowBrowserHistoryStorage.create({indexedDB,localStorage,key,lock:action=>navigator.locks.request(key,action)});
      const a=create();assert(JSON.stringify(JSON.parse(await a.read()))===JSON.stringify(old),'migration loss');
      assert(localStorage.getItem(key)===original,'legacy bytes changed');
      const db=await request(indexedDB.open('nownote.journal.v1',2));
      const inspect=async()=>{
        const tx=db.transaction(['journals','documents'],'readonly');
        const done=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
        const row=await request(tx.objectStore('journals').get(key));
        const items=await request(tx.objectStore('documents').getAll());await done;
        return {row,items};
      };
      const before=await inspect();assert(before.row.format===2&&!Object.hasOwn(before.row.row,'value'),'whole journal retained');
      const next=structuredClone(old);next.contexts[account].notes.a.draft.content='changed';
      await a.write(old,next);const after=await inspect();
      const changed=after.items.filter(item=>JSON.stringify(item)!==JSON.stringify(before.items.find(v=>v.id===item.id)));
      assert(changed.length===1,'unrelated document rewrite');
      const b=create();assert(JSON.stringify(JSON.parse(await b.read()))===JSON.stringify(next),'cold adapter lost change');
      let refused=false;try{await b.write(old,old);}catch{refused=true;}assert(refused,'stale tab accepted');
      let auth=false;try{await a.write(next,old,{active:()=>false});}catch{auth=true;}assert(auth,'inactive account accepted');
      const scope={url:'https://qa.invalid',owner:'A',instance:'11111111-1111-4111-8111-111111111111',local_id:'a',device:'qa'};
      const sealed=structuredClone(next);sealed.contexts[account].notes.a={protection_record:{schema_version:1,scope,operation_id:'qa',ciphertext:'NOW_ENCRYPTED_V1:opaque'}};
      await a.write(next,sealed);
      const sealedDisk=await inspect();assert(!JSON.stringify(sealedDisk).includes('historyhistory'),'removed plaintext history retained');
      await a.casLegacy(old,{...old,contexts:{[account]:{...old.contexts[account],notes:{...old.contexts[account].notes,a:sealed.contexts[account].notes.a}}}});
      assert(JSON.parse(localStorage.getItem(key)).contexts[account].notes.a.protection_record,'legacy not protected');
      let oldBlocked=false;try{await request(indexedDB.open('nownote.journal.v1',1));}catch(e){oldBlocked=e.name==='VersionError';}
      assert(oldBlocked,'old IDB writer not blocked');
      db.close();return {checks:9,changedParts:changed.length,format:after.row.format};
    })()`);
    console.log(JSON.stringify(result));
    const {verifyRetainedBrowserHistory}=await import('./browser-retained-history-fixture.mjs');
    console.log(JSON.stringify(await verifyRetainedBrowserHistory(expression=>window.webContents.executeJavaScript(expression))));
  }finally{window.destroy();app.quit();}
}
if(process.versions.electron){child().catch(error=>{console.error(error.stack);require('electron').app.exit(1);});}
else{
  fs.mkdirSync(qaRoot,{recursive:true});const profile=fs.mkdtempSync(path.join(qaRoot,'run-'));
  try{
    fs.writeFileSync(path.join(profile,'fixture.html'),'<!doctype html><title>NowNote synthetic document QA</title>');
    const electron=process.env.NOWNOTE_ELECTRON_PATH||'D:/Project/Now/desktop/node_modules/electron/dist/electron.exe';
    const env={...process.env,NOWNOTE_DOCUMENT_QA_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;
    const result=spawnSync(electron,[__filename],{env,encoding:'utf8',timeout:45000,windowsHide:true});
    process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
    if(result.error)throw result.error;process.exitCode=result.status===0?0:1;
    if(result.status===0){
      const cold=spawnSync(electron,[__filename],{env:{...env,NOWNOTE_DOCUMENT_QA_COLD:'1'},encoding:'utf8',timeout:45000,windowsHide:true});
      process.stdout.write(cold.stdout||'');process.stderr.write(cold.stderr||'');
      if(cold.error)throw cold.error;process.exitCode=cold.status===0?0:1;
    }
  }finally{
    const relative=path.relative(fs.realpathSync(qaRoot),fs.realpathSync(profile));
    if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Unsafe QA cleanup');
    fs.rmSync(profile,{recursive:true,force:true});
  }
}
