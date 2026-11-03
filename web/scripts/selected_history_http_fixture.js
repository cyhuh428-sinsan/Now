/* Executed only by the disposable renderer QA host against its own loopback API. */
globalThis.runSelectedHistoryHttp=async function({url,token,owner='qa_history_alice',apiToken=''}){
  const endpoint=new URL(url);if(endpoint.protocol!=='http:'||endpoint.hostname!=='127.0.0.1')throw Error('selected_http_boundary');
  await noteHistoryCaptureChain;await noteHistory.idle();await Promise.all([...storagePendingWrites]);
  const backend=await historyPersistence(),before=await backend.open(),server=structuredClone(state.settings.server),data=state.data;
  const primary=[];for(const key of [STORAGE_KEY,SETTINGS_KEY,LIBRARY_STORAGE_KEY])primary.push([key,await readStorage(key)]);
  const clone=IDBObjectStore.prototype.getAll,id='selected-http-'+crypto.randomUUID();let result;
  try{
    state.settings.server={...server,mode:'server',url,ownerId:owner,deviceId:'history-electron',token:apiToken,userToken:token,webSessionToken:'',autoSync:false};
    noteHistoryController.lock();noteHistoryProjectionScope=NowNoteHistory.key(noteHistoryContext());
    const ctx=noteHistoryContext();if(!ctx.online)throw Error('selected_http_not_online');
    const seed={owner_id:ctx.owner,local_id:id,note_type:'tree',title:'Synthetic selected HTTP',source:'manual',content:'BEFORE_HTTP',parent_local_id:null,level:1,tags:null,deleted_at:null};
    await noteHistoryRequest(ctx,'current','PUT',{schema_version:1,owner_id:ctx.owner,local_id:id,device_id:ctx.device,mutation_id:crypto.randomUUID(),crypto_epoch:0,
      base_head_version:0,base_revision_id:null,expected_inventory_revision_ids:[],note:NowNoteHistory.meaning(seed)});
    const current=await noteHistoryRequest(ctx,'current','GET',{local_id:id}),note=current.snapshot.note,account=NowNoteHistory.key(ctx);
    if(typeof note.updated_at!=='string')throw Error('selected_http_missing_sync_cursor');
    state.settings.server.lastSyncedAt=note.updated_at;
    const root={schema_version:1,contexts:{[account]:{notes:{[id]:{raw:note,draft:note,base:current,revisions:[],outbox:[],receipts:[],replicaSelected:true,localOnly:false,dirty:false}}}}};
    await backend.full({expected:before.value,next:root,revision:before.revision},{active:()=>true});
    state.data=defaultData();await noteHistoryController.resume();state.selectedTreeId=id;render();
    if(!noteHistory.deferred())throw Error('selected_http_not_deferred');
    IDBObjectStore.prototype.getAll=function(){const frames=new Error().stack.split('\n').slice(1,7).map(line=>line.replace(/\(.*$/,'').trim()).join(' > ');throw Error('selected_http_whole_history_scan: '+frames);};
    elements.treeContent.value='AFTER_SELECTED_HTTP';elements.treeContent.dispatchEvent(new Event('input',{bubbles:true}));
    await noteHistoryCaptureChain;await noteHistoryFlush();await noteHistory.idle();
    const stored=await noteHistoryRequest(ctx,'current','GET',{local_id:id}),entry=noteHistory.view(id);
    if(!noteHistory.deferred()||noteHistory.failure()||stored.snapshot.note.content!=='AFTER_SELECTED_HTTP'||entry.outbox.length!==0
      ||entry.receipts.length!==1||entry.base.head_version!==2||!entry.revisions.every(r=>r.imported))throw Error('selected_http_did_not_settle');
    await syncWebNotesToServer(undefined,{skipFormSave:true});await noteHistoryCaptureChain;await noteHistory.idle();
    if(!noteHistory.deferred()||noteHistory.failure()||state.settings.server.lastStatus!=='ok')throw Error('default_http_materialized_history');
    result={realHTTP:true,scoped:true,receipt:true,headVersion:entry.base.head_version,defaultDeferred:true,providerCalls:0};
    IDBObjectStore.prototype.getAll=clone;
    await noteHistory.ensure();
    wikiUI.close();document.querySelector('#wikiDialog')?.remove();initializeWikiNotebook();
    const plan=await wikiIngest.plan({fileIds:[],noteIds:[id]}),source=plan.plan.snapshot.sources[0];
    const proposal=await wikiIngest.generate(plan,{provider:'fixture',model:'synthetic-only',invoke:async()=>JSON.stringify({pages:plan.plan.pages.map(page=>({
      wiki_id:page.wiki_id,draft_id:page.draft_id,title:source.title,topic:source.title,page_type:'concept',summary:'Synthetic HTTP selection',aliases:[],claims:[],relations:[],
      sections:[{id:'s1',title:'Finding',markdown:'Synthetic selected finding.',citation_ids:['c1']}],citations:[{id:'c1',evidence_id:source.id,section_id:null,quote:source.content}]
    }))})});
    await wikiIngest.stageServer(proposal);await wikiIngest.prepareServer(plan.operation_id);await wikiIngest.commitServer(plan.operation_id);await wikiIngest.applyServer(plan.operation_id);
    const wikiDocument=proposal.proposal.documents[0].document,decision=await wikiIngest.approveLocal(wikiDocument,wikiDocument.drafts.at(-1).id);
    await wikiIngest.prepareServer(decision.operation_id);await wikiIngest.commitServer(decision.operation_id);await wikiIngest.applyServer(decision.operation_id);
    const wikiId=plan.plan.pages[0].wiki_id,prepared=await backend.open();
    noteHistory.suspend();await noteHistoryController.resume({projectView:false,renderView:false});
    if(!noteHistory.deferred())throw Error('selected_wiki_http_not_deferred');
    IDBObjectStore.prototype.getAll=function(){throw Error('selected_wiki_http_whole_history_scan');};
    try{
      await wikiUI.open('browse');
      const button=document.querySelector('#wikiDialog .wiki-entry[data-wiki-id="'+wikiId+'"] .library-item');
      if(!button)throw Error('selected_wiki_http_button');button.click();
      let ready=false;for(let i=0;i<600;i++){
        const edit=document.querySelector('#wikiDialog [data-wiki-action=edit-wiki]');if(edit&&!edit.disabled){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,10));
      }
      if(!ready||!noteHistory.deferred()||noteHistory.failure())throw Error('selected_wiki_http_detail: '+document.querySelector('#wikiDialog [role=status]')?.textContent);
    }finally{wikiUI.close();IDBObjectStore.prototype.getAll=clone;}
    if(JSON.stringify((await backend.open()).value)!==JSON.stringify(prepared.value))throw Error('selected_wiki_http_changed_journal');
    result.wikiSelectedDetail=true;
  }finally{
    IDBObjectStore.prototype.getAll=clone;clearTimeout(serverSyncTimer);for(const timer of noteHistoryTimers.values())clearTimeout(timer);noteHistoryTimers.clear();
    await noteHistoryCaptureChain.catch(()=>{});await noteHistory.idle().catch(()=>{});
    const latest=await backend.open();await backend.full({expected:latest.value,next:before.value,revision:latest.revision},{active:()=>true});
    state.settings.server=server;state.data=data;noteHistoryController.lock();noteHistoryProjectionScope=NowNoteHistory.key(noteHistoryContext());
    await noteHistoryController.resume({projectView:false,renderView:false});
    for(const [key,value] of primary){if(value===null)clearStorage(key);else writeStorage(key,value);}
    await Promise.all([...storagePendingWrites]);
  }
  return result;
};
