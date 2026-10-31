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
  let phase='analysis_claimed';
  const box=vm.createContext({URL,crypto:webcrypto,structuredClone,state:{settings:{llm:config}},
    NowNoteProtectionProtocol:{canonicalJson:JSON.stringify},noteProtectionIdentity:{instance:scope.instance},
    noteHistoryContext:()=>context,protectionActionGuard:()=>()=>{},isLlmConfigured:()=>true,
    omniRouteBaseUrl:s=>s.trim().replace(/\/+$/,''),
    noteProtectionReader:{read:async()=>({value:'SOURCE\r\n'})},
    noteProtectionAnalysis:{
      consumeHandoff:()=>{},
      status:id=>({scope:id==='other'?{...scope,local_id:'other'}:scope,phase}),
      inspectExecution:async()=>({input:'ORIGINAL',route:{provider:'omniroute',endpoint:config.omniUrl,model:'auto'}}),
      start:async(s,r,input,route,key)=>{serverCalls.push({action:'start',key,input,route});return 'one-run';},
      resumeClaim:async id=>{assert.notEqual(phase,'analysis_dispatching');serverCalls.push({action:'claim',id});},
      recoverDispatch:async()=>{serverCalls.push({action:'status_only'});return {provider_state:'not_dispatched'};},
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
  const descriptor={key:{kind:'note_body',id:'1'}},info={scope,pending:null,catalog:{entries:[descriptor],context:{selected_physical_note_id:1},catalog_digest:'digest'}};
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
  context={...context,owner:'bob'};const before=invocations;await assert.rejects(()=>box.invokeProtectedAnalysis(handoff));assert.equal(invocations,before);context={...scope,enabled:true};
  vm.runInContext('noteProtectionInternalEnabled=false;',box);await assert.rejects(()=>box.beginProtectedAnalysis(plan,route,'fixture-key'));await assert.rejects(()=>box.invokeProtectedAnalysis(handoff));assert.equal(invocations,before);
}
console.log('Protected analysis adapters: both apps, original source, exact route/auto/combo/provider model, invalid target/account/gate before call, terminal shape PASS (synthetic functions; no network)');
