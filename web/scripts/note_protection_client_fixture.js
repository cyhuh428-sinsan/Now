(async () => {
  const config = globalThis.__PROTECTION_QA__, assert = (v,message) => {if(!v)throw Error(message);};
  const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  const scope = {url:config.mode === 'web' ? 'http://localhost.:8750' : 'http://127.0.0.1:8750',owner:'qa_e4b2_alice',instance:uid(1),local_id:'qa-target',device:'qa-one'};
  const secret = 'SYNTHETIC-E4B2-ORIGINAL\r\n', password = 'synthetic-only';
  const needle = 'SYNTHETIC-E4B2-ORIGINAL';
  if(isHostedWebClient())saveWebSession({ownerId:scope.owner,deviceId:scope.device,token:'synthetic-session'});
  state.settings.server = normalizeServerSettings({...state.settings.server,mode:'server',url:scope.url,ownerId:scope.owner,deviceId:scope.device,
    userToken:config.mode === 'desktop' ? 'synthetic-user-token' : '',webSessionToken:config.mode === 'web' ? 'synthetic-session' : '',serverInstanceId:scope.instance,autoSync:false});
  noteHistoryAuthenticated = true;
  noteHistoryRequest = async(_ctx,path) => {if(path === 'crypto-transitions/status')return {server_instance_id:scope.instance};throw Error('synthetic backend not enabled: '+path);};
  noteHistoryProjectionScope = NowNoteHistory.key(noteHistoryContext());
  if (noteHistory.suspended()) await noteHistoryController.resume();
  const remote = {
    drainPrepare:async()=>({drain_id:uid(2),drain_version:1,accepted_runs:[],accepted_claims:[],state:'ready',pending_count:0}),
    drainStatus:async()=>({drain_id:uid(2),drain_version:1,accepted_runs:[],accepted_claims:[],state:'ready',pending_count:0}),
    fresh:async()=>({verified:true}),prepare:async()=>({operation_id:uid(3),promoted:true,state:'prepared'}),stage:async()=>({verified:true}),
    status:async()=>({operation_id:uid(3),state:'committed',receipt_matches_current:true,receipt:{operation_id:uid(3)}}),
    commit:async()=>{throw Error('a recovered committed execution must not be repeated');},
  };
  const attach = () => { noteProtectionIdentity = {instance:scope.instance};noteProtection = NowNoteProtectionState.create({context:()=>({...noteHistoryContext(),instance:noteProtectionIdentity?.instance || ''}),
    journal:noteHistory,stores:protectionStorageAdapters,remote,preflight:async()=>{
      await noteHistoryCaptureChain;for(const timer of noteHistoryTimers.values())clearTimeout(timer);noteHistoryTimers.clear();clearTimeout(serverSyncTimer);
    }}); };
  if(config.phase === 1) {
    state.data = defaultData();state.data.tree = [];
    const target = createNode('Synthetic target',secret,null,1);target.id=scope.local_id;target.protectionScope=scope;target.syncState='synced';
    const other = createNode('Synthetic other','PRESERVE-OTHER',null,1);other.id='qa-other';other.syncState='synced';
    state.data.tree.push(target,other);state.selectedTreeId=target.id;
    state.data.worklogs['2026-10-30']={date:'2026-10-30',content:'PRESERVE-WORKLOG',updatedAt:'2026-10-30T00:00:00.000Z'};
    state.data.snapshots=[{id:uid(9),reason:'synthetic',createdAt:'2026-10-30T00:00:00.000Z',data:{...defaultData(),tree:[structuredClone(target)]}}];
    state.data.importReports=[{id:uid(10),source:'synthetic',createdAt:'2026-10-30T00:00:00.000Z',nodes:1}];
    state.settings.server.analysisJobs=[{id:7,owner_id:scope.owner,note_local_id:scope.local_id,input_text:secret,result_json:secret,error_message:null,status:'done'}];
    if(isDesktopClient()) {
      for(const [key,value] of [[STORAGE_KEY,state.data],[SETTINGS_KEY,state.settings]]) {
        await window.nownoteDesktop.storage.write(key,structuredClone(value));localStorage.setItem(key,JSON.stringify(value));
      }
    } else {localStorage.setItem(STORAGE_KEY,JSON.stringify(state.data));localStorage.setItem(SETTINGS_KEY,JSON.stringify(state.settings));}
    const stamp='2026-10-30T00:00:00.000000Z';
    await noteHistory.track({id:17,owner_id:scope.owner,local_id:scope.local_id,device_id:scope.device,note_type:'tree',title:'Synthetic target',content:secret,
      parent_local_id:null,level:1,tags:'',source:null,deleted_at:null,client_updated_at:stamp,created_at:stamp,updated_at:stamp},
      {head_version:1,head_revision_id:uid(7),crypto_epoch:0,inventory_revision_ids:[uid(7)],replica_count:1,server_instance_id:scope.instance});
    if(isDesktopClient())localStorage.setItem(NOTE_HISTORY_KEY,JSON.stringify(noteHistory.export()));
    attach();render();
    const id=await beginNoteProtection(scope,{schema_version:3,purpose:'mixed_conversion',drain:{mutation_id:uid(4)},prepare:{mutation_id:uid(5)}},password);
    selectTreeNode(scope.local_id);render();assert(elements.treeContent.readOnly,'pending target editor was not actually locked');
    let restoreSet;
    if(!isDesktopClient()) {
      const original=Storage.prototype.setItem;let fail=true;
      Storage.prototype.setItem=function(key,value){
        if(fail && key === NOTE_HISTORY_KEY && Object.values(JSON.parse(value).protection_operations || {}).some(m=>m.phase === 'complete')){fail=false;throw Error('synthetic quota');}
        return original.call(this,key,value);
      };
      restoreSet=()=>Storage.prototype.setItem=original;
    }
    let failed=false,reason='none';try{await resumeNoteProtection(id,password,async()=>({synthetic:true}));}catch(error){failed=true;reason=error.message;}finally{restoreSet?.();}
    assert(failed && noteProtection.status(id).phase === 'applying','store failure must leave applying marker; phase='+noteProtection.status(id).phase+'; reason='+reason);
    const initial=state.data.tree.find(n=>n.id===scope.local_id)?.content;
    elements.treeContent.value='MUST-NOT-APPLY';syncTreeContentFromEditor();
    assert(state.data.tree.find(n=>n.id===scope.local_id)?.content === initial,'pending edit changed source');
    let blocked=0;for(const fn of [downloadCurrentBackup,exportMarkdown,exportPublishHtml,exportPublishSlides]){try{fn();}catch{blocked++;}}
    try{await syncWebNotesToServer(undefined,{skipFormSave:true});}catch{blocked++;}
    assert(blocked===5,'pending export/sync guard missing');
    const disk=typeof(await readStorage(STORAGE_KEY)) === 'string' ? JSON.parse(await readStorage(STORAGE_KEY)) : await readStorage(STORAGE_KEY);
    assert(!JSON.stringify(disk).includes(needle),'data store retained target plaintext after its CAS');
    clearWebSession();
    if(isHostedWebClient())saveWebSession({ownerId:'qa_e4b2_bob',deviceId:scope.device,token:'synthetic-bob-session'});
    state.settings.server.ownerId='qa_e4b2_bob';state.settings.server.webSessionToken=config.mode==='web'?'synthetic-bob-session':'';
    noteHistoryAuthenticated=true;await noteHistoryController.resume();
    assert(noteProtection.pending()===0,'Bob inherited Alice pending lock');requireProtectionSettled();
    const stampBob='2026-10-30T00:00:00.000000Z';
    await noteHistory.track({id:null,owner_id:'qa_e4b2_bob',local_id:'bob-normal',device_id:scope.device,note_type:'tree',title:'Bob normal',content:'BOB-DURABLE',parent_local_id:null,
      level:1,tags:'',source:null,deleted_at:null,client_updated_at:stampBob,created_at:stampBob,updated_at:stampBob},null,{localOnly:true});
    assert(noteHistory.view('bob-normal').draft.content==='BOB-DURABLE','Bob normal draft not saved');
    const originalDownload=downloadText;let exported=false;
    downloadText=(_name,text)=>{exported=JSON.parse(text).history.protection_operations[id].phase==='applying';};
    try{downloadCurrentBackup();}finally{downloadText=originalDownload;}
    assert(exported,'Bob normal export blocked or Alice marker lost');
    assert(noteHistory.protectionOperations()[id].phase==='applying','Bob save changed Alice operation');
    clearWebSession();
    return {ok:true,mode:config.mode,phase:1,stage:'server-done-local-pending',blocked,physicalDataCipher:true,bobIndependentSaveReadExport:true};
  }
  attach();
  const ids=Object.keys(noteHistory.protectionOperations());assert(ids.length===1,'cold restart lost protection marker');
  const id=ids[0];assert(noteProtection.status(id).phase==='applying','cold restart phase mismatch');
  assert(noteProtection.blocked(scope.local_id),'cold restart unlocked pending edit');
  // Actual logout/reauth preserves durable journal and requires a key again.
  clearWebSession();assert(noteHistory.suspended(),'logout did not suspend journal');
  let refused=false;try{await resumeNoteProtection(id,password,async()=>({}));}catch{refused=true;}assert(refused,'logout allowed a late resume');
  if(isHostedWebClient())saveWebSession({ownerId:scope.owner,deviceId:scope.device,token:'synthetic-session-new'});
  state.settings.server.webSessionToken=config.mode==='web'?'synthetic-session-new':'';noteHistoryAuthenticated=true;
  await noteHistoryController.resume();attach();
  let wrongKey=false;try{await resumeNoteProtection(id,'wrong',async()=>({}));}catch{wrongKey=true;}assert(wrongKey,'wrong key accepted');
  await resumeNoteProtection(id,password,async()=>({}));
  assert(noteProtection.status(id).phase==='complete','recovered local settlement did not complete');
  for(const adapter of protectionStorageAdapters()) {
    const value=await adapter.read();assert(!JSON.stringify(value).includes(needle),'known store retained target plaintext');
  }
  const disk=typeof(await readStorage(STORAGE_KEY)) === 'string' ? JSON.parse(await readStorage(STORAGE_KEY)) : await readStorage(STORAGE_KEY);
  assert(disk.tree.find(n=>n.id==='qa-other')?.content==='PRESERVE-OTHER','other note lost');
  assert(disk.worklogs['2026-10-30']?.content==='PRESERVE-WORKLOG','worklog lost on cold load');
  assert(disk.snapshots.length===1 && disk.importReports.length===1,'recovery metadata lost on cold load');
  assert(disk.tree.find(n=>n.id===scope.local_id)?.protection_record,'cipher archive lost');
  if(isHostedWebClient()){state.data=structuredClone(disk);normalizeData();}
  selectTreeNode('qa-other');render();
  const other=state.data.tree.find(n=>n.id==='qa-other'),previous=other.content;
  elements.treeContent.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'한'}));
  elements.treeContent.value='일반 메모 한글 입력';
  elements.treeContent.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertCompositionText',data:'한',isComposing:true}));
  assert(other.content===previous,'IME composition saved prematurely');
  elements.treeContent.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'일반 메모 한글 입력'}));
  await new Promise(r=>setTimeout(r,80));await noteHistoryCaptureChain;
  assert(other.content==='일반 메모 한글 입력','normal note Korean IME did not commit');
  assert(!JSON.stringify(state.data).includes(needle),'normal save resurrected protected plaintext');
  const history=await readStorage(NOTE_HISTORY_KEY),journal=typeof history==='string'?JSON.parse(history):history;
  assert(journal.contexts[NowNoteHistory.key(noteHistoryContext())].notes['qa-other'].draft.content===other.content,'normal IME draft not durable');
  return {ok:true,mode:config.mode,phase:2,stage:'cold-restart-reauth-settled',wrongKeyRejected:true,allStoresCipher:true,otherNoteAndRecoveryPreserved:true,normalKoreanImeDurable:true};
})();
