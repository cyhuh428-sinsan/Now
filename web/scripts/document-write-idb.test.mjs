import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto as crypto} from 'node:crypto';
async function fixture({strict=true,windowed=false,originalValue=null}={}){
  const box=vm.createContext({crypto,IDBKeyRange:{bound:(lower,upper)=>({lower,upper})}});
  vm.runInContext('globalThis.cloneJSON=raw=>JSON.parse(raw)',box);box.structuredClone=value=>box.cloneJSON(JSON.stringify(value));
  for(const name of ['document-parts.js',...(windowed?['journal-writes.js','journal-window.js']:[]),'document-idb.js'])vm.runInContext(await fs.readFile(new URL('../vendor/'+name,import.meta.url),'utf8'),box);
  const original=originalValue||{notes:{a:{content:'old',history:[{body:'retained'}]},b:{content:'other'}},extra:true};
  let records=vm.runInContext('NowDocumentParts.encode('+JSON.stringify(original)+')',box),physical={format:2,stamp:'old',isNull:false,row:{schema_version:1}},finish,abort;
  const db={transaction(_stores,mode,options){
    assert.ok(mode==='readwrite'||windowed&&mode==='readonly');let candidate=new Map(records),metadata=structuredClone(physical),aborted=false;
    const tx={durability:strict?options?.durability:'relaxed',abort(){aborted=true;queueMicrotask(()=>tx.onabort?.());}};
    abort=()=>tx.abort();finish=()=>{if(!aborted){records=candidate;physical=metadata;tx.oncomplete?.();}};
    const request=value=>{const r={};queueMicrotask(()=>{if(!aborted){r.result=structuredClone(value);r.onsuccess?.();}});return r;};
    tx.objectStore=name=>name==='journals'?{get:()=>request(metadata),put:value=>{metadata=structuredClone(value);}}:{
      get(key){return request(candidate.has(key[1])?{id:key[1],value:candidate.get(key[1])}:undefined);},
      getKey:key=>request(candidate.has(key[1])?key:undefined),
      getAllKeys:range=>request([...candidate.keys()].filter(id=>id.startsWith(range.lower[1])).map(id=>['history',id])),
      put(value,key){candidate.set(key[1],structuredClone(value.value));},delete:key=>candidate.delete(key[1]),
      getAll(){throw Error('Full scan forbidden');}};
    return tx;
  }};
  return {read:box.NowDocumentTransactions.create({database:async()=>db,key:'history'}),original,
    value:()=>JSON.parse(JSON.stringify(box.NowDocumentParts.decode(records))),parts:()=>records,
    finish:()=>finish(),abort:()=>abort(),turn:()=>new Promise(resolve=>setImmediate(resolve))};
}
test('scoped IDB writes preserve siblings/history, clone input and acknowledge only committed transaction',async()=>{
  const f=await fixture(),next={...f.original.notes.a,content:'new'};let settled=false;
  const pending=f.read.writePath(['notes','a'],f.original.notes.a,next).then(result=>{settled=true;return result;});next.content='mutated';
  await f.turn();assert.equal(settled,false);assert.deepEqual(f.value(),f.original);f.finish();
  assert.equal((await pending).projection,'path_write_v1');assert.equal(f.value().notes.a.content,'new');
  assert.equal(f.value().notes.a.history[0].body,'retained');assert.equal(f.value().notes.b.content,'other');
});
test('Window IDB read and atomic suffix write preserve old records and reject stale revisions',async()=>{
  const account=JSON.stringify(['https://qa.invalid','alice']),id='large',note={owner_id:'alice',local_id:id,note_type:'tree',source:'manual',content:'current'};
  const entry={raw:note,draft:structuredClone(note),base:{crypto_epoch:0,inventory_revision_ids:[]},revisions:[0,1,2].map(i=>({revision_id:'r'+i,imported:true,snapshot:{note:{...note,content:'old-'+i}}})),outbox:[],receipts:[{old:'receipt'}],completed_outbox:[{old:'completed'}]};
  const root={schema_version:1,contexts:{[account]:{notes:{[id]:entry}}}},f=await fixture({windowed:true,originalValue:root});
  const reading=f.read.readWindow({account,id,stamp:'old'});await f.turn();f.finish();const selected=await reading;
  assert.equal(selected.window.entry.revisions.length,1);assert.equal(selected.window.offsets.revisions,2);
  const next=structuredClone(selected.window.entry);next.draft.content='new';next.receipts.push({new:'receipt'});
  let completed=false;const request={account,id,expected:selected.window,next,revision:'old'};
  const writing=f.read.writeWindow(request).then(value=>{completed=true;return value;});await f.turn();assert.equal(completed,false);assert.deepEqual(f.value(),root);
  f.finish();const receipt=await writing;assert.notEqual(receipt.stamp,'old');const saved=f.value().contexts[account].notes[id];
  assert.deepEqual(saved.revisions,entry.revisions);assert.deepEqual(saved.completed_outbox,entry.completed_outbox);assert.deepEqual(saved.receipts,[...entry.receipts,{new:'receipt'}]);assert.equal(saved.draft.content,'new');
  await assert.rejects(f.read.writeWindow(request),/journal changed/i);
});
test('Window IDB abort or visible orphan never partially installs a draft',async()=>{
  const account=JSON.stringify(['https://qa.invalid','alice']),id='one',note={owner_id:'alice',local_id:id,note_type:'tree',source:'manual',content:'original'};
  const entry={raw:note,draft:note,base:{crypto_epoch:0,inventory_revision_ids:[]},revisions:[],outbox:[],receipts:[]};
  const root={schema_version:1,contexts:{[account]:{notes:{[id]:entry}}}};
  for(const orphan of [false,true]){
    const f=await fixture({windowed:true,originalValue:root}),reading=f.read.readWindow({account,id,stamp:'old'});await f.turn();f.finish();const selected=await reading;
    const next=structuredClone(selected.window.entry);next.draft.content='new';
    if(orphan)f.parts().set(JSON.stringify(['contexts',account,'notes',id,'unknown-orphan']),{value:'preserve'});
    const before=JSON.stringify([...f.parts()]),writing=assert.rejects(f.read.writeWindow({account,id,expected:selected.window,next,revision:'old'}));
    await f.turn();if(!orphan)f.abort();await writing;assert.equal(JSON.stringify([...f.parts()]),before);
  }
});
test('aborted scoped writes preserve the full original; orphan target parts fail before mutation',async()=>{
  const f=await fixture(),pending=assert.rejects(f.read.writePath(['notes','a'],f.original.notes.a,{content:'new'}));
  await f.turn();f.abort();await pending;assert.deepEqual(f.value(),f.original);
  const orphan=await fixture();orphan.parts().set('["notes","a","orphan"]',{type:'object',entries:[]});
  const before=JSON.stringify([...orphan.parts()]);await assert.rejects(orphan.read.writePath(['notes','a'],orphan.original.notes.a,{content:'new'}),/parts conflict/i);
  assert.equal(JSON.stringify([...orphan.parts()]),before);
});
test('relaxed durability is rejected without hanging; late account invalidation reports a committed outcome',async()=>{
  const relaxed=await fixture({strict:false});
  await Promise.race([assert.rejects(relaxed.read.writePath(['notes','a'],relaxed.original.notes.a,{}),/durability/i),
    new Promise((_,reject)=>setTimeout(()=>reject(Error('Missing transaction acknowledgement')),300))]);
  const f=await fixture();let active=true;
  const outcome=assert.rejects(f.read.writePath(['notes','a'],f.original.notes.a,{content:'committed'},{active:()=>active}),error=>error.committed===true);
  await f.turn();active=false;f.finish();await outcome;assert.equal(f.value().notes.a.content,'committed');
});
test('product revision guard rejects a stale whole journal even when its selected entry still matches',async()=>{
  const f=await fixture();await assert.rejects(f.read.writePath(['notes','a'],f.original.notes.a,{content:'new'},undefined,()=>{},{revision:'older'}),/journal changed/i);
  assert.deepEqual(f.value(),f.original);
});

