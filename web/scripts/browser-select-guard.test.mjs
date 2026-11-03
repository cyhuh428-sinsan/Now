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
  transaction.readCurrent=async(account,_guard,check)=>{check(metadata);after?.();return {projection:'journal_current_v1',supported:true,account,notes:{}};};
  transaction.writePath=async(_path,_expected,_next,_guard,check)=>{check(metadata);after?.();return {projection:'path_write_v1',stamp:'two',partsWritten:1};};
  const box=vm.createContext({crypto,TextEncoder,structuredClone,NowDocumentTransactions:{create:()=>transaction}});
  vm.runInContext(await fs.readFile(new URL('../vendor/journal-writes.js',import.meta.url),'utf8'),box);
  vm.runInContext(await fs.readFile(new URL('../vendor/browser-history-storage.js',import.meta.url),'utf8'),box);
  const db={close(){},transaction(){
    const tx={};let pending=0;
    const request=()=>{const r={};pending++;queueMicrotask(()=>{r.result=undefined;r.onsuccess?.();if(!--pending)queueMicrotask(()=>tx.oncomplete?.());});return r;};
    tx.objectStore=()=>({get:request,getKey:request});return tx;
  }};
  const indexedDB={open(){const r={};queueMicrotask(()=>{r.result=db;r.onsuccess?.();});return r;}};
  const storage=box.NowBrowserHistoryStorage.create({indexedDB,localStorage,lock:fn=>fn(),key:'synthetic'});
  return {transaction,storage,metadata,setRaw:value=>{raw=value;},setMetadata:value=>{metadata=value;},after:fn=>{after=fn;}};
}
test('browser selected history combines current proof with exact path and rejects a different stamp',async()=>{
  let pathCalls=0;
  const account=JSON.stringify(['https://qa.invalid','alice']),note={local_id:'a',owner_id:'alice',note_type:'tree',source:'manual',content:'current'};
  const entry={raw:note,draft:note,base:{crypto_epoch:0},revisions:[],outbox:[],receipts:[]};
  const f=await fixture();
  f.transaction.readCurrent=async()=>({supported:true,stamp:'one',account,notes:{a:{draft:note}}});
  f.transaction.readPath=async()=>{pathCalls++;return {found:true,stamp:'one',value:entry};};
  await assert.rejects(f.storage.selectNote({account,id:'a',stamp:'mismatch'}));
  assert.equal(pathCalls,0);
  const selected=await f.storage.selectNote({account,id:'a',stamp:'one'});assert.equal(selected.entry.draft.content,'current');assert.equal(Object.hasOwn(selected,'value'),false);
  f.transaction.readPath=async()=>({found:true,stamp:'different',value:entry});await assert.rejects(f.storage.selectNote({account,id:'a',stamp:'one'}));
});
test('browser path guard validates retained copy binding without full loading or writes',async()=>{
  const f=await fixture();assert.equal((await f.storage.readPath(['contexts'])).value.current,'only');
  f.metadata.legacy_hash='0'.repeat(64);await assert.rejects(f.storage.readPath([]));
  f.setMetadata(undefined);f.setRaw('retained');await assert.rejects(f.storage.readPath([]));f.setRaw(null);
  assert.equal((await f.storage.readPath([])).projection,'path_v1');
});
test('browser current preview retains legacy and late-account gates without reading retained bodies',async()=>{
  const f=await fixture(),account=JSON.stringify(['https://qa.invalid','alice']);
  assert.equal((await f.storage.readCurrent(account)).projection,'journal_current_v1');
  f.setRaw('retained');await assert.rejects(f.storage.readCurrent(account),/원본|보존/);
  const late=await fixture();let active=true;late.after(()=>{active=false;});
  await assert.rejects(late.storage.readCurrent(account,{active:()=>active}));
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
