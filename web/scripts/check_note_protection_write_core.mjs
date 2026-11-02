import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

const box=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,structuredClone,Uint8Array,atob,btoa});
for(const name of ['protocol','state','client']) vm.runInContext(await fs.readFile(new URL('../vendor/note-protection-'+name+'.js',import.meta.url),'utf8'),box);
const C=box.NowNoteProtectionClient,Q=box.NowNoteProtectionProtocol;
assert.equal(typeof C.buildWriteWork,'function','MW requires its own semantic work builder, not conversion work');
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const scope={url:'https://synthetic.invalid',instance:uid(1),owner:'alice',local_id:'memo',device:'reader'};
const full={id:7,owner_id:'alice',local_id:'memo',device_id:'original',note_type:'tree',title:'Title',content:'BEFORE\r\n',parent_local_id:null,level:1,tags:'[]',source:'web-tree',deleted_at:null,created_at:'2026-10-30T00:00:00.000001Z',updated_at:'2026-10-30T00:00:00.000002Z',client_updated_at:'2026-10-30T00:00:00.000003Z'};
const key=(kind,id,slot)=>({kind,id:String(id),slot});
const k=key('inventory_snapshot',7,'current');
const base={base:{head_version:2,head_revision_id:uid(2),crypto_epoch:2,history_generation:2,protection_state:'protected',inventory_revision_ids:[uid(2)],identity_state:'coherent',current_exists:true},current_mode:'protected',selected_physical_note_id:7,mixed_metadata_version:1};
function fixture({mode='protected',beforeEpoch=1,operation='put',absent=false}={}){
  const input={...full,content:'AFTER\r\n',...(operation==='delete'?{content:full.content,deleted_at:'2026-10-30T01:00:00.000004Z'}:{})};
  const context=structuredClone(base);context.current_mode=absent?'absent':mode;
  if(absent){context.base.current_exists=false;context.base.identity_state='related_only';context.selected_physical_note_id=null;}
  const prepare={mutation_id:uid(4),base:context,expected_catalog_digest:'a'.repeat(64),operation,target_current_mode:mode,selection:absent?null:{physical_note_id:7,inventory_revision_ref:{kind:'note_revision',id:uid(2)},note_representation_etag:uid(8),inventory_representation_etag:uid(9)},replica_policy:'selected_head_only',structure:Object.fromEntries(['note_type','parent_local_id','level','deleted_at'].map(k=>[k,input[k]])),parent_context:null,restore_source:null};
  const origin={purpose:'mixed_note_write',operation_id:uid(3),mutation_id:uid(4),operation,restore_source_ref:null,restore_source_descriptor:null};
  const ref={kind:'note_revision',id:uid(5)},parent_ref={kind:'note_revision',id:uid(2)};
  const header={purpose:'mixed_note_write',operation_id:uid(3),server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,actor_device_id:scope.device,mutation_id:uid(4),base:context,target_epoch:2,revision_ref:ref,parent_ref,server_fields:Object.fromEntries(['id','owner_id','local_id','device_id','created_at','updated_at','client_updated_at'].map(k=>[k,full[k]])),operation_origin:origin,control:Object.fromEntries(['operation','selection','target_current_mode','replica_policy','structure','parent_context','restore_source'].map(k=>[k,prepare[k]]))};
  const source={key:k,semantic_origin_id:null};
  const DSET=[key('note_body',7,'content'),key('inventory_snapshot',7,'current'),key('revision_snapshot',uid(5),'after'),key('revision_before',uid(5),'before')].map(destination_key=>{
    const before=destination_key.kind==='revision_before',body=destination_key.kind==='note_body';
    const epoch=before&&!absent?beforeEpoch:mode==='plain'?0:2;
    return {destination_key,source_keys:before&&!absent?[k]:[],source_etag:uid(10),output_epoch:epoch,output_kind:before&&!absent?(epoch?'history_envelope_v1':'snapshot_v1'):body?(epoch?'content_encrypted_v1':'plain_text_v1'):(epoch?'history_envelope_v1':'snapshot_v1'),is_null:before&&absent,expected_binding:epoch&&!body&&!(before&&absent)?{server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,transition_id:uid(3),crypto_epoch:epoch,destination_key,revision_ref:ref,parent_ref}:null};
  });
  DSET.sort((a,b)=>JSON.stringify(a.destination_key).localeCompare(JSON.stringify(b.destination_key)));
  const ordered=Q.keyOrder(DSET.map(d=>d.destination_key)).map(k=>DSET.find(d=>Q.canonicalJson(d.destination_key)===Q.canonicalJson(k)));
  const O=ordered.map(d=>({destination_key:d.destination_key,semantic_origin_id:d.destination_key.kind==='note_body'||d.is_null||d.destination_key.kind==='revision_before'?null:uid(3),origin_validator:d.destination_key.kind==='note_body'?'body_mixed_v1':'native_mixed_v1',origin_row_required:d.destination_key.kind!=='note_body',storage_operation_id:uid(3),is_null:d.is_null}));
  return {input,intent:{schema_version:3,purpose:'mixed_note_write',prepare,note:input,source_origins:[]},prepared:{version:3,id:uid(3),digest:'b'.repeat(64),response:{lease_version:1,metadata_header:header},manifest:{DSET:ordered,S:absent?[]:[{descriptor:source}],O}},remote:{readSources:async()=>absent?[]:[{key:k,value:{schema_version:1,note:full}}]}};
}
let passed=0;
for(const options of [{},{mode:'plain',beforeEpoch:1},{beforeEpoch:0},{operation:'create',absent:true},{operation:'delete'}]){
  const f=fixture(options),w=await C.buildWriteWork(scope,f.prepared,f.intent,'new-key',f.remote,[],async d=>d.output?'new-key':'old-key');
  assert.equal(w.commit.operation_id,uid(3));
  assert.equal(w.commit.plain_after!==null,options.mode==='plain');
  assert.equal(w.commit.plain_before!==null,options.beforeEpoch===0);
  assert.equal(w.transfers.length,options.mode==='plain'?1:options.beforeEpoch===0||options.absent?3:4);
  assert.equal(w.commit.projection.deleted_at,f.input.deleted_at);
  for(const t of w.transfers){
    const opened=await Q.decryptRepresentation(t.raw,t.descriptor,t.origin,async d=>d.representation_epoch===1?'old-key':'new-key',3);
    if(t.key.kind==='revision_before')assert.equal(opened.note.content,full.content);
    else if(t.key.kind==='note_body')assert.equal(opened,f.input.content);
    else assert.equal(opened.note.content,f.input.content);
  }
  assert.equal(JSON.stringify(w.commit).includes('BEFORE'),options.beforeEpoch===0);
  assert.equal(JSON.stringify(w.commit).includes('AFTER'),options.mode==='plain');
  assert.equal(Q.canonicalJson(f.input),Q.canonicalJson(f.intent.note));
  passed++;
}
const foreign=fixture();foreign.intent.note.owner_id='bob';
await assert.rejects(C.buildWriteWork(scope,foreign.prepared,foreign.intent,'new-key',foreign.remote),/scope/);passed++;
const changed=fixture();changed.prepared.response.metadata_header.control.operation='create';
await assert.rejects(C.buildWriteWork(scope,changed.prepared,changed.intent,'new-key',changed.remote),/control/);passed++;
const deletion=fixture({operation:'delete'});deletion.intent.note.content='REPLACED';
await assert.rejects(C.buildWriteWork(scope,deletion.prepared,deletion.intent,'new-key',deletion.remote),/delete/);passed++;
const restore=fixture({operation:'restore'}),restoreKey=key('revision_snapshot',uid(20),'after');
const restoreSource={revision_ref:{kind:'note_revision',id:uid(20)},descriptor:{key:restoreKey,representation_kind:'snapshot_v1',representation_epoch:0,is_null:false,representation_version:1,representation_etag:uid(21),storage_operation_id:null,semantic_origin_id:null,origin_validator:'native_v1',origin_row_required:true,expected_binding:null,revision_ref:{kind:'note_revision',id:uid(20)},parent_ref:null,physical_note_id:null,inventory_revision_id:null,linked_slot_version:null,ciphertext_sha256:null}};
restore.intent.prepare.restore_source=structuredClone(restoreSource);
restore.prepared.response.metadata_header.control.restore_source=structuredClone(restoreSource);
Object.assign(restore.prepared.response.metadata_header.operation_origin,{restore_source_ref:restoreSource.revision_ref,restore_source_descriptor:restoreSource.descriptor});
restore.remote.readSources=async()=>[{key:k,value:{schema_version:1,note:full}},{key:restoreKey,value:{schema_version:1,note:{...full,content:'AFTER\r\n'}}}];
const restored=await C.buildWriteWork(scope,restore.prepared,restore.intent,'new-key',restore.remote);
assert.equal(restored.transfers.length,4);passed++;
restore.intent.note.content='WRONG-RESTORE';
await assert.rejects(C.buildWriteWork(scope,restore.prepared,restore.intent,'new-key',restore.remote),/restore_meaning/);passed++;
const wrongKey=fixture();
await assert.rejects(C.buildWriteWork(scope,wrongKey.prepared,wrongKey.intent,'new-key',wrongKey.remote,[],async()=>{throw Error('key_missing');}),/key_missing/);passed++;
const reordered=fixture();reordered.prepared.manifest.DSET.reverse();
await assert.rejects(C.buildWriteWork(scope,reordered.prepared,reordered.intent,'new-key',reordered.remote),/destination_order/);passed++;
console.log(`MW semantic work: ${passed} PASS (synthetic contract; no HTTP/UI)`);
const P=box.NowNoteProtectionState,preparedFixture=fixture();
const sections=['S','DSET','P','O','existing','verified_existing'];
const manifest={...preparedFixture.prepared.manifest,P:[],existing:[],verified_existing:[]};
const header={...preparedFixture.prepared.response.metadata_header,schema_version:3};
const digest=await Q.hashJson({...header,...manifest}),set_digests=Object.fromEntries(await Promise.all(sections.map(async s=>[s,await Q.hashJson(manifest[s])])));
const counts=Object.fromEntries(sections.map(s=>[s,{total:manifest[s].length}]));
const calls=[];let corrupt=null;const uploaded=new Map();
const transport=P.createRemote({request:async(s,path,method,body)=>{
  calls.push({path,method,body});
  assert.equal(path.startsWith('/api/v2/notes/mixed-writes/'),true);
  if(path.endsWith('/quote'))return {schema_version:3,purpose:'mixed_note_write',operation_id:uid(3),mutation_id:uid(4),state:'prepared',lease_version:1,metadata_manifest_digest:digest,metadata_header:header,counts,receipt:null,latest_context:base};
  if(path.endsWith('/manifest'))return {schema_version:3,metadata_manifest_digest:digest,metadata_header:header,counts,set_digests:corrupt==='digest'&&body.section==='O'?{...set_digests,O:'0'.repeat(64)}:set_digests,section:body.section,entries:corrupt==='entry'&&body.section==='S'?[{descriptor:{key:key('inventory_snapshot',8,'current')}}]:manifest[body.section],next_cursor:null};
  if(path.endsWith('/chunks')){const id=Q.canonicalJson(body.entry_key);uploaded.set(id,{...body,data_base64:body.data_base64});return {chunk_index:body.chunk_index,source_etag:body.source_etag};}
  if(path.endsWith('/entries/seal')){Object.assign(uploaded.get(Q.canonicalJson(body.entry_key)),{ciphertext_sha256:body.ciphertext_sha256});return {sealed:true,ciphertext_sha256:body.ciphertext_sha256};}
  if(path.endsWith('/staged'))return {...uploaded.get(Q.canonicalJson({kind:body.kind,id:body.representation_id,slot:body.slot})),chunk_index:body.chunk_index};
  throw Error('unexpected_request');
}});
assert.equal(typeof transport.prepareWrite,'function','MW quote must not send conversion drain_ref');
const mw=await transport.prepareWrite(scope,preparedFixture.intent);
assert.equal(mw.id,uid(3));assert.equal(mw.digest,digest);
assert.equal(calls.length,7);assert.equal(Object.hasOwn(calls[0].body,'drain_ref'),false);
assert.equal(Q.canonicalJson(mw.manifest),Q.canonicalJson(manifest));
for(const damage of ['digest','entry']){corrupt=damage;await assert.rejects(transport.prepareWrite(scope,preparedFixture.intent),/manifest/);}
console.log('MW transport prepare: 3 PASS; six-section digest and corruption, synthetic only');
corrupt=null;
transport.readSources=preparedFixture.remote.readSources;
const write=await C.buildWriteWork(scope,mw,preparedFixture.intent,'new-key',transport,[],async d=>d.output?'new-key':'old-key');
await transport.stage(scope,mw,write,'new-key',[],async d=>d.output?'new-key':'old-key');
assert.equal(uploaded.size,4);
const altered=structuredClone(write);altered.transfers[0].semantic={schema_version:1,note:{...full,content:'ALTERED'}};
await assert.rejects(transport.stage(scope,mw,altered,'new-key',[],async d=>d.output?'new-key':'old-key'),/semantic|meaning/);
console.log('MW transport stage: 2 PASS; synthetic upload/readback and altered semantic rejection');
const published={...base,base:{...base.base,head_version:3,head_revision_id:uid(5),history_generation:3,inventory_revision_ids:[uid(5)]}};
const descriptors=write.transfers.map(t=>t.descriptor),kinds=['analysis_error','analysis_input','analysis_result','inventory_snapshot','note_body','offline_snapshot','recording_transcript','reserved_offline_snapshot','revision_before','revision_snapshot'];
const stats=a=>({total:a.length,nonnull:a.filter(d=>!d.is_null).length,nulls:a.filter(d=>d.is_null).length});
const publishedCounts={...stats(descriptors),by_kind:kinds.map(kind=>({kind,...stats(descriptors.filter(d=>d.key.kind===kind))}))};
const publishedDigest=await Q.hashJson({server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,context:published,entries:descriptors});
let wrongReceipt=false;
const receipt={schema_version:3,purpose:'mixed_note_write',operation_id:uid(3),mutation_id:uid(4),server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,result:published,metadata_manifest_digest:digest,set_digests,ciphertext_manifest_digest:write.commit.client_verified_ciphertext_manifest_digest};
const receiptTransport=P.createRemote({request:async(s,path)=>{
  if(path.endsWith('/status'))return {schema_version:3,purpose:'mixed_note_write',operation_id:uid(3),mutation_id:uid(4),state:'committed',receipt:{...receipt,...(wrongReceipt?{mutation_id:uid(99)}:{})},latest_context:published};
  if(path.endsWith('/context'))return {schema_version:3,server_instance_id:scope.instance,context:published,catalog_digest:publishedDigest};
  if(path.endsWith('/catalog'))return {schema_version:3,context:published,catalog_digest:publishedDigest,counts:publishedCounts,coverage:{supported_kinds:kinds,scope_complete:true,full_protection_complete:false},entries:descriptors,next_cursor:null};
  throw Error('unexpected_receipt_request');
}});
const done=await receiptTransport.status(scope,mw,write);
assert.equal(done.state,'committed');assert.equal(done.receipt_matches_current,true);
wrongReceipt=true;await assert.rejects(receiptTransport.status(scope,mw,write),/receipt/);
console.log('MW receipt: 2 PASS; exact original receipt and fresh typed publication, synthetic only');
