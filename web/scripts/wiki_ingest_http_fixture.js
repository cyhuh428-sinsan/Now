/* Real product adapters and Wiki HTTP; only the model callback is synthetic. */
globalThis.runWikiIngestHttpFixture=async function({config,request,settle}){
  const check=(value,code)=>{if(!value)throw Error('wiki_ingest_'+code);};
  const delay=()=>new Promise(resolve=>setTimeout(resolve,20));
  async function until(test,code){for(let i=0;i<900;i++){if(await test())return;await delay();}throw Error('wiki_ingest_'+code);}
  await until(()=>!serverSyncRunning,'initial_sync');
  if(isDesktopClient())await loadServerSharedNotes({replace:true});
  await settle();
  const ids=['target','other','beta'].map(name=>'qa-http-'+config.run+'-'+name);
  check(ids.every(id=>wikiSourceNote(id)?.origin==='server'),'server_sources');
  let modelCalls=0;
  const generate=async selection=>{
    const operation=await wikiIngest.plan({fileIds:[],noteIds:selection});
    const proposal=await wikiIngest.generate(operation,{provider:'fixture',model:'synthetic-only',invoke:async()=>{
      modelCalls++;
      return JSON.stringify({pages:operation.plan.pages.map(page=>{
        const candidate=operation.plan.candidates.find(c=>c.wiki_id===page.wiki_id||c.action==='new'&&page.source_ids?.includes(c.source_id));
        const source=operation.plan.snapshot.sources.find(s=>s.id===candidate?.source_id)||operation.plan.snapshot.sources[operation.plan.pages.indexOf(page)];
        return {wiki_id:page.wiki_id,draft_id:page.draft_id,title:source.title,topic:source.title,page_type:'concept',summary:'Synthetic HTTP evidence',aliases:[],claims:[],relations:[],
          sections:[{id:'s1',title:'Finding',markdown:'Synthetic supported finding.',citation_ids:['c1']}],
          citations:[{id:'c1',evidence_id:source.id,section_id:null,quote:source.content}]};
      })});
    }});
    await wikiIngest.stageServer(proposal);return {operation,proposal};
  };
  const command=(action,id)=>document.querySelector('#wikiDialog [data-wiki-operation="'+id+'"] [data-wiki-action="'+action+'"]');
  async function click(action,id){
    await until(()=>{const b=command(action,id);return b&&!b.disabled;},'button_'+action);
    command(action,id).click();
    await until(()=>!document.querySelector('#wikiDialog [data-wiki-action=sources]')?.disabled,'idle_'+action);
  }
  async function publish(id){
    await wikiUI.open();
    document.querySelector('#wikiDialog [data-wiki-action=sources]').click();
    await click('prepare-ingest',id);
    check((await wikiIngest.operations()).find(o=>o.operation_id===id).remote.phase==='prepared','prepared');
    await click('commit-server-ingest',id);
    check((await wikiIngest.operations()).find(o=>o.operation_id===id).remote.phase==='server_committed','committed');
    await click('apply-server-ingest',id);
    check((await wikiIngest.operations()).find(o=>o.operation_id===id).remote.phase==='settled','settled');
  }
  const ownerQuery='?owner_id='+encodeURIComponent(config.credentials.a.owner);
  if(config.phase===50){
    const initial=await generate([ids[0]]);await publish(initial.operation.operation_id);
    let alpha=(await wikiNotebook.list())[0].document;
    const approved=await wikiIngest.approveLocal(alpha,alpha.drafts[0].id);await publish(approved.operation_id);
    const combined=await generate([ids[1],ids[2]]);
    check(combined.operation.plan.pages.length===2&&combined.operation.plan.inputs.filter(r=>r.kind==='wiki').length===1,'comparison_plan');
    await publish(combined.operation.operation_id);
    const rows=await wikiNotebook.list(),beta=rows.find(row=>row.document?.drafts.at(-1).title==='Beta');
    check(beta,'comparison_read');
    const visibility=await wikiNotebook.sourceStatus(beta.document.drafts.at(-1),beta.document);
    check(visibility.available&&!visibility.stale,'comparison_visibility');
    const betaDraft=beta.document.drafts.at(-1),ref=betaDraft.evidence_manifest.find(r=>r.kind==='wiki');
    check(ref&&ref.wiki_id===alpha.wiki_id,'comparison_retained');
    const decision=await wikiIngest.approveLocal(beta.document,betaDraft.id);await publish(decision.operation_id);
    const remote=await request('/api/v1/wikis/'+beta.document.wiki_id+ownerQuery);
    check(remote.resource.payload.wiki_dependencies.some(r=>r.wiki_id===alpha.wiki_id),'server_dependency');
    check((await wikiIngest.plan({fileIds:[],noteIds:[ids[1],ids[2]]})).plan.calls===0,'unchanged');
    check(modelCalls===2,'model_count');
  }else{
    const rows=await wikiNotebook.list(),beta=rows.find(row=>row.document?.drafts.at(-1).title==='Beta');
    check(rows.length===2&&beta&&beta.document.approvals.length===1,'cold_read');
    const visibility=await wikiNotebook.sourceStatus(beta.document.drafts.at(-1),beta.document);
    check(visibility.available&&!visibility.stale,'cold_visibility');
    check((await wikiIngest.operations()).every(row=>row.state==='committed'&&row.remote.phase==='settled'),'cold_receipts');
    check((await wikiIngest.plan({fileIds:[],noteIds:[ids[1],ids[2]]})).plan.calls===0,'cold_unchanged');
    const remote=await request('/api/v1/wikis/'+beta.document.wiki_id+ownerQuery);
    check(remote.resource.payload.wiki_dependencies.length===1,'cold_dependency');
    check(modelCalls===0,'cold_model');
    await wikiUI.open();
  }
  await noteHistory.idle();await settle();
  return {ok:true,mode:config.mode,phase:config.phase,actualWikiHttp:true,comparisonDependency:true,modelCallbacks:modelCalls,externalProviderCalls:0,
    operations:(await wikiIngest.operations()).map(row=>({id:row.operation_id,state:row.state,phase:row.remote.phase})),
    wikis:(await wikiNotebook.list()).map(row=>({id:row.document.wiki_id,version:row.document.document_version,approvals:row.document.approvals.length}))};
};
