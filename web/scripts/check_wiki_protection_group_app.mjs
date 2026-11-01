import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
for(const file of ['../app.js','../../desktop/app/app.js']){
  const source=await fs.readFile(new URL(file,import.meta.url),'utf8'),start=source.indexOf('function wikiProtectionGroups(){'),end=source.indexOf('\nasync function openNoteProtection(',start);
  assert.ok(start>=0&&end>start);
  const scope={url:'https://synthetic.invalid',owner:'alice',instance:'synthetic',device:'one',local_id:'wiki:00000000-0000-4000-8000-000000000001'};
  const groupMarker={id:'group',phase:'wiki_group_applying'},member={id:'synthetic-alias'},rootMarker={id:'original-target',phase:'applying'};
  let nextPending=null,plan={members:[member],plan_hash:'confirmed-plan',pending:null},factory,runs=[],targets=[];
  const box=vm.createContext({structuredClone,NowWikiProtectionGroup:{create:api=>{factory=api;return {
    plan:async()=>structuredClone(plan),run:async(s,key,hash,perform,resolve)=>{runs.push({scope:s,key,hash,resolve});return perform(nextPending);}
  };}},noteHistoryContext:()=>({url:scope.url,owner:scope.owner,device:scope.device}),noteProtectionLocalWikiScope:scope,
    noteProtectionIdentity:null,noteProtectionViewGeneration:1,protectionViewKey:()=>1,noteHistory:{},protectionStorageAdapters:()=>[],wikiNotebook:{protectionDependencies:async()=>[]},
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
  assert.ok(source.includes('convert:convertProtectionSelection,resume:resumeProtectionSelection'));
  assert.ok(source.includes('NowWikiProtectionGroup.relatedTarget(marker.scope.local_id)'));
}
console.log('Web/Desktop group wiring: explicit plan binding, original-target resume, local scope, no recursion and ordinary protection preserved PASS');
