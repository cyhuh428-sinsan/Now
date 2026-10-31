import assert from 'node:assert/strict';
export async function verifyWikiFlow({evaluate:run}){
  const evaluate=async expression=>{try{return await run(expression);}catch(error){const state=await run('JSON.stringify({open:document.querySelector("#wikiDialog")?.open,status:document.querySelector("#wikiDialog [role=status]")?.textContent,body:document.querySelector("#wikiDialog .wiki-detail")?.textContent})');throw Error('Wiki fixture step '+expression.slice(0,240)+' '+state,{cause:error});}};
  assert.equal(await evaluate('typeof mountNowWiki'),'function','Wiki UI must be mounted from the product runtime');
  await evaluate('(async()=>{'
    +'wikiUI?.close();document.querySelector("#wikiDialog")?.remove();'
    +'globalThis.wikiFixture={owner:"alice",invoked:0,approved:0,saved:[],opened:[]};'
    +'const f=wikiFixture,ctx={url:"https://example.invalid",owner:"alice"};'
    +'const sources={a:{owner:"alice",localId:"a",status:"ok",origin:"local",revisionId:null,headVersion:0,title:"Evidence A",content:"Exact evidence."}};'
    +'f.ui=mountNowWiki({contextKey:()=>f.owner,notes:()=>[{id:"a",title:"Evidence A",origin:"local"}],list:async()=>f.saved,'
    +'capture:ids=>NowNoteWiki.capture(ids,ctx,id=>sources[id]),'
    +'connection:()=>({provider:"omniroute",model:"auto",endpoint:"https://gateway.invalid/v1",invoke:async()=>{f.invoked++;return JSON.stringify({title:"Guide",topic:"Operations",sections:[{id:"one",title:"Finding",markdown:"**Supported** finding.<img src=\\\"https://tracking.invalid/a\\\">",citation_ids:["c"]}],citations:[{id:"c",source_id:"source-1",quote:"Exact evidence."}]});}}),'
    +'save:async doc=>{f.saved=[{document:structuredClone(doc),pending:true}];return {pending:true};},'
    +'approve:async doc=>{f.approved++;const value=structuredClone(doc);value.document_version++;value.approvals.push({id:crypto.randomUUID(),draft_id:value.drafts.at(-1).id});f.saved=[{document:value}];return {document:value};},'
    +'reject:async doc=>({document:doc}),sourceStatus:async draft=>{if(f.sourceFailure)throw Error("source_read_failed");if(f.sourceUnavailable)return {available:false,stale:true,sources:[]};if(f.sourceChanged)return {available:true,stale:true,sources:[]};if(f.sourceGate)return new Promise(resolve=>{f.resolveSource=resolve;});return NowNoteWiki.sourceStatus(draft,ctx,id=>sources[id]);},'
    +'openSource:ref=>f.opened.push(ref.local_id)});await f.ui.open();})()');
  await evaluate('document.querySelector("#wikiDialog [name=wiki-source]").click();document.querySelector("#wikiDialog [data-wiki-action=generate]").click()');
  for(let i=0;i<30 && !await evaluate('Boolean(document.querySelector("#wikiDialog [data-wiki-action=confirm-send]"))');i++)await new Promise(r=>setTimeout(r,25));
  assert.equal(await evaluate('wikiFixture.invoked'),0,'Explicit provider confirmation must precede invocation');
  assert.ok(await evaluate('document.querySelector("#wikiDialog").textContent.includes("gateway.invalid")'));
  await evaluate('document.querySelector("#wikiDialog [data-wiki-action=confirm-send]").click()');
  for(let i=0;i<40 && !await evaluate('Boolean(document.querySelector("#wikiDialog strong"))');i++)await new Promise(r=>setTimeout(r,25));
  assert.equal(await evaluate('wikiFixture.invoked'),1);
  assert.equal(await evaluate('document.querySelector("#wikiDialog [data-wiki-action=generate]").disabled'),true,'Save the current draft before creating another publication step');
  assert.equal(await evaluate('document.querySelectorAll("#wikiDialog .wiki-body img").length'),0,'Generated Markdown must not fetch remote images');
  assert.ok(await evaluate('document.querySelector("#wikiDialog").textContent.includes("Exact evidence.")'));
  await evaluate('document.querySelector("#wikiDialog [data-wiki-action=save-draft]").click()');
  for(let i=0;i<40 && !await evaluate('wikiFixture.saved.length===1');i++)await new Promise(r=>setTimeout(r,25));
  assert.equal(await evaluate('wikiFixture.saved[0].document.drafts.length'),1);
  assert.equal(await evaluate('wikiFixture.saved[0].document.approvals.length'),0,'Saving a draft is not approval');
  await evaluate('document.querySelector("#wikiDialog [data-wiki-action=source]").click()');
  assert.equal(await evaluate('wikiFixture.opened[0]'),'a');
  for(const flag of ['sourceUnavailable','sourceFailure']){
    await evaluate('(async()=>{wikiFixture.sourceUnavailable=false;wikiFixture.sourceFailure=false;wikiFixture['+JSON.stringify(flag)+']=true;await wikiFixture.ui.open();document.querySelector("#wikiDialog .library-item").click();})()');
    await new Promise(r=>setTimeout(r,100));
    assert.equal(await evaluate('document.querySelectorAll("#wikiDialog .wiki-body").length'),0,flag+': source unavailable/read failure must not render saved wiki text');
    assert.equal(await evaluate('document.querySelector("#wikiDialog").textContent.includes("Exact evidence.")'),false,flag+': saved citations must stay hidden');
  }
  await evaluate('wikiFixture.sourceUnavailable=false;wikiFixture.sourceFailure=false');
  await evaluate('(async()=>{wikiFixture.sourceChanged=true;await wikiFixture.ui.open();document.querySelector("#wikiDialog .library-item").click();})()');
  for(let i=0;i<40 && !await evaluate('Boolean(document.querySelector("#wikiDialog .wiki-body strong"))');i++)await new Promise(r=>setTimeout(r,25));
  assert.ok(await evaluate('document.querySelector("#wikiDialog").textContent.includes("원본 변경")'),'Plain source changes remain readable but need review');
  await evaluate('document.querySelector("#wikiDialog [data-wiki-action=approve]").click()');
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate('wikiFixture.approved'),0,'A stale draft must not reach the approval adapter');
  await evaluate('wikiFixture.sourceChanged=false;wikiFixture.sourceGate=true;document.querySelector("#wikiDialog .library-item").click()');
  for(let i=0;i<40 && !await evaluate('typeof wikiFixture.resolveSource==="function"');i++)await new Promise(r=>setTimeout(r,25));
  assert.equal(await evaluate('document.querySelectorAll("#wikiDialog .wiki-body").length'),0,'Previously visible text must be hidden while fresh source access is pending');
  await evaluate('wikiFixture.sourceGate=false;wikiFixture.resolveSource({available:true,stale:false,sources:[]})');
  for(let i=0;i<40 && !await evaluate('Boolean(document.querySelector("#wikiDialog .wiki-body strong"))');i++)await new Promise(r=>setTimeout(r,25));
  assert.ok(await evaluate('document.querySelector("#wikiDialog").textContent.includes("Exact evidence.")'),'Positive access restores the view only after verification');
  await evaluate('wikiFixture.owner="bob";wikiFixture.ui.check()');
  assert.equal(await evaluate('document.querySelector("#wikiDialog").open'),false);
  assert.equal(await evaluate('document.querySelector("#wikiDialog").textContent.includes("Exact evidence.")'),false,'Account changes must clear rendered evidence');
  await evaluate('(async()=>{'
    +'document.querySelector("#wikiDialog").remove();'
    +'state.settings.server={...state.settings.server,mode:"local",ownerId:"wiki-ui-qa",url:"https://wiki.example.invalid",deviceId:"wiki-ui-device"};'
    +'state.settings.llm={...defaultLlmSettings(),provider:"omniroute",omniUrl:"https://gateway.invalid/v1",omniModel:"auto",omniApiKey:"synthetic-ui-only"};'
    +'const source=createNode("Wiki source","Exact evidence.",null,1);source.id="wiki-ui-source";source.shared=false;source.serverShared=false;source.syncState="local";'
    +'state.data.tree=[source];state.data.deletedTree=[];state.data.daily={};state.data.worklogs={};state.data.archivedDaily=[];state.selectedTreeId=source.id;'
    +'noteHistoryProjectionScope=NowNoteHistory.key(noteHistoryContext());libraryNotesContext=NowLibrary.key(libraryContext());'
    +'globalThis.wikiActualCalls=0;llmChatRequest=async()=>{wikiActualCalls++;return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({title:"Durable Guide",topic:"Operations",sections:[{id:"one",title:"Finding",markdown:"**Supported** finding.",citation_ids:["c"]}],citations:[{id:"c",source_id:"source-1",quote:"Exact evidence."}]})}}]})};};'
    +'const invoke=llmChatRequest;llmChatRequest=async(...args)=>{globalThis.wikiActualPrompt=JSON.parse(args[2]);const response=await invoke(...args);if(wikiActualCalls>1)return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({title:"Updated Guide",topic:"Operations",sections:[{id:"one",title:"Finding",markdown:"**Revised** finding.",citation_ids:["c"]}],citations:[{id:"c",source_id:"source-1",quote:"Exact evidence."}]})}}]})};return response;};'
    +'document.querySelector("#wikiBtn")?.remove();initializeWikiNotebook();persist();persistSettings();render();document.querySelector("#wikiBtn").click();})()');
  for(let i=0;i<40 && !await evaluate('Boolean(document.querySelector("#wikiDialog [name=wiki-source]"))');i++)await new Promise(r=>setTimeout(r,25));
  await evaluate('(()=>{const q=document.querySelector("#wikiDialog [name=wiki-question]");q.value="장애 복구 절차는?";q.dispatchEvent(new Event("input",{bubbles:true}));})()');
  await evaluate('document.querySelector("#wikiDialog [name=wiki-source]").click();document.querySelector("#wikiDialog [data-wiki-action=generate]").click()');
  for(let i=0;i<40 && !await evaluate('Boolean(document.querySelector("#wikiDialog [data-wiki-action=confirm-send]"))');i++)await new Promise(r=>setTimeout(r,25));
  assert.equal(await evaluate('wikiActualCalls'),0);
  await evaluate('document.querySelector("#wikiDialog [data-wiki-action=confirm-send]").click()');
  for(let i=0;i<40 && !await evaluate('Boolean(document.querySelector("#wikiDialog strong"))');i++)await new Promise(r=>setTimeout(r,25));
  assert.equal(await evaluate('wikiActualCalls'),1);
  assert.equal(await evaluate('wikiActualPrompt.question'),'장애 복구 절차는?');
  await evaluate('document.querySelector("#wikiDialog [data-wiki-action=save-draft]").click()');
  for(let i=0;i<60 && !await evaluate('Object.values(noteHistory.entries()).some(i=>i.draft.source==="wiki-artifact")');i++)await new Promise(r=>setTimeout(r,25));
  await evaluate('noteHistory.idle()');
  assert.equal(await evaluate('Object.values(noteHistory.entries()).find(i=>i.draft.source==="wiki-artifact").localOnly'),true);
  for(let i=0;i<60 && !await evaluate('document.querySelector("#wikiDialog [data-wiki-action=approve]")?.disabled===false');i++)await new Promise(r=>setTimeout(r,25));
  await evaluate('document.querySelector("#wikiDialog [data-wiki-action=approve]").click()');
  for(let i=0;i<80 && !await evaluate('JSON.parse(Object.values(noteHistory.entries()).find(i=>i.draft.source==="wiki-artifact").draft.content).approvals.length===1');i++)await new Promise(r=>setTimeout(r,25));
  await evaluate('(async()=>{await noteHistory.idle();await Promise.all([...storagePendingWrites]);})()');
  assert.equal(await evaluate('Object.values(noteHistory.entries()).find(i=>i.draft.source==="wiki-artifact").revisions.length'),2);
  assert.equal(await evaluate('findTreeNode(state.data.tree,"wiki-ui-source").content'),'Exact evidence.');
  assert.equal(await evaluate('flattenTree(state.data.tree).some(n=>String(n.id).startsWith("wiki:"))'),false);
  assert.ok(await evaluate('Boolean(document.querySelector("#wikiDialog [name=wiki-version]"))'),'Stored wiki drafts and approvals need a version selector');
  assert.ok(await evaluate('Boolean(document.querySelector("#wikiDialog [data-wiki-action=protect]"))'),'A saved wiki needs its own protection entry before original protection');
  await evaluate('(()=>{const n=findTreeNode(state.data.tree,"wiki-ui-source");n.content+="\\nUpdated source.";n.updatedAt=new Date().toISOString();persist();render();document.querySelector("#wikiDialog .library-item").click();})()');
  for(let i=0;i<60 && !await evaluate('!document.querySelector("#wikiDialog [data-wiki-action=generate]").disabled');i++)await new Promise(r=>setTimeout(r,25));
  assert.ok(await evaluate('document.querySelector("#wikiDialog").textContent.includes("원본 변경")'));
  await evaluate('document.querySelector("#wikiDialog [data-wiki-action=generate]").click()');
  for(let i=0;i<60 && !await evaluate('Boolean(document.querySelector("#wikiDialog [data-wiki-action=confirm-send]"))');i++)await new Promise(r=>setTimeout(r,25));
  await evaluate('document.querySelector("#wikiDialog [data-wiki-action=confirm-send]").click()');
  for(let i=0;i<60 && !await evaluate('document.querySelector("#wikiDialog .wiki-detail h3")?.textContent==="Updated Guide"');i++)await new Promise(r=>setTimeout(r,25));
  assert.ok(await evaluate('document.querySelector("#wikiDialog .wiki-detail h3")?.textContent==="Updated Guide"'),await evaluate('document.querySelector("#wikiDialog [role=status]").textContent'));
  await evaluate('document.querySelector("#wikiDialog [data-wiki-action=save-draft]").click()');
  for(let i=0;i<80 && !await evaluate('document.querySelector("#wikiDialog [data-wiki-action=approve]")?.disabled===false');i++)await new Promise(r=>setTimeout(r,25));
  assert.ok(await evaluate('document.querySelector("#wikiDialog .library-item").textContent.includes("Durable Guide")'),'Unapproved regeneration must not replace the approved list title');
  await evaluate('document.querySelector("#wikiDialog [name=wiki-compare]").click()');
  for(let i=0;i<60 && !await evaluate('Boolean(document.querySelector("#wikiDialog .wiki-diff"))');i++)await new Promise(r=>setTimeout(r,25));
  assert.ok(await evaluate('Boolean(document.querySelector("#wikiDialog .wiki-diff"))'),JSON.stringify(await evaluate('(()=>{const d=document.querySelector("#wikiDialog");return {status:d.querySelector("[role=status]")?.textContent,checked:d.querySelector("[name=wiki-compare]")?.checked,disabled:d.querySelector("[name=wiki-compare]")?.disabled,versions:[...d.querySelectorAll("[name=wiki-version] option")].map(o=>({value:o.value,selected:o.selected})),history:Object.values(noteHistory.entries()).filter(i=>i.draft.source==="wiki-artifact").map(i=>({drafts:JSON.parse(i.draft.content).drafts.length,revisions:i.revisions.length}))};})()')));
  assert.ok(await evaluate('document.querySelector("#wikiDialog .wiki-diff").textContent.includes("Supported") && document.querySelector("#wikiDialog .wiki-diff").textContent.includes("Revised")'));
  assert.ok(await evaluate('document.querySelector("#wikiDialog .wiki-source-changes").textContent.includes("판본 변경")'));
  await evaluate('document.querySelector("#wikiDialog [data-wiki-action=approve]").click()');
  for(let i=0;i<80 && !await evaluate('JSON.parse(Object.values(noteHistory.entries()).find(i=>i.draft.source==="wiki-artifact").draft.content).approvals.length===2');i++)await new Promise(r=>setTimeout(r,25));
  await evaluate('(async()=>{await noteHistory.idle();await Promise.all([...storagePendingWrites]);})()');
  assert.equal(await evaluate('Object.values(noteHistory.entries()).find(i=>i.draft.source==="wiki-artifact").revisions.length'),4);
  assert.equal(await evaluate('JSON.parse(Object.values(noteHistory.entries()).find(i=>i.draft.source==="wiki-artifact").draft.content).drafts[0].title'),'Durable Guide');
  assert.equal(await evaluate('findTreeNode(state.data.tree,"wiki-ui-source").content'),'Exact evidence.\nUpdated source.');
  await evaluate('noteHistoryController.lock()');
  assert.equal(await evaluate('document.querySelector("#wikiDialog").open'),false);
  assert.equal(await evaluate('document.querySelector("#wikiDialog").textContent.includes("Exact evidence.")'),false);
  await evaluate('(async()=>{await noteHistoryController.resume();await wikiUI.open();document.querySelector("#wikiDialog .library-item").click();})()');
  return true;
}

