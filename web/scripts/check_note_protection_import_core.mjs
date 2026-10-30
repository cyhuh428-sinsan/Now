import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const box=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,structuredClone,Uint8Array,atob,btoa});
for(const name of ['protocol','state','client'])vm.runInContext(await fs.readFile(new URL('../vendor/note-protection-'+name+'.js',import.meta.url),'utf8'),box);
const P=box.NowNoteProtectionState,Q=box.NowNoteProtectionProtocol,uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const scope={url:'https://synthetic.invalid',owner:'alice',local_id:'memo',device:'actor',instance:uid(1)},key={kind:'offline_snapshot',id:uid(10),slot:'snapshot'};
const base={base:{head_version:2,head_revision_id:null,crypto_epoch:2,history_generation:3,protection_state:'protected',inventory_revision_ids:[],identity_state:'branch_only',current_exists:false},current_mode:'absent',selected_physical_note_id:null,mixed_metadata_version:1};
const descriptor={key,representation_kind:'snapshot_v1',representation_epoch:0,is_null:false,representation_version:1,representation_etag:uid(11),storage_operation_id:null,semantic_origin_id:null,origin_validator:'native_v1',origin_row_required:true,expected_binding:null,revision_ref:{kind:'offline_branch',id:uid(10)},parent_ref:null,physical_note_id:null,inventory_revision_id:null,linked_slot_version:null,ciphertext_sha256:null};
const entry={revision_id:uid(10),parent_ref:null,origin_device_id:'original-device',source_kind:'snapshot_v1',source_epoch:0,target_kind:'snapshot_v1',target_epoch:0,expected_existing:descriptor,provenance:{kind:'plain_branch',origin_server_instance_id:scope.instance,origin_owner_id:scope.owner,origin_revision_ref:descriptor.revision_ref}};
const origin={destination_key:key,is_null:false,origin_validator:'native_v1',origin_row_required:true,storage_operation_id:null,semantic_origin_id:null};
const manifest={S:[{descriptor,source_etag:uid(12)}],DSET:[],P:[descriptor],O:[origin],existing:[{revision_id:uid(10),descriptor,comparison:'plain_exact'}],verified_existing:[{key,revision_ref:descriptor.revision_ref,parent_ref:null,origin_device_id:'original-device',descriptor,origin_expectation:origin,total_bytes:null,total_chunks:null,expected_binding:null,ciphertext_sha256:null}]};
const catalogDigest=await Q.hashJson({server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,context:base,entries:[descriptor]});
const header={schema_version:3,purpose:'mixed_offline_import',operation_id:uid(3),server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,actor_device_id:scope.device,mutation_id:uid(4),base,source_catalog_digest:catalogDigest,target_epoch:2,revision_ref:null,parent_ref:null,server_fields:null,control:{entries:[entry]},operation_origin:{purpose:'mixed_offline_import',operation_id:uid(3),mutation_id:uid(4),entries:[entry]}};
const sections=['S','DSET','P','O','existing','verified_existing'],calls=[];
let damage=null,activeManifest,activeHeader,digest,setDigests,counts;
const kinds=['analysis_error','analysis_input','analysis_result','inventory_snapshot','note_body','offline_snapshot','recording_transcript','reserved_offline_snapshot','revision_before','revision_snapshot'];
const count=rows=>({total:rows.length,nonnull:rows.filter(e=>!e.is_null).length,nulls:rows.filter(e=>e.is_null).length,
  by_kind:kinds.map(kind=>({kind,total:rows.filter(e=>e.key.kind===kind).length,nonnull:rows.filter(e=>e.key.kind===kind&&!e.is_null).length,nulls:rows.filter(e=>e.key.kind===kind&&e.is_null).length}))});
