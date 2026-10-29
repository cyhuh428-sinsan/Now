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
}
const main = await read('desktop/main.cjs');
assert.ok(main.includes('nownote.history.v1'), 'IPC allowlist and CAS journal');
console.log('E3 integration source contracts PASS');