export async function verifyWikiCold({evaluate}){
  await evaluate('wikiUI.open()');
  await evaluate('document.querySelector("#wikiDialog .library-item").click()');
  for(let i=0;i<60 && !await evaluate('Boolean(document.querySelector("#wikiDialog strong"))');i++)await new Promise(r=>setTimeout(r,25));
  assert.ok(await evaluate('document.querySelector("#wikiDialog").textContent.includes("Updated Guide")'));
  assert.equal(await evaluate('JSON.parse(Object.values(noteHistory.entries()).find(i=>i.draft.source==="wiki-artifact").draft.content).approvals.length'),2);
  assert.equal(await evaluate('Object.values(noteHistory.entries()).find(i=>i.draft.source==="wiki-artifact").localOnly'),true);
  assert.equal(await evaluate('flattenTree(state.data.tree).some(n=>String(n.id).startsWith("wiki:"))'),false);
  await evaluate('(()=>{const s=document.querySelector("#wikiDialog [name=wiki-version]");s.selectedIndex=0;s.dispatchEvent(new Event("change",{bubbles:true}));})()');
  for(let i=0;i<60 && !await evaluate('document.querySelector("#wikiDialog .wiki-detail").textContent.includes("Durable Guide")');i++)await new Promise(r=>setTimeout(r,25));
  assert.ok(await evaluate('document.querySelector("#wikiDialog").textContent.includes("원본 변경")'),'Cold historical view must recheck its own source version');
}