let sampleManifest=manifest,sampleHeader=header;
const full={id:null,owner_id:scope.owner,local_id:scope.local_id,device_id:'original-device',note_type:'tree',title:'Original',content:'Exact\r\n',
  parent_local_id:null,level:1,tags:'[]',source:'web-tree',deleted_at:null,client_updated_at:null,created_at:'2026-10-30T00:00:00.000001Z',updated_at:'2026-10-30T00:00:00.000002Z'};
let sourceRaw=Q.canonicalJson({schema_version:1,note:full}), sourceDamage=null,sourceCalls=0;
const staged=new Map();let sealed=null;
const remote=P.createRemote({request:async(s,path,method,body)=>{
  calls.push({path,method,body:structuredClone(body)});
  assert.ok(path.startsWith('/api/v2/notes/mixed-imports/'));
  if(path.endsWith('/prepare')){
    activeManifest=structuredClone(sampleManifest);activeHeader=structuredClone(sampleHeader);
    if(damage==='control')activeHeader.control.entries=[];
    if(damage==='proof')activeManifest.verified_existing[0].origin_device_id='wrong-device';
    digest=await Q.hashJson({...activeHeader,...activeManifest});
    setDigests=Object.fromEntries(await Promise.all(sections.map(async k=>[k,await Q.hashJson(activeManifest[k])])));
    counts=Object.fromEntries(sections.map(k=>[k,count(activeManifest[k].map(e=>['S','existing','verified_existing'].includes(k)?e.descriptor:['DSET','O'].includes(k)?{...e,key:e.destination_key}:e))]));
    if(damage==='count')counts.P.nonnull=0;
    return {schema_version:3,purpose:'mixed_offline_import',operation_id:uid(3),mutation_id:uid(4),state:'prepared',lease_version:1,metadata_manifest_digest:digest,metadata_header:activeHeader,counts,receipt:null,latest_context:base};
  }
  if(path.endsWith('/manifest'))return {schema_version:3,section:body.section,metadata_manifest_digest:digest,metadata_header:activeHeader,counts,set_digests:damage==='digest'&&body.section==='O'?{...setDigests,O:'0'.repeat(64)}:setDigests,entries:activeManifest[body.section],next_cursor:null};
  if(path.endsWith('/source')){
    sourceCalls++;const bytes=new TextEncoder().encode(sourceRaw),chunk=bytes.slice(body.chunk_index*262144,(body.chunk_index+1)*262144);
    return {schema_version:3,operation_id:uid(3),metadata_manifest_digest:digest,entry_key:key,source_etag:uid(12),descriptor:activeManifest.S[0].descriptor,
      total_bytes:bytes.length,total_chunks:Math.ceil(bytes.length/262144),chunk_index:body.chunk_index,
      data_base64:sourceDamage==='bytes'?btoa('wrong'):btoa(Array.from(chunk,b=>String.fromCharCode(b)).join(''))};
  }
  if(path.endsWith('/chunks')){staged.set(body.chunk_index,body.data_base64);return {chunk_index:body.chunk_index,source_etag:body.source_etag};}
  if(path.endsWith('/entries/seal')){sealed=structuredClone(body);return {sealed:true,ciphertext_sha256:body.ciphertext_sha256};}
  if(path.endsWith('/staged'))return {chunk_index:body.chunk_index,total_chunks:sealed.total_chunks,total_bytes:sealed.total_bytes,
    ciphertext_sha256:sealed.ciphertext_sha256,source_etag:sealed.source_etag,data_base64:staged.get(body.chunk_index)};
  throw Error('unexpected_request');
}});
assert.equal(typeof remote.prepareImport,'function','typed MI requires its own metadata-only prepare endpoint');
const intent={schema_version:3,purpose:'mixed_offline_import',prepare:{mutation_id:uid(4),base,expected_catalog_digest:catalogDigest,entries:[entry]},local_branches:[{snapshot:'PRIVATE-NOT-FOR-PREPARE'}]};
const prepared=await remote.prepareImport(scope,intent);
assert.equal(prepared.id,uid(3));assert.equal(calls.length,7);
assert.equal(Q.canonicalJson(prepared.manifest),Q.canonicalJson(manifest));
assert.equal(JSON.stringify(calls).includes('PRIVATE-NOT-FOR-PREPARE'),false);
assert.equal(Object.hasOwn(calls[0].body,'drain_ref'),false);
for(const bad of ['control','digest','proof','count']){damage=bad;await assert.rejects(remote.prepareImport(scope,intent),/import|manifest/);}
damage=null;
const foreign=structuredClone(intent);foreign.prepare.entries[0].provenance.origin_owner_id='bob';
let before=calls.length;await assert.rejects(remote.prepareImport(scope,foreign),/scope|provenance/);assert.equal(calls.length,before);
const extra=structuredClone(intent);extra.prepare.snapshot='PRIVATE';
before=calls.length;await assert.rejects(remote.prepareImport(scope,extra),/fields|prepare/);assert.equal(calls.length,before);
const sourcePrepared=await remote.prepareImport(scope,intent);
let read=await remote.readSources(scope,sourcePrepared,'local-key');
assert.equal(read.length,1,'MI must actually fetch every verified existing representation');
assert.equal(Q.canonicalJson(read[0].value),Q.canonicalJson({schema_version:1,note:full}));
sourceDamage='bytes';await assert.rejects(remote.readSources(scope,sourcePrepared,'local-key'),/source|json/);sourceDamage=null;
const mixed=structuredClone(intent), newKey={...key,id:uid(20)};
const added={...entry,revision_id:uid(20),parent_ref:descriptor.revision_ref,source_kind:'history_envelope_v1',source_epoch:1,
  target_kind:'history_envelope_v1',target_epoch:2,expected_existing:null,provenance:{kind:'cipher_branch',origin_server_instance_id:scope.instance,origin_owner_id:scope.owner,origin_storage_operation_id:null}};
