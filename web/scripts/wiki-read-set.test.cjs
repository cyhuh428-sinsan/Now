const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
globalThis.crypto=require('node:crypto').webcrypto;require('../vendor/note-history-state.js');
const parts=require('../vendor/document-parts.js'),file=path.resolve(__dirname,'../vendor/wiki-read-set.js');
const account=JSON.stringify(['https://qa.invalid','alice']),wiki='wiki:00000000-0000-4000-8000-000000000241';
function fixture(){
  assert.ok(fs.existsSync(file),'Wiki detail requires an explicit readonly selected-document set');require(file);
  const note=id=>({owner_id:'alice',local_id:id,note_type:'tree',source:id.startsWith('wiki:')?'wiki-artifact':'manual',content:'current '+id});
  const entry=id=>({raw:{...note(id),user_extra:{keep:true}},draft:note(id),base:{crypto_epoch:0,inventory_revision_ids:[]},revisions:[{snapshot:{note:{...note(id),content:'history '+id}}}],outbox:[],receipts:[]});
  const root={schema_version:1,contexts:{[account]:{notes:{a:entry('a'),[wiki]:entry(wiki),unrelated:entry('unrelated')},wiki_lifecycle:{},wiki_ingest_operations:{op:{operation_id:'op',hash:'preserve'}}}}};
  let stamp='one',active=true,release=null;const reads=[],encoded=parts.encode(root);
  const drive=(steps)=>{let step=steps.next();while(!step.done){reads.push(step.value);assert.ok(!step.value.includes('"unrelated","revisions"'),'unrelated history cannot be read');step=steps.next(encoded.get(step.value));}return step.value;};
  const api={stamp:'one',account,guard:{active:()=>active},current:async()=>({...drive(parts.currentSteps(account)),stamp}),
    directory:async p=>({...drive(parts.selectSteps(p,true)),projection:'path_v1',stamp}),
    read:async p=>{const result={...drive(parts.selectSteps(p)),projection:'path_v1',stamp};if(release)await release;return result;}};
  return {api,reads,encoded,open:()=>NowWikiReadSet.open(api),change:()=>{stamp='changed';},lock:()=>{active=false;},delay:()=>{let done;release=new Promise(r=>{done=r;});return done;}};
}
test('detail read set binds exact IDs and reads only requested documents/metadata without an export or writer',async()=>{
  const f=fixture(),set=await f.open();assert.equal(set.projection,'wiki_readset_v1');assert.equal(set.export,undefined);assert.equal(set.write,undefined);
  assert.deepEqual(await set.ids(),['a',wiki,'unrelated']);
  const selected=await set.entry(wiki);assert.equal(selected.projection,'wiki_entry_v1');assert.equal(selected.found,true);assert.equal(selected.value.raw.user_extra.keep,true);
  assert.equal(selected.value.revisions[0].snapshot.note.content,'history '+wiki);selected.value.draft.content='mutated';assert.notEqual((await set.entry(wiki)).value.draft.content,'mutated');
  assert.deepEqual(await set.operationIds(),['op']);assert.equal((await set.operation('op')).value.hash,'preserve');assert.deepEqual(await set.lifecycle(),{});
  assert.equal((await set.entry('absent')).found,false);set.close();await assert.rejects(set.entry(wiki));
});
test('changed storage or late account completion discards the set without retrying a whole journal',async()=>{
  const f=fixture(),set=await f.open();await set.entry(wiki);f.change();await assert.rejects(set.entry(wiki));await assert.rejects(set.ids());
  const g=fixture(),late=await g.open(),release=g.delay(),pending=late.entry(wiki);await new Promise(r=>setImmediate(r));g.lock();release();await assert.rejects(pending);await assert.rejects(late.entry(wiki));
});
test('unsupported roots stay explicit and a missing or foreign requested entry never becomes an absent success',async()=>{
  const f=fixture();f.api.current=async()=>({projection:'journal_current_v1',supported:false});assert.equal(await f.open(),null);
  const g=fixture(),set=await g.open();g.encoded.delete(JSON.stringify(['contexts',account,'notes',wiki,'raw']));await assert.rejects(set.entry(wiki));
  const h=fixture(),bound=await h.open();h.encoded.get(JSON.stringify(['contexts',account,'notes',wiki,'draft'])).entries.find(([key])=>key==='owner_id')[1].value='bob';await assert.rejects(bound.entry(wiki));
});

test('existing Wiki validators accept a selection only through its explicit readonly snapshot contract',()=>{
  fixture();const data={schema_version:1,contexts:{[account]:{notes:{}}}},history={readOnlySnapshot:()=>({projection:'wiki_readset_v1',stamp:'one',account,data})};
  assert.equal(typeof NowWikiReadSet.root,'function');assert.equal(NowWikiReadSet.root(history,account),data);
  assert.throws(()=>NowWikiReadSet.root(history,JSON.stringify(['https://qa.invalid','bob'])));
  assert.throws(()=>NowWikiReadSet.root({export:()=>data},account));
});