async function wikiUntil(evaluate,expression,label){
  for(let n=0;n<120;n++){
    if(await evaluate(expression))return;
    await new Promise(resolve=>setTimeout(resolve,25));
  }
  throw Error(label+' · '+await evaluate('document.querySelector("#noteProtectionDialog .protection-status")?.textContent||"no protection dialog"'));
}

async function wikiProtectionRead(evaluate){
  await evaluate('document.querySelector("#noteProtectionDialog [data-action=read]").click()');
  await wikiUntil(evaluate,'Boolean(document.querySelector("#noteProtectionDialog .library-confirm input[type=password]"))','Wiki archive key prompt');
  await evaluate('(()=>{const f=document.querySelector("#noteProtectionDialog .library-confirm");f.querySelector("input").value="synthetic-wiki-ui-only";f.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));})()');
  await wikiUntil(evaluate,'document.querySelector("#noteProtectionDialog .protection-plain")?.textContent.includes("Durable Guide")','Wiki archive read');
  assert.ok(await evaluate('document.querySelector("#noteProtectionDialog .protection-plain").textContent.includes("Updated Guide")'),'All preserved drafts remain readable');
  await evaluate('document.querySelector("#noteProtectionDialog [data-action=lock]").click()');
  assert.equal(await evaluate('document.querySelector("#noteProtectionDialog .protection-plain").textContent'),'');
}

