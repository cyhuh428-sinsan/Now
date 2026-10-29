import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';

let source = '';
try { source = await readFile(new URL('../vendor/note-history-state.js', import.meta.url), 'utf8'); } catch {}
const box = { crypto: webcrypto, structuredClone, TextEncoder };
vm.runInNewContext(source, box);
const H = box.NowNoteHistory;
assert.ok(H, 'E3 note journal must exist');
let ctx = { url: 'https://server.test', owner: 'alice', device: 'one', enabled: true, auth: 'session' };
let saved, failWrite = false, loseResponse = false, release;
let remote = null, version = 0;
const receipts = new Map(), calls = [];
const stamp = '2026-10-29T01:02:03.123456Z';
const note = content => ({ id: null, owner_id: 'alice', local_id: 'daily:/원문', device_id: 'one',
  note_type: 'daily', title: 'title', content, parent_local_id: null, level: 1,
  tags: 'kind=tree;tags=a,b', source: null, deleted_at: null, client_updated_at: stamp, created_at: stamp, updated_at: stamp });
const request = async (context, path, method, body) => {
  calls.push(structuredClone({ context, path, method, body }));
  if (path === 'current' && method === 'GET') {
    if (!remote) throw Object.assign(new Error('missing'), { status: 404 });
    return structuredClone(remote);
  }
  if (path === 'revision') return { snapshot: structuredClone(remote.snapshot) };
  if (receipts.has(body.mutation_id)) return structuredClone(receipts.get(body.mutation_id));
  if (path === 'revisions/import') return { status: 'ok', imported_refs: body.entries.map(e => ({ kind: 'offline_branch', id: e.revision_id })) };
  if (release) await new Promise(resolve => { release = resolve; });
  if (body.base_head_version !== version) throw Object.assign(new Error('version_conflict'), { status: 409, code: 'version_conflict' });
  const id = webcrypto.randomUUID(); version++;
  const value = path === 'restore' ? remote.snapshot.note : body.note;
  remote = { snapshot: { schema_version: 1, note: { ...note(value.content), ...value, id: 1 } },
    head_version: version, head_revision_id: id, inventory_revision_ids: [id], replica_count: 1,
    protection_state: 'legacy', crypto_epoch: 0, history_generation: version };
  const receipt = { mutation_id: body.mutation_id, result_revision_id: id, result_head_version: version,
    result_inventory_revision_ids: [id], crypto_epoch: 0, history_generation: version };
  receipts.set(body.mutation_id, structuredClone(receipt));
  if (loseResponse) { loseResponse = false; throw new Error('response lost'); }
  return receipt;
};
const make = (initial = saved) => H.create({ initial, context: () => ctx, request,
  write: async value => { if (failWrite) throw new Error('disk full'); saved = structuredClone(value); } });
let store = make();
await store.track(note('initial'), null);
await store.edit(note('draft'));
assert.equal(saved.contexts[H.key(ctx)].notes['daily:/원문'].draft.content, 'draft');
assert.equal(JSON.stringify(saved).includes('session'), false, 'auth must not persist');
await store.seal('daily:/원문');
assert.equal(store.view('daily:/원문').revisions.length, 1);
loseResponse = true;
await store.sync();
const sent = JSON.stringify(store.view('daily:/원문').outbox[0].body);
assert.equal(store.view('daily:/원문').outbox[0].sent, true);
store = make();
await store.edit(note('after restart'));
await store.seal('daily:/원문');
await store.sync();
assert.equal(store.view('daily:/원문').outbox.length, 0);
assert.equal(remote.snapshot.note.content, 'after restart');
assert.equal(calls.filter(c => c.path === 'current' && c.method === 'PUT').some(c => JSON.stringify(c.body) === sent), true);
assert.equal(store.view('daily:/원문').draft.tags, 'kind=tree;tags=a,b');
assert.equal(store.view('daily:/원문').draft.client_updated_at, stamp);
assert.equal(store.view('daily:/원문').draft.source, null);
version++; remote.head_version = version; remote.head_revision_id = webcrypto.randomUUID(); remote.inventory_revision_ids = [remote.head_revision_id];
remote.snapshot.note.content = 'external clean update';
await store.sync();
assert.equal(store.view('daily:/원문').draft.content, 'external clean update', 'clean managed note must receive a later device head');

await store.edit(note('conflict draft')); await store.seal('daily:/원문');
version++; remote.head_version = version; remote.head_revision_id = webcrypto.randomUUID(); remote.inventory_revision_ids = [remote.head_revision_id];
await store.sync();
assert.equal(store.view('daily:/원문').outbox.length, 1);
assert.equal(store.view('daily:/원문').conflict.code, 'version_conflict');
assert.equal(store.view('daily:/원문').draft.content, 'conflict draft');

