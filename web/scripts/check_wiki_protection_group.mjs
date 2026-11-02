import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {fixture,ctx,clone} from './wiki_ingest_fixture.mjs';
const {box,P,W,catalog}=await fixture();
for(const name of ['note-history-state','note-protection-state','note-protection-client','wiki-protection-group']){
  try{vm.runInContext(await fs.readFile(new URL('../vendor/'+name+'.js',import.meta.url),'utf8'),box);}catch(error){if(error.code!=='ENOENT')throw error;}
}
assert.equal(typeof box.NowWikiProtectionGroup?.create,'function','proposal aliases need a durable account-bound protection group, not deletion or target-ID rewriting');
const context={...ctx,enabled:true,online:false,auth:'synthetic-only'},doc=clone(catalog[0].document),local='wiki:'+doc.wiki_id;
let saved=null,history,fallback,fail=true,targetCalls=0,targetStarts=0,responseLoss=true,writes=0;
const make=()=>box.NowNoteHistory.create({initial:saved,context:()=>context,write:async value=>{saved=clone(value);writes++;},request:async()=>{throw Error('network forbidden');}});
history=make();const scope=await W.localProtectionScope(context,local),account=box.NowNoteHistory.key(context);
const note=id=>({id:null,owner_id:context.owner,local_id:id,device_id:context.device,note_type:'tree',title:'Synthetic wiki',content:P.canonicalJson(doc),
  source:id===local?'wiki-artifact':'wiki-ingest-proposal',parent_local_id:null,level:1,tags:null,deleted_at:null,
  created_at:'2026-11-02T00:00:00.000Z',updated_at:'2026-11-02T00:00:00.000Z',client_updated_at:null});
const aliases=[1,2].map(n=>'wiki-proposal:00000000-0000-4000-8000-00000000000'+n+':'+doc.wiki_id);
for(const id of [local,...aliases]){await history.track(note(id),null,{localOnly:true});await history.seal(id);}
let attributed=clone(history.export());attributed.contexts[account].notes[local].protectionScope=clone(scope);
await history.replaceProtectionStore(history.export(),attributed);fallback=clone(history.export());
const stores=()=>[
  {name:'history',kind:'history',read:async()=>history.export(),cas:(before,after,guard)=>history.replaceProtectionStore(before,after,guard)},
  {name:'fallback',kind:'history',read:async()=>clone(fallback),cas:async(before,after)=>{
    assert.deepEqual(before,fallback);
    if(fail&&aliases.some(id=>after.contexts[account].notes[id]?.protection_record))throw Error('synthetic alias CAS');
    fallback=clone(after);
  }}
];
let targetStamp={head:1};
const api={context:()=>context,contextKey:()=>JSON.stringify(context),history:()=>history,stores,targetStamp:async()=>clone(targetStamp),
  verify:async(roots,target,id,options)=>{
    const documents=[];W.sourceProtectionDependencies(roots,target,id,{documents,wikiEvidence:[],allowedProposalIds:new Set(options?.proposalIds||[])});
    for(const value of documents)await W.validateDocument(value,target);
  }};
