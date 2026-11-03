const {test}=require('node:test');
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
globalThis.crypto=webcrypto;
require('../vendor/note-history-state.js');
const deferred=require('../vendor/deferred-history.js');
const account=JSON.stringify(['https://qa.invalid','alice']);
function fixture(){
  let scope='alice:auth:device',loads=0,writes=0,ready=0,release=null,fail=false;
  const context=()=>({url:'https://qa.invalid',owner:'alice',auth:scope,device:'device',enabled:true,online:false});
  const note={local_id:'a',owner_id:'alice',note_type:'tree',title:'a',source:'manual',content:'current'};
  const root={schema_version:1,contexts:{[account]:{notes:{a:{raw:note,draft:note,base:{crypto_epoch:0,head_revision_id:'r',inventory_revision_ids:['r']},revisions:[{revision_id:'old',snapshot:{note:{...note,content:'OLD_PRIVATE_BODY'}}}],outbox:[],receipts:[],dirty:false,localOnly:true}}}}};
  const preview={projection:'journal_current_v1',supported:true,stamp:'one',account,notes:{a:{projection:'current_v1',raw:note,draft:note,base:{crypto_epoch:0,head_revision_id:'r'},pending:0,dirty:false,localOnly:true}}};
  const store=deferred.create({initial:{preview},context,contextKey:()=>scope,accountKey:()=>account,
    ready:()=>{ready++;},
    load:async()=>{loads++;if(release)await release;if(fail)throw Error('read_failed');return {value:root,stamp:'one'};},
    build:snapshot=>NowNoteHistory.create({initial:snapshot.value,context,request:async()=>{throw Error('network forbidden');},write:async()=>{writes++;}})});
  return {store,root,preview,note,loads:()=>loads,writes:()=>writes,ready:()=>ready,setScope:value=>{scope=value;},setFail:()=>{fail=true;},delay:()=>{let finish;release=new Promise(r=>{finish=r;});return finish;}};
}
test('startup projects current notes without opening full history; sync exports fail closed',async()=>{
  const f=fixture();assert.equal(f.store.deferred(),true);assert.equal(f.loads(),0);
  assert.equal(f.store.revision(),'one');
  assert.equal(f.store.currentView('a').draft.content,'current');assert.equal(f.store.currentEntries().a.projection,'current_v1');
  assert.equal(f.store.status().revisions,null);assert.equal(f.store.manages('a'),true);
  assert.throws(()=>f.store.export(),/이력|먼저/);assert.throws(()=>f.store.view('a'),/이력|먼저/);
  await f.store.idle();assert.equal(f.loads(),0);assert.equal(f.writes(),0);
});

test('readonly Wiki index exposes only IDs and expires with the deferred account scope',()=>{
  const f=fixture();f.store.reset({preview:{...f.preview,wikiIds:['wiki:synthetic']}});
  const index=f.store.wikiIndex();assert.deepEqual(index.ids,['wiki:synthetic']);assert.equal(index.stamp,'one');
  index.ids.push('mutated');assert.deepEqual(f.store.wikiIndex().ids,['wiki:synthetic']);
  assert.equal(f.loads(),0);f.setScope('bob');assert.equal(f.store.wikiIndex(),null);
  const g=fixture();g.store.reset({preview:{...g.preview,wikiIndexSupported:false}});assert.equal(g.store.wikiIndex(),null);
});

test('archive uses a fixed snapshot without materializing history and invalidates late account results',async()=>{
  const f=fixture(),blob=await f.store.archive(async({stamp,guard})=>{assert.equal(stamp,'one');assert.equal(guard.active(),true);return new Blob(['synthetic archive']);});
  assert.equal(await blob.text(),'synthetic archive');assert.equal(f.loads(),0);assert.equal(f.store.deferred(),true);
  const g=fixture();let release;const wait=new Promise(resolve=>{release=resolve;});
  const pending=g.store.archive(async()=>{await wait;return new Blob(['old account']);});await new Promise(resolve=>setImmediate(resolve));
  g.setScope('bob');release();await assert.rejects(pending);assert.equal(g.loads(),0);
});

