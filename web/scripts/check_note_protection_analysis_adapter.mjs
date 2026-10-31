import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const root=new URL('../../',import.meta.url);
for(const file of ['web/app.js','desktop/app/app.js']){
  const source=await fs.readFile(new URL(file,root),'utf8'),start=source.indexOf('function protectedAnalysisRoute('),end=source.indexOf('async function inspectNoteProtection()',start);
  assert.ok(start>0&&end>start);
  const scope={url:'http://synthetic.invalid',owner:'alice',local_id:'one',device:'device',instance:'instance'};
  let context={...scope,enabled:true},enabled=true,invocations=0,serverCalls=[],observation={ok:true,json:async()=>({choices:[{message:{content:'ORIGINAL\r\n'}}]}),text:async()=>JSON.stringify({choices:[{message:{content:'ORIGINAL\r\n'}}]})};
  const config={provider:'omniroute',omniUrl:'http://127.0.0.1:1/v1',omniModel:'auto',omniApiKey:'synthetic-only',omniReasoning:''};
  let phase='analysis_claimed',replan=null,legacy=false;
  const box=vm.createContext({URL,crypto:webcrypto,structuredClone,state:{settings:{llm:config}},
    NowNoteProtectionProtocol:{canonicalJson:JSON.stringify},noteProtectionIdentity:{instance:scope.instance},
    NowNoteProtectionState:{scopeKey:s=>JSON.stringify([s.url.replace(/\/+$/,''),s.owner,s.instance,s.local_id])},
    noteHistoryContext:()=>context,protectionActionGuard:()=>()=>{},protectionTargetId:()=>scope.local_id,isLlmConfigured:()=>true,
    omniRouteBaseUrl:s=>s.trim().replace(/\/+$/,''),
    noteProtectionReader:{read:async()=>({value:'SOURCE\r\n'}),catalog:async()=>{serverCalls.push({action:'publication_catalog'});return info.catalog;}},
    noteProtectionAnalysis:{
      consumeHandoff:()=>{},
      status:id=>({scope:id==='other'?{...scope,local_id:'other'}:scope,phase}),
      inspectExecution:async()=>({request:{schema_version:legacy?1:3},input:'ORIGINAL',route:legacy?null:{provider:'omniroute',endpoint:config.omniUrl,model:'auto'},execution:{terminal_receipt:{outcome:'done'},source_context:{base:{base:{crypto_epoch:1,history_generation:1}}}}}),
      beginReplan:async(id,key,catalog,confirmation)=>{serverCalls.push({action:'replan_begin'});assert.equal(confirmation.confirmed_reuse_original_result,true);assert.equal(catalog.context.base.crypto_epoch,2);phase='analysis_replan_preparing';replan={plan:{prepare:{target_epoch:2}},stored:null};},
      inspectReplan:async()=>structuredClone(replan),
      resumeReplanPreparation:async()=>{serverCalls.push({action:'replan_prepare'});phase='analysis_replan_allocated';},
      prepareReplanCipher:async(id,oldKey,targetKey)=>{assert.equal(oldKey,'fixture-key');assert.equal(targetKey,'target-key');serverCalls.push({action:'replan_cipher'});phase='analysis_replan_prepared';},
      resumeReplanPublication:async(id,oldKey,targetKey)=>{assert.equal(targetKey,'target-key');serverCalls.push({action:'replan_publish'});phase='complete';},
      completeStoredReplan:async()=>{serverCalls.push({action:'replan_stored'});phase='complete';},
      start:async(s,r,input,route,key)=>{serverCalls.push({action:'start',key,input,route});return 'one-run';},
      resumeClaim:async id=>{assert.notEqual(phase,'analysis_dispatching');serverCalls.push({action:'claim',id});},
      recoverDispatch:async()=>{serverCalls.push({action:'status_only'});return {provider_state:'not_dispatched'};},
      beginPublication:async()=>{serverCalls.push({action:'publication_begin'});phase='analysis_write_preparing';},
      resumePublication:async()=>{serverCalls.push({action:'publication_resume'});phase='complete';return {operation_id:'one-run'};},
      readTerminal:async()=>{serverCalls.push({action:'publication_read'});return {result_json:'PUBLISHED-ORIGINAL'};},
      dispatch:async(id,key,c)=>{serverCalls.push({action:'dispatch',id,key,confirmation:c});return {operation_id:id,scope,route:{provider:c.provider,endpoint:c.endpoint,model:c.model},input:c.input};},
    },
    llmChatRequest:async(provider,c,input)=>{invocations++;assert.equal(c.omniModel,'combo-name');assert.equal(input,'ORIGINAL');return observation;},
    extractLlmChatText:(_p,d)=>d.choices[0].message.content,
  });
  vm.runInContext('let noteProtectionInternalEnabled=true;'+source.slice(start,end),box);
  const route=JSON.parse(JSON.stringify(box.protectedAnalysisRoute()));assert.equal(route.model,'auto');assert.equal(JSON.stringify(route).includes('synthetic-only'),false);
  for(const model of ['auto','combo-name','groq/llama-3.3-70b'])assert.equal(box.protectedAnalysisConfig({...route,model}).omniModel,model);
  assert.throws(()=>box.protectedAnalysisConfig({...route,endpoint:'http://user:password@127.0.0.1/v1'}));
  assert.throws(()=>box.protectedAnalysisConfig({...route,endpoint:'https://synthetic.invalid/v1?key=not-real'}));
  assert.throws(()=>box.protectedAnalysisConfig({...route,provider:'ollama'}));
  const descriptor={key:{kind:'note_body',id:'1'}},info={scope,pending:null,catalog:{entries:[descriptor],context:{base:{crypto_epoch:2,history_generation:5},selected_physical_note_id:1},catalog_digest:'digest'}};
  const plan=await box.prepareProtectedAnalysis(info,null,async()=> 'fixture-key');assert.ok(plan.input.endsWith('SOURCE\r\n'));assert.equal(plan.request.source_keys[0].descriptor,descriptor);
  let asked=0;await assert.rejects(()=>box.prepareProtectedAnalysis(info,'other',async()=>{asked++;return 'key';}));assert.equal(asked,0);
  const existing=await box.prepareProtectedAnalysis(info,'one-run',async()=> 'fixture-key');
  const handoff=await box.beginProtectedAnalysis(existing,{...route,model:'combo-name'},'fixture-key');assert.equal(serverCalls.length,2);assert.equal(serverCalls[1].confirmation.confirmed,true);
  const result=await box.invokeProtectedAnalysis(handoff);assert.equal(result.result_json,JSON.stringify({summary:'ORIGINAL\r\n'}));assert.equal(invocations,1);
  observation={ok:false,status:503,text:async()=>''};assert.equal((await box.invokeProtectedAnalysis(handoff)).error_message,'LLM HTTP 503');
  observation={ok:true,json:async()=>{throw Error('fixture_invalid_json');},text:async()=>'bad fixture'};assert.equal((await box.invokeProtectedAnalysis(handoff)).error_code,'invalid_result');
  observation={ok:true,json:async()=>{throw Error('fixture_body_interrupted');},text:async()=>{throw Error('fixture_body_interrupted');}};
  await assert.rejects(()=>box.invokeProtectedAnalysis(handoff),/미확정/);
  observation.ok=false;await assert.rejects(()=>box.invokeProtectedAnalysis(handoff),/미확정/);
  phase='analysis_dispatching';const callsBefore=serverCalls.length,providerBefore=invocations;
  assert.ok((await box.resumeProtectedAnalysis('one-run','fixture-key')).includes('아직 확인되지'));
  assert.equal(serverCalls.length,callsBefore+1);assert.equal(serverCalls.at(-1).action,'status_only');assert.equal(invocations,providerBefore);
  await box.beginProtectedAnalysis(existing,{...route,model:'combo-name'},'fixture-key');assert.equal(serverCalls.at(-1).action,'dispatch');assert.equal(serverCalls.length,callsBefore+2);
  phase='analysis_settled';const publicationStart=serverCalls.length;
  assert.equal(await box.publishProtectedAnalysis('one-run','fixture-key'),'PUBLISHED-ORIGINAL');assert.equal(invocations,providerBefore);
  assert.deepEqual(serverCalls.slice(publicationStart).map(c=>c.action),['publication_catalog','publication_begin','publication_resume','publication_read']);
  phase='analysis_write_committing';const publicationResume=serverCalls.length;
  assert.equal(await box.resumeProtectedAnalysis('one-run','fixture-key'),'PUBLISHED-ORIGINAL');assert.deepEqual(serverCalls.slice(publicationResume).map(c=>c.action),['publication_resume','publication_read']);
  const wrongTargetBefore=serverCalls.length;await assert.rejects(()=>box.publishProtectedAnalysis('other','fixture-key'));assert.equal(serverCalls.length,wrongTargetBefore);
  phase='analysis_settled';const replanView=await box.prepareProtectedReplan(info,'one-run','fixture-key');
  await box.prepareProtectedReplan({...info,scope:{...scope,url:scope.url+'/'}},'one-run','fixture-key');
  assert.equal(replanView.catalog.context.base.crypto_epoch,2);assert.equal(replanView.original_source_context.base.base.crypto_epoch,1);assert.equal(JSON.stringify(replanView).includes('ORIGINAL'),false);
  const beforeWrongScope=serverCalls.length;for(const field of ['owner','instance','device','local_id','url'])await assert.rejects(()=>box.prepareProtectedReplan({...info,scope:{...scope,[field]:'different'}},'one-run','fixture-key'));assert.equal(serverCalls.length,beforeWrongScope);
  const beforeConfirmation=serverCalls.length;await assert.rejects(()=>box.beginProtectedReplan(replanView,'fixture-key',{confirmed_reuse_original_result:false,target_epoch:2},async()=>'target-key'));assert.equal(serverCalls.length,beforeConfirmation);
  let targetAsks=0;const replanStart=serverCalls.length;
  assert.equal(await box.beginProtectedReplan(replanView,'fixture-key',{confirmed_reuse_original_result:true,target_epoch:2},async d=>{targetAsks++;assert.equal(d.representation_epoch,2);assert.equal(d.output,true);return 'target-key';}),'PUBLISHED-ORIGINAL');
  assert.deepEqual(serverCalls.slice(replanStart).map(c=>c.action),['replan_begin','replan_prepare','replan_cipher','replan_publish','publication_read']);assert.equal(targetAsks,1);assert.equal(invocations,providerBefore);
  phase='analysis_replan_allocated';await box.prepareProtectedReplan(info,'one-run','fixture-key');
  phase='analysis_replan_committing';const replanCold=serverCalls.length;
  await box.resumeProtectedAnalysis('one-run','fixture-key',async()=>'target-key');assert.deepEqual(serverCalls.slice(replanCold).map(c=>c.action),['replan_publish','publication_read']);
  phase='analysis_replan_stored';replan.stored={status:'already_stored'};const beforeStored=serverCalls.length;
  await box.resumeProtectedReplan('one-run','fixture-key',async()=>{throw Error('no target allocation key for stored result');});assert.deepEqual(serverCalls.slice(beforeStored).map(c=>c.action),['replan_stored','publication_read']);assert.equal(invocations,providerBefore);
  phase='complete';const beforeCompleted=serverCalls.length;
  assert.equal(await box.resumeProtectedAnalysis('one-run','fixture-key'),'PUBLISHED-ORIGINAL');assert.deepEqual(serverCalls.slice(beforeCompleted).map(c=>c.action),['publication_read']);
  legacy=true;phase='analysis_settled';const beforeLegacy=serverCalls.length;
  assert.equal(await box.resumeProtectedAnalysis('one-run','fixture-key'),'PUBLISHED-ORIGINAL');assert.deepEqual(serverCalls.slice(beforeLegacy).map(c=>c.action),['publication_read']);
  const beforeLegacyPublish=serverCalls.length;await assert.rejects(()=>box.publishProtectedAnalysis('one-run','fixture-key'),/재계획/);assert.equal(serverCalls.length,beforeLegacyPublish);
  await assert.rejects(()=>box.prepareProtectedAnalysis(info,'one-run',async()=>'fixture-key'),/재계획/);assert.equal(invocations,providerBefore);legacy=false;
  context={...context,owner:'bob'};const before=invocations;await assert.rejects(()=>box.invokeProtectedAnalysis(handoff));assert.equal(invocations,before);context={...scope,enabled:true};
  vm.runInContext('noteProtectionInternalEnabled=false;',box);await assert.rejects(()=>box.beginProtectedAnalysis(plan,route,'fixture-key'));await assert.rejects(()=>box.invokeProtectedAnalysis(handoff));assert.equal(invocations,before);
  await assert.rejects(()=>box.prepareProtectedReplan(info,'one-run','fixture-key'));await assert.rejects(()=>box.beginProtectedReplan(replanView,'fixture-key',{confirmed_reuse_original_result:true,target_epoch:2},async()=>'target-key'));await assert.rejects(()=>box.resumeProtectedReplan('one-run','fixture-key',async()=>'target-key'));assert.equal(invocations,before);
}
console.log('Protected analysis adapters: both apps, original source, exact route/auto/combo/provider model, invalid target/account/gate before call, terminal shape PASS (synthetic functions; no network)');
