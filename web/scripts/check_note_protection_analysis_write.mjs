import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
const box={crypto:webcrypto,structuredClone,TextEncoder,TextDecoder,Uint8Array,atob,btoa};
for(const name of ['protocol','state','client','analysis'])vm.runInNewContext(await readFile(new URL('../vendor/note-protection-'+name+'.js',import.meta.url),'utf8'),box);
vm.runInNewContext(await readFile(new URL('../vendor/note-history-state.js',import.meta.url),'utf8'),box);
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
let prepareCalls=0,exists=false,losePrepare=true,commitCalls=0,loseCommit=true,publishedRows=[],resultContext=null,publishedCounts=null,wrongTypedOrigin=false,expectedPrepare=plan.prepare,activePubJournal=null,activePubId=null;const transportCalls=[],uploads=new Map();
const transport=async(s,path,method,body)=>{
 assert.equal(Q.canonicalJson(s),Q.canonicalJson(scope));transportCalls.push({path,method});
 if(path.endsWith('/status')){if(!exists)throw Object.assign(Error('not_found'),{status:404,code:'operation_not_found'});return {schema_version:3,status:'operation',operation:copy(operation),original_execution:copy(originalExecution)};}
 if(path.endsWith('/prepare')){prepareCalls++;assert.ok(Q.canonicalJson(body)===Q.canonicalJson(expectedPrepare),'original prepare core changed');if(activePubJournal){const saved=Q.parseJson(await Q.decryptContent(activePubJournal.protectionOperations()[activePubId].cipher_bundle,'fixture-key'));assert.ok(Q.canonicalJson(saved.publication.plan.prepare)===Q.canonicalJson(body),'prepare before durable plan');}exists=true;if(losePrepare){losePrepare=false;throw Error('fixture_prepare_response_lost');}return copy(operation);}
 if(path.endsWith('/manifest')){if(['stale','aborted','committed','expired'].includes(operation.state))throw Object.assign(Error('terminal_manifest_denied'),{status:operation.state==='expired'?410:409,code:operation.state==='expired'?'operation_expired':'operation_not_active'});assert.equal(body.operation_id,settled.execution_id);assert.equal(body.metadata_manifest_digest,verified.metadata_manifest_digest);return {schema_version:3,section:body.section,metadata_manifest_digest:verified.metadata_manifest_digest,metadata_header:copy(header),set_digests:copy(verified.set_digests),counts:copy(verified.counts),entries:copy(manifest[body.section]),next_cursor:null};}
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
 if(path.endsWith('/commit')){
  const durable=activePubJournal?Q.parseJson(await Q.decryptContent(activePubJournal.protectionOperations()[activePubId].cipher_bundle,'fixture-key')).publication.work.commit:publicationWork.commit;
  commitCalls++;assert.ok(Q.canonicalJson(body)===Q.canonicalJson(durable),'original durable commit core changed');operation.state='committed';operation.latest_context=copy(resultContext);
  operation.receipt={schema_version:3,purpose:plan.purpose,operation_id:body.operation_id,mutation_id:body.mutation_id,server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,result:copy(resultContext),metadata_manifest_digest:body.metadata_manifest_digest,set_digests:copy(verified.set_digests),ciphertext_manifest_digest:body.client_verified_ciphertext_manifest_digest,origin_expectations_digest:await Q.hashJson(manifest.O),committed_at:'2026-10-31T01:00:00.000000Z'};
  if(loseCommit){loseCommit=false;throw Error('fixture_commit_response_lost');}return copy(operation);
 }
 if(path.endsWith('/mixed-representations/context'))return {schema_version:3,server_instance_id:scope.instance,context:copy(resultContext),counts:copy(publishedCounts),coverage:{supported_kinds:verified.counts.P.by_kind.map(r=>r.kind),scope_complete:true,full_protection_complete:false},catalog_digest:await Q.hashJson({server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,context:resultContext,entries:publishedRows})};
 if(path.endsWith('/mixed-representations/catalog'))return {schema_version:3,context:copy(resultContext),catalog_digest:body.catalog_digest,entries:copy(publishedRows),counts:copy(publishedCounts),coverage:{supported_kinds:verified.counts.P.by_kind.map(r=>r.kind),scope_complete:true,full_protection_complete:false},next_cursor:null};
 if(path.endsWith('/mixed-representations/metadata')||path.endsWith('/mixed-representations/representation')){
  const descriptor=publishedRows.find(d=>d.key.kind===body.kind&&d.key.id===body.representation_id&&d.key.slot===body.slot);assert.ok(descriptor);
  const common={schema_version:3,context:copy(resultContext),catalog_digest:body.catalog_digest,descriptor:copy(descriptor)};
  if(path.endsWith('/metadata')){const origin=copy(header.operation_origin);if(wrongTypedOrigin)origin.source_digest='f'.repeat(64);return {...common,operation_origin:origin};}
  const entry=uploads.get(Q.canonicalJson(descriptor.key));return {...common,total_chunks:descriptor.is_null?0:entry.core.total_chunks,total_bytes:descriptor.is_null?0:entry.raw.length,chunk_index:descriptor.is_null?null:body.chunk_index,data_base64:descriptor.is_null?null:entry.chunks[body.chunk_index].toString('base64')};
 }
 throw Error('unexpected_transport');
};
const remote=box.NowNoteProtectionState.createRemote({request:transport});
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
resultContext=copy(context);resultContext.base.history_generation++;
publishedRows=[copy(d),...outputs.map((output,i)=>({...copy(d),key:copy(output.destination_key),representation_kind:output.output_kind,representation_epoch:output.output_epoch,is_null:output.is_null,representation_etag:uid(100+i),storage_operation_id:prepared.id,semantic_origin_id:prepared.id,origin_validator:'linked_mixed_v1',expected_binding:copy(output.expected_binding),ciphertext_sha256:output.is_null?null:uploads.get(Q.canonicalJson(output.destination_key)).hash}))];
publishedRows=Q.keyOrder(publishedRows.map(d=>d.key)).map(key=>publishedRows.find(d=>Q.canonicalJson(d.key)===Q.canonicalJson(key)));
const stats=rows=>({total:rows.length,nonnull:rows.filter(d=>!d.is_null).length,nulls:rows.filter(d=>d.is_null).length});
publishedCounts={...stats(publishedRows),by_kind:verified.counts.P.by_kind.map(r=>({kind:r.kind,...stats(publishedRows.filter(d=>d.key.kind===r.kind))}))};
await assert.rejects(()=>remote.commit(scope,prepared,publicationWork),/fixture_commit_response_lost/);
const published=await remote.status(scope,prepared,publicationWork);assert.equal(published.state,'committed');assert.equal(published.receipt_matches_current,true);assert.equal(commitCalls,1);
const originalOrigin=publishedRows[0].semantic_origin_id;publishedRows[0].semantic_origin_id=uid(444);
await assert.rejects(()=>remote.status(scope,prepared,publicationWork));assert.equal(commitCalls,1);publishedRows[0].semantic_origin_id=originalOrigin;
const storedReceipt=copy(operation.receipt),storedLatest=copy(operation.latest_context);
operation.receipt.result.base.head_version++;operation.latest_context.base.head_version++;
await assert.rejects(()=>remote.status(scope,prepared,publicationWork),/analysis_receipt/);operation.receipt=storedReceipt;operation.latest_context=storedLatest;
loseCommit=false;const directCommit=await remote.commit(scope,prepared,publicationWork);assert.equal(directCommit.receipt_matches_current,true);assert.equal(commitCalls,2);
console.log('MA commit/status metadata: original lost-response receipt, G+1 only, current/P/O/cipher publication metadata and wrong-origin denial PASS (synthetic; no typed raw read/API/journal)');
const reader=box.NowNoteProtectionClient.createReader({request:transport});
const typedProof=await A.verifyInitialPublication(scope,request,settled,work,plan,prepared,directCommit.receipt,reader,'fixture-key');
assert.equal(typedProof.operation_id,settled.execution_id);
wrongTypedOrigin=true;await assert.rejects(()=>A.verifyInitialPublication(scope,request,settled,work,plan,prepared,directCommit.receipt,reader,'fixture-key'),/published_origin/);wrongTypedOrigin=false;
console.log('MA typed publication: real cipher/key/meaning and null readback, exact original source provenance, preserved P/current and forged-source denial PASS (synthetic transport only)');
const ctx={...scope,enabled:true,online:false,auth:'fixture-auth'},id=uid(80),access={schema_version:3,owner_id:scope.owner,local_id:scope.local_id,device_id:scope.device,server_instance_id:scope.instance};
const terminalCore={...access,execution_id:settled.execution_id,run_version:2,lease_version:1,dispatch_id:running.dispatch_receipt.dispatch_id,claim_metadata_digest:settled.claim_metadata_digest,provider_terminal_observed:true,outcome:'done',bundle_metadata:work.bundle_metadata,local_checkpoint_confirmed:true,unavailable_reason:null};
const archive={schema_version:1,purpose:'mixed_analysis_execution',operation_id:id,scope,request,input,route:{provider:'omniroute',endpoint:'https://synthetic.invalid/v1',model:'auto'},execution:settled,dispatch:{request:{...access,execution_id:settled.execution_id,run_version:1,lease_version:1,source_digest:settled.source_digest,claim_metadata_digest:settled.claim_metadata_digest},handoff_reserved:true},terminal:{work,settle_core:terminalCore,receipt:settled.terminal_receipt}};
const marker={schema_version:1,id,scope,phase:'analysis_settled',cipher_bundle:await Q.encryptContent(Q.canonicalJson(archive),'fixture-key')};
let disk={schema_version:1,contexts:{},protection_operations:{[id]:marker}},writeFail=true;
const journal=box.NowNoteHistory.create({initial:copy(disk),context:()=>ctx,request:async()=>{},write:async(value,guard)=>{if(writeFail)throw Error('publication_store_failed');assert.equal(guard.active(),true);disk=copy(value);}});
const publishing=A.createExecution({context:()=>ctx,journal,request:transport}),beforeStart=transportCalls.length;
await assert.rejects(()=>publishing.beginPublication(id,'fixture-key',catalog),/publication_store_failed/);assert.equal(transportCalls.length,beforeStart);assert.equal(publishing.status(id).phase,'analysis_settled');
writeFail=false;await publishing.beginPublication(id,'fixture-key',catalog);assert.equal(publishing.status(id).phase,'analysis_write_preparing');assert.equal(transportCalls.length,beforeStart);
const started=Q.parseJson(await Q.decryptContent(publishing.status(id).cipher_bundle,'fixture-key'));expectedPrepare=started.publication.plan.prepare;
// A new logical server fixture starts here; no real server state is reset.
manifest.mutation_id=expectedPrepare.mutation_id;header.mutation_id=expectedPrepare.mutation_id;verified.metadata_manifest_digest=await Q.hashJson(manifest);
Object.assign(operation,{mutation_id:expectedPrepare.mutation_id,state:'prepared',receipt:null,latest_context:copy(context),metadata_header:copy(header),metadata_manifest_digest:verified.metadata_manifest_digest});
prepareCalls=0;exists=false;losePrepare=true;commitCalls=0;loseCommit=true;uploads.clear();activePubJournal=journal;activePubId=id;
await assert.rejects(()=>publishing.resumePublication(id,'fixture-key'),/fixture_prepare_response_lost/);assert.equal(publishing.status(id).phase,'analysis_write_preparing');
await assert.rejects(()=>publishing.resumePublication(id,'fixture-key'),/fixture_commit_response_lost/);assert.equal(publishing.status(id).phase,'analysis_write_committing');assert.equal(prepareCalls,1);assert.equal(commitCalls,1);
const waiting=Q.parseJson(await Q.decryptContent(publishing.status(id).cipher_bundle,'fixture-key'));publishing.invalidate();
const coldJournal=box.NowNoteHistory.create({initial:copy(disk),context:()=>ctx,request:async()=>{},write:async(value,guard)=>{assert.equal(guard.active(),true);disk=copy(value);}}),cold=A.createExecution({context:()=>ctx,journal:coldJournal,request:transport});activePubJournal=coldJournal;
const beforeWrongKey=transportCalls.length;await assert.rejects(()=>cold.resumePublication(id,'wrong-key'));assert.equal(transportCalls.length,beforeWrongKey);
const done=await cold.resumePublication(id,'fixture-key');assert.equal(done.operation_id,settled.execution_id);assert.equal(cold.status(id).phase,'complete');assert.equal(prepareCalls,1);assert.equal(commitCalls,1);
const finished=Q.parseJson(await Q.decryptContent(cold.status(id).cipher_bundle,'fixture-key'));
assert.ok(Q.canonicalJson(finished.publication.work)===Q.canonicalJson(waiting.publication.work),'cold publication must preserve original work/cipher/core');assert.ok(Q.canonicalJson(finished.terminal)===Q.canonicalJson(archive.terminal),'original terminal archive changed');
assert.ok(!JSON.stringify(disk).includes('ORIGINAL')&&!JSON.stringify(disk).includes('fixture-key'),'publication leaked plaintext/key');
const beforeComplete=transportCalls.length;await cold.resumePublication(id,'fixture-key');assert.equal(transportCalls.length,beforeComplete);
console.log('MA publication journal: cipher plan/core before request, failed write/no call, original prepare/commit loss and cold status recovery, typed proof before complete, no duplicate POST/plaintext PASS (synthetic transport only)');
const pendingMarker={...marker,phase:'analysis_write_committing',cipher_bundle:await Q.encryptContent(Q.canonicalJson(waiting),'fixture-key')};
const makePendingJournal=()=>box.NowNoteHistory.create({initial:{schema_version:1,contexts:{},protection_operations:{[id]:copy(pendingMarker)}},context:()=>ctx,request:async()=>{},write:async(value,guard)=>{assert.equal(guard.active(),true);}});
const wrongOriginJournal=makePendingJournal(),wrongOriginController=A.createExecution({context:()=>ctx,journal:wrongOriginJournal,request:transport});
wrongTypedOrigin=true;await assert.rejects(()=>wrongOriginController.resumePublication(id,'fixture-key'),/published_origin/);wrongTypedOrigin=false;
assert.equal(wrongOriginController.status(id).phase,'analysis_write_committed');assert.equal(commitCalls,1);
await wrongOriginController.resumePublication(id,'fixture-key');assert.equal(wrongOriginController.status(id).phase,'complete');assert.equal(commitCalls,1);
let entered,release;const inside=new Promise(r=>{entered=r;}),gate=new Promise(r=>{release=r;});
const heldJournal=makePendingJournal(),held=A.createExecution({context:()=>ctx,journal:heldJournal,request:async(...args)=>{entered();await gate;return transport(...args);}}),heldBefore=held.status(id).cipher_bundle;
const inflight=held.resumePublication(id,'fixture-key'),heldRejected=assert.rejects(()=>inflight,/scope_changed/);await inside;held.invalidate();release();await heldRejected;assert.equal(held.status(id).cipher_bundle,heldBefore);
const beforeOtherAccount=transportCalls.length;ctx.owner='bob';await assert.rejects(()=>held.resumePublication(id,'fixture-key'),/scope_changed/);ctx.owner=scope.owner;assert.equal(transportCalls.length,beforeOtherAccount);
console.log('MA publication boundaries: forged typed source stays pending, recovery no extra commit, late invalidate/cipher unchanged, other account/no request PASS (synthetic only)');
const freshCatalog=await reader.catalog(scope),previous={operation_id:null,state:'none'},confirmation={confirmed_reuse_original_result:true,target_epoch:freshCatalog.context.base.crypto_epoch};
const replanned=await A.createReplanWritePlan(scope,request,settled,work,freshCatalog,previous,uid(201),'fixture-key',confirmation);
assert.equal(replanned.request_type,'replan');assert.equal(replanned.prepare.base.base.history_generation,2);assert.equal(replanned.original.execution.source_context.base.base.history_generation,1);
assert.equal(Q.canonicalJson(replanned.prepare.execution_ref),Q.canonicalJson(plan.prepare.execution_ref));assert.equal(Q.canonicalJson(replanned.original.work),Q.canonicalJson(work));
assert.equal(replanned.prepare.previous_write_id,null);assert.equal(replanned.prepare.previous_write_state,'none');assert.equal(replanned.prepare.confirmed_reuse_original_result,true);
await assert.rejects(()=>A.createReplanWritePlan(scope,request,settled,work,freshCatalog,previous,uid(201),'wrong-key',confirmation));
await assert.rejects(()=>A.createReplanWritePlan(scope,request,settled,work,freshCatalog,previous,uid(201),'fixture-key',{...confirmation,confirmed_reuse_original_result:1}),/reuse_confirmation/);
await assert.rejects(()=>A.createReplanWritePlan(scope,request,settled,work,freshCatalog,{operation_id:uid(40),state:'prepared'},uid(201),'fixture-key',confirmation),/previous_write_state/);
const peerPlan=await A.createReplanWritePlan({...scope,device:'second'},request,settled,work,freshCatalog,previous,uid(202),'fixture-key',confirmation);
assert.equal(peerPlan.prepare.device_id,'second');assert.equal(peerPlan.original.scope.device,'first');assert.equal(peerPlan.original.request.device_id,'first');
const newerCatalog=copy(freshCatalog);newerCatalog.context.base.crypto_epoch=2;newerCatalog.catalog_digest=await Q.hashJson({server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,context:newerCatalog.context,entries:newerCatalog.entries});
const rekeyPlan=await A.createReplanWritePlan(scope,request,settled,work,newerCatalog,previous,uid(203),'fixture-key',{...confirmation,target_epoch:2});
assert.equal(rekeyPlan.prepare.target_epoch,2);assert.equal(rekeyPlan.original.work.bundle_metadata.original_epoch,1);
console.log('MA E3 replan plan: explicit original-result reuse, fresh base/target epoch, original SC/TR/BM/C immutable, source actor retained/new actor separate, wrong key/state/confirmation denial PASS (pure synthetic only)');
const replanId=uid(204),newJob='33',replanManifest=copy(manifest);
Object.assign(replanManifest,{operation_id:replanId,mutation_id:rekeyPlan.prepare.mutation_id,base:newerCatalog.context,source_catalog_digest:newerCatalog.catalog_digest,target_epoch:2,
 control:{request_type:'replan',...pick(rekeyPlan.prepare,['execution_ref','previous_write_id','previous_write_state','target_epoch','confirmed_reuse_original_result'])},
 operation_origin:{purpose:'mixed_analysis_write',operation_id:replanId,request_type:'replan',execution_ref:rekeyPlan.prepare.execution_ref,original_source_context:settled.source_context,previous_write_id:null},
 S:newerCatalog.entries.map((descriptor,i)=>({descriptor,source_etag:uid(210+i)})),P:newerCatalog.entries});
