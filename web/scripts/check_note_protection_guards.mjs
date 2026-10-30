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
  for(const action of ['archive','restore']) await check('accountRace-'+action,async()=>{
    pending=false;confirmLate=false;owner='alice';switchAccount=true;
    box.state.data={daily:{'2026-10-30':{content:'ALICE-ORIGINAL'}},archivedDaily:[{id:'old',date:'2026-10-30',content:'ALICE-ARCHIVE'}]};
    await assert.rejects(()=>action==='archive'?box.api.archiveSelectedDailyNote():box.api.restoreArchivedDailyNote('old'),/변경/);
    assert.equal(box.state.data.daily['2026-10-30'].content,'BOB-SAFE');assert.equal(box.state.data.archivedDaily.length,0);
    switchAccount=false;
  });
}
console.log(`actual Web/Desktop function guards: ${passed} PASS; synthetic function/DOM boundary only, not browser/Electron`);