test('explicit Wiki metadata preparation is read-only, stamp-bound and invalidated by account changes',async()=>{
  const f=fixture();f.store.reset({preview:{...f.preview,wikiIndexSupported:false,wikiIndexMetadata:['wiki_lifecycle'],wikiIds:['wiki:test']}});
  assert.equal(typeof f.store.prepareWikiIndex,'function');
  assert.equal(await f.store.prepareWikiIndex(async({stamp,account:bound,metadata,guard})=>{assert.equal(stamp,'one');assert.equal(bound,account);assert.deepEqual(metadata,['wiki_lifecycle']);assert.equal(guard.active(),true);return {lifecycle:{'wiki:test':{pending:null}}};}),true);
  assert.equal(f.loads(),0);assert.equal(f.writes(),0);assert.deepEqual(f.store.wikiIndex().lifecycle,{'wiki:test':{pending:null}});
  const g=fixture();g.store.reset({preview:{...g.preview,wikiIndexSupported:false,wikiIndexMetadata:['wiki_ingest_operations']}});
  assert.equal(await g.store.prepareWikiIndex(async()=>null),false);assert.equal(g.store.wikiIndex(),null);assert.equal(g.loads(),0);
  let release;const gate=new Promise(r=>{release=r;}),h=fixture();h.store.reset({preview:{...h.preview,wikiIndexSupported:false,wikiIndexMetadata:['wiki_lifecycle']}});
  const pending=h.store.prepareWikiIndex(async()=>{await gate;return {lifecycle:{}};});await new Promise(r=>setImmediate(r));h.setScope('bob');release();await assert.rejects(pending);assert.equal(h.store.wikiIndex(),null);assert.equal(h.loads(),0);
});
test('first edit materializes once and preserves unread history before writing',async()=>{
  const f=fixture();await f.store.edit({...f.note,content:'edited'});assert.equal(f.loads(),1);assert.equal(f.writes(),1);assert.equal(f.ready(),1);
  assert.equal(f.store.deferred(),false);assert.equal(f.store.view('a').revisions[0].snapshot.note.content,'OLD_PRIVATE_BODY');
  await f.store.seal('a');assert.equal(f.loads(),1);assert.equal(f.store.export().contexts[account].notes.a.revisions.length,2);
  f.setScope('bob');assert.deepEqual(f.store.currentEntries(),{});assert.equal(f.store.currentView('a'),null);assert.equal(f.store.status().unsupported,true);
});
test('damaged deferred history never releases the bootstrap normalization/write gate',async()=>{
  const f=fixture();f.root.contexts[account].notes.a.revisions[0]={broken:true};
  await assert.rejects(f.store.ensure(),/이력|보존/);assert.equal(f.ready(),0);assert.equal(f.writes(),0);
});
test('account change, late completion and uncertain reads never install or retry a full store',async()=>{
  const f=fixture(),release=f.delay(),pending=f.store.ensure();f.setScope('bob');release();await assert.rejects(pending,/계정|변경/);
  assert.deepEqual(f.store.currentEntries(),{});assert.equal(f.store.blocked('a'),true);assert.equal(f.writes(),0);
  const failed=fixture();failed.setFail();await assert.rejects(failed.store.ensure(),/read_failed/);
  await assert.rejects(failed.store.edit({...failed.note,content:'must not write'}));assert.equal(failed.loads(),1);assert.equal(failed.writes(),0);
});
test('stale preview stamp refuses edits; explicit reset invalidates old pending hydration',async()=>{
  const f=fixture();f.store.reset({preview:{...f.preview,stamp:'stale'}});await assert.rejects(f.store.edit({...f.note,content:'stale'}),/変更|변경|다시/);
  assert.equal(f.writes(),0);assert.ok(f.store.failure());
  const g=fixture(),release=g.delay(),pending=g.store.ensure();g.store.suspend();g.store.reset({preview:g.preview});release();
  await assert.rejects(pending,/계정|변경/);assert.equal(g.store.deferred(),true);assert.equal(g.writes(),0);
});
