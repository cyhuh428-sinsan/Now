import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
const box={crypto:webcrypto,structuredClone,TextEncoder,TextDecoder,Uint8Array,atob,btoa};
for(const name of ['protocol','state','analysis','history-state'])vm.runInNewContext(await readFile(new URL('../vendor/'+(name==='history-state'?'note-history-state.js':'note-protection-'+name+'.js'),import.meta.url),'utf8'),box);
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
const changing=copy(pending),checking=A.validateExecution(scope,request,changing);
changing.output_slots[0].expected_binding.owner_id='changed-after-await';
assert.equal((await checking).output_slots[0].expected_binding.owner_id,'alice','metadata validation must freeze before its first await');
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
await A.validateExecution(scope,request,{...copy(running),state:'cancel_requested',run_version:4});checks++;
const repeatedCancelTerminal=copy(unavailable);repeatedCancelTerminal.run_version=5;repeatedCancelTerminal.terminal_receipt.terminal_run_version=5;
await A.validateExecution(scope,request,repeatedCancelTerminal);checks++;
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
let context={...scope,enabled:true,auth:'synthetic-auth'},saved={schema_version:1,contexts:{}},writeFail=false,lost=true,requests=[];
const journal=box.NowNoteHistory.create({initial:saved,context:()=>({...context,online:false}),request:async()=>{},write:async value=>{if(writeFail)throw Error('quota');saved=copy(value);}});
const route={provider:'omniroute',endpoint:'https://synthetic.invalid/v1',model:'auto'};
const input='SYNTHETIC-PROVIDER-INPUT-\\r\\n';
const call=async(s,path,method,body)=>{
  assert.equal(Object.values(journal.protectionOperations())[0].phase,'analysis_claiming','claim must not precede durable ciphertext');
  assert.equal(path,'/api/v2/notes/mixed-analysis-claims');assert.equal(method,'POST');
  assert.deepEqual(copy(body),request);requests.push(copy(body));
  if(lost){lost=false;throw Error('response_lost');}return copy(pending);
};
const create=()=>A.createExecution({context:()=>context,journal,request:call});
let execution=create();writeFail=true;
await assert.rejects(()=>execution.start(scope,request,input,route,'synthetic'),/quota/);
assert.equal(requests.length,0);assert.equal(Object.keys(journal.protectionOperations()).length,0);writeFail=false;
const mutableRequest=copy(request),mutableRoute=copy(route),starting=execution.start(scope,mutableRequest,input,mutableRoute,'synthetic');
mutableRequest.job_type='changed';mutableRoute.model='changed';
const id=await starting;
assert.equal(execution.status(id).phase,'analysis_claiming');
assert.ok(!JSON.stringify(saved).includes('SYNTHETIC-PROVIDER-INPUT-'));
assert.ok(!JSON.stringify(saved).includes('synthetic-auth'));
await assert.rejects(()=>execution.resumeClaim(id,'wrong'));
assert.equal(requests.length,0);
await assert.rejects(()=>execution.resumeClaim(id,'synthetic'),/response_lost/);
assert.equal(execution.status(id).phase,'analysis_claiming');
execution=create();await execution.resumeClaim(id,'synthetic');
assert.equal(execution.status(id).phase,'analysis_claimed');assert.equal(requests.length,2);
assert.deepEqual(requests[0],requests[1]);
const marker=execution.status(id),bundle=JSON.parse(await Q.decryptContent(marker.cipher_bundle,'synthetic'));
assert.equal(bundle.input,input);assert.deepEqual(bundle.route,route);assert.deepEqual(bundle.execution,pending);
const swapped=copy(pending);swapped.job_id_mode='provisional';swapped.claim_metadata_digest=await Q.hashJson(control(swapped));
await A.validateExecution(scope,request,swapped);
const changedExecution=A.createExecution({context:()=>context,journal,request:async()=>swapped});
await assert.rejects(()=>changedExecution.resumeClaim(id,'synthetic'),/execution_changed/);
context={...context,owner:'bob',auth:'other'};await assert.rejects(()=>execution.resumeClaim(id,'synthetic'),/scope/);
context={...scope,enabled:true,auth:'restored'};
const secondScope={...scope,local_id:'second'},secondRequest={...copy(request),local_id:'second'};
const second=await execution.start(secondScope,secondRequest,input,route,'synthetic');
let release;const waiting=new Promise(r=>{release=r;});
execution=A.createExecution({context:()=>context,journal,request:async()=>{await waiting;return copy(pending);}});
const late=execution.resumeClaim(second,'synthetic');
await new Promise(r=>setTimeout(r,10));execution.invalidate();release();
await assert.rejects(()=>late,/scope_changed/);
assert.equal(execution.status(second).phase,'analysis_claiming');
let enteredWrite,releaseWrite;
const entered=new Promise(r=>{enteredWrite=r;}),writeGate=new Promise(r=>{releaseWrite=r;});
const before={schema_version:1,contexts:{}};let disk=copy(before);
const delayed=box.NowNoteHistory.create({initial:before,context:()=>({...context,online:false}),request:async()=>{},write:async(value,guard)=>{
  enteredWrite();await writeGate;if(!guard.active())throw Error('cancelled_before_disk');disk=copy(value);
}});
const queued=A.createExecution({context:()=>context,journal:delayed,request:async()=>{throw Error('unexpected_request');}});
const storing=queued.start(scope,request,input,route,'synthetic');
const rejected=assert.rejects(()=>storing,/scope_changed|cancelled|인증/);
await entered;queued.invalidate();releaseWrite();await rejected;
assert.equal(JSON.stringify(disk)===JSON.stringify(before),true,'invalidating while storage waits must not publish the marker');
assert.equal(JSON.stringify(delayed.export())===JSON.stringify(before),true,'cancelled marker must roll back its memory projection exactly');
console.log('MX claim journal: cipher-only before request, failed write/no call, immutable replay, cold resume, wrong key/account, late invalidation PASS (synthetic transport; no Provider)');
context={...scope,enabled:true,auth:'dispatch-auth'};
let dispatchDisk={schema_version:1,contexts:{}},dispatchState=copy(pending),dispatchCalls=0,dispatchLost=true,settleLost=true,settleBodies=[];
const dispatchJournal=box.NowNoteHistory.create({initial:dispatchDisk,context:()=>({...context,online:false}),request:async()=>{},write:async(value,guard)=>{assert.equal(guard.active(),true);dispatchDisk=copy(value);}});
let activeDispatchJournal=dispatchJournal;
const dispatchRequest=async(s,path,method,body)=>{
  if(path.endsWith('/settle')){
    assert.equal(method,'POST');assert.equal(Object.values(activeDispatchJournal.protectionOperations())[0].phase,'analysis_settling');
    settleBodies.push(copy(body));
    assert.equal(Object.keys(body).sort().join(','),'bundle_metadata,claim_metadata_digest,device_id,dispatch_id,execution_id,lease_version,local_checkpoint_confirmed,local_id,outcome,owner_id,provider_terminal_observed,run_version,schema_version,server_instance_id,unavailable_reason');
    assert.equal(body.provider_terminal_observed,true);assert.equal(body.local_checkpoint_confirmed,true);assert.equal(body.unavailable_reason,null);
    dispatchState={...copy(running),state:'client_settled',run_version:body.run_version+1,bundle_metadata:copy(body.bundle_metadata),terminal_receipt:{schema_version:3,execution_id:pending.execution_id,original_job_id:pending.job_id,dispatch_id:running.dispatch_receipt.dispatch_id,source_digest:pending.source_digest,terminal_run_version:body.run_version+1,outcome:body.outcome,bundle_digest:body.bundle_metadata.bundle_digest,client_reported:true,external_settled:true,result_server_persisted:false}};
    if(settleLost){settleLost=false;throw Error('settle_response_lost');}return copy(dispatchState);
  }
  if(path.endsWith('/dispatch')){
    assert.equal(method,'POST');dispatchCalls++;
    assert.equal(Object.values(activeDispatchJournal.protectionOperations())[0].phase,'analysis_dispatching','dispatch core must be durable before POST');
    assert.deepEqual(copy(body),{schema_version:3,owner_id:scope.owner,local_id:scope.local_id,device_id:scope.device,server_instance_id:scope.instance,execution_id:pending.execution_id,run_version:1,lease_version:1,source_digest:pending.source_digest,claim_metadata_digest:pending.claim_metadata_digest});
    dispatchState=copy(running);if(dispatchLost){dispatchLost=false;throw Error('dispatch_response_lost');}return copy(dispatchState);
  }
  if(method==='POST'){assert.deepEqual(copy(body),request);return copy(pending);}
  assert.equal(path,'/api/v2/notes/mixed-analysis-claims/status');return copy(dispatchState);
};
const dispatcher=()=>A.createExecution({context:()=>context,journal:dispatchJournal,request:dispatchRequest});
let dispatching=dispatcher();const dispatchId=await dispatching.start(scope,request,input,route,'synthetic');
await dispatching.resumeClaim(dispatchId,'synthetic');
await assert.rejects(()=>dispatching.dispatch(dispatchId,'synthetic',{...route,input,confirmed:1}),/confirmation/);
await assert.rejects(()=>dispatching.dispatch(dispatchId,'synthetic',{...route,model:'different',input,confirmed:true}),/confirmation/);
assert.equal(dispatchCalls,0);
await assert.rejects(()=>dispatching.dispatch(dispatchId,'synthetic',{...route,input,confirmed:true}),/dispatch_response_lost/);
assert.equal(dispatching.status(dispatchId).phase,'analysis_dispatching');
dispatching=dispatcher();
const handoff=await dispatching.dispatch(dispatchId,'synthetic',{...route,input,confirmed:true});
assert.equal(dispatchCalls,1,'lost dispatch must recover the original DR before any metadata POST');
assert.equal(handoff.provider_state,'unknown');assert.equal(Object.hasOwn(handoff,'input'),false,'status recovery is not authority to start or repeat the Provider');assert.deepEqual(handoff.execution.dispatch_receipt,running.dispatch_receipt);
assert.equal(dispatching.status(dispatchId).phase,'analysis_running');
assert.ok(!JSON.stringify(dispatchDisk).includes('SYNTHETIC-PROVIDER-INPUT-'));
await assert.rejects(()=>dispatching.dispatch(dispatchId,'synthetic',{...route,input,confirmed:true}),/provider_outcome_unknown/);
dispatching=dispatcher();await assert.rejects(()=>dispatching.dispatch(dispatchId,'synthetic',{...route,input,confirmed:true}),/provider_outcome_unknown/);
assert.equal(dispatchCalls,1);
const knownJournal=box.NowNoteHistory.create({context:()=>({...context,online:false}),request:async()=>{},write:async(value,guard)=>{assert.equal(guard.active(),true);}});
activeDispatchJournal=knownJournal;dispatchState=copy(pending);dispatchLost=false;
const known=A.createExecution({context:()=>context,journal:knownJournal,request:dispatchRequest});
const knownId=await known.start(scope,request,input,route,'synthetic');await known.resumeClaim(knownId,'synthetic');
const ready=await known.dispatch(knownId,'synthetic',{...route,input,confirmed:true});
assert.equal(ready.provider_state,'ready');assert.equal(ready.input,input);assert.deepEqual(ready.route,route);
const reserved=JSON.parse(await Q.decryptContent(known.status(knownId).cipher_bundle,'synthetic'));assert.equal(reserved.dispatch.handoff_reserved,true,'single handoff must be reserved durably before returning input');
await assert.rejects(()=>known.dispatch(knownId,'synthetic',{...route,input,confirmed:true}),/provider_outcome_unknown/);
console.log('MX dispatch: explicit exact confirmation, durable original core, lost-response status-first DR recovery, single handoff/no automatic Provider retry PASS (synthetic transport; Provider calls 0)');
async function dispatchScenario({stale=false,failHandoff=false,hold=false,failTerminal=false,holdTerminal=false,loseUnavailable=false}={}) {
  const state={current:copy(pending),calls:0,failHandoff,requests:[],settleBodies:[],loseUnavailable},disk={value:{schema_version:1,contexts:{}}};
  let entered,release;const inside=new Promise(r=>{entered=r;}),gate=new Promise(r=>{release=r;});
  let enteredTerminal,releaseTerminal;const terminalInside=new Promise(r=>{enteredTerminal=r;}),terminalGate=new Promise(r=>{releaseTerminal=r;});
  const journal=box.NowNoteHistory.create({context:()=>({...context,online:false}),request:async()=>{},write:async(value,guard)=>{
    assert.equal(guard.active(),true);
    if(state.failHandoff&&Object.values(value.protection_operations||{}).some(m=>m.phase==='analysis_running'))throw Error('handoff_write_failed');
    if(Object.values(value.protection_operations||{}).some(m=>m.phase==='analysis_terminal')){
      if(failTerminal)throw Error('terminal_store_failed');
      if(holdTerminal){enteredTerminal();await terminalGate;if(!guard.active())throw Error('terminal_store_cancelled');}
    }
    disk.value=copy(value);
  }});
  const controller=A.createExecution({context:()=>context,journal,request:async(s,path,method,body)=>{
    state.requests.push({path,method});
    if(path.endsWith('/settle')){
      assert.equal(body.outcome,'result_unavailable');assert.equal(body.bundle_metadata,null);assert.equal(body.local_checkpoint_confirmed,false);assert.equal(body.provider_terminal_observed,true);
      state.settleBodies.push(copy(body));
      state.current={...copy(state.current),state:'result_unavailable',run_version:body.run_version+1,bundle_metadata:null,
        terminal_receipt:{schema_version:3,execution_id:pending.execution_id,original_job_id:pending.job_id,dispatch_id:running.dispatch_receipt.dispatch_id,source_digest:pending.source_digest,terminal_run_version:body.run_version+1,outcome:'result_unavailable',bundle_digest:null,client_reported:true,external_settled:true,result_server_persisted:false}};
      if(state.loseUnavailable){state.loseUnavailable=false;throw Error('unavailable_response_lost');}return copy(state.current);
    }
    if(path.endsWith('/dispatch')){state.calls++;state.current=copy(running);if(hold){entered();await gate;}return copy(state.current);}
    return copy(method==='POST'?pending:state.current);
  }});
  const id=await controller.start(scope,request,input,route,'synthetic');await controller.resumeClaim(id,'synthetic');
  if(stale){state.current.source_matches_current=false;state.current.latest_context=copy(state.current.latest_context);state.current.latest_context.base.history_generation++;}
  return {controller,journal,id,state,disk,inside,release,terminalInside,releaseTerminal};
}
const confirmed={...route,input,confirmed:true};
const stale=await dispatchScenario({stale:true});
await assert.rejects(()=>stale.controller.dispatch(stale.id,'synthetic',confirmed),/source_changed/);assert.equal(stale.state.calls,0);
const failedStore=await dispatchScenario({failHandoff:true});
await assert.rejects(()=>failedStore.controller.dispatch(failedStore.id,'synthetic',confirmed),/handoff_write_failed/);
assert.equal(failedStore.controller.status(failedStore.id).phase,'analysis_dispatching');assert.equal(failedStore.state.calls,1);
failedStore.state.failHandoff=false;
const afterFailedStore=await failedStore.controller.dispatch(failedStore.id,'synthetic',confirmed);
assert.equal(afterFailedStore.provider_state,'unknown');assert.equal(Object.hasOwn(afterFailedStore,'input'),false);assert.equal(failedStore.state.calls,1);
const lateDispatch=await dispatchScenario({hold:true});
const dispatchingLate=lateDispatch.controller.dispatch(lateDispatch.id,'synthetic',confirmed),lateRejected=assert.rejects(()=>dispatchingLate,/scope_changed/);
await lateDispatch.inside;lateDispatch.controller.invalidate();lateDispatch.release();await lateRejected;
assert.equal(lateDispatch.controller.status(lateDispatch.id).phase,'analysis_dispatching');
const terminalRecovery=A.createExecution({context:()=>context,journal:lateDispatch.journal,request:async()=>copy(unavailable)});
const terminalRecovered=await terminalRecovery.dispatch(lateDispatch.id,'synthetic',confirmed);
assert.equal(terminalRecovered.provider_state,'terminal');assert.equal(terminalRecovered.execution.terminal_receipt.outcome,'result_unavailable');assert.equal(Object.hasOwn(terminalRecovered,'input'),false);
console.log('MX dispatch boundaries: stale source/no POST, failed durable handoff/no input, late invalidation, observed terminal distinct from unknown PASS (synthetic only)');
const legacyMarker=execution.status(id),legacyBundle=Q.parseJson(await Q.decryptContent(legacyMarker.cipher_bundle,'synthetic'));
delete legacyBundle.dispatch;delete legacyBundle.terminal;legacyMarker.cipher_bundle=await Q.encryptContent(Q.canonicalJson(legacyBundle),'synthetic');await journal.saveProtection(legacyMarker);
const legacyReader=A.createExecution({context:()=>context,journal,request:async()=>copy(pending)});
await legacyReader.resumeClaim(id,'synthetic');
const legacyReadback=Q.parseJson(await Q.decryptContent(legacyReader.status(id).cipher_bundle,'synthetic'));
assert.equal(legacyReadback.input,input);assert.equal(legacyReadback.dispatch,null);
const terminalReader=A.createExecution({context:()=>context,journal,request:async()=>copy(unavailable)});
await terminalReader.resumeClaim(id,'synthetic');
const replacedReceipt=copy(unavailable);replacedReceipt.dispatch_receipt.dispatch_id=uid(99);replacedReceipt.terminal_receipt.dispatch_id=uid(99);
await A.validateExecution(scope,request,replacedReceipt);
const badProgress=A.createExecution({context:()=>context,journal,request:async()=>replacedReceipt});
await assert.rejects(()=>badProgress.resumeClaim(id,'synthetic'),/execution_changed/);
console.log('MX compatibility: original claim-only cipher bundle and immutable observed DR/TR preserved PASS (synthetic only)');
for(const outcome of ['done','failed']){
  const observation={provider_terminal_observed:true,outcome,result_json:outcome==='done'?' { "summary": "SYNTHETIC-RESULT" }\r\n':null,error_message:outcome==='failed'?'\uFEFFSYNTHETIC-ERROR\r\n':null,error_code:outcome==='failed'?'provider_error':null};
  const work=await A.buildTerminalBundle(scope,request,running,input,observation,'synthetic');
  const opened=await A.openTerminalBundle(scope,request,running,work,'synthetic');
  assert.deepEqual(copy(opened),{input_text:input,result_json:observation.result_json,error_message:observation.error_message});
  const changedRaw=copy(work);changedRaw.transfers[0].raw+=' ';
  await assert.rejects(()=>A.openTerminalBundle(scope,request,running,changedRaw,'synthetic'),/cipher|length|digest/);
  await assert.rejects(()=>A.openTerminalBundle(scope,request,running,work,'wrong'));
  await A.validateBundle(running,work.bundle_metadata);
  assert.equal(work.transfers.length,2);assert.equal(work.bundle_metadata.original_epoch,1);
  assert.equal(JSON.stringify(work).includes('SYNTHETIC-RESULT'),false);assert.equal(JSON.stringify(work).includes('SYNTHETIC-ERROR'),false);
  for(const slot of output_slots){
    const expected=slot.key.slot==='input_text'?input:observation[slot.key.slot];
    const transfer=work.transfers.find(t=>Q.canonicalJson(t.key)===Q.canonicalJson(slot.key));
    if(expected===null){assert.equal(transfer,undefined);continue;}
    const d={...copy(descriptor),key:slot.key,representation_kind:'linked_text_envelope_v1',representation_epoch:1,is_null:false,representation_etag:slot.source_etag,storage_operation_id:running.execution_id,expected_binding:slot.expected_binding,ciphertext_sha256:await Q.sha256(transfer.raw)};
    assert.equal(await Q.decryptRepresentation(transfer.raw,d,{value:null,legacy:null},async()=> 'synthetic',3),expected,'terminal cipher must preserve original text including CRLF/FEFF/JSON whitespace');
    const c=work.bundle_metadata.ciphertext_manifest.find(c=>Q.canonicalJson(c.destination_key)===Q.canonicalJson(slot.key));
    assert.equal(c.total_bytes,Buffer.byteLength(transfer.raw));assert.equal(c.ciphertext_sha256,await Q.sha256(transfer.raw));
  }
}
const terminalObservation={provider_terminal_observed:true,outcome:'done',result_json:'SYNTHETIC-FROZEN-RESULT',error_message:null,error_code:null};
const mutableObservation=copy(terminalObservation),building=A.buildTerminalBundle(scope,request,running,input,mutableObservation,'synthetic');
mutableObservation.result_json='changed-after-await';
const frozenWork=await building;assert.equal(frozenWork.bundle_metadata.outcome,'done');
const frozenTransfer=frozenWork.transfers.find(t=>t.key.slot==='result_json'),resultSlot=output_slots.find(s=>s.key.slot==='result_json');
const frozenDescriptor={...copy(descriptor),key:resultSlot.key,representation_kind:'linked_text_envelope_v1',representation_epoch:1,is_null:false,representation_etag:resultSlot.source_etag,storage_operation_id:running.execution_id,expected_binding:resultSlot.expected_binding,ciphertext_sha256:await Q.sha256(frozenTransfer.raw)};
assert.equal(await Q.decryptRepresentation(frozenTransfer.raw,frozenDescriptor,{value:null,legacy:null},async()=> 'synthetic',3),terminalObservation.result_json);
await assert.rejects(()=>A.buildTerminalBundle(scope,request,running,input,{...terminalObservation,provider_terminal_observed:false},'synthetic'),/terminal_unobserved/);
await assert.rejects(()=>A.buildTerminalBundle(scope,request,running,input,{...terminalObservation,error_message:'unexpected'},'synthetic'),/terminal_shape/);
await assert.rejects(()=>A.buildTerminalBundle(scope,request,running,input,terminalObservation,''),/key_required/);
let activeCalls=0;await assert.rejects(()=>A.buildTerminalBundle(scope,request,running,input,terminalObservation,'synthetic',()=>++activeCalls<3),/scope_changed/);
console.log('MX terminal bundle: original job/epoch/slots, done/failed/null shape, real cipher readback/exact CRLF/FEFF/JSON, frozen observation and terminal/key/late guards PASS (synthetic; no journal/API/Provider)');
await assert.rejects(()=>known.recordTerminal({...ready},terminalObservation,'synthetic'),/handoff_unknown/);
await assert.rejects(()=>known.recordTerminal(ready,{...terminalObservation,provider_terminal_observed:false},'synthetic'),/terminal_unobserved/);
await assert.rejects(()=>known.recordTerminal(ready,terminalObservation,'wrong'));
assert.equal(known.status(knownId).phase,'analysis_running');
const terminalSaved=await known.recordTerminal(ready,terminalObservation,'synthetic');
assert.equal(known.status(knownId).phase,'analysis_terminal');assert.equal(settleBodies.length,0,'cipher checkpoint must precede settle');
const terminalArchive=Q.parseJson(await Q.decryptContent(known.status(knownId).cipher_bundle,'synthetic'));
assert.equal(JSON.stringify(terminalArchive.terminal.work).includes('SYNTHETIC-FROZEN-RESULT'),false);
assert.equal(terminalArchive.terminal.work.bundle_metadata.bundle_digest,terminalSaved.bundle_metadata.bundle_digest);
await assert.rejects(()=>known.recordTerminal(ready,terminalObservation,'synthetic'),/terminal_already_recorded/);
activeDispatchJournal=knownJournal;
await assert.rejects(()=>known.settleTerminal(knownId,'synthetic'),/settle_response_lost/);
assert.equal(known.status(knownId).phase,'analysis_settling');assert.equal(settleBodies.length,1);
const waitingArchive=Q.parseJson(await Q.decryptContent(known.status(knownId).cipher_bundle,'synthetic'));
assert.deepEqual(waitingArchive.terminal.work,terminalArchive.terminal.work,'settle loss must not rebuild ciphertext');
const coldJournal=box.NowNoteHistory.create({initial:knownJournal.export(),context:()=>({...context,online:false}),request:async()=>{},write:async(value,guard)=>{assert.equal(guard.active(),true);}});
activeDispatchJournal=coldJournal;
const coldTerminal=A.createExecution({context:()=>context,journal:coldJournal,request:dispatchRequest});
const recoveredReceipt=await coldTerminal.settleTerminal(knownId,'synthetic');
assert.equal(settleBodies.length,1,'settle response loss must query original TR/BM before any POST');
assert.equal(coldTerminal.status(knownId).phase,'analysis_settled');assert.equal(recoveredReceipt.bundle_digest,terminalSaved.bundle_metadata.bundle_digest);
const resumedArchive=Q.parseJson(await Q.decryptContent(coldTerminal.status(knownId).cipher_bundle,'synthetic'));
assert.deepEqual(resumedArchive.terminal.work,terminalArchive.terminal.work);assert.equal(Q.canonicalJson(resumedArchive.terminal.settle_core),Q.canonicalJson(settleBodies[0]));
assert.deepEqual(await coldTerminal.settleTerminal(knownId,'synthetic'),recoveredReceipt);assert.equal(settleBodies.length,1);
console.log('MX terminal journal: live handoff only, cipher checkpoint before immutable settle, lost response/cold TR-BM recovery, same cipher/core and no duplicate POST PASS (synthetic; Provider 0)');
const unavailableKey=await dispatchScenario(),unavailableHandoff=await unavailableKey.controller.dispatch(unavailableKey.id,'synthetic',confirmed),beforeInvalidation=unavailableKey.state.requests.length;
unavailableKey.controller.invalidate();await assert.rejects(()=>unavailableKey.controller.recordTerminal(unavailableHandoff,terminalObservation,'synthetic'),/terminal_key_unavailable/);
assert.equal(unavailableKey.state.requests.length,beforeInvalidation);assert.equal(unavailableKey.controller.status(unavailableKey.id).phase,'analysis_running');
const failedTerminal=await dispatchScenario({failTerminal:true}),failedTerminalHandoff=await failedTerminal.controller.dispatch(failedTerminal.id,'synthetic',confirmed);
await assert.rejects(()=>failedTerminal.controller.recordTerminal(failedTerminalHandoff,terminalObservation,'synthetic'),/terminal_store_failed/);
assert.equal(failedTerminal.controller.status(failedTerminal.id).phase,'analysis_running');assert.equal(failedTerminal.state.requests.some(r=>r.path.endsWith('/settle')),false);
await assert.rejects(()=>failedTerminal.controller.recordTerminal(failedTerminalHandoff,terminalObservation,'synthetic'),/terminal_already_recorded/);
const heldTerminal=await dispatchScenario({holdTerminal:true}),heldHandoff=await heldTerminal.controller.dispatch(heldTerminal.id,'synthetic',confirmed);
const beforeHeld=Q.canonicalJson(heldTerminal.disk.value),recording=heldTerminal.controller.recordTerminal(heldHandoff,terminalObservation,'synthetic'),cancelledRecording=assert.rejects(()=>recording,/scope_changed|cancelled/);
await heldTerminal.terminalInside;heldTerminal.controller.invalidate();heldTerminal.releaseTerminal();await cancelledRecording;
assert.equal(Q.canonicalJson(heldTerminal.disk.value),beforeHeld,'locking while the terminal journal write waits must preserve the previous disk marker');
assert.equal(heldTerminal.controller.status(heldTerminal.id).phase,'analysis_running');assert.equal(heldTerminal.state.requests.some(r=>r.path.endsWith('/settle')),false);
console.log('MX terminal boundaries: key invalidation/no request, checkpoint failure/no settle or new cipher, delayed write lock/disk unchanged PASS (synthetic only)');
const unavailableObservation={provider_terminal_observed:true,unavailable_reason:'key_unavailable'};
await assert.rejects(()=>unavailableKey.controller.reportUnavailable(unavailableHandoff,{...unavailableObservation,provider_terminal_observed:false}),/terminal_unobserved/);
assert.equal(unavailableKey.state.requests.length,beforeInvalidation);
const unavailableBefore=Q.canonicalJson(unavailableKey.disk.value),unavailableReceipt=await unavailableKey.controller.reportUnavailable(unavailableHandoff,unavailableObservation);
assert.equal(unavailableReceipt.outcome,'result_unavailable');assert.equal(unavailableKey.state.settleBodies.length,1);
assert.equal(Q.canonicalJson(unavailableKey.disk.value),unavailableBefore,'key-free metadata terminal must not rewrite the cipher journal');
assert.equal(Q.canonicalJson(unavailableKey.state.settleBodies).includes('SYNTHETIC-PROVIDER-INPUT-'),false);
assert.deepEqual(await unavailableKey.controller.reportUnavailable(unavailableHandoff,unavailableObservation),unavailableReceipt);assert.equal(unavailableKey.state.settleBodies.length,1);
const lostUnavailable=await dispatchScenario({loseUnavailable:true}),lostUnavailableHandoff=await lostUnavailable.controller.dispatch(lostUnavailable.id,'synthetic',confirmed);
lostUnavailable.controller.invalidate();
await assert.rejects(()=>lostUnavailable.controller.reportUnavailable(lostUnavailableHandoff,unavailableObservation),/unavailable_response_lost/);
await lostUnavailable.controller.reportUnavailable(lostUnavailableHandoff,unavailableObservation);assert.equal(lostUnavailable.state.settleBodies.length,1,'unavailable loss must recover the original TR before any POST');
await assert.rejects(()=>lostUnavailable.controller.reportUnavailable(lostUnavailableHandoff,{...unavailableObservation,unavailable_reason:'cipher_store_failed'}),/terminal_core_changed/);assert.equal(lostUnavailable.state.settleBodies.length,1);
const changedSourceUnavailable=await dispatchScenario(),changedSourceHandoff=await changedSourceUnavailable.controller.dispatch(changedSourceUnavailable.id,'synthetic',confirmed);
changedSourceUnavailable.state.current.source_matches_current=false;changedSourceUnavailable.state.current.latest_context=copy(changedSourceUnavailable.state.current.latest_context);changedSourceUnavailable.state.current.latest_context.base.history_generation++;
changedSourceUnavailable.controller.invalidate();assert.equal((await changedSourceUnavailable.controller.reportUnavailable(changedSourceHandoff,unavailableObservation)).outcome,'result_unavailable','terminal observation must not be discarded merely because the current source changed');
const accountUnavailable=await dispatchScenario(),accountHandoff=await accountUnavailable.controller.dispatch(accountUnavailable.id,'synthetic',confirmed),accountRequests=accountUnavailable.state.requests.length;
const originalContext=copy(context);context={...context,owner:'bob',auth:'different-account'};
await assert.rejects(()=>accountUnavailable.controller.reportUnavailable(accountHandoff,unavailableObservation),/scope_changed/);
context={...originalContext,auth:'new-authentication'};await assert.rejects(()=>accountUnavailable.controller.reportUnavailable(accountHandoff,unavailableObservation),/scope_changed/);
assert.equal(accountUnavailable.state.requests.length,accountRequests);context=originalContext;
console.log('MX unavailable metadata: positive terminal only, same auth after key invalidation, no raw/key/journal write, original TR recovery/no duplicate POST, other auth denied PASS (synthetic only)');
const recoveryCalls=[];
const recoveryJournal=box.NowNoteHistory.create({initial:unavailableKey.journal.export(),context:()=>({...context,online:false}),request:async()=>{},write:async(value,guard)=>{assert.equal(guard.active(),true);}});
const recovering=A.createExecution({context:()=>context,journal:recoveryJournal,request:async(s,path,method)=>{recoveryCalls.push({path,method});return copy(unavailableKey.state.current);}});
await assert.rejects(()=>recovering.reconcileUnavailable(unavailableKey.id,'wrong'));
assert.equal(recoveryCalls.length,0);
const beforeRecovery=Q.parseJson(await Q.decryptContent(recovering.status(unavailableKey.id).cipher_bundle,'synthetic'));
const recoveredUnavailable=await recovering.reconcileUnavailable(unavailableKey.id,'synthetic');
assert.equal(recoveredUnavailable.outcome,'result_unavailable');assert.equal(recovering.status(unavailableKey.id).phase,'complete');
assert.equal(recoveryCalls.length,1);assert.equal(recoveryCalls[0].method,'GET');
const afterRecovery=Q.parseJson(await Q.decryptContent(recovering.status(unavailableKey.id).cipher_bundle,'synthetic'));
for(const key of ['request','input','route','dispatch'])assert.equal(Q.canonicalJson(beforeRecovery[key]),Q.canonicalJson(afterRecovery[key]));
assert.equal(afterRecovery.terminal,null);assert.equal(Q.canonicalJson(afterRecovery.execution.terminal_receipt),Q.canonicalJson(recoveredUnavailable));
await recovering.reconcileUnavailable(unavailableKey.id,'synthetic');assert.equal(recoveryCalls.length,2);
const pendingRecovery=await dispatchScenario();await pendingRecovery.controller.dispatch(pendingRecovery.id,'synthetic',confirmed);
await assert.rejects(()=>pendingRecovery.controller.reconcileUnavailable(pendingRecovery.id,'synthetic'),/unavailable_receipt_missing/);
assert.equal(pendingRecovery.controller.status(pendingRecovery.id).phase,'analysis_running');assert.equal(pendingRecovery.state.settleBodies.length,0);
console.log('MX unavailable cold reconciliation: key required before GET, original TR only, cipher archive preserved, no Provider/POST, unknown stays pending PASS (synthetic only)');
await assert.rejects(()=>coldTerminal.inspectExecution(knownId,'wrong'));
const inspected=await coldTerminal.inspectExecution(knownId,'synthetic');
assert.equal(inspected.input,input);assert.equal(Q.canonicalJson(inspected.route),Q.canonicalJson(route));
assert.equal(inspected.execution.terminal_receipt.bundle_digest,recoveredReceipt.bundle_digest);
inspected.route.endpoint='https://changed.invalid';
assert.equal((await coldTerminal.inspectExecution(knownId,'synthetic')).route.endpoint,route.endpoint);
const readTerminal=await coldTerminal.readTerminal(knownId,'synthetic');
assert.equal(readTerminal.input_text,input);assert.equal(readTerminal.result_json,terminalObservation.result_json);
await assert.rejects(()=>pendingRecovery.controller.readTerminal(pendingRecovery.id,'synthetic'),/terminal_checkpoint_missing/);
const consuming=await dispatchScenario(),consumingHandoff=await consuming.controller.dispatch(consuming.id,'synthetic',confirmed);
consuming.controller.consumeHandoff(consumingHandoff);
assert.throws(()=>consuming.controller.consumeHandoff(consumingHandoff),/provider_already_started/);
const lockedConsumption=await dispatchScenario(),lockedHandoff=await lockedConsumption.controller.dispatch(lockedConsumption.id,'synthetic',confirmed);
lockedConsumption.controller.invalidate();assert.throws(()=>lockedConsumption.controller.consumeHandoff(lockedHandoff),/terminal_key_unavailable/);
const dispatchRecovery=await dispatchScenario({failHandoff:true});await assert.rejects(()=>dispatchRecovery.controller.dispatch(dispatchRecovery.id,'synthetic',confirmed),/handoff_write_failed/);dispatchRecovery.state.failHandoff=false;
const recoveredDispatch=await dispatchRecovery.controller.recoverDispatch(dispatchRecovery.id,'synthetic');
assert.equal(recoveredDispatch.provider_state,'unknown');assert.equal(Object.hasOwn(recoveredDispatch,'input'),false);assert.equal(dispatchRecovery.state.calls,1);
const missingDispatch=await dispatchScenario({failHandoff:true});await assert.rejects(()=>missingDispatch.controller.dispatch(missingDispatch.id,'synthetic',confirmed),/handoff_write_failed/);missingDispatch.state.failHandoff=false;missingDispatch.state.current=copy(pending);
const missingBefore=missingDispatch.controller.status(missingDispatch.id).cipher_bundle;
assert.equal((await missingDispatch.controller.recoverDispatch(missingDispatch.id,'synthetic')).provider_state,'not_dispatched');
assert.equal(missingDispatch.state.calls,1);assert.equal(missingDispatch.controller.status(missingDispatch.id).cipher_bundle,missingBefore);
