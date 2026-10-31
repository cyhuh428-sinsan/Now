import assert from 'node:assert/strict';
export async function verifyWikiFlow({evaluate}){
  assert.equal(await evaluate('typeof mountNowWiki'),'function','Wiki UI must be mounted from the product runtime');
  await evaluate('(async()=>{'
    +'wikiUI?.close();document.querySelector("#wikiDialog")?.remove();'
    +'globalThis.wikiFixture={owner:"alice",invoked:0,saved:[],opened:[]};'
    +'const f=wikiFixture,ctx={url:"https://example.invalid",owner:"alice"};'
    +'const sources={a:{owner:"alice",localId:"a",status:"ok",origin:"local",revisionId:null,headVersion:0,title:"Evidence A",content:"Exact evidence."}};'
    +'f.ui=mountNowWiki({contextKey:()=>f.owner,notes:()=>[{id:"a",title:"Evidence A",origin:"local"}],list:async()=>f.saved,'
    +'capture:ids=>NowNoteWiki.capture(ids,ctx,id=>sources[id]),'
    +'connection:()=>({provider:"omniroute",model:"auto",endpoint:"https://gateway.invalid/v1",invoke:async()=>{f.invoked++;return JSON.stringify({title:"Guide",topic:"Operations",sections:[{id:"one",title:"Finding",markdown:"**Supported** finding.<img src=\\\"https://tracking.invalid/a\\\">",citation_ids:["c"]}],citations:[{id:"c",source_id:"source-1",quote:"Exact evidence."}]});}}),'
    +'save:async doc=>{f.saved=[{document:structuredClone(doc),pending:true}];return {pending:true};},'
    +'approve:async doc=>{const value=structuredClone(doc);value.document_version++;value.approvals.push({id:crypto.randomUUID(),draft_id:value.drafts.at(-1).id});f.saved=[{document:value}];return {document:value};},'
    +'reject:async doc=>({document:doc}),sourceStatus:draft=>NowNoteWiki.sourceStatus(draft,ctx,id=>sources[id]),'
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
    +'const invoke=llmChatRequest;llmChatRequest=async(...args)=>{globalThis.wikiActualPrompt=JSON.parse(args[2]);return invoke(...args);};'
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
  for(let i=0;i<60 && !await evaluate('!document.querySelector("#wikiDialog [data-wiki-action=approve]").disabled');i++)await new Promise(r=>setTimeout(r,25));
  await evaluate('document.querySelector("#wikiDialog [data-wiki-action=approve]").click()');
  for(let i=0;i<80 && !await evaluate('JSON.parse(Object.values(noteHistory.entries()).find(i=>i.draft.source==="wiki-artifact").draft.content).approvals.length===1');i++)await new Promise(r=>setTimeout(r,25));
  await evaluate('(async()=>{await noteHistory.idle();await Promise.all([...storagePendingWrites]);})()');
  assert.equal(await evaluate('Object.values(noteHistory.entries()).find(i=>i.draft.source==="wiki-artifact").revisions.length'),2);
  assert.equal(await evaluate('findTreeNode(state.data.tree,"wiki-ui-source").content'),'Exact evidence.');
  assert.equal(await evaluate('flattenTree(state.data.tree).some(n=>String(n.id).startsWith("wiki:"))'),false);
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
  assert.ok(await evaluate('document.querySelector("#wikiDialog").textContent.includes("Durable Guide")'));
  assert.equal(await evaluate('JSON.parse(Object.values(noteHistory.entries()).find(i=>i.draft.source==="wiki-artifact").draft.content).approvals.length'),1);
  assert.equal(await evaluate('Object.values(noteHistory.entries()).find(i=>i.draft.source==="wiki-artifact").localOnly'),true);
  assert.equal(await evaluate('flattenTree(state.data.tree).some(n=>String(n.id).startsWith("wiki:"))'),false);
}
