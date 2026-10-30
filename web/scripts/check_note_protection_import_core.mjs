import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const box=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,structuredClone,Uint8Array,atob,btoa});
for(const name of ['protocol','state'])vm.runInContext(await fs.readFile(new URL('../vendor/note-protection-'+name+'.js',import.meta.url),'utf8'),box);
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
console.log('MI prepare: 10 PASS (synthetic six-section metadata contract; no HTTP/bytes/UI)');
