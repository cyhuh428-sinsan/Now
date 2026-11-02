import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const box=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,structuredClone,Uint8Array,atob,btoa});
for(const name of ['protocol','state','client'])vm.runInContext(await fs.readFile(new URL('../vendor/note-protection-'+name+'.js',import.meta.url),'utf8'),box);
const C=box.NowNoteProtectionClient,Q=box.NowNoteProtectionProtocol,uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const scope={url:'https://synthetic.invalid',owner:'alice',local_id:'parent',device:'one',instance:uid(1)};
const child={id:'child',archivedAt:undefined,protection_record:{schema_version:1,scope:{...scope,local_id:'child'},operation_id:uid(2),ciphertext:await Q.encryptContent('PRIVATE-CHILD','memory-key')}};
const initial={tree:[{id:'parent',title:'Parent',content:'Original parent',children:[child]}],daily:{},worklogs:{}};
const context=()=>({...scope,auth:'token',generation:1});
for(const variant of ['settings','data']){
  const baseline=structuredClone(initial);
  if(variant==='settings')delete baseline.tree[0].children[0].archivedAt;
  let data=structuredClone(baseline),settings={shortcuts:{addRoot:{code:undefined}}},writes=0;
  if(variant==='data')settings={};
  const stores=()=>[{name:'memory:data',kind:'data',ephemeral:true,read:async()=>structuredClone(data),
    cas:async(expected,next,guard)=>{assert.deepEqual(data,expected);assert.equal(guard.active(),true);data=structuredClone(next);writes++;}},
    {name:'memory:settings',kind:'settings',ephemeral:true,read:async()=>structuredClone(settings),cas:async()=>{throw Error('unrelated_settings_write');}}];
  let client=C.create({context,stores}),list=await client.copies(scope);
  assert.ok(list.length,'parent must have an explicit attribution candidate');
  await client.confirm(scope,list,list.map(r=>r.id));
  assert.equal(writes,1);assert.deepEqual(data.tree[0].children,baseline.tree[0].children);
  assert.equal(data.tree[0].protectionScope.local_id,'parent');
  assert.throws(()=>Q.canonicalJson(variant==='settings'?settings:data),/json_type/,'public wire JSON remains strict');
  const reset=async()=>{data=structuredClone(baseline);writes=0;settings=variant==='settings'?{shortcuts:{addRoot:{code:undefined}}}:{};
    client=C.create({context,stores});list=await client.copies(scope);};
  await reset();
  if(variant==='settings')delete settings.shortcuts.addRoot.code;else delete data.tree[0].children[0].archivedAt;
  await assert.rejects(client.confirm(scope,list,list.map(r=>r.id)),/copy_changed/);assert.equal(writes,0);
  await reset();
  if(variant==='settings')settings.shortcuts.addRoot.code=null;else data.tree[0].children[0].archivedAt=null;
  await assert.rejects(client.confirm(scope,list,list.map(r=>r.id)),/copy_changed/);assert.equal(writes,0);
}
console.log('Local attribution: undefined preserved, absent/null changes rejected before writes, other cipher unchanged, wire stays strict PASS (synthetic store)');
