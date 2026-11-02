import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const box=vm.createContext({crypto:webcrypto,structuredClone,TextEncoder,TextDecoder,Uint8Array,atob,btoa});
for(const name of ['note-protection-protocol.js','note-protection-state.js','note-history-state.js','wiki-state.js'])
  vm.runInContext(await fs.readFile(new URL('../vendor/'+name,import.meta.url),'utf8'),box);
vm.runInContext(await fs.readFile(new URL('../vendor/wiki-lifecycle.js',import.meta.url),'utf8').catch(()=>''),box);
assert.equal(typeof box.NowWikiLifecycle?.create,'function','Wiki lifecycle must preserve bodies in the existing account journal');
const id=webcrypto.randomUUID(),local='wiki:'+id;
const now='2026-11-01T00:00:00.000Z';
let ctx={url:'https://example.invalid',owner:'alice',device:'one',auth:'synthetic',enabled:true,online:false};
let saved=null,failWrite=false,calls=0,handler;
const H=()=>box.NowNoteHistory.create({initial:saved,context:()=>ctx,write:async value=>{if(failWrite)throw Error('synthetic store failure');saved=structuredClone(value);},request:async()=>{throw Error('unexpected Note request');}});
let h=H();
const api={context:()=>ctx,contextKey:()=>JSON.stringify(ctx),history:()=>h,
  request:async(...args)=>{calls++;return handler(...args);},read:async()=>{throw Error('unexpected read');}};
const create=()=>box.NowWikiLifecycle.create(api);
let life=create();
const note={id:null,owner_id:ctx.owner,local_id:local,device_id:ctx.device,note_type:'tree',title:'AI Wiki '+id,
  content:'PRESERVED WIKI BODY',source:'wiki-artifact',parent_local_id:null,level:1,tags:null,deleted_at:null,created_at:now,updated_at:now,client_updated_at:now};
await h.track(note,null,{localOnly:true});await h.seal(local,'wiki_edit');
const original=JSON.stringify(h.export().contexts[box.NowNoteHistory.key(ctx)].notes[local]);
let checks=0;
async function test(name,run){await run();checks++;console.log('PASS '+name);}
await test('local trash/restore preserves every body/history byte and never sends HTTP',async()=>{
  await life.move(local,'trash');assert(life.state(local).deleted_at);assert.equal(calls,0);
  assert.equal(JSON.stringify(h.export().contexts[box.NowNoteHistory.key(ctx)].notes[local]),original);
  h=H();life=create();assert(life.blocked(local));await life.move(local,'restore');assert.equal(life.blocked(local),false);assert.equal(calls,0);
});
await test('another account cannot see lifecycle metadata or lose the original bucket',async()=>{
  ctx={...ctx,owner:'bob'};assert.equal(life.state(local),null);assert.equal(life.blocked(local),false);
  await assert.rejects(life.move(local,'trash'));ctx={...ctx,owner:'alice'};assert.equal(life.state(local).local_only,true);
});
await test('failed local metadata save does not report trash or modify the original',async()=>{
  failWrite=true;await assert.rejects(life.move(local,'trash'));failWrite=false;
  assert.equal(life.blocked(local),false);assert.equal(JSON.stringify(h.export().contexts[box.NowNoteHistory.key(ctx)].notes[local]),original);
});
await test('protected local wiki lifecycle works without decrypting or rewriting its archive',async()=>{
  const data=h.export(),scope=await box.NowNoteWiki.localProtectionScope(ctx,local);
  data.contexts[box.NowNoteHistory.key(ctx)].notes[local]={protection_record:{schema_version:1,scope,operation_id:'qa-local',ciphertext:'NOW_ENCRYPTED_V1:synthetic'}};
  await h.replaceProtectionStore(h.export(),data);
  const before=JSON.stringify(data.contexts[box.NowNoteHistory.key(ctx)].notes[local]);
  await life.move(local,'trash');await life.move(local,'restore');
  assert.equal(JSON.stringify(h.export().contexts[box.NowNoteHistory.key(ctx)].notes[local]),before);assert.equal(calls,0);
});
const remoteId=webcrypto.randomUUID(),remoteLocal='wiki:'+remoteId;
let resource={id:remoteId,owner_id:'alice',schema_version:1,version:4,deleted_at:null,
  payload:{artifact_local_id:remoteLocal,dependencies:[]},created_at:now,updated_at:now};
