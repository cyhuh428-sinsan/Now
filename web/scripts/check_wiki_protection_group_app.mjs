import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
for(const file of ['../app.js','../../desktop/app/app.js']){
  const source=await fs.readFile(new URL(file,import.meta.url),'utf8'),start=source.indexOf('function wikiProtectionGroups(){'),end=source.indexOf('\nasync function openNoteProtection(',start);
  assert.ok(start>=0&&end>start);
  const scope={url:'https://synthetic.invalid',owner:'alice',instance:'00000000-0000-4000-8000-000000000002',device:'one',local_id:'wiki:00000000-0000-4000-8000-000000000001'};
  const groupMarker={id:'group',phase:'wiki_group_applying'},member={id:'synthetic-alias'},rootMarker={id:'original-target',phase:'applying'};
  let nextPending=null,plan={members:[member],plan_hash:'confirmed-plan',pending:null},factory,runs=[],targets=[],envelopes=[];
  const box=vm.createContext({structuredClone,NowWikiProtectionGroup:{create:api=>{factory=api;return {
    plan:async()=>structuredClone(plan),run:async(s,key,hash,perform,resolve)=>{runs.push({scope:s,key,hash,resolve});const result=await perform(nextPending);envelopes.push(result);return result;}
  };}},noteHistoryContext:()=>({url:scope.url,owner:scope.owner,device:scope.device}),noteProtectionLocalWikiScope:scope,
    noteProtectionIdentity:null,noteProtectionViewGeneration:1,protectionViewKey:()=>1,noteHistory:{},protectionStorageAdapters:()=>[],wikiNotebook:{protectionDependencies:async()=>[]},wikiProtectionTargetStamp:async()=>({synthetic:true}),
    protectionActionGuard:()=>()=>{},protectLocalWiki:async info=>{targets.push(info);return {operation_id:'synthetic-result'};},noteProtectionMutationsEnabled:()=>true});
  vm.runInContext(source.slice(start,end),box);
  const info={scope,localWiki:true,status:{crypto_epoch:0},pending:null};
  const bound=await box.attachWikiProtectionGroup(info);assert.equal(bound.wikiGroup.plan_hash,plan.plan_hash);
  const resolve=()=>{};await box.convertProtectionSelection(bound,'conversion','synthetic-key',resolve,'confirmed-plan');
  assert.equal(runs.length,1);assert.equal(runs[0].hash,'confirmed-plan');assert.equal(runs[0].resolve,resolve);
  assert.equal(targets[0].pending,null);assert.equal(targets[0].wikiGroup,null,'the group must not recursively call itself');
  assert.equal(factory.context().instance,scope.instance);assert.equal(typeof factory.verify,'function');
  const boundKey=factory.contextKey();box.noteProtectionViewGeneration++;assert.notEqual(factory.contextKey(),boundKey,'locking invalidates the group action even when its account and target are unchanged');
  plan.pending=groupMarker;nextPending=rootMarker;
  const resumed=await box.attachWikiProtectionGroup(info);assert.equal(resumed.pending.id,groupMarker.id);
  await box.resumeProtectionSelection(resumed,'synthetic-key',resolve);
  assert.equal(targets.at(-1).pending.id,rootMarker.id,'resume uses the original target operation, never the group ID');
  const count=runs.length;await box.convertProtectionSelection(info,'conversion','synthetic-key',resolve);
  assert.equal(runs.length,count,'ordinary local protection is unchanged');
  nextPending=null;
  Object.assign(box,{noteHistoryCaptureChain:Promise.resolve(),storagePendingWrites:[],noteProtectionReader:{read:async()=>{throw Error('no catalog expected');}},
    NowNoteProtectionClient:{plan:()=>({synthetic:true})},noteHistory:{view:()=>({revisions:[]})},noteHistoryUI:null,wikiUI:null,
    unlockedEncryptedNotes:new Map(),resetTreeEditorHistory:()=>{},beginNoteProtection:async()=> 'known-transition-id',
    resumeNoteProtection:async()=>({owner_id:'alice',crypto_epoch:1})});
  const serverInfo={...bound,localWiki:false,catalog:null,pending:null};
  const serverReceipt=await box.convertProtectionSelection(serverInfo,'conversion','synthetic-key',resolve,'confirmed-plan');
  assert.equal(serverReceipt.crypto_epoch,1);assert.equal(envelopes.at(-1).operation_id,'known-transition-id');
  assert.equal(envelopes.at(-1).receipt.operation_id,undefined,'existing server receipts do not contain the transition ID');
  let ordinaryResumes=0;box.beginNoteProtection=async()=>{throw Error('operation_exists');};box.resumeNoteProtection=async()=>{ordinaryResumes++;};
  await assert.rejects(()=>box.convertProtectionSelection({...serverInfo,wikiGroup:null,pending:rootMarker},'conversion','synthetic-key',resolve),/operation_exists/);
  assert.equal(ordinaryResumes,0,'ordinary conversion must not silently resume a pending operation');
  assert.ok(source.includes('convert:convertProtectionSelection,resume:resumeProtectionSelection'));
  assert.ok(source.includes('NowWikiProtectionGroup.relatedTarget(marker.scope.local_id)'));
  Object.assign(box,{crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,atob,btoa});
  for(const name of ['note-protection-protocol','note-protection-state'])vm.runInContext(await fs.readFile(new URL('../vendor/'+name+'.js',import.meta.url),'utf8'),box);
  const stampStart=source.indexOf('async function wikiProtectionTargetStamp(');
  vm.runInContext(source.slice(stampStart,start),box);
  const account=JSON.stringify([scope.url,scope.owner]);
  let item={draft:{content:'Synthetic local body'},raw:{content:'Synthetic local body'},optional:undefined,protectionScope:structuredClone(scope)};
  box.NowNoteHistory={key:()=>account};box.noteHistory={export:()=>({contexts:{[account]:{notes:{[scope.local_id]:structuredClone(item)}}}})};
  const stamped=await box.wikiProtectionTargetStamp(scope);assert.equal(stamped.kind,'local');assert.match(stamped.hash,/^[0-9a-f]{64}$/);
  delete item.protectionScope;assert.equal((await box.wikiProtectionTargetStamp(scope)).hash,stamped.hash,'attribution does not change the pinned content');
  item.draft.content+=' changed';assert.notEqual((await box.wikiProtectionTargetStamp(scope)).hash,stamped.hash);
  box.noteProtectionLocalWikiScope=null;
  const status={preparation_only:true,server_instance_id:scope.instance,head_revision_id:null,head_version:1,crypto_epoch:0,history_generation:1,identity_state:'coherent',protection_state:'legacy',current_exists:true,inventory_revision_ids:[]};
  box.noteHistoryRequest=async()=>structuredClone(status);
  assert.equal((await box.wikiProtectionTargetStamp(scope)).head_version,1);
  delete status.head_version;await assert.rejects(()=>box.wikiProtectionTargetStamp(scope),/target_unverifiable/);status.head_version=1;
  status.crypto_epoch='0';await assert.rejects(()=>box.wikiProtectionTargetStamp(scope),/target_unverifiable/);status.crypto_epoch=0;
  status.server_instance_id='other';await assert.rejects(()=>box.wikiProtectionTargetStamp(scope),/context_changed/);
}
console.log('Web/Desktop group wiring: explicit plan binding, original-target resume, local scope, no recursion and ordinary protection preserved PASS');
