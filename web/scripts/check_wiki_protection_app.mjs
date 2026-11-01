import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
for(const file of ['../app.js','../../desktop/app/app.js']){
  const source=await fs.readFile(new URL(file,import.meta.url),'utf8');
  const box=vm.createContext({structuredClone,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,atob,btoa});
  for(const name of ['note-protection-protocol.js','note-protection-state.js','wiki-state.js'])
    vm.runInContext(await fs.readFile(new URL('../vendor/'+name,import.meta.url),'utf8'),box);
  const ctx={url:'https://synthetic.invalid',owner:'alice',device:'one',enabled:true};
  const local='wiki:'+webcrypto.randomUUID(),scope=await box.NowNoteWiki.localProtectionScope(ctx,local);
  const account=JSON.stringify([ctx.url,ctx.owner]);
  let raw={schema_version:1,contexts:{[account]:{notes:{[local]:{
    raw:{owner_id:ctx.owner,local_id:local},draft:{owner_id:ctx.owner,local_id:local},protectionScope:structuredClone(scope),
  }}}}};
  box.noteProtectionLocalWikiScope=structuredClone(scope);
  box.noteHistoryContext=()=>structuredClone(ctx);box.protectionActionGuard=()=>()=>{};
  box.noteHistory={protectionOperations:()=>({})};
  box.noteProtectionClient={archives:async()=>[{store:'history',path:[local],record:{}}]};
  box.protectionStorageAdapters=()=>[{name:'fallback',kind:'history',read:async()=>structuredClone(raw)}];
  const start=source.indexOf('async function inspectLocalWikiProtection(');
  assert.ok(start>=0);const tail=source.slice(start),end=/\n(?:async )?function [A-Za-z]/.exec(tail);
  vm.runInContext(tail.slice(0,end.index)+'\nglobalThis.inspect=inspectLocalWikiProtection;',box);
  await assert.rejects(box.inspect,/보호.*미완료|사본.*남아/,'One cipher archive does not prove that every registered store is protected');
  raw={schema_version:1,contexts:{[account]:{notes:{}}}};
  const info=await box.inspect();assert.equal(info.localWiki,true);assert.equal(info.status.crypto_epoch,1);
  ctx.owner='bob';await assert.rejects(box.inspect,/계정/);
}
console.log('Wiki protection actual app inspection: incomplete fallback blocks completion, cipher-only archive and owner isolation PASS');
