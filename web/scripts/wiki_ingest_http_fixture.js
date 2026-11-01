/* Real product adapters and Wiki HTTP; only the model callback is synthetic. */
globalThis.runWikiIngestHttpFixture=async function({config,request,settle,login}){
  const check=(value,code)=>{if(!value)throw Error('wiki_ingest_'+code);};
  const delay=()=>new Promise(resolve=>setTimeout(resolve,20));
  async function until(test,code){const started=performance.now();for(let i=0;i<900;i++){if(await test())return;await delay();}globalThis.__WIKI_QA_WAIT_FAILURE__={code:'wiki_ingest_'+code,elapsedMs:Math.round(performance.now()-started)};globalThis.__WIKI_QA_FAILURE_STATE__=globalThis.__HTTP_QA_CAPTURE_FAILURE__?.();throw Error('wiki_ingest_'+code);}
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
  let peerVerified=false,citationVerified=false,queryVerified=false,protectedQueryVerified=false,lintVerified=false,protectedLintVerified=false,journeyVerified=false;
  const formClick=async action=>{await until(()=>{const b=document.querySelector('#wikiDialog [data-wiki-action="'+action+'"]');return b&&!b.disabled;},'form_'+action);document.querySelector('#wikiDialog [data-wiki-action="'+action+'"]').click();};
  const capture=async stage=>{globalThis.__HTTP_CAPTURE_DONE__=false;console.log('HTTP_QA_EVENT '+JSON.stringify({stage}));await until(()=>globalThis.__HTTP_CAPTURE_DONE__||globalThis.__HTTP_CAPTURE_ERROR__,'capture');check(!globalThis.__HTTP_CAPTURE_ERROR__,'capture_failed');};
  if([66,67,68,69].includes(config.phase)){
    const approve=async document=>{const decision=await wikiIngest.approveLocal(document,document.drafts.at(-1).id);await publish(decision.operation_id);};
    if(config.phase===66){
      const snapshot=await wikiNotebook.capture([ids[1]]),source=snapshot.sources[0];
      const legacy=await NowNoteWiki.validateDraft({title:source.title,topic:source.title,sections:[{id:'legacy',title:'Legacy',markdown:'Synthetic legacy finding.',citation_ids:['legacy-cite']}],
        citations:[{id:'legacy-cite',source_id:source.id,quote:source.content}]},snapshot,{provider:'fixture',model:'synthetic-only'});
      const old={schema_version:1,document_version:1,wiki_id:crypto.randomUUID(),scope:structuredClone(snapshot.scope),drafts:[legacy],approvals:[],rejected_draft_ids:[]};
      await wikiNotebook.save(old);await wikiNotebook.approve(old,legacy.id);
      check((await wikiNotebook.list()).some(row=>row.document?.schema_version===1),'journey_legacy_saved');
      const seed=await generate([ids[0],ids[2]]);await publish(seed.operation.operation_id);
      await approve((await wikiNotebook.list()).find(row=>row.document?.drafts.at(-1).title==='Beta').document);
      const migrated=(await wikiNotebook.list()).find(row=>row.document?.wiki_id===old.wiki_id)?.document;
      check(migrated?.schema_version===2&&migrated.drafts.some(d=>!d.schema_version)&&migrated.drafts.some(d=>d.schema_version===2),'journey_legacy_retained');
      await approve(migrated);
      const refreshed=await generate([ids[2]]);await publish(refreshed.operation.operation_id);
      await approve((await wikiNotebook.list()).find(row=>row.document?.drafts.at(-1).title==='Beta').document);
    }
    if(config.phase===68){
      const alpha=(await wikiNotebook.list()).find(row=>row.document?.drafts.at(-1).title==='Alpha').document;
      const beta=(await wikiNotebook.list()).find(row=>row.document?.drafts.at(-1).title==='Beta').document;
      await wikiUI.open();document.querySelector('#wikiDialog [data-wiki-id="'+beta.wiki_id+'"] button.library-item').click();
      await formClick('integrate');await until(()=>document.querySelector('[name=wiki-relation-target]'),'journey_relation');
      const target=document.querySelector('[name=wiki-relation-target]');target.value=alpha.wiki_id;target.dispatchEvent(new Event('change',{bubbles:true}));
      await formClick('preview-integrate');await until(()=>document.querySelector('[data-wiki-action=commit-ingest]'),'journey_relation_preview');
      await formClick('commit-ingest');await until(async()=>(await wikiIngest.operations()).some(o=>o.action==='integrate'&&o.remote?.phase==='staged'),'journey_relation_staged');
      const relation=(await wikiIngest.operations()).find(o=>o.action==='integrate'&&o.remote?.phase==='staged');await publish(relation.operation_id);
      await approve((await wikiNotebook.list()).find(row=>row.document?.wiki_id===beta.wiki_id).document);
      const originalConfig=state.settings.llm,originalFetch=globalThis.fetch;let queryCalls=0;
      state.settings.llm={...originalConfig,provider:'omniroute',omniUrl:'https://journey-model.invalid',omniModel:'Combo/auto',omniReasoning:'medium',omniApiKey:'synthetic-only'};
      globalThis.fetch=async(url,options)=>{
        if(url!=='https://journey-model.invalid/v1/chat/completions')return originalFetch(url,options);
        queryCalls++;const requestBody=JSON.parse(options.body),input=JSON.parse(requestBody.messages.at(-1).content).input,page=input.pages[0];
        check(requestBody.max_tokens===2048&&input.pages.length===2&&input.pages.every(p=>[alpha.wiki_id,beta.wiki_id].includes(p.wiki_id)),'journey_query_scope');
        return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({query_hash:input.query_hash,title:'I12 synthetic answer',claims:[{id:'a',statement:'Synthetic compiled candidate',assessment:'inferred',citation_ids:['c']}],
          citations:[{id:'c',wiki_id:page.wiki_id,draft_id:page.draft_id,approval_id:page.approval_id,draft_hash:page.draft_hash,document_version:page.document_version,section_id:page.draft.sections[0].id,quote:page.draft.sections[0].markdown}],uncertainties:[]})}}]})};
      };
      try{
        await wikiUI.open();await formClick('query');
        const question=document.querySelector('[name=wiki-query-question]');question.value='I12 combined sources';question.dispatchEvent(new Event('input',{bubbles:true}));
        const range=document.querySelector('[name=wiki-query-scope]');range.value='selected';range.dispatchEvent(new Event('change',{bubbles:true}));
        for(const input of document.querySelectorAll('[name=wiki-query-page]'))input.click();
        await formClick('query-plan');await formClick('query-run');await until(()=>document.querySelector('[data-wiki-action=confirm-send]'),'journey_query_consent');await formClick('confirm-send');
        await until(()=>document.querySelector('[data-wiki-query-answer]'),'journey_query_answer');check(queryCalls===1,'journey_query_once');
        await formClick('query-save');await until(()=>document.querySelector('[data-wiki-action=confirm-change]'),'journey_answer_save_consent');await formClick('confirm-change');
        await until(()=>document.querySelector('[data-wiki-action=commit-ingest]'),'journey_answer_preview');await formClick('commit-ingest');
        await until(async()=>(await wikiIngest.operations()).some(o=>o.inputs.every(r=>r.kind==='wiki')&&o.remote?.phase==='staged'),'journey_answer_staged');
        const operation=(await wikiIngest.operations()).find(o=>o.inputs.every(r=>r.kind==='wiki')&&o.remote?.phase==='staged');await publish(operation.operation_id);
        await approve((await wikiNotebook.list()).find(row=>row.document?.drafts.at(-1).title==='I12 synthetic answer').document);
        modelCalls+=queryCalls;
      }finally{wikiUI.close();state.settings.llm=originalConfig;globalThis.fetch=originalFetch;}
    }
    if(config.phase===69){
      await wikiUI.open();await formClick('lint');await formClick('lint-run');await until(()=>document.querySelector('[data-wiki-lint-report]'),'journey_lint');
      check(document.querySelector('[data-wiki-lint-report]').textContent.includes('검사 3'),'journey_lint_scope');
      await formClick('lint-save');await until(()=>document.querySelector('[data-wiki-action=confirm-change]'),'journey_report_consent');await formClick('confirm-change');
      await until(()=>document.querySelector('[data-wiki-action=commit-ingest]'),'journey_report_preview');await formClick('commit-ingest');
      await until(async()=>(await wikiIngest.operations()).some(o=>o.inputs.length===3&&o.inputs.every(r=>r.kind==='wiki')&&o.remote?.phase==='staged'),'journey_report_staged');
      const report=(await wikiIngest.operations()).find(o=>o.inputs.length===3&&o.inputs.every(r=>r.kind==='wiki')&&o.remote?.phase==='staged');await publish(report.operation_id);
      await approve((await wikiNotebook.list()).find(row=>row.document?.drafts.at(-1).title==='위키 점검 보고서').document);
    }
    const rows=await wikiNotebook.list(),migrated=rows.find(row=>row.document?.drafts.some(d=>!d.schema_version))?.document;
    const expectedDocuments=config.phase===66?2:config.phase===68?3:4,expectedOperations=config.phase===66?5:config.phase===68?9:11;
    check(rows.length===expectedDocuments&&migrated?.schema_version===2&&migrated.drafts.length===2,'journey_cold_documents');
    check(rows.every(row=>row.document?.approvals.at(-1)?.draft_id===row.document.drafts.at(-1).id),'journey_all_approved');
    check((await wikiIngest.operations()).length===expectedOperations,'journey_operation_count');
    if(config.phase!==66){
      const answer=rows.find(row=>row.document.drafts.at(-1).title==='I12 synthetic answer').document;
      check(answer.drafts.at(-1).evidence_manifest.length===2,'journey_answer_inputs');
      check((await wikiNotebook.approvedCatalog()).edges.length===1,'journey_relation_persisted');queryVerified=true;
    }
    if([69,67].includes(config.phase)){
      const report=rows.find(row=>row.document.drafts.at(-1).title==='위키 점검 보고서').document;
      check(report.drafts.at(-1).evidence_manifest.length===3,'journey_report_inputs');lintVerified=true;
    }
    if(config.phase===67){
      await wikiUI.open();await settle();const before=NowNoteProtectionProtocol.canonicalJson(noteHistory.export());
      await formClick('lint');await formClick('lint-run');await until(()=>document.querySelector('[data-wiki-lint-report]'),'journey_cold_lint');
      check(document.querySelector('[data-wiki-lint-report]').textContent.includes('검사 4'),'journey_cold_lint_scope');
      check(NowNoteProtectionProtocol.canonicalJson(noteHistory.export())===before,'journey_cold_lint_no_write');journeyVerified=true;
    }
    check(modelCalls===(config.phase===66?2:config.phase===68?1:0),'journey_model_count');wikiUI.close();
  }else if([62,63].includes(config.phase)){
    if(config.phase===62){
      const seed=await generate([ids[0],ids[2]]);await publish(seed.operation.operation_id);
      for(const row of await wikiNotebook.list()){
        const decision=await wikiIngest.approveLocal(row.document,row.document.drafts[0].id);await publish(decision.operation_id);
      }
      const target=(await wikiNotebook.list())[0].document,local='wiki:'+target.wiki_id,password='qa-lint-protection-'+config.run;
      check(target.drafts.every(d=>NowNoteWiki.evidenceOf(d).every(ref=>ref.kind==='note')),'lint_protection_independent_target');
      const pd=()=>document.querySelector('#noteProtectionDialog'),pb=name=>pd()?.querySelector('[data-action="'+name+'"]');
      async function protectionWait(test,code){
        for(let n=0;n<2500;n++){
          const form=pd()?.querySelector('form.library-confirm');
          if(form){form.querySelector('input').value=password;form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));}
          if(await test()&&pb('refresh')?.disabled===false)return;await delay();
        }
        throw Error('wiki_ingest_lint_protection_'+code);
      }
      wikiUI.close();await openWikiProtection(target.wiki_id);await protectionWait(()=>pd()?.open,'open');
      const copies=[...pd().querySelectorAll('.protection-copies input')];copies.forEach(input=>input.checked=true);
      if(copies.length){pb('confirm').click();await protectionWait(()=>!pd().querySelector('.protection-copies input'),'copies');}
      pb('conversion').click();await protectionWait(()=>Object.values(noteHistory.protectionOperations()).some(row=>row.scope.local_id===local&&row.phase==='complete'),'conversion');
      const closed=new Promise(resolve=>pd().addEventListener('close',resolve,{once:true}));
      noteProtectionUI.lock();pb('close').click();await closed;
    }
    await wikiUI.open();await settle();const before=NowNoteProtectionProtocol.canonicalJson(noteHistory.export());
    await formClick('lint');await formClick('lint-run');await until(()=>document.querySelector('[data-wiki-lint-report]'),'protected_lint_report');
    const report=document.querySelector('[data-wiki-lint-report]');check(report.textContent.includes('검사 1 · 제외 1'),'protected_lint_counts');
    check(report.querySelector('[data-wiki-action=lint-save]')?.disabled&&report.querySelector('[data-wiki-action=lint-ai]')?.disabled,'protected_lint_scope_not_shrunk');
    check(report.querySelector('[data-lint-rule=wiki_lint_unreadable_excluded]'),'protected_lint_exclusion');
    check(NowNoteProtectionProtocol.canonicalJson(noteHistory.export())===before,'protected_lint_no_write');
    check((await wikiNotebook.list()).filter(row=>row.protected).length===1,'protected_lint_cold_state');
    check(modelCalls===(config.phase===62?1:0),'protected_lint_no_model');
    lintVerified=true;protectedLintVerified=true;wikiUI.close();
  }else if([60,61].includes(config.phase)){
    if(config.phase===60){
      const seed=await generate([ids[0],ids[2]]);await publish(seed.operation.operation_id);
      for(const row of await wikiNotebook.list()){
        const decision=await wikiIngest.approveLocal(row.document,row.document.drafts[0].id);await publish(decision.operation_id);
      }
    }
    const inspect=async()=>{
      await wikiUI.open();await settle();const before=NowNoteProtectionProtocol.canonicalJson(noteHistory.export());
      await formClick('lint');await formClick('lint-run');await until(()=>document.querySelector('#wikiDialog [data-wiki-lint-report]'),'lint_report');await settle();
      const expected=config.phase===60?2:3;
      check(document.querySelector('#wikiDialog [data-wiki-lint-report]').textContent.includes('검사 '+expected),'lint_checked');
      check(NowNoteProtectionProtocol.canonicalJson(noteHistory.export())===before,'lint_default_wrote_journal');return before;
    };
    const before=await inspect();
    if(config.phase===60){
      await formClick('lint-open');await until(()=>document.querySelector('#wikiDialog [data-wiki-section=s1]'),'lint_source_navigation');await settle();
      check(NowNoteProtectionProtocol.canonicalJson(noteHistory.export())===before,'lint_navigation_wrote_journal');
      await inspect();await formClick('lint-save');await until(()=>document.querySelector('#wikiDialog [data-wiki-action=confirm-change]'),'lint_save_consent');await formClick('confirm-change');
      await until(()=>document.querySelector('#wikiDialog [data-wiki-action=commit-ingest]'),'lint_save_preview');check((await wikiNotebook.list()).length===2,'lint_implicit_save');
      await formClick('commit-ingest');await until(async()=>Boolean((await wikiIngest.operations()).find(o=>o.inputs.every(r=>r.kind==='wiki')&&o.remote?.phase==='staged')),'lint_staged');
      const pending=(await wikiIngest.operations()).find(o=>o.inputs.every(r=>r.kind==='wiki')&&o.remote?.phase==='staged');await publish(pending.operation_id);
      const saved=(await wikiNotebook.list()).find(row=>row.document.drafts.at(-1).title==='위키 점검 보고서');
      check(saved.document.approvals.length===0&&saved.document.drafts[0].evidence_manifest.length===2&&saved.document.drafts[0].provider==='manual','lint_saved_dependencies');
      const decision=await wikiIngest.approveLocal(saved.document,saved.document.drafts[0].id);await publish(decision.operation_id);
    }
    const rows=await wikiNotebook.list(),saved=rows.find(row=>row.document.drafts.at(-1).title==='위키 점검 보고서');
    check(rows.length===3&&saved?.document.approvals.length===1&&saved.document.drafts[0].evidence_manifest.length===2,'lint_cold_document');
    check((await wikiIngest.operations()).length===5,'lint_original_operations');check(modelCalls===(config.phase===60?1:0),'lint_no_model_calls');
    lintVerified=true;wikiUI.close();
  }else if([58,59,64,65].includes(config.phase)){
    const pd=()=>document.querySelector('#noteProtectionDialog'),pb=name=>pd()?.querySelector('[data-action="'+name+'"]');
    const password=(config.phase>=64?'qa-lint-protection-':'qa-query-protection-')+config.run;
    async function protectedWait(test,code){
      for(let n=0;n<2500;n++){
        const form=pd()?.querySelector('form.library-confirm');
        if(form){form.querySelector('input').value=password;form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));}
        if(await test()&&pb('refresh')?.disabled===false)return;
        await delay();
      }
      const status=pd()?.querySelector('.protection-status')?.textContent?.trim()||'';
      console.log('HTTP_QA_EVENT '+JSON.stringify({stage:'protected_query_wait',code:/^wiki_[a-z0-9_]+$/.test(status)?status:'unclassified',open:Boolean(pd()?.open)}));
      throw Error('wiki_ingest_protected_query_'+code);
    }
    let id;
    if(config.phase===58){
      id=(await wikiNotebook.list()).find(row=>row.document?.drafts.at(-1).title==='HTTP Query answer')?.document.wiki_id;check(id,'protected_query_target');
    }else{
      const list=(await request('/api/v1/wikis'+ownerQuery)).items;
      for(const row of list){const item=await request('/api/v1/wikis/'+row.id+ownerQuery);if(item.artifact.protected===true){check(!id,'protected_query_duplicate');id=row.id;}}
      check(id,'protected_query_cold_target');
    }
    const local='wiki:'+id;await openWikiProtection(id);await protectedWait(()=>pd()?.open,'open');
    if(config.phase===58){
      const inspect=wikiNotebook.protectionDependencies;
      wikiNotebook.protectionDependencies=async(...args)=>{
        try{return await inspect(...args);}catch(error){
          console.log('HTTP_QA_EVENT '+JSON.stringify({stage:'wiki_protection_preflight',code:/^wiki_[a-z0-9_]+$/.test(error.message)?error.message:'unclassified'}));throw error;
        }
      };
      const copies=[...pd().querySelectorAll('.protection-copies input')];copies.forEach(input=>input.checked=true);
      if(copies.length){pb('confirm').click();await protectedWait(()=>!pd().querySelector('.protection-copies input'),'copies');}
      pb('conversion').click();
      await protectedWait(()=>Object.values(noteHistory.protectionOperations()).some(row=>row.scope.local_id===local&&row.phase==='complete'),'conversion');
    }
    const remote=await request('/api/v1/wikis/'+id+ownerQuery);check(remote.artifact.protected===true&&!remote.artifact.document,'protected_query_server_plain');
    const select=pd().querySelector('[name=representation]'),body=[...select.options].find(option=>option.textContent.startsWith('note_body ·'));check(body,'protected_query_body');select.value=body.value;
    pb('wiki-preview').click();await protectedWait(()=>document.querySelector('#wikiDialog')?.open&&Boolean(document.querySelector('#wikiDialog [data-wiki-action=query]')),'unlock');
    const originalConfig=state.settings.llm,originalFetch=globalThis.fetch,answerMarker='PROTECTED-QUERY-ANSWER-'+config.run,questionMarker='PROTECTED-QUERY-QUESTION-'+config.run;let calls=0;
    state.settings.llm={...originalConfig,provider:'omniroute',omniUrl:'https://registered.invalid',omniModel:'Combo/auto',omniReasoning:'high',omniApiKey:'synthetic-only'};
    globalThis.fetch=async(url,options)=>{
      if(url!=='https://registered.invalid/v1/chat/completions')return originalFetch(url,options);
      calls++;const body=JSON.parse(options.body),input=JSON.parse(body.messages.at(-1).content).input,p=input.pages[0];
      check(input.pages.length===1&&p.protected===true&&p.wiki_id===id&&body.max_tokens===2048,'protected_query_input');
      return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({query_hash:input.query_hash,title:'Protected memory answer',
        claims:[{id:'a',statement:answerMarker,assessment:'supported',citation_ids:['c']}],citations:[{id:'c',wiki_id:p.wiki_id,draft_id:p.draft_id,
          approval_id:p.approval_id,draft_hash:p.draft_hash,document_version:p.document_version,section_id:p.draft.sections[0].id,quote:p.draft.sections[0].markdown}],uncertainties:[]})}}]})};
    };
    try{
      await settle();const before=NowNoteProtectionProtocol.canonicalJson(noteHistory.export());await formClick('query');
      const input=document.querySelector('#wikiDialog [name=wiki-query-question]');check(input,'protected_query_question');input.value=questionMarker;input.dispatchEvent(new Event('input',{bubbles:true}));
      await formClick('query-plan');await formClick('query-run');await until(()=>document.querySelector('#wikiDialog [data-wiki-action=confirm-send]'),'protected_query_consent');await formClick('confirm-send');
      await until(()=>document.querySelector('#wikiDialog [data-wiki-query-answer]'),'protected_query_answer');
      check(document.querySelector('#wikiDialog [data-wiki-action=query-save]')?.disabled,'protected_query_save_enabled');
      check(NowNoteProtectionProtocol.canonicalJson(noteHistory.export())===before,'protected_query_wrote_journal');
      noteProtectionUI.lock();check(!document.querySelector('#wikiDialog').open&&!document.querySelector('#wikiDialog').textContent.includes(answerMarker),'protected_query_lock_plaintext');
      for(const adapter of protectionStorageAdapters()){
        const value=JSON.stringify(await adapter.read());check(!value.includes(answerMarker)&&!value.includes(questionMarker),'protected_query_store_plaintext');
      }
      check(calls===1,'protected_query_repeated_model');modelCalls=calls;queryVerified=true;protectedQueryVerified=true;
    }finally{wikiUI.close();globalThis.fetch=originalFetch;state.settings.llm=originalConfig;}
  }else if([56,57].includes(config.phase)){
    if(config.phase===56){
      const seed=await generate([ids[0],ids[2]]);await publish(seed.operation.operation_id);
      for(const row of await wikiNotebook.list()){
        const decision=await wikiIngest.approveLocal(row.document,row.document.drafts[0].id);await publish(decision.operation_id);
      }
    }
    const originalConfig=state.settings.llm,originalFetch=globalThis.fetch;let queryCalls=0;
    state.settings.llm={...originalConfig,provider:'omniroute',omniUrl:'https://registered.invalid',omniModel:'Combo/auto',omniReasoning:'high',omniApiKey:'synthetic-only'};
    globalThis.fetch=async(url,options)=>{
      if(url!=='https://registered.invalid/v1/chat/completions')return originalFetch(url,options);
      queryCalls++;const body=JSON.parse(options.body),input=JSON.parse(body.messages.at(-1).content).input,p=input.pages[0];
      check(body.model==='Combo/auto'&&body.reasoning_effort==='high'&&body.max_tokens===2048,'query_registered_connection');
      check(input.pages.length===2&&input.pages.every(p=>!p.protected&&p.origin==='server'),'query_compiled_inputs');
      return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({query_hash:input.query_hash,title:'HTTP Query answer',
        claims:[{id:'a1',statement:'Synthetic compiled HTTP finding.',assessment:'supported',citation_ids:['c1']}],
        citations:[{id:'c1',wiki_id:p.wiki_id,draft_id:p.draft_id,approval_id:p.approval_id,draft_hash:p.draft_hash,document_version:p.document_version,section_id:'s1',quote:p.draft.sections[0].markdown}],uncertainties:[]})}}]})};
    };
    const query=async()=>{
      await wikiUI.open();await formClick('query');await until(()=>document.querySelector('#wikiDialog [name=wiki-query-question]'),'query_input');
      const input=document.querySelector('#wikiDialog [name=wiki-query-question]');input.value='Synthetic';input.dispatchEvent(new Event('input',{bubbles:true}));
      await formClick('query-plan');await until(()=>document.querySelector('#wikiDialog [data-wiki-action=query-run]'),'query_plan');
      await formClick('query-run');await until(()=>document.querySelector('#wikiDialog [data-wiki-action=confirm-send]'),'query_consent');await formClick('confirm-send');
      await until(()=>document.querySelector('#wikiDialog [data-wiki-query-answer]'),'query_answer');await settle();
    };
    try{
      await wikiUI.open();await settle();const before=NowNoteProtectionProtocol.canonicalJson(noteHistory.export());
      await query();check(NowNoteProtectionProtocol.canonicalJson(noteHistory.export())===before,'query_default_wrote_journal');
      await formClick('query-original-source');await until(()=>document.querySelector('#wikiDialog [data-wiki-query-original]'),'query_original');
      const original=document.querySelector('#wikiDialog [data-wiki-query-original]');
      check(original.textContent.includes('HTTP-QA-')&&original.querySelector('small').textContent.match(/[0-9a-f-]{36}/),'query_original_revision');
      await formClick('query-wiki-source');await until(()=>document.querySelector('#wikiDialog [data-wiki-section=s1]'),'query_wiki_section');await settle();
      check(NowNoteProtectionProtocol.canonicalJson(noteHistory.export())===before,'query_navigation_wrote_journal');
      if(config.phase===56){
        await query();await formClick('query-save');await until(()=>document.querySelector('#wikiDialog [data-wiki-action=confirm-change]'),'query_save_consent');await formClick('confirm-change');
        await until(()=>document.querySelector('#wikiDialog [data-wiki-action=commit-ingest]'),'query_save_preview');check((await wikiNotebook.list()).length===2,'query_implicit_save');
        await formClick('commit-ingest');await until(async()=>Boolean((await wikiIngest.operations()).find(o=>o.inputs.every(r=>r.kind==='wiki')&&o.remote?.phase==='staged')),'query_staged');
        const pending=(await wikiIngest.operations()).find(o=>o.inputs.every(r=>r.kind==='wiki')&&o.remote?.phase==='staged');await publish(pending.operation_id);
        const saved=(await wikiNotebook.list()).find(row=>row.document.drafts.at(-1).title==='HTTP Query answer');
        check(saved.document.approvals.length===0&&saved.document.drafts[0].evidence_manifest.length===2,'query_saved_dependencies');
        const approval=await wikiIngest.approveLocal(saved.document,saved.document.drafts[0].id);await publish(approval.operation_id);
      }
      const rows=await wikiNotebook.list(),saved=rows.find(row=>row.document.drafts.at(-1).title==='HTTP Query answer');
      check(rows.length===3&&saved?.document.approvals.length===1&&saved.document.drafts[0].evidence_manifest.length===2,'query_cold_document');
      check((await wikiIngest.operations()).length===5,'query_original_operations');
      check(queryCalls===(config.phase===56?2:1),'query_model_calls');modelCalls+=queryCalls;queryVerified=true;
    }finally{wikiUI.close();globalThis.fetch=originalFetch;state.settings.llm=originalConfig;}
  }else if(wikiCitation){
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
  return {ok:true,mode:config.mode,phase:config.phase,actualWikiHttp:true,comparisonDependency:true,manualIntegration:config.wikiIntegration===true||[67,68,69].includes(config.phase),peerVerified,citationVerified,queryVerified,protectedQueryVerified,lintVerified,protectedLintVerified,journeyVerified,clientDeviceId:noteHistoryContext().device,modelCallbacks:modelCalls,externalProviderCalls:0,
    operations:(await wikiIngest.operations()).map(row=>({id:row.operation_id,state:row.state,phase:row.remote.phase})),
    wikis:(await wikiNotebook.list()).map(row=>({id:row.document?.wiki_id||row.id,version:row.document?.document_version??null,approvals:row.document?.approvals.length??null,protected:row.protected===true}))};
};
