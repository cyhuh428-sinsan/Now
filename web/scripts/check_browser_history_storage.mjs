import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const runtime=await readFile(new URL('../vendor/browser-history-storage.js',import.meta.url),'utf8').catch(()=> '');
const context=vm.createContext({structuredClone,TextEncoder,crypto:webcrypto});
vm.runInContext(await readFile(new URL('../vendor/note-protection-state.js',import.meta.url),'utf8'),context);
vm.runInContext(runtime,context);
assert.equal(typeof context.NowBrowserHistoryStorage?.create,'function','Browser history transaction adapter is required');

// Deterministic IDB events: request success precedes transaction completion.
function fixture(raw=null){
  let row,legacy=raw,connection,hold=false,pending,abort=false,strict=true,failLegacy=false,afterLegacy;
  const transactions=[];
  const db={objectStoreNames:{contains:()=>true},close(){},transaction(_store,mode,options){
    const tx={durability:strict?options?.durability:'relaxed',error:null,abort(){this.error=new Error('aborted');queueMicrotask(()=>this.onabort?.());}};
    transactions.push({mode,options});let candidate=row;
    const done=()=>{if(abort){abort=false;tx.abort();return;}row=candidate;tx.oncomplete?.();};
    tx.objectStore=()=>({get(){const req={};queueMicrotask(()=>{req.result=structuredClone(row);req.onsuccess?.();if(tx.error)return;if(hold&&mode==='readwrite')pending=done;else queueMicrotask(done);});return req;},put(value){candidate=structuredClone(value);}});
    return tx;
  }};
  const indexedDB={open(){const req={};queueMicrotask(()=>{req.result=db;req.onsuccess?.();});return req;}};
  const localStorage={getItem:()=>legacy,setItem(_k,value){if(failLegacy)throw Error('quota');legacy=value;afterLegacy?.();}};
  let tail=Promise.resolve();
  const lock=action=>{const next=tail.catch(()=>{}).then(action);tail=next;return next;};
  const create=()=>context.NowBrowserHistoryStorage.create({indexedDB,localStorage,lock,key:'history'});
  connection=create();
  return {connection,create,transactions,get row(){return structuredClone(row);},set row(v){row=v;},get legacy(){return legacy;},set legacy(v){legacy=v;},hold(v){hold=v;},release(){const fn=pending;pending=null;fn();},hasPending:()=>Boolean(pending),abortNext(){abort=true;},strict(v){strict=v;},failLegacy(v){failLegacy=v;},afterLegacy(fn){afterLegacy=fn;}};
}
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const scope={url:'https://qa.invalid',owner:'owner',instance:'11111111-1111-4111-8111-111111111111',local_id:'a',device:'qa'};
const account=JSON.stringify([scope.url,scope.owner]);
const old={schema_version:1,contexts:{[account]:{notes:{a:{content:'old'}}}}};
const next={schema_version:1,contexts:{[account]:{notes:{a:{content:'new'}}}}};
const sealed={schema_version:1,contexts:{[account]:{notes:{a:{protection_record:{schema_version:1,scope,operation_id:'qa-operation',ciphertext:'NOW_ENCRYPTED_V1:cipher'}}}}}};
let count=0;
async function test(name,run){await run();count++;console.log('PASS '+name);}
await test('migration preserves exact legacy bytes and canonical JSON',async()=>{
  const raw=JSON.stringify(old,null,2),f=fixture(raw);
  assert.deepEqual(JSON.parse(await f.connection.read()),old);assert.equal(f.legacy,raw);
  assert.equal(f.row.value,raw);assert.equal(Object.keys(f.row).sort().join(','),'legacy_hash,redo,schema_version,value');
  assert.equal(f.transactions.filter(t=>t.mode==='readwrite').every(t=>t.options.durability==='strict'),true);
});
await test('request success does not acknowledge migration before commit',async()=>{
  const f=fixture(JSON.stringify(old));f.hold(true);let complete=false;
  const action=f.connection.read().then(()=>{complete=true;});
  const deadline=Date.now()+2000;while(!f.hasPending()&&Date.now()<deadline)await turn();
  assert(f.hasPending());assert.equal(complete,false);assert.equal(f.row,undefined);
  f.release();await action;assert.equal(complete,true);
});
await test('write commit survives new adapter; retained legacy is not a live writer',async()=>{
  const f=fixture(JSON.stringify(old));await f.connection.read();await f.connection.write(old,next);
  assert.deepEqual(JSON.parse(await f.create().read()),next);assert.equal(f.legacy,JSON.stringify(old));
});
await test('CAS refuses stale tabs without losing either revision',async()=>{
  const f=fixture(JSON.stringify(old));await f.connection.read();await f.connection.write(old,next);
  await assert.rejects(f.create().write(old,sealed));assert.deepEqual(JSON.parse(f.row.value),next);
});
await test('changed legacy and damaged JSON do not silently replace canonical',async()=>{
  const f=fixture(JSON.stringify(old));await f.connection.read();f.legacy=JSON.stringify(next);
  await assert.rejects(f.create().read());await assert.rejects(f.connection.write(old,sealed));assert.deepEqual(JSON.parse(f.row.value),old);
  await assert.rejects(fixture('{broken').connection.read());
});
await test('transaction abort and unsupported strict mode never report saved',async()=>{
  const f=fixture(JSON.stringify(old));await f.connection.read();f.abortNext();await assert.rejects(f.connection.write(old,next));assert.deepEqual(JSON.parse(f.row.value),old);
  const unsupported=fixture();unsupported.strict(false);await assert.rejects(unsupported.connection.read());assert.equal(unsupported.row,undefined);
});
await test('authentication guard rejects before storage write',async()=>{
  const f=fixture(JSON.stringify(old));await f.connection.read();await assert.rejects(f.connection.write(old,next,{active:()=>false}));assert.deepEqual(JSON.parse(f.row.value),old);
});
await test('retained legacy protection CAS seals content without extra plaintext fields',async()=>{
  const f=fixture(JSON.stringify(old));await f.connection.read();await f.connection.write(old,sealed);
  await f.connection.casLegacy(old,sealed);assert.deepEqual(JSON.parse(f.legacy),sealed);assert.equal(f.row.redo.length,1);
  assert.equal(JSON.stringify(f.row).includes('"old"'),false);assert.deepEqual(JSON.parse(await f.create().read()),sealed);
});
await test('interrupted legacy sealing preserves old bytes and resumes cipher-only redo',async()=>{
  const f=fixture(JSON.stringify(old));await f.connection.read();await f.connection.write(old,sealed);
  f.failLegacy(true);await assert.rejects(f.connection.casLegacy(old,sealed));assert.equal(f.row.redo.length,1);assert.equal(f.legacy,JSON.stringify(old));
  f.failLegacy(false);await f.create().read();assert.deepEqual(JSON.parse(f.legacy),sealed);assert.equal(JSON.stringify(f.row.redo).includes('"old"'),false);
});
await test('legacy changed but acknowledgement interrupted: new bytes are verified, not overwritten',async()=>{
  const f=fixture(JSON.stringify(old));await f.connection.read();await f.connection.write(old,sealed);
  f.afterLegacy(()=>{throw Error('interrupted');});await assert.rejects(f.connection.casLegacy(old,sealed));assert.equal(f.row.redo.length,1);
  assert.deepEqual(JSON.parse(f.legacy),sealed);await f.create().read();assert.deepEqual(JSON.parse(f.legacy),sealed);
});
await test('unknown legacy during interrupted transition refuses both read and write',async()=>{
  const f=fixture(JSON.stringify(old));await f.connection.read();f.failLegacy(true);await assert.rejects(f.connection.casLegacy(old,sealed));
  f.legacy=JSON.stringify(next);await assert.rejects(f.create().read());await assert.rejects(f.connection.write(old,next));assert.deepEqual(JSON.parse(f.row.value),old);
});
await test('malformed database never falls back to legacy',async()=>{
  const f=fixture(JSON.stringify(old));await f.connection.read();f.row={...f.row,redo:null};await assert.rejects(f.create().read());assert.equal(f.legacy,JSON.stringify(old));
});
await test('two writers serialize and only one shared-base CAS succeeds',async()=>{
  const f=fixture(JSON.stringify(old));await f.connection.read();const results=await Promise.allSettled([f.connection.write(old,next),f.create().write(old,sealed)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.deepEqual(JSON.parse(f.row.value),next);
});
await test('null and absent are not serialized as a plaintext or JSON null copy',async()=>{
  const f=fixture();assert.equal(await f.connection.read(),null);assert.equal(f.row.value,null);assert.equal(f.legacy,null);
  await f.connection.write(null,old);assert.deepEqual(JSON.parse(await f.create().read()),old);assert.equal(f.legacy,null);
});
await test('ordinary plaintext updates cannot become legacy recovery patches',async()=>{
  const f=fixture(JSON.stringify(old));await f.connection.read();await assert.rejects(f.connection.casLegacy(old,next));assert.equal(f.row.redo.length,0);assert.equal(f.legacy,JSON.stringify(old));
});
await test('explicit copy attribution adds only validated scope metadata before sealing',async()=>{
  const f=fixture(JSON.stringify(old));await f.connection.read();const attributed=structuredClone(old);attributed.contexts[account].notes.a.protectionScope=scope;
  await f.connection.write(old,attributed);await f.connection.casLegacy(old,attributed);
  await f.connection.write(attributed,sealed);await f.connection.casLegacy(attributed,sealed);
  f.legacy=JSON.stringify(old);await f.create().read();assert.deepEqual(JSON.parse(f.legacy),sealed);assert.equal(JSON.stringify(f.row.redo).includes('"old"'),false);
});
await test('cipher redo replays only exact approved predecessor hashes across operations',async()=>{
  const f=fixture(JSON.stringify(old));await f.connection.read();await f.connection.write(old,sealed);await f.connection.casLegacy(old,sealed);
  const rotated=structuredClone(sealed);rotated.contexts[account].notes.a.protection_record.operation_id='qa-next';rotated.contexts[account].notes.a.protection_record.ciphertext='NOW_ENCRYPTED_V1:next';
  await f.connection.write(sealed,rotated);await f.connection.casLegacy(sealed,rotated);
  f.legacy=JSON.stringify(old);await f.create().read();assert.deepEqual(JSON.parse(f.legacy),rotated);assert.equal(f.row.redo.length,2);
  assert.equal(JSON.stringify(f.row).includes('"old"'),false);
});
console.log(`Browser history storage: ${count} checks PASS (deterministic transactions; real browser cold restart is separate)`);
