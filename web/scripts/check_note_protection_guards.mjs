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
    const b={noteProtectionViewGeneration:0,noteHistoryContext:()=>({auth:'session',url:scope.url,owner:scope.owner,device:scope.device}),
      protectionViewKey:()=> 'same-target',noteProtectionIdentity:{instance:scope.instance},render:()=>{},protectionApplying:false,
      noteHistory:{protectionOperations:()=>({op:{scope}})},noteHistoryRequest:async()=>{if(operation.endsWith('identity')){reached();await gate;}return {server_instance_id:scope.instance};},
      noteProtection:{start:async()=>{started++;return 'op';},resume:async()=>{started++;return {};}}};
    b.storagePendingWrites=operation.endsWith('storage')?[gate]:[];
    if(operation.endsWith('storage')){const old=b.noteHistoryRequest;b.noteHistoryRequest=async(...a)=>{const r=await old(...a);reached();return r;};}
    vm.createContext(b);
    const guard=source.includes('function protectionActionGuard(')?extract('protectionActionGuard'):'function protectionActionGuard(){return ()=>{};}';
    vm.runInContext(guard+'\n'+extract('beginNoteProtection')+'\n'+extract('resumeNoteProtection')+'\nglobalThis.api={beginNoteProtection,resumeNoteProtection};',b);
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
