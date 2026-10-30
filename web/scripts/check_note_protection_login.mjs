import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';

let passed = 0;
for (const file of ['../app.js', '../../desktop/app/app.js']) {
const source = await fs.readFile(new URL(file, import.meta.url), 'utf8');
const start = source.indexOf('async function loadServerSharedNotes(');
assert.ok(start >= 0);
const rest = source.slice(start);
const next = /\n(?:async )?function [A-Za-z]/.exec(rest);
const fn = rest.slice(0, next.index);
const make = () => {
  let restored = false;
  const box = {
    state: { settings: { server: { ownerId: 'alice', deviceId: 'web', url: 'https://qa.invalid' } }, data: { tree: [] }, expandedTreeIds: new Set(), selectedDeletedTreeIds: new Set() },
    scope: { owner: 'alice', url: 'https://qa.invalid', auth: 'alice-token', enabled: true },
    libraryContext: () => ({ ...box.scope }), NowLibrary: { key: c => JSON.stringify([c.url,c.owner]) },
    noteHistoryContext: () => ({ ...box.scope, enabled: box.noteHistoryAuthenticated }),
    NowNoteHistory: { key: c => JSON.stringify([c.url,c.owner]) },
    noteHistoryAuthenticated: false, noteHistoryCaptureEpoch: 0, noteHistoryRemoteCache: new Map(),
    noteHistoryProjectionScope: '', libraryNotesContext: '', hostedWebSyncSuspended: false, libraryStore: null,
    prepareServerRequest: () => true, renderServerStatus() {}, t: v => v, normalizeOwnerId: v => v,
    requestServerJson: async () => ({ pulled_notes: [{local_id:'protected'}, {local_id:'ordinary'}], server_time: 'fixed' }),
    defaultData: () => ({ tree: [] }), isHostedWebClient: () => true,
    noteHistoryController: { resume: async () => { if (box.noteHistoryAuthenticated) restored = true; } },
    projected: [], writes: 0,
    applyPulledServerNotes: rows => {
      box.projected = rows.filter(row => !(row.local_id === 'protected' && restored && box.noteHistoryAuthenticated)).map(row => row.local_id);
      return {applied:box.projected.length, skipped:rows.length-box.projected.length};
    },
    markServerSyncedNotes() {}, setServerMessage() {}, persist() { box.writes++; }, persistSettings() {}, render() {}, renderServerSettings() {},
  };
  vm.createContext(box);
  vm.runInContext(fn + '\nglobalThis.run=loadServerSharedNotes;', box);
  return box;
};

const first = make();
await first.run({replace:true});
assert.deepEqual(first.projected, ['ordinary'], 'protected cache must not be projected before its authenticated journal');

const deferred = () => { let resolve; const promise=new Promise(r=>resolve=r); return {promise,resolve}; };
for (const point of ['response','resume']) {
  const box=make(), entered=deferred(), gate=deferred();
  if(point==='response') box.requestServerJson=async()=>{entered.resolve();await gate.promise;return {pulled_notes:[{local_id:'protected'}]};};
  else box.noteHistoryController.resume=async()=>{entered.resolve();await gate.promise;};
  const pending=box.run({replace:true});
  await entered.promise;
  box.scope={...box.scope,owner:'bob',auth:'bob-token'};
  box.state.settings.server={...box.state.settings.server,ownerId:'bob'};
  box.state.data={tree:[{id:'bob-original'}]};
  gate.resolve();
  await assert.rejects(pending, /변경|인증|계정/);
  assert.equal(box.state.data.tree[0].id,'bob-original');
  assert.equal(box.writes,0);
}
const denied = make();
denied.requestServerJson = async () => { throw Error('unauthenticated'); };
await assert.rejects(denied.run({replace:true}), /unauthenticated/);
assert.equal(denied.noteHistoryAuthenticated, false);
assert.equal(denied.writes, 0);

const desktop = make();
desktop.isHostedWebClient = () => false;
desktop.scope.enabled = false;
await desktop.run({replace:true});
assert.equal(desktop.noteHistoryAuthenticated, false);
assert.equal(desktop.writes, 1);
passed += 5;
}
console.log(`재로그인 이력 복원 경계: ${passed} PASS (양쪽 합성 함수 검사)`);
