const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=path.resolve(__dirname,'../vendor/history-snapshot.js');
function runtime(){const box=vm.createContext({structuredClone});vm.runInContext(fs.readFileSync(source,'utf8'),box);return box;}
test('queued snapshots stay immutable while unchanged notes/history share their previous snapshots',()=>{
  const box=runtime();
  vm.runInContext(`
    const capture=NowHistorySnapshots.create();
    const data={contexts:{A:{notes:{one:{draft:{content:'one'},revisions:[{content:'old'}]},two:{draft:{content:'two'}}}}}};
    const first=capture.capture(data);data.contexts.A.notes.one.draft.content='changed';const second=capture.capture(data);
    globalThis.result={old:first.contexts.A.notes.one.draft.content,next:second.contexts.A.notes.one.draft.content,
      shared:second.contexts.A.notes.two===first.contexts.A.notes.two,
      history:second.contexts.A.notes.one.revisions===first.contexts.A.notes.one.revisions,
      frozen:Object.isFrozen(second.contexts.A.notes.one.draft),created:capture.stats().created};
  `,box);
  assert.deepEqual(JSON.parse(JSON.stringify(box.result)),{old:'one',next:'changed',shared:true,history:true,frozen:true,created:6});
});
test('snapshot preserves JSON-compatible undefined, sparse arrays and hostile keys without mutating the source',()=>{
  const box=runtime();vm.runInContext(`
    const input=JSON.parse('{"__proto__":{"kept":true},"array":[1,null]}');input.omitted=undefined;input.array.length=4;
    const capture=NowHistorySnapshots.create(),value=capture.capture(input);
    globalThis.result={own:Object.hasOwn(value,'__proto__'),proto:Object.getPrototypeOf(value)===Object.prototype,
      undefinedOwn:Object.hasOwn(value,'omitted'),hole:!(3 in value.array),length:value.array.length,rawFrozen:Object.isFrozen(input)};
  `,box);
  assert.deepEqual(JSON.parse(JSON.stringify(box.result)),{own:true,proto:true,undefinedOwn:true,hole:true,length:4,rawFrozen:false});
});
test('production journal queues distinct immutable edits without cloning the unrelated note again',async()=>{
  const box=runtime();box.crypto=webcrypto;
  vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../vendor/note-history-state.js'),'utf8'),box);
  await vm.runInContext(`(async()=>{
    globalThis.saved=[];
    const ctx={enabled:true,owner:'A',url:'local://qa',device:'one',auth:'local'};
    const journal=NowNoteHistory.create({initial:null,context:()=>ctx,request:async()=>{},write:async value=>{saved.push(value);}});
    const note=id=>({owner_id:'A',local_id:id,note_type:'tree',title:id,content:id,level:1});
    await journal.track(note('one'),null,{localOnly:true});await journal.track(note('two'),null,{localOnly:true});
    await Promise.all([journal.edit({...note('one'),content:'first edit'}),journal.edit({...note('one'),content:'second edit'})]);
  })()`,box);
  const snapshots=box.saved,account=JSON.stringify(['local://qa','A']);
  assert.equal(snapshots[2].contexts[account].notes.one.draft.content,'first edit');
  assert.equal(snapshots[3].contexts[account].notes.one.draft.content,'second edit');
  assert.equal(snapshots[2].contexts[account].notes.two,snapshots[3].contexts[account].notes.two);
  assert.equal(Object.isFrozen(snapshots[3]),true);
});
