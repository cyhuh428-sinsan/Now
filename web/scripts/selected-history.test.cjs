const {test}=require('node:test'),assert=require('node:assert/strict');
globalThis.crypto=require('node:crypto').webcrypto;
require('../vendor/note-history-state.js');require('../vendor/journal-writes.js');
const {create}=require('../vendor/deferred-history.js');
const account=JSON.stringify(['https://qa.invalid','alice']);
function fixture({online=false,conflicted=false,wikiMetadata=false}={}){
  let stamp='one',fullReads=0,selectedReads=[],saved=[],binding='one';
  const context=()=>({url:'https://qa.invalid',owner:'alice',auth:binding,device:'qa',enabled:true,online});
  const note=id=>({owner_id:'alice',local_id:id,note_type:'tree',source:'manual',title:id,content:'current',level:1});
  const entry=id=>({raw:note(id),draft:note(id),base:{crypto_epoch:0,inventory_revision_ids:['r'],head_revision_id:'r',head_version:1},revisions:[{revision_id:'old',snapshot:{note:note(id)}}],outbox:[],receipts:[],replicaSelected:true,localOnly:!online,dirty:false});
  let root={schema_version:1,contexts:{[account]:{notes:{a:entry('a'),b:entry('b')}}}};
  if(conflicted)root.contexts[account].notes.a.conflict={code:'version_conflict',local:note('a'),remote:null};
  if(wikiMetadata)root.contexts[account].wiki_ingest_operations={pending:{state:'prepared'}};
  const notes=Object.fromEntries(Object.entries(root.contexts[account].notes).map(([id,item])=>[id,{projection:'current_v1',raw:item.raw,draft:item.draft,base:{crypto_epoch:0,head_revision_id:'r'},localOnly:!online,pending:0,dirty:false}]));
  const calls=[],pages=[],remote={a:note('a'),b:note('b')};let version=1;
  if(conflicted)notes.a.conflicted=true;
  const api=create({initial:{preview:{projection:'journal_current_v1',supported:true,syncSupported:true,wikiIndexSupported:!wikiMetadata,account,stamp,notes}},context,contextKey:()=>binding,accountKey:()=>account,
    readPage:async request=>{pages.push(request);return {projection:'history_page_v1',account,id:request.id,stamp,total:1,items:structuredClone(root.contexts[account].notes[request.id].revisions),nextCursor:null};},
    request:async(_ctx,path,method,body)=>{
      calls.push({path,method,id:body.local_id});
      if(path==='revisions/import')return {imported_refs:body.entries.map(e=>({kind:'offline_branch',id:e.revision_id}))};
      if(path==='current'&&method==='PUT'){remote[body.local_id]={...remote[body.local_id],...body.note};version++;
        return {mutation_id:body.mutation_id,result_revision_id:'r'+version,result_head_version:version,result_inventory_revision_ids:['r'+version],crypto_epoch:0,history_generation:version};}
      if(path==='current'&&method==='GET')return {snapshot:{schema_version:1,note:remote[body.local_id]},head_version:version,head_revision_id:'r'+version,inventory_revision_ids:['r'+version],crypto_epoch:0,replica_count:1};
      if(path==='revision'&&method==='GET')return {snapshot:{schema_version:1,note:{...note(body.local_id),content:'RESTORED'}}};
      if(path==='restore'&&method==='POST'){
        remote[body.local_id]={...note(body.local_id),content:'RESTORED'};version++;
        return {mutation_id:body.mutation_id,result_revision_id:'r'+version,result_head_version:version,result_inventory_revision_ids:['r'+version],crypto_epoch:0,history_generation:version};
      }
      throw Error('unexpected request');
    },
    select:async request=>{selectedReads.push(request.id);assert.equal(request.stamp,stamp);return {entry:structuredClone(root.contexts[account].notes[request.id]),stamp,revision:stamp};},
    saveNote:async request=>{assert.equal(request.revision,stamp);assert.deepEqual(request.expected,root.contexts[account].notes[request.id]);
      root.contexts[account].notes[request.id]=structuredClone(request.next);saved.push(request.id);stamp+='x';return {stamp,revision:stamp};},
    load:async()=>{fullReads++;return {value:root,stamp};},
    build:s=>NowNoteHistory.create({initial:s.value,context,write:async()=>{},request:async()=>{throw Error('network forbidden');}})});
  return {api,note,calls,pages,remote,fullReads:()=>fullReads,selectedReads,saved,root:()=>root,changeBinding:()=>{binding='other';},externalChange:()=>{stamp+='external';}};
}

test('readonly pagination keeps the journal deferred without selecting or writing a full entry',async()=>{
  const f=fixture(),page=await f.api.page('a');assert.equal(page.items[0].revision_id,'old');
  assert.equal(f.api.deferred(),true);assert.equal(f.fullReads(),0);assert.equal(f.selectedReads.length,0);assert.equal(f.saved.length,0);
  assert.equal(f.pages[0].stamp,'one');assert.equal(f.pages[0].account,account);
  assert.throws(()=>f.api.view('a'));
  const g=fixture(),late=g.api.page('a');g.changeBinding();await assert.rejects(late);assert.equal(g.pages.length,0);
});
test('first edit and sealing load only selected history, preserve the sibling and can later materialize the latest whole journal',async()=>{
  const f=fixture();await f.api.edit({...f.note('a'),content:'EDITED'});await f.api.seal('a');
  assert.equal(f.fullReads(),0);assert.deepEqual(f.selectedReads,['a','a']);assert.deepEqual(f.saved,['a','a']);
  assert.equal(f.api.deferred(),true);assert.equal(f.api.currentView('a').draft.content,'EDITED');assert.equal(f.api.currentView('b').draft.content,'current');
  assert.throws(()=>f.api.export(),/이력|먼저/);await f.api.ensure();
  assert.equal(f.fullReads(),1);assert.equal(f.api.export().contexts[account].notes.a.revisions.length,2);assert.equal(f.api.view('b').draft.content,'current');
});
test('online selected synchronization imports and publishes the same durable mutation without whole reads',async()=>{
  const f=fixture({online:true});await f.api.edit({...f.note('a'),content:'ONLINE_SELECTED'});await f.api.seal('a');
  await f.api.sync({onlyIds:['a']});assert.equal(f.fullReads(),0);assert.equal(f.remote.a.content,'ONLINE_SELECTED');
  assert.equal(f.api.currentView('a').pending,0);assert.equal(f.root().contexts[account].notes.a.receipts.length,1);
  assert.ok(f.calls.every(c=>c.id==='a'));assert.equal(f.remote.b.content,'current');
});
test('selected synchronization freezes the requested ID list before awaiting a network response',async()=>{
  const f=fixture({online:true}),ids=['a'],pending=f.api.sync({onlyIds:ids});ids.push('b');await pending;
  assert.ok(f.calls.every(call=>call.id==='a'),'a later caller mutation must not add another synchronization target');
});

