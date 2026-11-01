/* Synthetic backend only; mounted product UI and journal use the real renderer storage. */
globalThis.runWikiIngestUiFixture=async function({initial,write,backend=null,phase}){
  const P=NowNoteProtectionProtocol,copy=structuredClone,ctx={url:'https://synthetic-wiki.invalid',owner:'qa-wiki-remote',device:'qa-one',auth:'synthetic',enabled:true,online:true};
  const data=backend||{instance:crypto.randomUUID(),notes:{},operations:{}};
  let posts=0,models=0,loseCommit=phase===1;
  const pause=()=>new Promise(r=>setTimeout(r,0)),until=async(fn,code)=>{for(let n=0;n<400;n++){if(fn())return;await pause();}throw Error(code);};
  const expect=(value,code)=>{if(!value)throw Error(code);};
  const currentOf=local=>{const value=data.notes[local]?.current;if(!value)throw Object.assign(Error('synthetic missing'),{status:404});return copy(value);};
  const setCurrent=(local,note,version)=>{
    const entry=data.notes[local]||={revisions:[]},revision=crypto.randomUUID();
    entry.current={status:'ok',snapshot:{schema_version:1,note:copy(note)},head_revision_id:revision,head_version:version,crypto_epoch:0,history_generation:(entry.current?.history_generation||0)+1,
      protection_state:'legacy',identity_state:'coherent',replica_count:1,inventory_revision_ids:[revision],has_replica_variants:false};
    entry.revisions.push({ref:{kind:'note_revision',id:revision},snapshot:copy(entry.current.snapshot)});return entry.current;
  };
  const request=async(path,method,body)=>{
    if(method==='GET'){
      if(path==='/api/v1/server')return {status:'ok',capabilities:{wiki_document_schema:2,wiki_operations_v1:true,wiki_operation_manifest_schema:2}};
      if(path==='/api/v2/notes/current')return currentOf(body.local_id);
      if(path.endsWith('/crypto-transitions/status')){
        const current=data.notes[body.local_id]?.current;
        return {server_instance_id:data.instance,preparation_only:true,current_exists:Boolean(current),...(current?Object.fromEntries(['head_revision_id','head_version','crypto_epoch','history_generation','protection_state','identity_state','inventory_revision_ids'].map(k=>[k,current[k]])):{})};
      }
      if(path==='/api/v2/notes/revisions'){
        const note=data.notes[body.local_id];return {status:'ok',items:note.revisions.map(r=>({revision_ref:r.ref,representation_epoch:0})),next_cursor:null,crypto_epoch:0,history_generation:note.current.history_generation};
      }
      if(path==='/api/v2/notes/revision'){
        const r=data.notes[body.local_id].revisions.find(r=>r.ref.id===body.revision_id&&r.ref.kind===body.revision_kind);
        return {status:'ok',revision_ref:copy(r.ref),snapshot:copy(r.snapshot),crypto_epoch:0};
      }
      const operation=data.operations[path.split('/').at(-1)];if(!operation)throw Object.assign(Error('synthetic missing operation'),{status:404});
      return {status:'ok',operation_id:operation.manifest.operation_id,state:operation.receipt.state,manifest_hash:operation.manifest.manifest_hash,manifest:copy(operation.manifest),receipt:copy(operation.receipt)};
    }
    posts++;
    if(path==='/api/v2/notes/revisions/import'){
      const note=data.notes[body.local_id]||={revisions:[]};
      for(const entry of body.entries)if(!note.revisions.some(r=>r.ref.id===entry.revision_id))note.revisions.push({ref:{kind:'offline_branch',id:entry.revision_id},snapshot:copy(entry.snapshot)});
      return {imported_refs:body.entries.map(e=>({kind:'offline_branch',id:e.revision_id}))};
    }
    if(path==='/api/v2/notes/current'){
      const time='2026-11-01T00:00:00.000000Z',current=setCurrent(body.local_id,{id:1,owner_id:ctx.owner,local_id:body.local_id,device_id:ctx.device,
        ...copy(body.note),created_at:time,updated_at:time,client_updated_at:time},1);
      return {status:'ok',mutation_id:body.mutation_id,result_revision_id:current.head_revision_id,result_head_version:1,result_inventory_revision_ids:current.inventory_revision_ids,crypto_epoch:0,history_generation:current.history_generation};
    }
    if(path.endsWith('/prepare')){
      const receipt={status:'ok',wiki_operation:true,operation_id:body.operation_id,manifest_hash:body.manifest_hash,state:'prepared',pages:[]};data.operations[body.operation_id]={manifest:copy(body),receipt};return copy(receipt);
    }
    const id=path.split('/').at(-2),operation=data.operations[id],m=operation.manifest;
    if(path.endsWith('/abort')){operation.receipt={status:'ok',wiki_operation:true,operation_id:id,manifest_hash:m.manifest_hash,state:'aborted',pages:[]};return copy(operation.receipt);}
    const pages=[];
    for(const entry of body.documents){
      const c=m.changes.find(c=>c.wiki_id===entry.wiki_id),time='2026-11-01T00:00:00.000000Z';
      const current=setCurrent('wiki:'+entry.wiki_id,{id:2,owner_id:ctx.owner,local_id:'wiki:'+entry.wiki_id,device_id:ctx.device,note_type:'tree',
        title:'AI Wiki '+entry.wiki_id,content:P.canonicalJson(entry.document),source:'wiki-artifact',parent_local_id:null,level:1,tags:null,deleted_at:null,created_at:time,updated_at:time,client_updated_at:time},c.base_head_version+1);
      pages.push({status:'ok',wiki_operation:true,operation_id:id,manifest_hash:m.manifest_hash,wiki_id:entry.wiki_id,mutation_id:c.note_mutation_id,result_revision_id:current.head_revision_id,
        result_head_version:current.head_version,result_inventory_revision_ids:current.inventory_revision_ids,crypto_epoch:0,history_generation:current.history_generation,
        document_version:entry.document.document_version,index_version:c.base_index_version+1,document_schema_floor:2,result_document_hash:c.result_document_hash});
    }
    operation.receipt={status:'ok',wiki_operation:true,operation_id:id,manifest_hash:m.manifest_hash,state:'committed',pages};
    if(loseCommit){loseCommit=false;throw Error('합성 확정 응답 유실');}return copy(operation.receipt);
  };
  const history=NowNoteHistory.create({initial,context:()=>ctx,write,request:(_ctx,path,method,body)=>request('/api/v2/notes/'+path,method,body)});
  const api={context:()=>ctx,contextKey:()=>P.canonicalJson(ctx),history:()=>history,viewGeneration:()=>0,
    source:id=>{const item=history.view(id);return item?{owner:ctx.owner,localId:id,status:'ok',origin:item.localOnly?'local':'server',title:item.draft.title,content:item.draft.content,protected:history.blocked(id),revisionId:item.base.head_revision_id,headVersion:item.base.head_version}:null;},
    readCurrent:async id=>currentOf(id),listRemote:async()=>[],readRemote:async id=>{
      const current=currentOf('wiki:'+id),document=P.parseJson(current.snapshot.note.content),payload={artifact_local_id:'wiki:'+id,dependencies:document.drafts[0].evidence_manifest.map(r=>r.note_ref),wiki_dependencies:[],document_schema_floor:2};payload.lineage_manifest_hash=await P.hashJson(payload);
      return {resource:{owner_id:ctx.owner,id,schema_version:2,version:current.head_version,deleted_at:null,payload},artifact:{protected:false,head_revision_id:current.head_revision_id,document},source_status:{available:true,stale:false}};
    }};
  api.lifecycle=NowWikiLifecycle.create(api);api.sources=NowNoteWikiSources.create(api);api.server=NowWikiServerAccess.create({...api,request,readWiki:api.readRemote});
  let ingest;const notebook=createWikiNotebook({...api,approveV2:(v,id)=>ingest.approveLocal(v,id),rejectV2:(v,id)=>ingest.rejectLocal(v,id)});
  api.captureNotes=ids=>notebook.capture(ids);ingest=createWikiIngestNotebook(api);
  if(phase===1)await api.sources.captureFiles([new File(['Exact published fixture evidence.'],'published.md')]);
  const ui=mountNowWiki({...notebook,sources:api.sources,ingest,contextKey:api.contextKey,notes:()=>[],connection:()=>({provider:'fixture',model:'Combo/auto',endpoint:'https://synthetic-provider.invalid',outputTokens:4096,callLimit:1,reasoning:'high',
    invoke:async text=>{models++;const input=JSON.parse(text).input;return JSON.stringify({pages:input.pages.map(p=>({wiki_id:p.wiki_id,draft_id:p.draft_id,title:'Published guide',topic:'Published guide',page_type:'concept',summary:'Synthetic summary',aliases:[],claims:[],relations:[],
      sections:[{id:'s1',title:'Evidence',markdown:'Synthetic finding',citation_ids:['c1']}],citations:[{id:'c1',evidence_id:input.sources[0].id,section_id:null,quote:'Exact published fixture evidence.'}]}))});}})});
  const button=(action,operation)=>document.querySelector('#wikiDialog '+(operation?'[data-wiki-operation="'+operation+'"] ':'')+'[data-wiki-action="'+action+'"]');
  const click=async(action,operation)=>{const b=button(action,operation);expect(b&&!b.disabled,'remote_ui_button_'+action);b.click();await pause();};
  const idle=()=>until(()=>!document.querySelector('#wikiDialog [data-wiki-action=sources]')?.disabled,'remote_ui_idle');
  await ui.open();await click('sources');await idle();
  if(phase===1){
    document.querySelector('#wikiDialog [name=wiki-ingest-file]').click();
    await click('publish-sources');await until(()=>button('confirm-change'),'publication_confirm');expect(posts===0,'publication_before_consent');
    await click('cancel-send');await idle();expect(posts===0,'publication_cancel_sent');
    await click('publish-sources');await until(()=>button('confirm-change'),'publication_confirm2');await click('confirm-change');await idle();
    expect((await api.sources.list())[0].manifest.origin==='server','publication_actual_revision');
    await click('plan-ingest');await idle();await click('generate-ingest');await until(()=>button('confirm-send'),'remote_consent');expect(models===0,'remote_preconsent_model');
    await click('confirm-send');await until(()=>button('commit-ingest'),'remote_proposal');expect((await notebook.list()).length===0,'remote_implicit_draft');
    await click('commit-ingest');await idle();const operation=(await ingest.operations())[0];
    await click('prepare-ingest',operation.operation_id);await idle();await click('commit-server-ingest',operation.operation_id);await idle();
    expect((await ingest.operations())[0].remote.phase==='commit_uncertain','remote_lost_commit');expect(!history.manages('wiki:'+operation.documents[0].wiki_id),'remote_implicit_settle');
    expect(models===1,'remote_single_model');
  }else{
    const operation=(await ingest.operations()).find(o=>o.remote.phase==='commit_uncertain');expect(operation,'remote_cold_operation');const before=posts;
    await click('status-ingest',operation.operation_id);await idle();expect(posts===before,'remote_status_repeated_write');
    await click('apply-server-ingest',operation.operation_id);await idle();expect((await ingest.operations()).find(o=>o.operation_id===operation.operation_id).state==='committed','remote_settle');
    await click('sources');await idle();document.querySelector('#wikiDialog .wiki-entry button').click();await idle();await click('approve');await idle();
    const approval=(await ingest.operations()).find(o=>o.action==='approve');expect(approval?.remote.phase==='staged','remote_separate_approval');
    await click('prepare-ingest',approval.operation_id);await idle();await click('commit-server-ingest',approval.operation_id);await idle();await click('apply-server-ingest',approval.operation_id);await idle();
    expect((await notebook.list())[0].document.approvals.length===1&&models===0,'remote_approval_cold_no_model');
  }
  await history.idle();return {backend:data,report:{phase,posts,syntheticModels:models,operationStates:(await ingest.operations()).map(o=>({action:o.action,state:o.state,phase:o.remote?.phase})),realProviderCalls:0}};
};
