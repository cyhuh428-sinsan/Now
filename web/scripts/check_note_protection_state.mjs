import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
const box = { crypto: webcrypto, structuredClone, TextEncoder, TextDecoder, Uint8Array, atob, btoa };
for (const file of ['note-protection-protocol.js','note-protection-state.js','note-history-state.js']) {
  vm.runInNewContext(await readFile(new URL('../vendor/' + file, import.meta.url), 'utf8'), box);
}
const P = box.NowNoteProtectionState;
assert.ok(P, 'E4b2 durable state runtime required');
const copy = v => structuredClone(v);
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope = { url: 'https://synthetic.invalid', owner: 'alice', instance: uid(1), local_id: 'target', device: 'one' };
let context = { ...scope, enabled: true, auth: 'session-one' };
const secret = 'SYNTHETIC-ORIGINAL-\uFEFF\r\n';
const needle = 'SYNTHETIC-ORIGINAL-';
const password = 'synthetic-only';
const ui = { id: 'target', title: 'original title', content: secret, parentId: null, level: 1, children: [], updatedAt: 'original-time', protectionScope: scope };
const other = { ...copy(ui), id: 'other', content: 'preserve-other', protectionScope: { ...scope, local_id: 'other' } };
const item = { raw: { owner_id: 'alice', local_id: 'target', content: secret }, draft: { owner_id: 'alice', local_id: 'target', content: secret },
  base: { inventory_revision_ids: [], server_instance_id: uid(1) }, revisions: [{ revision_id: uid(9), snapshot: { note: { content: secret } } }],
  outbox: [{ body: { mutation_id: uid(10), note: { content: secret } }, sent: true }], receipts: [], conflict: { local: { content: secret } } };
let saved = { schema_version: 1, contexts: { [box.NowNoteHistory.key(scope)]: { notes: { target: copy(item) } } } };
let db = { data: { tree: [copy(ui), copy(other)], snapshots: [{ data: { tree: [copy(ui)] }, history: copy(saved) }] },
  settings: { server: { url: scope.url, ownerId: scope.owner, serverInstanceId: scope.instance,
    analysisJobs: [{ id: 3, owner_id: 'alice', note_local_id: 'target', input_text: secret, result_json: secret, error_message: null }] } },
  fallback: { tree: [copy(ui)] } };
let writeFail = false, casFail = false, loseCommit = false, commitCalls = 0, stageCalls = 0, requestOrder = [], pendingRuns = 1;
const journal = box.NowNoteHistory.create({ initial: saved, context: () => ({ ...context, online: false }), request: async () => {},
  write: async value => { if (writeFail) throw Error('quota'); saved = copy(value); } });
const stores = () => ['data','settings','fallback','history'].map(name => ({ name, kind: name === 'settings' ? 'settings' : name === 'history' ? 'history' : 'data',
  read: async () => copy(name === 'history' ? journal.export() : db[name]),
  cas: async (expected, next) => {
    if (casFail && name === 'settings') throw Error('CAS');
    if (JSON.stringify(expected) !== JSON.stringify(name === 'history' ? journal.export() : db[name])) throw Error('CAS');
    if (name === 'history') await journal.replaceProtectionStore(expected, next);
    else db[name] = copy(next);
  } }));
