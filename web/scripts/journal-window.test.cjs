const {test}=require('node:test'),assert=require('node:assert/strict');
const parts=require('../vendor/document-parts.js'),windowed=require('../vendor/journal-window.js');
const account=JSON.stringify(['https://qa.invalid','alice']),id='large-clean';
function fixture(){
 const note={owner_id:'alice',local_id:id,note_type:'tree',source:'manual',title:'Synthetic',content:'current',level:1};
 const entry={raw:note,draft:structuredClone(note),base:{crypto_epoch:0,head_revision_id:'r4',inventory_revision_ids:[]},dirty:false,localOnly:false,needsBaseline:false,replicaSelected:true,
  revisions:Array.from({length:5},(_,index)=>({revision_id:'r'+index,imported:true,snapshot:{schema_version:1,note:{...note,content:'old-'+index+'x'.repeat(8192)}},import_request:{entries:[{snapshot:{note:{...note,content:'request-'+index}}}]}})),
  outbox:[],receipts:[{completed:'receipt'}],completed_outbox:[{completed:'request'}],archived_outbox:[{preserve:'archive'}],conflict:null};
 const root={schema_version:1,contexts:{[account]:{notes:{[id]:entry}}}},stored=parts.encode(root),reads=[];
 function run(steps,deny=()=>false){let next=steps.next();while(!next.done){reads.push(next.value);if(deny(next.value))throw Error('Forbidden old payload read');next=steps.next(stored.get(next.value));}return next.value;}
 return {root,stored,reads,entry,run,apply(plan){for(const change of plan.changes)change.remove?stored.delete(change.id):stored.set(change.id,change.value);return parts.decode(stored);}};
}
test('clean window reads only last revision and leaves completed historical payloads unopened',()=>{
 const f=fixture(),view=f.run(windowed.readSteps({account,id}));
 assert.equal(view.projection,'journal_window_v1');assert.equal(view.offsets.revisions,4);
 assert.equal(view.entry.revisions.length,1);assert.equal(view.entry.revisions[0].revision_id,'r4');
 assert.deepEqual(view.entry.receipts,[]);assert.deepEqual(view.entry.completed_outbox,[]);assert.deepEqual(view.entry.archived_outbox,[]);
 const opened=f.reads.map(key=>{try{return JSON.parse(key);}catch{return [];}});
 assert.ok(!opened.some(path=>path[4]==='revisions'&&Number(path[5])<4&&path.length>6));
 assert.ok(!opened.some(path=>['receipts','completed_outbox','archived_outbox'].includes(path[4])&&path.length>5));
});
test('atomic window patch edits current content and appends records without replacing any retained prefix',()=>{
 const f=fixture(),view=f.run(windowed.readSteps({account,id})),next=structuredClone(view.entry);
 next.draft.content='new Korean draft';next.dirty=true;
 next.revisions.push({revision_id:'r5',imported:false,snapshot:{note:structuredClone(next.draft)}});
 next.receipts.push({new:'receipt'});next.completed_outbox.push({new:'completed'});
 const prefix=JSON.stringify(['contexts',account,'notes',id,'revisions','0','snapshot']);
 const original=f.stored.get(prefix),plan=f.run(windowed.writeSteps({account,id,expected:view,next})),restored=f.apply(plan).contexts[account].notes[id];
 assert.equal(f.stored.get(prefix),original);assert.equal(restored.revisions.length,6);assert.equal(restored.draft.content,next.draft.content);
 assert.deepEqual(restored.revisions.slice(0,5),f.entry.revisions);
 assert.deepEqual(restored.receipts,[...f.entry.receipts,...next.receipts]);
 assert.deepEqual(restored.completed_outbox,[...f.entry.completed_outbox,...next.completed_outbox]);
 assert.deepEqual(restored.archived_outbox,f.entry.archived_outbox);
 const reopened=f.run(windowed.readSteps({account,id,offsets:view.offsets}));assert.deepEqual(reopened.entry,next);
});
test('unimported suffix stays available and malformed offsets or stale visible baselines fail closed',()=>{
 const f=fixture();f.entry.revisions[2].imported=false;f.stored=parts.encode(f.root);
 // Build a fresh reader over the changed fixture rather than mutating an issued baseline.
 const stored=f.stored,run=steps=>{let step=steps.next();while(!step.done)step=steps.next(stored.get(step.value));return step.value;};
 const view=run(windowed.readSteps({account,id}));assert.equal(view.offsets.revisions,2);assert.equal(view.entry.revisions.length,3);
 assert.throws(()=>run(windowed.readSteps({account,id,offsets:{...view.offsets,revisions:3}})));
 const stale=structuredClone(view);stale.entry.draft.content='different';
 assert.throws(()=>run(windowed.writeSteps({account,id,expected:stale,next:view.entry})));
});
test('removing retained suffix records cannot erase or renumber historical revisions',()=>{
 const f=fixture(),view=f.run(windowed.readSteps({account,id})),next=structuredClone(view.entry);next.revisions=[];
 assert.throws(()=>f.run(windowed.writeSteps({account,id,expected:view,next})));
 assert.deepEqual(parts.decode(f.stored),f.root);
});
test('a window cannot change owner, introduce protection, or rewrite an immutable revision snapshot',()=>{
 for(const mutate of [entry=>{entry.draft.owner_id='other';},entry=>{entry.base.crypto_epoch=1;},entry=>{entry.revisions[0].snapshot.note.content='tampered';}]){
  const f=fixture(),view=f.run(windowed.readSteps({account,id})),next=structuredClone(view.entry);mutate(next);
  assert.throws(()=>f.run(windowed.writeSteps({account,id,expected:view,next})));assert.deepEqual(parts.decode(f.stored),f.root);
 }
});
test('active outbox consumption preserves completed prefix and issues a new visible suffix',()=>{
 const f=fixture();f.entry.outbox.push({id:'pending-mutation',body:{mutation_id:'fixed',note:{content:'queued'}}});
 const stored=parts.encode(f.root),run=steps=>{let step=steps.next();while(!step.done)step=steps.next(stored.get(step.value));return step.value;};
 const view=run(windowed.readSteps({account,id})),next=structuredClone(view.entry);next.completed_outbox.push(next.outbox.shift());
 const plan=run(windowed.writeSteps({account,id,expected:view,next}));for(const change of plan.changes)change.remove?stored.delete(change.id):stored.set(change.id,change.value);
 const result=parts.decode(stored).contexts[account].notes[id];assert.deepEqual(result.outbox,[]);
 assert.deepEqual(result.completed_outbox,[...f.entry.completed_outbox,...f.entry.outbox]);assert.deepEqual(result.receipts,f.entry.receipts);
});
test('discarding a queued mutation or changing a sent body/import request is refused',()=>{
 const f=fixture();f.entry.outbox=[{id:'fixed',revision_id:'r4',operation:'put',sent:true,body:{mutation_id:'immutable',note:{content:'queued'}}}];
 const stored=parts.encode(f.root),run=steps=>{let step=steps.next();while(!step.done)step=steps.next(stored.get(step.value));return step.value;};
 const view=run(windowed.readSteps({account,id}));
 for(const mutate of [entry=>{entry.outbox=[];},entry=>{entry.outbox[0].body.note.content='changed';},entry=>{entry.revisions[0].import_request={changed:true};}]){
  const next=structuredClone(view.entry);mutate(next);assert.throws(()=>run(windowed.writeSteps({account,id,expected:view,next})));
 }
 assert.deepEqual(parts.decode(stored),f.root);
});
