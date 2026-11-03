import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

async function fixture(){
  const box=vm.createContext({structuredClone,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,atob,btoa});
  for(const name of ['note-history-state','journal-writes','deferred-history','history-client'])
    vm.runInContext(await fs.readFile(new URL('../vendor/'+name+'.js',import.meta.url),'utf8'),box);
  const ctx={url:'',owner:'alice',device:'one',auth:'synthetic',enabled:true,online:false},account=box.NowNoteHistory.key(ctx);
  const note={owner_id:'alice',local_id:'one',note_type:'tree',source:'manual',content:'current'};
  const entry={raw:note,draft:note,base:{crypto_epoch:0,inventory_revision_ids:[]},localOnly:true,revisions:[],outbox:[],receipts:[]};
  let reads=0,writes=0,ready=0;
  const backend={current:async()=>({projection:'journal_current_v1',supported:true,stamp:'one',account,notes:{one:{projection:'current_v1',...entry}},wikiIndexSupported:true,wikiIds:[],wikiMetadata:[]}),
    open:async()=>{reads++;return {value:{schema_version:1,contexts:{[account]:{notes:{one:entry}}}},revision:'r',scoped:false,stamp:'one'};},
    full:async()=>{writes++;return {revision:'next',scoped:false};}};
  return {box,ctx,account,backend,counts:()=>({reads,writes,ready}),onReady:()=>{ready++;}};
}
test('shared history host starts from current projection without full reads and materializes only on explicit demand',async()=>{
  const f=await fixture(),runtime=await f.box.NowHistoryClient.create({backend:f.backend,context:()=>f.ctx,request:async()=>{},ready:f.onReady});
  assert.equal(runtime.history.deferred(),true);assert.equal(f.counts().reads,0);
  await runtime.history.ensure();assert.equal(f.counts().reads,1);assert.equal(runtime.history.deferred(),false);
  assert.equal(runtime.history.currentView('one').draft.content,'current');assert.equal(f.counts().writes,0);
});
test('shared initial reader discards late account completion and never normalizes malformed native legacy strings as empty',async()=>{
  const f=await fixture(),runtime=await f.box.NowHistoryClient.create({backend:f.backend,context:()=>f.ctx,request:async()=>{},legacyStrings:true});
  f.backend.current=async()=>{f.ctx.owner='bob';return {supported:false};};
  await assert.rejects(runtime.readInitial());assert.equal(f.counts().reads,0);
  const bad=runtime.normalize({value:'not-json',revision:'r',scoped:true});assert.equal(bad.value.schema_version,'unreadable');assert.equal(bad.scoped,false);
});
