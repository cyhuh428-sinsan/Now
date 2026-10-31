import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
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
  const syncContext=vm.createContext({vaultHistoryApplying:false,serverSyncRunning:true,serverSyncQueued:false,
    requireProtectionSettled:()=>{},
    noteHistoryCaptureChain:Promise.resolve(),noteHistory:{sync:async()=>{historyCalls++;}},noteHistoryController:{resume:async()=>{}},t:x=>x});
  const syncStart=app.indexOf('async function syncWebNotesToServer('),syncEnd=app.indexOf('\nfunction classifySyncFailureAction',syncStart);
  vm.runInContext(app.slice(syncStart,syncEnd),syncContext);
  await vm.runInContext('syncWebNotesToServer()',syncContext);
  assert.equal(historyCalls,0,`${surface}: automatic/manual sync must not start v2 while v1 is running`);
  assert.equal(syncContext.serverSyncQueued,true);
  syncContext.serverSyncQueued=false;syncContext.vaultHistoryApplying=true;
  await vm.runInContext('syncWebNotesToServer()',syncContext);
  assert.equal(historyCalls,0);
  assert.equal(syncContext.serverSyncQueued,false,`${surface}: Vault pause must not enqueue normal synchronization`);
  let currentContext={url:'https://server.test',owner:'alice',auth:'old-session',enabled:true},entered,release;
  const requested=new Promise(resolve=>{entered=resolve;}),response=new Promise(resolve=>{release=resolve;});
  let applied=0,completed=0;
  const noop=()=>{};
  const lateContext=vm.createContext({vaultHistoryApplying:false,serverSyncRunning:false,serverSyncQueued:false,noteHistoryCaptureEpoch:0,
    requireProtectionSettled:noop,
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
  const captureStart=app.indexOf('function noteHistoryCaptureDrafts('),captureEnd=app.indexOf('\nasync function noteHistoryFlush()',captureStart);
  assert.ok(captureStart>=0&&captureEnd>captureStart);
  const captureCtx={url:'https://synthetic.invalid',owner:'alice',device:'one',auth:'token',enabled:true,online:true};
  const raw={id:null,owner_id:'alice',local_id:'branch',device_id:'original',note_type:'tree',title:'Branch',content:'UNCHANGED\r\n',parent_local_id:null,level:1,tags:null,source:null,deleted_at:null,created_at:'2026-10-30T00:00:00.000001Z',updated_at:'2026-10-30T00:00:00.000001Z',client_updated_at:null};
  let wire={...raw,tags:'[]',source:'web-tree',client_updated_at:'2026-10-31T00:00:00.000002Z'},scheduled=0;
  const tree={id:'branch',shared:false,serverShared:false};
  const captureBox=vm.createContext({vaultHistoryApplying:false,crypto:webcrypto,structuredClone,Set,Map,
    noteHistoryProjection:false,noteHistoryContext:()=>captureCtx,noteHistoryCaptureEpoch:0,noteHistoryProjectionScope:'',
    noteHistoryCaptureChain:Promise.resolve(),noteHistoryEnrolling:new Set(),noteHistoryTimers:new Map(),noteHistoryRemoteCache:new Map(),noteHistoryLastError:'',
    noteHistoryWireNotes:()=>[structuredClone(wire)],noteProtectionBlocked:()=>false,findTreeNode:()=>tree,isTreeNodeSharedForServer:n=>n.shared,
    state:{data:{tree:[tree]},settings:{server:{}}},noteTitle:x=>x,tagsFromServerNote:n=>n.tags?JSON.parse(n.tags):[],
    setTimeout:()=>++scheduled,noteHistoryFlush:async()=>{},renderSyncStatusIndicator:noop,showNotice:noop});
  vm.runInContext(await read('web/vendor/note-history-state.js'),captureBox);
  const history=captureBox.NowNoteHistory.create({context:()=>captureCtx,request:async()=>{throw Error('no_network');},write:async()=>{}});
  captureBox.noteHistory=history;
  await history.track(raw,{head_version:0,head_revision_id:null,inventory_revision_ids:[],crypto_epoch:0,history_generation:1,snapshot:{schema_version:1,note:raw}},{localOnly:true});
  vm.runInContext(app.slice(captureStart,captureEnd),captureBox);
  vm.runInContext('noteHistoryCaptureDrafts()',captureBox);await captureBox.noteHistoryCaptureChain;
  assert.equal(captureBox.noteHistoryLastError,'');
  assert.equal(history.view('branch').draft.client_updated_at,null,`${surface}: passive projection must not rewrite the original client timestamp`);
  assert.equal(history.view('branch').dirty,false,`${surface}: normalized source/tags must not create a phantom unsent edit`);
  assert.equal(scheduled,0);
  wire={...wire,content:'ACTUAL-EDIT\r\n'};
  captureBox.vaultHistoryApplying=true;
  vm.runInContext('noteHistoryCaptureDrafts()',captureBox);await captureBox.noteHistoryCaptureChain;
  assert.equal(history.view('branch').draft.content,raw.content,`${surface}: Vault pause must preserve the prepared baseline`);
  captureBox.vaultHistoryApplying=false;
  vm.runInContext('noteHistoryCaptureDrafts()',captureBox);await captureBox.noteHistoryCaptureChain;
  assert.equal(history.view('branch').draft.content,wire.content);
  assert.equal(history.view('branch').draft.client_updated_at,wire.client_updated_at);
  assert.equal(history.view('branch').dirty,true);assert.equal(scheduled,1);
  const fresh=captureBox.NowNoteHistory.create({context:()=>captureCtx,request:async()=>{throw Error('no_network');},write:async()=>{}});
  captureBox.noteHistory=fresh;captureBox.findLocalNoteForServerNote=()=>({syncState:'pending'});captureBox.noteHistoryTimers.clear();scheduled=0;
  vm.runInContext('noteHistoryCaptureDrafts()',captureBox);await captureBox.noteHistoryCaptureChain;
  assert.equal(fresh.view('branch').dirty,true,`${surface}: first real local draft must still be enrolled`);
  assert.equal(scheduled,1,`${surface}: first local draft must retain its seal timer`);
  const shared=captureBox.NowNoteHistory.create({context:()=>captureCtx,request:async()=>{throw Error('no_network');},write:async()=>{}});
  await shared.track(raw,{head_version:0,head_revision_id:null,inventory_revision_ids:[],snapshot:{schema_version:1,note:raw}},{localOnly:true});
  captureBox.noteHistory=shared;captureBox.noteHistoryTimers.clear();scheduled=0;tree.shared=true;wire={...wire,content:raw.content};
  vm.runInContext('noteHistoryCaptureDrafts()',captureBox);await captureBox.noteHistoryCaptureChain;
  assert.equal(shared.view('branch').localOnly,false,`${surface}: explicit sharing changes must not be skipped`);
  assert.equal(scheduled,1);
}
const main = await read('desktop/main.cjs');
assert.ok(main.includes('nownote.history.v1'), 'IPC allowlist and CAS journal');
console.log('E3 integration source contracts PASS');
