const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {webcrypto}=require('node:crypto');
test('real edits and sealing use the note callback without cloning unrelated history',async()=>{
  let prohibit=false,full=0;const notes=[];
  const box=vm.createContext({crypto:webcrypto,structuredClone:value=>{if(prohibit&&JSON.stringify(value).includes('UNRELATED_HISTORY'))throw Error('Whole journal clone');return structuredClone(value);}});
  vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../vendor/note-history-state.js'),'utf8'),box);
  const ctx={url:'https://qa.invalid',owner:'alice',auth:'synthetic',device:'one',enabled:true,online:false},account=JSON.stringify([ctx.url,ctx.owner]);
  const note=id=>({owner_id:'alice',local_id:id,note_type:'tree',content:'old',source:'manual'});
  const entry=id=>({raw:note(id),draft:note(id),base:{crypto_epoch:0,inventory_revision_ids:[],head_revision_id:'head'},revisions:[],outbox:[],receipts:[],localOnly:true});
  const initial={schema_version:1,contexts:{[account]:{notes:{a:entry('a'),b:entry('b')}}}};
  initial.contexts[account].notes.b.revisions=[{snapshot:{note:{content:'UNRELATED_HISTORY'}}}];
  const h=box.NowNoteHistory.create({initial,context:()=>ctx,write:async()=>{full++;},writeNote:async(c,id,value,guard)=>{assert.equal(guard.active(),true);notes.push({id,value});}});
  prohibit=true;await h.edit({...note('a'),content:'edited'});await h.seal('a');
  assert.equal(full,0);assert.equal(notes.length,2);assert.equal(notes[0].id,'a');assert.equal(notes[1].value.revisions.length,1);
  assert.equal(notes[0].value.revisions.length,0,'queued snapshots retain their exact save point');
});
