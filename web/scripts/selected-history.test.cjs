const {test}=require('node:test'),assert=require('node:assert/strict');
globalThis.crypto=require('node:crypto').webcrypto;
require('../vendor/note-history-state.js');require('../vendor/journal-writes.js');
const {create}=require('../vendor/deferred-history.js');
const account=JSON.stringify(['https://qa.invalid','alice']);
function fixture(){
  let stamp='one',fullReads=0,selectedReads=[],saved=[],binding='one';
  const context=()=>({url:'https://qa.invalid',owner:'alice',auth:binding,device:'qa',enabled:true,online:false});
  const note=id=>({owner_id:'alice',local_id:id,note_type:'tree',source:'manual',title:id,content:'current',level:1});
  const entry=id=>({raw:note(id),draft:note(id),base:{crypto_epoch:0,inventory_revision_ids:[],head_revision_id:'r'},revisions:[{revision_id:'old',snapshot:{note:note(id)}}],outbox:[],receipts:[],localOnly:true,dirty:false});
  let root={schema_version:1,contexts:{[account]:{notes:{a:entry('a'),b:entry('b')}}}};
  const notes=Object.fromEntries(Object.entries(root.contexts[account].notes).map(([id,item])=>[id,{projection:'current_v1',raw:item.raw,draft:item.draft,base:{crypto_epoch:0,head_revision_id:'r'},localOnly:true,pending:0,dirty:false}]));
  const api=create({initial:{preview:{projection:'journal_current_v1',supported:true,account,stamp,notes}},context,contextKey:()=>binding,accountKey:()=>account,
    select:async request=>{selectedReads.push(request.id);assert.equal(request.stamp,stamp);return {entry:structuredClone(root.contexts[account].notes[request.id]),stamp,revision:stamp};},
    saveNote:async request=>{assert.equal(request.revision,stamp);assert.deepEqual(request.expected,root.contexts[account].notes[request.id]);
      root.contexts[account].notes[request.id]=structuredClone(request.next);saved.push(request.id);stamp+='x';return {stamp,revision:stamp};},
    load:async()=>{fullReads++;return {value:root,stamp};},
    build:s=>NowNoteHistory.create({initial:s.value,context,write:async()=>{},request:async()=>{throw Error('network forbidden');}})});
  return {api,note,fullReads:()=>fullReads,selectedReads,saved,root:()=>root,changeBinding:()=>{binding='other';},externalChange:()=>{stamp+='external';}};
}
test('first edit and sealing load only selected history, preserve the sibling and can later materialize the latest whole journal',async()=>{
  const f=fixture();await f.api.edit({...f.note('a'),content:'EDITED'});await f.api.seal('a');
  assert.equal(f.fullReads(),0);assert.deepEqual(f.selectedReads,['a','a']);assert.deepEqual(f.saved,['a','a']);
  assert.equal(f.api.deferred(),true);assert.equal(f.api.currentView('a').draft.content,'EDITED');assert.equal(f.api.currentView('b').draft.content,'current');
  assert.throws(()=>f.api.export(),/이력|먼저/);await f.api.ensure();
  assert.equal(f.fullReads(),1);assert.equal(f.api.export().contexts[account].notes.a.revisions.length,2);assert.equal(f.api.view('b').draft.content,'current');
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