export async function verifyWikiProtectionFlow({evaluate}){
  await evaluate('noteProtectionInternalEnabled=true;globalThis.wikiProtectionNetwork=0;globalThis.wikiProtectionFetch=fetch;fetch=async()=>{wikiProtectionNetwork++;throw Error("synthetic no network");};document.querySelector("#wikiDialog [data-wiki-action=protect]").click()');
  await wikiUntil(evaluate,'Boolean(document.querySelector("#noteProtectionDialog[open] [data-action=conversion]"))','Wiki protection entry');
  await wikiUntil(evaluate,'document.querySelectorAll("#noteProtectionDialog .protection-scope dt").length===4','Wiki protection identity labels');
  assert.ok(await evaluate('document.querySelector("#noteProtectionDialog [name=target]").textContent.includes("로컬 전용 위키")'));
  assert.ok(await evaluate('document.querySelector("#noteProtectionDialog .protection-scope").textContent.includes("이 기기 식별")'),'A local archive namespace must not be presented as a verified server identity');
  await evaluate('(async()=>{globalThis.wikiOriginalGuard="";const info=await inspectLocalWikiProtection();try{await noteProtection.start({...info.scope,local_id:"wiki-ui-source"},{schema_version:2,purpose:"conversion"},"synthetic-wiki-ui-only");}catch(error){wikiOriginalGuard=error.message;}render();})()');
  assert.ok(await evaluate('wikiOriginalGuard.includes("관련 위키")'),'Actual original-protection preflight must block before local wiki protection');
  assert.equal(await evaluate('wikiProtectionNetwork'),0);
  await wikiUntil(evaluate,'Boolean(document.querySelector("#noteProtectionDialog .protection-copies input"))','Exact-copy ownership confirmation');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#noteProtectionDialog section[aria-label=\\"보호 메모 분석\\"]")).display'),'none','Local wiki archives must not display an unusable server analysis section');
  await evaluate('document.querySelectorAll("#noteProtectionDialog .protection-copies input").forEach(input=>input.click());document.querySelector("#noteProtectionDialog [data-action=confirm]").click()');
  await wikiUntil(evaluate,'document.querySelectorAll("#noteProtectionDialog .protection-copies input").length===0&&document.querySelector("#noteProtectionDialog [data-action=conversion]")?.disabled===false','Copy attribution');
  await evaluate('document.querySelector("#noteProtectionDialog [data-action=conversion]").click()');
  await wikiUntil(evaluate,'Boolean(document.querySelector("#noteProtectionDialog .library-confirm input[type=password]"))','Wiki protection password');
  await evaluate('(()=>{const f=document.querySelector("#noteProtectionDialog .library-confirm");f.querySelector("input").value="synthetic-wiki-ui-only";f.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));})()');
  await wikiUntil(evaluate,'document.querySelector("#noteProtectionDialog .protection-status")?.textContent.includes("이 기기 보호 완료")','Local wiki settlement');
  assert.equal(await evaluate('wikiProtectionNetwork'),0,'Local protection must not publish any server resource');
  assert.ok(await evaluate('(async()=>{for(const store of protectionStorageAdapters()){if(JSON.stringify(await store.read()).includes("Durable Guide"))return false;}return true;})()'),'All registered durable/fallback stores must lose wiki plaintext');
  assert.equal(await evaluate('findTreeNode(state.data.tree,"wiki-ui-source").content'),'Exact evidence.\nUpdated source.');
  assert.equal(await evaluate('(async()=>{const roots=[];for(const s of protectionStorageAdapters())roots.push(await s.read());return NowNoteWiki.sourceProtectionDependencies(roots,noteHistoryContext(),"wiki-ui-source").length;})()'),0);
  await wikiProtectionRead(evaluate);
  await evaluate('(async()=>{await noteHistory.idle();await Promise.all([...storagePendingWrites]);fetch=wikiProtectionFetch;})()');
}

export async function verifyWikiProtectionCold({evaluate}){
  await evaluate('wikiUI.open()');
  await evaluate('document.querySelector("#wikiDialog .library-item").click()');
  await wikiUntil(evaluate,'Boolean(document.querySelector("#noteProtectionDialog[open] [name=representation] option"))','Cold local wiki archives');
  assert.ok(await evaluate('document.querySelector("#noteProtectionDialog [name=target]").textContent.includes("로컬 전용 위키")'));
  assert.equal(await evaluate('document.querySelector("#wikiDialog").textContent.includes("Durable Guide")'),false);
  await wikiProtectionRead(evaluate);
}
