import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
async function factory(){const box=vm.createContext({});vm.runInContext(await fs.readFile(new URL('../vendor/history-persistence.js',import.meta.url),'utf8'),box);return box.NowHistoryPersistence;}
test('shared native adapter uses current/select/history session IPC without reading the legacy full key',async()=>{
  const F=await factory(),calls=[];let active=true;
  const native={info:async()=>({historySessions:true}),history:Object.fromEntries(['open','current','select','page','full','note'].map(name=>[name,async body=>{calls.push([name,body]);return {ok:true,stamp:'one',value:null,revision:'r'};}]))};
  const backend=await F.create({native,key:'history',readLegacy:()=>{throw Error('legacy full read forbidden');}}),guard={active:()=>active};
  await backend.current('account',guard);await backend.select({account:'account',id:'one'},guard);assert.deepEqual(calls.map(([name])=>name),['current','select']);
  await assert.rejects(backend.select({account:'account',id:'one'}));await assert.rejects(backend.full({revision:'r',next:null}));assert.equal(calls.length,2);
  active=false;await assert.rejects(backend.open(guard));assert.equal(calls.length,2);
});
test('shared adapter rejects late native completion and delegates Web operations to the same guarded IDB backend',async()=>{
  const F=await factory();let active=true;
  const native={info:async()=>({historySessions:true}),history:{current:async()=>{active=false;return {ok:true};}}};
  const backend=await F.create({native,key:'history'});await assert.rejects(backend.current('account',{active:()=>active}));
  const calls=[],browser={readSnapshot:(...args)=>calls.push(['open',...args]),writeSnapshot:(...args)=>calls.push(['full',...args])};
  const web=await F.create({browser:()=>browser}),guard={active:()=>true};web.open(guard);web.full({expected:1,next:2},guard);
  assert.deepEqual(calls,[['open',guard],['full',1,2,guard]]);
});
test('read-only freshness checks cannot advance the canonical stamp used to guard explicit Wiki transmission',async()=>{
  const F=await factory();let stamp='one';
  const native={info:async()=>({historySessions:true}),history:Object.fromEntries(['open','current','select','page','full','note'].map(name=>[name,async()=>({ok:true,revision:'r',stamp})]))};
  const backend=await F.create({native,key:'history'}),guard={active:()=>true};
  await backend.open(guard);assert.equal(backend.stamp(),'one');stamp='external';await backend.current('account',guard);assert.equal(backend.stamp(),'one');
  await backend.full({revision:'r',next:null},guard);assert.equal(backend.stamp(),'external');
});
