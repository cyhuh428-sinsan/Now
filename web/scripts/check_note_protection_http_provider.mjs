import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{startSyntheticProvider}=require('./note_protection_http_provider.cjs');
const run='012345abcdef';
const provider=await startSyntheticProvider({run,mode:'web'});
try{
  const headers={Origin:'http://localhost.:8750',Authorization:'Bearer synthetic-only','Content-Type':'application/json'};
  const preflight=await fetch(provider.baseUrl+'/chat/completions',{method:'OPTIONS',headers:{Origin:headers.Origin}});
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),headers.Origin);
  const body={model:'auto',messages:[{role:'user',content:'SYNTHETIC-LLM-INPUT-'+run+'\nHTTP-QA-ORIGINAL-'+run+'\r\n'}],stream:false};
  const response=await fetch(provider.baseUrl+'/chat/completions',{method:'POST',headers,body:JSON.stringify(body)});
  assert.equal(response.status,200);assert.equal((await response.json()).choices[0].message.content,'SYNTHETIC-LLM-RESULT-'+run+'\r\n');
  const invalid=await fetch(provider.baseUrl+'/chat/completions',{method:'POST',headers,body:JSON.stringify({...body,model:'wrong-fixture-model'})});
  assert.equal(invalid.status,400);assert.deepEqual(provider.stats(),{calls:2,matched:1});
}finally{await provider.close();}
assert.equal(provider.isListening(),false);
console.log('Synthetic Provider fixture: loopback HTTP/CORS, exact fixed QA input/model, mismatch denial, explicit close PASS (no external Provider)');
