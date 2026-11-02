import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto as crypto,createHash} from 'node:crypto';

async function fixture(){
  let raw=null,metadata={schema_version:1,legacy_hash:createHash('sha256').update(JSON.stringify(raw)).digest('hex'),redo:[]},after;
  const localStorage={get length(){return raw===null?0:1;},key:()=>raw===null?null:'synthetic',getItem(){throw Error('Selective reads must not read retained bodies');},setItem(){throw Error('Selective reads must not write retained copies');}};
  const transaction=()=>{throw Error('Selective reads must not load the full journal');};
  transaction.readPath=async(_path,_guard,check)=>{check(metadata);after?.();return {projection:'path_v1',stamp:'one',found:true,value:{current:'only'}};};
  transaction.writePath=async(_path,_expected,_next,_guard,check)=>{check(metadata);after?.();return {projection:'path_write_v1',stamp:'two',partsWritten:1};};
  const box=vm.createContext({crypto,TextEncoder,structuredClone,NowDocumentTransactions:{create:()=>transaction}});
  vm.runInContext(await fs.readFile(new URL('../vendor/browser-history-storage.js',import.meta.url),'utf8'),box);
  const storage=box.NowBrowserHistoryStorage.create({indexedDB:{},localStorage,lock:fn=>fn(),key:'synthetic'});
  return {storage,metadata,setRaw:value=>{raw=value;},setMetadata:value=>{metadata=value;},after:fn=>{after=fn;}};
}
test('browser path guard validates retained copy binding without full loading or writes',async()=>{
  const f=await fixture();assert.equal((await f.storage.readPath(['contexts'])).value.current,'only');
  f.metadata.legacy_hash='0'.repeat(64);await assert.rejects(f.storage.readPath([]));
  f.setMetadata(undefined);f.setRaw('retained');await assert.rejects(f.storage.readPath([]));f.setRaw(null);
  assert.equal((await f.storage.readPath([])).projection,'path_v1');
});
test('retained legacy presence is detected without reading its body and selective reads remain gated',async()=>{
  const f=await fixture();f.setRaw('PRIVATE_FOREIGN_HISTORY');await assert.rejects(f.storage.readPath([]),/보존|원본/);
});
test('browser path guard rejects hidden full values and late retained-copy/account changes',async()=>{
  const extra=await fixture();extra.metadata.value='UNEXPECTED_PLAINTEXT';await assert.rejects(extra.storage.readPath([]));
  const changed=await fixture();changed.after(()=>changed.setRaw('changed'));await assert.rejects(changed.storage.readPath([]));
  const account=await fixture();let active=true;account.after(()=>{active=false;});
  await assert.rejects(account.storage.readPath([],{active:()=>active}));
});
test('scoped writes retain the legacy gate and report uncertainty if the guard changes after commit',async()=>{
  const legacy=await fixture();legacy.setRaw('retained body');await assert.rejects(legacy.storage.writePath(['notes','a'],{},{}),/원본|보존/);
  const f=await fixture();f.after(()=>f.setRaw('retained appeared'));
  await assert.rejects(f.storage.writePath(['notes','a'],{},{}),error=>error.committed===true);
});
