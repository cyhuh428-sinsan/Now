import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto as crypto} from 'node:crypto';

async function fixture(){
  const box=vm.createContext({crypto,structuredClone,TextEncoder,TextDecoder,Uint8Array,atob,btoa});
  for(const name of ['note-protection-protocol.js','note-history-state.js','wiki-state.js','wiki-lifecycle.js','wiki-notebook.js'])
    vm.runInContext(await fs.readFile(new URL('../vendor/'+name,import.meta.url),'utf8'),box);
  const ctx={url:'https://example.invalid',owner:'alice',device:'one',auth:'synthetic',enabled:true,online:true};
  const history=box.NowNoteHistory.create({context:()=>ctx,write:async()=>{},request:async()=>{throw Error('unexpected sync');}});
  let locked=false,sourceFailure=null,reads=[],options=[];
  const source={owner:'alice',localId:'source',status:'ok',origin:'local',title:'Source',content:'Exact evidence.',revisionId:null,headVersion:0};
  const snap=await box.NowNoteWiki.capture(['source'],ctx,()=>source);
  const make=async()=>{
    const draft=await box.NowNoteWiki.validateDraft(JSON.stringify({title:'Guide',topic:'Topic',sections:[{id:'one',title:'Finding',markdown:'Body text.',citation_ids:['c']}],
      citations:[{id:'c',source_id:'source-1',quote:'Exact evidence.'}]}),snap,{provider:'omniroute',model:'auto'});
    return {schema_version:1,document_version:1,wiki_id:crypto.randomUUID(),scope:snap.scope,drafts:[draft],approvals:[],rejected_draft_ids:[]};
  };
  const docs=[await make(),await make()];
  const resources=docs.map(d=>({id:d.wiki_id,owner_id:ctx.owner,schema_version:1,version:1,deleted_at:null,
    payload:{artifact_local_id:'wiki:'+d.wiki_id,dependencies:[{owner_id:ctx.owner,local_id:'source'}]},
    summary:{schema_version:1,readable:true,protected:false,approved:false,title:'Guide',topic:'Topic',stale:false}}));
  const api={context:()=>ctx,contextKey:()=>JSON.stringify(ctx),history:()=>history,source:id=>{if(id===sourceFailure)throw Error('whole source history forbidden');return {...source,status:locked?'locked':'ok'};},
    listRemote:async o=>{options.push(o);return structuredClone(resources);},
    readRemote:async id=>{reads.push(id);const d=docs.find(d=>d.wiki_id===id);return {resource:resources.find(r=>r.id===id),source_status:{available:true,stale:false},
      artifact:{protected:false,document:structuredClone(d),head_revision_id:'head-'+id}};},
    readCurrent:async local=>{const d=docs.find(d=>'wiki:'+d.wiki_id===local);return {head_revision_id:'head-'+d.wiki_id,crypto_epoch:0,
      snapshot:{note:{owner_id:ctx.owner,local_id:local,content:JSON.stringify(d),source:'wiki-artifact'}}};}};
  api.lifecycle=box.NowWikiLifecycle.create({...api,request:async()=>{throw Error('unexpected lifecycle write');}});
  return {book:box.createWikiNotebook(api),history,ctx,resources,docs,reads,options,lock:()=>{locked=true;},failSource:id=>{sourceFailure=id;}};
}
test('catalog uses verified summaries without fetching or tracking bodies; selected page reads only its ID',async()=>{
  const f=await fixture(),rows=await f.book.listIndex();
  assert.equal(rows.length,2);assert.equal(f.options[0].summary,true);assert.equal(f.reads.length,0);
  assert.equal(rows[0].document,undefined);assert.equal(rows[0].summary.title,'Guide');assert.equal(f.book.canReadSummary(rows[0]),true);
  assert.equal(f.book.canReadSummary(structuredClone(rows[0])),false,'unbound copies are not verification proof');
  const page=await f.book.readPage(f.docs[1].wiki_id);
  assert.equal(page.document.wiki_id,f.docs[1].wiki_id);
  assert.ok(f.reads.length>0);assert.ok(f.reads.every(id=>id===f.docs[1].wiki_id));
});
test('summary proof expires on local source lock and account change; malformed/missing summary hides title',async()=>{
  const f=await fixture(),rows=await f.book.listIndex();f.lock();assert.equal(f.book.canReadSummary(rows[0]),false);
  const g=await fixture();delete g.resources[0].summary;g.resources[1].summary.readable='yes';
  const hidden=await g.book.listIndex();assert.ok(hidden.every(row=>!row.summary?.title));assert.equal(g.reads.length,0);
  const h=await fixture(),known=await h.book.listIndex();h.ctx.owner='other';assert.equal(h.book.canReadSummary(known[0]),false);
});
test('offline server catalog never reveals cached titles or eagerly reads bodies',async()=>{
  const f=await fixture();await f.book.listIndex();f.ctx.online=false;
  const rows=await f.book.listIndex();assert.ok(rows.every(row=>!row.summary?.title));assert.equal(f.reads.length,0);
});
test('offline protected local wiki remains selectable without returning its plaintext',async()=>{
  const f=await fixture(),local='wiki:'+crypto.randomUUID();f.ctx.online=false;
  f.history.entryIds=options=>options?.includeProtected?[local]:[];
  f.history.currentView=()=>null;f.history.blocked=()=>true;
  const rows=await f.book.listIndex();assert.equal(rows.length,1);assert.equal(rows[0].id,local.slice(5));
  assert.equal(rows[0].protected,true);assert.equal(rows[0].document,undefined);assert.equal(rows[0].summary,undefined);
});

test('safe deferred browse lists remote summaries and local IDs without materializing any history',async()=>{
  const f=await fixture(),local='wiki:'+crypto.randomUUID();let stamp='one',ensures=0;
  f.history.wikiIndex=()=>({projection:'wiki_index_v1',stamp,ids:[local]});
  f.history.deferred=()=>true;
  f.history.ensure=async()=>{ensures++;throw Error('explicit hydration');};
  f.history.export=()=>{throw Error('whole history forbidden for browse');};
  f.history.entryIds=()=>{throw Error('whole entry list forbidden for browse');};
  const rows=await f.book.listIndex();assert.equal(rows.length,3);assert.equal(ensures,0);assert.equal(f.reads.length,0);
  const remote=rows.find(row=>row.id===f.docs[0].wiki_id);assert.equal(remote.summary.title,'Guide');assert.equal(f.book.canReadSummary(remote),true);
  const own=rows.find(row=>row.id===local.slice(5));assert.equal(own.document,undefined);assert.equal(own.summary,undefined);
  stamp='changed';assert.equal(f.book.canReadSummary(remote),false);
  await assert.rejects(f.book.readPage(f.docs[0].wiki_id),/explicit hydration/);assert.equal(ensures,1);
});

test('a source requiring unread history conceals only its row, never aborts or materializes the catalog',async()=>{
  const f=await fixture(),id='wiki-source:'+crypto.randomUUID();
  f.history.wikiIndex=()=>({projection:'wiki_index_v1',stamp:'one',ids:[]});f.history.deferred=()=>true;
  f.history.export=()=>{throw Error('whole journal forbidden');};f.history.entryIds=()=>{throw Error('whole entries forbidden');};
  f.resources[0].payload.dependencies[0].local_id=id;f.failSource(id);
  const rows=await f.book.listIndex();assert.equal(rows.length,2);assert.equal(rows[0].summary,undefined);
  assert.equal(f.book.canReadSummary(rows[0]),false);assert.equal(rows[1].summary.title,'Guide');assert.equal(f.reads.length,0);
});
