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
  ctx.owner='alice';let locked=false,reads=0,opened=null;
  let record={localOnly:false,draft:{content:'NOW_ENCRYPTED_V1:synthetic',deleted_at:null}},current={status:'ok',identity_state:'coherent',snapshot:{note:{owner_id:ctx.owner,local_id:local,content:'NOW_ENCRYPTED_V1:synthetic',deleted_at:null}},head_version:1};
  box.protectionActionGuard=()=>()=>{if(locked)throw Error('synthetic_locked');};
  box.noteHistory.view=()=>structuredClone(record);
  box.noteHistoryRequest=async()=>{reads++;return structuredClone(current);};
  box.wikiNotebook={inspectProtected:async()=>({syntheticTypedDocument:true})};
  box.wikiUI={openProtected:(document,access)=>{opened={document,access};}};
  const previewStart=source.indexOf('async function openProtectedWikiPreview('),previewEnd=source.indexOf('\nfunction initializeWikiNotebook()',previewStart);
  assert.ok(previewStart>=0&&previewEnd>previewStart);
  vm.runInContext(source.slice(previewStart,previewEnd)+'\nglobalThis.preview=openProtectedWikiPreview;',box);
  await box.preview({scope:{...scope,url:ctx.url}},'synthetic decrypted bytes');
  assert.equal(opened.access.origin,'server');assert.equal(reads,1);await opened.access.revalidate();assert.equal(reads,2);
  current.head_version++;await assert.rejects(opened.access.revalidate,/판본/);
  current.identity_state='ambiguous';await assert.rejects(()=>box.preview({scope:{...scope,url:ctx.url}},'synthetic decrypted bytes'),/접근/);current.identity_state='coherent';
  locked=true;const beforeReads=reads;await assert.rejects(opened.access.revalidate,/synthetic_locked/);assert.equal(reads,beforeReads,'relock stops before another read');
  locked=false;record.localOnly=true;await box.preview({scope:{...scope,url:ctx.url}},'synthetic decrypted bytes');
  assert.equal(opened.access.origin,'local');const beforeLocalReads=reads;await opened.access.revalidate();assert.equal(reads,beforeLocalReads);
  record.draft.deleted_at='2026-11-02T00:00:00Z';await assert.rejects(opened.access.revalidate,/접근/);
}
console.log('Wiki protection actual app inspection: incomplete fallback blocks completion, cipher-only archive, Query current-read/relock/local-delete and owner isolation PASS');