test('settings guard reads root metadata only and waits for the exclusive transaction acknowledgement',async()=>{
  const root={schema_version:1,contexts:{alice:{notes:{large:{history:['preserved']}}}}},f=await fixture({windowed:true,originalValue:root});
  let writes=0,settled=false;
  const pending=f.read.settingsEffect('old',()=>writes++).then(result=>{settled=true;return result;});
  await f.turn();assert.equal(writes,1);assert.equal(settled,false);assert.deepEqual(f.value(),root);
  f.finish();assert.equal((await pending).projection,'settings_write_v1');assert.equal(settled,true);
  await assert.rejects(f.read.settingsEffect('stale',()=>writes++),/changed/);assert.equal(writes,1);
  const protectedStore=await fixture({windowed:true,originalValue:{...root,protection_operations:{}}});
  await assert.rejects(protectedStore.read.settingsEffect('old',()=>writes++),/Protection|metadata/);assert.equal(writes,1);
});

test('settings side effect followed by abort or account change is an uncertain failure, never a retry',async()=>{
  for(const abort of [true,false]){
    const f=await fixture({windowed:true,originalValue:{schema_version:1,contexts:{}}});let writes=0,active=true;
    const pending=assert.rejects(f.read.settingsEffect('old',()=>writes++,{active:()=>active}),error=>error.committed===true);
    await f.turn();assert.equal(writes,1);
    if(abort)f.abort();else{active=false;f.finish();}
    await pending;assert.equal(writes,1);
  }
});

test('new-note Window IDB insertion commits once, preserves siblings and refuses duplicates',async()=>{
  const account=JSON.stringify(['https://qa.invalid','alice']),root={schema_version:1,contexts:{[account]:{notes:{}}}};
  const f=await fixture({windowed:true,originalValue:root}),id='created';
  const note={owner_id:'alice',local_id:id,note_type:'tree',source:'manual',content:'created'};
  const entry={raw:note,draft:note,base:{crypto_epoch:0,inventory_revision_ids:[]},revisions:[],outbox:[],receipts:[],conflict:null,dirty:true,localOnly:true,needsBaseline:false,replicaSelected:true};
  const request={account,id,stamp:'old',next:entry},pending=f.read.createWindow(request);
  await f.turn();assert.deepEqual(f.value(),root);f.finish();const saved=await pending;
  assert.deepEqual(f.value().contexts[account].notes[id],entry);
  await assert.rejects(f.read.createWindow({...request,stamp:saved.stamp}));
  assert.deepEqual(f.value().contexts[account].notes[id],entry);
});