mixed.prepare.entries.push(added);
sampleHeader=structuredClone(header);sampleHeader.control.entries=mixed.prepare.entries;sampleHeader.operation_origin.entries=mixed.prepare.entries;
sampleManifest=structuredClone(manifest);
const binding={server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,transition_id:uid(3),crypto_epoch:2,destination_key:newKey,revision_ref:{kind:'offline_branch',id:uid(20)},parent_ref:descriptor.revision_ref};
sampleManifest.DSET.push({destination_key:newKey,source_keys:[],source_etag:uid(21),output_kind:'history_envelope_v1',output_epoch:2,is_null:false,expected_binding:binding});
sampleManifest.O.push({destination_key:newKey,is_null:false,origin_validator:'native_mixed_v1',origin_row_required:true,storage_operation_id:uid(3),semantic_origin_id:uid(3)});
assert.equal((await remote.prepareImport(scope,mixed)).manifest.DSET.length,1);
sampleManifest.DSET[0].expected_binding.parent_ref=null;
await assert.rejects(remote.prepareImport(scope,mixed),/import/);
sampleManifest.DSET[0].expected_binding.parent_ref=descriptor.revision_ref;
sampleHeader.control.entries[1].parent_ref={kind:'offline_branch',id:uid(20)};
const cycle=structuredClone(mixed);cycle.prepare.entries[1].parent_ref={kind:'offline_branch',id:uid(20)};
await assert.rejects(remote.prepareImport(scope,cycle),/import_parent_cycle/);
sampleManifest=structuredClone(manifest);sampleHeader=structuredClone(header);
const cipherBinding={...binding,destination_key:key,revision_ref:descriptor.revision_ref,parent_ref:null,transition_id:uid(30)};
const cipherValue={schema_version:1,note:{...full,content:'Exact\r\n'+'x'.repeat(160000)}};
sourceRaw=await Q.encryptRepresentation(cipherValue,{key,output_kind:'history_envelope_v1',output_epoch:2,is_null:false,expected_binding:cipherBinding,operation_origin:null},'cipher-key');
const cipherRaw=sourceRaw;
const cipherDescriptor={...descriptor,representation_kind:'history_envelope_v1',representation_epoch:2,storage_operation_id:uid(30),expected_binding:cipherBinding,ciphertext_sha256:await Q.sha256(sourceRaw)};
const cipherEntry={...entry,source_kind:'history_envelope_v1',source_epoch:2,target_kind:'history_envelope_v1',target_epoch:2,expected_existing:cipherDescriptor,
  provenance:{kind:'cipher_branch',origin_server_instance_id:scope.instance,origin_owner_id:scope.owner,origin_storage_operation_id:uid(30)}};
