import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const providers=['openai','groq','omniroute','grok','gemini','claude','ollama'];
for(const file of ['../app.js','../../desktop/app/app.js']){
  const source=await fs.readFile(new URL(file,import.meta.url),'utf8'),calls=[];
  const config={provider:'omniroute',apiKey:'synthetic-only',omniApiKey:'synthetic-only',omniUrl:'https://registered.invalid',omniModel:'Combo/auto',omniReasoning:'high',ollamaUrl:'http://127.0.0.1:11434',ollamaModel:'registered-model'};
  let key='owner-a',failure=false;
  const box=vm.createContext({structuredClone,URL,AbortSignal,state:{settings:{llm:structuredClone(config)}},wikiViewKey:()=>key,
    fetch:async(url,options)=>{calls.push({url,body:JSON.parse(options.body),bounded:Boolean(options.signal)});if(failure)throw Error('synthetic timeout');return {ok:true,json:async()=>({choices:[{message:{content:'synthetic output'}}]})};}});
  const slice=(from,to)=>source.slice(source.indexOf(from),source.indexOf(to,source.indexOf(from)));
  for(const [from,to] of [['function isLlmConfigured(','function defaultVoiceSettings('],['async function llmChatRequest(','async function callLlmChat('],['function wikiConnection(','async function openWikiProtection(']]){
    const text=slice(from,to);assert.ok(text.startsWith(from)&&text.length<15000,'function extraction boundary');vm.runInContext(text,box);
  }
  for(const provider of providers){
    await box.llmChatRequest(provider,config,'ordinary synthetic');const ordinary=calls.at(-1).body;
    const old=provider==='gemini'?ordinary.generationConfig.maxOutputTokens:ordinary.max_tokens;
    assert.equal(calls.at(-1).bounded,false,'ordinary request deadline is not changed');
    assert.equal(old,['omniroute','ollama'].includes(provider)?undefined:2048,'ordinary AI default must remain unchanged');
    await box.llmChatRequest(provider,config,'wiki synthetic',{purpose:'wiki-ingest',maxOutputTokens:4096});const wiki=calls.at(-1).body;
    const limit=provider==='gemini'?wiki.generationConfig.maxOutputTokens:['openai','groq'].includes(provider)?wiki.max_completion_tokens:wiki.max_tokens;
    assert.equal(limit,4096,provider+' Wiki output bound');
    assert.equal(calls.at(-1).bounded,true,'Wiki request needs a bounded one-attempt deadline');
    if(['openai','groq'].includes(provider))assert.equal(wiki.max_tokens,undefined,'do not send conflicting token fields');
    if(provider==='omniroute'){assert.equal(wiki.model,config.omniModel);assert.equal(wiki.reasoning_effort,'high');assert.equal(calls.at(-1).url,'https://registered.invalid/v1/chat/completions');}
    const before=calls.length;
    await assert.rejects(()=>box.llmChatRequest(provider,config,'invalid',{purpose:'wiki-ingest',maxOutputTokens:8192}),/위키|wiki/);assert.equal(calls.length,before);
  }
  const connection=box.wikiConnection();assert.equal(connection.outputTokens,4096);assert.equal(connection.callLimit,1);
  assert.equal(connection.reasoning,'high');const start=calls.length;await connection.invoke('synthetic only');await assert.rejects(()=>connection.invoke('duplicate'),/한 번|1회/);assert.equal(calls.length,start+1);
  const late=box.wikiConnection();key='owner-b';await assert.rejects(()=>late.invoke('do not send'),/계정|보호/);key='owner-a';
  const changed=box.wikiConnection();box.state.settings.llm.omniModel='different';await assert.rejects(()=>changed.invoke('do not send'),/설정|모델/);box.state.settings.llm.omniModel=config.omniModel;
  const timeout=box.wikiConnection();failure=true;const count=calls.length;await assert.rejects(()=>timeout.invoke('synthetic only'),/timeout/);
  await assert.rejects(()=>timeout.invoke('no automatic resend'),/한 번|1회/);assert.equal(calls.length,count+1);failure=false;
}
console.log('Wiki LLM budget: 7 providers x both actual app functions, ordinary defaults, Combo/auto/reasoning, one attempt, settings/scope/timeout rejection PASS (synthetic fetch only)');