const groups=()=>box.NowWikiProtectionGroup.create(api),password='synthetic-group-password';
const execute=async pending=>{
  targetCalls++;
  const controller=box.NowNoteProtectionState.create({context:()=>({...context,instance:scope.instance}),journal:history,stores,
    remote:new Proxy({},{get:()=>()=>{throw Error('network forbidden');}}),preflight:async()=>api.verify(await Promise.all(stores().map(s=>s.read())),scope,local,{proposalIds:[]})});
  let id=pending?.id;if(!id){targetStarts++;id=await controller.startLocalWiki(scope,password);}
  const receipt=await controller.resume(id,password);
  if(responseLoss){responseLoss=false;throw Error('synthetic target response lost');}
  return {operation_id:id,receipt};
};
const plan=await groups().plan(scope);assert.equal(plan.members.length,2);
const before=JSON.stringify(saved);await assert.rejects(()=>groups().run(scope,password,'wrong',execute),/confirmation_required/);assert.equal(JSON.stringify(saved),before);
const verify=api.verify;api.verify=async(...args)=>{await verify(...args);context.auth='changed';};
await assert.rejects(()=>groups().run(scope,password,plan.plan_hash,execute),/context_changed/);
assert.equal(JSON.stringify(saved),before);context.auth='synthetic-only';api.verify=verify;
await assert.rejects(()=>groups().run(scope,password,plan.plan_hash,execute),/synthetic alias CAS/);
assert.equal(targetCalls,0);assert.equal(history.blocked(local),true);assert.ok(groups().pending(scope));
const progress=clone(saved),count=writes;
const withoutGroup=clone(progress);delete withoutGroup.protection_operations[groups().pending(scope).id];
assert.throws(()=>box.NowNoteProtectionState.validateBackupImport({history:progress},{history:withoutGroup}),/backup_/,'whole restore cannot discard the pending group');
const extra='wiki-proposal:00000000-0000-4000-8000-000000000003:'+doc.wiki_id;
const previousFallback=clone(fallback);fallback.contexts[account].notes[extra]=clone(fallback.contexts[account].notes[aliases[1]]);
fallback.contexts[account].notes[extra].raw.local_id=extra;fallback.contexts[account].notes[extra].draft.local_id=extra;
fallback.contexts[account].notes[extra].revisions=[];
await assert.rejects(()=>groups().run(scope,password,null,execute),/members_changed/);fallback=previousFallback;
await assert.rejects(()=>groups().run(scope,'wrong password',null,execute));assert.equal(writes,count);
context.owner='other';await assert.rejects(()=>groups().run(scope,password,null,execute),/context_changed/);context.owner=ctx.owner;
fail=false;targetStamp={head:2};
await assert.rejects(()=>groups().run(scope,password,null,execute),/target_changed/);assert.equal(targetCalls,0,'a changed target must not be silently adopted after restarting the group');
targetStamp={head:1};saved=clone(saved);history=make();
await assert.rejects(()=>groups().run(scope,password,null,execute),/target response lost/);
assert.ok(groups().pending(scope));saved=clone(saved);history=make();
await assert.rejects(()=>groups().run(scope,password,null,async pending=>{
  const result=await execute(pending);return {...result,receipt:{...result.receipt,changed:true}};
}),/target_receipt/);assert.ok(groups().pending(scope));
const receipt=await groups().run(scope,password,null,execute);assert.ok(receipt.operation_id);assert.ok(receipt.receipt);assert.equal(targetCalls,3);assert.equal(targetStarts,1);assert.equal(groups().pending(scope),null);
for(const root of [saved,fallback]){
  assert.equal(JSON.stringify(root).includes('Exact evidence'),false,'no plaintext Wiki body remains in any registered copy');
  assert.equal(JSON.stringify(root).includes(password),false);
  for(const id of [local,...aliases]){
    const record=root.contexts[account].notes[id].protection_record;
    assert.equal(record.scope.local_id,id,'original ID remains the archive identity');
    const archive=P.parseJson(await P.decryptContent(record.ciphertext,password));
    assert.equal(archive.value.draft.local_id,id);assert.equal(archive.value.draft.content,P.canonicalJson(doc));
  }
}
const emptyHistory=box.NowNoteHistory.create({context:()=>context,write:async()=>{throw Error('no write expected');},request:async()=>{throw Error('no network expected');}});
const empty=box.NowWikiProtectionGroup.create({...api,history:()=>emptyHistory,stores:()=>[{name:'empty-history',kind:'history',read:async()=>emptyHistory.export()}],targetStamp:undefined});
assert.equal((await empty.plan(scope)).members.length,0,'a Wiki without proposal aliases must not acquire a new status requirement');
console.log('Wiki proposal group: explicit list, durable interrupted CAS/cold resume, wrong key/account refusal, original IDs, all copies encrypted, target once and zero network PASS');
