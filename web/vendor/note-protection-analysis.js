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
  function createExecution({context,journal,request,change=()=>{}}) {
    const P=()=>globalThis.NowNoteProtectionState;
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
      exact(b,['schema_version','purpose','operation_id','scope','request','input','route','execution']);
      if(b.schema_version!==1||b.purpose!=='mixed_analysis_execution'||b.operation_id!==marker.id||!same(b.scope,marker.scope)||typeof b.input!=='string')fail('bundle_binding');
      validateRequest(marker.scope,b.request);validateRoute(b.route);
      if(b.execution!==null){await validateExecution(marker.scope,b.request,b.execution);active(marker.scope,c,epoch);}
      if((marker.phase==='analysis_claiming')!==(b.execution===null))fail('bundle_phase');
      return b;
    }
    return {
      status,invalidate(){generation++;},
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
          const b={schema_version:1,purpose:'mixed_analysis_execution',operation_id:id,scope:structuredClone(scope),request:claim,input,route,execution:null};
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
          if(b.execution!==null){
            const fixed=['execution_id','job_id','job_id_mode','source_context','source_keys','source_digest','claim_metadata_digest','output_slots'];
            if(!same(pick(checked,fixed),pick(b.execution,fixed))||checked.run_version<b.execution.run_version||checked.lease_version<b.execution.lease_version)fail('execution_changed');
          }
          b.execution=checked;marker.phase='analysis_claimed';await save(marker,b,password,c,epoch);return structuredClone(checked);
        }finally{running=false;}
      },
    };
  }
  globalThis.NowNoteProtectionAnalysis=Object.freeze({validateRequest,validateExecution,validateBundle,createExecution});
})();
