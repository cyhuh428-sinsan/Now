/* Actual renderer/file input/storage; external HTTP is blocked and remote/model fixtures are synthetic. */
const {app,BrowserWindow,ipcMain,session}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),own=path.resolve(process.argv[2]),mode=process.argv[3],phase=Number(process.argv[4]);
if(!own.startsWith(path.resolve('D:/tmp/now-240-wiki-sources')+path.sep)||!['web','desktop'].includes(mode)||![1,2].includes(phase))throw Error('qa_boundary');
app.setPath('userData',path.join(own,mode));app.disableHardwareAcceleration();
const documentFile=require(path.join(root,'desktop/document-file.cjs'));
const store=path.join(own,mode,'nownote-desktop-store.json'),keys=new Set(['nownote.web.v1','nownote.web.settings.v1','nownote.history.v1','nownote.library.v1']);
const snapshots=new Map();
const historyCounts={full:0,note:0};
const historySession=require(path.join(root,'desktop/history-session.cjs')).createHistorySession(()=>store);
for(const method of ['open','full','note'])ipcMain.handle('nownote:history-'+method,(event,payload)=>{
  if(method!=='open')historyCounts[method]++;
  try{return {ok:true,...historySession[method](event.sender,payload)};}catch(error){return {ok:false,message:error.message,committed:error.committed===true};}
});
ipcMain.handle('nownote:desktop-store-read',(_e,k)=>{if(!keys.has(k))throw Error('store_key');const value=documentFile.readKey(store,k);snapshots.set(k,structuredClone(value));return value;});
const write=(k,v,o)=>{
  if(!keys.has(k))throw Error('store_key');
  const expected=o&&Object.hasOwn(o,'expectedValue')?o.expectedValue:snapshots.get(k);
  if(expected===undefined)throw Error('qa_missing_read');
  const r=documentFile.writeKey(store,k,v,expected);snapshots.set(k,structuredClone(v));return {ok:true,updatedAt:r.updatedAt};
};
ipcMain.handle('nownote:desktop-store-write',(_e,k,v,o)=>write(k,v,o));
ipcMain.on('nownote:desktop-store-write-sync',(e,k,v,o)=>{try{e.returnValue=write(k,v,o);}catch{e.returnValue={ok:false,error:'qa_CAS'};}});
ipcMain.handle('nownote:desktop-store-info',()=>({version:2,keys:[...keys],historySessions:true}));
ipcMain.handle('nownote:desktop-original-read',(_event,key)=>{if(!keys.has(key))throw Error('store_key');return documentFile.readOriginal(store,key);});
ipcMain.handle('nownote:desktop-original-write',(_event,key,value,expected)=>{if(!keys.has(key))throw Error('store_key');return documentFile.casOriginal(store,key,value,expected);});
ipcMain.handle('nownote:vault-status',()=>({connected:false}));ipcMain.handle('nownote:vault-recovery-status',()=>({pending:false}));
let window,result={ok:false},network=0;
app.whenReady().then(async()=>{
  try{
    documentFile.initialize(store);
    session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_d,done)=>{network++;done({cancel:true});});
    window=new BrowserWindow({show:false,width:1200,height:900,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,
      ...(mode==='desktop'?{preload:path.join(root,'desktop/preload.cjs')}:{})}});
    await window.loadFile(path.join(root,mode==='desktop'?'desktop/app/index.html':'web/index.html'));
    const run=code=>window.webContents.executeJavaScript(code),wait=async(code,label)=>{
      for(let i=0;i<300;i++){if(await run(code))return;await new Promise(r=>setTimeout(r,25));}throw Error(label);
    };
    await wait('Boolean(wikiSources&&wikiUI&&noteHistory&&!noteHistory.suspended())','startup_timeout');
    await run(`(async()=>{
      await noteHistory.idle();await noteHistoryCaptureChain;await Promise.all([...storagePendingWrites]);
      const backend=await historyPersistence(),before=await backend.open(),ctx=noteHistoryContext(),account=NowNoteHistory.key(ctx);
      const note=id=>({owner_id:ctx.owner,local_id:id,note_type:'tree',source:'manual',content:'old',title:id,level:1});
      const entry=id=>({raw:note(id),draft:note(id),base:{crypto_epoch:0,inventory_revision_ids:[],head_revision_id:'qa-head'},revisions:[],outbox:[],receipts:[],localOnly:true});
      const value={schema_version:1,contexts:{[account]:{notes:{'qa-save-a':entry('qa-save-a'),'qa-save-b':entry('qa-save-b')}}}};
      value.contexts[account].notes['qa-save-b'].revisions=[{snapshot:{note:{content:'QA_UNRELATED_HISTORY'}}}];
      await backend.full({expected:before.value,next:value,revision:before.revision},{active:()=>true});
      noteHistory.suspend();await noteHistoryController.resume({projectView:false,renderView:false});
      globalThis.qaProductSave={backend,before,ctx,account,value,scoped:(await backend.open()).scoped};
      // Opening the backend rotates native tokens; explicitly resume the product binding.
      noteHistory.suspend();await noteHistoryController.resume({projectView:false,renderView:false});
    })()`);
    const beforeCounts={...historyCounts};
    const productSave=await run(`(async()=>{
      const q=qaProductSave,clone=globalThis.structuredClone,all=IDBObjectStore.prototype.getAll;
      if(q.scoped){
        globalThis.structuredClone=value=>{if(JSON.stringify(value).includes('QA_UNRELATED_HISTORY'))throw Error('product_full_history_clone');return clone(value);};
        IDBObjectStore.prototype.getAll=function(){throw Error('product_full_history_scan');};
      }
      try{
        await noteHistory.edit({...q.value.contexts[q.account].notes['qa-save-a'].draft,content:'PRODUCT_EDITED'});await noteHistory.seal('qa-save-a');await noteHistory.idle();
      }finally{globalThis.structuredClone=clone;IDBObjectStore.prototype.getAll=all;}
      const stored=(await q.backend.open()).value;
      if(stored.contexts[q.account].notes['qa-save-a'].draft.content!=='PRODUCT_EDITED'
        ||stored.contexts[q.account].notes['qa-save-b'].revisions[0].snapshot.note.content!=='QA_UNRELATED_HISTORY')throw Error('product_note_save_lost_history');
      return {scoped:q.scoped,saved:true,otherHistoryPreserved:true};
    })()`);
    if(mode==='desktop'&&productSave.scoped&&(historyCounts.note-beforeCounts.note!==2||historyCounts.full-beforeCounts.full!==0))throw Error('product_native_scoped_route');
    await run(`(async()=>{const q=qaProductSave,current=await q.backend.open();await q.backend.full({expected:current.value,next:q.before.value,revision:current.revision},{active:()=>true});
      noteHistory.suspend();await noteHistoryController.resume({projectView:false,renderView:false});delete globalThis.qaProductSave;})()`);
    const selectiveRead=await run(`(async()=>{
      const key='qa.document.path.'+${phase},value={schema_version:1,contexts:{A:{notes:{one:{draft:{content:'SELECTED_CURRENT'},revisions:[{body:'UNREAD_HISTORY'}]},two:{body:'OTHER_BODY'}}},B:{body:'FOREIGN_BODY'}}};
      const raw=JSON.stringify(value),legacyKey=key+'.legacy';localStorage.setItem(legacyKey,raw);
      const make=()=>NowBrowserHistoryStorage.create({indexedDB,localStorage,key,lock:fn=>navigator.locks.request(key,fn)}),store=make();
      const legacy=NowBrowserHistoryStorage.create({indexedDB,localStorage,key:legacyKey,lock:fn=>navigator.locks.request(legacyKey,fn)});
      let before=false;try{await legacy.readPath(['contexts','A']);}catch{before=true;}
      if(!before)throw Error('path_unmigrated_legacy_hidden');
      await store.read();await store.write(null,value);
      const all=IDBObjectStore.prototype.getAll;let projection;
      IDBObjectStore.prototype.getAll=function(){throw Error('path_full_scan');};
      try{projection=await make().readPath(['contexts','A','notes','one','draft']);}finally{IDBObjectStore.prototype.getAll=all;}
      if(projection.projection!=='path_v1'||!projection.found||projection.value.content!=='SELECTED_CURRENT'
        ||JSON.stringify(projection).includes('UNREAD_HISTORY')||JSON.stringify(projection).includes('FOREIGN_BODY'))throw Error('path_projection');
      let partial=false;try{await store.write(projection,{lost:true});}catch{partial=true;}
      if(!partial||await store.read()!==raw)throw Error('path_partial_overwrite');
      const a=make(),b=make(),one=(await a.readPath(['contexts','A','notes','one'])).value,two=(await b.readPath(['contexts','A','notes','two'])).value;
      IDBObjectStore.prototype.getAll=function(){throw Error('path_write_full_scan');};
      try{
        await a.writePath(['contexts','A','notes','one'],one,{...one,draft:{content:'SELECTED_EDIT'}});
        await b.writePath(['contexts','A','notes','two'],two,{body:'OTHER_EDIT'});
        let stale=false;try{await b.writePath(['contexts','A','notes','one'],one,{draft:{content:'STALE'}});}catch{stale=true;}
        if(!stale)throw Error('path_write_stale');
      }finally{IDBObjectStore.prototype.getAll=all;}
      const updated=JSON.parse(await store.read());
      if(updated.contexts.A.notes.one.draft.content!=='SELECTED_EDIT'||updated.contexts.A.notes.two.body!=='OTHER_EDIT'
        ||updated.contexts.A.notes.one.revisions[0].body!=='UNREAD_HISTORY'||updated.contexts.B.body!=='FOREIGN_BODY')throw Error('path_write_lost_sibling_history');
      localStorage.setItem(key,raw+' ');let divergent=false;
      try{await store.readPath(['contexts','A']);}catch{divergent=true;}finally{localStorage.removeItem(key);}
      if(!divergent)throw Error('path_legacy_divergence');
      return {selected:true,wholeScan:false,partialOverwrite:false,legacyMismatchBlocked:true,scopedWrite:true,staleWriteRejected:true,siblingsPreserved:true};
    })()`);
    if(process.env.NOWNOTE_LAZY_WIKI_QA==='1'){
      if(!await run(`typeof cytoscape==='undefined'&&typeof mountNowWiki==='undefined'&&!document.querySelector('#wikiDialog')&&!document.querySelector('script[src$="wiki-runtime.js"]')`))throw Error('wiki_runtime_eager_startup');
    }
    await run('wikiUI.open()');await wait('Boolean(document.querySelector("#wikiDialog [data-wiki-action=sources]"))','sources_button');
    if(process.env.NOWNOTE_WIKI_WORKSPACE==='1'){
      const check=(value,name)=>{if(!value)throw Error('workspace_'+name);};
      check(await run(`(()=>{const e=document.querySelector('#wikiDialog');return e.tagName==='SECTION'&&e.closest('#treeEditorPanel')&&!document.querySelector('dialog[open]');})()`),'embedded_not_modal');
      check(await run(`document.querySelector('#wikiActionGroup')?.parentElement===document.querySelector('#fileActionGroup')?.parentElement&&!document.querySelector('#exploreActionGroup #wikiBtn')`),'independent_menu');
      check(await run(`document.querySelectorAll('#wikiActionGroup [data-wiki-view]').length===6`),'six_entry_points');
      for(const view of ['sources','build','lint','browse','query','graph']){
        await run(`document.querySelector('#wikiActionGroup [data-wiki-view="${view}"]').click()`);
        await wait(`document.querySelector('#wikiDialog')?.dataset.wikiView===${JSON.stringify(view)}&&!document.querySelector('#wikiDialog [data-wiki-action=refresh]')?.disabled`,'workspace_route_'+view);
      }
      await run(`document.querySelector('#wikiActionGroup [data-wiki-view=query]').click()`);
      await wait(`Boolean(document.querySelector('#wikiDialog [name=wiki-query-question]'))`,'query_input');
      await run(`document.querySelector('#wikiDialog [name=wiki-query-question]').value='Preserved synthetic question';document.querySelector('#wikiDialog [name=wiki-query-question]').dispatchEvent(new Event('input'));document.querySelector('#wikiMemoTab').click()`);
      check(await run(`!document.querySelector('#treeEditorPanel').classList.contains('wiki-workspace-active')`),'memo_tab');
      await run(`document.querySelector('#wikiWorkspaceTab').click()`);
      check(await run(`document.querySelector('#wikiDialog [name=wiki-query-question]').value==='Preserved synthetic question'`),'tab_preserves_question');
      await run('wikiUI.close();wikiUI.open()');
      await wait('Boolean(document.querySelector("#wikiDialog [data-wiki-action=sources]"))','workspace_reopen');
    }
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
    let workspace=null;
    if(process.env.NOWNOTE_WIKI_WORKSPACE==='1'){
      workspace=await run(`(async()=>{
        const check=(value,name)=>{if(!value)throw Error('workspace_'+name);},pause=()=>new Promise(r=>setTimeout(r,5));
        const wait=async fn=>{for(let n=0;n<400;n++){if(fn())return;await pause();}throw Error('workspace_review_timeout');};
        const before=NowNoteProtectionProtocol.canonicalJson(noteHistory.export()),selection=state.selectedTreeId;
        const scroll=document.querySelector('#treeList').parentElement,scrollTop=scroll.scrollTop;
        await wikiUI.open('browse');
        document.querySelector('#wikiDialog .wiki-entry .library-item').click();
        await wait(()=>Boolean(document.querySelector('#wikiDialog [data-wiki-action=edit-wiki]'))&&!document.querySelector('#wikiDialog [data-wiki-action=edit-wiki]').disabled);
        check(!document.querySelector('#wikiDialog [data-wiki-action=approve]')&&!document.querySelector('#wikiDialog [data-wiki-action=generate]'),'browse_not_editor');
        check([...document.querySelectorAll('#wikiDialog [name=wiki-version] option')].every(o=>o.textContent.includes('승인본')),'browse_approved_versions');
        document.querySelector('#wikiDialog [data-wiki-action=edit-wiki]').click();
        await wait(()=>Boolean(document.querySelector('#wikiDialog [data-wiki-action=integrate]'))&&!document.querySelector('#wikiDialog [data-wiki-action=integrate]').disabled);
        document.querySelector('#wikiMemoTab').focus();document.querySelector('#wikiMemoTab').click();
        check(!document.querySelector('#treeEditorPanel').classList.contains('wiki-workspace-active'),'memo_visible');
        document.querySelector('#wikiMemoTab').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
        check(document.activeElement.id==='wikiWorkspaceTab'&&document.querySelector('#wikiWorkspaceTab').getAttribute('aria-selected')==='true','keyboard_tabs');
        check(state.selectedTreeId===selection&&scroll.scrollTop===scrollTop,'memo_selection_scroll');
        check(NowNoteProtectionProtocol.canonicalJson(noteHistory.export())===before,'navigation_does_not_write');
        await wikiUI.open('sources');
        check(document.querySelector('.wiki-operation-details')&&!document.querySelector('.wiki-operation-details').open,'recovery_collapsed');
        return {embedded:true,independentMenus:6,approvedRead:true,reviewRelation:true,tabsPreserveState:true,keyboardTabs:true,navigationWrites:0};
      })()`);
    }
    const screenshotRoot=process.env.NOWNOTE_QA_REPORT_DIR||'D:/Project/Now/docs/2.4.0/qa';
    for(const [size,width,height] of [['desktop',1200,900],['mobile',390,844]]){
      window.setContentSize(width,height);await run('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      assert(await run('(()=>{const d=document.querySelector("#wikiDialog");return d.scrollWidth<=d.clientWidth+1&&d.getBoundingClientRect().right<=innerWidth;})()'),'source_layout_'+size);
      if(process.env.NOWNOTE_WIKI_WORKSPACE==='1'){
        assert(await run(`(()=>{const panel=document.querySelector('#treeEditorPanel'),view=document.querySelector('#treeView');return panel.getBoundingClientRect().height>view.getBoundingClientRect().height*.65;})()`),'workspace_usable_height_'+size);
        if(size==='mobile')assert(await run(`getComputedStyle(document.querySelector('#treePanel')).display==='none'`),'workspace_mobile_tree_hidden');
      }
      fs.writeFileSync(path.join(screenshotRoot,'wiki-sources-'+mode+'-'+size+'.png'),(await window.webContents.capturePage()).toPNG());
    }
    assert(await run('(async()=>{const previous=state.settings.server.ownerId;state.settings.server.ownerId="qa-source-b";wikiUI.check();const hidden=!document.querySelector("#wikiDialog").open;const empty=(await wikiSources.list()).length===0;state.settings.server.ownerId=previous;return hidden&&empty;})()'),'account_b_leak');
    let lint=null;
    if(process.env.NOWNOTE_WIKI_LINT==='1'){
      await run(fs.readFileSync(path.join(root,'web/scripts/wiki_lint_ui_fixture.js'),'utf8')+'\nvoid 0;');
      await run('globalThis.WIKI_LINT_QA_CAPTURE=true;void 0;');
      const pending=run('runWikiLintUiFixture('+phase+').catch(error=>{globalThis.WIKI_LINT_QA_ERROR=String(error.message||error);return {qaError:globalThis.WIKI_LINT_QA_ERROR};})');
      await wait('Boolean(globalThis.WIKI_LINT_QA_FRAME||globalThis.WIKI_LINT_QA_ERROR)','lint_visual_frame');
      const early=await run('globalThis.WIKI_LINT_QA_ERROR||null');if(early)throw Error(early);
      const frames=[];
      for(const [size,width,height]of [['desktop',1200,900],['mobile',390,844]]){
        window.setContentSize(width,height);await run('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
        const fits=await run('(()=>{const d=document.querySelector("#wikiDialog"),r=d.querySelector("[data-wiki-lint-report]");return Boolean(r)&&d.scrollWidth<=d.clientWidth+1&&d.getBoundingClientRect().right<=innerWidth&&r.scrollWidth<=r.clientWidth+1&&[...r.querySelectorAll("button")].every(b=>b.getBoundingClientRect().left>=r.getBoundingClientRect().left-1&&b.getBoundingClientRect().right<=r.getBoundingClientRect().right+1);})()');
        assert(fits,'lint_layout_'+size);frames.push({size,width,fits});
        fs.writeFileSync(path.join(screenshotRoot,'wiki-lint-'+mode+'-'+phase+'-'+size+'.png'),(await window.webContents.capturePage()).toPNG());
      }
      await run('globalThis.WIKI_LINT_QA_FRAME.release();delete globalThis.WIKI_LINT_QA_FRAME;void 0;');lint=await pending;lint.frames=frames;
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
      const ui=mountNowWiki({...wikiNotebook,listIndex:undefined,contextKey:wikiViewKey,notes:()=>[],list:async()=>[{...outer,document:documentValue},source]});
      const pause=()=>new Promise(r=>setTimeout(r,0)),until=async(fn)=>{for(let n=0;n<300;n++){if(fn())return;await pause();}throw Error('wiki_citation_navigation');};
      await ui.open();document.querySelector('#wikiDialog .wiki-entry button.library-item').click();
      await until(()=>Boolean(document.querySelector('#wikiDialog [data-wiki-action=source]'))&&!document.querySelector('#wikiDialog [data-wiki-action=source]').disabled);
      document.querySelector('#wikiDialog [data-wiki-action=source]').click();await until(()=>document.querySelector('#wikiDialog [name=wiki-version]')?.value===target.id);
      if(document.querySelector('#wikiDialog .wiki-detail h3')?.textContent!==target.title||NowNoteProtectionProtocol.canonicalJson(noteHistory.export())!==before)throw Error('wiki_citation_target_or_write');
      ui.close();document.querySelector('#wikiDialog').remove();
      let summaryAllowed=true,selectedReads=0,release;
      const summaryRow={id:documentValue.wiki_id,deferred:true,summary:{schema_version:1,readable:true,protected:false,approved:true,
        title:'SUMMARY_ONLY_TITLE',topic:'Summary topic',stale:false}};
      const lazy=mountNowWiki({contextKey:wikiViewKey,notes:()=>[],list:async()=>{throw Error('summary_eager_full_list');},
        listIndex:async()=>[summaryRow],canReadSummary:()=>summaryAllowed,canRead:()=>true,
        readPage:async id=>{if(id!==documentValue.wiki_id)throw Error('summary_wrong_selected_id');selectedReads++;return new Promise(resolve=>{release=()=>resolve({id,document:documentValue});});},
        sourceStatus:async()=>({available:true,stale:false,sources:[]})});
      await lazy.open('browse');
      if(!document.querySelector('#wikiDialog').textContent.includes('SUMMARY_ONLY_TITLE')||selectedReads)throw Error('summary_catalog_without_body');
      document.querySelector('#wikiDialog .library-item').click();await until(()=>typeof release==='function');
      if(document.querySelector('#wikiDialog .wiki-body'))throw Error('summary_body_before_selection_finished');
      release();await until(()=>Boolean(document.querySelector('#wikiDialog .wiki-body')));
      if(selectedReads!==1)throw Error('summary_selected_read_count');
      lazy.close();await lazy.open('browse');summaryAllowed=false;lazy.check();
      if(document.querySelector('#wikiDialog').open||document.querySelector('#wikiDialog').textContent.includes('SUMMARY_ONLY_TITLE'))throw Error('summary_revoked_title');
      summaryAllowed=true;await lazy.open('browse');release=null;document.querySelector('#wikiDialog .library-item').click();
      await until(()=>typeof release==='function');lazy.close();release();await pause();
      if(document.querySelector('#wikiDialog .wiki-body'))throw Error('summary_late_closed_body');
      return {wikiCitationNavigation:true,journalUnchanged:true,summaryCatalog:true,selectedOnly:true,summaryRevocation:true,closedLateRead:true};
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
        const move=ui.open('browse');await until(()=>document.querySelector('#wikiDialog [data-wiki-action=cancel-send]'),'dirty_navigation_confirmation');
        document.querySelector('#wikiDialog [data-wiki-action=cancel-send]').click();await move;
        if(document.querySelector('#wikiDialog .wiki-detail h3')?.textContent!=='Budget guide'||calls!==1)throw Error('dirty_navigation_lost_draft');
        ui.close();note.content='x'.repeat(524288);await ui.open();document.querySelector('#wikiDialog [name=wiki-source]').click();document.querySelector('#wikiDialog [data-wiki-action=generate]').click();
        await until(()=>document.querySelector('#wikiDialog [role=status]').textContent.includes('512KiB'),'budget_prompt_limit');
        if(calls!==1||document.querySelector('#wikiDialog [data-wiki-action=confirm-send]'))throw Error('budget_prompt_limit_sent');
        return {syntheticCalls:calls,outputTokens:body.max_tokens,cancelCalls:0,staleCalls:0,overLimitCalls:0};
      }finally{ui.close();globalThis.fetch=realFetch;state.settings.llm=original;}
    })()`);
    await run('noteHistory.idle()');result={ok:true,sources:2,ids:before,phase,callbacks,budget,ingest,query,lint,workspace,relationVisibility,citationNavigation,selectiveRead,productSave,remote:remoteFixture.report,blockedNetworkAttempts:network,realProviderCalls:0};
  }catch(error){
    const status=window&&!window.isDestroyed()?await window.webContents.executeJavaScript('document.querySelector("#wikiDialog [role=status]")?.textContent||""').catch(()=>''):'';
    result={ok:false,error:error.message,status};
  }
  finally{fs.writeFileSync(path.join(own,mode+'-'+phase+'.json'),JSON.stringify(result));window?.destroy();documentFile.closeAll();app.exit(result.ok?0:1);}
});
