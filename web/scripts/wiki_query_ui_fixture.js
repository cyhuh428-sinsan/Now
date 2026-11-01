globalThis.runWikiQueryUiFixture=async function(phase){
  const P=NowNoteProtectionProtocol,original=state.settings.llm,realFetch=globalThis.fetch;
  let calls=0,requestBody;
  const check=(value,code)=>{if(!value)throw Error(code);};
  const pause=()=>new Promise(r=>setTimeout(r,5));
  const until=async(fn,code)=>{for(let n=0;n<400;n++){if(fn())return;await pause();}throw Error(code+':'+(document.querySelector('#wikiDialog [role=status]')?.textContent||''));};
  const button=name=>document.querySelector('#wikiDialog [data-wiki-action="'+name+'"]');
  const click=async name=>{check(button(name)&&!button(name).disabled,'query_button_'+name);button(name).click();await pause();};
  state.settings.llm={...original,provider:'omniroute',omniUrl:'https://registered.invalid',omniModel:'Combo/auto',omniReasoning:'high',omniApiKey:'synthetic-only'};
  globalThis.fetch=async(url,options)=>{
    if(url!=='https://registered.invalid/v1/chat/completions')return realFetch(url,options);
    calls++;requestBody=JSON.parse(options.body);const input=JSON.parse(requestBody.messages.at(-1).content).input,page=input.pages[0];
    check(input.question==='Synthetic','query_actual_compiled_request');
    return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({query_hash:input.query_hash,title:'Synthetic answer',
      claims:[{id:'a1',statement:'Synthetic compiled finding',assessment:'supported',citation_ids:['c1']}],
      citations:[{id:'c1',wiki_id:page.wiki_id,draft_id:page.draft_id,approval_id:page.approval_id,draft_hash:page.draft_hash,document_version:page.document_version,section_id:'s1',quote:page.draft.sections[0].markdown}],uncertainties:[]})}}]})};
  };
  try{
    wikiUI.close();await wikiUI.open();const before=P.canonicalJson(noteHistory.export());
    await click('query');await until(()=>document.querySelector('[name=wiki-query-question]'),'query_question');
    const input=document.querySelector('[name=wiki-query-question]');input.value='Synthetic';input.dispatchEvent(new Event('input',{bubbles:true}));
    await click('query-plan');await until(()=>button('query-run'),'query_preview');check(calls===0,'query_preview_model');
    check(document.querySelector('[data-wiki-query-relations]')?.textContent.includes('추론'),'query_relation_confidence');
    check(document.querySelector('[data-wiki-query-preview]')?.textContent.includes('bytes'),'query_preview_bytes');
    let topic=document.querySelector('#wikiDialog select[aria-label="주제"]');topic.value=topic.options[1].value;topic.dispatchEvent(new Event('change',{bubbles:true}));
    check(!document.querySelector('[data-wiki-query-preview]')&&!button('query-run'),'query_topic_stale_sources');
    topic=document.querySelector('#wikiDialog select[aria-label="주제"]');topic.value='';topic.dispatchEvent(new Event('change',{bubbles:true}));
    await click('query-plan');await until(()=>button('query-run'),'query_replanned_topic');
    await click('query-run');await until(()=>button('confirm-send'),'query_confirm');await click('cancel-send');
    await until(()=>button('query-run')&&!button('query-run').disabled,'query_cancel');check(calls===0,'query_cancel_model');
    await click('query-run');await until(()=>button('confirm-send'),'query_confirm_again');await click('confirm-send');
    await until(()=>document.querySelector('[data-wiki-query-answer]'),'query_answer');
    check(calls===1&&requestBody.max_tokens===4096&&requestBody.model==='Combo/auto'&&requestBody.reasoning_effort==='high','query_registered_request');
    check(document.querySelector('[data-wiki-query-answer]').textContent.includes('Synthetic compiled finding'),'query_claim');
    check(document.querySelector('[data-wiki-query-answer] a')?.getAttribute('href')==='#wiki-query-citation-c1','query_claim_citation_link');
    if(globalThis.WIKI_QUERY_QA_CAPTURE)await new Promise(resolve=>{globalThis.WIKI_QUERY_QA_FRAME={release:resolve};});
    check(P.canonicalJson(noteHistory.export())===before,'query_no_journal_writes');
    await click('query-original-source');await until(()=>document.querySelector('[data-wiki-query-original]'),'query_original_revision');
    check(document.querySelector('[data-wiki-query-original] pre').textContent.length>0,'query_original_text');
    check(!globalThis.WIKI_SOURCE_EXECUTED&&P.canonicalJson(noteHistory.export())===before,'query_original_safe_readonly');
    await click('query-wiki-source');await until(()=>document.querySelector('[data-wiki-section=s1]'),'query_wiki_section');
    check(P.canonicalJson(noteHistory.export())===before,'query_source_navigation_no_writes');
    wikiUI.close();await wikiUI.open();check(!document.querySelector('[data-wiki-query-answer]'),'query_not_restored');
    let explicitSaved=0,coldDrafts=0;
    if(phase===1){
      await click('query');await until(()=>document.querySelector('[name=wiki-query-question]'),'query_save_input');
      const input=document.querySelector('[name=wiki-query-question]');input.value='Synthetic';input.dispatchEvent(new Event('input',{bubbles:true}));
      await click('query-plan');await until(()=>button('query-run'),'query_save_plan');await click('query-run');await until(()=>button('confirm-send'),'query_save_send');await click('confirm-send');
      await until(()=>button('query-save'),'query_save_button');const count=(await wikiNotebook.list()).length;
      await click('query-save');await until(()=>button('confirm-change'),'query_save_explicit_consent');await click('confirm-change');await until(()=>button('commit-ingest'),'query_derived_preview');
      check((await wikiNotebook.list()).length===count,'query_preview_not_published');
      await click('commit-ingest');await until(()=>document.querySelector('#wikiDialog [role=status]')?.textContent.includes('초안 1개 저장'),'query_derived_commit');
      const saved=(await wikiNotebook.list()).find(r=>r.document?.drafts.at(-1).title==='Synthetic answer');
      check(saved&&!saved.document.approvals.length&&saved.document.drafts[0].evidence_manifest.length===2,'query_derived_all_inputs');explicitSaved=1;
    }else{
      const saved=(await wikiNotebook.list()).filter(r=>r.document?.drafts.at(-1).title==='Synthetic answer');
      check(saved.length===1&&!saved[0].document.approvals.length&&saved[0].document.drafts[0].evidence_manifest.length===2,'query_derived_cold');coldDrafts=1;
    }
    wikiUI.close();document.querySelector('#wikiDialog').remove();
    let unlocked=true,protectedChecks=0;
    const access={origin:'local',guard:()=>{if(!unlocked)throw Error('synthetic_locked');},revalidate:async()=>{protectedChecks++;if(!unlocked)throw Error('synthetic_locked');}};
    const rows=await wikiNotebook.list(),value=rows.find(row=>row.document?.approvals.length)?.document;
    const protectedQuery=createWikiQueryNotebook({book:wikiNotebook,context:noteHistoryContext,contextKey:wikiViewKey});
    const ui=mountNowWiki({...wikiNotebook,query:protectedQuery,ingest:wikiIngest,contextKey:wikiViewKey,connection:wikiConnection,notes:()=>[]});
    ui.openProtected(value,access);await click('query');await until(()=>document.querySelector('[name=wiki-query-question]'),'protected_query_input');
    const protectedInput=document.querySelector('[name=wiki-query-question]');protectedInput.value='Synthetic';protectedInput.dispatchEvent(new Event('input',{bubbles:true}));
    const protectedBefore=P.canonicalJson(noteHistory.export());await click('query-plan');await until(()=>button('query-run'),'protected_query_plan');
    await click('query-run');await until(()=>button('confirm-send'),'protected_query_consent');await click('confirm-send');await until(()=>document.querySelector('[data-wiki-query-answer]'),'protected_query_answer');
    check(button('query-save')?.disabled,'protected_query_plaintext_save');check(protectedChecks>=3,'protected_query_fresh_access');
    check(P.canonicalJson(noteHistory.export())===protectedBefore,'protected_query_plaintext_persistence');
    unlocked=false;ui.check();check(!document.querySelector('#wikiDialog').open&&!document.querySelector('[data-wiki-query-answer]'),'protected_query_relock_conceals');ui.close();
    return {syntheticCalls:calls,originalCalls:0,defaultWrites:0,explicitSaved,coldDrafts,registeredModel:true,exactWikiSection:true,fixedOriginal:true,protectedMemoryOnly:true,protectedUiAccess:'synthetic unlocked document; crypto/HTTP not exercised'};
  }finally{wikiUI.close();globalThis.fetch=realFetch;state.settings.llm=original;}
};