let committed = false, matchesCurrent = true;
const remote = {
  async drainPrepare() { requestOrder.push('drain'); return { drain_id: uid(2), drain_version: 1, accepted_runs: [uid(7)], accepted_claims: [], state: pendingRuns ? 'draining' : 'ready', pending_count: pendingRuns }; },
  async drainStatus() { requestOrder.push('drain-status'); return { drain_id: uid(2), drain_version: 1, accepted_runs: [uid(7)], accepted_claims: [], state: pendingRuns ? 'draining' : 'ready', pending_count: pendingRuns }; },
  async fresh() { requestOrder.push('fresh'); return { verified: true }; },
  async prepare() { requestOrder.push('prepare'); return { operation_id: uid(3), state: 'prepared', promoted: true }; },
  async stage() { requestOrder.push('stage'); stageCalls++; return { verified: true }; },
  async status() { requestOrder.push('status'); return { operation_id: uid(3), state: committed ? 'committed' : 'prepared', receipt_matches_current: matchesCurrent, receipt: committed ? { operation_id: uid(3) } : null }; },
  async commit() { requestOrder.push('commit'); commitCalls++; committed = true; if (loseCommit) { loseCommit = false; throw Error('response lost'); } return this.status(); },
};
const create = () => P.create({ context: () => context, journal, stores, remote, preflight: async () => {} });
let controller = create(), id;
const build = async () => ({ synthetic_cipher_bundle: true });
const intent = { schema_version: 3, purpose: 'mixed_conversion', drain: { mutation_id: uid(4) }, prepare: { mutation_id: uid(5) } };
await assert.rejects(() => controller.start(scope, intent, ''), /key/);
assert.equal(Object.keys(journal.protectionOperations()).length, 0);
id = await controller.start(scope, intent, password);
assert.ok(controller.blocked('target'));
assert.ok(!JSON.stringify(journal.protectionOperations()).includes(needle));
assert.ok(!JSON.stringify(journal.protectionOperations()).includes(password));
await assert.rejects(() => controller.resume(id, password, build), /unsettled/);
assert.deepEqual(requestOrder, ['drain','drain-status']);
assert.equal(db.data.tree[0].content, secret);
pendingRuns = 0; loseCommit = true;
await assert.rejects(() => controller.resume(id, password, build), /response lost/);
assert.equal(controller.status(id).phase, 'committing');
assert.equal(db.data.tree[0].content, secret);
assert.equal(commitCalls, 1);
controller = create(); casFail = true;
await assert.rejects(() => controller.resume(id, password, build), /CAS/);
assert.equal(controller.status(id).phase, 'applying');
assert.ok(!JSON.stringify(db.data).includes(needle));
assert.equal(db.settings.server.analysisJobs[0].input_text, secret);
assert.equal(db.data.tree[1].content, 'preserve-other');
casFail = false;
context = { ...scope,owner:'bob',auth:'bob-while-alice-pending',enabled:true };
assert.equal(controller.pending(),0,'Main-R3 another account must not inherit pending locks');
assert.equal(controller.blocked('target'),false);
await journal.track({owner_id:'bob',local_id:'bob-note',content:'Bob normal draft'},null);
assert.equal(journal.entries()['bob-note'].draft.content,'Bob normal draft');
assert.ok(journal.export().protection_operations[id],'Alice pending marker must survive Bob saves');
context = { ...scope,enabled:true,auth:'alice-returned' };
assert.equal(controller.pending(),1);
const previousCipher = db.data.tree[0].protection_record.ciphertext;
db.data.tree[0].protection_record.ciphertext = 'NOW_ENCRYPTED_V1:eA==';
db.data.tree[0].content = 'NOW_ENCRYPTED_V1:eA==';
await assert.rejects(()=>controller.resume(id,password,build),/local_cipher_changed/,'unknown same-ID cipher must not be adopted');
db.data.tree[0].protection_record.ciphertext = previousCipher;
db.data.tree[0].content = previousCipher;
matchesCurrent = false; controller = create();
await assert.rejects(() => controller.resume(id,password,build),/current/,'Review-I2 stale committed receipt cannot resume local apply');
assert.equal(db.settings.server.analysisJobs[0].input_text,secret);
matchesCurrent = true; await controller.resume(id, password, build);
assert.equal(controller.status(id).phase, 'complete');
assert.equal(commitCalls, 1); assert.equal(stageCalls, 1);
for (const value of [db.data, db.settings, db.fallback, journal.export()]) assert.ok(!JSON.stringify(value).includes(needle));
assert.equal(db.data.tree[1].content, 'preserve-other');
assert.equal(db.data.tree[0].updatedAt, 'original-time');
assert.ok(journal.blocked('target')); // Cipher archive is never fed to the old v1 writer.
assert.throws(()=>P.protectedRecord({...copy(db.data.tree[0]),draft:{content:needle}}),/fields|copy/,'a cipher wrapper must not hide extra plaintext copies');
assert.deepEqual(requestOrder.slice(0, 6), ['drain','drain-status','drain-status','fresh','prepare','stage']);
const before = JSON.stringify(journal.export());
context = { ...context, owner: 'bob', auth: 'session-bob' };
await assert.rejects(() => controller.resume(id, password, build), /scope/);
assert.equal(JSON.stringify(journal.export()), before);
context = { ...scope, enabled: true, auth: 'session-restored' };
await controller.resume(id, password, build);
await assert.rejects(() => controller.resume(id, 'wrong', build));
const ambiguous = copy(ui); delete ambiguous.protectionScope;
assert.throws(() => P.inventory({ tree: [ambiguous] }, 'data', scope), /scope_unverified/);
const archive = await box.NowNoteProtectionProtocol.decryptContent(db.data.tree[0].protection_record.ciphertext, password);
assert.ok(archive.includes(secret.replace(/\r/g, '\\r').replace(/\n/g, '\\n')));
writeFail = true;
await assert.rejects(() => controller.start({ ...scope, local_id: 'new' }, intent, password));
assert.equal(controller.blocked('new'), false);
const protectedParent = copy(db.data.tree[0]); protectedParent.id = 'parent';
protectedParent.protection_record.scope = { ...scope, owner: 'other-owner', local_id: 'parent' };
protectedParent.protectionScope = copy(protectedParent.protection_record.scope);
protectedParent.children = [copy(ui)];
assert.equal(P.inventory({ tree: [protectedParent] },'data',scope).length,1,'Main-R1 protected parent must not hide an independent child');
const foreign = copy(ui); foreign.protectionScope = {...scope,owner:'bob'};
assert.equal(P.inventory({tree:[foreign]},'data',scope).length,0,'known other-owner copies are preserved');
const unknownChild = copy(ui); delete unknownChild.protectionScope;
assert.throws(()=>P.inventory({tree:[{id:'parent',protectionScope:{...scope,local_id:'parent'},children:[unknownChild]}]},'data',scope),/scope_unverified/,'a parent is not exact-copy attribution evidence');
// Exercise the production wire adapter, not only the injected state-machine remote.
const Q = box.NowNoteProtectionProtocol;
const lk = { kind: 'recording_transcript', id: '8', slot: 'transcript' };
const binding = (operation,epoch) => ({ server_instance_id: scope.instance, owner_id: scope.owner, local_id: scope.local_id,
  transition_id: operation, crypto_epoch: epoch, destination_key: lk, revision_ref: null, parent_ref: null });
