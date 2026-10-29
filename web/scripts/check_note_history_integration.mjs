import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const read = p => readFile(new URL('../../' + p, import.meta.url), 'utf8');
for (const surface of ['web', 'desktop/app']) {
  const app = await read(surface + '/app.js');
  assert.ok(app.includes('await initializeNoteHistory()'), `${surface}: durable journal startup`);
  assert.ok(app.includes('noteHistoryCaptureDrafts()'), `${surface}: edits reach journal`);
  assert.ok(app.includes('noteHistoryAcceptRemote(note)'), `${surface}: managed v1 pull isolation`);
  assert.ok(app.includes('noteHistory?.export()'), `${surface}: backup includes journal`);
  assert.ok(app.includes('noteHistoryProjectionScope'), `${surface}: projection owner/server cannot be silently remapped`);
  const start = app.indexOf('function buildServerSyncNotes(server) {');
  const end = app.indexOf('\nfunction shouldSendServerNote', start);
  const context = vm.createContext({
    noteHistory: { status: () => ({unsupported:true,failed:false}), manages: () => false },
    noteHistoryProjectionScope: 'scope', noteHistoryContext: () => ({}), NowNoteHistory: {key: () => 'scope'},
    state: {data:{daily:{d:{content:'must stay local',syncState:'pending'}}, worklogs:{}, archivedDaily:[], tree:[]}},
    noteHistoryEnrolling:new Set(), shouldSendServerNote:() => true, dailyNoteToServerNote:() => ({local_id:'d'}),
    flattenTree:() => [], shouldTreeNodeSyncWithServer:() => false,
  });
  vm.runInContext(app.slice(start,end), context);
  assert.equal(vm.runInContext('buildServerSyncNotes({}).length', context), 0, `${surface}: unsupported history must never fall back to v1 upload`);
  let historyCalls=0;
  const syncContext=vm.createContext({serverSyncRunning:true,serverSyncQueued:false,
    noteHistoryCaptureChain:Promise.resolve(),noteHistory:{sync:async()=>{historyCalls++;}},noteHistoryController:{resume:async()=>{}},t:x=>x});
  const syncStart=app.indexOf('async function syncWebNotesToServer('),syncEnd=app.indexOf('\nfunction classifySyncFailureAction',syncStart);
  vm.runInContext(app.slice(syncStart,syncEnd),syncContext);
  await vm.runInContext('syncWebNotesToServer()',syncContext);
  assert.equal(historyCalls,0,`${surface}: automatic/manual sync must not start v2 while v1 is running`);
  assert.equal(syncContext.serverSyncQueued,true);
  let currentContext={url:'https://server.test',owner:'alice',auth:'old-session',enabled:true},entered,release;
  const requested=new Promise(resolve=>{entered=resolve;}),response=new Promise(resolve=>{release=resolve;});
  let applied=0,completed=0;
  const noop=()=>{};
  const lateContext=vm.createContext({serverSyncRunning:false,serverSyncQueued:false,noteHistoryCaptureEpoch:0,
    noteHistoryCaptureChain:Promise.resolve(),noteHistoryContext:()=>currentContext,
    NowNoteHistory:{key:c=>JSON.stringify([c.url,c.owner])},NowLibrary:{key:()=>''},libraryContext:()=>({}),
    state:{settings:{server:{mode:'server',url:'https://server.test',ownerId:'alice',deviceId:'one'}}},
    noteHistory:{status:()=>({}),suspended:()=>false,sync:async()=>{},legacyPending:()=>null,
      beginLegacy:async body=>({id:'legacy',body}),completeLegacy:async()=>{completed++;}},noteHistoryController:{resume:async()=>{}},
    normalizeOwnerId:x=>x,buildServerSyncNotes:()=>[],serverAuthHeaders:()=>({}),
    renderServerStatus:noop,persistSettings:noop,renderServerSettings:noop,t:x=>x,
    fetch:async()=>{entered();return response;},applyPulledServerNotes:()=>{applied++;return {applied:0};},
    classifySyncFailureAction:()=>'',setServerRawMessage:noop});
  vm.runInContext(app.slice(syncStart,syncEnd),lateContext);
  const operation=vm.runInContext('syncWebNotesToServer(undefined,{skipFormSave:true})',lateContext);
  await Promise.race([requested,operation.then(()=>{throw Error('v1 response guard fixture failed before HTTP');})]);
  currentContext={...currentContext,owner:'bob',auth:'new-session'};lateContext.noteHistoryCaptureEpoch++;
  release({ok:true,json:async()=>({pushed_notes:[],pulled_notes:[]})});await operation;
  assert.equal(applied,0,`${surface}: a late v1 response must not apply to another authenticated context`);
  assert.equal(completed,0,`${surface}: a late v1 response must not acknowledge another context journal`);
}
const main = await read('desktop/main.cjs');
assert.ok(main.includes('nownote.history.v1'), 'IPC allowlist and CAS journal');
console.log('E3 integration source contracts PASS');
