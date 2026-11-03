const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
function fixture(){
  let rejectHistory=false;
  const box=vm.createContext({crypto:webcrypto,structuredClone:value=>{
    if(rejectHistory&&JSON.stringify(value).includes('DO_NOT_COPY_HISTORY'))throw Error('Full history was copied');
    return structuredClone(value);
  }});
  vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../vendor/note-history-state.js'),'utf8'),box);
  const ctx={url:'local://qa',owner:'A',device:'one',auth:'local',enabled:true};
  const key=JSON.stringify([ctx.url,ctx.owner]),note=id=>({owner_id:'A',local_id:id,content:'current '+id,title:id,note_type:'tree',level:1});
  const entry=id=>({raw:note(id),draft:note(id),base:{head_revision_id:'head',crypto_epoch:0,inventory_revision_ids:[],snapshot:{note:{content:'DO_NOT_COPY_HISTORY'}}},
    revisions:[{snapshot:{note:{content:'DO_NOT_COPY_HISTORY'}}}],outbox:[{body:{content:'DO_NOT_COPY_HISTORY'}}],receipts:[],dirty:true,localOnly:false});
  const wiki='wiki:11111111-1111-4111-8111-111111111111';
  const initial={schema_version:1,contexts:{[key]:{notes:{one:entry('one'),[wiki]:entry(wiki)}},other:{notes:{foreign:entry('foreign')}}}};
  const journal=box.NowNoteHistory.create({initial,context:()=>ctx,write:async()=>{},request:async()=>{}});
  rejectHistory=true;return {journal,ctx,wiki};
}
test('current view and note IDs never copy revision, outbox bodies, base snapshots or foreign accounts',()=>{
  const {journal,wiki}=fixture();
  const value=journal.currentView('one');
  assert.equal(value.draft.content,'current one');assert.equal(value.pending,1);assert.equal(value.base.head_revision_id,'head');
  assert.equal(value.revisions,undefined);assert.equal(value.base.snapshot,undefined);assert.equal(value.outbox,undefined);
  assert.deepEqual(Array.from(journal.entryIds()),['one',wiki]);
  assert.deepEqual(Object.keys(journal.currentEntries({excludeWiki:true})),['one']);
  assert.equal(journal.currentView('foreign'),null);
  assert.throws(()=>journal.view('one'),/Full history/);
});
test('current projection is detached and disabled accounts cannot access it',()=>{
  const {journal,ctx}=fixture();const value=journal.currentView('one');value.draft.content='must not write';
  assert.equal(journal.currentView('one').draft.content,'current one');
  ctx.enabled=false;assert.equal(journal.currentView('one'),null);assert.equal(Object.keys(journal.currentEntries()).length,0);assert.equal(journal.entryIds().length,0);
});