const dest = (operation,epoch) => ({ key: lk, output_kind: 'linked_text_envelope_v1', output_epoch: epoch,
  is_null: false, expected_binding: binding(operation,epoch), operation_origin: null });
const makeDescriptor = async (raw,operation,epoch) => ({ key: lk, representation_kind: 'linked_text_envelope_v1', representation_epoch: epoch,
  representation_version: epoch, representation_etag: uid(21 + epoch), is_null: false, ciphertext_sha256: await Q.sha256(raw),
  storage_operation_id: operation, semantic_origin_id: null, origin_validator: 'linked_v1', origin_row_required: false,
  expected_binding: binding(operation,epoch), revision_ref: null, parent_ref: null, physical_note_id: null, inventory_revision_id: null, linked_slot_version: epoch });
const sourceText = '\uFEFForiginal transcript\r\n';
const oldRaw = await Q.encryptRepresentation(sourceText,dest(uid(20),1),password), newRaw = await Q.encryptRepresentation(sourceText,dest(uid(3),2),password);
const sd = await makeDescriptor(oldRaw,uid(20),1), td = await makeDescriptor(newRaw,uid(3),2);
const b0 = { head_version: 0, head_revision_id: null, crypto_epoch: 1, history_generation: 1, protection_state: 'protected', inventory_revision_ids: [], identity_state: 'related_only', current_exists: false };
const b3 = { base: b0, current_mode: 'absent', selected_physical_note_id: null, mixed_metadata_version: 1 };
const dd = { destination_key: lk, source_keys: [lk], source_etag: uid(30), output_kind: 'linked_text_envelope_v1', output_epoch: 2, is_null: false, expected_binding: binding(uid(3),2) };
const header = { schema_version: 3, purpose: 'mixed_conversion', operation_id: uid(3), mutation_id: uid(5), server_instance_id: scope.instance,
  owner_id: scope.owner, local_id: scope.local_id, actor_device_id: scope.device, base: b3, target_epoch: 2, target_current_mode: 'absent',
  drain_ref: { drain_id: uid(2), drain_version: 1 }, selection: null, server_fields: null, revision_ref: null, parent_ref: null, reserved_branches: [] };