ctx={...ctx,online:true};
await test('remote list metadata is owner-bound and rejects local/remote collisions',async()=>{
  await life.observe([resource]);assert.equal(life.state(remoteLocal).version,4);
  await assert.rejects(life.observe([{...resource,owner_id:'bob'}]));
  await assert.rejects(life.observe([{...resource,id,payload:{artifact_local_id:local,dependencies:[]}}]));
});
let originalBody,receipt;
await test('uncertain remote action keeps one durable mutation with no automatic retry',async()=>{
  handler=async(_ctx,_local,action,body)=>{
    assert.equal(action,'trash');originalBody=structuredClone(body);
    resource={...resource,version:5,deleted_at:now};receipt={status:'ok',mutation_id:body.mutation_id,resource:structuredClone(resource)};
    throw Error('synthetic response loss');
  };
  const before=calls;await assert.rejects(life.move(remoteLocal,'trash'));assert.equal(calls,before+1);
  assert.equal(life.state(remoteLocal).pending.mutation_id,originalBody.mutation_id);assert(life.blocked(remoteLocal));
  h=H();life=create();assert.equal(calls,before+1);assert.equal(life.state(remoteLocal).pending.mutation_id,originalBody.mutation_id);
});
await test('explicit retry uses original conditions and does not downgrade a later server lifecycle',async()=>{
  resource={...resource,version:6,deleted_at:null};await life.observe([resource]);
  handler=async(_ctx,_local,action,body)=>{assert.equal(action,'trash');assert.equal(JSON.stringify(body),JSON.stringify(originalBody));return structuredClone(receipt);};
  await life.retry(remoteLocal);assert.equal(life.state(remoteLocal).pending,null);assert.equal(life.state(remoteLocal).version,6);assert.equal(life.blocked(remoteLocal),false);
});
await test('foreign receipt and changed authentication do not acknowledge the old account operation',async()=>{
  handler=async(_ctx,_local,_action,body)=>({status:'ok',mutation_id:body.mutation_id,resource:{...resource,owner_id:'bob',version:7,deleted_at:now}});
  await assert.rejects(life.move(remoteLocal,'trash'));assert(life.state(remoteLocal).pending);
  handler=async(_ctx,_local,_action,body)=>{ctx={...ctx,owner:'bob',auth:'other'};return {status:'ok',mutation_id:body.mutation_id,resource:{...resource,version:7,deleted_at:now}};};
  await assert.rejects(life.retry(remoteLocal));assert.equal(life.state(remoteLocal),null);
  ctx={...ctx,owner:'alice',auth:'synthetic'};assert(life.state(remoteLocal).pending);
});
await test('backup restore cannot silently discard an unresolved lifecycle command',async()=>{
  const incoming=h.export();delete incoming.contexts[box.NowNoteHistory.key(ctx)].wiki_lifecycle;
  assert.throws(()=>life.validateRestore(incoming));assert.doesNotThrow(()=>life.validateRestore(h.export()));
  const before=JSON.stringify(h.export());await assert.rejects(h.import(incoming));assert.equal(JSON.stringify(h.export()),before,'Direct Note journal import must also preserve pending lifecycle');
});
await test('known server rejection requires explicit state reconciliation, never a new automatic request',async()=>{
  handler=async()=>{throw Object.assign(Error('synthetic conflict'),{status:409,code:'version_conflict'});};
  await assert.rejects(life.retry(remoteLocal));assert.equal(life.state(remoteLocal).pending.rejected,'version_conflict');
  const before=calls;await assert.rejects(life.retry(remoteLocal));assert.equal(calls,before);
  api.read=async()=>({resource:{...resource,owner_id:'bob',version:8}});await assert.rejects(life.reconcile(remoteLocal));assert(life.state(remoteLocal).pending);
  api.read=async()=>({resource:{...resource,version:8,deleted_at:null}});await life.reconcile(remoteLocal);
  assert.equal(life.state(remoteLocal).pending,null);assert.equal(life.state(remoteLocal).version,8);assert.equal(calls,before);
});
await test('recovery archives retain pending commands from every account',async()=>{
  const current=h.export(),archived=structuredClone(current.contexts[box.NowNoteHistory.key(ctx)]);
  archived.wiki_lifecycle[remoteLocal].pending={action:'trash',base_version:8,mutation_id:webcrypto.randomUUID(),device_id:'old-device',rejected:null};
  current.recovery_archives=[{contexts:{[JSON.stringify([ctx.url,'past-owner'])]:archived}}];
  const missing=structuredClone(current);missing.recovery_archives=[];
  assert.throws(()=>box.NowWikiLifecycle.validateRestore(current,missing));
  assert.doesNotThrow(()=>box.NowWikiLifecycle.validateRestore(current,current));
});
await test('late reconciliation GET cannot downgrade newer observed lifecycle metadata',async()=>{
  await assert.rejects(life.move(remoteLocal,'trash'));
  let enter,release;const entered=new Promise(resolve=>enter=resolve),reply=new Promise(resolve=>release=resolve);
  api.read=async()=>{enter();return reply;};
  const operation=life.reconcile(remoteLocal);await entered;
  resource={...resource,version:10,deleted_at:now};await life.observe([resource]);
  release({resource:{...resource,version:9,deleted_at:null}});await operation;
  assert.equal(life.state(remoteLocal).version,10);assert.equal(life.state(remoteLocal).deleted_at,now);assert.equal(life.state(remoteLocal).pending,null);
});
await test('same-version contradictory reconciliation cannot clear pending or replace observed state',async()=>{
  await assert.rejects(life.move(remoteLocal,'restore'));
  let enter,release;const entered=new Promise(resolve=>enter=resolve),reply=new Promise(resolve=>release=resolve);
  api.read=async()=>{enter();return reply;};
  const operation=life.reconcile(remoteLocal);await entered;
  resource={...resource,version:11,deleted_at:null};await life.observe([resource]);
  release({resource:{...resource,deleted_at:now}});await assert.rejects(operation);
  assert.equal(life.state(remoteLocal).version,11);assert.equal(life.state(remoteLocal).deleted_at,null);assert(life.state(remoteLocal).pending);
});
console.log(`Wiki lifecycle: ${checks} account/journal/receipt checks PASS; real HTTP and UI are separate`);
