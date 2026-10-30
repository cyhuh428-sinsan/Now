(async()=>{
  const config=globalThis.__HTTP_QA__,a=config.credentials.a,b=config.credentials.b,run=config.run;
  const target='qa-http-'+run+'-target',other='qa-http-'+run+'-other',plain='HTTP-QA-ORIGINAL-'+run+'\r\n',password='qa-protection-'+run;
  const assert=(v,code)=>{if(!v)throw Error(code);},wait=()=>new Promise(r=>setTimeout(r,15));
  const emit=event=>console.log('HTTP_QA_EVENT '+JSON.stringify(event));
  const url=config.mode==='web'?'http://localhost.:8750':'http://127.0.0.1:8750';
  async function request(path,method='GET',body,headers) {
    let response;
    try{response=await fetch(url+path,{method,cache:'no-store',headers:{Authorization:'Bearer '+config.apiToken,...(headers||noteHistoryContext().headers),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});}
    catch{emit({stage:'transport_uncertain',owner:a.owner,local_id:target});throw Error('transport_uncertain');}
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
  assert(status().includes('적용 필요'),'real_cold_restart_lost_pending');
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
  const peer='qa-peer-'+run,issued=await request('/api/v1/auth/client-login','POST',{owner_id:a.owner,password:a.password,device_id:peer,device_name:'HTTP peer'},{});
  const peerScope={...scope,device:peer},peerReader=NowNoteProtectionClient.createReader({request:async(s,path,method,body)=>request(path+'?'+new URLSearchParams(body),method,undefined,{'X-Now-User-Token':issued.access_token})});
  const peerCatalog=await peerReader.catalog(peerScope);let peerOrigins=0,nulls=0;
  for(const descriptor of peerCatalog.entries) {
    const value=await peerReader.read(peerScope,peerCatalog,descriptor,async()=>password);
    if(descriptor.is_null)nulls++;
    if(value.origin.value)peerOrigins++;
    if(descriptor.key.kind==='inventory_snapshot')assert(value.value.note.content===plain,'real_peer_plain_meaning_changed');
  }
  assert(peerOrigins>0&&nulls>0,'real_peer_origin_or_null_coverage_absent');
  const otherCurrent=await request('/api/v2/notes/current?'+query(other));assert(otherCurrent.snapshot.note.content==='HTTP-QA-PRESERVE-'+run,'real_other_note_changed');
  for(const store of protectionStorageAdapters())assert(!JSON.stringify(await store.read()).includes('HTTP-QA-ORIGINAL-'+run),'real_local_plaintext_residue');
  const operations=Object.values(noteHistory.protectionOperations()).filter(m=>m.scope.local_id===target);
  for(const marker of operations){const bundle=NowNoteProtectionProtocol.parseJson(await NowNoteProtectionProtocol.decryptContent(marker.cipher_bundle,password));emit({stage:'local_operation_complete',owner:a.owner,local_id:target,operation_id:bundle.prepared.id,local_operation_id:marker.id,phase:marker.phase,server_instance_id:scope.instance});}
  delete globalThis.__HTTP_QA__;clearWebSession();
  return {ok:true,mode:config.mode,phase:2,owner:a.owner,local_id:target,serverEpoch:2,CPplainHistoricalCipher:true,FULL15preserved:true,peerOrigins,nulls,otherPreserved:true,localPlaintextAbsent:true};
})();
