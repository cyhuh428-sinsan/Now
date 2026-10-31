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
 if(path.endsWith('/manifest')){replanManifestCalls++;return {schema_version:3,section:body.section,metadata_manifest_digest:replanVerified.metadata_manifest_digest,metadata_header:copy(replanHeader),set_digests:copy(replanVerified.set_digests),counts:copy(replanVerified.counts),entries:copy(replanManifest[body.section]),next_cursor:null};}
 throw Error('unexpected_replan_request');
}});
await assert.rejects(()=>replanRemote.replanAnalysis(scope,rekeyPlan,newerCatalog),/replan_response_lost/);
const replanPrepared=await replanRemote.replanAnalysis(scope,rekeyPlan,newerCatalog);
assert.equal(replanPrepared.id,replanId);assert.equal(replanPrepared.digest,replanVerified.metadata_manifest_digest);assert.equal(replanCalls,2);assert.equal(replanGet,0);
await replanRemote.replanAnalysis(scope,rekeyPlan,newerCatalog,replanPrepared);assert.equal(replanCalls,2);assert.equal(replanGet,1);
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
