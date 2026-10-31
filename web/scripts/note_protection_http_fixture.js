(async()=>{
  const config=globalThis.__HTTP_QA__,a=config.credentials.a,b=config.credentials.b,run=config.run;
  const target='qa-http-'+run+'-target',other='qa-http-'+run+'-other',plain='HTTP-QA-ORIGINAL-'+run+'\r\n',password='qa-protection-'+run;
  const assert=(v,code)=>{if(!v)throw Error(code);},wait=()=>new Promise(r=>setTimeout(r,15));
  const emit=event=>console.log('HTTP_QA_EVENT '+JSON.stringify(event));
  const url=config.mode==='web'&&config.phase!==24?'http://localhost.:8750':'http://127.0.0.1:8750';
  async function request(path,method='GET',body,headers) {
    let response;
    try{response=await fetch(url+path,{method,cache:'no-store',headers:{Authorization:'Bearer '+config.apiToken,...(headers||noteHistoryContext().headers),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});}
    catch(error){emit({stage:'transport_uncertain_'+path.split('?')[0].split('/').at(-1),owner:a?.owner,local_id:target,code:/^[A-Za-z]+$/.test(error.name)?error.name:'network_error'});throw Error('transport_uncertain');}
    if(!response.ok)throw Error('http_'+response.status+'_'+path.split('/').at(-1));
    return response.json();
  }
  async function login(account) {
    if(isHostedWebClient()) {
      elements.webLoginOwnerInput.value=account.owner;elements.webLoginPasswordInput.value=account.password;
      await handleWebLoginSubmit({preventDefault(){}});
      assert(loadWebSession()?.ownerId===account.owner&&noteHistoryAuthenticated,'web_auth_failed');
      assert(elements.webLoginView.classList.contains('hidden'),'web_login_screen_not_completed');
      elements.webLoginPasswordInput.value='';
    } else {
      const issued=await request('/api/v1/auth/client-login','POST',{owner_id:account.owner,password:account.password,device_id:account.device,device_name:'HTTP QA'} ,{});
      state.settings.server=normalizeServerSettings({...state.settings.server,mode:'server',url,ownerId:account.owner,deviceId:account.device,userToken:issued.access_token,autoSync:false});
      await noteHistoryController.resume();
    }
    state.settings.server.autoSync=false;
    assert(noteHistoryContext().enabled&&noteHistoryContext().owner===account.owner,'auth_context_failed');
  }
  const ready=await request('/health/ready','GET',undefined,{'Content-Type':'application/json'});
  assert(ready.status==='ready','renderer_route_not_ready');
  if(config.probe){
    const textarea=document.createElement('textarea');textarea.value='QA\r\n';
    assert(textarea.value==='QA\n','textarea_newline_contract_changed');
    return {ok:true,mode:config.mode,phase:config.phase,readOnlyProbe:true,textareaCRLFNormalizesToLF:true};
  }
  await login(a);
  const settle=async()=>{await noteHistoryCaptureChain;for(const t of noteHistoryTimers.values())clearTimeout(t);noteHistoryTimers.clear();clearTimeout(serverSyncTimer);await Promise.all([...storagePendingWrites]);};
  await settle();noteProtectionInternalEnabled=true;
  const query=(local,extra={})=>new URLSearchParams({owner_id:a.owner,local_id:local,device_id:a.device,...extra});
  async function identity(){return request('/api/v2/notes/crypto-transitions/status?'+query(target));}
  const dialog=()=>document.querySelector('#noteProtectionDialog'),button=name=>dialog().querySelector('[data-action="'+name+'"]'),status=()=>dialog().querySelector('.protection-status').textContent;
  let keyPrompts=0;
  async function drive(done,label,key=password) {
    for(let i=0;i<2500;i++) {
      const form=dialog()?.querySelector('form.library-confirm');
      if(form){keyPrompts++;form.querySelector('input').value=key;form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));}
      if(done()&&!button('refresh').disabled)return;
      if(!button('refresh').disabled&&!form&&/note_protection:|note_protection_client:|note_protection_analysis:|HTTP |http_/.test(status())) {
        const raw=status(),code=/^note_protection(?:_client|_analysis)?:[a-z_]+(?::[a-z0-9_/:.-]+)?$/.test(raw)?raw:'ui_http_failure';
        emit({stage:label,owner:a.owner,local_id:target,code});throw Error('ui_action_failed_'+label);
      }
      await wait();
    }
    emit({stage:label,owner:a.owner,local_id:target,code:'ui_timeout_uncertain'});throw Error('ui_timeout_uncertain');
  }
  async function open(){await openNoteProtection();assert(dialog()?.open,'protection_dialog_absent');await settle();}
  async function action(name,done,key=password){button(name).click();await drive(done,name,key);await settle();}
  if([38,39].includes(config.phase)){
    state.selectedTreeId=target;render();await settle();await open();
    const Q=NowNoteProtectionProtocol,same=(l,r)=>Q.canonicalJson(l)===Q.canonicalJson(r);
    const initial=await inspectNoteProtection(),currentD=initial.catalog.entries.find(d=>d.key.kind==='inventory_snapshot'&&d.key.id===String(initial.catalog.context.selected_physical_note_id));
    const original=await noteProtectionReader.read(initial.scope,initial.catalog,currentD,async()=>password);
    assert(original.value.note.content==='HTTP-QA-RELATED-CURRENT-'+run+'\n','backup_original_current');
    if(config.phase===39){
      assert(initial.catalog.context.current_mode==='plain','backup_cold_mode_changed');
      const historyD=initial.catalog.entries.find(d=>d.key.kind==='revision_snapshot'&&d.representation_epoch>0&&!d.is_null);
      assert(historyD,'backup_cold_protected_history_missing');
      await noteProtectionReader.read(initial.scope,initial.catalog,historyD,async()=>password);
      const saved=noteHistory.export(),local=saved.contexts[NowNoteHistory.key(initial.scope)].notes[target];
      assert(NowNoteProtectionState.protectedRecord(local),'backup_cold_cipher_journal_missing');
      assert(saved.recovery_archives.some(a=>NowNoteProtectionState.protectedRecord(a.contexts?.[NowNoteHistory.key(initial.scope)]?.notes?.[target])),'backup_cold_original_archive_missing');
      for(const store of protectionStorageAdapters())assert(!JSON.stringify(await store.read()).includes('HTTP-QA-RELATED-CURRENT-'+run),'backup_cold_plaintext_store');
      button('lock').click();return {ok:true,mode:config.mode,phase:39,coldCipherJournal:true,plainCurrentAndCipherHistory:true,originalCurrent:true,providerCalls:0};
    }
    const sourceDownload=downloadText,sourceNotice=showNotice;let backup,downloads=0,notices=[],confirmations=0;
    downloadText=(name,text,mime)=>{assert(mime==='application/json','backup_download_type');downloads++;backup=JSON.parse(text);};
    showNotice=(message,type)=>{notices.push({message,type});return sourceNotice(message,type);};
    const input=elements.importInput;
    async function importFile(value,expectedConfirm){
      const transfer=new DataTransfer();transfer.items.add(new File([JSON.stringify(value)],'synthetic-backup.json',{type:'application/json'}));
      input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
      let confirmed=false;
      for(let i=0;i<2500;i++){
        if(!elements.confirmDialog.classList.contains('hidden')){
          confirmations++;assert(expectedConfirm&&!confirmed,'backup_unexpected_confirmation');confirmed=true;elements.confirmOkBtn.click();
        }
        if(input.value===''){await settle();assert(confirmed===expectedConfirm,'backup_confirmation_missing');return;}
        await wait();
      }
      throw Error('backup_file_reader_timeout');
    }
    try{
      downloadCurrentBackup('qa-protected');const protectedBackup=structuredClone(backup);
      assert(protectedBackup.history&&downloads===1&&!JSON.stringify(protectedBackup).includes('HTTP-QA-RELATED-CURRENT-'+run),'backup_cipher_export_missing');
      const bad=structuredClone(protectedBackup),record={raw:structuredClone(original.value.note),draft:structuredClone(original.value.note),base:{inventory_revision_ids:[]},revisions:[],outbox:[],receipts:[]};
      bad.history.contexts[NowNoteHistory.key(initial.scope)].notes[target]=record;
      const beforeData=Q.canonicalJson(state.data),beforeHistory=Q.canonicalJson(noteHistory.export());
      await importFile(bad,false);
      assert(downloads===1&&confirmations===0&&Q.canonicalJson(state.data)===beforeData&&Q.canonicalJson(noteHistory.export())===beforeHistory,'backup_plain_rejection_changed_original');
      assert(notices.some(n=>n.type==='error'&&n.message.includes('보호된 메모')),'backup_guard_notice_missing');
      globalThis.__HTTP_CAPTURE_DONE__=undefined;emit({stage:'backup_restore_ready',owner:a.owner,local_id:target});
      for(let i=0;i<100&&!globalThis.__HTTP_CAPTURE_DONE__;i++)await new Promise(r=>setTimeout(r,50));assert(globalThis.__HTTP_CAPTURE_DONE__===true,'backup_capture_failed');
      notices=[];await importFile(protectedBackup,true);
      assert(notices.some(n=>n.type==='success'),'backup_cipher_restore_failed');
      const restored=noteHistory.export().contexts[NowNoteHistory.key(initial.scope)].notes[target];
      assert(same(restored.protection_record,protectedBackup.history.contexts[NowNoteHistory.key(initial.scope)].notes[target].protection_record),'backup_cipher_restore_reencrypted');
      state.selectedTreeId=target;render();await settle();await open();
      const count=Object.keys(noteHistory.protectionOperations()).length;
      await action('current_plain_transition',()=>Object.keys(noteHistory.protectionOperations()).length===count+1&&Object.values(noteHistory.protectionOperations()).every(m=>m.phase==='complete'));
      const plainMode=await inspectNoteProtection();assert(plainMode.catalog.context.current_mode==='plain','backup_CP_failed');
      downloadCurrentBackup('qa-mixed');const mixedBackup=structuredClone(backup);
      notices=[];await importFile(mixedBackup,true);assert(notices.some(n=>n.type==='success'),'backup_mixed_restore_failed');
      state.selectedTreeId=target;render();await settle();await open();
      const after=await inspectNoteProtection();assert(same(after.catalog.context,plainMode.catalog.context),'backup_restore_changed_server');
      for(const store of protectionStorageAdapters())assert(!JSON.stringify(await store.read()).includes('HTTP-QA-RELATED-CURRENT-'+run),'backup_restore_plaintext_store');
      emit({stage:'backup_restored',owner:a.owner,local_id:target});
      button('lock').click();return {ok:true,mode:config.mode,phase:38,actualFileReader:true,plainBackupRejected:true,originalPreserved:true,cipherRestore:true,mixedRestore:true,serverUnchanged:true,providerCalls:0};
    }finally{downloadText=sourceDownload;showNotice=sourceNotice;}
  }
  if([34,35,36,37].includes(config.phase)){
    const Q=NowNoteProtectionProtocol,same=(l,r)=>Q.canonicalJson(l)===Q.canonicalJson(r),expected='HTTP-QA-RESULT-'+run;
    if(config.phase===37){
      assert(!findTreeNode(state.data.tree,target),'approve_absent_inherited_current');
      await openNoteProtection({discover:true});await settle();
      const targets=dialog().querySelector('[name="target"]');assert([...targets.options].some(o=>o.value===target),'approve_absent_target_missing');targets.value=target;targets.dispatchEvent(new Event('change',{bubbles:true}));
      await drive(()=>dialog().querySelector('.protection-scope').textContent.includes(target)&&status().includes('전환 준비 가능'),'approve_absent_target');
      await action('conversion',()=>Object.values(noteHistory.protectionOperations()).some(m=>m.scope.local_id===target&&m.phase==='complete'));
    }else{state.selectedTreeId=target;render();await settle();await open();}
    const initial=await inspectNoteProtection();if(config.phase===35&&!initial.catalog)initial.catalog=await noteProtectionReader.catalog(initial.scope);
    const resultD=initial.catalog.entries.find(d=>d.key.kind==='analysis_result'&&!d.is_null);assert(resultD,'apply_original_result_missing');
    const source=await noteProtectionReader.read(initial.scope,initial.catalog,resultD,async()=>password);assert(extractServerAnalysisResultText(source.value)===expected,'apply_original_result_value');
    const ownWrites=async()=>{const result=[];for(const marker of Object.values(noteHistory.protectionOperations()).filter(m=>m.scope.local_id===target)){const bundle=Q.parseJson(await Q.decryptContent(marker.cipher_bundle,password));if(bundle.intent?.purpose==='mixed_note_write')result.push({marker,bundle});}return result;};
    if(config.phase===35){
      const pending=(await ownWrites()).filter(r=>r.marker.phase==='committing');assert(pending.length===1,'apply_cold_original_missing');const saved=pending[0],original=noteProtectionRemote.commit;let commits=0;
      noteProtectionRemote.commit=async()=>{commits++;throw Error('duplicate_apply_commit_blocked');};
      try{await action('resume',()=>Object.values(noteHistory.protectionOperations()).every(m=>m.phase==='complete'));}finally{noteProtectionRemote.commit=original;}
      const restored=(await ownWrites()).find(r=>r.marker.id===saved.marker.id);assert(restored.marker.phase==='complete'&&commits===0&&same(restored.bundle.work.transfers,saved.bundle.work.transfers),'apply_cold_cipher_changed');
      const after=await inspectNoteProtection(),inventory=after.catalog.entries.find(d=>d.key.kind==='inventory_snapshot'&&d.key.id===String(after.catalog.context.selected_physical_note_id));
      const note=(await noteProtectionReader.read(after.scope,after.catalog,inventory,async()=>password)).value.note;
      assert(note.content.startsWith('HTTP-QA-RELATED-CURRENT-'+run+'\n')&&note.content.split(expected).length===2,'apply_cold_duplicate_or_current_changed');
      for(const d of saved.bundle.prepared.manifest.P)assert(after.catalog.entries.some(row=>same(row,d)),'apply_cold_preserved_changed');
      emit({stage:'analysis_apply_cold_complete',owner:a.owner,local_id:target,operation_id:restored.bundle.prepared.id,local_operation_id:restored.marker.id});
      return {ok:true,mode:config.mode,phase:35,coldOriginalMw:true,originalCipherPreserved:true,duplicateCommit:commits,sourceResultPreserved:true,providerCalls:0};
    }
    const select=dialog().querySelector('[name="representation"]');select.value=String(initial.rows.findIndex(r=>r.kind==='typed'&&same(r.descriptor,resultD)));select.dispatchEvent(new Event('change'));
    if(config.phase===34){
      await action('read',()=>dialog().querySelector('.protection-plain').textContent.includes(expected));
      globalThis.__HTTP_CAPTURE_DONE__=undefined;emit({stage:'analysis_apply_ready',owner:a.owner,local_id:target});
      for(let i=0;i<100&&!globalThis.__HTTP_CAPTURE_DONE__;i++)await new Promise(r=>setTimeout(r,50));assert(globalThis.__HTTP_CAPTURE_DONE__===true,'analysis_apply_capture_failed');
      const original=noteProtectionRemote.commit;let commits=0;
      noteProtectionRemote.commit=async(s,p,w)=>{const result=await original(s,p,w);if(p.response.purpose==='mixed_note_write'){commits++;throw Error('qa_analysis_apply_commit_response_lost');}return result;};
      try{await action('analysis-append',()=>Object.values(noteHistory.protectionOperations()).some(m=>m.scope.local_id===target&&m.phase==='committing'));}finally{noteProtectionRemote.commit=original;}
      const pending=(await ownWrites()).filter(r=>r.marker.phase==='committing');assert(pending.length===1&&commits===1&&pending[0].bundle.work.after.note.content.includes(expected),'apply_original_mw_checkpoint');
      for(const store of protectionStorageAdapters()){const raw=JSON.stringify(await store.read());assert(!raw.includes(expected)&&!raw.includes('HTTP-QA-RELATED-CURRENT-'+run),'apply_plaintext_store');}
      emit({stage:'analysis_apply_response_lost',owner:a.owner,local_id:target,operation_id:pending[0].bundle.prepared.id,local_operation_id:pending[0].marker.id});
      button('lock').click();return {ok:true,mode:config.mode,phase:34,typedAppend:true,originalResultPreserved:true,mwCommitResponseLost:true,providerCalls:0};
    }
    if(config.phase===37)assert(!initial.catalog.context.base.current_exists&&button('analysis-append').disabled&&!button('analysis-approve').disabled,'approve_absent_wrong_controls');
    await action('analysis-approve',()=>Object.values(noteHistory.protectionOperations()).every(m=>m.phase==='complete')&&!dialog().querySelector('form.library-confirm'));
    const after=await inspectNoteProtection(),inventory=after.catalog.entries.find(d=>d.key.kind==='inventory_snapshot'&&d.key.id===String(after.catalog.context.selected_physical_note_id));
    const note=(await noteProtectionReader.read(after.scope,after.catalog,inventory,async()=>password)).value.note;
    assert(note.content.split(expected).length===(config.phase===37?2:3),'approval_not_applied_once');
    for(const old of initial.catalog.entries.filter(d=>['analysis_input','analysis_result','analysis_error','recording_transcript'].includes(d.key.kind)))assert(after.catalog.entries.some(d=>same(d,old)),'approval_changed_linked_original');
    assert((await noteProtectionReader.read(after.scope,after.catalog,resultD,async()=>password)).value===source.value,'approval_rewrote_original_result');
    for(const store of protectionStorageAdapters()){const raw=JSON.stringify(await store.read());assert(!raw.includes(expected),'approval_plaintext_store');}
    button('lock').click();return {ok:true,mode:config.mode,phase:config.phase,typedApproval:true,createdAbsent:config.phase===37,originalResultAndLinkedPreserved:true,providerCalls:0};
  }
  if([31,32,33].includes(config.phase)){
    state.selectedTreeId=target;render();await settle();await open();
    const Q=NowNoteProtectionProtocol,same=(l,r)=>Q.canonicalJson(l)===Q.canonicalJson(r),replacement='HTTP-QA-MT-'+run+'\n';
    const initial=await inspectNoteProtection();
    if(config.phase===32&&!initial.catalog)initial.catalog=await noteProtectionReader.catalog(initial.scope);
    const d=initial.catalog.entries.find(d=>d.key.kind==='recording_transcript');
    assert(d,'transcript_descriptor_missing');
    if(config.phase!==32){const select=dialog().querySelector('[name="representation"]');select.value=String(initial.rows.findIndex(r=>r.kind==='typed'&&same(r.descriptor.key,d.key)));select.dispatchEvent(new Event('change'));}
    const ownMarkers=async()=>{const result=[];for(const marker of Object.values(noteHistory.protectionOperations()).filter(m=>m.scope.local_id===target)){const bundle=Q.parseJson(await Q.decryptContent(marker.cipher_bundle,password));if(bundle.intent?.purpose==='mixed_transcript_write')result.push({marker,bundle});}return result;};
    if(config.phase===31){
      assert((await ownMarkers()).length===0,'transcript_inherited_operation');
      await action('transcript-edit',()=>!dialog().querySelector('.protection-transcript').classList.contains('hidden'));
      const editor=dialog().querySelector('.protection-transcript-draft');assert(editor.value==='HTTP-QA-TRANSCRIPT-'+run+'\n','transcript_original_meaning');
      editor.value=replacement;editor.dispatchEvent(new Event('input',{bubbles:true}));
      globalThis.__HTTP_CAPTURE_DONE__=undefined;emit({stage:'transcript_ready',owner:a.owner,local_id:target});
      for(let i=0;i<100&&!globalThis.__HTTP_CAPTURE_DONE__;i++)await new Promise(r=>setTimeout(r,50));assert(globalThis.__HTTP_CAPTURE_DONE__===true,'transcript_capture_failed');
      const original=noteProtectionRemote.commit;let commits=0,lost=false;
      noteProtectionRemote.commit=async(s,p,w)=>{const result=await original(s,p,w);if(p.response.purpose==='mixed_transcript_write'){commits++;lost=true;throw Error('qa_transcript_commit_response_lost');}return result;};
      try{await action('transcript-save',()=>Object.values(noteHistory.protectionOperations()).some(m=>m.scope.local_id===target&&m.phase==='committing'));}finally{noteProtectionRemote.commit=original;}
      const rows=await ownMarkers();assert(rows.length===1&&rows[0].marker.phase==='committing'&&commits===1&&lost,'transcript_lost_receipt_not_retained');
      const b=rows[0].bundle;assert(b.work.transcript===replacement&&b.work.transfers.length===1&&b.prepared.manifest.P.every(old=>!same(old.key,d.key)),'transcript_cipher_checkpoint');
      emit({stage:'transcript_commit_response_lost',owner:a.owner,local_id:target,operation_id:b.prepared.id,local_operation_id:rows[0].marker.id});
      for(const store of protectionStorageAdapters()){const raw=JSON.stringify(await store.read());assert(!raw.includes('HTTP-QA-MT-'+run)&&!raw.includes('HTTP-QA-TRANSCRIPT-'+run),'transcript_plaintext_store');}
      button('lock').click();return {ok:true,mode:config.mode,phase:31,typedTranscriptEdit:true,cipherCheckpoint:true,commitResponseLost:true,providerCalls:0};
    }
    if(config.phase===32){
      const rows=await ownMarkers();assert(rows.length===1&&rows[0].marker.phase==='committing','transcript_cold_marker');
      const saved=rows[0],raw=saved.bundle.work.transfers[0].raw,original=noteProtectionRemote.commit;let commits=0;
      noteProtectionRemote.commit=async()=>{commits++;throw Error('duplicate_transcript_commit_blocked');};
      try{await action('resume',()=>Object.values(noteHistory.protectionOperations()).every(m=>m.phase==='complete'));}finally{noteProtectionRemote.commit=original;}
      const current=(await ownMarkers())[0];assert(current.marker.phase==='complete'&&current.bundle.work.transfers[0].raw===raw&&current.bundle.work.local.verified===true&&commits===0,'transcript_cold_cipher_or_proof_changed');
      const after=await inspectNoteProtection();assert(same(after.catalog.context,current.bundle.receipt.result),'transcript_cold_context');
      for(const preserved of saved.bundle.prepared.manifest.P)assert(after.catalog.entries.some(d=>same(d,preserved)),'transcript_cold_preserved_changed');
      const actual=after.catalog.entries.find(x=>same(x.key,d.key));assert((await noteProtectionReader.read(after.scope,after.catalog,actual,async()=>password)).value===replacement,'transcript_cold_value');
      emit({stage:'transcript_cold_complete',owner:a.owner,local_id:target,operation_id:current.bundle.prepared.id,local_operation_id:current.marker.id});
      return {ok:true,mode:config.mode,phase:32,coldTypedProof:true,originalCipherPreserved:true,duplicateCommit:commits,providerCalls:0};
    }
    await action('transcript-edit',()=>!dialog().querySelector('.protection-transcript').classList.contains('hidden'));
    assert(dialog().querySelector('.protection-transcript-draft').value===replacement,'transcript_null_prior_value');
    const nullBox=dialog().querySelector('[name="transcript-null"]');nullBox.checked=true;nullBox.dispatchEvent(new Event('change'));
    const originalStage=noteProtectionRemote.stage;let staged=0;
    noteProtectionRemote.stage=async(s,p,w,...rest)=>{if(p.response.purpose==='mixed_transcript_write'){assert(w.transfers.length===0&&w.transcript===null,'transcript_null_uploaded');staged++;}return originalStage(s,p,w,...rest);};
    try{await action('transcript-save',()=>!dialog().querySelector('.protection-transcript-draft').value&&Object.values(noteHistory.protectionOperations()).every(m=>m.phase==='complete'));}finally{noteProtectionRemote.stage=originalStage;}
    const after=await inspectNoteProtection(),nullD=after.catalog.entries.find(x=>same(x.key,d.key));
    assert(staged===1&&nullD.is_null&&nullD.linked_slot_version===d.linked_slot_version+1,'transcript_null_slot');
    assert((await noteProtectionReader.read(after.scope,after.catalog,nullD,async()=>password)).value===null,'transcript_null_typed_value');
    for(const old of initial.catalog.entries.filter(x=>!same(x.key,d.key)))assert(after.catalog.entries.some(x=>same(x,old)),'transcript_null_preserved_changed');
    assert(after.catalog.context.base.head_version===initial.catalog.context.base.head_version&&after.catalog.context.base.history_generation===initial.catalog.context.base.history_generation+1,'transcript_null_head_changed');
    for(const store of protectionStorageAdapters()){const raw=JSON.stringify(await store.read());assert(!raw.includes('HTTP-QA-MT-'+run)&&!raw.includes('HTTP-QA-TRANSCRIPT-'+run),'transcript_plaintext_store');}
    button('lock').click();return {ok:true,mode:config.mode,phase:33,explicitNull:true,noCipherUpload:true,currentAndOthersPreserved:true,providerCalls:0};
  }
  if([26,29].includes(config.phase)){
    state.selectedTreeId=target;render();await settle();await open();
    await action('resume',()=>Object.values(noteHistory.protectionOperations()).every(m=>m.phase==='complete'));
    const info=await inspectNoteProtection(),scope=info.scope,Q=NowNoteProtectionProtocol,A=NowNoteProtectionAnalysis,baseKeys=['head_version','head_revision_id','crypto_epoch','history_generation','protection_state','inventory_revision_ids','identity_state','current_exists'];
    const identityState=await identity(),page=await request('/api/v2/notes/representations?'+query(target,{representation_schema:2,limit:500}));
    assert(!page.next_cursor,'legacy_fixture_catalog_not_bounded');
    await Q.verifyCatalog([page],{schema_version:2,server_instance_id:scope.instance,owner_id:scope.owner,local_id:scope.local_id,device_id:scope.device,context:page.context,catalog_digest:page.catalog_digest});
    const bodies=page.items.filter(d=>d.key.kind==='note_body');assert(bodies.length===1&&!bodies[0].is_null,'legacy_fixture_source_not_unique');const d=bodies[0];
    const sourceContext={server_instance_id:scope.instance,base:Object.fromEntries(baseKeys.map(k=>[k,identityState[k]])),catalog_digest:page.catalog_digest};
    const nativeScope={schema_version:1,owner_id:scope.owner,local_id:scope.local_id,device_id:scope.device,server_instance_id:scope.instance};
    const claim={...nativeScope,mutation_id:crypto.randomUUID(),source_context:sourceContext,source_keys:[{key:d.key,representation_etag:d.representation_etag,slot_version:d.slot_version??null,ciphertext_sha256:d.ciphertext_sha256,is_null:d.is_null}],job_type:'memo_summary',prompt_version:'single_source_v1',source_job_id:null,execution_route:'client_provider',client_execution_confirmed:true};
    const prefix='/api/v2/notes/protected-analysis',claimed=await request(prefix+'/claims','POST',claim);
    const dispatch={...nativeScope,execution_id:claimed.execution_id,run_version:claimed.run_version,lease_version:claimed.lease_version,source_digest:claimed.source_digest};
    const dispatched=await request(prefix+'/claims/dispatch','POST',dispatch),input='SYNTHETIC-LLM-INPUT-'+run+'\n'+plain;
    const provider=await fetch(config.syntheticProviderUrl+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer synthetic-only','Content-Type':'application/json'},body:JSON.stringify({model:'auto',stream:false,messages:[{role:'user',content:input}]}),signal:AbortSignal.timeout(20000)});
    assert(provider.ok,'legacy_synthetic_provider_failed');const answer=(await provider.json()).choices[0].message.content;assert(answer==='SYNTHETIC-LLM-RESULT-'+run+'\r\n','legacy_provider_value');
    const values={input_text:input,result_json:JSON.stringify({summary:answer}),error_message:null},transfers=[],records=[],nulls=[];
    for(const slot of dispatched.output_slots){const value=values[slot.key.slot];nulls.push({key:slot.key,is_null:value===null});if(value===null)continue;
      const raw=await Q.encryptRepresentation(value,{key:slot.key,output_kind:'linked_text_envelope_v1',output_epoch:1,is_null:false,expected_binding:slot.expected_binding,operation_origin:null},password);
      transfers.push({key:slot.key,raw});records.push({entry_key:slot.key,destination_key:slot.key,source_etag:crypto.randomUUID(),output_kind:'linked_text_envelope_v1',target_epoch:1,total_bytes:new TextEncoder().encode(raw).length,ciphertext_sha256:await Q.sha256(raw)});
    }
    const bm={source_digest:dispatched.source_digest,original_job_id:dispatched.original_job_id,original_epoch:1,outcome:'done',error_code:null,slot_nulls:nulls,ciphertext_manifest:records};bm.bundle_digest=await Q.hashJson(bm);
    const terminalCore={...nativeScope,execution_id:dispatched.execution_id,run_version:dispatched.run_version,lease_version:dispatched.lease_version,dispatch_id:dispatched.dispatch_receipt.dispatch_id,provider_terminal_observed:true,outcome:'done',bundle_metadata:bm,local_checkpoint_confirmed:true,unavailable_reason:null};
    const settled=await request(prefix+'/claims/settle','POST',terminalCore),nativeStatus=await request(prefix+'/claims/status?'+new URLSearchParams({...nativeScope,execution_id:dispatched.execution_id}));
    assert(Q.canonicalJson(nativeStatus.original_request_metadata)===Q.canonicalJson(claim)&&Q.canonicalJson(nativeStatus.bundle_metadata)===Q.canonicalJson(bm),'legacy_read_metadata_changed');
    const originalWork={transfers,bundle_metadata:bm};assert((await A.openLegacyTerminalBundle(scope,claim,nativeStatus,originalWork,password)).result_json===values.result_json,'legacy_original_cipher_value');
    assert(Q.canonicalJson(settled.terminal_receipt)===Q.canonicalJson(nativeStatus.terminal_receipt),'legacy_native_receipt_changed');
    let nativeReceipt=null;
    if(config.phase===29){
      const prepare={...nativeScope,mutation_id:crypto.randomUUID(),execution_id:dispatched.execution_id,terminal_run_version:nativeStatus.terminal_receipt.terminal_run_version,terminal_receipt_digest:await Q.hashJson(nativeStatus.terminal_receipt),base:sourceContext.base,bundle_metadata:bm};
      const intent=await request(prefix+'/result-prepare','POST',prepare);
      assert(intent.write_id===dispatched.execution_id&&await Q.hashJson({...intent.metadata_context,slots:intent.slots,origin:intent.origin})===intent.metadata_manifest_digest,'legacy_native_prepare_binding');
      for(const output of intent.slots){if(output.is_null)continue;const transfer=transfers.find(t=>Q.canonicalJson(t.key)===Q.canonicalJson(output.key)),record=records.find(r=>Q.canonicalJson(r.destination_key)===Q.canonicalJson(output.key));
        assert(transfer&&record&&record.source_etag===output.source_etag&&Q.canonicalJson(output.expected_binding)===Q.canonicalJson(dispatched.output_slots.find(s=>s.key.kind===output.key.kind).expected_binding),'legacy_native_output_binding');
        const bytes=new TextEncoder().encode(transfer.raw),total=Math.ceil(bytes.length/262144),common={schema_version:1,owner_id:scope.owner,local_id:scope.local_id,device_id:scope.device,transition_id:intent.write_id,entry_key:output.key,source_etag:output.source_etag,target_epoch:1,total_chunks:total,total_bytes:bytes.length};
        for(let i=0;i<total;i++){const chunk=bytes.slice(i*262144,(i+1)*262144);await request(prefix+'/chunks','PUT',{...common,chunk_index:i,chunk_sha256:await Q.sha256(chunk),data_base64:btoa(String.fromCharCode(...chunk))});}
        await request(prefix+'/entries/seal','POST',{...common,ciphertext_sha256:record.ciphertext_sha256});let readback='';
        for(let i=0;i<total;i++){const r=await request(prefix+'/staged?'+new URLSearchParams({owner_id:scope.owner,local_id:scope.local_id,device_id:scope.device,server_instance_id:scope.instance,write_id:intent.write_id,metadata_manifest_digest:intent.metadata_manifest_digest,kind:output.key.kind,representation_id:output.key.id,slot:output.key.slot,source_etag:output.source_etag,chunk_index:i}));assert(r.sealed&&r.total_chunks===total&&r.total_bytes===bytes.length&&r.chunk_index===i&&r.ciphertext_sha256===record.ciphertext_sha256,'legacy_native_staged_frame');readback+=atob(r.data_base64);}
        assert(new TextDecoder().decode(Uint8Array.from(readback,c=>c.charCodeAt(0)))===transfer.raw,'legacy_native_cipher_readback');
      }
      const committed=await request(prefix+'/commit','POST',{...nativeScope,write_id:intent.write_id,mutation_id:prepare.mutation_id,target_epoch:1,metadata_manifest_digest:intent.metadata_manifest_digest,client_verified_ciphertext_manifest_digest:await Q.hashJson(records)});
      assert(committed.state==='committed'&&committed.receipt.write_id===intent.write_id&&committed.receipt.execution_id===dispatched.execution_id,'legacy_native_commit_unconfirmed');nativeReceipt=committed.receipt;
    }
    await open();
    await action('current_plain_transition',()=>status().includes('전환 준비 가능'));
    await action('mixed_conversion',()=>status().includes('전환 준비 가능'));
    const current=await inspectNoteProtection();assert(current.catalog.context.base.crypto_epoch===2,'legacy_target_epoch_missing');
    const id=crypto.randomUUID(),archive={schema_version:1,purpose:'mixed_analysis_execution',operation_id:id,scope,request:claim,input,route:{provider:'omniroute',endpoint:config.syntheticProviderUrl,model:'auto'},execution:nativeStatus,dispatch:{request:dispatch,handoff_reserved:true},terminal:{work:originalWork,settle_core:terminalCore,receipt:nativeStatus.terminal_receipt}};
    await noteHistory.saveProtection({schema_version:1,id,scope,phase:'analysis_settled',cipher_bundle:await Q.encryptContent(Q.canonicalJson(archive),password)},{active:()=>true});await settle();
    await open();await action('analysis-resume',()=>dialog().querySelector('.protection-analysis-result').textContent.includes('SYNTHETIC-LLM-RESULT-'+run));
    if(config.phase===29){
      const before=await noteProtectionReader.catalog(scope);let replanPosts=0,nativeReads=0;
      noteProtectionAnalysis=A.createExecution({context:()=>({...noteHistoryContext(),instance:noteProtectionIdentity?.instance||''}),journal:noteHistory,request:async(s,path,method,body)=>{
        assert(Q.canonicalJson(s)===Q.canonicalJson(scope),'legacy_stored_scope');
        if(path==='/api/v2/notes/mixed-analysis-writes/replan'&&method==='POST')replanPosts++;
        if(path==='/api/v2/notes/protected-analysis/status'&&method==='GET')nativeReads++;
        assert(!['/commit','/chunks','/entries/seal'].some(end=>path.endsWith(end)),'legacy_stored_attempted_new_publication');
        return request(path+(method==='GET'?'?'+new URLSearchParams(body):''),method,method==='GET'?undefined:body);
      }});
      await action('analysis-replan',()=>!dialog().querySelector('.protection-replan').classList.contains('hidden'));
      const checkbox=dialog().querySelector('[name="analysis-reuse-confirm"]');checkbox.checked=true;checkbox.dispatchEvent(new Event('change'));
      await action('analysis-replan-confirm',()=>noteProtectionAnalysis.status(id).phase==='complete'&&dialog().querySelector('.protection-analysis-result').textContent.includes('SYNTHETIC-LLM-RESULT-'+run));
      const complete=await noteProtectionAnalysis.inspectReplan(id,password);
      assert(replanPosts===1&&nativeReads===1&&complete.stored.stored_result.schema_version===1&&complete.prepared===null&&complete.work===null&&Q.canonicalJson(complete.receipt)===Q.canonicalJson(nativeReceipt),'legacy_stored_not_original_receipt');
      assert(Q.canonicalJson(await noteProtectionReader.catalog(scope))===Q.canonicalJson(before),'legacy_stored_changed_catalog');
      emit({stage:'legacy_already_stored_native_receipt_verified',owner:a.owner,local_id:target,operation_id:nativeReceipt.write_id,local_operation_id:id});
    }
    for(const store of protectionStorageAdapters())assert(!JSON.stringify(await store.read()).includes('SYNTHETIC-LLM-RESULT-'),'legacy_plain_result_persisted');
    emit({stage:'legacy_analysis_cipher_archive_restored',owner:a.owner,local_id:target,operation_id:dispatched.execution_id,local_operation_id:id});button('lock').click();clearWebSession();
    return {ok:true,mode:config.mode,phase:config.phase,nativeSchema:1,verifiedRecoveryMetadata:true,originalCipherArchive:true,targetEpoch:2,nativeAlreadyStored:config.phase===29,providerCalls:1};
  }
  if(config.phase===30){
    state.selectedTreeId=target;render();await settle();await open();const Q=NowNoteProtectionProtocol,info=await inspectNoteProtection();
    const matches=[];for(const m of Object.values(noteHistory.protectionOperations()).filter(m=>m.scope.local_id===target&&m.phase==='complete')){const b=Q.parseJson(await Q.decryptContent(m.cipher_bundle,password));if(b.purpose==='mixed_analysis_execution'&&b.request?.schema_version===1)matches.push({id:m.id,b});}
    assert(matches.length===1,'legacy_stored_cold_archive_missing');const {id,b}=matches[0],r=b.replan;
    assert(r.stored?.stored_result.schema_version===1&&r.prepared===null&&r.work===null&&r.proof.operation_id===r.receipt.write_id,'legacy_stored_cold_proof_missing');
    assert((await resumeProtectedAnalysis(id,password)).includes('SYNTHETIC-LLM-RESULT-'+run),'legacy_stored_cold_result');
    const index=info.rows.findIndex(row=>row.kind==='typed'&&row.descriptor.key.kind==='analysis_result'&&row.descriptor.key.id===String(r.receipt.job_id));assert(index>=0,'legacy_stored_cold_typed_missing');
    dialog().querySelector('[name="representation"]').value=String(index);await action('read',()=>dialog().querySelector('.protection-plain').textContent.includes('SYNTHETIC-LLM-RESULT-'+run));
    emit({stage:'analysis_replan_ready',owner:a.owner,local_id:target,operation_id:r.receipt.write_id,local_operation_id:id});
    for(let i=0;i<300&&!globalThis.__HTTP_CAPTURE_DONE__&&!globalThis.__HTTP_CAPTURE_ERROR__;i++)await wait();assert(globalThis.__HTTP_CAPTURE_DONE__===true,'legacy_stored_capture_unconfirmed');
    for(const store of protectionStorageAdapters())assert(!JSON.stringify(await store.read()).includes('SYNTHETIC-LLM-RESULT-'),'legacy_stored_cold_plaintext');
    button('lock').click();clearWebSession();return {ok:true,mode:config.mode,phase:30,nativeReceiptColdRead:true,typedResult:true,newPublication:false,providerCalls:0};
  }
  if(config.phase===24){
    const originalDevice=config.mode==='web'?'web-client':a.device.replace(/-peer$/,'');
    assert(!isHostedWebClient(),'peer_client_must_support_distinct_device');
    a.device=noteHistoryContext().device;
    assert(a.device!==originalDevice&&a.device.endsWith('-peer'),'peer_device_not_distinct');
    assert(!noteHistory.export().contexts?.[NowNoteHistory.key(noteHistoryContext())]?.notes?.[target],'peer_inherited_original_journal');
    await loadServerSharedNotes();await settle();state.selectedTreeId=target;render();await open();
    const before=await inspectNoteProtection();
    await action('edit',()=>!dialog().querySelector('.protection-editor').classList.contains('hidden'));
    const editor=dialog().querySelector('.protection-draft');assert(editor.value===plain.replace(/\r\n/g,'\n'),'peer_source_changed_before_edit');
    editor.value='HTTP-QA-PEER-'+run+'\n';editor.dispatchEvent(new Event('input',{bubbles:true}));await drive(()=>status().includes('초안 저장됨'),'peer_draft');
    await action('save',()=>Object.values(noteHistory.protectionOperations()).some(m=>m.scope.local_id===target&&m.phase==='complete')&&!dialog().querySelector('.protection-draft').value);
    const after=await inspectNoteProtection(),c=after.catalog.context;
    assert(c.base.head_version===before.catalog.context.base.head_version+1&&c.base.history_generation===before.catalog.context.base.history_generation+1,'peer_write_not_single_revision');
    const d=after.catalog.entries.find(d=>d.key.kind==='note_body'&&d.key.id===String(c.selected_physical_note_id)),value=await noteProtectionReader.read(after.scope,after.catalog,d,async()=>password);
    assert(value.value==='HTTP-QA-PEER-'+run+'\n','peer_current_readback');
    for(const store of protectionStorageAdapters())assert(!JSON.stringify(await store.read()).includes('HTTP-QA-PEER-'),'peer_plaintext_persisted');
    emit({stage:'analysis_peer_source_changed',owner:a.owner,local_id:target,device_id:a.device});button('lock').click();clearWebSession();
    return {ok:true,mode:config.mode,phase:24,peerClient:'desktop',peerDeviceId:a.device,distinctDevice:true,isolatedPeer:true,sourceChanged:true,headVersion:c.base.head_version,historyGeneration:c.base.history_generation,providerCalls:0};
  }
  if(config.phase===25){
    state.selectedTreeId=target;render();await settle();await open();
    const info=await inspectNoteProtection(),scope=info.scope,Q=NowNoteProtectionProtocol;
    const markers=Object.values(noteHistory.protectionOperations()).filter(m=>m.scope.local_id===target&&m.phase==='analysis_settled');assert(markers.length===1,'repeat_original_missing');const id=markers[0].id;
    noteProtectionAnalysis=NowNoteProtectionAnalysis.createExecution({context:()=>({...noteHistoryContext(),instance:noteProtectionIdentity?.instance||''}),journal:noteHistory,request:async(s,path,method,body)=>{
      assert(Q.canonicalJson(s)===Q.canonicalJson(scope),'repeat_scope');
      if(path.endsWith('/chunks'))throw Error('qa_repeat_before_upload');
      const response=await fetch(url+path+(method==='GET'?'?'+new URLSearchParams(body):''),{method,cache:'no-store',headers:{Authorization:'Bearer '+config.apiToken,...noteHistoryContext().headers,...(method==='GET'?{}:{'Content-Type':'application/json'})},...(method==='GET'?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
      const value=Q.parseJson(await response.text());assert(response.ok,'repeat_prepare_http');return value;
    }});
    await action('analysis-replan',()=>!dialog().querySelector('.protection-replan').classList.contains('hidden'));
    const checkbox=dialog().querySelector('[name="analysis-reuse-confirm"]');checkbox.checked=true;checkbox.dispatchEvent(new Event('change'));
    await action('analysis-replan-confirm',()=>noteProtectionAnalysis.status(id).phase==='analysis_replan_prepared');
    assert(status()==='qa_repeat_before_upload','repeat_did_not_stop_before_upload');
    const record=await noteProtectionAnalysis.inspectReplan(id,password);assert(record.work.transfers.length===2,'repeat_cipher_missing');
    const stopped=await request('/api/v2/notes/mixed-analysis-writes/abort','POST',{schema_version:3,owner_id:scope.owner,local_id:scope.local_id,device_id:scope.device,server_instance_id:scope.instance,operation_id:record.prepared.id,lease_version:record.prepared.response.lease_version});
    assert(stopped.state==='aborted'&&stopped.operation_id===record.prepared.id,'repeat_abort_unconfirmed');
    emit({stage:'analysis_replan_aborted_before_upload',owner:a.owner,local_id:target,operation_id:record.prepared.id,local_operation_id:id});button('lock').click();clearWebSession();
    return {ok:true,mode:config.mode,phase:25,priorCipherPreserved:true,ownPreparedWriteAborted:true,providerCalls:0};
  }
  if([22,23,27,28].includes(config.phase)){
    const preparing=[22,27].includes(config.phase);
    state.selectedTreeId=target;render();await settle();await open();
    const info=await inspectNoteProtection(),scope=info.scope,Q=NowNoteProtectionProtocol,before=await noteProtectionReader.catalog(scope);
    const candidates=Object.values(noteHistory.protectionOperations()).filter(m=>m.scope.owner===a.owner&&m.scope.local_id===target&&(preparing?['analysis_settled','analysis_replan_prepared'].includes(m.phase):m.phase==='analysis_replan_committing'));
    assert(candidates.length===1,'replan_ui_marker_missing');const id=candidates[0].id,original=Q.parseJson(await Q.decryptContent(candidates[0].cipher_bundle,password));
    let commitPosts=0;
    noteProtectionAnalysis=NowNoteProtectionAnalysis.createExecution({context:()=>({...noteHistoryContext(),instance:noteProtectionIdentity?.instance||''}),journal:noteHistory,request:async(s,path,method,body)=>{
        assert(Q.canonicalJson(s)===Q.canonicalJson(scope),'replan_transport_scope');
        if(method==='POST'&&path==='/api/v2/notes/mixed-analysis-writes/commit'){commitPosts++;assert(preparing,'replan_cold_commit_reposted');}
        const response=await fetch(url+path+(method==='GET'?'?'+new URLSearchParams(body):''),{method,cache:'no-store',headers:{Authorization:'Bearer '+config.apiToken,...noteHistoryContext().headers,...(method==='GET'?{}:{'Content-Type':'application/json'})},...(method==='GET'?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
        const value=Q.parseJson(await response.text());if(!response.ok)throw Object.assign(Error(value.detail?.code||'qa_replan_http'),{status:response.status,code:value.detail?.code});
        if(method==='POST'&&path==='/api/v2/notes/mixed-analysis-writes/commit'){emit({stage:'analysis_replan_commit_response_deliberately_lost',owner:a.owner,local_id:target,operation_id:value.operation_id});throw Error('qa_replan_commit_response_lost');}
        return value;
    }});
    if(preparing){
      const source=original.execution.source_context.base.base||original.execution.source_context.base;
      assert(before.context.base.head_version>source.head_version&&before.context.base.history_generation>source.history_generation,'peer_source_change_not_observed');
      assert(!button('analysis-replan').disabled,'replan_ui_command_disabled');
      await action('analysis-replan',()=>!dialog().querySelector('.protection-replan').classList.contains('hidden'));
      assert(button('analysis-replan-confirm').disabled,'replan_ui_missing_confirmation');
      const confirm=dialog().querySelector('[name="analysis-reuse-confirm"]');confirm.checked=true;confirm.dispatchEvent(new Event('change'));
      await action('analysis-replan-confirm',()=>noteProtectionAnalysis.status(id).phase==='analysis_replan_committing');
      assert(status()==='qa_replan_commit_response_lost'&&commitPosts===1,'replan_loss_not_preserved');
      const archived=Q.parseJson(await Q.decryptContent(noteProtectionAnalysis.status(id).cipher_bundle,password)),r=archived.replan;
      assert(Q.canonicalJson(archived.terminal)===Q.canonicalJson(original.terminal),'replan_original_terminal_changed');
      if(original.replan){assert(r.plan.prepare.previous_write_id===original.replan.prepared.id&&r.plan.prepare.previous_write_state==='aborted','repeat_prior_link_missing');assert(Q.canonicalJson(r.prior.record)===Q.canonicalJson(original.replan),'repeat_prior_cipher_changed');}
      assert(Q.canonicalJson(r.plan.original.work)===Q.canonicalJson(original.terminal.work)&&Q.canonicalJson(r.plan.original.execution.source_context)===Q.canonicalJson(original.execution.source_context),'replan_original_source_or_cipher_changed');
      assert(Q.canonicalJson(r.plan.prepare.base)===Q.canonicalJson(before.context)&&r.prepared.id!==original.execution.execution_id,'replan_new_binding_or_base_missing');
      assert(r.work.transfers.every(t=>!original.terminal.work.transfers.some(old=>old.raw===t.raw)),'replan_reused_original_cipher');
      emit({stage:'analysis_replan_ui_pending',owner:a.owner,local_id:target,operation_id:r.prepared.id,local_operation_id:id});
    }else{
      await action('analysis-resume',()=>noteProtectionAnalysis.status(id).phase==='complete'&&dialog().querySelector('.protection-analysis-result').textContent.includes('SYNTHETIC-LLM-RESULT-'+run));
      const archived=Q.parseJson(await Q.decryptContent(noteProtectionAnalysis.status(id).cipher_bundle,password)),r=archived.replan;
      assert(Q.canonicalJson(r.work)===Q.canonicalJson(original.replan.work)&&Q.canonicalJson(archived.terminal)===Q.canonicalJson(original.terminal),'replan_cold_original_changed');
      assert(r.receipt.operation_id===r.prepared.id&&r.proof.operation_id===r.prepared.id&&r.receipt.result.base.head_version===r.plan.prepare.base.base.head_version&&r.receipt.result.base.history_generation===r.plan.prepare.base.base.history_generation+1,'replan_receipt_or_proof_changed');
      const now=await inspectNoteProtection(),key=r.prepared.manifest.DSET.find(d=>d.destination_key.kind==='analysis_result').destination_key,index=now.rows.findIndex(row=>row.kind==='typed'&&Q.canonicalJson(row.descriptor.key)===Q.canonicalJson(key));assert(index>=0,'replan_typed_result_missing');
      dialog().querySelector('[name="representation"]').value=String(index);await action('read',()=>dialog().querySelector('.protection-plain').textContent.includes('SYNTHETIC-LLM-RESULT-'+run));
      const body=now.catalog.entries.find(d=>d.key.kind==='note_body'&&d.key.id===String(now.catalog.context.selected_physical_note_id)),current=await noteProtectionReader.read(scope,now.catalog,body,async()=>password);
      assert(current.value===(original.request.schema_version===1?plain:'HTTP-QA-PEER-'+run+'\n')&&Q.canonicalJson(await noteProtectionReader.catalog(scope))===Q.canonicalJson(before),'replan_overwrote_peer_current_or_cold_catalog');
      const otherNote=await request('/api/v2/notes/current?'+query(other));assert(otherNote.snapshot.note.content==='HTTP-QA-PRESERVE-'+run,'replan_changed_other');
      emit({stage:'analysis_replan_ready',owner:a.owner,local_id:target,operation_id:r.prepared.id,local_operation_id:id});
      for(let i=0;i<300&&!globalThis.__HTTP_CAPTURE_DONE__&&!globalThis.__HTTP_CAPTURE_ERROR__;i++)await wait();assert(!globalThis.__HTTP_CAPTURE_ERROR__,'replan_capture_failed');assert(globalThis.__HTTP_CAPTURE_DONE__===true,'replan_capture_unconfirmed');
    }
    for(const store of protectionStorageAdapters())assert(!JSON.stringify(await store.read()).includes('SYNTHETIC-LLM-RESULT-'),'replan_plain_result_persisted');
    button('lock').click();clearWebSession();
    return {ok:true,mode:config.mode,phase:config.phase,replanUi:preparing,commitResponseLost:preparing,coldTypedReplan:!preparing,sourceSchema:original.request.schema_version,commitPosts,originalSourceAndCipherPreserved:true,peerCurrentPreserved:true,cipherOnlyJournal:true,providerCalls:0};
  }
  if([20,21].includes(config.phase)){
    state.selectedTreeId=target;render();await settle();await open();
    const info=await inspectNoteProtection(),scope=info.scope,Q=NowNoteProtectionProtocol,before=await noteProtectionReader.catalog(scope);
    const candidates=Object.values(noteHistory.protectionOperations()).filter(m=>m.scope.owner===a.owner&&m.scope.local_id===target&&m.phase===(config.phase===20?'analysis_settled':'analysis_write_committing'));
    assert(candidates.length===1,'publication_ui_marker_missing');const id=candidates[0].id,original=Q.parseJson(await Q.decryptContent(candidates[0].cipher_bundle,password));
    let commitPosts=0;
    if(config.phase===20){
      noteProtectionAnalysis=NowNoteProtectionAnalysis.createExecution({context:()=>({...noteHistoryContext(),instance:noteProtectionIdentity?.instance||''}),journal:noteHistory,request:async(s,path,method,body)=>{
        assert(Q.canonicalJson(s)===Q.canonicalJson(scope),'publication_transport_scope');
        const response=await fetch(url+path+(method==='GET'?'?'+new URLSearchParams(body):''),{method,cache:'no-store',headers:{Authorization:'Bearer '+config.apiToken,...noteHistoryContext().headers,...(method==='GET'?{}:{'Content-Type':'application/json'})},...(method==='GET'?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
        const value=Q.parseJson(await response.text());
        if(!response.ok)throw Object.assign(Error(value.detail?.code||'qa_publication_http'),{status:response.status,code:value.detail?.code});
        if(method==='POST'&&path==='/api/v2/notes/mixed-analysis-writes/commit'){
          commitPosts++;emit({stage:'analysis_publication_commit_response_deliberately_lost',owner:a.owner,local_id:target,operation_id:value.operation_id});throw Error('qa_publication_commit_response_lost');
        }
        return value;
      }});
      assert(!button('analysis-publish').disabled,'publication_ui_command_disabled');
      await action('analysis-publish',()=>noteProtectionAnalysis.status(id).phase==='analysis_write_committing');
      assert(status()==='qa_publication_commit_response_lost'&&commitPosts===1,'publication_loss_not_preserved');
      const archived=Q.parseJson(await Q.decryptContent(noteProtectionAnalysis.status(id).cipher_bundle,password));
      assert(Q.canonicalJson(archived.terminal)===Q.canonicalJson(original.terminal),'publication_original_terminal_changed');
      assert(archived.publication.work.commit.operation_id===original.execution.execution_id,'publication_original_commit_changed');
      emit({stage:'analysis_publication_ui_pending',owner:a.owner,local_id:target,operation_id:original.execution.execution_id,local_operation_id:id});
    }else{
      await action('analysis-resume',()=>noteProtectionAnalysis.status(id).phase==='complete'&&dialog().querySelector('.protection-analysis-result').textContent.includes('SYNTHETIC-LLM-RESULT-'+run));
      const archived=Q.parseJson(await Q.decryptContent(noteProtectionAnalysis.status(id).cipher_bundle,password));
      assert(Q.canonicalJson(archived.publication.work)===Q.canonicalJson(original.publication.work)&&Q.canonicalJson(archived.terminal)===Q.canonicalJson(original.terminal),'publication_cold_original_changed');
      assert(archived.publication.receipt.operation_id===original.execution.execution_id&&archived.publication.proof.operation_id===original.execution.execution_id,'publication_cold_proof_missing');
      const now=await inspectNoteProtection(),index=now.rows.findIndex(r=>r.kind==='typed'&&r.descriptor.key.kind==='analysis_result'&&r.descriptor.key.id===String(original.execution.job_id));assert(index>=0,'publication_typed_result_missing');
      dialog().querySelector('[name="representation"]').value=String(index);
      await action('read',()=>dialog().querySelector('.protection-plain').textContent.includes('SYNTHETIC-LLM-RESULT-'+run));
      assert(Q.canonicalJson(await noteProtectionReader.catalog(scope))===Q.canonicalJson(before),'publication_cold_changed_catalog');
      emit({stage:'analysis_publication_ready',owner:a.owner,local_id:target,operation_id:original.execution.execution_id,local_operation_id:id});
      for(let i=0;i<300&&!globalThis.__HTTP_CAPTURE_DONE__;i++)await wait();assert(globalThis.__HTTP_CAPTURE_DONE__===true,'publication_capture_unconfirmed');
    }
    for(const store of protectionStorageAdapters())assert(!JSON.stringify(await store.read()).includes('SYNTHETIC-LLM-RESULT-'),'publication_plain_result_persisted');
    button('lock').click();clearWebSession();
    return {ok:true,mode:config.mode,phase:config.phase,publicationUi:config.phase===20,commitResponseLost:config.phase===20,coldTypedPublication:config.phase===21,originalCipherAndTerminalPreserved:true,cipherOnlyJournal:true,providerCalls:0};
  }
  if([18,19].includes(config.phase)){
    state.selectedTreeId=target;render();await settle();await open();
    const info=await inspectNoteProtection(),scope=info.scope,Q=NowNoteProtectionProtocol,before=await noteProtectionReader.catalog(scope);
    const field=name=>dialog().querySelector('[name="analysis-'+name+'"]');
    if(config.phase===18){
      state.settings.llm={...state.settings.llm,provider:'omniroute',omniUrl:config.syntheticProviderUrl,omniModel:'auto',omniApiKey:'synthetic-only',omniReasoning:''};
      await action('analysis-prepare',()=>!dialog().querySelector('.protection-analysis').classList.contains('hidden'));
      assert(field('input').value.endsWith(plain.replace(/\r\n/g,'\n'))&&field('input').readOnly&&field('endpoint').value===config.syntheticProviderUrl&&field('model').value==='auto','analysis_ui_input_or_route');
      assert(button('analysis-run').disabled&&!field('confirm').checked,'analysis_ui_missing_confirmation');
      field('confirm').checked=true;field('confirm').dispatchEvent(new Event('change'));const prompts=keyPrompts;
      await action('analysis-run',()=>dialog().querySelector('.protection-analysis-result').textContent.includes('SYNTHETIC-LLM-RESULT-'+run));
      assert(keyPrompts-prompts===2,'analysis_ui_output_key_not_fresh');
      emit({stage:'analysis_ui_result_ready',owner:a.owner,local_id:target});
      for(let i=0;i<300&&!globalThis.__HTTP_CAPTURE_DONE__;i++)await wait();assert(globalThis.__HTTP_CAPTURE_DONE__===true,'analysis_ui_capture_unconfirmed');
    }else{
      assert(field('operation').value&&button('analysis-run').disabled,'analysis_ui_cold_execution_missing');
      await action('analysis-resume',()=>dialog().querySelector('.protection-analysis-result').textContent.includes('SYNTHETIC-LLM-RESULT-'+run));
    }
    const markers=Object.values(noteHistory.protectionOperations()).filter(m=>m.scope.local_id===target&&m.scope.owner===a.owner&&m.phase==='analysis_settled');assert(markers.length===1,'analysis_ui_cipher_terminal_missing');
    const original=Q.parseJson(await Q.decryptContent(markers[0].cipher_bundle,password));
    assert(original.execution.state==='client_settled'&&original.execution.terminal_receipt.outcome==='done','analysis_ui_receipt_missing');
    assert(Q.canonicalJson(await noteProtectionReader.catalog(scope))===Q.canonicalJson(before),'analysis_ui_changed_current');
    for(const store of protectionStorageAdapters())assert(!JSON.stringify(await store.read()).includes('SYNTHETIC-LLM-RESULT-'),'analysis_ui_raw_result_persisted');
    emit({stage:'analysis_ui_verified',owner:a.owner,local_id:target,operation_id:original.execution.execution_id,local_operation_id:markers[0].id});
    button('lock').click();assert(!dialog().querySelector('.protection-analysis-result').textContent&&!field('input').value,'analysis_ui_lock_raw');clearWebSession();
    return {ok:true,mode:config.mode,phase:config.phase,analysisUiConfirmed:config.phase===18,coldResultRead:config.phase===19,freshOutputKey:config.phase===18,cipherOnlyResult:true,currentCatalogUnchanged:true,providerCalls:config.phase===18?1:0};
  }
  if([14,15,16,17].includes(config.phase)){
    state.selectedTreeId=target;render();await settle();await open();
    const info=await inspectNoteProtection(),scope=info.scope,A=NowNoteProtectionAnalysis,Q=NowNoteProtectionProtocol;
    const before=await noteProtectionReader.catalog(scope);let postSettle=0;
    const transport=async(s,path,method,body)=>{
      assert(Q.canonicalJson(s)===Q.canonicalJson(scope),'terminal_transport_scope_changed');
      if(method==='POST'&&path.endsWith('/settle')){postSettle++;assert(![15,17].includes(config.phase),'terminal_restart_reposted');}
      const value=await request(path+(method==='GET'?'?'+new URLSearchParams(body):''),method,method==='POST'?body:undefined);
      if(config.phase===14&&method==='POST'&&path.endsWith('/settle')){
        emit({stage:'analysis_terminal_settle_response_deliberately_lost',owner:a.owner,local_id:target,operation_id:value.execution_id});throw Error('qa_terminal_settle_response_lost');
      }
      return value;
    };
    const execution=A.createExecution({context:()=>({...noteHistoryContext(),instance:noteProtectionIdentity?.instance||''}),journal:noteHistory,request:transport});
    if(config.phase===15){
      const markers=Object.values(noteHistory.protectionOperations()).filter(m=>m.scope.owner===a.owner&&m.scope.local_id===target&&m.phase==='analysis_settling');
      assert(markers.length===1,'terminal_cold_marker_missing');const id=markers[0].id;
      const original=Q.parseJson(await Q.decryptContent(markers[0].cipher_bundle,password));
      const receipt=await execution.settleTerminal(id,password);assert(postSettle===0&&receipt.bundle_digest===original.terminal.work.bundle_metadata.bundle_digest,'terminal_cold_receipt_changed');
      const archived=Q.parseJson(await Q.decryptContent(execution.status(id).cipher_bundle,password));
      assert(Q.canonicalJson(archived.terminal.work)===Q.canonicalJson(original.terminal.work)&&Q.canonicalJson(archived.terminal.settle_core)===Q.canonicalJson(original.terminal.settle_core),'terminal_cold_cipher_or_core_changed');
      const values=await A.openTerminalBundle(scope,archived.request,archived.execution,archived.terminal.work,password);
      assert(values.result_json===JSON.stringify({summary:'SYNTHETIC-LLM-RESULT-'+run+'\r\n'})&&values.input_text===archived.input&&values.error_message===null,'terminal_cold_meaning_changed');
      const after=await noteProtectionReader.catalog(scope);assert(Q.canonicalJson(before)===Q.canonicalJson(after),'terminal_cold_changed_note');
      emit({stage:'analysis_terminal_cold_TR_BM_verified',owner:a.owner,local_id:target,operation_id:archived.execution.execution_id,local_operation_id:id});
      execution.invalidate();button('lock').click();clearWebSession();
      return {ok:true,mode:config.mode,phase:15,originalCipherTerminalColdResume:true,TRBMpreserved:true,settlePostCalls:postSettle,providerCalls:0,currentCatalogUnchanged:true};
    }
    if(config.phase===17){
      const markers=Object.values(noteHistory.protectionOperations()).filter(m=>m.scope.owner===a.owner&&m.scope.local_id===target&&m.phase==='analysis_running');
      assert(markers.length===1,'unavailable_cold_marker_missing');const id=markers[0].id;
      const original=Q.parseJson(await Q.decryptContent(markers[0].cipher_bundle,password));
      let rejected=false;try{await execution.reconcileUnavailable(id,'wrong-key');}catch{rejected=true;}assert(rejected,'unavailable_wrong_key_accepted');
      const receipt=await execution.reconcileUnavailable(id,password);assert(receipt.outcome==='result_unavailable'&&execution.status(id).phase==='complete'&&postSettle===0,'unavailable_cold_receipt_missing');
      const archived=Q.parseJson(await Q.decryptContent(execution.status(id).cipher_bundle,password));
      for(const key of ['request','input','route','dispatch'])assert(Q.canonicalJson(archived[key])===Q.canonicalJson(original[key]),'unavailable_cold_original_changed');
      assert(archived.terminal===null&&archived.execution.terminal_receipt.execution_id===original.execution.execution_id,'unavailable_cold_raw_reconstructed');
      assert(Q.canonicalJson(await noteProtectionReader.catalog(scope))===Q.canonicalJson(before),'unavailable_cold_changed_note');
      emit({stage:'analysis_unavailable_cold_receipt_verified',owner:a.owner,local_id:target,operation_id:receipt.execution_id,local_operation_id:id});
      execution.invalidate();button('lock').click();clearWebSession();
      return {ok:true,mode:config.mode,phase:17,unavailableColdCipherArchive:true,originalReceiptOnly:true,settlePostCalls:postSettle,providerCalls:0,currentCatalogUnchanged:true};
    }
    assert(typeof config.syntheticProviderUrl==='string','synthetic_provider_missing');
    const descriptor=before.entries.find(d=>d.key.kind==='note_body'&&d.key.id===String(before.context.selected_physical_note_id));
    const source=await noteProtectionReader.read(scope,before,descriptor,async()=>password);
    assert(source.value===plain,'terminal_selected_source_meaning_changed');
    const input='SYNTHETIC-LLM-INPUT-'+run+'\n'+source.value,route={provider:'omniroute',endpoint:config.syntheticProviderUrl,model:'auto'};
    const claim={schema_version:3,owner_id:a.owner,local_id:target,device_id:a.device,server_instance_id:scope.instance,mutation_id:crypto.randomUUID(),source_context:{server_instance_id:scope.instance,base:before.context,catalog_digest:before.catalog_digest},source_keys:[{descriptor}],job_type:'memo_summary',prompt_version:'single_source_v1',source_job_id:null,execution_route:'client_provider',client_execution_confirmed:true};
    const id=await execution.start(scope,claim,input,route,password);await execution.resumeClaim(id,password);
    const handoff=await execution.dispatch(id,password,{...route,input,confirmed:true});assert(handoff.provider_state==='ready','terminal_provider_handoff_missing');
    const response=await llmChatRequest(handoff.route.provider,{omniUrl:handoff.route.endpoint,omniApiKey:'synthetic-only',omniModel:handoff.route.model,omniReasoning:''},handoff.input);
    assert(response.ok,'synthetic_provider_http_failure');const text=extractLlmChatText('omniroute',await response.json());
    assert(text==='SYNTHETIC-LLM-RESULT-'+run+'\r\n','synthetic_provider_result_changed');
    const observation={provider_terminal_observed:true,outcome:'done',result_json:JSON.stringify({summary:text}),error_message:null,error_code:null};
    if(config.phase===16){
      const previous=Q.canonicalJson(noteHistory.export());execution.invalidate();button('lock').click();
      let denied=false;try{await execution.recordTerminal(handoff,observation,password);}catch(error){denied=error.message==='note_protection_analysis:terminal_key_unavailable';}assert(denied,'terminal_after_lock_saved_raw');
      const receipt=await execution.reportUnavailable(handoff,{provider_terminal_observed:true,unavailable_reason:'key_unavailable'});
      assert(receipt.outcome==='result_unavailable'&&Q.canonicalJson(noteHistory.export())===previous,'terminal_unavailable_changed_journal');
      assert(Q.canonicalJson(await noteProtectionReader.catalog(scope))===Q.canonicalJson(before),'terminal_unavailable_changed_note');
      emit({stage:'analysis_terminal_unavailable_verified',owner:a.owner,local_id:target,operation_id:receipt.execution_id,local_operation_id:id});
      clearWebSession();await login(b);let blocked=false;try{await execution.reportUnavailable(handoff,{provider_terminal_observed:true,unavailable_reason:'key_unavailable'});}catch{blocked=true;}
      assert(blocked&&postSettle===1,'terminal_unavailable_other_account_called_server');clearWebSession();
      return {ok:true,mode:config.mode,phase:16,observedSyntheticProviderTerminal:true,keyInvalidatedMetadataOnly:true,cipherJournalUnchanged:true,providerCalls:1,currentCatalogUnchanged:true};
    }
    await execution.recordTerminal(handoff,observation,password);
    assert(execution.status(id).phase==='analysis_terminal'&&postSettle===0,'terminal_post_before_durable_bundle');
    let lost=false;try{await execution.settleTerminal(id,password);}catch(error){lost=error.message==='qa_terminal_settle_response_lost';}
    assert(lost&&postSettle===1&&execution.status(id).phase==='analysis_settling','terminal_settle_loss_not_preserved');
    for(const store of protectionStorageAdapters())assert(!JSON.stringify(await store.read()).includes('SYNTHETIC-LLM-RESULT-'),'terminal_plaintext_persisted');
    emit({stage:'analysis_terminal_cipher_checkpoint_verified',owner:a.owner,local_id:target,operation_id:handoff.execution.execution_id,local_operation_id:id});
    execution.invalidate();button('lock').click();clearWebSession();
    return {ok:true,mode:config.mode,phase:14,observedSyntheticProviderTerminal:true,cipherCheckpointBeforeSettle:true,settleResponseLost:true,providerCalls:1};
  }
  if(config.phase===12||config.phase===13){
    state.selectedTreeId=target;render();await settle();await open();
    const info=await inspectNoteProtection(),scope=info.scope,A=NowNoteProtectionAnalysis,Q=NowNoteProtectionProtocol;
    let postCount=0,getCount=0;
    const transport=async(s,path,method,body)=>{
      assert(Q.canonicalJson(s)===Q.canonicalJson(scope),'claim_transport_scope_changed');
      if(method==='POST')postCount++;else getCount++;
      const value=await request(path+(method==='GET'?'?'+new URLSearchParams(body):''),method,method==='POST'?body:undefined);
      if(config.phase===12&&method==='POST'){
        emit({stage:'analysis_claim_response_deliberately_lost',owner:a.owner,local_id:target,operation_id:value.execution_id});
        throw Error('qa_claim_response_lost');
      }
      return value;
    };
    const execution=A.createExecution({context:()=>({...noteHistoryContext(),instance:noteProtectionIdentity?.instance||''}),journal:noteHistory,request:transport});
    const input='HTTP-QA-CLAIM-INPUT-'+run+'\r\n';
    if(config.phase===12){
      const catalog=info.catalog,descriptor=catalog.entries.find(d=>d.key.kind==='note_body'&&d.key.id===String(catalog.context.selected_physical_note_id));
      const claim={schema_version:3,owner_id:a.owner,local_id:target,device_id:a.device,server_instance_id:scope.instance,mutation_id:crypto.randomUUID(),source_context:{server_instance_id:scope.instance,base:catalog.context,catalog_digest:catalog.catalog_digest},source_keys:[{descriptor}],job_type:'memo_summary',prompt_version:'single_source_v1',source_job_id:null,execution_route:'client_provider',client_execution_confirmed:true};
      const id=await execution.start(scope,claim,input,{provider:'omniroute',endpoint:'https://synthetic.invalid/v1',model:'auto'},password);
      assert(postCount===0&&execution.status(id).phase==='analysis_claiming','claim_before_cipher_checkpoint');
      let lost=false;try{await execution.resumeClaim(id,password);}catch(error){lost=error.message==='qa_claim_response_lost';}
      assert(lost&&postCount===1&&execution.status(id).phase==='analysis_claiming','claim_loss_not_preserved');
      for(const store of protectionStorageAdapters())assert(!JSON.stringify(await store.read()).includes('HTTP-QA-CLAIM-INPUT-'),'claim_plaintext_persisted');
      execution.invalidate();button('lock').click();clearWebSession();
      return {ok:true,mode:config.mode,phase:12,claimResponseLostAfterServer:true,cipherCheckpointPreserved:true,providerCalls:0};
    }
    const markers=Object.values(noteHistory.protectionOperations()).filter(m=>m.scope.owner===a.owner&&m.scope.local_id===target&&m.phase==='analysis_claiming');
    assert(markers.length===1,'claim_cold_marker_missing');const id=markers[0].id;
    const original=Q.parseJson(await Q.decryptContent(markers[0].cipher_bundle,password));
    assert(original.input===input&&original.execution===null&&original.route.model==='auto','claim_cold_bundle_changed');
    let wrong=false;try{await execution.resumeClaim(id,'wrong');}catch{wrong=true;}
    assert(wrong&&postCount===0&&getCount===0,'claim_wrong_key_called_server');
    const claimed=await execution.resumeClaim(id,password);
    assert(postCount===1&&claimed.state==='client_pending'&&claimed.dispatch_receipt===null,'claim_cold_not_same_pending');
    const observed=await execution.resumeClaim(id,password);assert(postCount===1&&getCount===1&&Q.canonicalJson(observed)===Q.canonicalJson(claimed),'claim_status_reposted');
    const access={schema_version:3,owner_id:a.owner,local_id:target,device_id:a.device,server_instance_id:scope.instance,execution_id:claimed.execution_id};
    await request('/api/v2/notes/mixed-analysis-claims/cancel','POST',{...access,run_version:claimed.run_version,lease_version:claimed.lease_version});
    const terminal=await execution.resumeClaim(id,password);assert(terminal.state==='cancelled'&&terminal.dispatch_receipt===null,'claim_cancel_status_not_preserved');
    const settled=Q.parseJson(await Q.decryptContent(execution.status(id).cipher_bundle,password));
    assert(settled.input===input&&Q.canonicalJson(settled.request)===Q.canonicalJson(original.request)&&Q.canonicalJson(settled.execution.terminal_receipt)===Q.canonicalJson(terminal.terminal_receipt),'claim_terminal_archive_changed');
    for(const store of protectionStorageAdapters())assert(!JSON.stringify(await store.read()).includes('HTTP-QA-CLAIM-INPUT-'),'claim_cold_plaintext_persisted');
    emit({stage:'analysis_claim_cold_resume_verified',owner:a.owner,local_id:target,operation_id:terminal.execution_id,local_operation_id:id});
    execution.invalidate();button('lock').click();clearWebSession();await login(b);
    let denied=false;try{await execution.resumeClaim(id,password);}catch{denied=true;}assert(denied&&postCount===1&&getCount===2,'claim_other_account_called_server');
    clearWebSession();return {ok:true,mode:config.mode,phase:13,originalClaimColdResume:true,statusOnlyAfterKnown:true,wrongKeyAccountDenied:true,cipherOnlyArchive:true,providerCalls:0};
  }
  if(config.phase===11){
    state.selectedTreeId=target;render();await settle();await open();
    const info=await inspectNoteProtection(),scope=info.scope,catalog=info.catalog,Q=NowNoteProtectionProtocol,A=NowNoteProtectionAnalysis;
    const descriptor=catalog.entries.find(d=>d.key.kind==='note_body'&&d.key.id===String(catalog.context.selected_physical_note_id));
    assert(descriptor&&!descriptor.is_null,'analysis_source_missing');
    const access={schema_version:3,owner_id:a.owner,local_id:target,device_id:a.device,server_instance_id:scope.instance};
    const claim={...access,mutation_id:crypto.randomUUID(),source_context:{server_instance_id:scope.instance,base:catalog.context,catalog_digest:catalog.catalog_digest},source_keys:[{descriptor}],job_type:'memo_summary',prompt_version:'single_source_v1',source_job_id:null,execution_route:'client_provider',client_execution_confirmed:true};
    const prefix='/api/v2/notes/mixed-analysis-claims';
    const created=await request(prefix,'POST',claim);await A.validateExecution(scope,claim,created);
    assert(created.state==='client_pending'&&created.dispatch_receipt===null,'analysis_claim_dispatched');
    const query=new URLSearchParams({...access,execution_id:created.execution_id});
    const observed=await request(prefix+'/status?'+query);await A.validateExecution(scope,claim,observed);
    assert(Q.canonicalJson(created)===Q.canonicalJson(observed),'analysis_status_changed_claim');
    const chunks=[];let totalBytes=null,totalChunks=null;
    for(let index=0;;index++){
      const args=new URLSearchParams({...access,execution_id:created.execution_id,source_digest:created.source_digest,kind:descriptor.key.kind,representation_id:descriptor.key.id,slot:descriptor.key.slot,source_etag:descriptor.representation_etag,chunk_index:index});
      const value=await request(prefix+'/source?'+args);
      assert(Object.keys(value).sort().join(',')==='chunk_index,data_base64,descriptor,execution_id,schema_version,source_digest,total_bytes,total_chunks','analysis_source_fields');
      assert(value.schema_version===3&&value.execution_id===created.execution_id&&value.source_digest===created.source_digest&&Q.canonicalJson(value.descriptor)===Q.canonicalJson(descriptor),'analysis_source_binding');
      if(index===0){totalBytes=value.total_bytes;totalChunks=value.total_chunks;assert(Number.isSafeInteger(totalBytes)&&totalBytes>=1&&totalChunks===Math.ceil(totalBytes/262144),'analysis_source_frame');}
      assert(value.total_bytes===totalBytes&&value.total_chunks===totalChunks&&value.chunk_index===index,'analysis_source_frame_changed');
      const bytes=Uint8Array.from(atob(value.data_base64),c=>c.charCodeAt(0));assert(bytes.length===Math.min(262144,totalBytes-index*262144),'analysis_source_chunk_length');chunks.push(bytes);
      if(index+1===totalChunks)break;
    }
    const bytes=new Uint8Array(totalBytes);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
    assert(await Q.sha256(bytes)===descriptor.ciphertext_sha256,'analysis_source_cipher_changed');
    const cancelled=await request(prefix+'/cancel','POST',{...access,execution_id:created.execution_id,run_version:observed.run_version,lease_version:observed.lease_version});
    await A.validateExecution(scope,claim,cancelled);assert(cancelled.state==='cancelled'&&cancelled.dispatch_receipt===null,'analysis_cancel_not_terminal');
    const after=await inspectNoteProtection();assert(Q.canonicalJson(after.catalog)===Q.canonicalJson(catalog),'analysis_metadata_changed_note');
    emit({stage:'analysis_claim_source_cancel_verified',owner:a.owner,local_id:target,operation_id:created.execution_id});
    button('lock').click();clearWebSession();
    return {ok:true,mode:config.mode,phase:11,actualMXClaimSourceCancel:true,currentCatalogUnchanged:true,providerCalls:0,journalExecution:'not implemented'};
  }
  if(config.phase===10){
    assert(!findTreeNode(state.data.tree,target),'related_scope_inherited_tree');
    assert(!Object.values(noteHistory.protectionOperations()).some(m=>m.scope.local_id===target),'related_scope_inherited_marker');
    document.querySelector('#protectionBtn').click();
    await drive(()=>dialog()?.open&&!button('refresh').disabled&&dialog().querySelector('[name="target"] option'),'related_list_entry');
    const targets=dialog().querySelector('[name="target"]');
    assert([...targets.options].some(o=>o.value===target&&o.textContent.includes('연결 자료만')),'related_scope_not_discovered');
    targets.value=target;targets.dispatchEvent(new Event('change',{bubbles:true}));
    await drive(()=>dialog().querySelector('.protection-scope').textContent.includes(target)&&status().includes('전환 준비 가능'),'related_target_selected');
    const initial=await inspectNoteProtection();
    assert(initial.scope.local_id===target&&initial.status.crypto_epoch===0&&!initial.catalog,'related_scope_not_pristine');
    assert(!findTreeNode(state.data.tree,target),'discovery_created_placeholder_tree');
    await action('conversion',()=>Object.values(noteHistory.protectionOperations()).some(m=>m.scope.local_id===target&&m.phase==='complete'));
    const before=await inspectNoteProtection();
    assert(before.catalog.context.base.identity_state==='related_only'&&before.catalog.context.current_mode==='absent','related_protection_created_current');
    const linked=before.catalog.entries.filter(d=>['analysis_input','analysis_result','analysis_error','recording_transcript'].includes(d.key.kind));
    assert(linked.length===4&&linked.filter(d=>d.is_null).length===1,'related_four_slot_coverage_changed');
    const values=[];
    for(const d of linked)values.push((await noteProtectionReader.read(before.scope,before.catalog,d,async()=>password)).value);
    assert(values.some(v=>v==='HTTP-QA-LINKED-'+run+'\r\n')&&values.some(v=>v==='HTTP-QA-TRANSCRIPT-'+run+'\r\n')&&values.includes(null),'related_original_meaning_changed');
    await action('create',()=>!dialog().querySelector('.protection-editor').classList.contains('hidden'));
    const editor=dialog().querySelector('.protection-draft');editor.value='HTTP-QA-RELATED-CURRENT-'+run+'\n';editor.dispatchEvent(new Event('input',{bubbles:true}));
    await drive(()=>status().includes('초안 저장됨'),'related_create_draft');
    globalThis.__HTTP_CAPTURE_DONE__=undefined;emit({stage:'related_create_ready',owner:a.owner,local_id:target});
    for(let i=0;i<100&&!globalThis.__HTTP_CAPTURE_DONE__;i++)await new Promise(r=>setTimeout(r,50));
    assert(globalThis.__HTTP_CAPTURE_DONE__===true,'related_create_capture_failed');
    await action('save',()=>status().includes('전환 준비 가능'));
    const after=await inspectNoteProtection();
    assert(after.catalog.context.base.current_exists&&after.catalog.context.base.identity_state==='coherent'
      &&after.catalog.context.base.head_version===before.catalog.context.base.head_version+1
      &&after.catalog.context.base.history_generation===before.catalog.context.base.history_generation+1,'related_create_wrong_result');
    assert(after.catalog.entries.some(d=>d.key.kind==='revision_before'&&d.is_null),'related_create_before_not_null');
    for(let i=0;i<linked.length;i++){
      assert(after.catalog.entries.some(d=>NowNoteProtectionProtocol.canonicalJson(d)===NowNoteProtectionProtocol.canonicalJson(linked[i])),'related_create_changed_linked_descriptor');
      const actual=await noteProtectionReader.read(after.scope,after.catalog,linked[i],async()=>password);
      assert(NowNoteProtectionProtocol.canonicalJson(actual.value)===NowNoteProtectionProtocol.canonicalJson(values[i]),'related_create_changed_linked_value');
    }
    const inventory=after.catalog.entries.find(d=>d.key.kind==='inventory_snapshot'&&d.key.id===String(after.catalog.context.selected_physical_note_id));
    const current=await noteProtectionReader.read(after.scope,after.catalog,inventory,async()=>password);
    assert(current.value.note.content==='HTTP-QA-RELATED-CURRENT-'+run+'\n','related_created_current_wrong_content');
    for(const store of protectionStorageAdapters()){
      const value=await store.read(),prefixes=['HTTP-QA-LINKED-','HTTP-QA-RESULT-','HTTP-QA-TRANSCRIPT-','HTTP-QA-RELATED-CURRENT-'];
      if(prefixes.some(prefix=>JSON.stringify(value).includes(prefix+run))){
        emit({stage:'related_plaintext_store',owner:a.owner,local_id:target,code:store.name+(store.ephemeral?':ephemeral':':persistent')});
        let count=0;
        function scan(v,path){
          if(typeof v==='string'&&prefixes.some(prefix=>v.includes(prefix+run))){
            if(count++<12)emit({stage:'related_plaintext_path',owner:a.owner,local_id:target,code:path.map(k=>/^(?:[A-Za-z_]{1,30}|[0-9]{1,5})$/.test(String(k))?String(k):'*').join('.')});
          }else if(v&&typeof v==='object')for(const [key,child]of Object.entries(v))scan(child,[...path,key]);
        }
        scan(value,[]);throw Error('related_scope_local_plaintext_residue');
      }
    }
    button('lock').click();clearWebSession();await login(b);
    assert(!(await refreshProtectionTargets()).includes(target)&&!protectionTargets().includes(target),'other_account_inherited_related_target');
    clearWebSession();return {ok:true,mode:config.mode,phase:10,relatedOnlyDiscovered:true,createdCurrent:true,linkedPreserved:true,nullBefore:true,accountIsolation:true};
  }
  if(config.phase===7){
    state.selectedTreeId=target;render();await settle();await open();
    const marker=Object.values(noteHistory.protectionOperations()).find(m=>m.scope.local_id===target&&m.phase==='applying');
    assert(marker,'MI_restart_pending_absent');
    const original=NowNoteProtectionProtocol.parseJson(await NowNoteProtectionProtocol.decryptContent(marker.cipher_bundle,password));
    assert(original.intent.purpose==='mixed_offline_import'&&original.receipt.operation_id===original.prepared.id,'MI_restart_original_bundle_changed');
    const originalCipher=original.work.local.record.protection_record.ciphertext;
    await action('resume',()=>Object.values(noteHistory.protectionOperations()).every(m=>m.phase==='complete'));
    const after=await inspectNoteProtection(),key=NowNoteHistory.key(after.scope),record=noteHistory.export().contexts[key].notes[target];
    assert(after.catalog.context.base.head_version===6,'MI_restart_created_another_operation');
    assert(record.protection_record.ciphertext===originalCipher,'MI_restart_resealed_local_cipher');
    const value=await noteProtectionClient.openArchive(after.scope,record,password),branch=original.work.branches[0];
    assert(NowNoteProtectionProtocol.canonicalJson(value.outbox)===NowNoteProtectionProtocol.canonicalJson(original.intent.local_journal.outbox)
      &&NowNoteProtectionProtocol.canonicalJson(value.draft)===NowNoteProtectionProtocol.canonicalJson(original.intent.local_journal.draft)&&value.dirty,'MI_restart_acknowledged_current');
    const descriptor=after.catalog.entries.find(d=>d.key.kind==='offline_snapshot'&&d.key.id===branch.revision_id);
    const actual=await noteProtectionReader.read(after.scope,after.catalog,descriptor,async()=>password);
    assert(NowNoteProtectionProtocol.canonicalJson(actual.value)===NowNoteProtectionProtocol.canonicalJson(branch.snapshot),'MI_restart_changed_original_FULL15');
    assert(descriptor.ciphertext_sha256===original.work.transfers[0].descriptor.ciphertext_sha256,'MI_restart_reencrypted_branch');
    const checked=await noteProtectionRemote.status(after.scope,original.prepared,original.work);
    assert(checked.state==='committed'&&checked.receipt.operation_id===original.prepared.id,'MI_restart_not_original_receipt');
    const otherCurrent=await request('/api/v2/notes/current?'+query(other));assert(otherCurrent.snapshot.note.content==='HTTP-QA-PRESERVE-'+run,'MI_restart_changed_other');
    for(const store of protectionStorageAdapters())assert(!JSON.stringify(await store.read()).includes('HTTP-QA-IMPORT-'+run),'MI_restart_plaintext_residue');
    emit({stage:'MI_restart_original_operation_complete',owner:a.owner,local_id:target,operation_id:original.prepared.id,local_operation_id:marker.id,phase:'complete',server_instance_id:after.scope.instance});
    clearWebSession();return {ok:true,mode:config.mode,phase:7,serverEpoch:2,headVersion:6,originalImportOperationResumed:true,exactServerAndLocalCipherReused:true,unsentCurrentPreserved:true,otherPreserved:true};
  }
  if(config.phase===6){
    const source=await request('/api/v2/notes/revision?'+query(target,{revision_kind:'offline_branch',revision_id:config.branchId}));
    const baseline=await identity();assert(baseline.identity_state==='branch_only'&&!baseline.current_exists,'create_fixture_has_current');
    noteHistoryProjection=true;
    try{await noteHistory.track(source.snapshot.note,{...baseline,snapshot:source.snapshot,replica_count:0},{localOnly:true});noteHistoryProject(source.snapshot.note);}finally{noteHistoryProjection=false;}
    state.selectedTreeId=target;render();persist();await settle();await open();
    const boxes=[...dialog().querySelectorAll('.protection-copies input')];boxes.forEach(e=>e.checked=true);
    if(boxes.length)await action('confirm',()=>!dialog().querySelector('.protection-copies input'));
    await action('conversion',()=>Object.values(noteHistory.protectionOperations()).length===1&&Object.values(noteHistory.protectionOperations()).every(m=>m.phase==='complete'));
    const before=await inspectNoteProtection();assert(before.catalog.context.current_mode==='absent','converted_branch_created_current');
    const branch=before.catalog.entries.find(d=>d.key.kind==='offline_snapshot'&&d.key.id===config.branchId);
    assert(branch,'converted_original_branch_absent');
    const original=await noteProtectionReader.read(before.scope,before.catalog,branch,async()=>password);
    async function capture(){emit({stage:'editor_ready',owner:a.owner,local_id:target});for(let i=0;i<100&&!globalThis.__HTTP_CAPTURE_DONE__;i++)await new Promise(r=>setTimeout(r,50));assert(globalThis.__HTTP_CAPTURE_DONE__===true,'create_editor_capture_failed');}
    const complete=()=>Object.values(noteHistory.protectionOperations()).length===2&&Object.values(noteHistory.protectionOperations()).every(m=>m.phase==='complete');
    if(config.restoreAbsent){
      const record=noteHistory.export().contexts?.[NowNoteHistory.key(noteHistoryContext())]?.notes?.[target];
      if(record?.protection_record){
        const value=await noteProtectionClient.openArchive(before.scope,record,password),fields=['id','owner_id','local_id','device_id','note_type','title','content','parent_local_id','level','tags','source','deleted_at','created_at','updated_at','client_updated_at'];
        const rawFields=fields.filter(f=>JSON.stringify(value.raw?.[f])!==JSON.stringify(value.draft?.[f])),sourceFields=fields.filter(f=>JSON.stringify(original.value.note[f])!==JSON.stringify(value.draft?.[f]));
        emit({stage:'restore_local_copy_field_differences',owner:a.owner,local_id:target,code:'dirty_'+Boolean(value.dirty)+'_raw_'+rawFields.join('+')+'_source_'+sourceFields.join('+')});
      }
      const select=dialog().querySelector('[name="representation"]');select.selectedIndex=before.rows.findIndex(r=>r.kind==='typed'&&r.descriptor.key.kind==='offline_snapshot'&&r.descriptor.key.id===config.branchId);select.dispatchEvent(new Event('change',{bubbles:true}));
      assert(!button('restore').disabled,'absent_restore_control_disabled');await action('restore',complete);
    }else{
      await action('create',()=>!dialog().querySelector('.protection-editor').classList.contains('hidden'));
      const title=dialog().querySelector('.protection-title'),editor=dialog().querySelector('.protection-draft');
      title.value='HTTP QA created current';editor.value='HTTP-QA-CREATED-'+run+'\n';editor.dispatchEvent(new Event('input',{bubbles:true}));
      await drive(()=>status().includes('초안 저장됨'),'create_draft');await capture();await action('save',complete);
    }
    const after=await inspectNoteProtection();assert(after.catalog.context.base.head_version===2&&after.catalog.context.current_mode==='protected','create_current_not_published_once');
    const currentDescriptor=after.catalog.entries.find(d=>d.key.kind==='inventory_snapshot');
    const current=await noteProtectionReader.read(after.scope,after.catalog,currentDescriptor,async()=>password);
    const expected=config.restoreAbsent?original.value.note:{content:'HTTP-QA-CREATED-'+run+'\n',title:'HTTP QA created current'};
    assert(current.value.note.content===expected.content&&current.value.note.title===expected.title,'created_current_meaning_changed');
    assert(current.value.note.id!==null&&current.value.note.device_id===a.device,'created_current_server_fields_missing');
    assert(current.value.note.created_at!==original.value.note.created_at,'absent_write_reused_original_creation_time');
    const local=noteHistory.export().contexts[NowNoteHistory.key(noteHistoryContext())].notes[target];
    const settled=await noteProtectionClient.openArchive(after.scope,local,password);
    assert(!settled.localOnly&&NowNoteProtectionProtocol.canonicalJson(settled.raw)===NowNoteProtectionProtocol.canonicalJson(current.value.note),'absent_write_local_journal_not_settled');
    const kept=after.catalog.entries.find(d=>d.key.kind==='offline_snapshot'&&d.key.id===config.branchId);
    assert(NowNoteProtectionProtocol.canonicalJson(kept)===NowNoteProtectionProtocol.canonicalJson(branch),'create_rewrote_original_branch_descriptor');
    const preserved=await noteProtectionReader.read(after.scope,after.catalog,kept,async()=>password);
    assert(NowNoteProtectionProtocol.canonicalJson(preserved.value)===NowNoteProtectionProtocol.canonicalJson(original.value),'create_changed_original_branch_full15');
    const beforeSlot=after.catalog.entries.find(d=>d.key.kind==='revision_before'&&d.key.id===after.catalog.context.base.head_revision_id);assert(beforeSlot?.is_null,'create_before_not_null');
    const otherNote=await request('/api/v2/notes/current?'+query(other));assert(otherNote.snapshot.note.content==='HTTP-QA-PRESERVE-'+run,'create_changed_other');
    if(config.restoreAbsent){
      const select=dialog().querySelector('[name="representation"]');select.selectedIndex=after.rows.findIndex(r=>r.kind==='typed'&&r.descriptor.key.kind==='inventory_snapshot');await action('read',()=>dialog().querySelector('.protection-plain').textContent===expected.content);await capture();
      for(const field of ['note_type','parent_local_id','level','tags','source','deleted_at'])assert(current.value.note[field]===original.value.note[field],'absent_restore_full_meaning_changed');
    }
    for(const store of protectionStorageAdapters())assert(!JSON.stringify(await store.read()).includes((config.restoreAbsent?'HTTP-QA-BRANCH-':'HTTP-QA-CREATED-')+run),'create_plaintext_persisted');
    for(const marker of Object.values(noteHistory.protectionOperations())){const bundle=NowNoteProtectionProtocol.parseJson(await NowNoteProtectionProtocol.decryptContent(marker.cipher_bundle,password));emit({stage:config.restoreAbsent?'branch_restore_original_operation_complete':'branch_create_original_operation_complete',owner:a.owner,local_id:target,operation_id:bundle.prepared.id,local_operation_id:marker.id,phase:marker.phase,server_instance_id:after.scope.instance});}
    clearWebSession();return {ok:true,mode:config.mode,phase:6,serverEpoch:1,headVersion:2,createFromBranchOnly:!config.restoreAbsent,restoreFromBranchOnly:config.restoreAbsent===true,originalBranchFull15AndCipherPreserved:true,beforeNull:true,otherPreserved:true};
  }
  if(config.phase===5){
    assert(!noteHistory.export().contexts?.[NowNoteHistory.key(noteHistoryContext())]?.notes?.[target],'fresh_profile_inherited_journal');
    await loadServerSharedNotes();await settle();state.selectedTreeId=target;render();await open();
    await action('edit',()=>!dialog().querySelector('.protection-editor').classList.contains('hidden'));
    const initial=noteHistory.export().contexts[NowNoteHistory.key(noteHistoryContext())].notes[target];
    assert(initial.protection_record&&!JSON.stringify(initial).includes('HTTP-QA-EDITED-'),'fresh_editor_journal_not_ciphertext');
    const editor=dialog().querySelector('.protection-draft');assert(editor.value==='HTTP-QA-EDITED-'+run+'\n','fresh_editor_wrong_current');
    editor.value='HTTP-QA-FRESH-EDITOR-'+run+'\n';editor.dispatchEvent(new Event('input',{bubbles:true}));await drive(()=>status().includes('초안 저장됨'),'fresh_draft');
    await action('save',()=>Object.values(noteHistory.protectionOperations()).some(m=>m.scope.local_id===target&&m.phase==='complete')&&!dialog().querySelector('.protection-draft').value);
    const after=await inspectNoteProtection();assert(after.catalog.context.base.head_version===6,'fresh_editor_save_not_single_write');
    const descriptor=after.catalog.entries.find(d=>d.key.kind==='inventory_snapshot');
    const current=await noteProtectionReader.read(after.scope,after.catalog,descriptor,async()=>password);
    assert(current.value.note.content==='HTTP-QA-FRESH-EDITOR-'+run+'\n','fresh_editor_server_meaning_changed');
    for(const store of protectionStorageAdapters())assert(!JSON.stringify(await store.read()).includes('HTTP-QA-FRESH-EDITOR-'+run),'fresh_editor_plaintext_persisted');
    const otherNote=await request('/api/v2/notes/current?'+query(other));assert(otherNote.snapshot.note.content==='HTTP-QA-PRESERVE-'+run,'fresh_editor_changed_other');
    emit({stage:'fresh_profile_cipher_journal_editor_saved',owner:a.owner,local_id:target,phase:'complete',server_instance_id:after.scope.instance});
    clearWebSession();return {ok:true,mode:config.mode,phase:5,serverEpoch:2,headVersion:6,freshProfileJournalInitialized:true,otherPreserved:true};
  }
  if(config.phase===1) {
    const original=await request('/api/v2/notes/current?'+query(target)),otherCurrent=await request('/api/v2/notes/current?'+query(other));
    const baseline=structuredClone(original.snapshot.note);delete baseline.content;
    localStorage.setItem('qa-http-'+run+'-public-baseline',JSON.stringify(baseline));
    noteHistoryProjection=true;
    try{for(const current of config.parentMode?[otherCurrent,original]:[original,otherCurrent]){await noteHistory.track(current.snapshot.note,current);noteHistoryProject(current.snapshot.note);}}finally{noteHistoryProjection=false;}
    state.selectedTreeId=target;render();persist();await settle();await open();
    const boxes=[...dialog().querySelectorAll('.protection-copies input')];assert(boxes.length>0,'real_copy_list_empty');
    boxes[0].checked=true;
    if(boxes.length>1){await action('confirm',()=>status().includes('confirmation_incomplete'));assert(!findTreeNode(state.data.tree,target).protectionScope,'partial_confirmation_changed_source');}
    boxes.forEach(e=>e.checked=true);await action('confirm',()=>!dialog().querySelector('.protection-copies input'));
    let restore;
    if(!isDesktopClient()) {
      const originalSet=Storage.prototype.setItem;let fail=true;
      Storage.prototype.setItem=function(k,v){if(fail&&k===NOTE_HISTORY_KEY&&Object.values(JSON.parse(v).protection_operations||{}).some(m=>m.phase==='complete')){fail=false;throw Error('qa_local_quota_failure');}return originalSet.call(this,k,v);};
      restore=()=>Storage.prototype.setItem=originalSet;
    }
    try{await action('conversion',()=>Object.values(noteHistory.protectionOperations()).some(m=>m.phase==='applying'));}finally{restore?.();}
    const marker=Object.values(noteHistory.protectionOperations()).find(m=>m.scope.local_id===target&&m.phase!=='complete');
    assert(marker?.phase==='applying','real_server_commit_not_locally_pending');
    emit({stage:'conversion_server_done_local_pending',owner:a.owner,local_id:target,operation_id:marker.id,phase:marker.phase,server_instance_id:marker.scope.instance});
    const current=await identity();assert(current.crypto_epoch===1,'real_initial_conversion_not_published');
    clearWebSession();await login(b);assert(noteProtection.pending()===0,'other_account_inherited_pending');clearWebSession();
    return {ok:true,mode:config.mode,phase:1,owner:a.owner,local_id:target,serverEpoch:1,localPhase:'applying',accountIsolation:true};
  }
  state.selectedTreeId=findTreeNode(state.data.tree,target)?target:null;render();await settle();await open();
  if(config.phase===8||config.phase===9){
    const before=await inspectNoteProtection();assert(before.catalog.context.base.head_version===5,'offline_draft_changed_server_before_reconnect');
    await action('edit',()=>!dialog().querySelector('.protection-editor').classList.contains('hidden'));
    const editor=dialog().querySelector('.protection-draft'),content='HTTP-QA-OFFLINE-DRAFT-'+run+'\n';
    if(config.phase===8){
      emit({stage:'offline_draft_start',owner:a.owner,local_id:target});
      for(let i=0;i<100&&!globalThis.__HTTP_QA_OFFLINE_ACK__;i++)await wait();
      assert(globalThis.__HTTP_QA_OFFLINE_ACK__===true,'offline_transport_not_blocked');
      let blocked=false;try{await fetch(url+'/health/ready',{cache:'no-store'});}catch{blocked=true;}
      assert(blocked,'offline_transport_still_available');
      editor.value=content;editor.dispatchEvent(new Event('input',{bubbles:true}));
      await drive(()=>status().includes('초안 저장됨'),'offline_local_draft');
      for(const store of protectionStorageAdapters())assert(!JSON.stringify(await store.read()).includes('HTTP-QA-OFFLINE-DRAFT-'+run),'offline_draft_plaintext_persisted');
      button('lock').click();assert(!editor.value,'offline_draft_lock_retained_plaintext');
      clearWebSession();return {ok:true,mode:config.mode,phase:8,transportBlocked:true,cipherDraftPersisted:true,headVersion:5};
    }
    assert(editor.value===content,'offline_draft_cold_restart_lost_content');
    await action('save',()=>status().includes('전환 준비 가능'));
    const after=await inspectNoteProtection(),d=after.catalog.entries.find(d=>d.key.kind==='inventory_snapshot'&&d.key.id===String(after.catalog.context.selected_physical_note_id));
    const current=await noteProtectionReader.read(after.scope,after.catalog,d,async()=>password);
    assert(after.catalog.context.base.head_version===6&&current.value.note.content===content,'offline_draft_reconnect_not_saved_once');
    button('lock').click();clearWebSession();return {ok:true,mode:config.mode,phase:9,coldRestartRecovered:true,reconnectedSave:true,headVersion:6};
  }
  if(config.phase===4){
    const before=await inspectNoteProtection();assert(before.catalog.context.base.head_version===5,'draft_only_restart_changed_server');
    await action('edit',()=>!dialog().querySelector('.protection-editor').classList.contains('hidden'));
    assert(dialog().querySelector('.protection-draft').value==='HTTP-QA-DRAFT-ONLY-'+run+'\n','draft_only_cold_restart_lost_content');
    await action('save',()=>status().includes('전환 준비 가능'));
    const after=await inspectNoteProtection();assert(after.catalog.context.base.head_version===6,'recovered_draft_not_saved_once');
    const descriptor=after.catalog.entries.find(d=>d.key.kind==='inventory_snapshot');
    const current=await noteProtectionReader.read(after.scope,after.catalog,descriptor,async()=>password);
    assert(current.value.note.content==='HTTP-QA-DRAFT-ONLY-'+run+'\n','recovered_draft_server_meaning_changed');
    emit({stage:'draft_only_restart_saved_once',owner:a.owner,local_id:target,phase:'complete',server_instance_id:after.scope.instance});
    clearWebSession();return {ok:true,mode:config.mode,phase:4,serverEpoch:2,headVersion:6,draftOnlyColdRestart:true,compositionEventsOnly:true};
  }
  assert(status().includes('적용 필요'),'real_cold_restart_lost_pending');
  if(config.phase===3){
    const select=dialog().querySelector('[name="representation"]');
    select.selectedIndex=[...select.options].findIndex(o=>o.textContent.includes('store:'+NOTE_HISTORY_KEY)||o.textContent.includes('history'));
    assert(select.selectedIndex>=0,'restarted_MW_journal_archive_absent');
    await action('read',()=>dialog().querySelector('.protection-plain').textContent.includes('HTTP-QA-EDITED-'+run));
    button('lock').click();
    const pending=Object.values(noteHistory.protectionOperations()).find(m=>m.scope.local_id===target&&m.phase==='applying');
    assert(pending,'restarted_MW_pending_absent');
    const original=NowNoteProtectionProtocol.parseJson(await NowNoteProtectionProtocol.decryptContent(pending.cipher_bundle,password));
    await action('resume',()=>Object.values(noteHistory.protectionOperations()).every(m=>m.phase==='complete'));
    const after=await inspectNoteProtection();assert(after.catalog.context.base.head_version===5,'MW_resume_created_another_revision');
    const descriptor=after.catalog.entries.find(d=>d.key.kind==='inventory_snapshot');
    const current=await noteProtectionReader.read(after.scope,after.catalog,descriptor,async()=>password);
    assert(current.value.note.content==='HTTP-QA-EDITED-'+run+'\n','MW_resume_changed_editor_content');
    emit({stage:'MW_restart_same_operation_complete',owner:a.owner,local_id:target,operation_id:original.prepared.id,local_operation_id:pending.id,phase:'complete',server_instance_id:after.scope.instance});
    await action('edit',()=>!dialog().querySelector('.protection-editor').classList.contains('hidden'));
    const editor=dialog().querySelector('.protection-draft'),beforeDraft=JSON.stringify(noteHistory.export());
    editor.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'QA'}));
    editor.value='HTTP-QA-DRAFT-ONLY-'+run+'\n';editor.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true,data:'QA'}));
    assert(button('save').disabled,'composition_allowed_server_save');
    assert(JSON.stringify(noteHistory.export())===beforeDraft,'composition_sealed_before_end');
    editor.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'QA'}));
    await drive(()=>status().includes('초안 저장됨'),'composition_draft');
    for(const store of protectionStorageAdapters())assert(!JSON.stringify(await store.read()).includes('HTTP-QA-DRAFT-ONLY-'+run),'draft_only_persisted_plaintext');
    button('lock').click();assert(!editor.value,'draft_only_lock_retained_plaintext');
    emit({stage:'draft_only_cipher_durable_before_restart',owner:a.owner,local_id:target});
    clearWebSession();return {ok:true,mode:config.mode,phase:3,serverEpoch:2,headVersion:5,originalOperationResumed:true,recoveredCipherDraft:true,draftOnlyPersisted:true,compositionEventsOnly:true};
  }
  await action('resume',()=>status().includes('operation')||status().includes('decrypt')||status().includes('실패'),'wrong-key');
  assert(Object.values(noteHistory.protectionOperations()).some(m=>m.phase==='applying'),'wrong_key_changed_pending');
  await action('resume',()=>Object.values(noteHistory.protectionOperations()).every(m=>m.phase==='complete'));
  const select=dialog().querySelector('[name="representation"]');
  select.selectedIndex=[...select.options].findIndex(o=>o.textContent.startsWith('이 기기'));
  assert(select.selectedIndex>=0,'real_local_archive_absent');await action('read',()=>dialog().querySelector('.protection-plain').textContent===plain);
  button('lock').click();assert(!dialog().querySelector('.protection-plain').textContent,'real_lock_retained_plaintext');
  await action('current_plain_transition',()=>status().includes('전환 준비 가능'));
  const cpInfo=await inspectNoteProtection(),scope=cpInfo.scope,catalog=cpInfo.catalog;
  assert(catalog.context.current_mode==='plain'&&catalog.context.base.crypto_epoch===1,'real_CP_mode_failed');
  const before=catalog.entries.filter(d=>d.key.kind==='revision_before'&&!d.is_null);
  assert(before.some(d=>d.representation_epoch>0),'real_CP_lost_cipher_before');
  const q={schema_version:3,owner_id:a.owner,local_id:target,device_id:a.device,server_instance_id:scope.instance,expected_context:btoa(NowNoteProtectionProtocol.canonicalJson(catalog.context)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'),catalog_digest:catalog.catalog_digest};
  const plainCurrent=await request('/api/v2/notes/mixed-representations/current?'+new URLSearchParams(q));
  assert(plainCurrent.note.content===plain,'real_CP_plain_content_changed');
  const publicNote=structuredClone(plainCurrent.note);delete publicNote.content;
  assert(NowNoteProtectionProtocol.canonicalJson(publicNote)===NowNoteProtectionProtocol.canonicalJson(JSON.parse(localStorage.getItem('qa-http-'+run+'-public-baseline'))),'real_FULL15_public_fields_changed');
  await action('mixed_conversion',()=>status().includes('전환 준비 가능'));
  const rcInfo=await inspectNoteProtection();assert(rcInfo.catalog.context.current_mode==='protected'&&rcInfo.catalog.context.base.crypto_epoch===2,'real_RC_mode_failed');
  let replicaBaseline=null;
  if(config.replicaIds){
    const ids=rcInfo.catalog.entries.filter(d=>d.key.kind==='inventory_snapshot').map(d=>Number(d.key.id)).sort((a,b)=>a-b);
    assert(JSON.stringify(ids)===JSON.stringify(config.replicaIds),'replica_inventory_not_exact_pair');
    const selected=rcInfo.catalog.context.selected_physical_note_id,otherId=ids.find(id=>id!==selected);
    assert(selected===Math.max(...ids),'replica_selected_wrong_current');
    const descriptors=rcInfo.catalog.entries.filter(d=>['note_body','inventory_snapshot'].includes(d.key.kind)&&d.key.id===String(otherId));
    assert(descriptors.length===2,'nonselected_replica_missing');
    const value=await noteProtectionReader.read(scope,rcInfo.catalog,descriptors.find(d=>d.key.kind==='inventory_snapshot'),async()=>password);
    replicaBaseline={selected,descriptors,value:value.value};
  }
  let parentBaseline=null;
  if(config.parentMode){
    const inv=rcInfo.catalog.entries.find(d=>d.key.kind==='inventory_snapshot');
    const child=await noteProtectionReader.read(scope,rcInfo.catalog,inv,async()=>password);
    assert(child.value.note.parent_local_id===other&&child.value.note.level===2,'parent_fixture_not_child');
    if(config.parentMode==='mixed'){
      dialog().close();state.selectedTreeId=other;render();await settle();await open();
      for(const store of protectionStorageAdapters()){
        const raw=await store.read();
        try{NowNoteProtectionProtocol.canonicalJson(raw);}catch{
          const paths=[],seen=new Set();
          const scan=(v,path)=>{
            if(['undefined','bigint','symbol','function'].includes(typeof v)){paths.push(typeof v+':'+path.join('/'));return;}
            if(!v||typeof v!=='object'||seen.has(v))return;seen.add(v);
            for(const [k,child]of Object.entries(v))scan(child,[...path,k]);
          };
          scan(raw,[]);
          for(const field of paths.slice(0,6))emit({stage:'parent_confirmation_non_json_store',owner:a.owner,local_id:other,code:store.name+':'+field});
        }
      }
      const boxes=[...dialog().querySelectorAll('.protection-copies input')];boxes.forEach(e=>e.checked=true);
      await action('confirm',()=>!dialog().querySelector('.protection-copies input'));
      await action('conversion',()=>Object.values(noteHistory.protectionOperations()).some(m=>m.scope.local_id===other&&m.phase==='complete'));
      const parent=await inspectNoteProtection();parentBaseline=parent.catalog;
      assert(parent.catalog.context.base.crypto_epoch===1&&parent.catalog.context.current_mode==='protected','parent_not_protected');
      dialog().close();state.selectedTreeId=target;render();await settle();await open();
    }
  }
  let peerPlain=plain;
  if(config.editorWrite) {
    assert(getComputedStyle(dialog().querySelector('.protection-editor')).display==='none','editor_not_hidden_before_open');
    await action('edit',()=>!dialog().querySelector('.protection-editor').classList.contains('hidden'));
    if(config.editorRestart&&!isDesktopClient()){
      const before=localStorage.getItem(NOTE_HISTORY_KEY),request=navigator.locks.request.bind(navigator.locks);let release,entered=false;
      const held=request(NOTE_HISTORY_KEY,()=>new Promise(resolve=>{release=resolve;}));
      for(let i=0;i<100&&!release;i++)await wait();assert(release,'web_lock_not_acquired');
      navigator.locks.request=(name,...args)=>{if(name===NOTE_HISTORY_KEY)entered=true;return request(name,...args);};
      try{
        const editor=dialog().querySelector('.protection-draft');editor.value='HTTP-QA-CANCELLED-'+run;editor.dispatchEvent(new Event('input',{bubbles:true}));
        const editing=noteProtectionEditSession;
        for(let i=0;i<500&&!entered;i++)await wait();assert(entered,'draft_never_waited_for_web_lock');
        button('lock').click();release();await held;await editing.queue.catch(()=>{});
        assert(localStorage.getItem(NOTE_HISTORY_KEY)===before,'lock_changed_persisted_cipher');
        assert(JSON.stringify(noteHistory.export())===before,'lock_retained_cancelled_memory_projection');
        assert(!dialog().querySelector('.protection-draft').value,'locked_editor_retained_plaintext');
        emit({stage:'actual_web_lock_cancelled_cipher_CAS',owner:a.owner,local_id:target});
      }finally{release?.();navigator.locks.request=request;}
      await action('edit',()=>!dialog().querySelector('.protection-editor').classList.contains('hidden'));
    }
    if(config.editorView) {
      const editor=dialog().querySelector('.protection-draft'),original=editor.value;
      editor.focus();editor.setSelectionRange(editor.value.length,editor.value.length);
      document.execCommand('insertText',false,'\n## HTTP-QA-VIEW-'+run+'\n\n<details><summary>Fold</summary>\n\n**Bold**\n\n</details>\n\nhttps://example.invalid/qa\n\n<script>globalThis.__QA_BAD_VIEW__=true</script>');
      await drive(()=>status().includes('초안 저장됨'),'view_draft');
      const edited=editor.value,selection=[editor.selectionStart,editor.selectionEnd],beforeView=JSON.stringify(noteHistory.export());
      await action('editor-preview',()=>!dialog().querySelector('.protection-preview').classList.contains('hidden'));
      const preview=dialog().querySelector('.protection-preview');
      assert(preview.querySelector('h2')?.textContent==='HTTP-QA-VIEW-'+run,'view_heading_missing');
      assert([...preview.querySelectorAll('summary')].some(s=>s.textContent.trim()==='Fold')&&preview.querySelector('strong')?.textContent==='Bold','view_details_bold_missing');
      assert([...preview.querySelectorAll('a')].some(a=>a.href==='https://example.invalid/qa'),'view_url_missing');
      assert(!preview.querySelector('script,[onerror],iframe,img[src]')&&!globalThis.__QA_BAD_VIEW__,'view_unsafe_html');
      assert(getComputedStyle(editor.parentElement).display==='none'&&editor.value===edited&&JSON.stringify(noteHistory.export())===beforeView,'view_modified_source_or_journal');
      globalThis.__HTTP_CAPTURE_DONE__=false;emit({stage:'editor_view_ready',owner:a.owner,local_id:target});
      for(let i=0;i<100&&!globalThis.__HTTP_CAPTURE_DONE__;i++)await new Promise(r=>setTimeout(r,50));
      assert(globalThis.__HTTP_CAPTURE_DONE__===true,'view_capture_failed');
      await action('editor-source',()=>dialog().querySelector('.protection-preview').classList.contains('hidden'));
      assert(editor.selectionStart===selection[0]&&editor.selectionEnd===selection[1],'view_selection_changed');
      editor.focus();assert(document.execCommand('undo'),'view_native_undo_failed');
      await drive(()=>status().includes('초안 저장됨'),'view_undo_draft');assert(editor.value===original,'view_undo_lost_source');
      assert(document.execCommand('redo'),'view_native_redo_failed');
      await drive(()=>status().includes('초안 저장됨'),'view_redo_draft');assert(editor.value===edited,'view_redo_changed_source');
      button('lock').click();assert(!editor.value&&!preview.textContent,'view_lock_retained_plaintext');
      const clean=dialog().querySelector('.protection-draft');assert(clean!==editor&&!clean.value,'view_lock_retained_native_history');
      await action('edit',()=>!dialog().querySelector('.protection-editor').classList.contains('hidden'));
      assert(dialog().querySelector('.protection-draft').value===edited,'view_cipher_draft_not_recovered');
      emit({stage:'editor_view_source_undo_verified',owner:a.owner,local_id:target});
    }
    peerPlain='HTTP-QA-EDITED-'+run+'\n';
    const editor=dialog().querySelector('.protection-draft');
    editor.value=peerPlain;editor.dispatchEvent(new Event('input',{bubbles:true}));
    await drive(()=>status().includes('초안 저장됨'),'draft');
    emit({stage:'editor_ready',owner:a.owner,local_id:target});
    for(let i=0;i<100&&!globalThis.__HTTP_CAPTURE_DONE__;i++)await new Promise(r=>setTimeout(r,50));
    assert(globalThis.__HTTP_CAPTURE_DONE__===true,'editor_capture_failed');
    let restore;
    if(config.editorRestart&&!isDesktopClient()){
      const set=Storage.prototype.setItem;let fail=true;
      Storage.prototype.setItem=function(k,v){
        if(fail&&k===NOTE_HISTORY_KEY){const data=JSON.parse(v),before=JSON.parse(localStorage.getItem(k)),markers=Object.values(data.protection_operations||{}).filter(m=>m.scope.local_id===target);
          const changed=Object.entries(data.contexts||{}).some(([key,c])=>{const a=before.contexts?.[key]?.notes?.[target]?.protection_record,b=c.notes?.[target]?.protection_record;return a&&b&&a.operation_id!==b.operation_id;});
          if(markers.length===4&&markers.some(m=>m.phase==='applying')&&changed){fail=false;throw Error('qa_MW_journal_CAS_failure');}}
        return set.call(this,k,v);
      };restore=()=>Storage.prototype.setItem=set;
    }
    try{await action('save',()=>config.editorRestart?Object.values(noteHistory.protectionOperations()).some(m=>m.phase==='applying'):status().includes('전환 준비 가능'));}finally{restore?.();}
    if(config.editorRestart){assert(Object.values(noteHistory.protectionOperations()).filter(m=>m.phase==='applying').length===1,'MW_not_locally_pending');button('lock').click();}
    assert(!dialog().querySelector('.protection-draft').value,'editor_plaintext_survived_save_refresh');
  }
  if(config.mixedWrite) {
    const c=rcInfo.catalog,selected=String(c.context.selected_physical_note_id);
    const inv=c.entries.find(d=>d.key.kind==='inventory_snapshot'&&d.key.id===selected),body=c.entries.find(d=>d.key.kind==='note_body'&&d.key.id===selected);
    assert(inv&&body,'MW_selected_source_absent');
    const original=await noteProtectionReader.read(scope,c,inv,async()=>password),note=structuredClone(original.value.note),origins=[];
    peerPlain='HTTP-QA-EDITED-'+run+'\r\n';note.content=peerPlain;
    for(const d of c.entries){const value=await noteProtectionReader.read(scope,c,d,async()=>password);origins.push({key:d.key,descriptor:d,origin:value.origin});}
    const intent={schema_version:3,purpose:'mixed_note_write',note,source_origins:origins,prepare:{mutation_id:crypto.randomUUID(),base:c.context,expected_catalog_digest:c.catalog_digest,operation:'put',target_current_mode:'protected',
      selection:{physical_note_id:c.context.selected_physical_note_id,inventory_revision_ref:inv.revision_ref,note_representation_etag:body.representation_etag,inventory_representation_etag:inv.representation_etag},replica_policy:'selected_head_only',
      structure:Object.fromEntries(['note_type','parent_local_id','level','deleted_at'].map(k=>[k,note[k]])),parent_context:null,restore_source:null}};
    emit({stage:'MW_quote_requested',owner:a.owner,local_id:target,operation_id:intent.prepare.mutation_id});
    const prepared=await noteProtectionRemote.prepareWrite(scope,intent);
    emit({stage:'MW_prepared',owner:a.owner,local_id:target,operation_id:prepared.id});
    const work=await NowNoteProtectionClient.buildWriteWork(scope,prepared,intent,password,noteProtectionRemote,[],async()=>password);
    await noteProtectionRemote.stage(scope,prepared,work,password,[],async()=>password);
    const result=await noteProtectionRemote.commit(scope,prepared,work);
    assert(result.state==='committed'&&result.receipt_matches_current===true,'MW_commit_not_verified');
    const checked=await noteProtectionRemote.status(scope,prepared,work);
    assert(checked.state==='committed'&&checked.receipt_matches_current===true,'MW_status_not_verified');
    emit({stage:'MW_committed',owner:a.owner,local_id:target,operation_id:prepared.id,phase:'committed'});
  }
  const peer='qa-peer-'+run,issued=await request('/api/v1/auth/client-login','POST',{owner_id:a.owner,password:a.password,device_id:peer,device_name:'HTTP peer'},{});
  const peerScope={...scope,device:peer},peerReader=NowNoteProtectionClient.createReader({request:async(s,path,method,body)=>request(path+'?'+new URLSearchParams(body),method,undefined,{'X-Now-User-Token':issued.access_token})});
  const peerCatalog=await peerReader.catalog(peerScope);let peerOrigins=0,nulls=0;
  for(const descriptor of peerCatalog.entries) {
    const value=await peerReader.read(peerScope,peerCatalog,descriptor,async()=>password);
    if(descriptor.is_null)nulls++;
    if(value.origin.value)peerOrigins++;
    if(descriptor.key.kind==='inventory_snapshot')assert(value.value.note.content===(config.replicaIds&&Number(descriptor.key.id)!==peerCatalog.context.selected_physical_note_id?plain:peerPlain),'real_peer_plain_meaning_changed');
  }
  assert(peerOrigins>0&&nulls>0,'real_peer_origin_or_null_coverage_absent');
  if(config.importWrite){
    let plainModeReceipt=null;
    if(config.importPlain){
      const prior=new Set(Object.keys(noteHistory.protectionOperations()));
      await action('current_plain_transition',()=>status().includes('전환 준비 가능'));
      const marker=Object.values(noteHistory.protectionOperations()).find(m=>!prior.has(m.id));
      const bundle=NowNoteProtectionProtocol.parseJson(await NowNoteProtectionProtocol.decryptContent(marker.cipher_bundle,password));
      assert(bundle.receipt.result.current_mode==='plain'&&bundle.intent.purpose==='current_plain_transition','plain_setup_CP_receipt_absent');
      plainModeReceipt={operation_id:bundle.prepared.id,digest:await NowNoteProtectionProtocol.hashJson(bundle.receipt)};
    }
    const before=await inspectNoteProtection(),key=NowNoteHistory.key(before.scope);
    const record=noteHistory.export().contexts[key].notes[target],value=await noteProtectionClient.openArchive(before.scope,record,password);
    const revisionId=crypto.randomUUID(),originDevice='qa-original-'+run,parent_ref={kind:'note_revision',id:before.catalog.context.base.head_revision_id};
    const snapshot={schema_version:1,note:{...value.draft,content:'HTTP-QA-IMPORT-'+run+'\r\n'}};
    const originalRequest={id:crypto.randomUUID(),revision_id:revisionId,sent:false,operation:'put',waiting_for:null,body:{
      schema_version:1,owner_id:a.owner,local_id:target,device_id:originDevice,mutation_id:crypto.randomUUID(),crypto_epoch:2,
      base_head_version:before.catalog.context.base.head_version,base_revision_id:parent_ref.id,expected_inventory_revision_ids:before.catalog.context.base.inventory_revision_ids,
      note:Object.fromEntries(['note_type','title','content','parent_local_id','level','tags','source','deleted_at'].map(k=>[k,snapshot.note[k]]))}};
    value.revisions.push({revision_id:revisionId,parent_ref,snapshot,reason:'qa_original_pending',created_at:new Date().toISOString(),imported:false});
    value.outbox.push(originalRequest);
    const pendingBranches=[{revisionId,parent_ref,snapshot,originDevice}];
    if(config.importMultiple){
      const childId=crypto.randomUUID(),actor='qa-second-'+run,child={schema_version:1,note:{...snapshot.note,content:'HTTP-QA-IMPORT-CHILD-'+run+'\r\n'}};
      const parent={kind:'offline_branch',id:revisionId};
      value.revisions.push({revision_id:childId,parent_ref:parent,snapshot:child,reason:'qa_original_child_pending',created_at:new Date().toISOString(),imported:false});
      value.outbox.push({...structuredClone(originalRequest),id:crypto.randomUUID(),revision_id:childId,waiting_for:originalRequest.id,
        body:{...structuredClone(originalRequest.body),device_id:actor,mutation_id:crypto.randomUUID(),base_head_version:null,base_revision_id:null,
          note:{...structuredClone(originalRequest.body.note),content:child.note.content}}});
      pendingBranches.push({revisionId:childId,parent_ref:parent,snapshot:child,originDevice:actor});
    }
    value.draft=structuredClone(pendingBranches.at(-1).snapshot.note);value.dirty=true;
    const originalOutbox=NowNoteProtectionProtocol.canonicalJson(value.outbox),originalDraft=NowNoteProtectionProtocol.canonicalJson(value.draft);
    const sealed=await noteProtectionClient.sealJournal(before.scope,value,password,crypto.randomUUID());
    await noteProtectionClient.replaceJournal(before.scope,record,sealed,noteHistory);
    if(config.importPlain){
      const intent=NowNoteProtectionClient.planImport(before.scope,before.catalog,[{revision_id:revisionId,parent_ref,origin_device_id:originDevice,snapshot,representation:null}],[]);
      intent.prepare.entries[0].target_kind='snapshot_v1';intent.prepare.entries[0].target_epoch=0;
      intent.prepare.entries[0].provenance={kind:'post_plain_draft',origin_server_instance_id:before.scope.instance,origin_owner_id:before.scope.owner,
        mode_operation_id:plainModeReceipt.operation_id,mode_receipt_digest:plainModeReceipt.digest};
      const prepared=await noteProtectionRemote.prepareImport(before.scope,intent);
      const work=await NowNoteProtectionClient.buildImportWork(before.scope,prepared,intent,password,noteProtectionRemote,[],async()=>password);
      await noteProtectionRemote.stage(before.scope,prepared,work,password,[],async()=>password);
      const result=await noteProtectionRemote.commit(before.scope,prepared,work);
      assert(result.state==='committed'&&result.receipt_matches_current===true&&work.transfers.length===0,'plain_branch_public_setup_not_verified');
      emit({stage:'MI_plain_original_created',owner:a.owner,local_id:target,operation_id:prepared.id,phase:'committed'});
    }
    const previous=new Set(Object.keys(noteHistory.protectionOperations()));
    await action('refresh',()=>status().includes('전환 준비 가능'));
    await action('imports',()=>dialog().querySelectorAll('.protection-import-rows input:checked').length===pendingBranches.length);
    assert(pendingBranches.every(b=>[...dialog().querySelectorAll('.protection-import-rows input:checked')].some(input=>input.value===b.revisionId)),'MI_original_UUID_not_selected');
    globalThis.__HTTP_CAPTURE_DONE__=undefined;emit({stage:'import_ready',owner:a.owner,local_id:target});
    for(let i=0;i<100&&!globalThis.__HTTP_CAPTURE_DONE__;i++)await new Promise(r=>setTimeout(r,50));
    assert(globalThis.__HTTP_CAPTURE_DONE__===true,'import_capture_failed');
    let restoreImport;
    if(config.importRestart&&!isDesktopClient()){
      const set=Storage.prototype.setItem;let fail=true;
      Storage.prototype.setItem=function(k,v){
        if(fail&&k===NOTE_HISTORY_KEY){
          const data=JSON.parse(v),before=JSON.parse(localStorage.getItem(k)),markers=Object.values(data.protection_operations||{}).filter(m=>m.scope.local_id===target);
          const changed=Object.entries(data.contexts||{}).some(([key,c])=>{const a=before.contexts?.[key]?.notes?.[target]?.protection_record,b=c.notes?.[target]?.protection_record;return a&&b&&a.operation_id!==b.operation_id;});
          if(markers.length===5&&markers.some(m=>m.phase==='applying')&&changed){fail=false;throw Error('qa_MI_journal_CAS_failure');}
        }
        return set.call(this,k,v);
      };restoreImport=()=>Storage.prototype.setItem=set;
    }
    try{await action('import-selected',()=>Object.values(noteHistory.protectionOperations()).filter(m=>m.scope.local_id===target).length===previous.size+1
      &&(config.importRestart?Object.values(noteHistory.protectionOperations()).some(m=>m.phase==='applying'):Object.values(noteHistory.protectionOperations()).every(m=>m.phase==='complete')));}
    finally{restoreImport?.();}
    const marker=Object.values(noteHistory.protectionOperations()).find(m=>!previous.has(m.id));
    assert(marker,'MI_durable_marker_absent');
    const bundle=NowNoteProtectionProtocol.parseJson(await NowNoteProtectionProtocol.decryptContent(marker.cipher_bundle,password));
    assert(bundle.intent.purpose==='mixed_offline_import','MI_used_wrong_purpose');
    if(config.importRestart){
      assert(marker.phase==='applying'&&bundle.receipt.operation_id===bundle.prepared.id&&bundle.work.local.record.protection_record.ciphertext,'MI_not_pending_after_original_local_failure');
      const after=await noteProtectionReader.catalog(before.scope);assert(after.context.base.head_version===6,'MI_server_not_committed_before_restart');
      emit({stage:'MI_server_committed_local_pending_before_restart',owner:a.owner,local_id:target,operation_id:bundle.prepared.id,local_operation_id:marker.id,phase:'applying',server_instance_id:scope.instance});
      button('lock').click();clearWebSession();
      return {ok:true,mode:config.mode,phase:2,serverEpoch:2,headVersion:6,offlineImportServerCommitted:true,offlineImportVerified:false,localPhase:'applying'};
    }
    const after=await inspectNoteProtection();
    for(const branch of pendingBranches){
      const published=after.catalog.entries.find(d=>d.key.kind==='offline_snapshot'&&d.key.id===branch.revisionId);
      assert(published&&published.representation_epoch===(config.importPlain?0:2)&&NowNoteProtectionProtocol.canonicalJson(published.parent_ref)===NowNoteProtectionProtocol.canonicalJson(branch.parent_ref),'MI_original_branch_metadata_changed');
      const actual=await noteProtectionReader.read(after.scope,after.catalog,published,async()=>password);
      assert(NowNoteProtectionProtocol.canonicalJson(actual.value)===NowNoteProtectionProtocol.canonicalJson(branch.snapshot),'MI_original_FULL15_changed');
      assert(actual.origin.value.entries.find(e=>e.revision_id===branch.revisionId)?.origin_device_id===branch.originDevice,'MI_original_actor_changed');
    }
    assert(after.catalog.context.base.head_version===before.catalog.context.base.head_version+1&&after.catalog.context.base.history_generation===before.catalog.context.base.history_generation+1
      &&after.catalog.context.base.head_revision_id===before.catalog.context.base.head_revision_id
      &&after.catalog.context.selected_physical_note_id===before.catalog.context.selected_physical_note_id&&after.catalog.context.current_mode===before.catalog.context.current_mode,'MI_changed_current_or_result');
    assert(NowNoteProtectionProtocol.canonicalJson(after.catalog.entries.filter(d=>!pendingBranches.some(b=>b.revisionId===d.key.id)))===NowNoteProtectionProtocol.canonicalJson(before.catalog.entries),'MI_changed_old_catalog');
    const local=await noteProtectionClient.openArchive(after.scope,noteHistory.export().contexts[key].notes[target],password);
    if(config.importPlain)assert(bundle.work.new_branch_ids.length===0&&bundle.work.transfers.length===0&&bundle.work.commit.plain_entries.length===1,'existing_plain_import_created_new_branch');
    assert(NowNoteProtectionProtocol.canonicalJson(local.outbox)===originalOutbox&&NowNoteProtectionProtocol.canonicalJson(local.draft)===originalDraft&&local.dirty,'MI_acknowledged_unsent_current');
    assert(pendingBranches.every(b=>local.revisions.find(r=>r.revision_id===b.revisionId).imported),'MI_local_receipt_not_settled');
    if(config.importExisting){
      const replayRecord=noteHistory.export().contexts[key].notes[target],replayValue=structuredClone(local);
      const revision=replayValue.revisions.find(r=>r.revision_id===revisionId),descriptor=after.catalog.entries.find(d=>d.key.kind==='offline_snapshot'&&d.key.id===revisionId);
      const proof=await noteProtectionReader.read(after.scope,after.catalog,descriptor,async()=>password);
      const original=bundle.work.transfers.find(t=>t.key.kind==='offline_snapshot'&&t.key.id===revisionId);
      assert(original&&await NowNoteProtectionProtocol.sha256(original.raw)===descriptor.ciphertext_sha256,'existing_import_original_cipher_absent');
      revision.imported=false;delete revision.server_ref;
      revision.representation={descriptor,raw:original.raw,origin:proof.origin};
      const pending=await noteProtectionClient.sealJournal(after.scope,replayValue,password,crypto.randomUUID());
      await noteProtectionClient.replaceJournal(after.scope,replayRecord,pending,noteHistory);
      const prior=new Set(Object.keys(noteHistory.protectionOperations()));
      await action('refresh',()=>status().includes('전환 준비 가능'));
      await action('imports',()=>dialog().querySelectorAll('.protection-import-rows input:checked').length===1);
      await action('import-selected',()=>Object.keys(noteHistory.protectionOperations()).length===6&&Object.values(noteHistory.protectionOperations()).every(m=>m.phase==='complete'));
      const repeated=Object.values(noteHistory.protectionOperations()).find(m=>!prior.has(m.id));
      const work=NowNoteProtectionProtocol.parseJson(await NowNoteProtectionProtocol.decryptContent(repeated.cipher_bundle,password));
      const unchanged=await inspectNoteProtection();
      assert(NowNoteProtectionProtocol.canonicalJson(unchanged.catalog)===NowNoteProtectionProtocol.canonicalJson(after.catalog),'existing_only_import_changed_catalog');
      assert(work.work.transfers.length===0&&work.work.new_branch_ids.length===0&&work.work.commit.existing_ciphertexts.length===1,'existing_only_import_created_new_branch');
      const saved=await noteProtectionClient.openArchive(after.scope,noteHistory.export().contexts[key].notes[target],password);
      assert(NowNoteProtectionProtocol.canonicalJson(saved.outbox)===originalOutbox&&NowNoteProtectionProtocol.canonicalJson(saved.draft)===originalDraft&&saved.dirty,'existing_import_acknowledged_current');
      assert(saved.revisions.find(r=>r.revision_id===revisionId).imported,'existing_import_not_settled');
      emit({stage:'MI_existing_original_cipher_complete',owner:a.owner,local_id:target,operation_id:work.prepared.id,local_operation_id:repeated.id,phase:'complete'});
    }
    const comparedRecord=NowNoteProtectionProtocol.canonicalJson(noteHistory.export().contexts[key].notes[target]);
    await action('compare',()=>status().includes('읽기 전용 비교'));
    const comparison=dialog().querySelector('.protection-comparison'),panes=[...comparison.querySelectorAll('pre')];
    assert(panes.length===2&&panes[0].textContent.endsWith(pendingBranches.at(-1).snapshot.note.content)&&panes[1].textContent.endsWith(peerPlain),'pending_comparison_changed_original_meaning');
    assert(NowNoteProtectionProtocol.canonicalJson(noteHistory.export().contexts[key].notes[target])===comparedRecord,'comparison_changed_original_journal');
    globalThis.__HTTP_CAPTURE_DONE__=undefined;emit({stage:'comparison_ready',owner:a.owner,local_id:target});
    for(let i=0;i<100&&!globalThis.__HTTP_CAPTURE_DONE__;i++)await new Promise(r=>setTimeout(r,50));
    assert(globalThis.__HTTP_CAPTURE_DONE__===true,'comparison_capture_failed');
    if(config.resolvePending){
      const choice=config.mode==='desktop'?'local':'server',expected=choice==='local'?snapshot.note.content:peerPlain;
      await action('resolve-'+choice,()=>status().includes('전환 준비 가능'));
      const resolved=await inspectNoteProtection(),d=resolved.catalog.entries.find(d=>d.key.kind==='inventory_snapshot'&&d.key.id===String(resolved.catalog.context.selected_physical_note_id));
      const actual=await noteProtectionReader.read(resolved.scope,resolved.catalog,d,async()=>password);
      assert(actual.value.note.content===expected&&resolved.catalog.context.base.head_version===7,'pending_resolution_wrong_current');
      const saved=await noteProtectionClient.openArchive(resolved.scope,noteHistory.export().contexts[key].notes[target],password);
      assert(saved.outbox.length===0&&saved.conflict===null&&!saved.dirty,'pending_resolution_not_settled');
      assert(NowNoteProtectionProtocol.canonicalJson(saved.archived_outbox)===originalOutbox,'pending_resolution_changed_original_request');
      assert(NowNoteProtectionProtocol.canonicalJson(saved.comparison.source.draft)===originalDraft&&saved.comparison.choice===choice,'pending_resolution_lost_original_draft');
      assert(saved.receipts.at(-1).purpose==='mixed_note_write','pending_resolution_receipt_absent');
      await action('edit',()=>!dialog().querySelector('.protection-editor').classList.contains('hidden'));
      assert(dialog().querySelector('.protection-draft').value===expected.replace(/\r\n/g,'\n'),'pending_resolution_editor_still_blocked');
      emit({stage:'pending_resolution_'+choice+'_complete',owner:a.owner,local_id:target,operation_id:saved.receipts.at(-1).operation_id,phase:'complete'});
    }
    button('lock').click();assert(!comparison.textContent&&comparison.classList.contains('hidden'),'locked_comparison_retained_plaintext');
    for(const store of protectionStorageAdapters()){
      const raw=JSON.stringify(await store.read());
      for(const branch of pendingBranches)assert(!raw.includes(branch.snapshot.note.content.trim()),'MI_local_plaintext_residue');
    }
    emit({stage:'MI_original_operation_complete',owner:a.owner,local_id:target,operation_id:bundle.prepared.id,local_operation_id:marker.id,phase:'complete',server_instance_id:scope.instance});
  }
  if(config.mutationWrite){
    async function current(){const info=await inspectNoteProtection(),d=info.catalog.entries.find(v=>v.key.kind==='inventory_snapshot');return {info,note:(await noteProtectionReader.read(info.scope,info.catalog,d,async()=>password)).value.note};}
    async function selectOriginal(){
      const info=await inspectNoteProtection();let selected;
      for(const d of info.catalog.entries.filter(v=>v.key.kind==='revision_snapshot'&&!v.is_null)){
        const read=await noteProtectionReader.read(info.scope,info.catalog,d,async()=>password);
        if(read.value.note.content===plain&&read.value.note.deleted_at===null){selected=d;break;}
      }
      assert(selected,'original_restore_snapshot_absent');
      const select=dialog().querySelector('[name="representation"]');
      select.selectedIndex=info.rows.findIndex(r=>r.kind==='typed'&&NowNoteProtectionProtocol.canonicalJson(r.descriptor)===NowNoteProtectionProtocol.canonicalJson(selected));
      select.dispatchEvent(new Event('change',{bubbles:true}));assert(!button('restore').disabled,'restore_control_disabled');
    }
    const complete=count=>{const ops=Object.values(noteHistory.protectionOperations()).filter(m=>m.scope.local_id===target);return ops.length===count&&ops.every(m=>m.phase==='complete');};
    await action('delete',()=>complete(5));
    const deleted=await current();assert(deleted.info.catalog.context.base.head_version===6&&deleted.note.deleted_at!==null&&deleted.note.content===peerPlain,'protected_delete_changed_meaning');
    await selectOriginal();await action('restore',()=>complete(6));
    const restored=await current();assert(restored.info.catalog.context.base.head_version===7&&restored.note.deleted_at===null&&restored.note.content===plain,'protected_history_restore_changed_meaning');
    await action('current_plain_transition',()=>complete(7));
    await selectOriginal();await action('restore',()=>complete(8));
    const mixed=await current();assert(mixed.info.catalog.context.base.head_version===9&&mixed.info.catalog.context.current_mode==='plain'&&mixed.note.content===plain,'plain_current_cipher_history_restore_failed');
    assert(mixed.info.catalog.entries.some(d=>d.representation_epoch>0&&d.key.kind==='revision_snapshot'),'plain_restore_lost_cipher_history');
    for(const marker of Object.values(noteHistory.protectionOperations()).filter(m=>m.scope.local_id===target)){
      const bundle=NowNoteProtectionProtocol.parseJson(await NowNoteProtectionProtocol.decryptContent(marker.cipher_bundle,password));
      emit({stage:'mutation_original_operation_complete',owner:a.owner,local_id:target,operation_id:bundle.prepared.id,local_operation_id:marker.id,phase:marker.phase,server_instance_id:scope.instance});
    }
    emit({stage:'protected_delete_restore_and_plain_restore_complete',owner:a.owner,local_id:target,phase:'complete'});
  }
  if(replicaBaseline){
    const after=await noteProtectionReader.catalog(scope);
    assert(after.context.selected_physical_note_id===replicaBaseline.selected,'replica_selection_changed');
    for(const d of replicaBaseline.descriptors)assert(after.entries.some(v=>NowNoteProtectionProtocol.canonicalJson(v)===NowNoteProtectionProtocol.canonicalJson(d)),'MW_changed_nonselected_replica_descriptor');
    const d=replicaBaseline.descriptors.find(v=>v.key.kind==='inventory_snapshot'),actual=await noteProtectionReader.read(scope,after,d,async()=>password);
    assert(NowNoteProtectionProtocol.canonicalJson(actual.value)===NowNoteProtectionProtocol.canonicalJson(replicaBaseline.value),'MW_changed_nonselected_replica_FULL15');
  }
  if(config.parentMode==='mixed'){
    const parentScope={...scope,local_id:other},parent=await noteProtectionReader.catalog(parentScope);
    assert(NowNoteProtectionProtocol.canonicalJson(parent)===NowNoteProtectionProtocol.canonicalJson(parentBaseline),'child_write_changed_protected_parent');
    const inv=parent.entries.find(d=>d.key.kind==='inventory_snapshot'),note=await noteProtectionReader.read(parentScope,parent,inv,async()=>password);
    assert(note.value.note.content==='HTTP-QA-PRESERVE-'+run,'child_write_changed_parent_meaning');
  }else{
    const otherCurrent=await request('/api/v2/notes/current?'+query(other));assert(otherCurrent.snapshot.note.content==='HTTP-QA-PRESERVE-'+run,'real_other_note_changed');
  }
  for(const store of protectionStorageAdapters()){
    const raw=await store.read();
    if(config.mutationWrite&&isHostedWebClient()&&store.name==='memory:data'&&store.ephemeral){
      for(const node of flattenTree(raw?.tree||[]))if(node.id===target&&typeof node.content==='string'
        &&node.content.replace(/\r\n/g,'\n')===plain.replace(/\r\n/g,'\n')){
        node.content='QA-VERIFIED-PLAIN-CURRENT';emit({stage:'plain_current_live_memory_classified',owner:a.owner,local_id:target,code:store.name});
      }
    }
    if(JSON.stringify(raw).includes('HTTP-QA-ORIGINAL-'+run)){
      emit({stage:'unexpected_plaintext_store',owner:a.owner,local_id:target,code:store.name});throw Error('real_local_plaintext_residue');
    }
  }
  const operations=Object.values(noteHistory.protectionOperations()).filter(m=>m.scope.local_id===target);
  for(const marker of operations){const bundle=NowNoteProtectionProtocol.parseJson(await NowNoteProtectionProtocol.decryptContent(marker.cipher_bundle,password));emit({stage:marker.phase==='complete'?'local_operation_complete':'local_operation_pending',owner:a.owner,local_id:target,operation_id:bundle.prepared.id,local_operation_id:marker.id,phase:marker.phase,server_instance_id:scope.instance});}
  delete globalThis.__HTTP_QA__;clearWebSession();
  return {ok:true,mode:config.mode,phase:2,owner:a.owner,local_id:target,serverEpoch:2,CPplainHistoricalCipher:true,FULL15preserved:true,peerOrigins,nulls,otherPreserved:true,localPlaintextAbsent:true,mixedWriteVerified:config.mixedWrite===true||config.editorWrite===true,editorWriteVerified:config.editorWrite===true,deleteRestoreVerified:config.mutationWrite===true,offlineImportVerified:config.importWrite===true,parentBoundary:config.parentMode||null,physicalReplicasPreserved:Boolean(config.replicaIds)};
})();
