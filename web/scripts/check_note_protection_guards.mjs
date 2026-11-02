import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
let passed = 0;
for (const file of ['../app.js','../../desktop/app/app.js']) {
  const source = await readFile(new URL(file,import.meta.url),'utf8');
  function extract(name) {
    const match = new RegExp('^(?:async )?function ' + name + '\\(', 'm').exec(source);
    assert.ok(match,name);
    const rest = source.slice(match.index), next = /\n(?:async )?function [A-Za-z]/.exec(rest);
    return next ? rest.slice(0,next.index) : rest;
  }
  async function check(name,action) {
    if (process.argv[2] && !name.includes(process.argv[2])) return;
    await action(); passed++;
  }
  for(const name of ['refreshServerAnalysisJobs','analysisJobCommand','updateAnalysisJob','createSelectedNoteAnalysisJob'])
  for(const field of ['input_text','result_json','error_message','metadata'])
  for(const point of ['generation','protected','account','normal'])await check('late-analysis-response-'+name+'-'+field+'-'+point,async()=>{
    let release,entered,protectedNow=false,disk;
    const ready=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve);
    const b={state:{settings:{server:{ownerId:'alice',url:'https://synthetic.invalid',analysisJobs:[]}}},
      scope:{owner:'alice',url:'https://synthetic.invalid',device:'one',auth:'synthetic',enabled:true},
      noteProtectionViewGeneration:0,noteHistoryCaptureEpoch:0,noteProtectionBlocked:id=>id==='protected-note'&&protectedNow,
      saveServerSettingsFromForm(){},prepareServerRequest:()=>true,renderServerStatus(){},renderServerSettings(){},
      normalizeOwnerId:value=>value,t:value=>value,setServerMessage(){},setServerRawMessage(){},
      elements:{serverAnalysisTypeSelect:{value:'memo_summary'}},isEncryptedContent:()=>false,
      getSelectedTreeNode:()=>({id:'protected-note',title:'Synthetic',content:'INPUT'}),
      requestServerJson:async()=>{entered();await gate;const job={id:1,note_local_id:'protected-note',input_text:null,result_json:null,error_message:null};if(field!=='metadata')job[field]='SYNTHETIC-LATE-PLAIN';return name==='refreshServerAnalysisJobs'?[job]:job;},
      persistSettings:()=>{disk=structuredClone(b.state.settings);}};
    b.noteHistoryContext=()=>({...b.scope});
    vm.createContext(b);vm.runInContext([extract('captureServerAnalysisGuard'),extract('replaceServerAnalysisJob'),extract(name)].join('\n')+'\nglobalThis.run='+name+';',b);
    const pendingResponse=b.run({id:1},name==='analysisJobCommand'?'cancel':{},'synthetic');await ready;
    if(point==='generation')b.noteProtectionViewGeneration++;
    if(point==='protected')protectedNow=true;
    if(point==='account'){b.scope={...b.scope,owner:'bob',auth:'new-session'};b.state.settings.server={ownerId:'bob',analysisJobs:[]};}
    release();await pendingResponse;
    assert.equal(JSON.stringify(disk??b.state.settings).includes('SYNTHETIC-LATE-PLAIN'),point==='normal'&&field!=='metadata',
      'Only a current, unprotected analysis response may enter persistent settings');
    if(field==='metadata'&&point==='protected')assert.equal((disk??b.state.settings).server.analysisJobs[0]?.id,1,'Protected metadata-only rows remain visible');
  });
  let pending = true, confirmLate = false, accessed = 0, owner='alice',switchAccount=false;
  const box = { state:{ selectedDate:'2026-10-30',data:{ daily:{'2026-10-30':{content:'SYNTHETIC-PLAIN'}},archivedDaily:[{id:'old',date:'2026-10-30',content:'SYNTHETIC-PLAIN'}] } },
    elements:{ dailyContent:{ readOnly:false,classList:{toggle(){}},focus(){} },appendTimeBtn:{},archiveSelectedBtn:{} },
    requireProtectionSettled:() => { if (pending) throw Error('pending'); }, noteProtectionBlocked:() => pending,
    noteHistoryContext:()=>({owner,url:'https://synthetic.invalid',auth:owner,enabled:true}),noteHistoryCaptureEpoch:0,noteProtectionIdentity:null,
    confirmAction:async () => { if (confirmLate) pending = true;
      if(switchAccount){owner='bob';box.state.data={daily:{'2026-10-30':{content:'BOB-SAFE'}},archivedDaily:[]};}
      return true; }, t:k=>k, longDateLabel:v=>v,
    buildPublishBundleContent:() => {accessed++; return { nodes:[] };},publishBundleFromInputs:()=>({}),showNotice:()=>{},
    persist:()=>{accessed++;},renderDaily:()=>{},crypto:{randomUUID:()=> 'new-id'},Date };
  vm.runInNewContext(['exportPublishHtml','exportPublishSlides','setDailyArchivePreviewMode','archiveSelectedDailyNote','restoreArchivedDailyNote'].map(extract).join('\n') +
    '\nglobalThis.api = {exportPublishHtml,exportPublishSlides,setDailyArchivePreviewMode,archiveSelectedDailyNote,restoreArchivedDailyNote};',box);
  await check('publish',async () => {
    pending = true;
    assert.throws(()=>box.api.exportPublishHtml(),/pending/);
    assert.throws(()=>box.api.exportPublishSlides(),/pending/);
    assert.equal(accessed,0);
  });
  await check('preview',async () => {
    pending = true; box.api.setDailyArchivePreviewMode(false);
    assert.equal(box.elements.dailyContent.readOnly,true);
  });
  await check('archive',async () => {
    pending = true; await assert.rejects(()=>box.api.archiveSelectedDailyNote(),/pending/);
    pending = false; confirmLate = true;
    await assert.rejects(()=>box.api.archiveSelectedDailyNote(),/pending/);
    assert.equal(box.state.data.archivedDaily.length,1);
    confirmLate = false;
  });
  await check('restore',async () => {
    pending = true; await assert.rejects(()=>box.api.restoreArchivedDailyNote('old'),/pending/);
    pending = false; confirmLate = true;
    await assert.rejects(()=>box.api.restoreArchivedDailyNote('old'),/pending/);
    assert.equal(box.state.data.daily['2026-10-30'].content,'SYNTHETIC-PLAIN');
  });
  await check('queuedCAS',async () => {
    let live=true,release,entered;
    const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r),disk=new Map([['data','{"original":true}']]);
    const storage={...box,structuredClone,STORAGE_KEY:'data',SETTINGS_KEY:'settings',LIBRARY_STORAGE_KEY:'library',NOTE_HISTORY_KEY:'history',DESKTOP_STORAGE_KEYS:new Set(),
      isDesktopClient:()=>false,isHostedWebClient:()=>false,noteHistory:{export:()=>({}),replaceProtectionStore:async()=>{}},
      localStorage:{getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,v)},navigator:{locks:{request:async(_key,fn)=>{entered();await gate;return fn();}}}};
    vm.runInNewContext(extract('protectionStorageAdapters')+'\nglobalThis.adapters=protectionStorageAdapters;',storage);
    const adapter=storage.adapters().find(s=>s.name==='store:data');
    const queued=adapter.cas({original:true},{cipher:true},{active:()=>live});
    await ready;live=false;release();await assert.rejects(()=>queued,/인증/);
    assert.equal(disk.get('data'),'{"original":true}');
  });
  await check('pending-coldload-exact-record',async()=>{
    const scope={url:'https://synthetic.invalid',owner:'alice',instance:'00000000-0000-4000-8000-000000000001',local_id:'new-note',device:'one'};
    const m={scope,phase:'applying'};
    const b={crypto:{randomUUID:()=>scope.local_id},Date,isHostedWebClient:()=>false,extractTags:()=>[],defaultNoteProperties:()=>({}),
      normalizeNoteProperties:v=>v||{},normalizeText:v=>v==null?'':String(v),isPlainObject:v=>v&&typeof v==='object',isEncryptedContent:()=>false,
      protectionBootstrapScopes:[m],noteHistory:{protectionOperations:()=>({test:m})},NowNoteProtectionState:{scopeKey:s=>JSON.stringify([s.url,s.owner,s.instance,s.local_id])}};
    vm.createContext(b);
    vm.runInContext(extract('createNode')+'\n'+extract('normalizeTreeNodes')+'\n'+(source.includes('function preserveProtectionRecord(')?extract('preserveProtectionRecord'):'function preserveProtectionRecord(){return false;}')+'\nglobalThis.api={createNode,normalizeTreeNodes};',b);
    const node=b.api.createNode('Original','SYNTHETIC\r\n',null,1);node.protectionScope=scope;
    const before=JSON.parse(JSON.stringify(node));b.api.normalizeTreeNodes([node],null,1);
    const changed=[...new Set([...Object.keys(before),...Object.keys(node)])].filter(k=>JSON.stringify(before[k])!==JSON.stringify(node[k]));
    if(changed.length)console.log(file+' actual coldload field diff: '+changed.join(','));
    assert.deepEqual(changed,[],'pending original must not be normalized before exact CAS');
  });
  for(const operation of ['begin-identity','resume-identity','resume-storage'])await check('lock-generation-'+operation,async()=>{
    let release,reached;const entered=new Promise(r=>reached=r),gate=new Promise(r=>release=r);
    const scope={url:'https://synthetic.invalid',owner:'alice',instance:'instance',local_id:'memo',device:'one'};
    let started=0;
    const b={noteProtectionViewGeneration:0,noteProtectionInternalEnabled:false,noteProtectionSupport:null,
      noteHistoryContext:()=>({auth:'session',url:scope.url,owner:scope.owner,device:scope.device,enabled:true}),
      protectionViewKey:()=> 'same-target',noteProtectionIdentity:{instance:scope.instance},render:()=>{},protectionApplying:false,
      noteHistory:{protectionOperations:()=>({op:{scope}})},noteHistoryRequest:async()=>{if(operation.endsWith('identity')){reached();await gate;}return {server_instance_id:scope.instance};},
      noteProtection:{start:async()=>{started++;return 'op';},resume:async()=>{started++;return {};}}};
    b.storagePendingWrites=operation.endsWith('storage')?[gate]:[];
    if(operation.endsWith('storage')){const old=b.noteHistoryRequest;b.noteHistoryRequest=async(...a)=>{const r=await old(...a);reached();return r;};}
    vm.createContext(b);
    const guard=source.includes('function protectionActionGuard(')?extract('protectionActionGuard'):'function protectionActionGuard(){return ()=>{};}';
    vm.runInContext(extract('noteProtectionSupportBinding')+'\n'+extract('noteProtectionMutationsEnabled')+'\n'+guard+'\n'+extract('beginNoteProtection')+'\n'+extract('resumeNoteProtection')+'\nglobalThis.noteProtectionSupport={binding:noteProtectionSupportBinding()};globalThis.api={beginNoteProtection,resumeNoteProtection};',b);
    const promise=operation.startsWith('begin')?b.api.beginNoteProtection(scope,{},'synthetic'):b.api.resumeNoteProtection('op','synthetic',()=>({}));
    await entered;b.noteProtectionViewGeneration++;release();
    await assert.rejects(promise,/잠금|변경|취소/);assert.equal(started,0,'lock must not enter a new state-machine generation');
  });
  for(const action of ['archive','restore']) await check('accountRace-'+action,async()=>{
    pending=false;confirmLate=false;owner='alice';switchAccount=true;
    box.state.data={daily:{'2026-10-30':{content:'ALICE-ORIGINAL'}},archivedDaily:[{id:'old',date:'2026-10-30',content:'ALICE-ARCHIVE'}]};
    await assert.rejects(()=>action==='archive'?box.api.archiveSelectedDailyNote():box.api.restoreArchivedDailyNote('old'),/변경/);
    assert.equal(box.state.data.daily['2026-10-30'].content,'BOB-SAFE');assert.equal(box.state.data.archivedDaily.length,0);
    switchAccount=false;
  });
}
console.log(`actual Web/Desktop function guards: ${passed} PASS; synthetic function/DOM boundary only, not browser/Electron`);
