import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto as crypto} from 'node:crypto';

async function fixture(){
  const box=vm.createContext({structuredClone,crypto,IDBKeyRange:{bound:(lower,upper)=>({lower,upper})}});
  for(const name of ['document-parts.js','document-idb.js'])vm.runInContext(await fs.readFile(new URL('../vendor/'+name,import.meta.url),'utf8'),box);
  const value={contexts:{A:{notes:{one:{draft:{content:'current'},revisions:[{body:'old'}]},two:{body:'other'}}},B:{body:'foreign'}}};
  const parts=vm.runInContext('NowDocumentParts.encode('+JSON.stringify(value)+')',box),ids=[],physical={format:2,stamp:'one',isNull:false,row:{schema_version:1,legacy_hash:'synthetic',redo:[]}};
  let complete,aborted=false,header=physical;
  const db={transaction(stores,mode){
    assert.equal(mode,'readonly');assert.deepEqual(Array.from(stores),['journals','documents']);
    const tx={abort(){aborted=true;queueMicrotask(()=>tx.onabort?.());}};
    complete=()=>tx.oncomplete?.();
    const request=value=>{const r={};queueMicrotask(()=>{if(aborted)return;r.result=structuredClone(value);r.onsuccess?.();});return r;};
    tx.objectStore=name=>name==='journals'?{get:()=>request(header)}:{count:()=>request(parts.size),get(key){assert.equal(key[0],'history');ids.push(key[1]);return request(parts.has(key[1])?{id:key[1],value:parts.get(key[1])}:undefined);},getAll(){throw Error('Whole document scan forbidden');}};
    return tx;
  }};
  const read=box.NowDocumentTransactions.create({database:async()=>db,key:'history'});
  return {read,parts,physical,ids,removeMetadata:()=>{header=undefined;},finish:()=>complete(),turn:()=>new Promise(resolve=>setImmediate(resolve))};
}
test('IDB selective read requests exact parts and acknowledges only transaction completion',async()=>{
  const f=await fixture();let settled=false;
  const promise=f.read.readPath(['contexts','A','notes','one','draft']).then(value=>{settled=true;return value;});
  await f.turn();assert.equal(settled,false);assert.ok(f.ids.length>0);assert.ok(f.ids.every(id=>!id.includes('revisions')&&!id.includes('two')&&!id.includes('"B"')));
  f.finish();const result=await promise;assert.equal(result.projection,'path_v1');assert.equal(result.value.content,'current');assert.equal(result.stamp,'one');
});
test('IDB selective read rejects missing parts, legacy format and late account invalidation',async()=>{
  const missing=await fixture();missing.parts.delete('["contexts","A","notes","one","draft"]');
  await assert.rejects(missing.read.readPath(['contexts','A','notes','one','draft']),/part/i);
  const old=await fixture();old.physical.format=1;await assert.rejects(old.read.readPath([]),/journal/i);
  const late=await fixture();let active=true;const pending=late.read.readPath(['contexts','A'],{active:()=>active});
  await late.turn();active=false;late.finish();await assert.rejects(pending,/authentication/i);
});
test('missing journal metadata cannot hide existing document parts as an empty store',async()=>{
  const orphan=await fixture();orphan.removeMetadata();const missing=assert.rejects(orphan.read.readPath([]),/journal/i);await orphan.turn();orphan.finish();await missing;
  const empty=await fixture();empty.removeMetadata();empty.parts.clear();const pending=empty.read.readPath([]);await empty.turn();empty.finish();
  assert.equal((await pending).found,false);
});
test('null journal marker must not return non-null object parts',async()=>{
  const f=await fixture();f.physical.isNull=true;
  const pending=assert.rejects(f.read.readPath(['contexts','A']),/null/i);await f.turn();f.finish();await pending;
  const wrong=await fixture();wrong.physical.isNull=true;wrong.parts.clear();wrong.parts.set('$root',{ref:'[]'});
  const rejected=assert.rejects(wrong.read.readPath([]),/null/i);await wrong.turn();wrong.finish();await rejected;
  const valid=await fixture();valid.physical.isNull=true;valid.parts.clear();valid.parts.set('$root',{value:null});
  const read=valid.read.readPath([]);await valid.turn();valid.finish();assert.equal((await read).value,null);
});
