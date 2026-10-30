import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
const box={crypto:webcrypto,structuredClone,TextEncoder,TextDecoder,Uint8Array,atob,btoa};
for(const name of ['protocol','analysis'])vm.runInNewContext(await readFile(new URL('../vendor/note-protection-'+name+'.js',import.meta.url),'utf8'),box);
const Q=box.NowNoteProtectionProtocol,A=box.NowNoteProtectionAnalysis,copy=structuredClone;
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const scope={url:'https://synthetic.invalid',owner:'alice',local_id:'one',instance:uid(1),device:'first'};
const base={base:{head_version:0,head_revision_id:null,crypto_epoch:1,history_generation:1,protection_state:'protected',inventory_revision_ids:[],identity_state:'related_only',current_exists:false},current_mode:'absent',selected_physical_note_id:null,mixed_metadata_version:1};
const descriptor={key:{kind:'recording_transcript',id:'8',slot:'transcript'},representation_kind:'plain_text_v1',representation_epoch:0,is_null:true,representation_version:1,representation_etag:uid(2),storage_operation_id:null,semantic_origin_id:null,origin_validator:'linked_v1',origin_row_required:false,expected_binding:null,revision_ref:null,parent_ref:null,physical_note_id:null,inventory_revision_id:null,linked_slot_version:1,ciphertext_sha256:null};
const request={schema_version:3,owner_id:scope.owner,local_id:scope.local_id,device_id:scope.device,server_instance_id:scope.instance,mutation_id:uid(3),source_context:{server_instance_id:scope.instance,base,catalog_digest:'a'.repeat(64)},source_keys:[{descriptor}],job_type:'memo_summary',prompt_version:'single_source_v1',source_job_id:null,execution_route:'client_provider',client_execution_confirmed:true};
const output_slots=[['analysis_error','error_message'],['analysis_input','input_text'],['analysis_result','result_json']].map(([kind,slot],i)=>({key:{kind,id:'12',slot},source_etag:uid(10+i),expected_binding:{server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,transition_id:uid(4),crypto_epoch:1,destination_key:{kind,id:'12',slot},revision_ref:null,parent_ref:null}}));
const sourceFields=['source_context','source_keys','job_type','prompt_version','source_job_id'];
const source_digest=await Q.hashJson(Object.fromEntries(sourceFields.map(k=>[k,request[k]])));
const control=r=>({schema_version:3,...Object.fromEntries([...sourceFields,'execution_route','client_execution_confirmed'].map(k=>[k,request[k]])),job_id:r.job_id,job_id_mode:r.job_id_mode,output_slots:r.output_slots});
const pending={schema_version:3,execution_id:uid(4),job_id:12,job_id_mode:'allocated',state:'client_pending',run_version:1,lease_version:1,expires_at:'2026-10-31T01:00:00.000000Z',source_context:request.source_context,source_keys:request.source_keys,source_digest,claim_metadata_digest:'',output_slots,dispatch_receipt:null,terminal_receipt:null,bundle_metadata:null,source_matches_current:true,latest_context:base};
pending.claim_metadata_digest=await Q.hashJson(control(pending));
await A.validateExecution(scope,request,pending);
await assert.rejects(()=>A.validateExecution(scope,request,{...copy(pending),created:true}));
let checks=1;
for(const changed of [{schema_version:1},{job_id:true},{job_id_mode:'other'},{source_digest:'b'.repeat(64)},{claim_metadata_digest:'b'.repeat(64)},{source_context:{...request.source_context,server_instance_id:uid(9)}},{source_keys:[]},{run_version:2},{state:'client_running'},{source_matches_current:1},{extra:'not allowed'}]) {
  await assert.rejects(()=>A.validateExecution(scope,request,{...copy(pending),...changed}));checks++;
}
for(const changed of [{client_execution_confirmed:1},{device_id:'other'},{owner_id:'bob'},{schema_version:1},{source_keys:[{descriptor},{descriptor}]}]) {
  await assert.rejects(()=>A.validateExecution(scope,{...copy(request),...changed},pending));checks++;
}
const wrong=copy(pending);wrong.output_slots[0].expected_binding.owner_id='bob';wrong.claim_metadata_digest=await Q.hashJson(control(wrong));
await assert.rejects(()=>A.validateExecution(scope,request,wrong));checks++;
const running={...copy(pending),state:'client_running',run_version:2,dispatch_receipt:{schema_version:3,execution_id:uid(4),dispatch_id:uid(5),source_digest,run_version:2}};
await A.validateExecution(scope,request,running);checks++;
const unavailable={...copy(running),state:'result_unavailable',run_version:3,source_matches_current:false,latest_context:{...base,base:{...base.base,history_generation:9}},terminal_receipt:{schema_version:3,execution_id:uid(4),original_job_id:12,dispatch_id:uid(5),source_digest,terminal_run_version:3,outcome:'result_unavailable',bundle_digest:null,client_reported:true,external_settled:true,result_server_persisted:false}};
await A.validateExecution(scope,request,unavailable);checks++;
for(const changed of [{result_server_persisted:true},{external_settled:false},{bundle_digest:'a'.repeat(64)},{terminal_run_version:2},{dispatch_id:uid(9)}]) {
  const r=copy(unavailable);Object.assign(r.terminal_receipt,changed);await assert.rejects(()=>A.validateExecution(scope,request,r));checks++;
}
for(const outcome of ['done','failed']) {
  const nulls=output_slots.map(s=>({key:s.key,is_null:s.key.slot===(outcome==='done'?'error_message':'result_json')}));
  const ciphertext_manifest=[];
  for(const slot of output_slots.filter((s,i)=>!nulls[i].is_null)) {
    const raw=await Q.encryptRepresentation('SYNTHETIC-'+slot.key.slot,{key:slot.key,output_kind:'linked_text_envelope_v1',output_epoch:1,is_null:false,expected_binding:slot.expected_binding,operation_origin:null},'synthetic');
    ciphertext_manifest.push({entry_key:slot.key,destination_key:slot.key,source_etag:slot.source_etag,output_kind:'linked_text_envelope_v1',target_epoch:1,total_bytes:Buffer.byteLength(raw),ciphertext_sha256:await Q.sha256(raw)});
  }
  const bm={schema_version:3,source_digest,original_job_id:12,original_epoch:1,outcome,error_code:outcome==='done'?null:'provider_error',slot_nulls:nulls,ciphertext_manifest,bundle_digest:''};
  bm.bundle_digest=await Q.hashJson(Object.fromEntries(Object.entries(bm).filter(([k])=>k!=='bundle_digest')));
  const settled={...copy(running),state:'client_settled',run_version:3,bundle_metadata:bm,terminal_receipt:{...copy(unavailable.terminal_receipt),outcome,bundle_digest:bm.bundle_digest}};
  await A.validateExecution(scope,request,settled);checks++;
  for(const changed of [{original_epoch:2},{outcome:outcome==='done'?'failed':'done'},{ciphertext_manifest:[]},{slot_nulls:[]}]) {
    const r=copy(settled);Object.assign(r.bundle_metadata,changed);r.bundle_metadata.bundle_digest=await Q.hashJson(Object.fromEntries(Object.entries(r.bundle_metadata).filter(([k])=>k!=='bundle_digest')));r.terminal_receipt.bundle_digest=r.bundle_metadata.bundle_digest;
    await assert.rejects(()=>A.validateExecution(scope,request,r));checks++;
  }
}
console.log('MX metadata: '+checks+' checks PASS (synthetic protocol/crypto; no API, journal or Provider execution)');
