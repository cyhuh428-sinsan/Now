import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
async function fixture(){
  let config={provider:'omniroute',omniUrl:'https://synthetic.invalid/v1',omniModel:'auto',omniApiKey:'synthetic-only',omniReasoning:'high'},key='alice';const requests=[];
  const box=vm.createContext({URL,AbortSignal,structuredClone,fetch:async(url,request)=>{requests.push({url,body:JSON.parse(request.body)});return {ok:true,json:async()=>({choices:[{message:{content:'synthetic result'}}]})};}});
  vm.runInContext(await fs.readFile(new URL('../vendor/wiki-connection.js',import.meta.url),'utf8'),box);
  return {create:(purpose,verify)=>box.NowWikiConnection.create({readConfig:()=>config,contextKey:()=>key,purpose,verify}),requests,change:()=>{key='bob';},config:value=>{config={...config,...value};}};
}
test('independent Wiki connection preserves configured auto/Combo routing, reasoning, output budget and one explicit call',async()=>{
  const f=await fixture(),connection=f.create('wiki-ingest');assert.equal(f.requests.length,0);assert.equal(await connection.invoke('synthetic prompt'),'synthetic result');
  assert.equal(f.requests[0].url,'https://synthetic.invalid/v1/chat/completions');assert.equal(f.requests[0].body.model,'auto');assert.equal(f.requests[0].body.reasoning_effort,'high');assert.equal(f.requests[0].body.max_tokens,4096);
  await assert.rejects(connection.invoke('repeat'));assert.equal(f.requests.length,1);
  f.config({omniModel:'Combo/qa'});const next=f.create('wiki-query');await next.invoke('synthetic');assert.equal(f.requests[1].body.model,'Combo/qa');assert.equal(f.requests[1].body.max_tokens,2048);
});
test('account/config changes and unknown purpose fail before a Provider request',async()=>{
  const f=await fixture(),connection=f.create('wiki-ingest');f.change();await assert.rejects(connection.invoke('never send'));assert.equal(f.requests.length,0);
  const g=await fixture(),other=g.create('wiki-query');g.config({omniModel:'changed'});await assert.rejects(other.invoke('never send'));assert.equal(g.requests.length,0);assert.throws(()=>g.create('unknown'));
});
test('freshness guards run before transmission and after reply without retrying an uncertain request',async()=>{
  const f=await fixture(),blocked=f.create('wiki-ingest',async()=>{throw Error('changed store');});await assert.rejects(blocked.invoke('never send'));assert.equal(f.requests.length,0);
  let checks=0;const g=await fixture(),changed=g.create('wiki-query',async()=>{if(++checks===2)throw Error('changed store after reply');});
  await assert.rejects(changed.invoke('synthetic'),/changed store/);assert.equal(g.requests.length,1);await assert.rejects(changed.invoke('no retry'));assert.equal(g.requests.length,1);
});
