/* Real product adapters and Wiki HTTP; only the model callback is synthetic. */
globalThis.runWikiIngestHttpFixture=async function({config,request,settle,login}){
  const check=(value,code)=>{if(!value)throw Error('wiki_ingest_'+code);};
  const delay=()=>new Promise(resolve=>setTimeout(resolve,20));
  async function until(test,code){for(let i=0;i<900;i++){if(await test())return;await delay();}throw Error('wiki_ingest_'+code);}
  await until(()=>!serverSyncRunning,'initial_sync');
  if(isDesktopClient())await loadServerSharedNotes({replace:true});
  await settle();
  const ids=['target','other','beta'].map(name=>'qa-http-'+config.run+'-'+name);
  check(ids.every(id=>wikiSourceNote(id)?.origin==='server'),'server_sources');
  let modelCalls=0;
  const wikiCitation=[54,55].includes(config.phase);
  const generate=async selection=>{
    const operation=await wikiIngest.plan({fileIds:[],noteIds:selection});
    const proposal=await wikiIngest.generate(operation,{provider:'fixture',model:'synthetic-only',invoke:async()=>{
      modelCalls++;
      return JSON.stringify({pages:operation.plan.pages.map((page,n)=>{
        const candidate=operation.plan.candidates.find(c=>c.wiki_id===page.wiki_id||c.action==='new'&&page.source_ids?.includes(c.source_id));
        const source=operation.plan.snapshot.sources.find(s=>s.id===candidate?.source_id)||operation.plan.snapshot.sources[operation.plan.pages.indexOf(page)];
        const other=operation.plan.pages[1-n],relations=config.wikiIntegration&&other?[{id:'retained-relation',from_section_id:'s1',to_ref:{kind:'proposal',operation_id:operation.operation_id,wiki_id:other.wiki_id,draft_id:other.draft_id,section_id:'s1'},type:'related_to',confidence:'inferred',citation_ids:['c1']}]:[];
        const citations=[{id:'c1',evidence_id:source.id,section_id:null,quote:source.content}];
        const comparison=wikiCitation&&operation.plan.transmission.comparison_targets.find(t=>t.wiki_id!==page.wiki_id);
        if(comparison)citations.push({id:'c-wiki',evidence_id:comparison.evidence.id,section_id:comparison.draft.sections[0].id,quote:comparison.draft.sections[0].markdown});
        return {wiki_id:page.wiki_id,draft_id:page.draft_id,title:source.title,topic:source.title,page_type:'concept',summary:'Synthetic HTTP evidence',aliases:[],claims:[],relations,
          sections:[{id:'s1',title:'Finding',markdown:'Synthetic supported finding.',citation_ids:citations.map(c=>c.id)}],citations};
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
  let peerVerified=false,citationVerified=false;
  const formClick=async action=>{await until(()=>{const b=document.querySelector('#wikiDialog [data-wiki-action="'+action+'"]');return b&&!b.disabled;},'form_'+action);document.querySelector('#wikiDialog [data-wiki-action="'+action+'"]').click();};
  const capture=async stage=>{globalThis.__HTTP_CAPTURE_DONE__=false;console.log('HTTP_QA_EVENT '+JSON.stringify({stage}));await until(()=>globalThis.__HTTP_CAPTURE_DONE__||globalThis.__HTTP_CAPTURE_ERROR__,'capture');check(!globalThis.__HTTP_CAPTURE_ERROR__,'capture_failed');};
  if(wikiCitation){
    if(config.phase===54){
      const initial=await generate([ids[0]]);await publish(initial.operation.operation_id);
      const initialDoc=(await wikiNotebook.list())[0].document,approval=await wikiIngest.approveLocal(initialDoc,initialDoc.drafts[0].id);await publish(approval.operation_id);
      const combined=await generate([ids[1],ids[2]]);await publish(combined.operation.operation_id);
      const beta=(await wikiNotebook.list()).find(r=>r.document.drafts.at(-1).title==='Beta').document;
      const decision=await wikiIngest.approveLocal(beta,beta.drafts.at(-1).id);await publish(decision.operation_id);
    }
    const rows=await wikiNotebook.list(),beta=rows.find(r=>r.document.drafts.at(-1).title==='Beta')?.document,draft=beta?.drafts.at(-1);
    const ref=draft?.evidence_manifest.find(r=>r.kind==='wiki'),citation=draft?.citations.find(c=>c.evidence_id===ref?.id);
    check(ref&&citation,'compiled_citation');await wikiUI.open();
    document.querySelector('#wikiDialog [data-wiki-id="'+beta.wiki_id+'"] button.library-item').click();
    await until(()=>[...document.querySelectorAll('#wikiDialog .wiki-body blockquote')].some(n=>n.textContent.includes(citation.quote)&&n.querySelector('button:not(:disabled)')),'compiled_citation_button');
    await settle();const before=NowNoteProtectionProtocol.canonicalJson(noteHistory.export());
    [...document.querySelectorAll('#wikiDialog .wiki-body blockquote')].find(n=>n.textContent.includes(citation.quote)).querySelector('button').click();
    await until(()=>document.querySelector('#wikiDialog [name=wiki-version]')?.value===ref.draft_id&&!document.querySelector('#wikiDialog [name=wiki-version]').disabled,'compiled_citation_navigation');
    await settle();check(NowNoteProtectionProtocol.canonicalJson(noteHistory.export())===before,'citation_navigation_wrote_journal');
    check(Boolean(document.querySelector('#wikiDialog [data-wiki-section="'+citation.section_id+'"]')),'compiled_citation_section');
    check((await wikiIngest.operations()).length===4,'citation_operations');
    check(modelCalls===(config.phase===54?2:0),'citation_model_count');citationVerified=true;
  }else if(config.phase===52){
    check((await wikiIngest.operations()).length===0,'fresh_peer_empty_operations');
    const rows=await wikiNotebook.list(),alpha=rows.find(row=>row.document?.drafts.at(-1).title==='Alpha')?.document,beta=rows.find(row=>row.document?.drafts.at(-1).title==='Beta')?.document;
    check(alpha&&beta&&(await wikiNotebook.approvedCatalog()).edges.length===3,'fresh_peer_graph');
    const remote=await request('/api/v1/wikis/'+alpha.wiki_id+ownerQuery);
    check(remote.artifact.generation_provenance?.entries.length===alpha.drafts.length,'fresh_peer_generations');
    check((await wikiIngest.operations()).length===0,'proof_has_no_fake_operations');
    await wikiUI.open();document.querySelector('#wikiDialog [data-wiki-id="'+alpha.wiki_id+'"] button.library-item').click();
    await formClick('integrate');await until(()=>Boolean(document.querySelector('#wikiDialog [name=wiki-relation-target]')),'relation_form');
    check(document.querySelector('#wikiDialog [name=wiki-relation-target]').value===beta.wiki_id,'fixed_peer_target');
    await capture('wiki_relation_ready');await formClick('preview-integrate');
    await until(()=>Boolean(document.querySelector('#wikiDialog [data-wiki-action=commit-ingest]')),'peer_proposal');
    const operation=(await wikiIngest.operations())[0];check(operation.action==='integrate'&&operation.state==='attempted','peer_manual_operation');
    check((await wikiNotebook.approvedCatalog()).edges.length===3,'peer_preview_not_approved');
    await formClick('commit-ingest');await until(async()=>Boolean((await wikiIngest.operations())[0]?.remote),'peer_staged');
    await publish(operation.operation_id);
    const saved=(await wikiNotebook.list()).find(row=>row.document.wiki_id===alpha.wiki_id).document;
    const decision=await wikiIngest.approveLocal(saved,saved.drafts.at(-1).id);await publish(decision.operation_id);
    check((await wikiNotebook.approvedCatalog()).edges.length===4,'peer_new_relation_approved');
    const realMount=mountWikiGraph;
    try{
      globalThis.mountWikiGraph=options=>{const handle=realMount(options);globalThis.__HTTP_QA_WIKI_GRAPH__=handle;return handle;};
      await formClick('graph');await until(()=>Boolean(globalThis.__HTTP_QA_WIKI_GRAPH__?.instance),'actual_peer_graph');
      await capture('wiki_graph_ready');
      const controls=document.querySelector('.wiki-graph-controls'),from=controls.querySelector('[data-wiki-graph=from]'),to=controls.querySelector('[data-wiki-graph=to]');
      from.value=alpha.wiki_id;to.value=beta.wiki_id;controls.querySelector('[aria-label="승인 위키 사이 경로 찾기"]').click();
      check(document.querySelector('.wiki-graph-relations').textContent.includes('1개 관계'),'peer_path');
      await login(config.credentials.b);wikiUI.check();check(!document.querySelector('#wikiDialog').open&&__HTTP_QA_WIKI_GRAPH__.instance.destroyed(),'peer_account_concealed');
      check((await wikiNotebook.list()).length===0,'other_account_empty');
      let rejected=false;try{await request('/api/v1/wikis/'+alpha.wiki_id+ownerQuery);}catch(error){check(error.status===401&&error.deniedHasWikiData===false,'other_owner_status');rejected=true;}check(rejected,'other_owner_denied');
      await login(config.credentials.a);if(isDesktopClient())await loadServerSharedNotes({replace:true});
    }finally{globalThis.mountWikiGraph=realMount;}
    peerVerified=true;
  }else if(config.phase===53){
    const rows=await wikiNotebook.list();check(rows.length===2&&(await wikiNotebook.approvedCatalog()).edges.length===4,'peer_cold_graph');
    const operations=await wikiIngest.operations();check(operations.length===2&&operations.every(o=>o.state==='committed'&&o.remote.phase==='settled'),'peer_cold_only_own_operations');
    check(modelCalls===0,'peer_cold_no_model');peerVerified=true;await wikiUI.open();
  }else if(config.phase===50){
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
    if(config.wikiIntegration){
      const alphaRow=(await wikiNotebook.list()).find(row=>row.document.wiki_id===alpha.wiki_id),alphaDraft=alphaRow.document.drafts.at(-1);
      const alphaApproval=await wikiIngest.approveLocal(alphaRow.document,alphaDraft.id);await publish(alphaApproval.operation_id);
      check((await wikiNotebook.approvedCatalog()).edges.length===2,'original_bound_relations');
      const betaNow=(await wikiNotebook.list()).find(row=>row.document.wiki_id===beta.document.wiki_id).document,betaApproval=betaNow.approvals.at(-1);
      const manual=await wikiIngest.integrate(alpha.wiki_id,{id:'manual-relation',from_section_id:'s1',to_ref:{kind:'approved',wiki_id:betaNow.wiki_id,draft_id:betaApproval.draft_id,approval_id:betaApproval.id,draft_hash:betaApproval.draft_hash,section_id:'s1'},type:'extends',confidence:'inferred',citation_ids:['c1']});
      check(manual.proposal.plan.calls===0&&manual.proposal.documents[0].document.drafts.at(-1).relations[0].to_ref.operation_id===combined.operation.operation_id,'manual_retains_relation');
      await wikiIngest.stageServer(manual);await publish(manual.operation_id);
      check((await wikiNotebook.approvedCatalog()).edges.length===2,'manual_unapproved_hidden');
      const saved=(await wikiNotebook.list()).find(row=>row.document.wiki_id===alpha.wiki_id).document;
      const decision=await wikiIngest.approveLocal(saved,saved.drafts.at(-1).id);await publish(decision.operation_id);
      check((await wikiNotebook.approvedCatalog()).edges.length===3,'manual_approved_relation');
    }
    check(modelCalls===2,'model_count');
  }else{
    const rows=await wikiNotebook.list(),beta=rows.find(row=>row.document?.drafts.at(-1).title==='Beta');
    check(rows.length===2&&beta&&beta.document.approvals.length===1,'cold_read');
    const visibility=await wikiNotebook.sourceStatus(beta.document.drafts.at(-1),beta.document);
    check(visibility.available&&(config.wikiIntegration?visibility.stale:!visibility.stale),'cold_visibility');
    check((await wikiIngest.operations()).every(row=>row.state==='committed'&&row.remote.phase==='settled'),'cold_receipts');
    if(config.wikiIntegration)check((await wikiNotebook.approvedCatalog()).edges.length===3,'cold_manual_relations');
    else check((await wikiIngest.plan({fileIds:[],noteIds:[ids[1],ids[2]]})).plan.calls===0,'cold_unchanged');
    const remote=await request('/api/v1/wikis/'+beta.document.wiki_id+ownerQuery);
    check(remote.resource.payload.wiki_dependencies.length===1,'cold_dependency');
    check(modelCalls===0,'cold_model');
    await wikiUI.open();
  }
  await noteHistory.idle();await settle();
  return {ok:true,mode:config.mode,phase:config.phase,actualWikiHttp:true,comparisonDependency:true,manualIntegration:config.wikiIntegration===true,peerVerified,citationVerified,clientDeviceId:noteHistoryContext().device,modelCallbacks:modelCalls,externalProviderCalls:0,
    operations:(await wikiIngest.operations()).map(row=>({id:row.operation_id,state:row.state,phase:row.remote.phase})),
    wikis:(await wikiNotebook.list()).map(row=>({id:row.document.wiki_id,version:row.document.document_version,approvals:row.document.approvals.length}))};
};
