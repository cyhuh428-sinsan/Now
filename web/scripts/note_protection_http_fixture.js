(async()=>{
  const config=globalThis.__HTTP_QA__,a=config.credentials.a,b=config.credentials.b,run=config.run;
  const target='qa-http-'+run+'-target',other='qa-http-'+run+'-other',plain='HTTP-QA-ORIGINAL-'+run+'\r\n',password='qa-protection-'+run;
  const assert=(v,code)=>{if(!v)throw Error(code);},wait=()=>new Promise(r=>setTimeout(r,15));
  const emit=event=>console.log('HTTP_QA_EVENT '+JSON.stringify(event));
  const url=config.mode==='web'?'http://localhost.:8750':'http://127.0.0.1:8750';
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
  if(config.probe)return {ok:true,mode:config.mode,phase:config.phase,readOnlyProbe:true};
  await login(a);
  const settle=async()=>{await noteHistoryCaptureChain;for(const t of noteHistoryTimers.values())clearTimeout(t);noteHistoryTimers.clear();clearTimeout(serverSyncTimer);await Promise.all([...storagePendingWrites]);};
  await settle();noteProtectionInternalEnabled=true;
  const query=(local,extra={})=>new URLSearchParams({owner_id:a.owner,local_id:local,device_id:a.device,...extra});
  async function identity(){return request('/api/v2/notes/crypto-transitions/status?'+query(target));}
  const dialog=()=>document.querySelector('#noteProtectionDialog'),button=name=>dialog().querySelector('[data-action="'+name+'"]'),status=()=>dialog().querySelector('.protection-status').textContent;
  async function drive(done,label,key=password) {
    for(let i=0;i<2500;i++) {
      const form=dialog()?.querySelector('form.library-confirm');
      if(form){form.querySelector('input').value=key;form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));}
      if(done()&&!button('refresh').disabled)return;
      if(!button('refresh').disabled&&!form&&/note_protection:|note_protection_client:|HTTP |http_/.test(status())) {
        const raw=status(),code=/^note_protection(?:_client)?:[a-z_]+(?::[a-z0-9_/:.-]+)?$/.test(raw)?raw:'ui_http_failure';
        emit({stage:label,owner:a.owner,local_id:target,code});throw Error('ui_action_failed_'+label);
      }
      await wait();
    }
    emit({stage:label,owner:a.owner,local_id:target,code:'ui_timeout_uncertain'});throw Error('ui_timeout_uncertain');
  }
  async function open(){await openNoteProtection();assert(dialog()?.open,'protection_dialog_absent');await settle();}
  async function action(name,done,key=password){button(name).click();await drive(done,name,key);await settle();}
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
    try{for(const current of [original,otherCurrent]){await noteHistory.track(current.snapshot.note,current);noteHistoryProject(current.snapshot.note);}}finally{noteHistoryProjection=false;}
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
    if(descriptor.key.kind==='inventory_snapshot')assert(value.value.note.content===peerPlain,'real_peer_plain_meaning_changed');
  }
  assert(peerOrigins>0&&nulls>0,'real_peer_origin_or_null_coverage_absent');
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
  const otherCurrent=await request('/api/v2/notes/current?'+query(other));assert(otherCurrent.snapshot.note.content==='HTTP-QA-PRESERVE-'+run,'real_other_note_changed');
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
  return {ok:true,mode:config.mode,phase:2,owner:a.owner,local_id:target,serverEpoch:2,CPplainHistoricalCipher:true,FULL15preserved:true,peerOrigins,nulls,otherPreserved:true,localPlaintextAbsent:true,mixedWriteVerified:config.mixedWrite===true||config.editorWrite===true,editorWriteVerified:config.editorWrite===true,deleteRestoreVerified:config.mutationWrite===true};
})();
