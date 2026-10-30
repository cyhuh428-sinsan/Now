(async()=>{
  const config=globalThis.__PROTECTION_QA__,assert=(v,m)=>{if(!v)throw Error(m);};
  const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
  const scope={url:config.mode==='web'?'http://localhost.:8750':'http://127.0.0.1:8750',owner:'qa_e4b3a_alice',instance:uid(1),local_id:'qa-target',device:'qa-one'};
  const password='synthetic-only',needle='SYNTHETIC-E4B3A-ORIGINAL';
  const backend=createProtectionViewBackend(scope,password,config.serverState);await backend.init();
  let identityGate=null;
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async(input,options={})=>{
    const u=new URL(typeof input==='string'?input:input.url,location.href);
    if(u.pathname.startsWith('/api/v2/')) {
      const method=options.method||'GET',body=method==='GET'?Object.fromEntries(u.searchParams):JSON.parse(options.body);
      if(identityGate&&u.pathname.endsWith('/crypto-transitions/status')&&!body.transition_id){const gate=identityGate;identityGate=null;gate.reached();await gate.wait;}
      try{return new Response(NowNoteProtectionProtocol.canonicalJson(await backend.request(scope,u.pathname,method,body)),{status:200,headers:{'Content-Type':'application/json'}});}
      catch(e){return new Response(JSON.stringify({detail:{code:e.message}}),{status:409,headers:{'Content-Type':'application/json'}});}
    }
    if(u.pathname.startsWith('/api/'))return new Response('{}',{status:404});
    return originalFetch(input,options);
  };
  if(isHostedWebClient())saveWebSession({ownerId:scope.owner,deviceId:scope.device,token:'synthetic-session'});
  state.settings.server=normalizeServerSettings({...state.settings.server,mode:'server',url:scope.url,ownerId:scope.owner,deviceId:scope.device,userToken:config.mode==='desktop'?'synthetic-user-token':'',webSessionToken:config.mode==='web'?'synthetic-session':'',serverInstanceId:scope.instance,autoSync:false});
  noteHistoryAuthenticated=true;noteHistoryProjectionScope=NowNoteHistory.key(noteHistoryContext());
  if(noteHistory.suspended())await noteHistoryController.resume();
  const settle=async()=>{await noteHistoryCaptureChain;for(const timer of noteHistoryTimers.values())clearTimeout(timer);noteHistoryTimers.clear();clearTimeout(serverSyncTimer);await Promise.all([...storagePendingWrites]);};
  await settle();
  initializeNoteProtection();noteProtectionIdentity={instance:scope.instance};
  const invalidations=[];
  const invalidate=noteProtection.invalidate;
  noteProtection.invalidate=function(){invalidations.push(new Error().stack.split('\n').slice(2,5).map(line=>line.split('(')[0].trim()).join(' / '));return invalidate();};
  async function put(key,value) {if(isDesktopClient())await window.nownoteDesktop.storage.write(key,structuredClone(value));else localStorage.setItem(key,JSON.stringify(value));}
  const dialog=()=>document.querySelector('#noteProtectionDialog');
  const button=name=>dialog().querySelector('[data-action="'+name+'"]');
  const status=()=>dialog().querySelector('.protection-status').textContent;
  async function until(fn,label,key=password) {
    for(let i=0;i<2500;i++) {
      const form=dialog()?.querySelector('form.library-confirm');
      if(form) {const input=form.querySelector('input');input.value=key;form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));}
      if(fn()&&!button('refresh').disabled)return;
      if(!button('refresh').disabled&&!form&&/note_protection:|note_protection_client:|synthetic|Cannot read|지원하지 않는/.test(status()))throw Error(label+' failed; status='+status());
      await new Promise(r=>setTimeout(r,15));
    }
    throw Error(label+' timeout; status='+status()+'; invalidate='+invalidations.slice(-4).join(' | '));
  }
  async function open() {await openNoteProtection();assert(dialog().open,'dialog not opened');await settle();}
  async function action(name,predicate,key=password) {button(name).click();await until(predicate,name,key);await settle();}
  if(config.phase===1) {
    state.data=defaultData();state.data.tree=[];
    const target=createNode('Synthetic target',needle+'\r\n',null,1);target.id=scope.local_id;target.syncState='synced';
    const other=createNode('Other','PRESERVE-OTHER',null,1);other.id='qa-other';other.syncState='synced';
    state.data.tree.push(target,other);state.selectedTreeId=target.id;
    state.data.snapshots=[{id:uid(9),reason:'synthetic',createdAt:'2026-10-30T00:00:00.000Z',data:{...defaultData(),tree:[structuredClone(target)]}}];
    state.data.worklogs['2026-10-30']={date:'2026-10-30',content:'PRESERVE-WORKLOG',updatedAt:'2026-10-30T00:00:00.000Z'};
    await put(STORAGE_KEY,state.data);await put(SETTINGS_KEY,state.settings);
    await noteHistory.track(backend.note(),{head_version:1,head_revision_id:uid(7),crypto_epoch:0,inventory_revision_ids:[uid(7)],replica_count:1,server_instance_id:scope.instance});
    render();await settle();await open();
    assert(button('conversion').disabled,'public mutation gate was silently enabled');
    button('close').click();noteProtectionInternalEnabled=true;await open();
    let boxes=[...dialog().querySelectorAll('.protection-copies input')];assert(boxes.length>=4,'exact copy list missing');
    boxes[0].checked=true;
    await action('confirm',()=>status().includes('confirmation_incomplete'));
    assert(!state.data.tree.find(n=>n.id===scope.local_id).protectionScope,'partial approval attributed a source');
    state.settings.server.ownerId='qa_e4b3a_bob';noteProtectionUI.check();
    assert(!dialog().open&&!state.data.tree.find(n=>n.id===scope.local_id).protectionScope,'account switch retained confirmation or attributed source');
    state.settings.server.ownerId=scope.owner;await open();
    boxes=[...dialog().querySelectorAll('.protection-copies input')];assert(boxes.every(b=>!b.checked),'old confirmation survived account switch');
    boxes.forEach(b=>b.checked=true);
    await action('confirm',()=>!dialog().querySelector('.protection-copies input'));
    assert(state.data.tree.find(n=>n.id===scope.local_id).protectionScope.owner===scope.owner,'confirmed scope missing');
    let restore;
    if(!isDesktopClient()) {
      const original=Storage.prototype.setItem;let fail=true;
      Storage.prototype.setItem=function(key,value){if(fail&&key===NOTE_HISTORY_KEY&&Object.values(JSON.parse(value).protection_operations||{}).some(m=>m.phase==='complete')){fail=false;throw Error('synthetic quota');}return original.call(this,key,value);};
      restore=()=>Storage.prototype.setItem=original;
    }
    try{await action('conversion',()=>Object.values(noteHistory.protectionOperations()).some(m=>m.phase==='applying'));}finally{restore?.();}
    const operations=Object.values(noteHistory.protectionOperations());assert(operations.length===1&&operations[0].phase==='applying','failure did not retain applying');
    assert(!treeUndoStack.text.includes(needle),'transition retained plaintext Undo');
    assert(elements.treeContent.readOnly,'pending target became editable');
    button('close').click();await open();assert(status().includes('이 기기 적용 필요'),'server/local status not separated');
    const serverState=backend.export();assert(!JSON.stringify(serverState).includes(needle),'synthetic server checkpoint retained plaintext after protected commit');
    clearWebSession();assert(!dialog().open&&!dialog().querySelector('.protection-plain').textContent,'logout retained inspection plaintext');
    return {ok:true,mode:config.mode,phase:1,stage:'actual-dialog-confirmation-and-durable-failure',partialPreserved:true,publicGateFalse:true,serverState};
  }
  state.selectedTreeId=isHostedWebClient()?null:scope.local_id;render();await settle();noteProtectionInternalEnabled=true;
  await open();assert(status().includes('적용 필요'),'cold restart lost pending status');
  await action('resume',()=>status().includes('operation')||status().includes('decrypt')||status().includes('실패')||status().includes('키'), 'wrong');
  assert(Object.values(noteHistory.protectionOperations()).some(m=>m.phase==='applying'),'wrong key changed phase');
  let entered=false,release;identityGate={reached:()=>{entered=true;},wait:new Promise(r=>release=r)};
  const beforeLock=JSON.stringify(await readStorage(STORAGE_KEY));button('resume').click();
  for(let i=0;i<500&&!entered;i++) {const form=dialog().querySelector('form.library-confirm');if(form){form.querySelector('input').value=password;form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));}await new Promise(r=>setTimeout(r,10));}
  assert(entered,'late resume identity gate not reached');button('lock').click();release();
  await until(()=>status().includes('취소')||status().includes('변경'),'late-lock-resume');
  assert(Object.values(noteHistory.protectionOperations()).some(m=>m.phase==='applying')&&JSON.stringify(await readStorage(STORAGE_KEY))===beforeLock,'late locked resume performed local CAS');
  await action('resume',()=>Object.values(noteHistory.protectionOperations()).every(m=>m.phase==='complete'));
  await action('refresh',()=>dialog().querySelector('[name="representation"]').options.length>0);
  const select=dialog().querySelector('[name="representation"]');
  const archiveIndex=[...select.options].findIndex(o=>o.textContent.startsWith('이 기기'));
  assert(archiveIndex>=0,'local archive not listed after restart');select.selectedIndex=archiveIndex;
  await action('read',()=>dialog().querySelector('.protection-plain').textContent.includes(needle));
  assert(!JSON.stringify(state.data).includes(needle)&&!treeUndoStack.text.includes(needle),'archive plaintext escaped inspection');
  button('lock').click();assert(!dialog().querySelector('.protection-plain').textContent,'lock retained plain DOM');
  await action('current_plain_transition',()=>status().includes('전환 준비 가능'));
  assert(backend.note().content.includes(needle),'CP did not publish current plaintext');
  await action('mixed_conversion',()=>status().includes('전환 준비 가능'));
  assert(backend.note().content.startsWith('NOW_ENCRYPTED_V1:'),'RC did not protect current');
  for(const store of protectionStorageAdapters())assert(!JSON.stringify(await store.read()).includes(needle),'local plaintext remained after RC');
  const disk=await readStorage(STORAGE_KEY),data=typeof disk==='string'?JSON.parse(disk):disk;
  assert(data.tree.find(n=>n.id==='qa-other')?.content==='PRESERVE-OTHER'&&data.worklogs['2026-10-30']?.content==='PRESERVE-WORKLOG','other data changed');
  await action('refresh',()=>select.options.length>0);
  select.selectedIndex=0;await action('read',()=>dialog().querySelector('.protection-plain').textContent.includes(needle));
  clearWebSession();assert(!dialog().open&&!dialog().querySelector('.protection-plain').textContent,'late logout retained plain DOM');
  if(isHostedWebClient())saveWebSession({ownerId:scope.owner,deviceId:scope.device,token:'synthetic-session-again'});
  state.settings.server.webSessionToken=config.mode==='web'?'synthetic-session-again':'';noteHistoryAuthenticated=true;await noteHistoryController.resume();
  if(isHostedWebClient()){state.data=structuredClone(data);normalizeData();}
  selectTreeNode('qa-other');render();
  const other=state.data.tree.find(n=>n.id==='qa-other'),previous=other.content;
  elements.treeContent.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'한'}));elements.treeContent.value='일반 메모 한글 입력';
  elements.treeContent.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertCompositionText',data:'한',isComposing:true}));assert(other.content===previous,'normal IME saved prematurely');
  elements.treeContent.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'일반 메모 한글 입력'}));await new Promise(r=>setTimeout(r,80));await settle();
  assert(other.content==='일반 메모 한글 입력','normal Korean IME did not commit');
  const rawHistory=await readStorage(NOTE_HISTORY_KEY),savedHistory=typeof rawHistory==='string'?JSON.parse(rawHistory):rawHistory;
  assert(savedHistory.contexts[NowNoteHistory.key(noteHistoryContext())].notes['qa-other'].draft.content===other.content,'normal IME journal not durable');
  selectTreeNode(scope.local_id);render();await open();
  await action('read',()=>dialog().querySelector('.protection-plain').textContent.includes(needle));
  return {ok:true,mode:config.mode,phase:2,stage:'cold-restart-reauth-archive-CP-RC',wrongKeyPreserved:true,lateLockedResumeBlocked:true,onlyDialogPlain:true,otherDataPreserved:true,normalKoreanImeDurable:true};
})();
