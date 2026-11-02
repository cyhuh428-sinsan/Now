import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto as crypto} from 'node:crypto';
async function fixture(){
  const box=vm.createContext({crypto,structuredClone,TextEncoder,TextDecoder,Uint8Array,atob,btoa});
  const modules=['note-protection-protocol','note-history-state','document-parts','wiki-state','wiki-ingest','wiki-query','wiki-lint','wiki-sources','wiki-lifecycle','wiki-notebook','wiki-evidence','wiki-ingest-notebook','wiki-read-set'];
  for(const name of modules)vm.runInContext(await fs.readFile(new URL('../vendor/'+name+'.js',import.meta.url),'utf8'),box);
  const source=await fs.readFile(new URL('../vendor/wiki-selected-page.js',import.meta.url),'utf8').catch(()=>null);assert.ok(source,'selected local Wiki detail implementation required');vm.runInContext(source,box);
  const ctx={url:'',owner:'alice',device:'qa',auth:'synthetic',enabled:true,online:false};let saved=null,writes=0,locked=false,stamp='one',key='one';
  const h=box.NowNoteHistory.create({context:()=>ctx,write:async value=>{if(locked)throw Error('whole journal write forbidden');saved=structuredClone(value);writes++;},request:async()=>{throw Error('network forbidden');}});
  let history=h;
  const api={context:()=>ctx,contextKey:()=>key,history:()=>history,sourceSafety:async()=>({status:'ok',epoch:0,lineage:false,fence:false}),source:id=>{const n=h.view(id);return n?{owner:ctx.owner,localId:id,status:'ok',origin:'local',title:n.draft.title,content:n.draft.content,revisionId:null,headVersion:0}:null;},captureNotes:async()=>{throw Error('file only');},listRemote:async()=>[],readRemote:async()=>{throw Error('remote forbidden');}};
  api.lifecycle=box.NowWikiLifecycle.create(api);api.sources=box.NowNoteWikiSources.create(api);
  await api.sources.captureFiles([{name:'source.md',arrayBuffer:async()=>new TextEncoder().encode('Exact selected evidence.').buffer}]);
  const ingest=box.createWikiIngestNotebook(api),file=(await api.sources.list())[0],plan=await ingest.plan({fileIds:[file.id],noteIds:[]});
  const proposal=await ingest.generate(plan,{provider:'synthetic',model:'no-model',invoke:async()=>JSON.stringify({pages:plan.plan.pages.map(p=>({wiki_id:p.wiki_id,draft_id:p.draft_id,title:'Selected guide',topic:'Test',page_type:'concept',summary:'Synthetic',aliases:[],sections:[{id:'s',title:'Finding',markdown:'Selected finding.',citation_ids:['c']}],claims:[],relations:[],citations:[{id:'c',evidence_id:file.id,section_id:null,quote:'Exact selected evidence.'}]}))})});
  const committed=await ingest.commitLocal(proposal),id=committed.documents[0].wiki_id,account=box.NowNoteHistory.key(ctx),other='wiki:'+crypto.randomUUID();
  saved.contexts[account].notes[other]=structuredClone(saved.contexts[account].notes['wiki:'+id]);
  for(const n of [saved.contexts[account].notes[other].raw,saved.contexts[account].notes[other].draft])n.local_id=other;
  locked=true;history={deferred:()=>true,matches:()=>true,status:()=>({unsupported:false}),wikiIndex:()=>({stamp}),currentView:n=>h.currentView(n)};
  const physical=vm.runInContext('NowDocumentParts.encode('+JSON.stringify(saved)+')',box),reads=[];
  const drive=steps=>{let step=steps.next();while(!step.done){reads.push(step.value);assert.ok(!step.value.includes(JSON.stringify(other)+',"revisions"'),'unrelated Wiki history must not be read');step=steps.next(physical.get(step.value));}return step.value;};
  let wait=null;
  const openSet=guard=>box.NowWikiReadSet.open({stamp,account,guard,current:async()=>({...drive(box.NowDocumentParts.currentSteps(account)),stamp}),directory:async p=>({...drive(box.NowDocumentParts.selectSteps(p,true)),projection:'path_v1',stamp}),read:async p=>{const result={...drive(box.NowDocumentParts.selectSteps(p)),projection:'path_v1',stamp};if(wait)await wait;return result;}});
  const selected=box.NowWikiSelectedPage.create({...api,openSet,inspectOperations:rows=>ingest.inspectOperations(rows)});
  return {selected,id,ctx,reads,writes:()=>writes,initialWrites:writes,stamp:()=>{stamp='two';},context:()=>{key='other';},box,
    remote:()=>{physical.get(JSON.stringify(['contexts',account,'notes','wiki:'+id])).entries.find(([name])=>name==='localOnly')[1].value=false;},
    delay:()=>{let release;wait=new Promise(resolve=>{release=resolve;});return release;}};
}
test('selected local v2 page validates its file evidence and producing operation without materializing or writing unrelated history',async()=>{
  const f=await fixture(),row=await f.selected.read(f.id);assert.equal(row.document.wiki_id,f.id);assert.equal(row.localOnly,true);assert.equal(row.unavailable,undefined);
  const doc=structuredClone(row.document);assert.equal(f.selected.canRead(doc),true);assert.equal((await f.selected.sourceStatus(doc.drafts[0],doc)).available,true);
  assert.equal(f.writes(),f.initialWrites);f.stamp();assert.equal(f.selected.canRead(doc),false);f.selected.release();
});
test('selected page proofs are discarded on close or account change and cannot approve arbitrary documents',async()=>{
  const f=await fixture(),row=await f.selected.read(f.id),doc=structuredClone(row.document);doc.drafts[0].title='altered';assert.equal(f.selected.canRead(doc),false);
  f.context();assert.equal(f.selected.canRead(row.document),false);assert.equal((await f.selected.sourceStatus(row.document.drafts[0],row.document)).available,false);f.selected.release();
  assert.equal(f.writes(),f.initialWrites);
});
test('revoked authentication invalidates a selected proof even before a context key notification',async()=>{
  const f=await fixture(),row=await f.selected.read(f.id);f.ctx.enabled=false;
  assert.equal(f.selected.canRead(row.document),false);assert.equal((await f.selected.sourceStatus(row.document.drafts[0],row.document)).available,false);f.selected.release();
});
test('server-backed targets explicitly retain full validation and a closed late read never installs a page',async()=>{
  const f=await fixture();f.remote();assert.equal(await f.selected.read(f.id),null);assert.equal(f.writes(),f.initialWrites);
  const g=await fixture(),release=g.delay(),pending=g.selected.read(g.id);await new Promise(resolve=>setImmediate(resolve));g.selected.release();release();await assert.rejects(pending);assert.equal(g.writes(),g.initialWrites);
});