const sets = { S: [{ descriptor: sd, source_etag: uid(31) }], DSET: [dd], P: [], O: [{ destination_key: lk, is_null: false,
  origin_validator: 'linked_v1', origin_row_required: false, storage_operation_id: uid(3), semantic_origin_id: null }] };
const md = await Q.hashJson({ ...header,...sets });
const setDigests = Object.fromEntries(await Promise.all(Object.entries(sets).map(async ([name,list]) => [name,await Q.hashJson(list)])));
const wireResponse = { schema_version: 3, purpose: 'mixed_conversion', operation_id: uid(3), state: 'prepared', lease_version: 1,
  metadata_header: header, counts: Object.fromEntries(Object.entries(sets).map(([name,list]) => [name,{ total: list.length }])),
  set_digests: setDigests, metadata_manifest_digest: md };
let wireState = 'prepared', sourceReads = 0, uploads = [];
const resultBase = { ...b3,base:{ ...b0,crypto_epoch:2,head_version:1,history_generation:2 } };
const supportedKinds = ['analysis_error','analysis_input','analysis_result','inventory_snapshot','note_body','offline_snapshot','recording_transcript','reserved_offline_snapshot','revision_before','revision_snapshot'];
const resultDigest = await Q.hashJson({ server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,context:resultBase,entries:[td] });
const wire = P.createRemote({ request: async (s,path,method,body) => {
  assert.equal(s.owner,'alice');
  if (path.endsWith('/related-drains/status')) return { drain_id: uid(2), drain_version: 1, state: 'promoted', transition_id: uid(3), accepted_runs: [], accepted_claims: [] };
  if (path.endsWith('/mixed-representations/context')) return { server_instance_id: scope.instance, context: wireState === 'committed' ? resultBase : b3, catalog_digest: wireState === 'committed' ? resultDigest : 'c'.repeat(64) };
  if (path.endsWith('/mixed-representations/catalog')) return { schema_version:3,context:resultBase,catalog_digest:resultDigest,entries:[td],next_cursor:null,
    counts:{ total:1,nonnull:1,nulls:0,by_kind:supportedKinds.map(kind => ({kind,total:kind === lk.kind ? 1 : 0,nonnull:kind === lk.kind ? 1 : 0,nulls:0})) },
    coverage:{ supported_kinds:supportedKinds,scope_complete:true,full_protection_complete:false } };
  if (path.endsWith('/prepare')) return copy(wireResponse);
  if (path.endsWith('/manifest')) return { ...copy(wireResponse), section: body.section, entries: copy(sets[body.section]), next_cursor: null };
  if (path.endsWith('/source')) { sourceReads++; return { schema_version: 3, operation_id: uid(3), metadata_manifest_digest: md,
    entry_key: lk, source_etag: uid(31), descriptor: copy(sd), total_bytes: Buffer.byteLength(oldRaw), total_chunks: 1, chunk_index: 0, data_base64: Buffer.from(oldRaw).toString('base64') }; }
  if (path.endsWith('/chunks')) { uploads.push(copy(body)); return { chunk_index: body.chunk_index, source_etag: body.source_etag }; }
  if (path.endsWith('/entries/seal')) return { sealed: true, ciphertext_sha256: body.ciphertext_sha256 };
  if (path.endsWith('/staged')) return { total_bytes: Buffer.byteLength(newRaw), total_chunks: 1, chunk_index: 0,
    ciphertext_sha256: td.ciphertext_sha256, source_etag: uid(30), data_base64: Buffer.from(newRaw).toString('base64') };
  if (path.endsWith('/commit')) wireState = 'committed';
  if (path.endsWith('/commit') || path.endsWith('/status')) return { operation_id: uid(3), state: wireState,
    receipt_matches_current:true,current_context:{ ...resultBase,server_instance_id:scope.instance,active_operation_id:null },
    receipt: wireState === 'committed' ? { owner_id: scope.owner, local_id: scope.local_id, server_instance_id: scope.instance, operation_id: uid(3), metadata_manifest_digest: md,result:resultBase } : null };
  throw Error('unexpected path ' + path);
} });
const wireIntent = { schema_version: 3, purpose: 'mixed_conversion', prepare: { base: b3, expected_catalog_digest: 'c'.repeat(64), mutation_id: uid(5), target_epoch: 2, target_current_mode: 'absent', reserved_branches: [] } };
const ready = { drain_id: uid(2), drain_version: 1, accepted_runs: [], accepted_claims: [], ready_base: b0 };
const fresh = await wire.fresh(scope,wireIntent,ready), prepared = await wire.prepare(scope,wireIntent,ready,fresh);
const c = [{ entry_key: lk, destination_key: lk, source_etag: uid(30), output_kind: dd.output_kind, target_epoch: 2, total_bytes: Buffer.byteLength(newRaw), ciphertext_sha256: td.ciphertext_sha256 }];
const work = { transfers: [{ key: lk, raw: newRaw, descriptor: td, origin: { value: null, legacy: null }, semantic: sourceText }], source_origins: [],
  commit: { schema_version: 3, owner_id: scope.owner, local_id: scope.local_id, device_id: scope.device, server_instance_id: scope.instance,
    operation_id: uid(3), metadata_manifest_digest: md, client_verified_ciphertext_manifest_digest: await Q.hashJson(c), client_decryption_verified: true } };
