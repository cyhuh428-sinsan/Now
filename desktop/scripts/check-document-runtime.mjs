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
  async function command(method,params={}){
    const next=++id;let timer;
    const reply=new Promise((resolve,reject)=>{timer=setTimeout(()=>{pending.delete(next);reject(Error('CDP timeout: '+method));},15000);pending.set(next,{resolve,reject});});
    ws.send(JSON.stringify({id:next,method,params}));try{return await reply;}finally{clearTimeout(timer);}
  }
  async function evaluate(expression){const result=await command('Runtime.evaluate',{expression:`(async()=>(${expression}))()`,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result?.value;}
  return {evaluate,command,close(){ws.close();sockets.delete(ws);}};
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
    document.querySelector('#addRootBtn').click();const id=state.selectedTreeId;globalThis.qaRestoredId=id;
    findTreeNode(state.data.tree,id).title='Restore storage QA';archiveDeletedTreeNode(id);persist();
    await Promise.all([...storagePendingWrites]);restoreDeletedTreeNode(id);
    await Promise.all([...storagePendingWrites]);
    const stored=await nownoteDesktop.storage.read('nownote.web.v1');
    if(!stored.tree.some(node=>node.id===id&&node.status==='active'))throw Error('Restore was not persisted');
  })()`);
  const settingsKey='nownote.web.settings.v1';
  await a.evaluate(`(async()=>{const value=await nownoteDesktop.storage.read('${settingsKey}');state.settings.fontSize='small';
    state.settings.llm={provider:'omniroute',apiKey:'',omniUrl:'https://registered.invalid',omniModel:'Combo/qa',omniReasoning:'high',omniApiKey:'synthetic-only',ollamaUrl:'',ollamaModel:'llama3.1'};
    await nownoteDesktop.storage.write('${settingsKey}',{...(value||{}),fontSize:'small',llm:state.settings.llm},{expectedValue:value});})()`);
  await a.evaluate(`(async()=>{
    const value=await nownoteDesktop.storage.readPath('${settingsKey}',['fontSize']);
    if(value.projection!=='path_v1'||value.found!==true||value.value!=='small')throw Error('Selective IPC read failed');
    const directory=await nownoteDesktop.storage.readDirectory('${settingsKey}',[]);
    if(directory.stamp!==value.stamp||directory.part.type!=='object'||!Array.isArray(directory.partIds)||Object.hasOwn(directory,'value'))throw Error('Directory IPC snapshot failed');
    try{await nownoteDesktop.storage.readPath('nownote.vault.v1',[]);throw Error('Unknown path key accepted');}catch(error){if(error.message==='Unknown path key accepted')throw error;}
    try{await nownoteDesktop.storage.write('${settingsKey}',{fontSize:'bad'},{expectedValue:value});throw Error('Partial baseline accepted');}catch(error){if(error.message==='Partial baseline accepted')throw error;}
  })()`);
  await a.evaluate(`(async()=>{
    await noteHistoryFlush();noteHistoryController.lock();
    const history=nownoteDesktop.storage.history,ctx=noteHistoryContext(),account=NowNoteHistory.key(ctx),before=await history.open();
    const note={owner_id:ctx.owner,local_id:'qa-paged-history',note_type:'tree',source:'manual',content:'current'};
    const entry={raw:note,draft:note,base:{crypto_epoch:0,inventory_revision_ids:[]},revisions:Array.from({length:3},(_,index)=>({revision_id:'r'+index,snapshot:{note:{...note,content:'history '+index}},unknown:index})),outbox:[],receipts:[]};
    if(!(await history.full({revision:before.revision,next:{schema_version:1,contexts:{[account]:{notes:{[note.local_id]:entry}}}}})).ok)throw Error('Native page fixture failed');
    const current=await history.current(account),first=await history.page({account,id:note.local_id,stamp:current.stamp,limit:2});
    if(!first.ok||first.items.length!==2||first.items[0].unknown!==2||!first.nextCursor||Object.hasOwn(first,'revision'))throw Error('Native page IPC failed');
    if((await history.full({revision:first.stamp,next:{}})).ok)throw Error('Page authorized a full write');
    const next=await history.page({account,id:note.local_id,stamp:current.stamp,cursor:first.nextCursor,limit:2});
    if(!next.ok||next.items.length!==1||next.items[0].unknown!==0||next.nextCursor!==null)throw Error('Native page cursor failed');
    const after=await history.open();if(!(await history.full({revision:after.revision,next:before.value})).ok)throw Error('Native QA restore failed');
    await noteHistoryController.resume({projectView:false,renderView:false});
  })()`);
  const secondary=start(debug,true);
  const secondaryExit=once(secondary,'exit');
  const wikiTarget=await until(async()=>{const rows=await targets(debug);return rows.find(row=>new URL(row.url).pathname.endsWith('/wiki.html'));},'wiki window');
  const b=await client(wikiTarget);
  await until(()=>b.evaluate(`!!document.querySelector('#wikiDialog')`),'wiki mounted');
  assert.equal(await b.evaluate(`typeof initializeApp==='undefined'&&typeof state==='undefined'&&!document.querySelector('#treeContent')&&!performance.getEntriesByType('resource').some(row=>new URL(row.name).pathname.endsWith('/app.js'))`),true,'Wiki must not load the memo runtime');
  assert.equal(await b.evaluate(`document.querySelectorAll('.wiki-workspace-tabs button').length`),1);
  await b.evaluate(`(()=>{
    globalThis.qaWikiProviderCalls=0;
    globalThis.fetch=async(url,options)=>{
      if(url!=='https://registered.invalid/v1/chat/completions')throw Error('external network forbidden in standalone QA');
      qaWikiProviderCalls++;const body=JSON.parse(options.body),input=JSON.parse(body.messages.at(-1).content).input;
      if(body.max_tokens!==4096||body.model!=='Combo/qa')throw Error('standalone request budget');
      return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({pages:input.pages.map((page,index)=>({wiki_id:page.wiki_id,draft_id:page.draft_id,
        title:'Standalone synthetic wiki',topic:'Synthetic QA',page_type:'concept',summary:'Synthetic only',aliases:[],claims:[],relations:[],
        sections:[{id:'s1',title:'Finding',markdown:'Synthetic standalone finding.',citation_ids:['c1']}],citations:[{id:'c1',evidence_id:input.sources[index].id,section_id:null,quote:input.sources[index].content.slice(0,20)}]}))})}}]})};
    };
  })()`);
  const clickWiki=async action=>{await until(()=>b.evaluate(`!!document.querySelector('#wikiDialog [data-wiki-action=${action}]')&&!document.querySelector('#wikiDialog [data-wiki-action=${action}]').disabled`),'standalone '+action);await b.evaluate(`document.querySelector('#wikiDialog [data-wiki-action=${action}]').click()`);};
  const upload=async(name,content)=>{
    const file=path.join(profile,name);await fs.writeFile(file,content);
    await b.evaluate(`document.querySelector('[data-wiki-view=sources]').click()`);
    await until(()=>b.evaluate(`!!document.querySelector('#wikiDialog [name=wiki-files]')`),'standalone file input');
    const {root:doc}=await b.command('DOM.getDocument'),{nodeId}=await b.command('DOM.querySelector',{nodeId:doc.nodeId,selector:'#wikiDialog [name=wiki-files]'});
    await b.command('DOM.setFileInputFiles',{nodeId,files:[file]});await clickWiki('capture-files');
    await until(()=>b.evaluate(`document.querySelector('#wikiDialog [role=status]')?.textContent.includes('원본 1개 저장')`),'standalone capture');
    await b.evaluate(`(()=>{const input=[...document.querySelectorAll('#wikiDialog [name=wiki-ingest-file]')].find(node=>node.closest('label').textContent.includes(${JSON.stringify(name)}));if(!input)throw Error('captured source selector');input.click();})()`);
    await clickWiki('plan-ingest');await clickWiki('generate-ingest');await until(()=>b.evaluate(`!!document.querySelector('#wikiDialog [data-wiki-action=confirm-send]')`),'standalone transmission consent');
  };
  await upload('standalone-source.md','Synthetic standalone evidence. No personal data.');assert.equal(await b.evaluate('qaWikiProviderCalls'),0);
  await clickWiki('confirm-send');await clickWiki('commit-ingest');
  await until(()=>b.evaluate(`document.querySelector('#wikiDialog [role=status]')?.textContent.includes('초안 1개 저장')`),'standalone saved draft');
  await clickWiki('sources');await until(()=>b.evaluate(`!!document.querySelector('#wikiDialog .wiki-entry .library-item')`),'standalone draft row');
  await b.evaluate(`document.querySelector('#wikiDialog .wiki-entry .library-item').click()`);await clickWiki('approve');
  await until(()=>b.evaluate(`document.querySelector('#wikiDialog [role=status]')?.textContent.includes('승인 저장 완료')`),'standalone approved');
  assert.equal(await b.evaluate('qaWikiProviderCalls'),1);
  await b.evaluate(`(()=>{const create=NowWikiConnection.create;NowWikiConnection.create=options=>create({...options,verify:async()=>{if(globalThis.qaHoldTransmission&&!globalThis.qaHeldTransmission){globalThis.qaHeldTransmission=true;await new Promise(resolve=>globalThis.qaReleaseTransmission=resolve);}await options.verify();}});globalThis.qaHoldTransmission=true;})()`);
  await upload('standalone-guard.md','Synthetic guard evidence. Never sent to a real model.');await clickWiki('confirm-send');
  await until(()=>b.evaluate(`globalThis.qaHeldTransmission===true`),'standalone held preflight');
  const currentJournal=await a.evaluate(`nownoteDesktop.storage.history.open()`),changedJournal=structuredClone(currentJournal.value);
  const sourceEntry=Object.values(changedJournal.contexts).flatMap(bucket=>Object.values(bucket.notes)).find(entry=>entry.draft?.title==='standalone-guard.md');
  assert.ok(sourceEntry);sourceEntry.draft.content+=' Concurrent synthetic change.';
  assert.equal(await a.evaluate(`(await nownoteDesktop.storage.history.full({revision:${JSON.stringify(currentJournal.revision)},next:${JSON.stringify(changedJournal)}})).ok`),true);
  try{
    await b.evaluate(`globalThis.qaReleaseTransmission()`);
    await until(()=>b.evaluate(`document.querySelector('#wikiDialog [role=status]')?.textContent.includes('다른 창에서 자료 또는 보호 상태')`),'standalone stale transmission rejected');
    assert.equal(await b.evaluate('qaWikiProviderCalls'),1,'changed local store must not reach Provider');
  }finally{
    await a.evaluate(`(async()=>{const opened=await nownoteDesktop.storage.history.open();if(!(await nownoteDesktop.storage.history.full({revision:opened.revision,next:${JSON.stringify(currentJournal.value)}})).ok)throw Error('standalone source fixture restore');})()`);
  }
  await a.evaluate(`(async()=>{noteHistoryController.lock();await noteHistoryController.resume({projectView:false,renderView:false});})()`);
  for(const [label,width,height]of [['desktop',1200,860],['mobile',390,844]]){
    await b.command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await delay(100);
    if(process.env.NOWNOTE_QA_REPORT_DIR){
      const report=path.resolve(process.env.NOWNOTE_QA_REPORT_DIR);await fs.mkdir(report,{recursive:true});
      const shot=await b.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(report,'wiki-standalone-native-'+label+'.png'),Buffer.from(shot.data,'base64'));
    }
    const fit=await b.evaluate(`({width:document.documentElement.getBoundingClientRect().width,right:document.documentElement.getBoundingClientRect().right,body:document.body.scrollWidth,host:document.querySelector('#wikiWorkspaceHost').getBoundingClientRect().right})`);
    assert.equal(fit.body<=Math.round(fit.width)&&fit.host<=fit.right,true,'standalone '+label+' fit '+JSON.stringify(fit));
  }
  await b.command('Emulation.clearDeviceMetricsOverride');
  await b.evaluate(`document.querySelector('#wikiSettings').click()`);
  await until(()=>a.evaluate(`!elements.settingsView.classList.contains('hidden')`),'Wiki settings navigation');await a.evaluate(`closeSettingsPopup()`);
  const navigation=await a.evaluate(`({schema_version:1,action:'source',local_id:qaRestoredId,owner:noteHistoryContext().owner,url:noteHistoryContext().url,created_at:Date.now()})`);
  await a.evaluate(`state.selectedTreeId=null`);await b.evaluate(`nownoteDesktop.openWorkspace('note',${JSON.stringify(navigation)})`);
  await until(()=>a.evaluate(`state.selectedTreeId===qaRestoredId`),'Wiki source navigation');
  await b.evaluate(`nownoteDesktop.openWorkspace('note',${JSON.stringify({...navigation,owner:'foreign-qa'})})`);
  await until(()=>a.evaluate(`document.querySelector('#toastRegion').textContent.includes('이동 요청의 계정')`),'foreign navigation rejected');
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
  assert.equal(await b.evaluate(`(async()=>{try{await nownoteDesktop.storage.readDirectory('${settingsKey}',[]);return false;}catch{return true;}})()`),true);
  assert.equal(await b.evaluate(`(async()=>{try{await nownoteDesktop.storage.history.open();return false;}catch{return true;}})()`),true);
  assert.equal(await b.evaluate(`(async()=>{try{await nownoteDesktop.storage.history.current(JSON.stringify(['https://qa.invalid','alice']));return false;}catch{return true;}})()`),true);
  assert.equal(await b.evaluate(`(async()=>{try{await nownoteDesktop.storage.history.page({account:'synthetic',id:'qa',stamp:'invalid'});return false;}catch{return true;}})()`),true);
  assert.equal(await b.evaluate(`(async()=>{try{await nownoteDesktop.storage.history.select({account:'untrusted',id:'a',stamp:'untrusted'});return false;}catch{return true;}})()`),true);
  assert.equal(await b.evaluate(`(async()=>{try{await nownoteDesktop.storage.history.note({revision:'untrusted'});return false;}catch{return true;}})()`),true);
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
  const standaloneTarget=await until(async()=>{const rows=await targets(wikiPort);return rows.find(row=>new URL(row.url).pathname.endsWith('/wiki.html'));},'standalone Wiki');
  const d=await client(standaloneTarget);await until(()=>d.evaluate(`!!document.querySelector('#wikiDialog')`),'standalone Wiki mounted');
  assert.equal(await d.evaluate(`(await nownoteDesktop.storage.read('${settingsKey}')).fontSize`),'large');
  await d.evaluate('window.close()').catch(()=>{});d.close();if(standalone.exitCode===null)await once(standalone,'exit');
  console.log(JSON.stringify({runtime:'actual main/preload',packaged,retainedOriginal:retainedQA,sqlite:true,pagedHistory:true,separateWikiWindow:true,standaloneWiki:true,standaloneIngest:true,syntheticProviderCalls:1,realProviderCalls:0,staleTransmissionRejected:true,sourceSettingsNavigation:true,foreignNavigationRejected:true,secondaryExited:true,staleRejected:true,noteGraphUnloaded:true,restoreCold:true,untrustedIPCBlocked:true,cold:true}));
}finally{
  for(const ws of sockets)ws.close();
  for(const child of children){child.kill();if(child.exitCode===null)await Promise.race([once(child,'exit'),delay(5000)]);}
  const relative=path.relative(await fs.realpath(qaRoot),await fs.realpath(profile));
  if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Unsafe runtime cleanup');
  await fs.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});
}
