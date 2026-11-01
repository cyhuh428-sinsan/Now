/* Actual renderer/file input/storage; external HTTP is blocked and remote/model fixtures are synthetic. */
const {app,BrowserWindow,ipcMain,session}=require('electron');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),own=path.resolve(process.argv[2]),mode=process.argv[3],phase=Number(process.argv[4]);
if(!own.startsWith(path.resolve('D:/tmp/now-240-wiki-sources')+path.sep)||!['web','desktop'].includes(mode)||![1,2].includes(phase))throw Error('qa_boundary');
app.setPath('userData',path.join(own,mode));app.disableHardwareAcceleration();
const {readStoreFile,updateStoreFile,compareAndSetStoreValue}=require(path.join(root,'desktop/store-file.cjs'));
const main=fs.readFileSync(path.join(root,'desktop/main.cjs'),'utf8'),start=main.indexOf('function updateRendererStoreValue('),end=main.indexOf('function registerVaultHandlers(',start);
const store=path.join(own,mode,'nownote-desktop-store.json'),keys=new Set(['nownote.web.v1','nownote.web.settings.v1','nownote.history.v1','nownote.library.v1']);
const box={compareAndSetStoreValue,updateStoreFile,desktopStorePath:()=>store,assertRendererStoreKey:k=>{if(!keys.has(k))throw Error('store_key');}};
vm.runInNewContext(main.slice(start,end)+'\nglobalThis.write=updateRendererStoreValue;',box);
ipcMain.handle('nownote:desktop-store-read',(_e,k)=>{if(!keys.has(k))throw Error('store_key');return readStoreFile(store).store.values[k]??null;});
const write=(k,v,o)=>{const r=box.write(k,v,o);return {ok:true,updatedAt:r.store.updatedAt};};
ipcMain.handle('nownote:desktop-store-write',(_e,k,v,o)=>write(k,v,o));
ipcMain.on('nownote:desktop-store-write-sync',(e,k,v,o)=>{try{e.returnValue=write(k,v,o);}catch{e.returnValue={ok:false,error:'qa_CAS'};}});
ipcMain.handle('nownote:desktop-store-info',()=>({version:1,keys:[...keys]}));
ipcMain.handle('nownote:vault-status',()=>({connected:false}));ipcMain.handle('nownote:vault-recovery-status',()=>({pending:false}));
let window,result={ok:false},network=0;
app.whenReady().then(async()=>{
  try{
    session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_d,done)=>{network++;done({cancel:true});});
    window=new BrowserWindow({show:false,width:1200,height:900,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,
      ...(mode==='desktop'?{preload:path.join(root,'desktop/preload.cjs')}:{})}});
    await window.loadFile(path.join(root,mode==='desktop'?'desktop/app/index.html':'web/index.html'));
    const run=code=>window.webContents.executeJavaScript(code),wait=async(code,label)=>{
      for(let i=0;i<300;i++){if(await run(code))return;await new Promise(r=>setTimeout(r,25));}throw Error(label);
    };
    await wait('Boolean(wikiSources&&wikiUI&&noteHistory&&!noteHistory.suspended())','startup_timeout');
    await run('wikiUI.open()');await wait('Boolean(document.querySelector("#wikiDialog [data-wiki-action=sources]"))','sources_button');
    await run('document.querySelector("#wikiDialog [data-wiki-action=sources]").click()');
    await wait('Boolean(document.querySelector("#wikiDialog [name=wiki-files]"))','file_input');
    const assert=(v,code)=>{if(!v)throw Error(code);};
    const choose=async names=>{
      if(!window.webContents.debugger.isAttached())window.webContents.debugger.attach('1.3');
      const {root:doc}=await window.webContents.debugger.sendCommand('DOM.getDocument');
      const {nodeId}=await window.webContents.debugger.sendCommand('DOM.querySelector',{nodeId:doc.nodeId,selector:'#wikiDialog [name=wiki-files]'});
      await window.webContents.debugger.sendCommand('DOM.setFileInputFiles',{nodeId,files:names.map(n=>path.join(own,n))});
      await wait('!document.querySelector("#wikiDialog [data-wiki-action=capture-files]").disabled','capture_ready');
      await run('document.querySelector("#wikiDialog [data-wiki-action=capture-files]").click()');
    };
    if(phase===1){
      await choose(['source.md','other.txt']);
      await wait('document.querySelector("#wikiDialog [role=status]").textContent.includes("원본 2개 저장")','capture_status');
      assert(await run('(async()=>{const rows=await wikiSources.list();return rows.length===2&&rows.every(s=>noteHistory.view(s.manifest.note_ref.local_id).localOnly);})()'),'durable_sources');
    }else{
      assert(await run('(async()=>{const rows=await wikiSources.list();return rows.length===2&&rows.every(s=>noteHistory.view(s.manifest.note_ref.local_id).revisions.length===1);})()'),'cold_sources');
      await choose(['source.md','other.txt']);await wait('document.querySelector("#wikiDialog [role=status]").textContent.includes("변경 없음 2개")','duplicate_status');
      await choose(['unsupported.pdf']);await wait('document.querySelector("#wikiDialog [role=status]").textContent.includes("지원하지 않는 파일")','unsupported_status');
      assert(await run('(async()=>(await wikiSources.list()).length===2)()'),'unsupported_partial_write');
    }
    await run('document.querySelector("#wikiDialog [data-wiki-source-id]").click()');
    assert(await run('document.querySelector("#wikiDialog .wiki-source-preview").textContent.includes("<script>")&&!globalThis.WIKI_SOURCE_EXECUTED'),'exact_text_not_executed');
    assert(await run('!flattenTree(state.data.tree).some(n=>String(n.id).startsWith("wiki-source:"))'),'source_tree_projection');
    const before=await run('(async()=>{await noteHistory.idle();await Promise.all([...storagePendingWrites]);return Object.keys(noteHistory.entries()).filter(k=>k.startsWith("wiki-source:")).sort();})()');
    if(process.env.NOWNOTE_WIKI_INTEGRATE_NARROW==='1')window.setContentSize(390,844);
    const ingest=await run(`(async()=>{
      if(typeof wikiIngest==='undefined'||!wikiIngest)throw Error('ingest_actual_adapter_missing');
      const pause=()=>new Promise(r=>setTimeout(r,0)),until=async(fn,code)=>{for(let i=0;i<300;i++){if(fn())return;await pause();}throw Error(code);};
      const click=async action=>{const b=document.querySelector('#wikiDialog [data-wiki-action="'+action+'"]');if(!b||b.disabled)throw Error('ingest_button_'+action);b.click();await pause();};
      if(${phase}===2){
        const allRows=await wikiNotebook.list(),rows=allRows.filter(r=>!['Synthetic answer','위키 점검 보고서'].includes(r.document?.drafts.at(-1).title)),ops=await wikiIngest.operations();
        const derived=allRows.filter(r=>r.document?.drafts.at(-1).title==='Synthetic answer');
        if(${process.env.NOWNOTE_WIKI_QUERY==='1'}&&(derived.length!==1||derived[0].document.approvals.length))throw Error('query_cold_derived_document');
        const reports=allRows.filter(r=>r.document?.drafts.at(-1).title==='위키 점검 보고서');
        if(${process.env.NOWNOTE_WIKI_LINT==='1'}&&(reports.length!==1||reports[0].document.approvals.length||reports[0].document.drafts[0].evidence_manifest.length!==2))throw Error('lint_cold_report_document');
        if(rows.length!==2||rows.some(r=>r.document?.schema_version!==2)||rows.filter(r=>r.document.approvals.length===1).length!==1||rows.filter(r=>r.document.approvals.length===2).length!==1)throw Error('ingest_cold_documents');
        if(ops.filter(o=>o.action==='ingest'&&o.state==='committed'&&o.inputs.some(r=>r.kind==='note')).length!==1)throw Error('ingest_cold_receipt');
        if(${process.env.NOWNOTE_WIKI_QUERY==='1'||process.env.NOWNOTE_WIKI_LINT==='1'}&&ops.filter(o=>o.action==='ingest'&&o.state==='committed'&&o.inputs.every(r=>r.kind==='wiki')).length!==${Number(process.env.NOWNOTE_WIKI_QUERY==='1')+Number(process.env.NOWNOTE_WIKI_LINT==='1')})throw Error('cold_derived_receipts');
        if(ops.filter(o=>o.action==='integrate'&&o.state==='committed').length!==1||(await wikiNotebook.approvedCatalog()).edges.length!==1)throw Error('integrate_cold_relation');
        return {coldDocuments:rows.length,calls:0};
      }
      const original=state.settings.llm,realFetch=globalThis.fetch;let calls=0;
      state.settings.llm={...original,provider:'omniroute',omniUrl:'https://registered.invalid',omniModel:'Combo/auto',omniReasoning:'high',omniApiKey:'synthetic-only'};
      globalThis.fetch=async(url,options)=>{
        if(url!=='https://registered.invalid/v1/chat/completions')return realFetch(url,options);
        calls++;const body=JSON.parse(options.body),request=JSON.parse(body.messages.at(-1).content),input=request.input;
        if(body.max_tokens!==4096)throw Error('ingest_output_limit');
        return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({pages:input.pages.map((p,i)=>({wiki_id:p.wiki_id,draft_id:p.draft_id,
          title:input.sources[i].title,topic:input.sources[i].title,page_type:'concept',summary:'Synthetic ingest summary',aliases:[],claims:[],relations:[],
          sections:[{id:'s1',title:'Evidence',markdown:'Synthetic ingest finding',citation_ids:['c1']}],
          citations:[{id:'c1',evidence_id:input.sources[i].id,section_id:null,quote:input.sources[i].content.slice(0,20)}]}))})}}]})};
      };
      try{
        for(const input of document.querySelectorAll('#wikiDialog [name=wiki-ingest-file]'))input.click();
        await click('plan-ingest');await until(()=>Boolean(document.querySelector('#wikiDialog [data-wiki-action=generate-ingest]')),'ingest_plan');
        if(calls)throw Error('ingest_plan_called_provider');
        await click('generate-ingest');await until(()=>Boolean(document.querySelector('#wikiDialog [data-wiki-action=confirm-send]')),'ingest_consent');
        if(calls)throw Error('ingest_consent_called_provider');await click('confirm-send');
        await until(()=>Boolean(document.querySelector('#wikiDialog [data-wiki-action=commit-ingest]')),'ingest_proposal');
        if(calls!==1||(await wikiNotebook.list()).length)throw Error('ingest_implicit_commit');
        if(document.querySelectorAll('#wikiDialog [data-wiki-proposal]').length!==2)throw Error('ingest_missing_page_diff');
        await click('commit-ingest');await until(()=>document.querySelector('#wikiDialog [role=status]').textContent.includes('초안 2개 저장'),'ingest_commit');
        const rows=await wikiNotebook.list();if(rows.length!==2||rows.some(r=>r.document.approvals.length))throw Error('ingest_implicit_approval');
        await click('sources');await until(()=>Boolean(document.querySelector('#wikiDialog .wiki-entry button')),'ingest_browse');
        document.querySelector('#wikiDialog .wiki-entry button').click();await until(()=>Boolean(document.querySelector('#wikiDialog [data-wiki-action=approve]')),'ingest_v2_read');
        await click('approve');await until(()=>document.querySelector('#wikiDialog [role=status]').textContent.includes('승인 저장 완료'),'ingest_approve');
        if((await wikiNotebook.list()).filter(r=>r.document.approvals.length===1).length!==1||calls!==1)throw Error('ingest_approval_receipt');
        document.querySelectorAll('#wikiDialog .wiki-entry button.library-item')[1].click();
        await until(()=>Boolean(document.querySelector('#wikiDialog [data-wiki-action=approve]'))&&!document.querySelector('#wikiDialog [data-wiki-action=approve]').disabled,'second_draft');
        await click('approve');await until(()=>document.querySelector('#wikiDialog [role=status]').textContent.includes('승인 저장 완료'),'second_approve');
        await click('integrate');await until(()=>Boolean(document.querySelector('#wikiDialog [name=wiki-relation-target]')),'integrate_form');
        const form=document.querySelector('#wikiDialog [data-wiki-integration]');
        if(!form||!form.querySelector('[name=wiki-relation-type]')||!form.querySelector('[name=wiki-relation-confidence]'))throw Error('integrate_controls');
        if(form.scrollWidth>form.clientWidth+1||document.querySelector('#wikiDialog').getBoundingClientRect().right>innerWidth)throw Error('integrate_form_overflow');
        await click('preview-integrate');await until(()=>Boolean(document.querySelector('#wikiDialog [data-wiki-action=commit-ingest]')),'integrate_preview');
        if(!document.querySelector('#wikiDialog [aria-label="관계 변경"]')||calls!==1)throw Error('integrate_no_relation_diff');
        if((await wikiNotebook.approvedCatalog()).edges.length)throw Error('integrate_implicit_preview');
        await click('commit-ingest');await until(()=>document.querySelector('#wikiDialog [role=status]').textContent.includes('초안 1개 저장'),'integrate_save');
        if((await wikiNotebook.approvedCatalog()).edges.length)throw Error('integrate_implicit_approval');
        await click('sources');document.querySelectorAll('#wikiDialog .wiki-entry button.library-item')[1].click();
        await until(()=>Boolean(document.querySelector('#wikiDialog [name=wiki-version]')),'integrate_open');
        const versions=document.querySelector('#wikiDialog [name=wiki-version]');versions.value=versions.options[versions.options.length-1].value;versions.dispatchEvent(new Event('change'));
        await until(()=>Boolean(document.querySelector('#wikiDialog [data-wiki-action=approve]'))&&!document.querySelector('#wikiDialog [data-wiki-action=approve]').disabled,'integrate_review');
        if(!document.querySelector('#wikiDialog [aria-label="위키 관계"]')?.textContent.includes('관련'))throw Error('integrate_saved_relation_hidden');
        await click('approve');await until(()=>document.querySelector('#wikiDialog [role=status]').textContent.includes('승인 저장 완료'),'integrate_approve');
        if((await wikiNotebook.approvedCatalog()).edges.length!==1||calls!==1)throw Error('integrate_explicit_graph');
        await click('sources');return {drafts:2,explicitApprovals:3,manualIntegrations:1,syntheticCalls:calls,outputTokens:4096};
      }finally{globalThis.fetch=realFetch;state.settings.llm=original;}
    })()`);
    const screenshotRoot='D:/Project/Now/docs/2.4.0/qa';
    for(const [size,width,height] of [['desktop',1200,900],['mobile',390,844]]){
      window.setContentSize(width,height);await run('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      assert(await run('(()=>{const d=document.querySelector("#wikiDialog");return d.scrollWidth<=d.clientWidth+1&&d.getBoundingClientRect().right<=innerWidth;})()'),'source_layout_'+size);
      fs.writeFileSync(path.join(screenshotRoot,'wiki-sources-'+mode+'-'+size+'.png'),(await window.webContents.capturePage()).toPNG());
    }
    assert(await run('(async()=>{const previous=state.settings.server.ownerId;state.settings.server.ownerId="qa-source-b";wikiUI.check();const hidden=!document.querySelector("#wikiDialog").open;const empty=(await wikiSources.list()).length===0;state.settings.server.ownerId=previous;return hidden&&empty;})()'),'account_b_leak');
    let lint=null;
    if(process.env.NOWNOTE_WIKI_LINT==='1'){
      await run(fs.readFileSync(path.join(root,'web/scripts/wiki_lint_ui_fixture.js'),'utf8')+'\nvoid 0;');
      lint=await run('runWikiLintUiFixture('+phase+').catch(error=>({qaError:String(error.message||error)}))');
      if(lint.qaError)throw Error(lint.qaError);
    }
    let query=null;
    if(process.env.NOWNOTE_WIKI_QUERY==='1'){
      await run(fs.readFileSync(path.join(root,'web/scripts/wiki_query_ui_fixture.js'),'utf8')+'\nvoid 0;');
      await run('globalThis.WIKI_QUERY_QA_CAPTURE=true;void 0;');
      const pending=run('runWikiQueryUiFixture('+phase+').catch(error=>{globalThis.WIKI_QUERY_QA_ERROR=String(error.message||error);return {qaError:globalThis.WIKI_QUERY_QA_ERROR};})');
      await wait('Boolean(globalThis.WIKI_QUERY_QA_FRAME||globalThis.WIKI_QUERY_QA_ERROR)','query_visual_frame');
      const early=await run('globalThis.WIKI_QUERY_QA_ERROR||null');if(early)throw Error(early);
      const frames=[];
      for(const [size,width,height]of [['desktop',1200,900],['mobile',390,844]]){
        window.setContentSize(width,height);await run('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
        const fits=await run('(()=>{const d=document.querySelector("#wikiDialog"),a=d.querySelector("[data-wiki-query-answer]");return Boolean(a)&&d.scrollWidth<=d.clientWidth+1&&d.getBoundingClientRect().right<=innerWidth&&a.scrollWidth<=a.clientWidth+1;})()');
        assert(fits,'query_layout_'+size);frames.push({size,width,fits});
        fs.writeFileSync(path.join(screenshotRoot,'wiki-query-'+mode+'-'+phase+'-'+size+'.png'),(await window.webContents.capturePage()).toPNG());
      }
      await run('globalThis.WIKI_QUERY_QA_FRAME.release();delete globalThis.WIKI_QUERY_QA_FRAME;void 0;');
      query=await pending;query.frames=frames;
      if(query.qaError)throw Error(query.qaError);
    }
    await run('wikiUI.close();document.querySelector("#wikiDialog").remove()');
    await run(fs.readFileSync(path.join(root,'web/scripts/wiki_ingest_ui_fixture.js'),'utf8')+'\n;undefined;');
    const backendPath=path.join(own,mode+'-wiki-remote-fixture.json'),backend=phase===2?JSON.parse(fs.readFileSync(backendPath,'utf8')):null;
    const remoteFixture=await run(`runWikiIngestUiFixture({initial:noteHistory.export(),write:value=>noteHistory.replaceProtectionStore(noteHistory.export(),value,{active:()=>true}),backend:${JSON.stringify(backend)},phase:${phase}}).catch(error=>{throw Error(error.message+' | '+error.stack);})`);
    fs.writeFileSync(backendPath,JSON.stringify(remoteFixture.backend));
    for(const [size,width,height] of [['desktop',1200,900],['mobile',390,844]]){
      window.setContentSize(width,height);await run('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      assert(await run('(()=>{const d=document.querySelector("#wikiDialog");return d.scrollWidth<=d.clientWidth+1&&d.getBoundingClientRect().right<=innerWidth;})()'),'remote_layout_'+size);
      fs.writeFileSync(path.join(screenshotRoot,'wiki-remote-'+mode+'-'+size+'.png'),(await window.webContents.capturePage()).toPNG());
    }
    const relationVisibility=await run(`(async()=>{
      wikiUI.close();document.querySelector('#wikiDialog').remove();
      const stored=await wikiNotebook.list();let blocked='';
      const ui=mountNowWiki({contextKey:()=> 'relation-visibility',notes:()=>[],list:async()=>stored,canRead:d=>d.wiki_id!==blocked,
        sourceStatus:async()=>({available:true,stale:false}),approvedCatalog:async()=>{const value=await wikiNotebook.approvedCatalog();return {...value,nodes:value.nodes.map(n=>({...n,stale:true}))};},
        ingest:{operations:async()=>[],integrate:async()=>{throw Error('not selected');}}});
      const pause=()=>new Promise(r=>setTimeout(r,0)),until=async(fn)=>{for(let n=0;n<300;n++){if(fn())return;await pause();}throw Error('relation_visibility_ready');};
      await ui.open();document.querySelector('#wikiDialog .wiki-entry button.library-item').click();
      await until(()=>Boolean(document.querySelector('#wikiDialog [data-wiki-action=integrate]'))&&!document.querySelector('#wikiDialog [data-wiki-action=integrate]').disabled);
      document.querySelector('#wikiDialog [data-wiki-action=integrate]').click();await until(()=>Boolean(document.querySelector('#wikiDialog [name=wiki-relation-target]')));
      if(!document.querySelector('#wikiDialog [name=wiki-relation-target]').textContent.includes('원본 변경'))throw Error('stale_relation_target_unmarked');
      blocked=document.querySelector('#wikiDialog [name=wiki-relation-target]').value;ui.check();
      if(document.querySelector('#wikiDialog').open||document.querySelector('#wikiDialog').textContent)throw Error('locked_relation_target_label_residue');
      ui.close();return {targetLockConcealed:true};
    })()`);
    const citationNavigation=await run(`(async()=>{
      document.querySelector('#wikiDialog').remove();
      const rows=await wikiNotebook.list(),source=rows.find(r=>r.document.approvals.length===1),outer=rows.find(r=>r.document.approvals.length===2);
      if(!source||!outer)throw Error('wiki_citation_fixture');
      const documentValue=structuredClone(outer.document),draft=documentValue.drafts.at(-1),target=source.document.drafts.at(-1),approval=source.document.approvals.at(-1);
      const ref={id:'compiled-source',kind:'wiki',origin:'local',owner_id:source.document.scope.owner,wiki_id:source.document.wiki_id,draft_id:target.id,approval_id:approval.id,document_version:source.document.document_version,content_hash:target.draft_hash};
      draft.evidence_manifest=[ref];draft.citations=[{id:'c1',evidence_id:ref.id,section_id:target.sections[0].id,quote:target.sections[0].markdown}];
      delete draft.draft_hash;draft.draft_hash=await NowNoteProtectionProtocol.hashJson(draft);
      documentValue.approvals.at(-1).draft_hash=draft.draft_hash;documentValue.approvals.at(-1).evidence_manifest_hash=await NowNoteProtectionProtocol.hashJson(draft.evidence_manifest);
      await NowNoteWiki.validateDocument(documentValue,documentValue.scope);
      const before=NowNoteProtectionProtocol.canonicalJson(noteHistory.export());
      const ui=mountNowWiki({...wikiNotebook,contextKey:wikiViewKey,notes:()=>[],list:async()=>[{...outer,document:documentValue},source]});
      const pause=()=>new Promise(r=>setTimeout(r,0)),until=async(fn)=>{for(let n=0;n<300;n++){if(fn())return;await pause();}throw Error('wiki_citation_navigation');};
      await ui.open();document.querySelector('#wikiDialog .wiki-entry button.library-item').click();
      await until(()=>Boolean(document.querySelector('#wikiDialog [data-wiki-action=source]'))&&!document.querySelector('#wikiDialog [data-wiki-action=source]').disabled);
      document.querySelector('#wikiDialog [data-wiki-action=source]').click();await until(()=>document.querySelector('#wikiDialog [name=wiki-version]')?.value===target.id);
      if(document.querySelector('#wikiDialog .wiki-detail h3')?.textContent!==target.title||NowNoteProtectionProtocol.canonicalJson(noteHistory.export())!==before)throw Error('wiki_citation_target_or_write');
      ui.close();return {wikiCitationNavigation:true,journalUnchanged:true};
    })()`);
    const callbacks=await run(`(async()=>{
      wikiUI.close();document.querySelector('#wikiDialog').remove();
      let key='alice',captures=0;const ui=mountNowWiki({contextKey:()=>key,notes:()=>[],list:async()=>[],
        sources:{list:async()=>[],captureFiles:async()=>{captures++;return {created:0,unchanged:0};}}});
      const pause=()=>new Promise(r=>setTimeout(r,0)),ready=async()=>{for(let n=0;n<100;n++){const b=document.querySelector('#wikiDialog [data-wiki-action=sources]');if(b&&!b.disabled)return;await pause();}throw Error('callback_ready');};
      const open=async()=>{await ui.open();await ready();document.querySelector('#wikiDialog [data-wiki-action=sources]').click();for(let n=0;n<100&&!document.querySelector('#wikiDialog [name=wiki-files]');n++)await pause();};
      const select=input=>{Object.defineProperty(input,'files',{configurable:true,value:[new File(['synthetic only'],'PRIVATE_ALICE_FILE.md')]});input.onchange();};
      let cases=0;
      for(const scenario of ['account','aba','reopen','server','lock','rerender']){
        key='alice';await open();const old=document.querySelector('#wikiDialog [name=wiki-files]');
        if(scenario==='rerender'){document.querySelector('#wikiDialog [data-wiki-action=sources]').click();await ready();document.querySelector('#wikiDialog [data-wiki-action=sources]').click();await pause();}
        else{if(scenario!=='reopen'){key=scenario==='server'?'alice-other-server':scenario==='lock'?'alice-lock2':'bob';ui.check();}else ui.close();
          if(scenario==='aba')key='alice';await open();}
        select(old);const save=document.querySelector('#wikiDialog [data-wiki-action=capture-files]');
        if(!save.disabled||document.querySelector('#wikiDialog').textContent.includes('PRIVATE_ALICE_FILE.md'))throw Error('late_file_selection_'+scenario);
        save.click();await pause();if(captures)throw Error('late_file_capture_'+scenario);cases++;ui.close();
      }
      key='alice';await open();select(document.querySelector('#wikiDialog [name=wiki-files]'));
      if(document.querySelector('#wikiDialog [data-wiki-action=capture-files]').disabled)throw Error('fresh_file_selection_blocked');
      document.querySelector('#wikiDialog [data-wiki-action=capture-files]').click();await pause();
      if(captures!==1)throw Error('fresh_file_capture_count');ui.close();return {staleCases:cases,freshCaptures:captures};
    })()`);
    const budget=await run(`(async()=>{
      document.querySelector('#wikiDialog').remove();const original=state.settings.llm,realFetch=globalThis.fetch;
      state.settings.llm={...original,provider:'omniroute',omniUrl:'https://registered.invalid',omniModel:'Combo/auto',omniReasoning:'high',omniApiKey:'synthetic-only'};
      let calls=0,body=null;
      const ctx=noteHistoryContext(),note={owner:ctx.owner,localId:'budget-source',status:'ok',origin:'local',revisionId:null,headVersion:0,title:'Budget source',content:'Exact synthetic budget evidence.'};
      globalThis.fetch=async(url,options)=>{
        if(url!=='https://registered.invalid/v1/chat/completions')return realFetch(url,options);
        calls++;body=JSON.parse(options.body);
        return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({title:'Budget guide',topic:'Budget',sections:[{id:'s1',title:'Evidence',markdown:'Synthetic finding.',citation_ids:['c1']}],citations:[{id:'c1',source_id:'source-1',quote:'Exact synthetic budget evidence.'}]})}}]})};
      };
      const pause=()=>new Promise(r=>setTimeout(r,0)),until=async(fn,code)=>{for(let i=0;i<200;i++){if(fn())return;await pause();}throw Error(code);};
      const api={contextKey:wikiViewKey,notes:()=>[{id:note.localId,title:note.title}],list:async()=>[],connection:wikiConnection,
        capture:ids=>NowNoteWiki.capture(ids,{url:ctx.url,owner:ctx.owner},()=>note),sourceStatus:d=>NowNoteWiki.sourceStatus(d,{url:ctx.url,owner:ctx.owner},()=>note)};
      const ui=mountNowWiki(api);
      const start=async()=>{await ui.open();document.querySelector('#wikiDialog [name=wiki-source]').click();document.querySelector('#wikiDialog [data-wiki-action=generate]').click();
        await until(()=>document.querySelector('#wikiDialog [data-wiki-action=confirm-send]'),'budget_confirmation');};
      try{
        await start();if(calls||!document.querySelector('#wikiDialog').textContent.includes('4096 tokens')||!document.querySelector('#wikiDialog').textContent.includes('요청 1회'))throw Error('budget_consent_missing');
        document.querySelector('#wikiDialog [data-wiki-action=cancel-send]').click();await until(()=>!document.querySelector('#wikiDialog [data-wiki-action=generate]').disabled,'budget_cancel');
        if(calls)throw Error('budget_cancel_called_provider');
        await start();note.content+=' changed';document.querySelector('#wikiDialog [data-wiki-action=confirm-send]').click();
        await until(()=>document.querySelector('#wikiDialog [role=status]').textContent.includes('원본 판본'),'budget_source_stale');if(calls)throw Error('budget_stale_called_provider');note.content='Exact synthetic budget evidence.';
        await start();document.querySelector('#wikiDialog [data-wiki-action=confirm-send]').click();
        await until(()=>document.querySelector('#wikiDialog .wiki-detail h3')?.textContent==='Budget guide','budget_generate');
        if(calls!==1||body.max_tokens!==4096||body.model!=='Combo/auto'||body.reasoning_effort!=='high')throw Error('budget_actual_request');
        ui.close();note.content='x'.repeat(524288);await ui.open();document.querySelector('#wikiDialog [name=wiki-source]').click();document.querySelector('#wikiDialog [data-wiki-action=generate]').click();
        await until(()=>document.querySelector('#wikiDialog [role=status]').textContent.includes('512KiB'),'budget_prompt_limit');
        if(calls!==1||document.querySelector('#wikiDialog [data-wiki-action=confirm-send]'))throw Error('budget_prompt_limit_sent');
        return {syntheticCalls:calls,outputTokens:body.max_tokens,cancelCalls:0,staleCalls:0,overLimitCalls:0};
      }finally{ui.close();globalThis.fetch=realFetch;state.settings.llm=original;}
    })()`);
    await run('noteHistory.idle()');result={ok:true,sources:2,ids:before,phase,callbacks,budget,ingest,query,lint,relationVisibility,citationNavigation,remote:remoteFixture.report,blockedNetworkAttempts:network,realProviderCalls:0};
  }catch(error){
    const status=window&&!window.isDestroyed()?await window.webContents.executeJavaScript('document.querySelector("#wikiDialog [role=status]")?.textContent||""').catch(()=>''):'';
    result={ok:false,error:error.message,status};
  }
  finally{fs.writeFileSync(path.join(own,mode+'-'+phase+'.json'),JSON.stringify(result));window?.destroy();app.exit(result.ok?0:1);}
});
