import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
const box={crypto:webcrypto,structuredClone,TextEncoder,TextDecoder,Uint8Array,atob,btoa};
for(const name of ['protocol','state','analysis'])vm.runInNewContext(await readFile(new URL('../vendor/note-protection-'+name+'.js',import.meta.url),'utf8'),box);
const Q=box.NowNoteProtectionProtocol,A=box.NowNoteProtectionAnalysis,copy=structuredClone,uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const scope={url:'https://synthetic.invalid',owner:'alice',local_id:'one',instance:uid(1),device:'first'};
const context={base:{head_version:0,head_revision_id:null,crypto_epoch:1,history_generation:1,protection_state:'protected',inventory_revision_ids:[],identity_state:'related_only',current_exists:false},current_mode:'absent',selected_physical_note_id:null,mixed_metadata_version:1};
const d={key:{kind:'recording_transcript',id:'8',slot:'transcript'},representation_kind:'plain_text_v1',representation_epoch:0,is_null:true,representation_version:1,representation_etag:uid(2),storage_operation_id:null,semantic_origin_id:null,origin_validator:'linked_v1',origin_row_required:false,expected_binding:null,revision_ref:null,parent_ref:null,physical_note_id:null,inventory_revision_id:null,linked_slot_version:1,ciphertext_sha256:null};
const catalog={context,entries:[d],catalog_digest:await Q.hashJson({server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,context,entries:[d]})};
const request={schema_version:3,owner_id:scope.owner,local_id:scope.local_id,device_id:scope.device,server_instance_id:scope.instance,mutation_id:uid(3),source_context:{server_instance_id:scope.instance,base:context,catalog_digest:catalog.catalog_digest},source_keys:[{descriptor:d}],job_type:'memo_summary',prompt_version:'single_source_v1',source_job_id:null,execution_route:'client_provider',client_execution_confirmed:true};
const output_slots=[['analysis_error','error_message'],['analysis_input','input_text'],['analysis_result','result_json']].map(([kind,slot],i)=>({key:{kind,id:'12',slot},source_etag:uid(10+i),expected_binding:{server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,transition_id:uid(4),crypto_epoch:1,destination_key:{kind,id:'12',slot},revision_ref:null,parent_ref:null}}));
const fields=['source_context','source_keys','job_type','prompt_version','source_job_id'],pick=(v,ks)=>Object.fromEntries(ks.map(k=>[k,v[k]]));
const source_digest=await Q.hashJson(pick(request,fields));
const running={schema_version:3,execution_id:uid(4),job_id:12,job_id_mode:'allocated',state:'client_running',run_version:2,lease_version:1,expires_at:'2026-10-31T01:00:00.000000Z',source_context:request.source_context,source_keys:request.source_keys,source_digest,claim_metadata_digest:await Q.hashJson({schema_version:3,...pick(request,[...fields,'execution_route','client_execution_confirmed']),job_id:12,job_id_mode:'allocated',output_slots}),output_slots,dispatch_receipt:{schema_version:3,execution_id:uid(4),dispatch_id:uid(5),source_digest,run_version:2},terminal_receipt:null,bundle_metadata:null,source_matches_current:true,latest_context:context};
const input='ORIGINAL-INPUT\r\n',result=' { "summary": "ORIGINAL" }\r\n';
const work=await A.buildTerminalBundle(scope,request,running,input,{provider_terminal_observed:true,outcome:'done',result_json:result,error_message:null,error_code:null},'fixture-key');
const settled={...copy(running),state:'client_settled',run_version:3,bundle_metadata:work.bundle_metadata,terminal_receipt:{schema_version:3,execution_id:uid(4),original_job_id:12,dispatch_id:uid(5),source_digest,terminal_run_version:3,outcome:'done',bundle_digest:work.bundle_metadata.bundle_digest,client_reported:true,external_settled:true,result_server_persisted:false}};
const original=Q.canonicalJson(work),plan=await A.createInitialWritePlan(scope,request,settled,work,catalog,uid(99),'fixture-key');
assert.equal(plan.purpose,'mixed_analysis_write');assert.equal(plan.prepare.schema_version,3);assert.equal(plan.prepare.mutation_id,uid(99));
assert.equal(Q.canonicalJson(plan.prepare.execution_ref),Q.canonicalJson({schema_version:3,execution_id:uid(4),terminal_run_version:3,terminal_receipt_digest:await Q.hashJson(settled.terminal_receipt),original_bundle_digest:work.bundle_metadata.bundle_digest}));
assert.equal(Q.canonicalJson(plan.transfers),Q.canonicalJson(work.transfers));assert.equal(Q.canonicalJson(work),original);
assert.equal(Q.canonicalJson(plan).includes('ORIGINAL'),false);
await assert.rejects(()=>A.createInitialWritePlan(scope,request,settled,work,catalog,uid(99),'wrong-key'));
const changed=copy(catalog);changed.context.base.history_generation++;
await assert.rejects(()=>A.createInitialWritePlan(scope,request,settled,work,changed,uid(99),'fixture-key'),/source_changed/);
const tampered=copy(work);tampered.transfers[0].raw+='x';
await assert.rejects(()=>A.createInitialWritePlan(scope,request,settled,tampered,catalog,uid(99),'fixture-key'));
await assert.rejects(()=>A.createInitialWritePlan(scope,request,running,work,catalog,uid(99),'fixture-key'),/terminal_unsettled/);
const expectation=d=>({destination_key:d.key,...pick(d,['is_null','origin_validator','origin_row_required','storage_operation_id','semantic_origin_id'])});
const outputs=settled.output_slots.map((s,i)=>({destination_key:s.key,source_keys:[],source_etag:s.source_etag,output_kind:'linked_text_envelope_v1',output_epoch:1,is_null:work.bundle_metadata.slot_nulls[i].is_null,expected_binding:work.bundle_metadata.slot_nulls[i].is_null?null:s.expected_binding}));
const expectations=[expectation(d),...outputs.map(d=>({destination_key:d.destination_key,is_null:d.is_null,origin_validator:'linked_mixed_v1',origin_row_required:false,storage_operation_id:settled.execution_id,semantic_origin_id:settled.execution_id}))];
const manifest={schema_version:3,purpose:'mixed_analysis_write',operation_id:settled.execution_id,server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,actor_device_id:scope.device,mutation_id:uid(99),base:context,source_catalog_digest:catalog.catalog_digest,target_epoch:1,revision_ref:null,parent_ref:null,server_fields:null,
 control:{request_type:'initial',execution_ref:plan.prepare.execution_ref,previous_write_id:null,previous_write_state:'none',target_epoch:1,confirmed_reuse_original_result:false},
 operation_origin:{purpose:'mixed_analysis_write',operation_id:settled.execution_id,execution_id:settled.execution_id,request_type:'initial',source_context:settled.source_context,source_digest:settled.source_digest,terminal_receipt_digest:plan.prepare.execution_ref.terminal_receipt_digest,original_bundle_digest:work.bundle_metadata.bundle_digest,previous_write_id:null},
 S:[{descriptor:d,source_etag:uid(40)}],DSET:outputs,P:[d],O:Q.keyOrder(expectations.map(o=>o.destination_key)).map(k=>expectations.find(o=>Q.canonicalJson(o.destination_key)===Q.canonicalJson(k))),existing:[],verified_existing:[]};