const cipherOrigin={...origin,storage_operation_id:uid(30)};
const size=new TextEncoder().encode(sourceRaw).length;
sampleManifest.S[0].descriptor=cipherDescriptor;sampleManifest.P=[cipherDescriptor];sampleManifest.O=[cipherOrigin];
sampleManifest.existing=[{revision_id:key.id,descriptor:cipherDescriptor,comparison:'cipher_exact'}];
sampleManifest.verified_existing=[{...manifest.verified_existing[0],descriptor:cipherDescriptor,origin_expectation:cipherOrigin,total_bytes:size,total_chunks:Math.ceil(size/262144),expected_binding:cipherBinding,ciphertext_sha256:cipherDescriptor.ciphertext_sha256}];
sampleHeader.control={entries:[cipherEntry]};sampleHeader.operation_origin={...header.operation_origin,entries:[cipherEntry]};
sampleHeader.source_catalog_digest=await Q.hashJson({server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,context:base,entries:[cipherDescriptor]});
const cipherIntent={...intent,prepare:{...intent.prepare,expected_catalog_digest:sampleHeader.source_catalog_digest,entries:[cipherEntry]}};
const cipherPrepared=await remote.prepareImport(scope,cipherIntent);
sourceCalls=0;read=await remote.readSources(scope,cipherPrepared,'cipher-key');
assert.equal(Q.canonicalJson(read[0].value),Q.canonicalJson(cipherValue));assert.ok(sourceCalls>=2,'real crypto source spans multiple wire chunks');
await assert.rejects(remote.readSources(scope,cipherPrepared,'wrong-key'));
sampleManifest.verified_existing[0].total_bytes++;sampleManifest.verified_existing[0].total_chunks=Math.ceil((size+1)/262144);
const wrongSize=await remote.prepareImport(scope,cipherIntent);
await assert.rejects(remote.readSources(scope,wrongSize,'cipher-key'),/import_source_framing/);
sampleManifest=structuredClone(manifest);sampleHeader=structuredClone(header);
const foreignPrepared=await remote.prepareImport(scope,intent);
sourceRaw=Q.canonicalJson({schema_version:1,note:{...full,owner_id:'bob'}});
await assert.rejects(remote.readSources(scope,foreignPrepared,'local-key'),/import_source_scope/);
sourceRaw=Q.canonicalJson({schema_version:1,note:full});
assert.equal(typeof box.NowNoteProtectionClient.buildImportWork,'function','MI needs its own original-branch semantic work builder');
const local={revision_id:key.id,parent_ref:null,origin_device_id:'original-device',snapshot:{schema_version:1,note:full},representation:null};
const importIntent={...intent,local_branches:[local]};
const work=await box.NowNoteProtectionClient.buildImportWork(scope,foreignPrepared,importIntent,'local-key',remote);
assert.equal(work.transfers.length,0);
assert.equal(work.commit.client_verified_existing_set_digest,await Q.hashJson(manifest.verified_existing));
assert.notEqual(work.commit.client_verified_existing_set_digest,await Q.hashJson(manifest.existing));
assert.equal(Q.canonicalJson(work.commit.plain_entries),Q.canonicalJson([{revision_id:key.id,snapshot:full}]));
const changed=structuredClone(importIntent);changed.local_branches[0].snapshot.note.content='changed';
await assert.rejects(box.NowNoteProtectionClient.buildImportWork(scope,foreignPrepared,changed,'local-key',remote),/import_existing_meaning/);
const wrongDevice=structuredClone(importIntent);wrongDevice.local_branches[0].origin_device_id='actor';
await assert.rejects(box.NowNoteProtectionClient.buildImportWork(scope,foreignPrepared,wrongDevice,'local-key',remote),/import_branch/);
const newEntry={...added,parent_ref:descriptor.revision_ref,source_kind:'snapshot_v1',source_epoch:0,provenance:{kind:'plain_branch',origin_server_instance_id:scope.instance,origin_owner_id:scope.owner,origin_revision_ref:null}};
const newIntent={...importIntent,prepare:{...intent.prepare,entries:[entry,newEntry]},local_branches:[local,{...local,revision_id:uid(20),parent_ref:descriptor.revision_ref,snapshot:{schema_version:1,note:{...full,title:'Child',device_id:'original-device'}}}]};
sampleManifest=structuredClone(manifest);sampleHeader=structuredClone(header);
sampleHeader.control={entries:newIntent.prepare.entries};sampleHeader.operation_origin={...header.operation_origin,entries:newIntent.prepare.entries};
sampleManifest.DSET=[{destination_key:newKey,source_keys:[],source_etag:uid(21),output_kind:'history_envelope_v1',output_epoch:2,is_null:false,expected_binding:binding}];
sampleManifest.O.push({destination_key:newKey,is_null:false,origin_validator:'native_mixed_v1',origin_row_required:true,storage_operation_id:uid(3),semantic_origin_id:uid(3)});
const newPrepared=await remote.prepareImport(scope,newIntent);
const newWork=await box.NowNoteProtectionClient.buildImportWork(scope,newPrepared,newIntent,'new-key',remote);
assert.equal(newWork.transfers.length,1);assert.equal(newWork.commit.plain_entries.length,1);
const transfer=newWork.transfers[0];
assert.equal(Q.canonicalJson(await Q.decryptRepresentation(transfer.raw,transfer.descriptor,transfer.origin,async()=>'new-key',3)),Q.canonicalJson(newIntent.local_branches[1].snapshot));
assert.equal(transfer.descriptor.parent_ref.id,key.id);assert.equal(transfer.descriptor.revision_ref.id,uid(20));
assert.equal(newWork.branches[1].origin_device_id,'original-device');assert.equal(newWork.branches[1].snapshot.note.client_updated_at,null);
const forged=structuredClone(newIntent);forged.local_branches[1].snapshot.note.id=99;
await assert.rejects(box.NowNoteProtectionClient.buildImportWork(scope,newPrepared,forged,'new-key',remote),/import_destination/);
const originalBinding={...binding,transition_id:uid(30),crypto_epoch:1};
const originalValue=newIntent.local_branches[1].snapshot;
const originalRaw=await Q.encryptRepresentation(originalValue,{key:newKey,output_kind:'history_envelope_v1',output_epoch:1,is_null:false,expected_binding:originalBinding,operation_origin:null},'original-key');
const originalDescriptor={...descriptor,key:newKey,representation_kind:'history_envelope_v1',representation_epoch:1,storage_operation_id:uid(30),
  expected_binding:originalBinding,revision_ref:originalBinding.revision_ref,parent_ref:originalBinding.parent_ref,ciphertext_sha256:await Q.sha256(originalRaw)};