failWrite = true;
await assert.rejects(store.edit(note('unsaved')), /disk full/);
assert.equal(store.view('daily:/원문').draft.content, 'unsaved', 'memory draft retained');
const count = calls.length; await store.sync(); assert.equal(calls.length, count, 'failed writer cannot transmit');
failWrite = false;
ctx = { ...ctx, owner: 'bob' };
assert.equal(store.view('daily:/원문'), null);
ctx = { ...ctx, owner: 'alice', enabled: false, auth: '' }; store.invalidate();
assert.equal(store.view('daily:/원문'), null, 'logged out journal hidden');
ctx = { ...ctx, enabled: true, auth: 'reauth' };
store = make();
assert.equal(store.view('daily:/원문').draft.content, 'conflict draft');
assert.equal(store.view('daily:/원문').revisions.length, 3);
const unknown = make({ schema_version: 99, untouched: 'original' });
assert.equal(unknown.export().untouched, 'original');
await assert.rejects(unknown.track(note('x'), null), /지원하지/);
for (const broken of [{schema_version:1,contexts:{bad:{notes:[]}}},
  {schema_version:1,contexts:{bad:{notes:{n:{draft:null}}}}}]) {
  const malformed = make(broken);
  assert.equal(malformed.status().unsupported, true, 'malformed journal must be preserved without transmission');
  assert.deepEqual(malformed.export(), broken);
}
assert.equal(typeof store.compare, 'function', 'conflicts need explicit version-bound comparison');
const comparison = await store.compare('daily:/원문');
assert.equal(comparison.remote.head_version, version);
const exported = store.export();
store.suspend();
assert.equal(store.export(), null, 'logout must release in-memory journal');
assert.equal(store.view('daily:/원문'), null);
store.hydrate(exported);
await store.import(exported);
assert.equal(store.view('daily:/원문').outbox.length, 1, 'backup restore must retain immutable outbox');
assert.equal(store.view('daily:/원문').conflict.code, 'version_conflict');
await store.importPending('daily:/원문');
assert.equal(store.view('daily:/원문').revisions.every(r => r.imported), true);
const remoteRevision = { kind: 'note_revision', id: remote.head_revision_id };
const beforeRevisions = store.view('daily:/원문').revisions.length;
ctx = { ...ctx, enabled: false };
await assert.rejects(store.restore('daily:/원문', remoteRevision, remote), /인증/);
ctx = { ...ctx, enabled: true };
assert.equal(store.view('daily:/원문').revisions.length, beforeRevisions);
const restoredReceipt = await store.restore('daily:/원문', remoteRevision, comparison.remote);
assert.ok(restoredReceipt?.result_revision_id, 'restore must return its own fixed receipt');
assert.equal(store.view('daily:/원문').dirty, false, 'confirmed restore cannot leave the old draft pending');
assert.equal(store.view('daily:/원문').draft.content, remote.snapshot.note.content);
await store.edit(note('conflict draft'));
await store.seal('daily:/원문');
assert.equal(store.view('daily:/원문').outbox.length, 1, 'editing back to a pre-restore sealed value must enqueue a new revision');
await store.sync();
assert.equal(remote.snapshot.note.content, 'conflict draft');
assert.equal(store.view('daily:/원문').dirty, false);
const baselineStore = make(null);
await baselineStore.track(note('offline unconfirmed'), null, { needsBaseline: true });
assert.equal(baselineStore.view('daily:/원문').needsBaseline, true, 'unconfirmed baseline persists before network');
await baselineStore.edit(note('new local edit'));
await baselineStore.seal('daily:/원문');
await baselineStore.bindBaseline('daily:/원문', remote);
assert.equal(baselineStore.view('daily:/원문').draft.content, 'new local edit');
assert.equal(baselineStore.view('daily:/원문').conflict.code, 'baseline_selection_required');
for (const reauthenticate of [false, true]) {
  let rejectGet, entered, durable;
  const waiting = new Promise(resolve => { entered = resolve; });
  let authContext = { ...ctx };
  const isolated = H.create({ initial: null, context: () => authContext,
    write: async value => { durable = structuredClone(value); },
    request: async () => { entered(); return new Promise((_resolve, reject) => { rejectGet = reject; }); } });
  await isolated.track(note('logout baseline'), null, { needsBaseline: true });
  const beforeLogout = structuredClone(durable), operation = isolated.sync();
  await waiting; authContext = { ...authContext, enabled: false }; isolated.suspend();
  if (reauthenticate) { authContext = { ...ctx, auth: 'new real session' }; isolated.hydrate(durable); }
  rejectGet(new Error('late baseline failure')); await operation;
  assert.deepEqual(durable, beforeLogout, 'late baseline errors must not overwrite a logged-out or reauthenticated journal');
}
for (const phase of ['import', 'put']) {
  let block = false, resume, entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  const sent = [];
  const isolated = H.create({ initial: null, context: () => ctx,
    write: async () => { if (block) { entered(); await new Promise(resolve => { resume = resolve; }); } },
    request: async (_ctx, path, _method, body) => {
      sent.push(path);
      if (path === 'revisions/import') return { imported_refs: body.entries.map(e => ({kind: 'offline_branch', id: e.revision_id})) };
      throw new Error('obsolete request must not be sent');
    } });
  await isolated.track(note('generation draft'), null); await isolated.seal('daily:/원문');
  if (phase === 'put') await isolated.importPending('daily:/원문');
  sent.length = 0; block = true;
  const operation = phase === 'import' ? isolated.importPending('daily:/원문') : isolated.sync();
  await waiting; isolated.invalidate(); block = false; resume(); await operation;
  assert.deepEqual(sent, [], `${phase}: context invalidation during storage must prevent a not-yet-sent request`);
}
{
  let durable, sends=0;
  const options={context:()=>ctx,write:async value=>{durable=structuredClone(value);},request:async()=>{sends++;throw new Error('v2 blocked');}};
  let isolated=H.create({...options,initial:null});
  assert.equal(typeof isolated.beginLegacy,'function','v1 uncertainty must have a durable journal boundary');
  const body={owner_id:ctx.owner,device_id:ctx.device,notes:[note('V1_IN_FLIGHT')],updated_after:null,include_deleted:true};
  const pending=await isolated.beginLegacy(body);
  body.notes[0].content='must not mutate captured request';
  await isolated.track(note('NEW_DRAFT'),null,{needsBaseline:true});await isolated.seal('daily:/원문');
  await isolated.sync();assert.equal(sends,0);
  isolated=H.create({...options,initial:durable});
  assert.equal(isolated.legacyPending().body.notes[0].content,'V1_IN_FLIGHT');
  await isolated.sync();assert.equal(sends,0,'v1 uncertainty survives cold restart');
  await assert.rejects(isolated.compare('daily:/원문'),/기존 동기화/);
  await assert.rejects(isolated.importPending('daily:/원문'),/기존 동기화/);
  await assert.rejects(isolated.completeLegacy('different-id'),/요청/);
  assert.equal(isolated.legacyPending().id,pending.id);
  await isolated.completeLegacy(pending.id);assert.equal(isolated.legacyPending(),null);
}
for (const phase of ['compare', 'import', 'target', 'restore']) {
  let releasePhase, entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  let current = {head_version:1, head_revision_id:webcrypto.randomUUID(), inventory_revision_ids:[],crypto_epoch:0,replica_count:1,
    snapshot:{schema_version:1,note:note('CURRENT')}};
  current.inventory_revision_ids=[current.head_revision_id];
  const compared=structuredClone(current), target={schema_version:1,note:note('TARGET')};
  let paused=false;
  const isolated=H.create({initial:null,context:()=>ctx,write:async()=>{},request:async(_ctx,path,method,body)=>{
    const point=path==='current'&&method==='GET'?'compare':path==='revision'?'target':path==='revisions/import'?'import':path;
    if(point===phase&&!paused){paused=true;entered();await new Promise(resolve=>{releasePhase=resolve;});}
    if(path==='current')return structuredClone(current);
    if(path==='revisions/import')return {imported_refs:body.entries.map(r=>({kind:'offline_branch',id:r.revision_id}))};
    if(path==='revision')return structuredClone(target);
    const id=webcrypto.randomUUID();current={...current,head_version:2,head_revision_id:id,inventory_revision_ids:[id],snapshot:target};
    return {mutation_id:body.mutation_id,result_head_version:2,result_revision_id:id,result_inventory_revision_ids:[id],crypto_epoch:0};
  }});
  await isolated.track(note('CURRENT'),current);await isolated.edit(note('START_DRAFT'));
  const operation=isolated.restore('daily:/원문',{kind:'note_revision',id:compared.head_revision_id},compared);
  await waiting;await isolated.edit(note('FOLLOWUP_DRAFT'));releasePhase();await operation;
  assert.equal(isolated.view('daily:/원문').draft.content,'FOLLOWUP_DRAFT',`${phase}: later edit must survive the entire restore operation`);
  assert.ok(isolated.view('daily:/원문').revisions.some(r=>r.snapshot.note.content==='START_DRAFT'),`${phase}: restore-start draft must remain visible in history`);
}
console.log('E3 journal: draft durability, immutable retry/restart, CAS conflict, raw DTO, account isolation, failure retention PASS');
