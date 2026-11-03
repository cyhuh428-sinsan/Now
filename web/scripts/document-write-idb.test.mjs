import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto as crypto} from 'node:crypto';
async function fixture({strict=true}={}){
  const box=vm.createContext({crypto,IDBKeyRange:{bound:(lower,upper)=>({lower,upper})}});
  vm.runInContext('globalThis.cloneJSON=raw=>JSON.parse(raw)',box);box.structuredClone=value=>box.cloneJSON(JSON.stringify(value));
  for(const name of ['document-parts.js','document-idb.js'])vm.runInContext(await fs.readFile(new URL('../vendor/'+name,import.meta.url),'utf8'),box);
  const original={notes:{a:{content:'old',history:[{body:'retained'}]},b:{content:'other'}},extra:true};
  let records=vm.runInContext('NowDocumentParts.encode('+JSON.stringify(original)+')',box),physical={format:2,stamp:'old',isNull:false,row:{schema_version:1}},finish,abort;
  const db={transaction(_stores,mode,options){
    assert.equal(mode,'readwrite');let candidate=new Map(records),metadata=structuredClone(physical),aborted=false;
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