await wire.stage(scope,prepared,work,password);
assert.ok(sourceReads > 0); assert.equal(uploads.length,1);
assert.ok(!JSON.stringify(uploads).includes(sourceText));
assert.equal((await wire.commit(scope,prepared,work)).state,'committed');
const wrong = copy(work); wrong.transfers[0].semantic = 'changed original';
await assert.rejects(() => wire.stage(scope,prepared,wrong,password),/semantic/);
await assert.rejects(() => wire.fresh(scope,{ ...wireIntent, prepare: { ...wireIntent.prepare, expected_catalog_digest: '0'.repeat(64) } },ready),/context_changed/);
const base2 = { ...b0,crypto_epoch:0,head_version:0,protection_state:'legacy' };
const linkedRaw = await Q.encryptRepresentation(sourceText,dest(uid(3),1),password), linkedD = await makeDescriptor(linkedRaw,uid(3),1);
const entry2 = { key:lk,source_etag:uid(30),source_kind:'plain_text_v1',output_kind:'linked_text_envelope_v1',representation_epoch:0,
  destination_key:lk,expected_binding:binding(uid(3),1),operation_origin:null,slot_version:1 };
const header2 = { schema_version:2,purpose:'conversion',transition_id:uid(3),server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,
  actor_device_id:scope.device,base:base2,target_epoch:1,drain_ref:{drain_id:uid(2),drain_version:1},linked_metadata_version:1 };
const sets2 = { entries:[entry2],null_slots:[],origin_expectations:[{destination_key:lk,is_null:false,origin_row_required:false,semantic_origin_id:null}],
  linked_expectations:[{key:lk,source_slot_version:1,target_slot_version:2,is_null:false,source_kind:'plain_text_v1',target_kind:'linked_text_envelope_v1',target_epoch:1,storage_operation_id:uid(3)}] };