const originalIntent=structuredClone(newIntent);
Object.assign(originalIntent.prepare.entries[1],{source_kind:'history_envelope_v1',source_epoch:1,provenance:{kind:'cipher_branch',origin_server_instance_id:scope.instance,origin_owner_id:scope.owner,origin_storage_operation_id:null}});
originalIntent.local_branches[1].representation={raw:originalRaw,descriptor:originalDescriptor,origin:{value:null,legacy:null}};
sampleHeader.control={entries:originalIntent.prepare.entries};sampleHeader.operation_origin={...header.operation_origin,entries:originalIntent.prepare.entries};
const originalPrepared=await remote.prepareImport(scope,originalIntent);
const keys=async d=>d.output?'new-key':'original-key';
const originalWork=await box.NowNoteProtectionClient.buildImportWork(scope,originalPrepared,originalIntent,'new-key',remote,[],keys);
assert.equal(Q.canonicalJson(originalWork.transfers[0].semantic),Q.canonicalJson(originalValue));
const badOriginal=structuredClone(originalIntent);badOriginal.local_branches[1].snapshot.note.content='rewritten';
await assert.rejects(box.NowNoteProtectionClient.buildImportWork(scope,originalPrepared,badOriginal,'new-key',remote,[],keys),/import_cipher_meaning/);
assert.equal((await remote.stage(scope,originalPrepared,originalWork,'new-key',[],keys)).verified,true);
const wrongProof=structuredClone(originalWork);wrongProof.commit.client_verified_existing_set_digest='0'.repeat(64);
await assert.rejects(remote.stage(scope,originalPrepared,wrongProof,'new-key',[],keys),/import/);
const alteredPlain=structuredClone(originalWork);alteredPlain.commit.plain_entries[0].snapshot.content='changed';
await assert.rejects(remote.stage(scope,originalPrepared,alteredPlain,'new-key',[],keys),/import/);
sampleManifest=structuredClone(cipherPrepared.manifest);sampleHeader=structuredClone(cipherPrepared.response.metadata_header);sourceRaw=cipherRaw;
const identicalPrepared=await remote.prepareImport(scope,cipherIntent);
const identicalIntent={...cipherIntent,local_branches:[{...local,snapshot:cipherValue,representation:{raw:cipherRaw,descriptor:cipherDescriptor,origin:{value:null,legacy:null}}}]};
const identicalWork=await box.NowNoteProtectionClient.buildImportWork(scope,identicalPrepared,identicalIntent,'cipher-key',remote);
assert.equal(identicalWork.commit.existing_ciphertexts[0].ciphertext_sha256,await Q.sha256(cipherRaw));
const otherNonce=await Q.encryptRepresentation(cipherValue,{key,output_kind:'history_envelope_v1',output_epoch:2,is_null:false,expected_binding:cipherBinding,operation_origin:null},'cipher-key');
assert.notEqual(otherNonce,cipherRaw);
const nonceIntent=structuredClone(identicalIntent);nonceIntent.local_branches[0].representation.raw=otherNonce;
nonceIntent.local_branches[0].representation.descriptor=structuredClone(nonceIntent.local_branches[0].representation.descriptor);
nonceIntent.local_branches[0].representation.descriptor.ciphertext_sha256=await Q.sha256(otherNonce);
await assert.rejects(box.NowNoteProtectionClient.buildImportWork(scope,identicalPrepared,nonceIntent,'cipher-key',remote),/import_existing_cipher/);
const nonceWork=structuredClone(identicalWork);nonceWork.branches=nonceIntent.local_branches;
await assert.rejects(remote.stage(scope,identicalPrepared,nonceWork,'cipher-key'),/import_existing_cipher/);
sampleManifest=structuredClone(originalPrepared.manifest);sampleHeader=structuredClone(originalPrepared.response.metadata_header);
sourceRaw=Q.canonicalJson({schema_version:1,note:full});
const rebound=await remote.prepareImport(scope,originalIntent);
const rewritten=structuredClone(originalWork),rewrittenTransfer=rewritten.transfers[0];
rewritten.branches[1].snapshot.note.content='rewritten after build';
rewrittenTransfer.semantic=rewritten.branches[1].snapshot;
rewrittenTransfer.raw=await Q.encryptRepresentation(rewrittenTransfer.semantic,{key:newKey,output_kind:'history_envelope_v1',output_epoch:2,is_null:false,
  expected_binding:binding,operation_origin:originalPrepared.response.metadata_header.operation_origin},'new-key');
