import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const box=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,structuredClone,Uint8Array,atob,btoa});
for(const name of ['protocol','state','client'])vm.runInContext(await fs.readFile(new URL('../vendor/note-protection-'+name+'.js',import.meta.url),'utf8'),box);
const Q=box.NowNoteProtectionProtocol,C=box.NowNoteProtectionClient;
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),copy=structuredClone;
const scope={url:'https://synthetic.invalid',owner:'alice',local_id:'memo',device:'actor',instance:uid(1)};
const context={base:{head_version:2,head_revision_id:null,crypto_epoch:2,history_generation:3,protection_state:'protected',inventory_revision_ids:[],identity_state:'branch_only',current_exists:false},current_mode:'absent',selected_physical_note_id:null,mixed_metadata_version:1};
const key={kind:'recording_transcript',id:'7',slot:'transcript'};
const old={key,representation_kind:'plain_text',representation_epoch:0,is_null:false,representation_version:1,representation_etag:uid(2),storage_operation_id:null,semantic_origin_id:null,origin_validator:'linked_v1',origin_row_required:false,expected_binding:null,revision_ref:null,parent_ref:null,physical_note_id:null,inventory_revision_id:null,linked_slot_version:1,ciphertext_sha256:null};
// Use the actual catalog wire kind, checked by the shared protocol below.
old.representation_kind='plain_text_v1';
const catalog={context,entries:[old],catalog_digest:await Q.hashJson({server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,context,entries:[old]})};
assert.equal(typeof C.planTranscript,'function','MT must have an explicit typed plan');
assert.equal(typeof C.buildTranscriptWork,'function','MT must preserve new ciphertext in the existing mutation journal');
const text='Original replacement\r\n한국어\n';
const intent=await C.planTranscript(scope,catalog,old,text);
assert.equal(intent.purpose,'mixed_transcript_write');
assert.equal(intent.prepare.is_null,false);assert.equal(intent.prepare.recording_id,7);
assert.equal(JSON.stringify(intent.prepare).includes('Original replacement'),false);
assert.equal(Q.canonicalJson(intent.prepare.expected_descriptor),Q.canonicalJson(old));
const origin={purpose:intent.purpose,operation_id:uid(3),recording_id:7,previous_descriptor:old};
const binding={server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,transition_id:uid(3),crypto_epoch:2,destination_key:key,revision_ref:null,parent_ref:null};
const header={schema_version:3,purpose:intent.purpose,operation_id:uid(3),mutation_id:intent.prepare.mutation_id,server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,actor_device_id:scope.device,base:context,source_catalog_digest:catalog.catalog_digest,target_epoch:2,revision_ref:null,parent_ref:null,server_fields:null,control:{recording_id:7,expected_descriptor:old,is_null:false},operation_origin:origin};
const manifest={S:[{descriptor:old,source_etag:uid(4)}],DSET:[{destination_key:key,source_keys:[key],source_etag:uid(5),output_kind:'linked_text_envelope_v1',output_epoch:2,is_null:false,expected_binding:binding}],P:[],O:[{destination_key:key,is_null:false,origin_validator:'linked_mixed_v1',origin_row_required:false,storage_operation_id:uid(3),semantic_origin_id:uid(3)}],existing:[],verified_existing:[]};
const make=async(h=header,m=manifest)=>({version:3,id:uid(3),digest:await Q.hashJson({...h,...m}),response:{metadata_header:copy(h),lease_version:1},manifest:copy(m)});
let reads=0;
const remote={readSources:async()=>{reads++;return [{key,value:'Previous\r\n'}];}};
const prepared=await make(),work=await C.buildTranscriptWork(scope,prepared,intent,'new-key',remote);
assert.equal(work.transfers.length,1);assert.equal(work.transfers[0].semantic,text);
assert.equal(work.transfers[0].descriptor.linked_slot_version,2);
assert.equal(work.commit.target_epoch,2);assert.equal(work.commit.metadata_manifest_digest,prepared.digest);
assert.equal(reads,1);
assert.equal(await Q.decryptRepresentation(work.transfers[0].raw,work.transfers[0].descriptor,work.transfers[0].origin,async()=> 'new-key',3),text);
assert.equal(Q.canonicalJson(old),Q.canonicalJson(catalog.entries[0]));
const nullIntent=await C.planTranscript(scope,catalog,old,null),nh=copy(header),nm=copy(manifest);
nh.mutation_id=nullIntent.prepare.mutation_id;nh.control.is_null=true;nm.DSET[0].is_null=true;nm.DSET[0].expected_binding=null;nm.O[0].is_null=true;
const nullWork=await C.buildTranscriptWork(scope,await make(nh,nm),nullIntent,'new-key',remote);
assert.equal(nullWork.transfers.length,0);assert.equal(nullWork.transcript,null);
assert.equal(nullWork.commit.client_verified_ciphertext_manifest_digest,await Q.hashJson([]));
for(const bad of [undefined,{},5])await assert.rejects(C.planTranscript(scope,catalog,old,bad));
const stale=copy(old);stale.linked_slot_version++;
await assert.rejects(C.planTranscript(scope,catalog,stale,text),/transcript/);
const foreign=copy(catalog);foreign.catalog_digest='0'.repeat(64);
await assert.rejects(C.planTranscript(scope,foreign,old,text),/catalog/);
for(const change of [h=>h.owner_id='bob',h=>h.control.recording_id=8,h=>h.operation_origin.previous_descriptor.linked_slot_version++,h=>h.target_epoch++]){
 const h=copy(header);change(h);await assert.rejects(C.buildTranscriptWork(scope,await make(h),intent,'new-key',remote),/transcript/);
}
for(const change of [m=>m.P.push(old),m=>m.S[0].source_etag=m.DSET[0].source_etag,m=>m.O[0].semantic_origin_id=uid(9),m=>m.DSET[0].source_keys=[]]){
 const m=copy(manifest);change(m);await assert.rejects(C.buildTranscriptWork(scope,await make(header,m),intent,'new-key',remote),/transcript/);
}
const P=box.NowNoteProtectionState,calls=[],sections=['S','DSET','P','O','existing','verified_existing'];
const kinds=['analysis_error','analysis_input','analysis_result','inventory_snapshot','note_body','offline_snapshot','recording_transcript','reserved_offline_snapshot','revision_before','revision_snapshot'];
const count=rows=>({total:rows.length,nonnull:rows.filter(d=>!d.is_null).length,nulls:rows.filter(d=>d.is_null).length,by_kind:kinds.map(kind=>({kind,total:rows.filter(d=>d.key.kind===kind).length,nonnull:rows.filter(d=>d.key.kind===kind&&!d.is_null).length,nulls:rows.filter(d=>d.key.kind===kind&&d.is_null).length}))});
const sets=Object.fromEntries(await Promise.all(sections.map(async s=>[s,await Q.hashJson(manifest[s])])));
const counts=Object.fromEntries(sections.map(s=>[s,count(manifest[s].map(d=>s==='S'?d.descriptor:['DSET','O'].includes(s)?{...d,key:d.destination_key}:d))]));
let damage=null,sealed=null;const chunks=new Map();
const wire=P.createRemote({request:async(s,path,method,body)=>{
 calls.push({path,method,body:copy(body)});
 assert.ok(path.startsWith('/api/v2/notes/mixed-transcript-writes/'));
 if(path.endsWith('/prepare'))return {schema_version:3,purpose:intent.purpose,operation_id:uid(3),mutation_id:intent.prepare.mutation_id,state:'prepared',lease_version:1,expires_at:'2026-11-01T00:00:00Z',metadata_manifest_digest:prepared.digest,metadata_header:damage==='control'?{...header,control:{...header.control,recording_id:8}}:header,counts,receipt:null,latest_context:context};
 if(path.endsWith('/manifest'))return {schema_version:3,section:body.section,metadata_manifest_digest:prepared.digest,metadata_header:header,counts,set_digests:sets,entries:manifest[body.section],next_cursor:null};
 if(path.endsWith('/source'))return {schema_version:3,operation_id:uid(3),metadata_manifest_digest:prepared.digest,entry_key:key,source_etag:uid(4),descriptor:old,total_chunks:1,total_bytes:10,chunk_index:0,data_base64:btoa('Previous\r\n')};
 if(path.endsWith('/chunks')){chunks.set(body.chunk_index,body.data_base64);return {chunk_index:body.chunk_index,source_etag:uid(5)};}
 if(path.endsWith('/entries/seal')){sealed=copy(body);return {sealed:true,ciphertext_sha256:body.ciphertext_sha256};}
 if(path.endsWith('/staged'))return {chunk_index:body.chunk_index,total_chunks:sealed.total_chunks,total_bytes:sealed.total_bytes,ciphertext_sha256:sealed.ciphertext_sha256,source_etag:uid(5),data_base64:chunks.get(body.chunk_index)};
 throw Error('unexpected_request');
}});
assert.equal(typeof wire.prepareTranscript,'function','MT must use the existing typed prepare route');
const actual=await wire.prepareTranscript(scope,intent);
assert.equal(calls.length,7);assert.equal(JSON.stringify(calls).includes('Original replacement'),false);
const stagedWork=await C.buildTranscriptWork(scope,actual,intent,'new-key',wire);
await wire.stage(scope,actual,stagedWork,'new-key');
assert.ok(sealed);assert.equal(chunks.size,1);
const oldBinding={...binding,transition_id:uid(6),crypto_epoch:1},oldOrigin={purpose:intent.purpose,operation_id:uid(6),recording_id:7,previous_descriptor:old};
const oldRaw=await Q.encryptRepresentation('Old protected\r\n',{key,output_kind:'linked_text_envelope_v1',output_epoch:1,is_null:false,expected_binding:oldBinding,operation_origin:oldOrigin},'old-key');
const cipherOld={...old,representation_kind:'linked_text_envelope_v1',representation_epoch:1,storage_operation_id:uid(6),semantic_origin_id:uid(6),origin_validator:'linked_mixed_v1',expected_binding:oldBinding,ciphertext_sha256:await Q.sha256(oldRaw)};
const cc={context,entries:[cipherOld],catalog_digest:await Q.hashJson({server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,context,entries:[cipherOld]})};
const origins=[{key,origin:{value:oldOrigin,legacy:null}}],ci=await C.planTranscript(scope,cc,cipherOld,text,origins),ch=copy(header),cm=copy(manifest);
ch.mutation_id=ci.prepare.mutation_id;ch.source_catalog_digest=cc.catalog_digest;ch.control.expected_descriptor=cipherOld;ch.operation_origin.previous_descriptor=cipherOld;cm.S[0].descriptor=cipherOld;
const cipherRemote={readSources:async(s,p,password,stores,resolve,supplied)=>{
 assert.equal(Q.canonicalJson(supplied),Q.canonicalJson(origins));
 return [{key,value:await Q.decryptRepresentation(oldRaw,cipherOld,supplied[0].origin,resolve,3)}];
}};
const cipherWork=await C.buildTranscriptWork(scope,await make(ch,cm),ci,'new-key',cipherRemote,[],async d=>d.output?'new-key':'old-key');
assert.equal(cipherWork.transfers[0].semantic,text);assert.equal(cipherWork.source_origins[0].origin.value.operation_id,uid(6));
const published={...context,base:{...context.base,history_generation:4}},output=stagedWork.transfers[0].descriptor;
let receiptDamage=null;
const receiptRemote=P.createRemote({request:async(s,path)=>{
 const descriptors=[copy(output)],result=copy(published);
 if(receiptDamage==='head')result.base.head_version++;
 if(receiptDamage==='origin')descriptors[0].semantic_origin_id=uid(99);
 if(receiptDamage==='slot')descriptors[0].linked_slot_version++;
 const digest=await Q.hashJson({server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,context:result,entries:descriptors});
 const receipt={schema_version:3,purpose:intent.purpose,operation_id:uid(3),mutation_id:intent.prepare.mutation_id,server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,result,
  metadata_manifest_digest:prepared.digest,set_digests:sets,ciphertext_manifest_digest:stagedWork.commit.client_verified_ciphertext_manifest_digest,origin_expectations_digest:await Q.hashJson(manifest.O),committed_at:'2026-10-31T00:00:00.000001Z'};
 if(path.endsWith('/status'))return {schema_version:3,purpose:intent.purpose,operation_id:uid(3),mutation_id:intent.prepare.mutation_id,state:'committed',lease_version:1,expires_at:'2026-11-01T00:00:00Z',metadata_manifest_digest:prepared.digest,metadata_header:header,counts,receipt,latest_context:result};
 if(path.endsWith('/context'))return {schema_version:3,server_instance_id:scope.instance,context:result,catalog_digest:digest};
 if(path.endsWith('/catalog'))return {schema_version:3,context:result,catalog_digest:digest,counts:count(descriptors),coverage:{supported_kinds:kinds,scope_complete:true,full_protection_complete:false},entries:descriptors,next_cursor:null};
 throw Error('unexpected_receipt');
}});
assert.equal((await receiptRemote.status(scope,actual,stagedWork)).receipt_matches_current,true);
for(const bad of ['head','origin','slot']){receiptDamage=bad;await assert.rejects(receiptRemote.status(scope,actual,stagedWork),/receipt|origin|transcript/);}
receiptDamage=null;
assert.equal(typeof C.verifyTranscriptPublication,'function','MT complete requires typed readback, not metadata alone');
const finalReceipt={schema_version:3,purpose:intent.purpose,operation_id:uid(3),mutation_id:intent.prepare.mutation_id,server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,result:published};
let typedDamage=null;
const reader={catalog:async()=>({context:published,entries:[output]}),read:async()=>({descriptor:output,origin:{value:origin,legacy:null},value:typedDamage==='text'?'wrong':text})};
await C.verifyTranscriptPublication(scope,actual,stagedWork,finalReceipt,reader,async()=> 'new-key');
typedDamage='text';await assert.rejects(C.verifyTranscriptPublication(scope,actual,stagedWork,finalReceipt,reader,async()=> 'new-key'),/transcript/);typedDamage=null;
damage='control';await assert.rejects(wire.prepareTranscript(scope,intent),/transcript/);damage=null;
const extra=copy(intent);extra.prepare.transcript='PRIVATE';const before=calls.length;
await assert.rejects(wire.prepareTranscript(scope,extra),/prepare|fields/);assert.equal(calls.length,before);
assert.equal(typeof P.createTranscript,'function','MT must reuse cipher-only mutation checkpoints');
let markers={},commits=0,prepares=0,committed=false,builds=0,ctx={...scope,enabled:true,auth:'test'};
const receipt={operation_id:uid(3)},journal={protectionOperations:()=>copy(markers),saveProtection:async m=>{assert.equal(JSON.stringify(m).includes(text),false);markers[m.id]=copy(m);}};
const durable={...wire,prepareTranscript:async()=>{prepares++;return actual;},stage:async()=>{},status:async()=>committed?{state:'committed',receipt,receipt_matches_current:true}:{state:'prepared'},commit:async()=>{commits++;committed=true;throw Error('response_lost');}};
const options={context:()=>ctx,journal,remote:durable,capture:async()=>({}),apply:async()=>{}};
const build=async()=>{builds++;return stagedWork;};
let controller=P.createTranscript(options);const id=await controller.start(scope,intent,'journal-key');
await assert.rejects(controller.resume(id,'wrong',build));assert.equal(prepares,0);
await assert.rejects(controller.resume(id,'journal-key',build),/response_lost/);assert.equal(markers[id].phase,'committing');
ctx={...ctx,owner:'bob'};await assert.rejects(controller.resume(id,'journal-key',build),/scope/);
ctx={...scope,enabled:true,auth:'reauth'};controller=P.createTranscript(options);await controller.resume(id,'journal-key',build);
assert.equal(markers[id].phase,'complete');assert.equal(commits,1);assert.equal(builds,1);assert.equal(prepares,1);
console.log('PASS typed transcript plan/new cipher/null/staging/readback/cipher journal/cold original status/no duplicate commit (synthetic)');