const md2 = await Q.hashJson({...header2,...sets2});
const response2 = { transition_id:uid(3),schema_version:2,server_instance_id:scope.instance,state:'ready',target_epoch:1,metadata_context:header2,
  metadata_manifest_digest:md2,set_counts:Object.fromEntries(Object.entries(sets2).map(([k,v])=>[k,v.length])) };
const final2 = { ...base2,crypto_epoch:1,head_version:1,history_generation:2,protection_state:'protected',server_instance_id:scope.instance };
const oldDescriptor = { key:lk,representation_kind:linkedD.representation_kind,representation_epoch:1,representation_etag:'b'.repeat(64),is_null:false,
  total_bytes:Buffer.byteLength(linkedRaw),total_chunks:1,ciphertext_sha256:linkedD.ciphertext_sha256,expected_binding:binding(uid(3),1),revision_ref:null,parent_ref:null,
  physical_note_id:null,inventory_revision_id:null,operation_origin:null,slot_version:2 };
const catalogContext2 = Object.fromEntries(Object.entries(final2).filter(([k])=>!['inventory_revision_ids','protection_state'].includes(k)));
const digest2 = await Q.hashJson({context:catalogContext2,items:[oldDescriptor]}); catalogContext2.catalog_digest = digest2;
const supported2 = ['note_body','revision_snapshot','revision_before','inventory_snapshot','offline_snapshot','analysis_input','analysis_result','analysis_error','recording_transcript'];
let legacyChunks = 0, legacyCatalogShift = false;
const remote2 = P.createRemote({request:async (s,path,method,body) => {
  if (path.endsWith('/related-drains/status')) return { ...ready,state:'promoted',transition_id:uid(3) };
  if (path.endsWith('/crypto-transitions') && method === 'POST') return copy(response2);
  if (path.endsWith('/crypto-transitions/status') && !body.transition_id) return { ...base2,server_instance_id:scope.instance };
  if (path.endsWith('/manifest')) return { ...response2,items:Object.entries(sets2).flatMap(([set,entries])=>entries.map(entry=>({set,entry}))),next_cursor:null };
  if (path.endsWith('/source')) return {schema_version:2,metadata_context:header2,metadata_manifest_digest:md2,entry:entry2,value:sourceText};
  if (path.endsWith('/chunks')) {
    assert.equal(body.schema_version,1); assert.equal(Object.hasOwn(body,'server_instance_id'),false); legacyChunks++;
    return {schema_version:1,status:'ok',transition_id:uid(3),entry_key:lk,chunk_index:0,chunk_sha256:body.chunk_sha256,uploaded_chunks:1,total_chunks:1,state:'staging'};
  }
  if (path.endsWith('/entries/seal')) return {schema_version:1,transition_id:uid(3),entry_key:lk,source_etag:uid(30),target_epoch:1,total_chunks:1,total_bytes:Buffer.byteLength(linkedRaw),sealed:true,ciphertext_sha256:linkedD.ciphertext_sha256};
  if (path.endsWith('/staged')) return {schema_version:1,transition_id:uid(3),entry_key:lk,source_etag:uid(30),chunk_index:0,total_chunks:1,total_bytes:Buffer.byteLength(linkedRaw),ciphertext_sha256:linkedD.ciphertext_sha256,data_base64:Buffer.from(linkedRaw).toString('base64')};
  if (path.endsWith('/representations')) {
    const c={...catalogContext2};delete c.catalog_digest;if(legacyCatalogShift)c.history_generation++;
    const h=await Q.hashJson({context:c,items:[oldDescriptor]});c.catalog_digest=h;
    return {context:c,catalog_digest:h,items:[oldDescriptor],next_cursor:null,
      counts:Object.fromEntries(supported2.map(kind=>[kind,kind === lk.kind ? 1:0])),coverage:{scope:'note_history',scope_complete:true,supported_kinds:supported2,full_protection_complete:false}};
  }
  if (path.endsWith('/commit')) { assert.equal(Object.hasOwn(body,'client_decryption_verified'),false); return { ...response2,state:'committed',receipt_matches_current:true,
    receipt:{...final2,owner_id:scope.owner,local_id:scope.local_id,metadata_manifest_digest:md2},current_context:{...final2,active_transition_id:null} }; }
  throw Error('unexpected legacy path '+path);
}});
const intent2 = {schema_version:2,purpose:'conversion',prepare:{crypto_epoch:0,base_head_version:0,base_revision_id:null,expected_history_generation:1,expected_inventory_revision_ids:[]}};
const ready2 = {...ready,ready_base:base2}, fresh2 = await remote2.fresh(scope,intent2,ready2), prepared2 = await remote2.prepare(scope,intent2,ready2,fresh2);
const c2 = [{entry_key:lk,destination_key:lk,source_etag:uid(30),output_kind:entry2.output_kind,target_epoch:1,total_bytes:Buffer.byteLength(linkedRaw),ciphertext_sha256:linkedD.ciphertext_sha256}];
const work2 = {transfers:[{key:lk,raw:linkedRaw,descriptor:linkedD,origin:{value:null,legacy:null},semantic:sourceText}],source_origins:[],
  commit:{schema_version:2,owner_id:scope.owner,local_id:scope.local_id,device_id:scope.device,server_instance_id:scope.instance,transition_id:uid(3),metadata_manifest_digest:md2,
    client_verified_ciphertext_manifest_digest:await Q.hashJson(c2)}};