rewrittenTransfer.descriptor.ciphertext_sha256=await Q.sha256(rewrittenTransfer.raw);
rewritten.commit.client_verified_ciphertext_manifest_digest=await Q.hashJson([{entry_key:newKey,destination_key:newKey,source_etag:uid(21),output_kind:'history_envelope_v1',
  target_epoch:2,total_bytes:new TextEncoder().encode(rewrittenTransfer.raw).length,ciphertext_sha256:rewrittenTransfer.descriptor.ciphertext_sha256}]);
await assert.rejects(remote.stage(scope,rebound,rewritten,'new-key',[],keys),/import_cipher_meaning/);
let receiptCase={p:originalPrepared,work:originalWork},receiptDamage=null;
const receiptRemote=P.createRemote({request:async(s,path)=>{
  const {p,work}=receiptCase,hasNew=p.manifest.DSET.length>0;
  const published={...base,base:{...base.base,head_version:base.base.head_version+(hasNew?1:0),history_generation:base.base.history_generation+(hasNew?1:0)}};
  if(receiptDamage==='result')published.base.head_version++;
  const descriptors=structuredClone([...p.manifest.P,...work.transfers.map(t=>t.descriptor)]);
  if(receiptDamage==='preserved')descriptors[0].representation_etag=uid(99);
  const publishedDigest=await Q.hashJson({server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,context:published,entries:descriptors});
  const receipt={schema_version:3,purpose:'mixed_offline_import',operation_id:p.id,mutation_id:uid(4),server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,
    result:published,metadata_manifest_digest:p.digest,set_digests:Object.fromEntries(await Promise.all(sections.map(async k=>[k,await Q.hashJson(p.manifest[k])]))),
    ciphertext_manifest_digest:work.commit.client_verified_ciphertext_manifest_digest,origin_expectations_digest:receiptDamage==='origin'?'0'.repeat(64):await Q.hashJson(p.manifest.O),committed_at:'2026-10-31T00:00:00.000001Z'};
  if(path.endsWith('/status'))return {schema_version:3,purpose:'mixed_offline_import',operation_id:p.id,mutation_id:uid(4),state:'committed',receipt,latest_context:published};
  if(path.endsWith('/context'))return {schema_version:3,server_instance_id:scope.instance,context:published,catalog_digest:publishedDigest};
  if(path.endsWith('/catalog'))return {schema_version:3,context:published,catalog_digest:publishedDigest,counts:count(descriptors),
    coverage:{supported_kinds:kinds,scope_complete:true,full_protection_complete:false},entries:descriptors,next_cursor:null};
  throw Error('unexpected_receipt');
}});
assert.equal((await receiptRemote.status(scope,originalPrepared,originalWork)).receipt_matches_current,true);
for(const bad of ['result','preserved','origin']){receiptDamage=bad;await assert.rejects(receiptRemote.status(scope,originalPrepared,originalWork),/receipt|import|published/);}
receiptDamage=null;receiptCase={p:identicalPrepared,work:identicalWork};
assert.equal((await receiptRemote.status(scope,identicalPrepared,identicalWork)).receipt_matches_current,true);
console.log('MI prepare: 10 PASS (synthetic six-section metadata contract; no HTTP/UI)');
console.log('MI existing source: 6 PASS (actual WebCrypto and multi-chunk synthetic transport; no server/UI)');
console.log('MI semantic work: 8 PASS (actual old/new epoch crypto, original FULL15/parent/device and V3 digest; synthetic transport, no commit/UI)');
console.log('MI stage: 3 PASS (synthetic upload/readback and existing/plain commit verification; no server/UI)');
console.log('MI I1: exact existing local/server cipher bytes required, same meaning/different nonce rejected in build and stage');
console.log('MI I2: original new-branch cipher is re-decrypted at stage; rewritten snapshot/output/digest rejected');
console.log('MI receipt: 5 PASS (new/existing-only result, preserved old descriptors and exact receipt; synthetic wire, no server/UI)');
