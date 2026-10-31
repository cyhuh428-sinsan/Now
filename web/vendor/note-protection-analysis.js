/* Mixed analysis execution metadata stays bound to its original source and output slots. */
(() => {
  'use strict';
  const Q=()=>globalThis.NowNoteProtectionProtocol;
  const fail=code=>{throw Error('note_protection_analysis:'+code);};
  const same=(a,b)=>Q().canonicalJson(a)===Q().canonicalJson(b);
  const exact=(v,names)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==names.length||names.some(k=>!Object.hasOwn(v,k)))fail('fields');};
  const integer=(n,min=0)=>{if(!Number.isSafeInteger(n)||n<min)fail('integer');};
  const uuid=v=>{if(typeof v!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v))fail('uuid');};
  const hex=v=>{if(typeof v!=='string'||!/^[0-9a-f]{64}$/.test(v))fail('digest');};
  const sourceFields=['source_context','source_keys','job_type','prompt_version','source_job_id'];
  const controlFields=[...sourceFields,'execution_route','client_execution_confirmed'];
  const pick=(v,fields)=>Object.fromEntries(fields.map(k=>[k,v[k]]));
  const slots=[['analysis_error','error_message'],['analysis_input','input_text'],['analysis_result','result_json']];
  function validateRequest(scope,r) {
    exact(r,['schema_version','owner_id','local_id','device_id','server_instance_id','mutation_id',...controlFields]);
    if(r.schema_version!==3||r.owner_id!==scope.owner||r.local_id!==scope.local_id||r.device_id!==scope.device||r.server_instance_id!==scope.instance)fail('scope');
    uuid(r.mutation_id);uuid(r.server_instance_id);
    exact(r.source_context,['server_instance_id','base','catalog_digest']);
    if(r.source_context.server_instance_id!==scope.instance)fail('source_scope');
    Q().validateContext(r.source_context.base);hex(r.source_context.catalog_digest);
    if(r.source_context.base.base.crypto_epoch<1||r.execution_route!=='client_provider'||r.client_execution_confirmed!==true
      ||r.prompt_version!=='single_source_v1'||typeof r.job_type!=='string'||![...r.job_type].length||[...r.job_type].length>60)fail('claim');
    if(r.source_job_id!==null){integer(r.source_job_id,1);if(r.source_job_id>2147483647)fail('job_id');}
    if(!Array.isArray(r.source_keys)||!r.source_keys.length)fail('sources');
    for(const s of r.source_keys){
      exact(s,['descriptor']);Q().validateDescriptor(s.descriptor,3);
      const b=s.descriptor.expected_binding;
      if(b&&(b.server_instance_id!==scope.instance||b.owner_id!==scope.owner||b.local_id!==scope.local_id))fail('source_scope');
    }
    const keys=r.source_keys.map(s=>s.descriptor.key);if(!same(keys,Q().keyOrder(keys)))fail('source_order');
    return r;
  }
  async function validateBundle(e,bm) {
    e=structuredClone(e);bm=structuredClone(bm);
    exact(bm,['schema_version','source_digest','original_job_id','original_epoch','outcome','error_code','slot_nulls','ciphertext_manifest','bundle_digest']);
    if(bm.schema_version!==3||bm.source_digest!==e.source_digest||bm.original_job_id!==e.job_id||bm.original_epoch!==e.source_context.base.base.crypto_epoch
      ||!['done','failed'].includes(bm.outcome)||(bm.outcome==='done'?bm.error_code!==null:!['provider_error','invalid_result'].includes(bm.error_code)))fail('bundle_binding');
    if(!Array.isArray(bm.slot_nulls)||bm.slot_nulls.length!==3||!Array.isArray(bm.ciphertext_manifest))fail('bundle_slots');
    for(let i=0;i<3;i++){
      const n=bm.slot_nulls[i];exact(n,['key','is_null']);
      const expected=e.output_slots[i].key.slot===(bm.outcome==='done'?'error_message':'result_json');
      if(!same(n.key,e.output_slots[i].key)||n.is_null!==expected)fail('bundle_nulls');
    }
    const required=e.output_slots.filter((s,i)=>!bm.slot_nulls[i].is_null);
    if(bm.ciphertext_manifest.length!==required.length)fail('bundle_cipher_set');
    for(let i=0;i<required.length;i++){
      const c=bm.ciphertext_manifest[i],s=required[i];
      exact(c,['entry_key','destination_key','source_etag','output_kind','target_epoch','total_bytes','ciphertext_sha256']);
      if(!same(c.entry_key,s.key)||!same(c.destination_key,s.key)||c.source_etag!==s.source_etag||c.output_kind!=='linked_text_envelope_v1'||c.target_epoch!==bm.original_epoch)fail('bundle_cipher_binding');
      integer(c.total_bytes,1);hex(c.ciphertext_sha256);
    }
    hex(bm.bundle_digest);
    if(await Q().hashJson(pick(bm,Object.keys(bm).filter(k=>k!=='bundle_digest')))!==bm.bundle_digest)fail('bundle_digest');
    return bm;
  }
  function terminalDescriptor(execution,slot,digest) {
    return {key:slot.key,representation_kind:'linked_text_envelope_v1',representation_epoch:execution.source_context.base.base.crypto_epoch,is_null:false,
      representation_version:1,representation_etag:slot.source_etag,storage_operation_id:execution.execution_id,semantic_origin_id:null,origin_validator:'linked_v1',origin_row_required:false,
      expected_binding:slot.expected_binding,revision_ref:null,parent_ref:null,physical_note_id:null,inventory_revision_id:null,linked_slot_version:1,ciphertext_sha256:digest};
  }
  async function openTerminalBundle(scope,request,execution,work,password,active=()=>true) {
    scope=structuredClone(scope);request=structuredClone(request);execution=structuredClone(execution);work=structuredClone(work);
    const check=()=>{if(active()!==true)fail('scope_changed');};
    check();if(!password)fail('key_required');
    await validateExecution(scope,request,execution);check();
    exact(work,['transfers','bundle_metadata']);await validateBundle(execution,work.bundle_metadata);check();
    if(execution.dispatch_receipt===null)fail('terminal_state');
    if(execution.bundle_metadata!==null&&!same(execution.bundle_metadata,work.bundle_metadata))fail('terminal_bundle_changed');
    const records=work.bundle_metadata.ciphertext_manifest;
    if(!Array.isArray(work.transfers)||work.transfers.length!==records.length)fail('terminal_cipher_set');
    const values={input_text:null,result_json:null,error_message:null};
    for(let i=0;i<records.length;i++){
      const c=records[i],t=work.transfers[i];exact(t,['key','raw']);
      if(!same(t.key,c.destination_key)||typeof t.raw!=='string'||new TextEncoder().encode(t.raw).length!==c.total_bytes)fail('terminal_cipher_length');
      if(await Q().sha256(t.raw)!==c.ciphertext_sha256)fail('terminal_cipher_digest');check();
      const slot=execution.output_slots.find(s=>same(s.key,t.key));
      values[t.key.slot]=await Q().decryptRepresentation(t.raw,terminalDescriptor(execution,slot,c.ciphertext_sha256),{value:null,legacy:null},async()=>password,3);check();
    }
    return values;
  }
  function validateObservation(observation) {
    exact(observation,['provider_terminal_observed','outcome','result_json','error_message','error_code']);
    if(observation.provider_terminal_observed!==true)fail('terminal_unobserved');
    const done=observation.outcome==='done';
    if(!['done','failed'].includes(observation.outcome)||(done
      ?typeof observation.result_json!=='string'||observation.error_message!==null||observation.error_code!==null
      :observation.result_json!==null||typeof observation.error_message!=='string'||!['provider_error','invalid_result'].includes(observation.error_code)))fail('terminal_shape');
  }
  async function buildTerminalBundle(scope,request,execution,input,observation,password,active=()=>true) {
    scope=structuredClone(scope);request=structuredClone(request);execution=structuredClone(execution);observation=structuredClone(observation);
    const check=()=>{if(active()!==true)fail('scope_changed');};
    check();if(!password)fail('key_required');if(typeof input!=='string')fail('input');
    validateObservation(observation);
    await validateExecution(scope,request,execution);check();
    if(!['client_running','cancel_requested'].includes(execution.state)||execution.dispatch_receipt===null||execution.terminal_receipt!==null)fail('terminal_state');
    const values={input_text:input,result_json:observation.result_json,error_message:observation.error_message};
    const transfers=[],ciphertext_manifest=[],slot_nulls=[],epoch=execution.source_context.base.base.crypto_epoch;
    for(const slot of execution.output_slots){
      const value=values[slot.key.slot],is_null=value===null;slot_nulls.push({key:structuredClone(slot.key),is_null});
      if(is_null)continue;
      const destination={key:slot.key,output_kind:'linked_text_envelope_v1',output_epoch:epoch,is_null:false,expected_binding:slot.expected_binding,operation_origin:null};
      const raw=await Q().encryptRepresentation(value,destination,password);check();
      const digest=await Q().sha256(raw);check();
      const descriptor=terminalDescriptor(execution,slot,digest);
      const recovered=await Q().decryptRepresentation(raw,descriptor,{value:null,legacy:null},async()=>password,3);check();
      if(recovered!==value)fail('terminal_readback');
      transfers.push({key:structuredClone(slot.key),raw});
      ciphertext_manifest.push({entry_key:structuredClone(slot.key),destination_key:structuredClone(slot.key),source_etag:slot.source_etag,output_kind:'linked_text_envelope_v1',target_epoch:epoch,total_bytes:new TextEncoder().encode(raw).length,ciphertext_sha256:digest});
    }
    const metadata={schema_version:3,source_digest:execution.source_digest,original_job_id:execution.job_id,original_epoch:epoch,outcome:observation.outcome,error_code:observation.error_code,slot_nulls,ciphertext_manifest};
    metadata.bundle_digest=await Q().hashJson(metadata);check();
    await validateBundle(execution,metadata);check();
    return {transfers,bundle_metadata:metadata};
  }
  async function validateExecution(scope,request,e) {
    scope=structuredClone(scope);request=structuredClone(request);e=structuredClone(e);
    validateRequest(scope,request);
    exact(e,['schema_version','execution_id','job_id','job_id_mode','state','run_version','lease_version','expires_at','source_context','source_keys','source_digest','claim_metadata_digest','output_slots','dispatch_receipt','terminal_receipt','bundle_metadata','source_matches_current','latest_context']);
    uuid(e.execution_id);integer(e.job_id,1);integer(e.run_version,1);integer(e.lease_version,1);
    if(e.schema_version!==3||e.job_id>2147483647||!['allocated','provisional'].includes(e.job_id_mode)
      ||!['client_pending','client_running','cancel_requested','expired','cancelled','client_settled','result_unavailable'].includes(e.state)
      ||typeof e.expires_at!=='string'||!Number.isFinite(Date.parse(e.expires_at))||typeof e.source_matches_current!=='boolean')fail('execution');
    Q().validateContext(e.latest_context);
    if(!same(e.source_context,request.source_context)||!same(e.source_keys,request.source_keys)||await Q().hashJson(pick(request,sourceFields))!==e.source_digest)fail('source_digest');
    if(!Array.isArray(e.output_slots)||e.output_slots.length!==3)fail('output_slots');
    const tokens=new Set();
    for(let i=0;i<3;i++){
      const s=e.output_slots[i],key={kind:slots[i][0],id:String(e.job_id),slot:slots[i][1]};
      exact(s,['key','source_etag','expected_binding']);uuid(s.source_etag);Q().validateBinding(s.expected_binding);
      if(tokens.has(s.source_etag)||!same(s.key,key)||!same(s.expected_binding,{server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,transition_id:e.execution_id,crypto_epoch:request.source_context.base.base.crypto_epoch,destination_key:key,revision_ref:null,parent_ref:null}))fail('output_binding');
      tokens.add(s.source_etag);
    }
    const control={schema_version:3,...pick(request,controlFields),...pick(e,['job_id','job_id_mode','output_slots'])};
    if(await Q().hashJson(control)!==e.claim_metadata_digest)fail('claim_digest');
    const dr=e.dispatch_receipt,tr=e.terminal_receipt,bm=e.bundle_metadata;
    if(dr!==null){
      exact(dr,['schema_version','execution_id','dispatch_id','source_digest','run_version']);uuid(dr.dispatch_id);
      if(!same(dr,{schema_version:3,execution_id:e.execution_id,dispatch_id:dr.dispatch_id,source_digest:e.source_digest,run_version:2})||e.run_version<2||['client_pending','expired','cancelled'].includes(e.state))fail('dispatch_receipt');
    }
    if(['client_pending','expired'].includes(e.state)&&(dr!==null||e.run_version!==1))fail('dispatch_state');
    if(e.state==='client_running'&&(dr===null||e.run_version!==2))fail('dispatch_state');
    if(e.state==='cancel_requested'&&(dr===null||e.run_version<3))fail('dispatch_state');
    if(tr===null){if(bm!==null||['client_settled','result_unavailable','cancelled'].includes(e.state))fail('terminal_missing');return e;}
    exact(tr,['schema_version','execution_id','original_job_id','dispatch_id','source_digest','terminal_run_version','outcome','bundle_digest','client_reported','external_settled','result_server_persisted']);
    const outcome=e.state==='client_settled'?bm?.outcome:e.state;
    if(!['done','failed','result_unavailable','cancelled'].includes(outcome)||!same(tr,{schema_version:3,execution_id:e.execution_id,original_job_id:e.job_id,dispatch_id:dr?.dispatch_id??null,source_digest:e.source_digest,terminal_run_version:e.run_version,outcome,bundle_digest:bm?.bundle_digest??null,client_reported:true,external_settled:true,result_server_persisted:false}))fail('terminal_receipt');
    if(outcome==='cancelled'){if(dr!==null||bm!==null||e.run_version!==2)fail('terminal_state');}
    else {
      if(dr===null||e.run_version<3)fail('terminal_state');
      if(outcome==='result_unavailable'){if(bm!==null)fail('unavailable_bundle');}
      else await validateBundle(e,bm);
    }
    return e;
  }
  async function createInitialWritePlan(scope,request,execution,work,catalog,mutationId,password,active=()=>true) {
    scope=structuredClone(scope);request=structuredClone(request);execution=structuredClone(execution);work=structuredClone(work);catalog=structuredClone(catalog);
    const check=()=>{if(active()!==true)fail('scope_changed');};check();uuid(mutationId);
    await validateExecution(scope,request,execution);check();
    if(execution.state!=='client_settled'||!['done','failed'].includes(execution.terminal_receipt?.outcome))fail('terminal_unsettled');
    Q().validateContext(catalog.context);
    if(execution.source_matches_current!==true||!same(catalog.context,request.source_context.base)||!same(catalog.context,execution.latest_context)
      ||catalog.catalog_digest!==request.source_context.catalog_digest)fail('source_changed');
    if(!Array.isArray(catalog.entries))fail('catalog');
    for(const d of catalog.entries){
      Q().validateDescriptor(d,3);
      if(d.expected_binding&&(d.expected_binding.owner_id!==scope.owner||d.expected_binding.local_id!==scope.local_id||d.expected_binding.server_instance_id!==scope.instance))fail('source_scope');
    }
    const keys=catalog.entries.map(d=>d.key);
    if(!same(keys,Q().keyOrder(keys))||request.source_keys.some(s=>!catalog.entries.some(d=>same(d,s.descriptor))))fail('source_changed');
    const digest=await Q().hashJson({server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,context:catalog.context,entries:catalog.entries});check();
    if(digest!==catalog.catalog_digest)fail('catalog_digest');
    await openTerminalBundle(scope,request,execution,work,password,active);check();
    const execution_ref={schema_version:3,execution_id:execution.execution_id,terminal_run_version:execution.terminal_receipt.terminal_run_version,
      terminal_receipt_digest:await Q().hashJson(execution.terminal_receipt),original_bundle_digest:work.bundle_metadata.bundle_digest};check();
    return {purpose:'mixed_analysis_write',prepare:{schema_version:3,owner_id:scope.owner,local_id:scope.local_id,device_id:scope.device,server_instance_id:scope.instance,
      mutation_id:mutationId,base:catalog.context,expected_catalog_digest:catalog.catalog_digest,execution_ref,bundle_metadata:work.bundle_metadata},transfers:work.transfers};
  }
  async function createReplanWritePlan(scope,request,execution,terminalWork,catalog,previous,mutationId,password,confirmation,active=()=>true) {
    scope=structuredClone(scope);request=structuredClone(request);execution=structuredClone(execution);terminalWork=structuredClone(terminalWork);catalog=structuredClone(catalog);previous=structuredClone(previous);confirmation=structuredClone(confirmation);
    const check=()=>{if(active()!==true)fail('scope_changed');};check();uuid(mutationId);
    globalThis.NowNoteProtectionState.validateScope(scope);
    const originalScope={...scope,device:request.device_id};globalThis.NowNoteProtectionState.validateScope(originalScope);
    exact(confirmation,['confirmed_reuse_original_result','target_epoch']);
    Q().validateContext(catalog.context);
    if(confirmation.confirmed_reuse_original_result!==true||confirmation.target_epoch!==catalog.context.base.crypto_epoch||confirmation.target_epoch<1)fail('reuse_confirmation');
    exact(previous,['operation_id','state']);
    if(previous.operation_id===null?previous.state!=='none':!['stale','aborted','expired'].includes(previous.state))fail('previous_write_state');
    if(previous.operation_id!==null)uuid(previous.operation_id);
    await validateExecution(originalScope,request,execution);check();
    if(execution.state!=='client_settled'||!['done','failed'].includes(execution.terminal_receipt?.outcome))fail('terminal_unsettled');
    if(!Array.isArray(catalog.entries))fail('catalog');
    for(const d of catalog.entries){
      Q().validateDescriptor(d,3);
      if(d.expected_binding&&(d.expected_binding.owner_id!==scope.owner||d.expected_binding.local_id!==scope.local_id||d.expected_binding.server_instance_id!==scope.instance))fail('source_scope');
    }
    const keys=catalog.entries.map(d=>d.key);if(!same(keys,Q().keyOrder(keys)))fail('catalog_order');
    if(await Q().hashJson({server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,context:catalog.context,entries:catalog.entries})!==catalog.catalog_digest)fail('catalog_digest');check();
    await openTerminalBundle(originalScope,request,execution,terminalWork,password,active);check();
    const execution_ref={schema_version:3,execution_id:execution.execution_id,terminal_run_version:execution.terminal_receipt.terminal_run_version,
      terminal_receipt_digest:await Q().hashJson(execution.terminal_receipt),original_bundle_digest:terminalWork.bundle_metadata.bundle_digest};check();
    return {purpose:'mixed_analysis_write',request_type:'replan',prepare:{schema_version:3,owner_id:scope.owner,local_id:scope.local_id,device_id:scope.device,server_instance_id:scope.instance,
      mutation_id:mutationId,base:catalog.context,expected_catalog_digest:catalog.catalog_digest,execution_ref,previous_write_id:previous.operation_id,
      previous_write_state:previous.state,target_epoch:confirmation.target_epoch,confirmed_reuse_original_result:true},
      original:{scope:originalScope,request,execution,work:terminalWork}};
  }
  async function validateInitialWriteManifest(scope,plan,execution,catalog,manifest,active=()=>true) {
    scope=structuredClone(scope);plan=structuredClone(plan);execution=structuredClone(execution);catalog=structuredClone(catalog);manifest=structuredClone(manifest);
    const check=()=>{if(active()!==true)fail('scope_changed');};check();
    exact(plan,['purpose','prepare','transfers']);const body=plan.prepare;
    exact(body,['schema_version','owner_id','local_id','device_id','server_instance_id','mutation_id','base','expected_catalog_digest','execution_ref','bundle_metadata']);
    if(plan.purpose!=='mixed_analysis_write'||body.schema_version!==3||body.owner_id!==scope.owner||body.local_id!==scope.local_id||body.device_id!==scope.device||body.server_instance_id!==scope.instance)fail('write_scope');
    uuid(body.mutation_id);Q().validateContext(body.base);
    if(execution.state!=='client_settled'||!['done','failed'].includes(execution.terminal_receipt?.outcome)||!same(body.bundle_metadata,execution.bundle_metadata))fail('terminal_unsettled');
    await validateBundle(execution,body.bundle_metadata);check();
    const expectedRef={schema_version:3,execution_id:execution.execution_id,terminal_run_version:execution.terminal_receipt.terminal_run_version,
      terminal_receipt_digest:await Q().hashJson(execution.terminal_receipt),original_bundle_digest:body.bundle_metadata.bundle_digest};check();
    if(!same(body.execution_ref,expectedRef)||!same(body.base,catalog.context)||!same(execution.source_context,{server_instance_id:scope.instance,base:body.base,catalog_digest:body.expected_catalog_digest}))fail('write_source');
    for(const d of catalog.entries)Q().validateDescriptor(d,3);
    if(await Q().hashJson({server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,context:catalog.context,entries:catalog.entries})!==body.expected_catalog_digest)fail('catalog_digest');check();
    if(!Array.isArray(manifest.S)||manifest.S.length!==catalog.entries.length)fail('write_sources');
    const tokens=new Set();for(let n=0;n<manifest.S.length;n++){
      const s=manifest.S[n];exact(s,['descriptor','source_etag']);uuid(s.source_etag);
      if(tokens.has(s.source_etag)||!same(s.descriptor,catalog.entries[n]))fail('write_sources');tokens.add(s.source_etag);
    }
    const epoch=body.base.base.crypto_epoch,outputs=execution.output_slots.map((s,i)=>({destination_key:s.key,source_keys:[],source_etag:s.source_etag,
      output_kind:'linked_text_envelope_v1',output_epoch:epoch,is_null:body.bundle_metadata.slot_nulls[i].is_null,
      expected_binding:body.bundle_metadata.slot_nulls[i].is_null?null:s.expected_binding}));
    const expectation=d=>({destination_key:d.key,...pick(d,['is_null','origin_validator','origin_row_required','storage_operation_id','semantic_origin_id'])});
    const origins=[...catalog.entries.map(expectation),...outputs.map(d=>({destination_key:d.destination_key,is_null:d.is_null,origin_validator:'linked_mixed_v1',origin_row_required:false,storage_operation_id:execution.execution_id,semantic_origin_id:execution.execution_id}))];
    const O=Q().keyOrder(origins.map(o=>o.destination_key)).map(key=>origins.find(o=>same(o.destination_key,key)));
    const expected={schema_version:3,purpose:plan.purpose,operation_id:execution.execution_id,server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,actor_device_id:scope.device,mutation_id:body.mutation_id,
      base:body.base,source_catalog_digest:body.expected_catalog_digest,target_epoch:epoch,revision_ref:null,parent_ref:null,server_fields:null,
      control:{request_type:'initial',execution_ref:expectedRef,previous_write_id:null,previous_write_state:'none',target_epoch:epoch,confirmed_reuse_original_result:false},
      operation_origin:{purpose:plan.purpose,operation_id:execution.execution_id,execution_id:execution.execution_id,request_type:'initial',source_context:execution.source_context,
        source_digest:execution.source_digest,terminal_receipt_digest:expectedRef.terminal_receipt_digest,original_bundle_digest:expectedRef.original_bundle_digest,previous_write_id:null},
      S:manifest.S,DSET:outputs,P:catalog.entries,O,existing:[],verified_existing:[]};
    if(!same(manifest,expected))fail('write_manifest');
    return manifestProof(manifest,active);
  }
  async function manifestProof(manifest,active) {
    const check=()=>{if(active()!==true)fail('scope_changed');};check();
    const names=['S','DSET','P','O','existing','verified_existing'],set_digests={},counts={},kinds=['analysis_error','analysis_input','analysis_result','inventory_snapshot','note_body','offline_snapshot','recording_transcript','reserved_offline_snapshot','revision_before','revision_snapshot'];
    for(const name of names){
      set_digests[name]=await Q().hashJson(manifest[name]);check();
      const rows=manifest[name].map(e=>['S','existing','verified_existing'].includes(name)?e.descriptor:['DSET','O'].includes(name)?{...e,key:e.destination_key}:e);
      counts[name]={total:rows.length,nonnull:rows.filter(d=>!d.is_null).length,nulls:rows.filter(d=>d.is_null).length,
        by_kind:kinds.map(kind=>{const part=rows.filter(d=>d.key.kind===kind);return {kind,total:part.length,nonnull:part.filter(d=>!d.is_null).length,nulls:part.filter(d=>d.is_null).length};})};
    }
    const metadata_manifest_digest=await Q().hashJson(manifest);check();return {metadata_manifest_digest,set_digests,counts};
  }
  async function validateReplanWritePlan(scope,plan,catalog,active=()=>true) {
    scope=structuredClone(scope);plan=structuredClone(plan);catalog=structuredClone(catalog);
    const check=()=>{if(active()!==true)fail('scope_changed');};check();
    globalThis.NowNoteProtectionState.validateScope(scope);
    exact(plan,['purpose','request_type','prepare','original']);exact(plan.original,['scope','request','execution','work']);
    const body=plan.prepare,original=plan.original,e=original.execution;
    const originalScope={...scope,device:original.request.device_id};
    if(!same(original.scope,originalScope)||plan.purpose!=='mixed_analysis_write'||plan.request_type!=='replan')fail('write_scope');
    await validateExecution(originalScope,original.request,e);check();
    if(e.state!=='client_settled'||!['done','failed'].includes(e.terminal_receipt?.outcome)||!same(e.bundle_metadata,original.work.bundle_metadata))fail('terminal_unsettled');
    await validateBundle(e,original.work.bundle_metadata);check();
    exact(body,['schema_version','owner_id','local_id','device_id','server_instance_id','mutation_id','base','expected_catalog_digest','execution_ref','previous_write_id','previous_write_state','target_epoch','confirmed_reuse_original_result']);
    uuid(body.mutation_id);Q().validateContext(catalog.context);
    if(body.previous_write_id===null?body.previous_write_state!=='none':!['stale','aborted','expired'].includes(body.previous_write_state))fail('previous_write_state');
    if(body.previous_write_id!==null)uuid(body.previous_write_id);
    const reference={schema_version:3,execution_id:e.execution_id,terminal_run_version:e.terminal_receipt.terminal_run_version,
      terminal_receipt_digest:await Q().hashJson(e.terminal_receipt),original_bundle_digest:e.bundle_metadata.bundle_digest};check();
    const epoch=catalog.context.base.crypto_epoch;
    const expectedBody={schema_version:3,owner_id:scope.owner,local_id:scope.local_id,device_id:scope.device,server_instance_id:scope.instance,
      mutation_id:body.mutation_id,base:catalog.context,expected_catalog_digest:catalog.catalog_digest,execution_ref:reference,
      previous_write_id:body.previous_write_id,previous_write_state:body.previous_write_state,target_epoch:epoch,confirmed_reuse_original_result:true};
    if(epoch<1||!same(body,expectedBody)||!Array.isArray(catalog.entries))fail('write_source');
    for(const d of catalog.entries){
      Q().validateDescriptor(d,3);
      if(d.expected_binding&&(d.expected_binding.owner_id!==scope.owner||d.expected_binding.local_id!==scope.local_id||d.expected_binding.server_instance_id!==scope.instance))fail('source_scope');
    }
    const keys=catalog.entries.map(d=>d.key);if(!same(keys,Q().keyOrder(keys)))fail('catalog_order');
    if(await Q().hashJson({server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,context:catalog.context,entries:catalog.entries})!==body.expected_catalog_digest)fail('catalog_digest');check();
    return {execution:e,reference,epoch};
  }
  async function validateReplanWriteManifest(scope,plan,catalog,manifest,active=()=>true) {
    scope=structuredClone(scope);plan=structuredClone(plan);catalog=structuredClone(catalog);manifest=structuredClone(manifest);
    const check=()=>{if(active()!==true)fail('scope_changed');};check();
    const {execution:e,reference,epoch}=await validateReplanWritePlan(scope,plan,catalog,active);check();
    const body=plan.prepare;uuid(manifest.operation_id);
    if(manifest.operation_id===e.execution_id||manifest.operation_id===body.previous_write_id)fail('replan_identity');
    if(!Array.isArray(manifest.S)||manifest.S.length!==catalog.entries.length||!Array.isArray(manifest.DSET)||manifest.DSET.length!==3)fail('write_sources');
    const tokens=new Set();
    for(let n=0;n<manifest.S.length;n++){
      const s=manifest.S[n];exact(s,['descriptor','source_etag']);uuid(s.source_etag);
      if(tokens.has(s.source_etag)||!same(s.descriptor,catalog.entries[n]))fail('write_sources');tokens.add(s.source_etag);
    }
    const job=manifest.DSET[0].destination_key?.id;
    if(typeof job!=='string'||!/^[1-9][0-9]*$/.test(job)||catalog.entries.some(d=>['analysis_error','analysis_input','analysis_result'].includes(d.key.kind)&&d.key.id===job))fail('replan_job');
    const outputs=e.bundle_metadata.slot_nulls.map((s,n)=>{
      const key={...s.key,id:job},token=manifest.DSET[n].source_etag;uuid(token);
      if(tokens.has(token)||e.output_slots.some(o=>o.source_etag===token))fail('replan_token');tokens.add(token);
      return {destination_key:key,source_keys:[],source_etag:token,output_kind:'linked_text_envelope_v1',output_epoch:epoch,is_null:s.is_null,
        expected_binding:s.is_null?null:{server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,transition_id:manifest.operation_id,crypto_epoch:epoch,destination_key:key,revision_ref:null,parent_ref:null}};
    });
    const origins=[...catalog.entries.map(d=>({destination_key:d.key,...pick(d,['is_null','origin_validator','origin_row_required','storage_operation_id','semantic_origin_id'])})),
      ...outputs.map(d=>({destination_key:d.destination_key,is_null:d.is_null,origin_validator:'linked_mixed_v1',origin_row_required:false,storage_operation_id:manifest.operation_id,semantic_origin_id:manifest.operation_id}))];
    const expected={schema_version:3,purpose:plan.purpose,operation_id:manifest.operation_id,server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,actor_device_id:scope.device,mutation_id:body.mutation_id,
      base:body.base,source_catalog_digest:body.expected_catalog_digest,target_epoch:epoch,revision_ref:null,parent_ref:null,server_fields:null,
      control:{request_type:'replan',execution_ref:reference,...pick(body,['previous_write_id','previous_write_state','target_epoch','confirmed_reuse_original_result'])},
      operation_origin:{purpose:plan.purpose,operation_id:manifest.operation_id,request_type:'replan',execution_ref:reference,original_source_context:e.source_context,previous_write_id:body.previous_write_id},
      S:manifest.S,DSET:outputs,P:catalog.entries,O:Q().keyOrder(origins.map(o=>o.destination_key)).map(key=>origins.find(o=>same(o.destination_key,key))),existing:[],verified_existing:[]};
    if(!same(manifest,expected))fail('write_manifest');
    return manifestProof(manifest,active);
  }
  async function validateStoredAnalysisResult(scope,plan,catalog,response,active=()=>true) {
    scope=structuredClone(scope);plan=structuredClone(plan);catalog=structuredClone(catalog);response=structuredClone(response);
    const {execution:e,reference}=await validateReplanWritePlan(scope,plan,catalog,active);
    if(active()!==true)fail('scope_changed');
    exact(response,['schema_version','status','stored_result','original_execution','latest_context']);
    const expected={reference,source_schema_version:3,source_context:e.source_context,terminal_receipt:e.terminal_receipt,bundle_metadata:e.bundle_metadata};
    if(response.schema_version!==3||response.status!=='already_stored'||!same(response.original_execution,expected))fail('analysis_original_execution');
    Q().validateContext(response.latest_context);
    const stored=response.stored_result;exact(stored,['schema_version','operation_id','status_path','receipt']);uuid(stored.operation_id);
    if(stored.schema_version!==3||stored.status_path!=='/api/v2/notes/mixed-analysis-writes/status')fail('stored_schema');
    const r=stored.receipt;
    exact(r,['schema_version','purpose','operation_id','mutation_id','server_instance_id','owner_id','local_id','result','metadata_manifest_digest','set_digests','ciphertext_manifest_digest','origin_expectations_digest','committed_at']);
    if(r.schema_version!==3||r.purpose!=='mixed_analysis_write'||r.operation_id!==stored.operation_id||r.owner_id!==scope.owner||r.local_id!==scope.local_id||r.server_instance_id!==scope.instance)fail('stored_receipt');
    uuid(r.mutation_id);Q().validateContext(r.result);
    if(r.result.base.crypto_epoch<1||typeof r.committed_at!=='string'||!Number.isFinite(Date.parse(r.committed_at)))fail('stored_receipt');
    for(const name of ['metadata_manifest_digest','ciphertext_manifest_digest','origin_expectations_digest'])hex(r[name]);
    const names=['S','DSET','P','O','existing','verified_existing'];exact(r.set_digests,names);for(const name of names)hex(r.set_digests[name]);
    // Metadata is not publication proof: typed origin, ciphertext and meaning are verified separately.
    return response;
  }
  async function replanValues(scope,plan,prepared,catalog,password,active) {
    const v=await validateReplanWriteManifest(scope,plan,catalog,{...prepared.response.metadata_header,...prepared.manifest},active);
    const e=plan.original.execution,original={reference:plan.prepare.execution_ref,source_schema_version:3,source_context:e.source_context,terminal_receipt:e.terminal_receipt,bundle_metadata:e.bundle_metadata};
    if(prepared.version!==3||prepared.path!=='/api/v2/notes/mixed-analysis-writes'||prepared.id!==prepared.response.operation_id||prepared.operation_id!==prepared.id
      ||prepared.digest!==v.metadata_manifest_digest||prepared.response.metadata_manifest_digest!==prepared.digest||prepared.response.mutation_id!==plan.prepare.mutation_id
      ||!same(prepared.original_execution,original)||!same(prepared.response.counts,v.counts))fail('write_prepared');
    integer(prepared.response.lease_version,1);
    return openTerminalBundle(plan.original.scope,plan.original.request,e,plan.original.work,password,active);
  }
  function replanDescriptor(prepared,output,digest) {
    return {key:output.destination_key,representation_kind:output.output_kind,representation_epoch:output.output_epoch,is_null:false,
      representation_version:1,representation_etag:output.source_etag,storage_operation_id:prepared.id,semantic_origin_id:prepared.id,origin_validator:'linked_mixed_v1',origin_row_required:false,
      expected_binding:output.expected_binding,revision_ref:null,parent_ref:null,physical_note_id:null,inventory_revision_id:null,linked_slot_version:1,ciphertext_sha256:digest};
  }
  async function replanCommit(scope,plan,prepared,records) {
    return {schema_version:3,owner_id:scope.owner,local_id:scope.local_id,device_id:scope.device,server_instance_id:scope.instance,
      operation_id:prepared.id,lease_version:prepared.response.lease_version,mutation_id:plan.prepare.mutation_id,base:plan.prepare.base,
      metadata_manifest_digest:prepared.digest,client_verified_ciphertext_manifest_digest:await Q().hashJson(records),client_decryption_verified:true,target_epoch:plan.prepare.target_epoch};
  }
  async function buildReplanWriteWork(scope,plan,prepared,catalog,originalPassword,targetPassword,active=()=>true) {
    scope=structuredClone(scope);plan=structuredClone(plan);prepared=structuredClone(prepared);catalog=structuredClone(catalog);
    const check=()=>{if(active()!==true)fail('scope_changed');};check();if(!targetPassword)fail('key_required');
    const values=await replanValues(scope,plan,prepared,catalog,originalPassword,active);check();
    const transfers=[],records=[];
    for(const output of prepared.manifest.DSET){
      if(output.is_null)continue;
      const key=output.destination_key,value=values[key.slot],origin={value:prepared.response.metadata_header.operation_origin,legacy:null};
      const destination={key,...pick(output,['output_kind','output_epoch','is_null','expected_binding']),operation_origin:origin.value};
      const raw=await Q().encryptRepresentation(value,destination,targetPassword);check();
      const digest=await Q().sha256(raw);check();const descriptor=replanDescriptor(prepared,output,digest);
      if(await Q().decryptRepresentation(raw,descriptor,origin,async()=>targetPassword,3)!==value)fail('replan_readback');check();
      transfers.push({key,raw,descriptor,origin,semantic:value});
      records.push({entry_key:key,destination_key:key,source_etag:output.source_etag,output_kind:output.output_kind,target_epoch:output.output_epoch,total_bytes:new TextEncoder().encode(raw).length,ciphertext_sha256:digest});
    }
    const commit=await replanCommit(scope,plan,prepared,records);check();
    return {transfers,commit,replanned_analysis:{plan,catalog}};
  }
  async function verifyReplanWriteWork(scope,plan,prepared,catalog,work,originalPassword,targetPassword,active=()=>true) {
    scope=structuredClone(scope);plan=structuredClone(plan);prepared=structuredClone(prepared);catalog=structuredClone(catalog);work=structuredClone(work);
    const check=()=>{if(active()!==true)fail('scope_changed');};check();if(!targetPassword)fail('key_required');
    const values=await replanValues(scope,plan,prepared,catalog,originalPassword,active);check();
    exact(work,['transfers','commit','replanned_analysis']);exact(work.replanned_analysis,['plan','catalog']);
    if(!same(work.replanned_analysis,{plan,catalog})||!Array.isArray(work.transfers))fail('replan_work');
    const outputs=prepared.manifest.DSET.filter(d=>!d.is_null),records=[];
    if(work.transfers.length!==outputs.length)fail('replan_cipher_set');
    for(let n=0;n<outputs.length;n++){
      const o=outputs[n],t=work.transfers[n],key=o.destination_key;exact(t,['key','raw','descriptor','origin','semantic']);
      if(!same(t.key,key)||typeof t.raw!=='string'||!same(t.semantic,values[key.slot]))fail('replan_meaning');
      const digest=await Q().sha256(t.raw);check();const descriptor=replanDescriptor(prepared,o,digest);
      if(!same(t.descriptor,descriptor)||!same(t.origin,{value:prepared.response.metadata_header.operation_origin,legacy:null}))fail('replan_cipher_binding');
      if(await Q().decryptRepresentation(t.raw,descriptor,t.origin,async()=>targetPassword,3)!==values[key.slot])fail('replan_readback');check();
      records.push({entry_key:key,destination_key:key,source_etag:o.source_etag,output_kind:o.output_kind,target_epoch:o.output_epoch,total_bytes:new TextEncoder().encode(t.raw).length,ciphertext_sha256:digest});
    }
    const expected=await replanCommit(scope,plan,prepared,records);check();if(!same(work.commit,expected))fail('replan_commit');
    return {ciphertext_manifest_digest:expected.client_verified_ciphertext_manifest_digest,output_keys:outputs.map(d=>d.destination_key)};
  }
  async function buildInitialWriteWork(scope,request,execution,terminalWork,plan,prepared,catalog,password,active=()=>true) {
    scope=structuredClone(scope);request=structuredClone(request);execution=structuredClone(execution);terminalWork=structuredClone(terminalWork);plan=structuredClone(plan);prepared=structuredClone(prepared);catalog=structuredClone(catalog);
    const check=()=>{if(active()!==true)fail('scope_changed');};check();
    const verified=await validateInitialWriteManifest(scope,plan,execution,catalog,{...prepared.response.metadata_header,...prepared.manifest},active);check();
    if(prepared.version!==3||prepared.path!=='/api/v2/notes/mixed-analysis-writes'||prepared.id!==execution.execution_id||prepared.digest!==verified.metadata_manifest_digest
      ||prepared.response.operation_id!==prepared.id||prepared.response.mutation_id!==plan.prepare.mutation_id||!same(prepared.response.counts,verified.counts))fail('write_prepared');
    integer(prepared.response.lease_version,1);
    const values=await openTerminalBundle(scope,request,execution,terminalWork,password,active);check();
    if(!same(plan.transfers,terminalWork.transfers)||!same(plan.prepare.bundle_metadata,terminalWork.bundle_metadata))fail('write_original_cipher');
    const transfers=terminalWork.transfers.map(t=>{
      const slot=execution.output_slots.find(s=>same(s.key,t.key)),record=terminalWork.bundle_metadata.ciphertext_manifest.find(c=>same(c.destination_key,t.key));
      if(!slot||!record)fail('write_original_cipher');
      return {key:t.key,raw:t.raw,descriptor:terminalDescriptor(execution,slot,record.ciphertext_sha256),origin:{value:null,legacy:null},semantic:values[t.key.slot]};
    });
    const commit={schema_version:3,owner_id:scope.owner,local_id:scope.local_id,device_id:scope.device,server_instance_id:scope.instance,
      operation_id:prepared.id,lease_version:prepared.response.lease_version,mutation_id:plan.prepare.mutation_id,base:plan.prepare.base,
      metadata_manifest_digest:prepared.digest,client_verified_ciphertext_manifest_digest:await Q().hashJson(terminalWork.bundle_metadata.ciphertext_manifest),
      client_decryption_verified:true,target_epoch:plan.prepare.base.base.crypto_epoch};check();
    return {transfers,commit,initial_analysis:{request,execution,work:terminalWork,plan,catalog}};
  }
  async function verifyInitialPublication(scope,request,execution,terminalWork,plan,prepared,receipt,reader,password,active=()=>true) {
    scope=structuredClone(scope);request=structuredClone(request);execution=structuredClone(execution);terminalWork=structuredClone(terminalWork);plan=structuredClone(plan);prepared=structuredClone(prepared);receipt=structuredClone(receipt);
    const check=()=>{if(active()!==true)fail('scope_changed');};check();
    const originalCatalog={context:plan.prepare.base,catalog_digest:plan.prepare.expected_catalog_digest,entries:prepared.manifest.P};
    const verified=await validateInitialWriteManifest(scope,plan,execution,originalCatalog,{...prepared.response.metadata_header,...prepared.manifest},active);check();
    const values=await openTerminalBundle(scope,request,execution,terminalWork,password,active);check();
    exact(receipt,['schema_version','purpose','operation_id','mutation_id','server_instance_id','owner_id','local_id','result','metadata_manifest_digest','set_digests','ciphertext_manifest_digest','origin_expectations_digest','committed_at']);
    const expected=structuredClone(plan.prepare.base);expected.base.history_generation++;
    if(receipt.schema_version!==3||receipt.purpose!==plan.purpose||receipt.operation_id!==execution.execution_id||receipt.mutation_id!==plan.prepare.mutation_id
      ||receipt.owner_id!==scope.owner||receipt.local_id!==scope.local_id||receipt.server_instance_id!==scope.instance||receipt.metadata_manifest_digest!==verified.metadata_manifest_digest
      ||!same(receipt.set_digests,verified.set_digests)||!same(receipt.result,expected))fail('published_receipt');
    if(receipt.ciphertext_manifest_digest!==await Q().hashJson(terminalWork.bundle_metadata.ciphertext_manifest)||receipt.origin_expectations_digest!==await Q().hashJson(prepared.manifest.O))fail('published_receipt');check();
    const catalog=await reader.catalog(scope);check();
    if(!same(catalog.context,receipt.result)||catalog.entries.length!==prepared.manifest.P.length+prepared.manifest.DSET.length
      ||prepared.manifest.P.some(d=>!catalog.entries.some(actual=>same(actual,d))))fail('published_preserved');
    hex(catalog.catalog_digest);
    for(const output of prepared.manifest.DSET){
      const d=catalog.entries.find(d=>same(d.key,output.destination_key)),o=prepared.manifest.O.find(o=>same(o.destination_key,output.destination_key));
      if(!d||!o)fail('published_missing');Q().validateDescriptor(d,3);
      if(d.representation_kind!==output.output_kind||d.representation_epoch!==output.output_epoch||d.is_null!==output.is_null||!same(d.expected_binding,output.expected_binding)
        ||!same(pick(d,['is_null','origin_validator','origin_row_required','storage_operation_id','semantic_origin_id']),pick(o,['is_null','origin_validator','origin_row_required','storage_operation_id','semantic_origin_id']))
        ||d.linked_slot_version!==1)fail('published_origin');
      const record=terminalWork.bundle_metadata.ciphertext_manifest.find(c=>same(c.destination_key,d.key));
      if(d.ciphertext_sha256!==(output.is_null?null:record?.ciphertext_sha256))fail('published_cipher');
      const value=await reader.read(scope,catalog,d,()=>password);check();
      if(!same(value.descriptor,d)||!same(value.origin,{value:prepared.response.metadata_header.operation_origin,legacy:null}))fail('published_origin');
      if(!same(value.value,values[d.key.slot]))fail('published_meaning');
    }
    return {operation_id:execution.execution_id,metadata_manifest_digest:verified.metadata_manifest_digest,published_catalog_digest:catalog.catalog_digest,
      output_keys:prepared.manifest.DSET.map(d=>d.destination_key)};
  }
  function createExecution({context,journal,request,change=()=>{}}) {
    const P=()=>globalThis.NowNoteProtectionState;
    const publicationPhases=['analysis_write_preparing','analysis_write_prepared','analysis_write_staged','analysis_write_committing','analysis_write_committed'];
    const tickets=new WeakMap();
    let generation=0,running=false;
    const own=scope=>{
      P().validateScope(scope);const c=structuredClone(context());
      if(!c.enabled||c.owner!==scope.owner||c.device!==scope.device||c.instance!==scope.instance||String(c.url).replace(/\/+$/,'')!==scope.url.replace(/\/+$/,''))fail('scope_changed');
      return c;
    };
    const active=(scope,c,epoch)=>{const now=own(scope);if(epoch!==generation||now.auth!==c.auth)fail('scope_changed');};
    const status=id=>{
      const marker=journal.protectionOperations()[id];if(!marker)fail('operation_missing');
      P().validateMarker(marker);own(marker.scope);return structuredClone(marker);
    };
    const access=s=>({schema_version:3,owner_id:s.owner,local_id:s.local_id,device_id:s.device,server_instance_id:s.instance});
    function progress(previous,checked) {
      if(previous===null)return;
      const fixed=['execution_id','job_id','job_id_mode','source_context','source_keys','source_digest','claim_metadata_digest','output_slots'];
      if(!same(pick(checked,fixed),pick(previous,fixed))||checked.run_version<previous.run_version||checked.lease_version<previous.lease_version)fail('execution_changed');
      for(const key of ['dispatch_receipt','terminal_receipt','bundle_metadata'])if(previous[key]!==null&&!same(previous[key],checked[key]))fail('execution_changed');
    }
    const terminalCore=(scope,e,bm)=>({...access(scope),execution_id:e.execution_id,run_version:e.run_version,lease_version:e.lease_version,
      dispatch_id:e.dispatch_receipt.dispatch_id,claim_metadata_digest:e.claim_metadata_digest,provider_terminal_observed:true,outcome:bm.outcome,
      bundle_metadata:structuredClone(bm),local_checkpoint_confirmed:true,unavailable_reason:null});
    async function fresh(scope,b,c,epoch) {
      const response=await request(structuredClone(scope),'/api/v2/notes/mixed-analysis-claims/status','GET',{...access(scope),execution_id:b.execution.execution_id});active(scope,c,epoch);
      const checked=await validateExecution(scope,b.request,response);active(scope,c,epoch);progress(b.execution,checked);return checked;
    }
    function receiptMatches(e,core,work) {
      if(e.state!=='client_settled'||e.terminal_receipt===null||!same(e.bundle_metadata,work.bundle_metadata)
        ||e.terminal_receipt.outcome!==work.bundle_metadata.outcome||e.run_version!==core.run_version+1||e.lease_version!==core.lease_version)fail('terminal_receipt_changed');
      return structuredClone(e.terminal_receipt);
    }
    async function save(marker,bundle,password,c,epoch) {
      active(marker.scope,c,epoch);
      marker.cipher_bundle=await Q().encryptContent(Q().canonicalJson(bundle),password);active(marker.scope,c,epoch);
      P().validateMarker(marker);await journal.saveProtection(structuredClone(marker),{active:()=>{active(marker.scope,c,epoch);return true;}});active(marker.scope,c,epoch);
      if(!same(status(marker.id),marker))fail('marker_readback');change();
    }
    function validateRoute(route) {
      exact(route,['provider','endpoint','model']);
      for(const key of ['provider','endpoint','model'])if(typeof route[key]!=='string'||!route[key])fail('route');
    }
    async function open(marker,password,c,epoch) {
      if(!password)fail('key_required');
      const b=Q().parseJson(await Q().decryptContent(marker.cipher_bundle,password));active(marker.scope,c,epoch);
      exact(b,['schema_version','purpose','operation_id','scope','request','input','route','execution',...(Object.hasOwn(b,'dispatch')?['dispatch']:[]),...(Object.hasOwn(b,'terminal')?['terminal']:[]),...(Object.hasOwn(b,'publication')?['publication']:[])]);
      b.dispatch??=null;
      b.terminal??=null;
      b.publication??=null;
      if(b.schema_version!==1||b.purpose!=='mixed_analysis_execution'||b.operation_id!==marker.id||!same(b.scope,marker.scope)||typeof b.input!=='string')fail('bundle_binding');
      validateRequest(marker.scope,b.request);validateRoute(b.route);
      if(b.execution!==null){await validateExecution(marker.scope,b.request,b.execution);active(marker.scope,c,epoch);}
      if((marker.phase==='analysis_claiming')!==(b.execution===null))fail('bundle_phase');
      if(b.dispatch!==null){
        exact(b.dispatch,['request','handoff_reserved']);
        const d=b.dispatch.request;exact(d,[...Object.keys(access(marker.scope)),'execution_id','run_version','lease_version','source_digest','claim_metadata_digest']);
        if(!same(pick(d,Object.keys(access(marker.scope))),access(marker.scope))||d.execution_id!==b.execution?.execution_id||d.run_version!==1
          ||d.source_digest!==b.execution.source_digest||d.claim_metadata_digest!==b.execution.claim_metadata_digest||typeof b.dispatch.handoff_reserved!=='boolean')fail('dispatch_binding');
        integer(d.lease_version,1);
      }
      const published=marker.phase==='complete'&&b.publication!==null;
      const terminalPhases=['analysis_terminal','analysis_settling','analysis_settled',...publicationPhases,...(published?['complete']:[])];
      if(['analysis_dispatching','analysis_running',...terminalPhases].includes(marker.phase)&&(b.dispatch===null||b.dispatch.handoff_reserved!==(marker.phase!=='analysis_dispatching')))fail('bundle_phase');
      if(terminalPhases.includes(marker.phase)!==(b.terminal!==null))fail('bundle_phase');
      if(marker.phase==='complete'&&!published&&(b.execution?.state!=='result_unavailable'||b.execution.terminal_receipt?.outcome!=='result_unavailable'||b.execution.bundle_metadata!==null))fail('bundle_phase');
      if(b.terminal!==null){
        exact(b.terminal,['work','settle_core','receipt']);
        const values=await openTerminalBundle(marker.scope,b.request,b.execution,b.terminal.work,password,()=>{active(marker.scope,c,epoch);return true;});active(marker.scope,c,epoch);
        if(values.input_text!==b.input)fail('terminal_input_changed');
        if(b.terminal.settle_core!==null){
          const previous={...b.execution,run_version:b.execution.run_version-(b.execution.terminal_receipt===null?0:1)};
          if(!same(b.terminal.settle_core,terminalCore(marker.scope,previous,b.terminal.work.bundle_metadata)))fail('terminal_core_changed');
        }
        if((marker.phase==='analysis_terminal')!==(b.terminal.settle_core===null)||(['analysis_settled',...publicationPhases].includes(marker.phase)||published)!==(b.terminal.receipt!==null))fail('bundle_phase');
        if(b.terminal.receipt!==null&&(!same(b.terminal.receipt,b.execution.terminal_receipt)||!same(b.execution.bundle_metadata,b.terminal.work.bundle_metadata)))fail('terminal_receipt_changed');
      }
      if((publicationPhases.includes(marker.phase)||published)!==(b.publication!==null))fail('publication_phase');
      if(b.publication!==null){
        const p=b.publication;exact(p,['catalog','plan','prepared','work','receipt','proof']);
        const original=await createInitialWritePlan(marker.scope,b.request,b.execution,b.terminal.work,p.catalog,p.plan.prepare.mutation_id,password,()=>{active(marker.scope,c,epoch);return true;});active(marker.scope,c,epoch);
        if(!same(original,p.plan))fail('publication_plan_changed');
        if(marker.phase==='analysis_write_preparing'?(p.prepared!==null||p.work!==null):(p.prepared===null||p.work===null))fail('publication_phase');
        if(p.prepared!==null){
          const work=await buildInitialWriteWork(marker.scope,b.request,b.execution,b.terminal.work,p.plan,p.prepared,p.catalog,password,()=>{active(marker.scope,c,epoch);return true;});active(marker.scope,c,epoch);
          if(!same(work,p.work))fail('publication_work_changed');
          const originalExecution={reference:p.plan.prepare.execution_ref,source_schema_version:3,source_context:b.execution.source_context,terminal_receipt:b.execution.terminal_receipt,bundle_metadata:b.execution.bundle_metadata};
          if(!same(p.prepared.original_execution,originalExecution))fail('publication_execution_changed');
        }
        if((marker.phase==='analysis_write_committed'||published)!==(p.receipt!==null)||(published)!==(p.proof!==null))fail('publication_phase');
        if(p.receipt!==null){
          const expected=structuredClone(p.plan.prepare.base);expected.base.history_generation++;
          if(p.receipt.schema_version!==3||p.receipt.purpose!=='mixed_analysis_write'||p.receipt.operation_id!==b.execution.execution_id||p.receipt.mutation_id!==p.plan.prepare.mutation_id
            ||p.receipt.owner_id!==marker.scope.owner||p.receipt.local_id!==marker.scope.local_id||p.receipt.server_instance_id!==marker.scope.instance
            ||p.receipt.metadata_manifest_digest!==p.prepared.digest||p.receipt.ciphertext_manifest_digest!==p.work.commit.client_verified_ciphertext_manifest_digest||!same(p.receipt.result,expected))fail('publication_receipt_changed');
        }
        if(p.proof!==null){
          exact(p.proof,['operation_id','metadata_manifest_digest','published_catalog_digest','output_keys']);hex(p.proof.published_catalog_digest);
          if(p.proof.operation_id!==b.execution.execution_id||p.proof.metadata_manifest_digest!==p.prepared.digest||!same(p.proof.output_keys,p.prepared.manifest.DSET.map(d=>d.destination_key)))fail('publication_proof_changed');
        }
      }
      return b;
    }
    return {
      status,invalidate(){generation++;},
      consumeHandoff(handoff) {
        const ticket=tickets.get(handoff);if(!ticket)fail('handoff_unknown');
        const c=own(ticket.scope);
        if(c.auth!==ticket.auth||generation!==ticket.generation)fail('terminal_key_unavailable');
        if(ticket.providerStarted||ticket.observationStarted)fail('provider_already_started');
        if(status(ticket.operation_id).phase!=='analysis_running')fail('operation_phase');
        ticket.providerStarted=true;
      },
      async inspectExecution(id,password) {
        const marker=status(id),c=own(marker.scope),epoch=generation;
        const b=await open(marker,password,c,epoch);active(marker.scope,c,epoch);
        return structuredClone({request:b.request,input:b.input,route:b.route,execution:b.execution});
      },
      async readTerminal(id,password) {
        const marker=status(id),c=own(marker.scope),epoch=generation;
        if(!['analysis_terminal','analysis_settling','analysis_settled',...publicationPhases,'complete'].includes(marker.phase))fail('terminal_checkpoint_missing');
        const b=await open(marker,password,c,epoch);
        if(b.terminal===null)fail('terminal_checkpoint_missing');
        return openTerminalBundle(marker.scope,b.request,b.execution,b.terminal.work,password,()=>{active(marker.scope,c,epoch);return true;});
      },
      async start(scope,claim,input,route,password) {
        scope=structuredClone(scope);claim=structuredClone(claim);route=structuredClone(route);
        if(!password)fail('key_required');if(typeof input!=='string')fail('input');
        validateRequest(scope,claim);validateRoute(route);
        const c=own(scope),epoch=generation;
        if(running)fail('busy');
        for(const marker of Object.values(journal.protectionOperations())){
          if(marker?.scope?.owner!==scope.owner||String(marker?.scope?.url||'').replace(/\/+$/,'')!==scope.url.replace(/\/+$/,''))continue;
          P().validateMarker(marker);if(marker.scope.local_id===scope.local_id&&marker.phase!=='complete')fail('operation_exists');
        }
        running=true;
        try{
          const id=crypto.randomUUID(),marker={schema_version:1,id,scope,phase:'analysis_claiming',cipher_bundle:''};
          const b={schema_version:1,purpose:'mixed_analysis_execution',operation_id:id,scope:structuredClone(scope),request:claim,input,route,execution:null,dispatch:null,terminal:null};
          await save(marker,b,password,c,epoch);return id;
        }finally{running=false;}
      },
      async resumeClaim(id,password) {
        const marker=status(id),c=own(marker.scope),epoch=generation;
        if(running)fail('busy');if(!['analysis_claiming','analysis_claimed'].includes(marker.phase))fail('operation_phase');running=true;
        try{
          const b=await open(marker,password,c,epoch),path='/api/v2/notes/mixed-analysis-claims';
          const response=b.execution===null
            ?await request(structuredClone(marker.scope),path,'POST',structuredClone(b.request))
            :await request(structuredClone(marker.scope),path+'/status','GET',{schema_version:3,owner_id:marker.scope.owner,local_id:marker.scope.local_id,device_id:marker.scope.device,server_instance_id:marker.scope.instance,execution_id:b.execution.execution_id});
          active(marker.scope,c,epoch);
          const checked=await validateExecution(marker.scope,b.request,response);active(marker.scope,c,epoch);
          progress(b.execution,checked);
          b.execution=checked;marker.phase='analysis_claimed';await save(marker,b,password,c,epoch);return structuredClone(checked);
        }finally{running=false;}
      },
      async dispatch(id,password,confirmation) {
        confirmation=structuredClone(confirmation);
        const marker=status(id),c=own(marker.scope),epoch=generation;
        if(running)fail('busy');if(marker.phase==='analysis_running')fail('provider_outcome_unknown');
        if(!['analysis_claimed','analysis_dispatching'].includes(marker.phase))fail('operation_phase');running=true;
        try{
          const b=await open(marker,password,c,epoch);
          exact(confirmation,['provider','endpoint','model','input','confirmed']);
          if(confirmation.confirmed!==true||confirmation.input!==b.input||!same(pick(confirmation,['provider','endpoint','model']),b.route))fail('confirmation');
          const path='/api/v2/notes/mixed-analysis-claims';
          const observed=await request(structuredClone(marker.scope),path+'/status','GET',{...access(marker.scope),execution_id:b.execution.execution_id});active(marker.scope,c,epoch);
          const checked=await validateExecution(marker.scope,b.request,observed);active(marker.scope,c,epoch);progress(b.execution,checked);b.execution=checked;
          if(checked.dispatch_receipt!==null){
            if(marker.phase!=='analysis_dispatching')fail('provider_outcome_unknown');
            b.dispatch.handoff_reserved=true;marker.phase='analysis_running';await save(marker,b,password,c,epoch);
            return {operation_id:id,execution:structuredClone(checked),provider_state:checked.terminal_receipt===null?'unknown':'terminal'};
          }
          if(checked.state!=='client_pending'||checked.source_matches_current!==true)fail('source_changed');
          if(marker.phase==='analysis_claimed'){
            b.dispatch={request:{...access(marker.scope),execution_id:checked.execution_id,run_version:checked.run_version,lease_version:checked.lease_version,source_digest:checked.source_digest,claim_metadata_digest:checked.claim_metadata_digest},handoff_reserved:false};
            marker.phase='analysis_dispatching';await save(marker,b,password,c,epoch);
          }
          const response=await request(structuredClone(marker.scope),path+'/dispatch','POST',structuredClone(b.dispatch.request));active(marker.scope,c,epoch);
          const dispatched=await validateExecution(marker.scope,b.request,response);active(marker.scope,c,epoch);progress(b.execution,dispatched);
          if(dispatched.state!=='client_running'||dispatched.dispatch_receipt===null)fail('dispatch_unconfirmed');
          b.execution=dispatched;b.dispatch.handoff_reserved=true;marker.phase='analysis_running';await save(marker,b,password,c,epoch);
          const handoff=Object.freeze({operation_id:id,scope:Object.freeze(structuredClone(marker.scope)),execution:structuredClone(dispatched),route:Object.freeze(structuredClone(b.route)),input:b.input,provider_state:'ready'});
          tickets.set(handoff,{operation_id:id,scope:structuredClone(marker.scope),auth:c.auth,generation:epoch,request:structuredClone(b.request),execution:structuredClone(dispatched),observationStarted:false,unavailableCore:null});
          return handoff;
        }finally{running=false;}
      },
      async recoverDispatch(id,password) {
        const marker=status(id),c=own(marker.scope),epoch=generation;
        if(running)fail('busy');if(!['analysis_dispatching','analysis_running'].includes(marker.phase))fail('operation_phase');running=true;
        try{
          const b=await open(marker,password,c,epoch),observed=await fresh(marker.scope,b,c,epoch);
          if(observed.dispatch_receipt===null)return {provider_state:'not_dispatched',execution:structuredClone(observed)};
          b.execution=observed;b.dispatch.handoff_reserved=true;marker.phase='analysis_running';await save(marker,b,password,c,epoch);
          return {provider_state:observed.terminal_receipt===null?'unknown':'terminal',execution:structuredClone(observed)};
        }finally{running=false;}
      },
      async recordTerminal(handoff,observation,password) {
        const ticket=tickets.get(handoff);if(!ticket)fail('handoff_unknown');
        if(ticket.observationStarted)fail('terminal_already_recorded');
        const marker=status(ticket.operation_id),c=own(marker.scope),epoch=generation;
        if(c.auth!==ticket.auth||epoch!==ticket.generation)fail('terminal_key_unavailable');
        observation=structuredClone(observation);validateObservation(observation);
        if(running)fail('busy');if(marker.phase!=='analysis_running')fail('terminal_already_recorded');running=true;
        try{
          const b=await open(marker,password,c,epoch);progress(ticket.execution,b.execution);
          b.execution=await fresh(marker.scope,b,c,epoch);
          if(b.execution.terminal_receipt!==null)fail('terminal_already_recorded');
          ticket.observationStarted=true;
          const work=await buildTerminalBundle(marker.scope,b.request,b.execution,b.input,observation,password,()=>{active(marker.scope,c,epoch);return true;});active(marker.scope,c,epoch);
          b.terminal={work,settle_core:null,receipt:null};marker.phase='analysis_terminal';await save(marker,b,password,c,epoch);
          const readback=await open(status(marker.id),password,c,epoch);active(marker.scope,c,epoch);
          if(!same(readback.terminal.work,work))fail('terminal_checkpoint_readback');
          return {operation_id:marker.id,bundle_metadata:structuredClone(work.bundle_metadata)};
        }finally{running=false;}
      },
      async settleTerminal(id,password) {
        const marker=status(id),c=own(marker.scope),epoch=generation;
        if(running)fail('busy');if(!['analysis_terminal','analysis_settling','analysis_settled'].includes(marker.phase))fail('terminal_checkpoint_missing');running=true;
        try{
          const b=await open(marker,password,c,epoch),observed=await fresh(marker.scope,b,c,epoch);
          if(observed.terminal_receipt!==null){
            if(b.terminal.settle_core===null)fail('terminal_core_missing');
            b.terminal.receipt=receiptMatches(observed,b.terminal.settle_core,b.terminal.work);b.execution=observed;marker.phase='analysis_settled';await save(marker,b,password,c,epoch);
            return structuredClone(b.terminal.receipt);
          }
          if(!['client_running','cancel_requested'].includes(observed.state))fail('terminal_state');
          if(b.terminal.settle_core===null){
            b.execution=observed;b.terminal.settle_core=terminalCore(marker.scope,observed,b.terminal.work.bundle_metadata);marker.phase='analysis_settling';await save(marker,b,password,c,epoch);
          }else if(!same(b.terminal.settle_core,terminalCore(marker.scope,observed,b.terminal.work.bundle_metadata)))fail('terminal_version_changed');
          const response=await request(structuredClone(marker.scope),'/api/v2/notes/mixed-analysis-claims/settle','POST',structuredClone(b.terminal.settle_core));active(marker.scope,c,epoch);
          const checked=await validateExecution(marker.scope,b.request,response);active(marker.scope,c,epoch);progress(observed,checked);
          b.terminal.receipt=receiptMatches(checked,b.terminal.settle_core,b.terminal.work);b.execution=checked;marker.phase='analysis_settled';await save(marker,b,password,c,epoch);
          const readback=await open(status(marker.id),password,c,epoch);active(marker.scope,c,epoch);
          if(!same(readback.terminal.receipt,b.terminal.receipt))fail('terminal_checkpoint_readback');
          return structuredClone(b.terminal.receipt);
        }finally{running=false;}
      },
      async beginPublication(id,password,catalog) {
        catalog=structuredClone(catalog);const marker=status(id),c=own(marker.scope),epoch=generation;
        if(running)fail('busy');if(marker.phase!=='analysis_settled')fail('publication_phase');running=true;
        try{
          const b=await open(marker,password,c,epoch);
          const plan=await createInitialWritePlan(marker.scope,b.request,b.execution,b.terminal.work,catalog,crypto.randomUUID(),password,()=>{active(marker.scope,c,epoch);return true;});active(marker.scope,c,epoch);
          b.publication={catalog,plan,prepared:null,work:null,receipt:null,proof:null};marker.phase='analysis_write_preparing';await save(marker,b,password,c,epoch);
          await open(status(id),password,c,epoch);active(marker.scope,c,epoch);return id;
        }finally{running=false;}
      },
      async resumePublication(id,password) {
        const marker=status(id),c=own(marker.scope),epoch=generation;
        if(running)fail('busy');if(![...publicationPhases,'complete'].includes(marker.phase))fail('publication_phase');running=true;
        try{
          const b=await open(marker,password,c,epoch),p=b.publication;if(p===null)fail('publication_missing');
          if(marker.phase==='complete')return structuredClone(p.receipt);
          const guarded=async(...args)=>{active(marker.scope,c,epoch);const value=await request(...args);active(marker.scope,c,epoch);return value;};
          const remote=P().createRemote({request:guarded}),reader=globalThis.NowNoteProtectionClient.createReader({request:guarded});
          const persist=()=>save(marker,b,password,c,epoch),accept=async r=>{
            if(r.state!=='committed'||r.receipt_matches_current!==true||r.receipt?.operation_id!==p.prepared.id)fail('publication_commit_unconfirmed');
            p.receipt=structuredClone(r.receipt);marker.phase='analysis_write_committed';await persist();
          };
          if(marker.phase==='analysis_write_preparing'){
            p.prepared=await remote.prepareAnalysis(marker.scope,p.plan,b.execution,p.catalog);active(marker.scope,c,epoch);
            p.work=await buildInitialWriteWork(marker.scope,b.request,b.execution,b.terminal.work,p.plan,p.prepared,p.catalog,password,()=>{active(marker.scope,c,epoch);return true;});active(marker.scope,c,epoch);
            marker.phase='analysis_write_prepared';await persist();
          }
          if(marker.phase==='analysis_write_prepared'){
            const r=await remote.status(marker.scope,p.prepared,p.work);active(marker.scope,c,epoch);
            if(r.state==='committed')await accept(r);
            else{
              if(!['prepared','uploading','ready'].includes(r.state)||r.lease_version!==p.work.commit.lease_version)fail('publication_remote_not_committable');
              await remote.stage(marker.scope,p.prepared,p.work,password);active(marker.scope,c,epoch);marker.phase='analysis_write_staged';await persist();
            }
          }
          if(marker.phase==='analysis_write_staged'){marker.phase='analysis_write_committing';await persist();}
          if(marker.phase==='analysis_write_committing'){
            let r=await remote.status(marker.scope,p.prepared,p.work);active(marker.scope,c,epoch);
            if(r.state!=='committed'){
              if(!['prepared','uploading','ready'].includes(r.state)||r.lease_version!==p.work.commit.lease_version)fail('publication_remote_not_committable');
              r=await remote.commit(marker.scope,p.prepared,p.work);active(marker.scope,c,epoch);
            }
            await accept(r);
          }
          if(marker.phase==='analysis_write_committed'){
            const r=await remote.status(marker.scope,p.prepared,p.work);active(marker.scope,c,epoch);
            if(r.state!=='committed'||r.receipt_matches_current!==true||!same(r.receipt,p.receipt))fail('publication_receipt_changed');
            p.proof=await verifyInitialPublication(marker.scope,b.request,b.execution,b.terminal.work,p.plan,p.prepared,p.receipt,reader,password,()=>{active(marker.scope,c,epoch);return true;});active(marker.scope,c,epoch);
            marker.phase='complete';await persist();
          }
          const checked=await open(status(id),password,c,epoch);active(marker.scope,c,epoch);
          if(marker.phase!=='complete'||!same(checked.publication.receipt,p.receipt))fail('publication_checkpoint_readback');return structuredClone(p.receipt);
        }finally{running=false;}
      },
      async reconcileUnavailable(id,password) {
        const marker=status(id),c=own(marker.scope),epoch=generation;
        if(running)fail('busy');if(!['analysis_running','complete'].includes(marker.phase))fail('operation_phase');running=true;
        try{
          const b=await open(marker,password,c,epoch),observed=await fresh(marker.scope,b,c,epoch);
          if(observed.state!=='result_unavailable'||observed.terminal_receipt?.outcome!=='result_unavailable'||observed.bundle_metadata!==null||observed.dispatch_receipt===null)fail('unavailable_receipt_missing');
          b.execution=observed;marker.phase='complete';await save(marker,b,password,c,epoch);
          const readback=await open(status(marker.id),password,c,epoch);active(marker.scope,c,epoch);
          if(!same(readback.execution,observed))fail('terminal_checkpoint_readback');
          return structuredClone(observed.terminal_receipt);
        }finally{running=false;}
      },
      async reportUnavailable(handoff,observation) {
        const ticket=tickets.get(handoff);if(!ticket)fail('handoff_unknown');
        observation=structuredClone(observation);exact(observation,['provider_terminal_observed','unavailable_reason']);
        if(observation.provider_terminal_observed!==true)fail('terminal_unobserved');
        if(!['key_unavailable','cipher_store_failed','response_lost'].includes(observation.unavailable_reason))fail('unavailable_reason');
        const c=own(ticket.scope),epoch=generation;
        if(c.auth!==ticket.auth)fail('scope_changed');
        if(ticket.unavailableCore!==null&&ticket.unavailableCore.unavailable_reason!==observation.unavailable_reason)fail('terminal_core_changed');
        if(running)fail('busy');running=true;
        try{
          const b={request:ticket.request,execution:ticket.execution},observed=await fresh(ticket.scope,b,c,epoch);
          const matches=(e,core)=>{
            if(e.state!=='result_unavailable'||e.bundle_metadata!==null||e.terminal_receipt?.outcome!=='result_unavailable'
              ||e.run_version!==core.run_version+1||e.lease_version!==core.lease_version)fail('terminal_receipt_changed');
            return structuredClone(e.terminal_receipt);
          };
          if(observed.terminal_receipt!==null){
            if(ticket.unavailableCore!==null)matches(observed,ticket.unavailableCore);
            ticket.execution=observed;return structuredClone(observed.terminal_receipt);
          }
          if(!['client_running','cancel_requested'].includes(observed.state)||observed.dispatch_receipt===null)fail('terminal_state');
          const core={...access(ticket.scope),execution_id:observed.execution_id,run_version:observed.run_version,lease_version:observed.lease_version,
            dispatch_id:observed.dispatch_receipt.dispatch_id,claim_metadata_digest:observed.claim_metadata_digest,provider_terminal_observed:true,
            outcome:'result_unavailable',bundle_metadata:null,local_checkpoint_confirmed:false,unavailable_reason:observation.unavailable_reason};
          if(ticket.unavailableCore===null)ticket.unavailableCore=Object.freeze(structuredClone(core));
          else if(!same(ticket.unavailableCore,core))fail('terminal_version_changed');
          ticket.execution=observed;
          const response=await request(structuredClone(ticket.scope),'/api/v2/notes/mixed-analysis-claims/settle','POST',structuredClone(ticket.unavailableCore));active(ticket.scope,c,epoch);
          const checked=await validateExecution(ticket.scope,ticket.request,response);active(ticket.scope,c,epoch);progress(observed,checked);
          const receipt=matches(checked,ticket.unavailableCore);ticket.execution=checked;return receipt;
        }finally{running=false;}
      },
    };
  }
  globalThis.NowNoteProtectionAnalysis=Object.freeze({validateRequest,validateExecution,validateBundle,buildTerminalBundle,openTerminalBundle,createInitialWritePlan,createReplanWritePlan,validateReplanWritePlan,validateInitialWriteManifest,validateReplanWriteManifest,validateStoredAnalysisResult,buildReplanWriteWork,verifyReplanWriteWork,buildInitialWriteWork,verifyInitialPublication,createExecution});
})();