test('default synchronization refreshes all normal documents without a whole journal read',async()=>{
  const f=fixture({online:true});f.remote.b.content='PEER_REFRESH';
  await f.api.edit({...f.note('a'),content:'DEFAULT_SELECTED'});await f.api.seal('a');
  await f.api.sync();
  assert.equal(f.fullReads(),0);assert.equal(f.api.deferred(),true);
  assert.equal(f.remote.a.content,'DEFAULT_SELECTED');assert.equal(f.api.currentView('b').draft.content,'PEER_REFRESH');
  assert.ok(f.calls.some(call=>call.id==='b'&&call.method==='GET'));
  assert.equal(f.api.syncSupported(),true);
});
test('stale selected reads latch failure without a fallback whole read or automatic retry',async()=>{
  const f=fixture();f.externalChange();await assert.rejects(f.api.edit({...f.note('a'),content:'stale'}));
  assert.equal(f.saved.length,0);assert.equal(f.fullReads(),0);assert.ok(f.api.failure());
  await assert.rejects(f.api.ensure());assert.equal(f.fullReads(),0);assert.equal(f.selectedReads.length,1);
});
test('materialization waits behind in-flight selected writes and retains their latest stamp',async()=>{
  const f=fixture(),edit=f.api.edit({...f.note('a'),content:'queued'}),whole=f.api.ensure();
  await Promise.all([edit,whole]);assert.equal(f.fullReads(),1);assert.equal(f.api.view('a').draft.content,'queued');
});
test('selection and multiple queued edits never lose their save points or cross accounts',async()=>{
  const f=fixture();await Promise.all([f.api.edit({...f.note('a'),content:'one'}),f.api.edit({...f.note('b'),content:'two'}),f.api.seal('a')]);
  assert.equal(f.fullReads(),0);assert.equal(f.root().contexts[account].notes.a.draft.content,'one');assert.equal(f.root().contexts[account].notes.b.draft.content,'two');
  f.changeBinding();await assert.rejects(f.api.edit({...f.note('a'),content:'FOREIGN'}));assert.equal(f.saved.length,3);
});

test('conflicted document edit, seal and comparison preserve conflict and sibling without whole reads',async()=>{
  const f=fixture({online:true,conflicted:true}),sibling=structuredClone(f.root().contexts[account].notes.b);
  assert.equal(f.api.status().conflicts,1);assert.equal(f.api.selectable('a'),true);
  await f.api.edit({...f.note('a'),content:'conflict draft'});await f.api.seal('a');
  const compared=await f.api.compare('a');
  assert.ok(compared.remote);assert.equal(f.fullReads(),0);
  assert.equal(f.api.status().conflicts,1);
  assert.equal(f.root().contexts[account].notes.a.draft.content,'conflict draft');
  assert.equal(f.root().contexts[account].notes.a.conflict.code,'version_conflict');
  assert.deepEqual(f.root().contexts[account].notes.b,sibling);
  const before=f.calls.length;await f.api.sync({onlyIds:['a']});
  assert.equal(f.calls.length,before);assert.equal(f.fullReads(),0);
});

test('explicit conflict restoration keeps archived requests and sibling history with only selected loads',async()=>{
  const f=fixture({online:true,conflicted:true}),sibling=structuredClone(f.root().contexts[account].notes.b);
  await f.api.edit({...f.note('a'),content:'offline conflict edit'});await f.api.seal('a');
  const originalRequests=structuredClone(f.root().contexts[account].notes.a.outbox);
  const comparison=await f.api.compare('a');
  const receipt=await f.api.restore('a',{kind:'note_revision',id:'r0'},comparison.remote);
  assert.ok(receipt);assert.equal(f.fullReads(),0);assert.equal(f.api.deferred(),true);
  const entry=f.root().contexts[account].notes.a;
  assert.equal(entry.conflict,null);assert.equal(entry.draft.content,'RESTORED');
  assert.deepEqual(entry.archived_outbox,originalRequests);
  assert.deepEqual(f.root().contexts[account].notes.b,sibling);
  assert.ok(f.calls.every(call=>call.id==='a'));
});

test('comparison with Wiki operation metadata retains the full validation boundary',async()=>{
  const f=fixture({online:true,conflicted:true,wikiMetadata:true});
  await assert.rejects(f.api.compare('a'),/network forbidden/);
  assert.equal(f.fullReads(),1);assert.equal(f.selectedReads.length,0);assert.equal(f.saved.length,0);
  assert.equal(f.root().contexts[account].wiki_ingest_operations.pending.state,'prepared');
});