await remote2.stage(scope,prepared2,work2,password);
assert.equal(legacyChunks,1); assert.equal((await remote2.commit(scope,prepared2,work2)).state,'committed');
legacyCatalogShift=true;
await assert.rejects(()=>remote2.commit(scope,prepared2,work2),/current_context/,'I2 delta: catalog must remain pinned to the original receipt generation');
let auth = { ...scope,enabled:true,online:false,auth:'old' }, releaseWrite, enterWrite;
const entered = new Promise(r => enterWrite = r), gate = new Promise(r => releaseWrite = r);
let writesAfterLogout = 0;
const h = box.NowNoteHistory.create({ context:() => auth,request:async () => {},write:async (value,guard) => {
  enterWrite(); await gate;
  if (guard && !guard.active()) throw Error('stale');
  writesAfterLogout++;
} });
const first = h.track({ owner_id:'alice',local_id:'queued',content:'synthetic' },null).catch(e => e);
await entered;
const queued = h.saveProtection(copy(saved.protection_operations[id])).catch(e => e);
auth = { ...auth,owner:'bob',auth:'new' }; h.suspend();
const bob = { schema_version:1,contexts:{},protection_operations:{ bob:{ ...copy(saved.protection_operations[id]),id:'bob',scope:{ ...scope,owner:'bob' } } } };
h.hydrate(copy(bob)); releaseWrite(); await first; await queued;
assert.equal(writesAfterLogout,0,'Review-I3 stale queued writes cannot cross an auth generation');
assert.equal(JSON.stringify(h.export()),JSON.stringify(bob),'Review-I3 old rollback cannot alter the new journal');
context={...scope,enabled:true,auth:'freeze-test'};
let releasePreflight;
const preflightGate=new Promise(r=>releasePreflight=r);
const freezeJournal=box.NowNoteHistory.create({context:()=>context,request:async()=>{},write:async()=>{throw Error('synthetic quota');}});
const freeze=P.create({context:()=>context,journal:freezeJournal,stores:()=>[{name:'data',kind:'data',read:async()=>({tree:[copy(ui)]}),cas:async()=>{}}],remote,
  preflight:()=>preflightGate});
const freezeWork=freeze.start(scope,intent,password);
assert.equal(freeze.blocked(scope.local_id),true,'start must freeze edits before crypto/inventory awaits');
assert.equal(freeze.pending(),1);
releasePreflight();await assert.rejects(()=>freezeWork,/quota/);
assert.equal(freeze.blocked(scope.local_id),false,'failed pre-network freeze must release without a bogus durable marker');
console.log('E4b2 state+production wire: cipher-only marker, drain/promoted/source, real crypto staging/readback, lost commit, restart, store CAS, all copies/fallback and owner isolation PASS');