replanManifest.DSET=outputs.map((o,i)=>{const key={...o.destination_key,id:newJob};return {...o,destination_key:key,source_etag:uid(220+i),output_epoch:2,
 expected_binding:o.is_null?null:{...o.expected_binding,transition_id:replanId,crypto_epoch:2,destination_key:key}};});
const replanOrigins=[...newerCatalog.entries.map(expectation),...replanManifest.DSET.map(o=>({destination_key:o.destination_key,is_null:o.is_null,origin_validator:'linked_mixed_v1',origin_row_required:false,storage_operation_id:replanId,semantic_origin_id:replanId}))];
replanManifest.O=Q.keyOrder(replanOrigins.map(o=>o.destination_key)).map(key=>replanOrigins.find(o=>Q.canonicalJson(o.destination_key)===Q.canonicalJson(key)));
const replanVerified=await A.validateReplanWriteManifest(scope,rekeyPlan,newerCatalog,replanManifest);
assert.equal(replanVerified.metadata_manifest_digest,await Q.hashJson(replanManifest));assert.equal(replanVerified.counts.DSET.total,3);
for(const change of [m=>{m.operation_id=settled.execution_id;},m=>{m.DSET[1].destination_key.id='34';},m=>{m.DSET[1].source_etag=m.DSET[0].source_etag;},m=>{m.DSET[1].expected_binding.crypto_epoch=1;},m=>{m.P=[];},m=>{m.operation_origin.original_source_context.base.base.history_generation=2;},m=>{m.control.confirmed_reuse_original_result=false;},m=>{m.DSET[0].is_null=false;},m=>{m.existing=[{}];}]){
 const bad=copy(replanManifest);change(bad);await assert.rejects(()=>A.validateReplanWriteManifest(scope,rekeyPlan,newerCatalog,bad));
}
console.log('MA E3 replan manifest: new job/operation/target bindings, exact original provenance/nulls, preserved catalog and all six sets/digests; forged identity/source/token/binding denial PASS (pure synthetic only)');
const replanHeader=Object.fromEntries(Object.entries(replanManifest).filter(([k])=>!names.includes(k)));
const replanOperation={...copy(operation),operation_id:replanId,mutation_id:rekeyPlan.prepare.mutation_id,state:'prepared',metadata_manifest_digest:replanVerified.metadata_manifest_digest,metadata_header:replanHeader,counts:replanVerified.counts,receipt:null,latest_context:newerCatalog.context};
const replanOriginal={...copy(originalExecution),reference:rekeyPlan.prepare.execution_ref};
let replanCalls=0,replanLose=true,replanGet=0,replanManifestCalls=0,replanForged=false,replanStored=null;
const replanRemote=box.NowNoteProtectionState.createRemote({request:async(s,path,method,body)=>{
 assert.equal(Q.canonicalJson(s),Q.canonicalJson(scope));
 if(path.endsWith('/replan')){replanCalls++;assert.equal(Q.canonicalJson(body),Q.canonicalJson(rekeyPlan.prepare));if(replanLose){replanLose=false;throw Error('replan_response_lost');}if(replanStored)return copy(replanStored);const out={schema_version:3,status:'prepared',operation:copy(replanOperation),original_execution:copy(replanOriginal)};if(replanForged)out.original_execution.source_context.base.base.history_generation++;return out;}
 if(path.endsWith('/status')){replanGet++;assert.equal(body.operation_id,replanId);return {schema_version:3,status:'operation',operation:copy(replanOperation),original_execution:copy(replanOriginal)};}
 if(path.endsWith('/manifest')){replanManifestCalls++;if(['stale','aborted','committed','expired'].includes(replanOperation.state))throw Error('terminal_replan_manifest_denied');return {schema_version:3,section:body.section,metadata_manifest_digest:replanVerified.metadata_manifest_digest,metadata_header:copy(replanHeader),set_digests:copy(replanVerified.set_digests),counts:copy(replanVerified.counts),entries:copy(replanManifest[body.section]),next_cursor:null};}
 if(path.endsWith('/chunks')||path.endsWith('/entries/seal')||path.endsWith('/staged'))return transport(s,path,method,body);
 throw Error('unexpected_replan_request');
}});
await assert.rejects(()=>replanRemote.replanAnalysis(scope,rekeyPlan,newerCatalog),/replan_response_lost/);
const replanPrepared=await replanRemote.replanAnalysis(scope,rekeyPlan,newerCatalog);
assert.equal(replanPrepared.id,replanId);assert.equal(replanPrepared.digest,replanVerified.metadata_manifest_digest);assert.equal(replanCalls,2);assert.equal(replanGet,0);
await replanRemote.replanAnalysis(scope,rekeyPlan,newerCatalog,replanPrepared);assert.equal(replanCalls,2);assert.equal(replanGet,1);
for(const state of ['stale','aborted','expired','committed']){
 replanOperation.state=state;const count=replanManifestCalls;
 const probed=await replanRemote.replanAnalysis(scope,rekeyPlan,newerCatalog,replanPrepared);
 assert.equal(probed.response.state,state);assert.equal(Q.canonicalJson(probed.manifest),Q.canonicalJson(replanPrepared.manifest));assert.equal(replanManifestCalls,count);
}
replanOperation.state='prepared';
replanForged=true;const manifestBefore=replanManifestCalls;await assert.rejects(()=>replanRemote.replanAnalysis(scope,rekeyPlan,newerCatalog),/analysis_original_execution/);assert.equal(replanManifestCalls,manifestBefore);replanForged=false;
const badPlan=copy(rekeyPlan);badPlan.prepare.target_epoch=1;const beforeInvalid=replanCalls;await assert.rejects(()=>replanRemote.replanAnalysis(scope,badPlan,newerCatalog));assert.equal(replanCalls,beforeInvalid);
console.log('MA E3 replan transport: immutable request replay after loss, known operation GET only, six-set verification and forged original/pre-request denial PASS (synthetic HTTP only; no durable replan/UI)');
replanStored={schema_version:3,status:'already_stored',stored_result:{schema_version:3,operation_id:settled.execution_id,status_path:'/api/v2/notes/mixed-analysis-writes/status',receipt:copy(operation.receipt)},original_execution:copy(replanOriginal),latest_context:newerCatalog.context};
const beforeStored=replanManifestCalls,storedMetadata=await replanRemote.replanAnalysis(scope,rekeyPlan,newerCatalog);
assert.equal(storedMetadata.status,'already_stored');assert.equal(Q.canonicalJson(storedMetadata),Q.canonicalJson(replanStored));assert.equal(replanManifestCalls,beforeStored);
for(const change of [r=>{r.stored_result.receipt.owner_id='bob';},r=>{r.stored_result.status_path='https://untrusted.invalid';},r=>{r.original_execution.reference.original_bundle_digest='0'.repeat(64);},r=>{r.stored_result.receipt.set_digests.extra='a'.repeat(64);},r=>{r.stored_result.operation_id=uid(700);}]){
 const good=copy(replanStored);change(replanStored);await assert.rejects(()=>replanRemote.replanAnalysis(scope,rekeyPlan,newerCatalog));replanStored=good;
}
assert.equal(replanManifestCalls,beforeStored);
console.log('MA E3 AlreadyStored metadata: original execution/receipt scope and fixed path, no manifest/upload/commit after stored response, forgery denial PASS (synthetic only; typed proof/durable completion not yet wired)');
const provisional=copy(settled);provisional.job_id_mode='provisional';
provisional.claim_metadata_digest=await Q.hashJson({schema_version:3,...pick(request,[...fields,'execution_route','client_execution_confirmed']),job_id:12,job_id_mode:'provisional',output_slots});
const unpostedCatalog={context:copy(newerCatalog.context),entries:copy(catalog.entries)};unpostedCatalog.catalog_digest=await Q.hashJson({server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,...unpostedCatalog});
const provisionalPlan=await A.createReplanWritePlan(scope,request,provisional,work,unpostedCatalog,previous,uid(203),'fixture-key',{...confirmation,target_epoch:2});
const sameInteger=copy(replanManifest);sameInteger.source_catalog_digest=unpostedCatalog.catalog_digest;sameInteger.P=copy(unpostedCatalog.entries);sameInteger.S=unpostedCatalog.entries.map((descriptor,i)=>({descriptor,source_etag:uid(210+i)}));
for(const o of sameInteger.DSET){o.destination_key.id='12';if(o.expected_binding)o.expected_binding.destination_key.id='12';}
const sameOrigins=[...sameInteger.P.map(expectation),...sameInteger.DSET.map(o=>({destination_key:o.destination_key,is_null:o.is_null,origin_validator:'linked_mixed_v1',origin_row_required:false,storage_operation_id:replanId,semantic_origin_id:replanId}))];
sameInteger.O=Q.keyOrder(sameOrigins.map(o=>o.destination_key)).map(key=>sameOrigins.find(o=>Q.canonicalJson(key)===Q.canonicalJson(o.destination_key)));
await A.validateReplanWriteManifest(scope,provisionalPlan,unpostedCatalog,sameInteger);
const collision=copy(replanManifest);for(const o of collision.DSET){o.destination_key.id='12';if(o.expected_binding)o.expected_binding.destination_key.id='12';}
await assert.rejects(()=>A.validateReplanWriteManifest(scope,rekeyPlan,newerCatalog,collision),/replan_job/);
console.log('MA replan SQLite provisional ID: same unused job integer with fresh operation/tokens accepted, actual current catalog collision denied PASS (synthetic only)');
const replanWork=await A.buildReplanWriteWork(scope,rekeyPlan,replanPrepared,newerCatalog,'fixture-key','new-epoch-key');
assert.equal(replanWork.transfers.length,2);assert.equal(replanWork.commit.target_epoch,2);assert.equal(replanWork.commit.operation_id,replanId);
assert.equal(Q.canonicalJson(replanWork).includes('new-epoch-key'),false);assert.equal(Q.canonicalJson(work),original);
for(const t of replanWork.transfers){assert.ok(!work.transfers.some(old=>old.raw===t.raw));assert.equal(t.key.id,'33');assert.equal(t.descriptor.representation_epoch,2);assert.equal(t.origin.value.original_source_context.base.base.history_generation,1);assert.equal(await Q.decryptRepresentation(t.raw,t.descriptor,t.origin,async()=>'new-epoch-key',3),t.key.slot==='input_text'?input:result);}
const cached=Q.canonicalJson(replanWork);await A.verifyReplanWriteWork(scope,rekeyPlan,replanPrepared,newerCatalog,replanWork,'fixture-key','new-epoch-key');assert.equal(Q.canonicalJson(replanWork),cached);
await assert.rejects(()=>A.verifyReplanWriteWork(scope,rekeyPlan,replanPrepared,newerCatalog,replanWork,'wrong-key','new-epoch-key'));
await assert.rejects(()=>A.verifyReplanWriteWork(scope,rekeyPlan,replanPrepared,newerCatalog,replanWork,'fixture-key','wrong-key'));
for(const change of [w=>{w.transfers[0].raw+='x';},w=>{w.transfers[0].semantic='forged';},w=>{w.commit.client_verified_ciphertext_manifest_digest='f'.repeat(64);},w=>{w.transfers[0].origin.value.original_source_context.base.base.history_generation++;}]){
 const bad=copy(replanWork);change(bad);await assert.rejects(()=>A.verifyReplanWriteWork(scope,rekeyPlan,replanPrepared,newerCatalog,bad,'fixture-key','new-epoch-key'));
}
console.log('MA E3 replan ciphertext: original key/values preserved, distinct target key/new binding, exact CRLF/JSON/null, cached cipher verification without regeneration and forgery/key denial PASS (pure synthetic only; no journal/stage/UI)');
const transfersBefore=uploads.size;
await assert.rejects(()=>replanRemote.stage(scope,replanPrepared,replanWork,'wrong-key',[],undefined,'fixture-key'));assert.equal(uploads.size,transfersBefore);
await replanRemote.stage(scope,replanPrepared,replanWork,'new-epoch-key',[],undefined,'fixture-key');
assert.equal(uploads.size,transfersBefore+2);
for(const t of replanWork.transfers)assert.equal(uploads.get(Q.canonicalJson(t.key)).raw.toString('utf8'),t.raw);
assert.equal(Q.canonicalJson(replanWork),cached);assert.equal(Q.canonicalJson(work),original);
console.log('MA E3 replan stage: original-key verification before upload, new-key exact cipher chunks/seal/readback, null excluded, cached bytes immutable PASS (synthetic transport only; no durable replan/UI)');
resultContext=copy(newerCatalog.context);resultContext.base.history_generation++;
publishedRows=[...copy(newerCatalog.entries),...replanManifest.DSET.map((o,i)=>({...copy(d),key:copy(o.destination_key),representation_kind:o.output_kind,representation_epoch:o.output_epoch,is_null:o.is_null,representation_etag:uid(300+i),storage_operation_id:replanId,semantic_origin_id:replanId,origin_validator:'linked_mixed_v1',expected_binding:copy(o.expected_binding),ciphertext_sha256:o.is_null?null:uploads.get(Q.canonicalJson(o.destination_key)).hash}))];
publishedRows=Q.keyOrder(publishedRows.map(d=>d.key)).map(key=>publishedRows.find(d=>Q.canonicalJson(d.key)===Q.canonicalJson(key)));
publishedCounts={...stats(publishedRows),by_kind:verified.counts.P.by_kind.map(r=>({kind:r.kind,...stats(publishedRows.filter(d=>d.key.kind===r.kind))}))};
const replanReceipt={...copy(storedReceipt),operation_id:replanId,mutation_id:rekeyPlan.prepare.mutation_id,result:copy(resultContext),metadata_manifest_digest:replanPrepared.digest,set_digests:copy(replanVerified.set_digests),ciphertext_manifest_digest:replanWork.commit.client_verified_ciphertext_manifest_digest,origin_expectations_digest:await Q.hashJson(replanManifest.O)};
let replanBadOrigin=false;const replanReader=box.NowNoteProtectionClient.createReader({request:async(...args)=>{const r=await transport(...args);if(args[1].endsWith('/metadata')){r.operation_origin=copy(replanHeader.operation_origin);if(replanBadOrigin)r.operation_origin.original_source_context.base.base.history_generation++;}return r;}});
const replanProof=await A.verifyReplanPublication(scope,rekeyPlan,replanPrepared,newerCatalog,replanWork,replanReceipt,replanReader,'fixture-key','new-epoch-key');
assert.equal(replanProof.operation_id,replanId);assert.equal(replanProof.output_keys.length,3);
replanBadOrigin=true;await assert.rejects(()=>A.verifyReplanPublication(scope,rekeyPlan,replanPrepared,newerCatalog,replanWork,replanReceipt,replanReader,'fixture-key','new-epoch-key'),/published_origin/);replanBadOrigin=false;
const badReplanReceipt=copy(replanReceipt);badReplanReceipt.result.base.head_version++;await assert.rejects(()=>A.verifyReplanPublication(scope,rekeyPlan,replanPrepared,newerCatalog,replanWork,badReplanReceipt,replanReader,'fixture-key','new-epoch-key'),/published_receipt/);
console.log('MA E3 replan typed proof: G+1 only, full preserved catalog, new cipher SHA/null/original source and real decrypt exact values, forged origin/receipt denied PASS (synthetic transport only; no durable replan/UI)');
const storedResponse={...copy(replanStored),latest_context:copy(resultContext)};
let storedWrongSource=false;
const storedReader=box.NowNoteProtectionClient.createReader({request:async(...args)=>{const r=await transport(...args);if(args[1].endsWith('/metadata')){r.operation_origin=copy(args[3].representation_id==='12'?header.operation_origin:replanHeader.operation_origin);if(storedWrongSource&&args[3].representation_id==='12')r.operation_origin.source_digest='f'.repeat(64);}return r;}});
const storedStatus=async(s,path,method,body)=>{assert.equal(path,'/api/v2/notes/mixed-analysis-writes/status');assert.equal(method,'GET');assert.equal(body.operation_id,settled.execution_id);return {schema_version:3,status:'operation',operation:{...copy(operation),latest_context:copy(resultContext)},original_execution:copy(originalExecution)};};
const storedProof=await A.verifyStoredAnalysisPublication(scope,rekeyPlan,newerCatalog,storedResponse,storedReader,'fixture-key',descriptor=>descriptor.representation_epoch===1?'fixture-key':'new-epoch-key',storedStatus);
assert.equal(storedProof.operation_id,settled.execution_id);assert.equal(storedProof.output_keys.length,3);
const oldStoredView=copy(storedResponse);oldStoredView.latest_context=copy(context);
await A.verifyStoredAnalysisPublication(scope,rekeyPlan,newerCatalog,oldStoredView,storedReader,'fixture-key',()=>'fixture-key',storedStatus);
for(const change of [r=>{r.stored_result.receipt.metadata_manifest_digest='d'.repeat(64);},r=>{r.stored_result.receipt.set_digests.S='d'.repeat(64);},r=>{r.stored_result.receipt.ciphertext_manifest_digest='d'.repeat(64);}]){
 const bad=copy(storedResponse);change(bad);await assert.rejects(()=>A.verifyStoredAnalysisPublication(scope,rekeyPlan,newerCatalog,bad,storedReader,'fixture-key',()=>'fixture-key',storedStatus),/stored_receipt_unconfirmed/);
}
await assert.rejects(()=>A.verifyStoredAnalysisPublication(scope,rekeyPlan,newerCatalog,storedResponse,storedReader,'fixture-key',()=>'fixture-key',async()=>{throw Object.assign(Error('actor_denied'),{status:403});}),/actor_denied/);
storedWrongSource=true;await assert.rejects(()=>A.verifyStoredAnalysisPublication(scope,rekeyPlan,newerCatalog,storedResponse,storedReader,'fixture-key',()=>'fixture-key',storedStatus),/stored_origin/);storedWrongSource=false;
const savedPublished=copy(publishedRows);publishedRows=publishedRows.filter(d=>d.key.id!=='12'||d.key.kind!=='analysis_error');publishedCounts={...stats(publishedRows),by_kind:verified.counts.P.by_kind.map(r=>({kind:r.kind,...stats(publishedRows.filter(d=>d.key.kind===r.kind))}))};
await assert.rejects(()=>A.verifyStoredAnalysisPublication(scope,rekeyPlan,newerCatalog,storedResponse,storedReader,'fixture-key',()=>'fixture-key',storedStatus),/stored_outputs/);publishedRows=savedPublished;
console.log('MA E3 AlreadyStored typed proof: existing initial result under newer current catalog, original execution/source/nulls and decrypted exact meaning, missing/forged source denied PASS (synthetic only; no durable replan/UI)');
let replanDisk={schema_version:1,contexts:{},protection_operations:{[id]:copy(marker)}},failReplanWrite=true,replanRequests=0,allocationRequest=async()=>{replanRequests++;throw Error('unexpected_replan_rpc');};
const durableReplanJournal=box.NowNoteHistory.create({initial:copy(replanDisk),context:()=>ctx,request:async()=>{},write:async(v,g)=>{assert.equal(g.active(),true);if(failReplanWrite)throw Error('replan_plan_store_failed');replanDisk=copy(v);}});
const durableReplan=A.createExecution({context:()=>ctx,journal:durableReplanJournal,request:(...args)=>allocationRequest(...args)});
await assert.rejects(()=>durableReplan.beginReplan(id,'fixture-key',newerCatalog,{...confirmation,target_epoch:2}),/replan_plan_store_failed/);
assert.equal(durableReplan.status(id).phase,'analysis_settled');assert.equal(replanRequests,0);
failReplanWrite=false;await durableReplan.beginReplan(id,'fixture-key',newerCatalog,{...confirmation,target_epoch:2});
assert.equal(durableReplan.status(id).phase,'analysis_replan_preparing');assert.equal(replanRequests,0);
const replanCheckpoint=Q.parseJson(await Q.decryptContent(durableReplan.status(id).cipher_bundle,'fixture-key'));
assert.equal(Q.canonicalJson(replanCheckpoint.terminal),Q.canonicalJson(archive.terminal));assert.equal(replanCheckpoint.replan.plan.prepare.base.base.crypto_epoch,2);
assert.ok(!JSON.stringify(replanDisk).includes('ORIGINAL')&&!JSON.stringify(replanDisk).includes('fixture-key'));
const coldReplanJournal=box.NowNoteHistory.create({initial:copy(replanDisk),context:()=>ctx,request:async()=>{},write:async(v,g)=>{assert.equal(g.active(),true);replanDisk=copy(v);}});
const coldReplan=A.createExecution({context:()=>ctx,journal:coldReplanJournal,request:(...args)=>allocationRequest(...args)});
await assert.rejects(()=>coldReplan.inspectReplan(id,'wrong-key'));assert.equal(replanRequests,0);
assert.equal(Q.canonicalJson(await coldReplan.inspectReplan(id,'fixture-key')),Q.canonicalJson(replanCheckpoint.replan));
console.log('MA E3 replan durable plan: cipher before RPC, failed write preserves original settled archive, new epoch confirmation and immutable plan survive cold key verification PASS (synthetic journal only; resume/UI pending)');
const allocationPlan=replanCheckpoint.replan.plan,allocationManifest=copy(replanManifest);allocationManifest.mutation_id=allocationPlan.prepare.mutation_id;
const allocationVerified=await A.validateReplanWriteManifest(scope,allocationPlan,newerCatalog,allocationManifest);
const allocationHeader=Object.fromEntries(Object.entries(allocationManifest).filter(([key])=>!names.includes(key)));
const allocationOperation={...copy(replanOperation),mutation_id:allocationPlan.prepare.mutation_id,metadata_manifest_digest:allocationVerified.metadata_manifest_digest,metadata_header:allocationHeader,counts:allocationVerified.counts};
let allocationPost=0,allocationGet=0,loseAllocation=true;
allocationRequest=async(s,path,method,body)=>{
 replanRequests++;
 if(path.endsWith('/replan')){allocationPost++;assert.equal(Q.canonicalJson(body),Q.canonicalJson(allocationPlan.prepare));const saved=Q.parseJson(await Q.decryptContent(coldReplan.status(id).cipher_bundle,'fixture-key'));assert.equal(Q.canonicalJson(saved.replan.plan.prepare),Q.canonicalJson(body));if(loseAllocation){loseAllocation=false;throw Error('allocation_response_lost');}return {schema_version:3,status:'prepared',operation:copy(allocationOperation),original_execution:copy(replanOriginal)};}
 if(path.endsWith('/status')){allocationGet++;return {schema_version:3,status:'operation',operation:copy(allocationOperation),original_execution:copy(replanOriginal)};}
 if(path.endsWith('/manifest'))return {schema_version:3,section:body.section,metadata_manifest_digest:allocationVerified.metadata_manifest_digest,metadata_header:copy(allocationHeader),set_digests:copy(allocationVerified.set_digests),counts:copy(allocationVerified.counts),entries:copy(allocationManifest[body.section]),next_cursor:null};
 if(path.endsWith('/chunks')||path.endsWith('/entries/seal')||path.endsWith('/staged'))return transport(s,path,method,body);
 if(path.endsWith('/commit')){
  replanCommitCalls++;const saved=Q.parseJson(await Q.decryptContent(activeReplanController.status(id).cipher_bundle,'fixture-key'));assert.equal(activeReplanController.status(id).phase,'analysis_replan_committing');assert.equal(Q.canonicalJson(body),Q.canonicalJson(saved.replan.work.commit));
  resultContext=copy(newerCatalog.context);resultContext.base.history_generation++;
  publishedRows=[...copy(newerCatalog.entries),...allocationManifest.DSET.map((o,i)=>({...copy(d),key:copy(o.destination_key),representation_kind:o.output_kind,representation_epoch:o.output_epoch,is_null:o.is_null,representation_etag:uid(400+i),storage_operation_id:replanId,semantic_origin_id:replanId,origin_validator:'linked_mixed_v1',expected_binding:copy(o.expected_binding),ciphertext_sha256:o.is_null?null:uploads.get(Q.canonicalJson(o.destination_key)).hash}))];
  publishedRows=Q.keyOrder(publishedRows.map(d=>d.key)).map(key=>publishedRows.find(d=>Q.canonicalJson(d.key)===Q.canonicalJson(key)));publishedCounts={...stats(publishedRows),by_kind:verified.counts.P.by_kind.map(r=>({kind:r.kind,...stats(publishedRows.filter(d=>d.key.kind===r.kind))}))};
  allocationOperation.state='committed';allocationOperation.latest_context=copy(resultContext);allocationOperation.receipt={...copy(replanReceipt),mutation_id:body.mutation_id,metadata_manifest_digest:allocationVerified.metadata_manifest_digest,set_digests:copy(allocationVerified.set_digests),ciphertext_manifest_digest:body.client_verified_ciphertext_manifest_digest,result:copy(resultContext)};
  if(loseReplanCommit){loseReplanCommit=false;throw Error('replan_commit_response_lost');}return copy(allocationOperation);
 }
 if(path.includes('/mixed-representations/')){const r=await transport(s,path,method,body);if(path.endsWith('/metadata'))r.operation_origin=copy(body.representation_id==='33'?allocationHeader.operation_origin:header.operation_origin);return r;}
 throw Error('unexpected_allocation_rpc');
};
await assert.rejects(()=>coldReplan.resumeReplanPreparation(id,'fixture-key'),/allocation_response_lost/);assert.equal(coldReplan.status(id).phase,'analysis_replan_preparing');
await coldReplan.resumeReplanPreparation(id,'fixture-key');assert.equal(coldReplan.status(id).phase,'analysis_replan_allocated');assert.equal(allocationPost,2);
const allocated=await coldReplan.inspectReplan(id,'fixture-key');assert.equal(allocated.prepared.id,replanId);assert.equal(allocated.work,null);assert.equal(Q.canonicalJson(allocated.plan),Q.canonicalJson(allocationPlan));
await coldReplan.resumeReplanPreparation(id,'fixture-key');assert.equal(allocationPost,2);assert.equal(allocationGet,1);
console.log('MA E3 replan durable allocation: saved immutable request before POST, lost response replay, checked six-set allocation checkpoint before encryption, known ID GET only PASS (synthetic journal/transport; result checkpoint/UI pending)');
const storedPendingMarker={...copy(marker),phase:'analysis_replan_preparing',cipher_bundle:await Q.encryptContent(Q.canonicalJson(replanCheckpoint),'fixture-key')};
let storedRequests=0;
const storedPendingJournal=box.NowNoteHistory.create({initial:{schema_version:1,contexts:{},protection_operations:{[id]:storedPendingMarker}},context:()=>ctx,request:async()=>{},write:async(v,g)=>{assert.equal(g.active(),true);}});
const storedPending=A.createExecution({context:()=>ctx,journal:storedPendingJournal,request:async(s,path,method,body)=>{storedRequests++;if(path.endsWith('/replan')){assert.equal(Q.canonicalJson(body),Q.canonicalJson(allocationPlan.prepare));return copy(storedResponse);}if(path.endsWith('/status'))return storedStatus(s,path,method,body);return transport(s,path,method,body);}});
await assert.rejects(()=>storedPending.resumeReplanPreparation(id,'wrong-key'));assert.equal(storedRequests,0);
await storedPending.resumeReplanPreparation(id,'fixture-key');assert.equal(storedPending.status(id).phase,'analysis_replan_stored');assert.equal(storedRequests,1);
const storedCheckpoint=await storedPending.inspectReplan(id,'fixture-key');assert.equal(storedCheckpoint.prepared,null);assert.equal(storedCheckpoint.work,null);assert.equal(storedCheckpoint.proof,null);
await storedPending.resumeReplanPreparation(id,'fixture-key');assert.equal(storedRequests,1);
console.log('MA E3 AlreadyStored durable metadata: original response preserved without output allocation/cipher/commit, wrong key before RPC, still pending until receipt/typed proof PASS (synthetic journal only)');
await coldReplan.prepareReplanCipher(id,'fixture-key','new-epoch-key');
assert.equal(coldReplan.status(id).phase,'analysis_replan_prepared');
const cipherCheckpoint=await coldReplan.inspectReplan(id,'fixture-key'),checkpointBytes=Q.canonicalJson(cipherCheckpoint.work),requestsAtCipher=replanRequests;
await A.verifyReplanWriteWork(scope,cipherCheckpoint.plan,cipherCheckpoint.prepared,cipherCheckpoint.catalog,cipherCheckpoint.work,'fixture-key','new-epoch-key');
await coldReplan.prepareReplanCipher(id,'fixture-key','new-epoch-key');assert.equal(Q.canonicalJson((await coldReplan.inspectReplan(id,'fixture-key')).work),checkpointBytes);assert.equal(replanRequests,requestsAtCipher);
await assert.rejects(()=>coldReplan.prepareReplanCipher(id,'fixture-key','wrong-key'));assert.equal(replanRequests,requestsAtCipher);
assert.equal((await coldReplan.readTerminal(id,'fixture-key')).result_json,result);
const afterCipherJournal=box.NowNoteHistory.create({initial:copy(replanDisk),context:()=>ctx,request:async()=>{},write:async()=>{}}),afterCipher=A.createExecution({context:()=>ctx,journal:afterCipherJournal,request:async()=>{throw Error('no_rpc_for_cached_cipher');}});
await afterCipher.prepareReplanCipher(id,'fixture-key','new-epoch-key');assert.equal(Q.canonicalJson((await afterCipher.inspectReplan(id,'fixture-key')).work),checkpointBytes);
assert.ok(!JSON.stringify(replanDisk).includes('ORIGINAL')&&!JSON.stringify(replanDisk).includes('new-epoch-key'));
console.log('MA E3 replan durable cipher: checked allocation before encrypt, original and target keys distinct, saved/readback before upload, cold cached bytes/core no regeneration, original terminal still readable PASS (synthetic only; publication/UI pending)');
let replanCommitCalls=0,loseReplanCommit=true,activeReplanController=coldReplan;
await assert.rejects(()=>coldReplan.resumeReplanPublication(id,'fixture-key','new-epoch-key'),/replan_commit_response_lost/);
assert.equal(coldReplan.status(id).phase,'analysis_replan_committing');assert.equal(replanCommitCalls,1);
const committingReplan=await coldReplan.inspectReplan(id,'fixture-key');assert.equal(Q.canonicalJson(committingReplan.work),checkpointBytes);
const publicationReplanJournal=box.NowNoteHistory.create({initial:copy(replanDisk),context:()=>ctx,request:async()=>{},write:async(v,g)=>{assert.equal(g.active(),true);replanDisk=copy(v);}});
const publicationReplan=A.createExecution({context:()=>ctx,journal:publicationReplanJournal,request:(...args)=>allocationRequest(...args)});activeReplanController=publicationReplan;
const beforeBadTarget=replanRequests;await assert.rejects(()=>publicationReplan.resumeReplanPublication(id,'fixture-key','wrong-key'));assert.equal(replanRequests,beforeBadTarget);
await publicationReplan.resumeReplanPublication(id,'fixture-key','new-epoch-key');assert.equal(publicationReplan.status(id).phase,'complete');assert.equal(replanCommitCalls,1);
const finalReplan=await publicationReplan.inspectReplan(id,'fixture-key');assert.equal(Q.canonicalJson(finalReplan.work),checkpointBytes);assert.equal(finalReplan.proof.output_keys.length,3);
assert.equal((await publicationReplan.readTerminal(id,'fixture-key')).result_json,result);
assert.ok(!JSON.stringify(replanDisk).includes('ORIGINAL')&&!JSON.stringify(replanDisk).includes('new-epoch-key'));
console.log('MA E3 replan durable publication: cipher/core before upload/commit, lost commit cold original receipt recovery, no extra POST/Provider, typed source/value proof before complete and original archive preserved PASS (synthetic only; UI/actual server pending)');
await storedPending.completeStoredReplan(id,'fixture-key',()=>'fixture-key');assert.equal(storedPending.status(id).phase,'complete');
const completeStoredCheckpoint=await storedPending.inspectReplan(id,'fixture-key');
assert.equal(completeStoredCheckpoint.work,null);assert.equal(completeStoredCheckpoint.prepared,null);assert.equal(completeStoredCheckpoint.proof.operation_id,settled.execution_id);
assert.equal(Q.canonicalJson(completeStoredCheckpoint.stored),Q.canonicalJson(storedResponse));assert.equal(Q.canonicalJson(completeStoredCheckpoint.receipt),Q.canonicalJson(storedResponse.stored_result.receipt));
const storedRequestsAtComplete=storedRequests;await storedPending.completeStoredReplan(id,'fixture-key',()=>'fixture-key');assert.equal(storedRequests,storedRequestsAtComplete);
assert.equal((await storedPending.readTerminal(id,'fixture-key')).result_json,result);
console.log('MA E3 AlreadyStored durable completion: original status receipt plus typed origin/value proof before complete, no invented allocation/cipher/commit, immutable original response and result preserved PASS (synthetic only; UI/actual server pending)');
const previousJournal=box.NowNoteHistory.create({initial:{schema_version:1,contexts:{},protection_operations:{[id]:copy(pendingMarker)}},context:()=>ctx,request:async()=>{},write:async(v,g)=>{assert.equal(g.active(),true);}});
const previousController=A.createExecution({context:()=>ctx,journal:previousJournal,request:transport});
const previousState=operation.state,previousReceipt=copy(operation.receipt);operation.state='stale';operation.receipt=null;
const replanFromCurrent=await reader.catalog(scope),beforePreviousPosts=prepareCalls;
await previousController.beginReplan(id,'fixture-key',replanFromCurrent,{confirmed_reuse_original_result:true,target_epoch:replanFromCurrent.context.base.crypto_epoch});
assert.equal(prepareCalls,beforePreviousPosts);const previousCheckpoint=await previousController.inspectReplan(id,'fixture-key');
assert.equal(previousCheckpoint.previous_phase,'analysis_write_committing');assert.equal(previousCheckpoint.plan.prepare.previous_write_id,settled.execution_id);assert.equal(previousCheckpoint.plan.prepare.previous_write_state,'stale');
const previousArchive=Q.parseJson(await Q.decryptContent(previousController.status(id).cipher_bundle,'fixture-key'));
assert.equal(Q.canonicalJson(previousArchive.publication),Q.canonicalJson(waiting.publication));assert.equal(Q.canonicalJson(previousArchive.terminal),Q.canonicalJson(archive.terminal));
operation.state=previousState;operation.receipt=previousReceipt;
console.log('MA E3 prior stale publication: read-only original status/manifest probe, explicit fresh plan links exact previous state, old request/cipher/core preserved PASS (synthetic journal only)');
const makePreviousController=m=>A.createExecution({context:()=>ctx,journal:box.NowNoteHistory.create({initial:{schema_version:1,contexts:{},protection_operations:{[id]:copy(m)}},context:()=>ctx,request:async()=>{},write:async(v,g)=>{assert.equal(g.active(),true);}}),request:transport});
const activePrevious=makePreviousController(pendingMarker);operation.state='prepared';operation.receipt=null;
await assert.rejects(()=>activePrevious.beginReplan(id,'fixture-key',replanFromCurrent,{confirmed_reuse_original_result:true,target_epoch:2}),/replan_previous_write_active/);assert.equal(activePrevious.status(id).phase,'analysis_write_committing');
const missingPrevious=makePreviousController({...marker,phase:'analysis_write_preparing',cipher_bundle:await Q.encryptContent(Q.canonicalJson(started),'fixture-key')});exists=false;
const postsBeforeMissing=prepareCalls;await missingPrevious.beginReplan(id,'fixture-key',replanFromCurrent,{confirmed_reuse_original_result:true,target_epoch:2});assert.equal(prepareCalls,postsBeforeMissing);
assert.equal((await missingPrevious.inspectReplan(id,'fixture-key')).plan.prepare.previous_write_state,'none');exists=true;operation.state=previousState;operation.receipt=previousReceipt;
console.log('MA E3 prior write boundaries: active intent preserved/denied, exact missing status does not POST old prepare, none plan keeps prior archive PASS (synthetic journal only)');
const beforeTerminalProbe=transportCalls.length;
const headerOnly=await remote.prepareAnalysis(scope,waiting.publication.plan,settled,waiting.publication.catalog,true);
assert.equal(headerOnly.probe_only,true);assert.equal(headerOnly.manifest,null);assert.deepEqual(transportCalls.slice(beforeTerminalProbe).map(c=>c.path.split('/').at(-1)),['status']);
await assert.rejects(()=>A.buildInitialWriteWork(scope,request,settled,work,waiting.publication.plan,headerOnly,waiting.publication.catalog,'fixture-key'),/write_sources/);
const badCached=copy(waiting.publication.prepared);badCached.manifest.S=[];
await assert.rejects(()=>remote.prepareAnalysis(scope,waiting.publication.plan,settled,waiting.publication.catalog,true,badCached));
const savedProbeHeader=copy(operation.metadata_header);operation.metadata_header.operation_origin.source_digest='f'.repeat(64);
await assert.rejects(()=>remote.prepareAnalysis(scope,waiting.publication.plan,settled,waiting.publication.catalog,true),/analysis_probe_metadata/);operation.metadata_header=savedProbeHeader;
console.log('MA terminal probe: server-equivalent manifest 409/410, status only without cache/not publication proof, durable cached manifest/header tamper denial PASS (synthetic only)');
