import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const retainedQA=process.env.NOWNOTE_QA_RETAINED_ORIGINAL==='1';
const qaRoot=retainedQA?'D:/tmp/nownote-241-migration':'D:/tmp/nownote-241-runtime';await fs.mkdir(qaRoot,{recursive:true});
const profile=await fs.mkdtemp(path.join(qaRoot,'run-')),children=new Set(),sockets=new Set();
const executable=process.env.NOWNOTE_DESKTOP_EXE_PATH||process.env.NOWNOTE_ELECTRON_PATH||path.join(root,'node_modules/electron/dist/electron.exe');
const packaged=Boolean(process.env.NOWNOTE_DESKTOP_EXE_PATH);
if(retainedQA)await fs.writeFile(path.join(profile,'nownote-desktop-store.json'),JSON.stringify({version:1,updatedAt:null,values:{'nownote.web.v1':{tree:[],qaRetained:'original'}}}));
async function port(){const server=net.createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const p=server.address().port;await new Promise(resolve=>server.close(resolve));return p;}
function start(debugPort,wiki=false){
  const exe=wiki&&packaged?path.join(path.dirname(executable),'NowNoteWiki.exe'):executable;
  const args=[...(packaged?[]:[path.join(root,'main.cjs')]),`--remote-debugging-port=${debugPort}`,'--disable-gpu',...(wiki&&!packaged?['--wiki']:[])];
  const env={...process.env,NOWNOTE_DESKTOP_USER_DATA_DIR:profile,...(retainedQA?{NOWNOTE_SYNTHETIC_MIGRATION:'1'}:{})};delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(exe,args,{env,windowsHide:true,stdio:['ignore','pipe','pipe']});children.add(child);
  child.on('exit',()=>children.delete(child));child.on('error',error=>{console.error(error.message);});
  return child;
}
async function until(action,label){const end=Date.now()+25000;let last;while(Date.now()<end){try{const value=await action();if(value)return value;}catch(e){last=e;}await delay(100);}throw Error(label+': '+(last?.message||'timeout'));}
async function targets(port){return (await(await fetch(`http://127.0.0.1:${port}/json`)).json()).filter(target=>target.type==='page');}
async function client(target){
  const ws=new WebSocket(target.webSocketDebuggerUrl);await once(ws,'open');sockets.add(ws);let id=0;const pending=new Map();
  ws.addEventListener('message',event=>{const row=JSON.parse(event.data);if(!row.id)return;const entry=pending.get(row.id);if(!entry)return;pending.delete(row.id);row.error?entry.reject(Error(row.error.message)):entry.resolve(row.result);});
  async function evaluate(expression){const next=++id;const reply=new Promise((resolve,reject)=>pending.set(next,{resolve,reject}));ws.send(JSON.stringify({id:next,method:'Runtime.evaluate',params:{expression:`(async()=>(${expression}))()`,awaitPromise:true,returnByValue:true}}));const result=await reply;if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result?.value;}
  return {evaluate,close(){ws.close();sockets.delete(ws);}};
}
try{
  const debug=await port(),primary=start(debug);
  const first=await until(async()=>{const rows=await targets(debug);return rows.find(row=>!row.url.includes('workspace=wiki'));},'note window');
  const a=await client(first);
  await until(()=>a.evaluate(`document.querySelector('#treeEditorPanel')&&typeof window.nownoteDesktop?.storage?.read==='function'&&typeof wikiUI!=='undefined'&&wikiUI!==null`),'note ready');
  await a.evaluate(`(async()=>{await noteHistoryCaptureChain;await Promise.all([...storagePendingWrites]);})()`);
  assert.equal(await a.evaluate(`typeof cytoscape`),'undefined');
  if(retainedQA){
    assert.equal(await a.evaluate(`(await nownoteDesktop.storage.info()).retainedOriginal`),true);
    assert.equal(await a.evaluate(`protectionStorageAdapters().filter(item=>item.name.startsWith('original:')).length`),4);
    await a.evaluate(`(async()=>{
      const key='nownote.web.v1',original=await nownoteDesktop.storage.original.read(key);
      if(original.qaRetained!=='original')throw Error('Original IPC read failed');
      await nownoteDesktop.storage.original.cas(key,{...original,qaRetained:'confirmed'},original);
      try{await nownoteDesktop.storage.original.cas(key,original,original);throw Error('Stale original accepted');}catch(error){if(error.message==='Stale original accepted')throw error;}
      try{await nownoteDesktop.storage.original.read('nownote.vault.v1');throw Error('Unknown original key accepted');}catch(error){if(error.message==='Unknown original key accepted')throw error;}
    })()`);
  }
  await a.evaluate(`(async()=>{
    document.querySelector('#addRootBtn').click();const id=state.selectedTreeId;
    findTreeNode(state.data.tree,id).title='Restore storage QA';archiveDeletedTreeNode(id);persist();
    await Promise.all([...storagePendingWrites]);restoreDeletedTreeNode(id);
    await Promise.all([...storagePendingWrites]);
    const stored=await nownoteDesktop.storage.read('nownote.web.v1');
    if(!stored.tree.some(node=>node.id===id&&node.status==='active'))throw Error('Restore was not persisted');
  })()`);
  const settingsKey='nownote.web.settings.v1';
  await a.evaluate(`(async()=>{const value=await nownoteDesktop.storage.read('${settingsKey}');state.settings.fontSize='small';await nownoteDesktop.storage.write('${settingsKey}',{...(value||{}),fontSize:'small'},{expectedValue:value});})()`);
  await a.evaluate(`(async()=>{
    const value=await nownoteDesktop.storage.readPath('${settingsKey}',['fontSize']);
    if(value.projection!=='path_v1'||value.found!==true||value.value!=='small')throw Error('Selective IPC read failed');
    try{await nownoteDesktop.storage.readPath('nownote.vault.v1',[]);throw Error('Unknown path key accepted');}catch(error){if(error.message==='Unknown path key accepted')throw error;}
    try{await nownoteDesktop.storage.write('${settingsKey}',{fontSize:'bad'},{expectedValue:value});throw Error('Partial baseline accepted');}catch(error){if(error.message==='Partial baseline accepted')throw error;}
  })()`);
  const secondary=start(debug,true);
  const secondaryExit=once(secondary,'exit');
  const wikiTarget=await until(async()=>{const rows=await targets(debug);return rows.find(row=>row.url.includes('workspace=wiki'));},'wiki window');
  const b=await client(wikiTarget);
  await until(()=>b.evaluate(`!!document.querySelector('#wikiDialog')`),'wiki mounted');
  const [code]=await secondaryExit;assert.equal(code,0);
  await a.evaluate(`window.qaSettings=await nownoteDesktop.storage.read('${settingsKey}')`);
  await b.evaluate(`window.qaSettings=await nownoteDesktop.storage.read('${settingsKey}')`);
  await a.evaluate(`(async()=>{state.settings.fontSize='large';await nownoteDesktop.storage.write('${settingsKey}',{...window.qaSettings,fontSize:'large'},{expectedValue:window.qaSettings});})()`);
  const rejected=await b.evaluate(`(async()=>{try{await nownoteDesktop.storage.write('${settingsKey}',{...window.qaSettings,fontSize:'medium'},{expectedValue:window.qaSettings});return false;}catch{return true;}})()`);
  assert.equal(rejected,true);assert.equal(await a.evaluate(`typeof cytoscape`),'undefined');
  assert.equal((await a.evaluate(`await nownoteDesktop.storage.info()`)).version,2);
  await b.evaluate(`location.href='about:blank'`);
  await until(()=>b.evaluate(`location.href==='about:blank'&&!!window.nownoteDesktop`),'untrusted navigation');
  assert.equal(await b.evaluate(`(async()=>{try{await nownoteDesktop.storage.info();return false;}catch{return true;}})()`),true);
  assert.equal(await b.evaluate(`(async()=>{try{await nownoteDesktop.storage.original.read('nownote.web.v1');return false;}catch{return true;}})()`),true);
  assert.equal(await b.evaluate(`(async()=>{try{await nownoteDesktop.storage.readPath('${settingsKey}',['fontSize']);return false;}catch{return true;}})()`),true);
  await b.evaluate('window.close()');b.close();await a.evaluate('window.close()').catch(()=>{});a.close();
  if(primary.exitCode===null)await once(primary,'exit');
  const marker=JSON.parse(await fs.readFile(path.join(profile,'nownote-desktop-store.json'),'utf8'));assert.equal(marker.values,undefined);
  const coldPort=await port(),cold=start(coldPort);
  const coldTarget=await until(async()=>{const rows=await targets(coldPort);return rows[0];},'cold window');
  const c=await client(coldTarget);await until(()=>c.evaluate(`typeof window.nownoteDesktop?.storage?.read==='function'&&location.protocol==='file:'&&location.pathname.endsWith('/index.html')&&typeof wikiUI!=='undefined'&&wikiUI!==null`),'cold application ready');
  assert.equal(await c.evaluate(`(await nownoteDesktop.storage.read('${settingsKey}')).fontSize`),'large');
  assert.equal(await c.evaluate(`(await nownoteDesktop.storage.read('nownote.web.v1')).tree.some(node=>node.title==='Restore storage QA'&&node.status==='active')`),true);
  if(retainedQA)assert.equal(await c.evaluate(`(await nownoteDesktop.storage.original.read('nownote.web.v1')).qaRetained`),'confirmed');
  await c.evaluate('window.close()').catch(()=>{});c.close();if(cold.exitCode===null)await once(cold,'exit');
  const wikiPort=await port(),standalone=start(wikiPort,true);
  const standaloneTarget=await until(async()=>{const rows=await targets(wikiPort);return rows.find(row=>row.url.includes('workspace=wiki'));},'standalone Wiki');
  const d=await client(standaloneTarget);await until(()=>d.evaluate(`!!document.querySelector('#wikiDialog')`),'standalone Wiki mounted');
  assert.equal(await d.evaluate(`(await nownoteDesktop.storage.read('${settingsKey}')).fontSize`),'large');
  await d.evaluate('window.close()').catch(()=>{});d.close();if(standalone.exitCode===null)await once(standalone,'exit');
  console.log(JSON.stringify({runtime:'actual main/preload',packaged,retainedOriginal:retainedQA,sqlite:true,separateWikiWindow:true,standaloneWiki:true,secondaryExited:true,staleRejected:true,noteGraphUnloaded:true,restoreCold:true,untrustedIPCBlocked:true,cold:true}));
}finally{
  for(const ws of sockets)ws.close();
  for(const child of children){child.kill();if(child.exitCode===null)await Promise.race([once(child,'exit'),delay(5000)]);}
  const relative=path.relative(await fs.realpath(qaRoot),await fs.realpath(profile));
  if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Unsafe runtime cleanup');
  await fs.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});
}