const verified=await A.validateInitialWriteManifest(scope,plan,settled,catalog,manifest);
assert.equal(verified.metadata_manifest_digest,await Q.hashJson(manifest));assert.equal(verified.set_digests.DSET,await Q.hashJson(outputs));
for(const change of [m=>{m.operation_id=uid(70);},m=>{m.DSET[1].source_etag=uid(71);},m=>{m.P=[];},m=>{m.O[0].semantic_origin_id=uid(72);},m=>{m.existing=[{}];}]){
 const wrong=copy(manifest);change(wrong);await assert.rejects(()=>A.validateInitialWriteManifest(scope,plan,settled,catalog,wrong));
}
console.log('MA initial plan/manifest: original settled TR/BM/C bytes/nulls, exact six sets and digest, scope/catalog, wrong key/tamper/stale/unknown denial PASS (pure synthetic; no API/journal/Provider)');
const names=['S','DSET','P','O','existing','verified_existing'],header=Object.fromEntries(Object.entries(manifest).filter(([k])=>!names.includes(k)));
const operation={schema_version:3,purpose:plan.purpose,operation_id:settled.execution_id,mutation_id:uid(99),state:'prepared',lease_version:1,expires_at:running.expires_at,metadata_manifest_digest:verified.metadata_manifest_digest,metadata_header:header,counts:verified.counts,receipt:null,latest_context:context};
const originalExecution={reference:plan.prepare.execution_ref,source_schema_version:3,source_context:settled.source_context,terminal_receipt:settled.terminal_receipt,bundle_metadata:settled.bundle_metadata};
let prepareCalls=0,exists=false,losePrepare=true;const transportCalls=[],uploads=new Map();
const remote=box.NowNoteProtectionState.createRemote({request:async(s,path,method,body)=>{
 assert.equal(Q.canonicalJson(s),Q.canonicalJson(scope));transportCalls.push({path,method});
 if(path.endsWith('/status')){if(!exists)throw Object.assign(Error('not_found'),{status:404,code:'operation_not_found'});return {schema_version:3,status:'operation',operation:copy(operation),original_execution:copy(originalExecution)};}
 if(path.endsWith('/prepare')){prepareCalls++;assert.equal(Q.canonicalJson(body),Q.canonicalJson(plan.prepare));exists=true;if(losePrepare){losePrepare=false;throw Error('fixture_prepare_response_lost');}return copy(operation);}
 if(path.endsWith('/manifest')){assert.equal(body.operation_id,settled.execution_id);assert.equal(body.metadata_manifest_digest,verified.metadata_manifest_digest);return {schema_version:3,section:body.section,metadata_manifest_digest:verified.metadata_manifest_digest,metadata_header:copy(header),set_digests:copy(verified.set_digests),counts:copy(verified.counts),entries:copy(manifest[body.section]),next_cursor:null};}
 if(path.endsWith('/chunks')){
  const k=Q.canonicalJson(body.entry_key),entry=uploads.get(k)||{core:copy(body),chunks:[]};entry.chunks[body.chunk_index]=Buffer.from(body.data_base64,'base64');uploads.set(k,entry);
  return {chunk_index:body.chunk_index,source_etag:body.source_etag};
 }
 if(path.endsWith('/entries/seal')){
  const entry=uploads.get(Q.canonicalJson(body.entry_key));assert.ok(entry);entry.raw=Buffer.concat(entry.chunks);entry.hash=await Q.sha256(new Uint8Array(entry.raw));assert.equal(entry.hash,body.ciphertext_sha256);
  return {sealed:true,ciphertext_sha256:entry.hash};
 }
 if(path.endsWith('/staged')){
  const entry=uploads.get(Q.canonicalJson({kind:body.kind,id:body.representation_id,slot:body.slot}));assert.ok(entry?.raw);
  return {chunk_index:body.chunk_index,total_chunks:entry.core.total_chunks,total_bytes:entry.raw.length,ciphertext_sha256:entry.hash,source_etag:entry.core.source_etag,data_base64:entry.chunks[body.chunk_index].toString('base64')};
 }
 throw Error('unexpected_transport');
}});
await assert.rejects(()=>remote.prepareAnalysis(scope,plan,settled,catalog),/fixture_prepare_response_lost/);
const prepared=await remote.prepareAnalysis(scope,plan,settled,catalog);
assert.equal(prepareCalls,1);assert.equal(prepared.id,settled.execution_id);assert.equal(prepared.digest,verified.metadata_manifest_digest);
assert.ok(Q.canonicalJson(prepared.manifest)===Q.canonicalJson(Object.fromEntries(names.map(name=>[name,manifest[name]]))),'original six section arrays must be unchanged');assert.equal(transportCalls.filter(c=>c.path.endsWith('/manifest')).length,6);
console.log('MA prepare transport: original operation status before retry, no duplicate POST after lost response, exact six-page manifest PASS (synthetic HTTP; no server/journal/Provider)');
const wrongRef=copy(plan);wrongRef.prepare.execution_ref.execution_id=uid(88);const beforeBadRequest=transportCalls.length;
await assert.rejects(()=>remote.prepareAnalysis(scope,wrongRef,settled,catalog));assert.equal(transportCalls.length,beforeBadRequest,'wrong original execution must fail before any request');
const publicationWork=await A.buildInitialWriteWork(scope,request,settled,work,plan,prepared,catalog,'fixture-key');
assert.equal(Q.canonicalJson(publicationWork.transfers.map(t=>({key:t.key,raw:t.raw}))),Q.canonicalJson(work.transfers));
assert.equal(publicationWork.transfers.find(t=>t.key.kind==='analysis_result').semantic,result);
assert.equal(publicationWork.commit.target_epoch,1);assert.equal(publicationWork.commit.operation_id,settled.execution_id);
assert.equal(publicationWork.commit.client_verified_ciphertext_manifest_digest,await Q.hashJson(work.bundle_metadata.ciphertext_manifest));
await remote.stage(scope,prepared,publicationWork,'fixture-key');assert.equal(uploads.size,2);
for(const t of work.transfers)assert.ok(uploads.get(Q.canonicalJson(t.key)).raw.toString('utf8')===t.raw,'staged bytes must equal original terminal ciphertext');
const semanticTamper=copy(publicationWork);semanticTamper.transfers[0].semantic='altered';const puts=transportCalls.filter(c=>c.path.endsWith('/chunks')).length;
await assert.rejects(()=>remote.stage(scope,prepared,semanticTamper,'fixture-key'),/output_semantic/);
assert.equal(transportCalls.filter(c=>c.path.endsWith('/chunks')).length,puts);
console.log('MA initial stage: original ciphertext uploads/readback and real decrypt/meaning before commit, null excluded, semantic tamper/no upload PASS (synthetic transport only)');
