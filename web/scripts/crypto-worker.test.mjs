import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';import {webcrypto} from 'node:crypto';
async function client({script='https://qa.invalid/app/app.js'}={}){
  const workers=[];let timeout;
  class Worker{constructor(url){this.url=url;this.terminated=0;workers.push(this);}postMessage(value){this.request=structuredClone(value);}terminate(){this.terminated++;}}
  const box=vm.createContext({Worker,URL,document:{currentScript:{src:script}},location:{href:'https://qa.invalid/app/'},crypto:webcrypto,
    setTimeout:fn=>{timeout=fn;return 1;},clearTimeout(){}});
  vm.runInContext(await fs.readFile(new URL('../vendor/crypto-worker-client.js',import.meta.url),'utf8'),box);
  return {box,workers,timeout:()=>timeout()};
}
test('large explicit crypto uses one fixed same-origin worker and terminates after a bound result',async()=>{
  const f=await client(),api=f.box.NowNoteCryptoWorker;assert.equal(f.workers.length,0);assert.equal(api.canRun('short'),false);assert.equal(api.canRun('x'.repeat(65536)),true);
  const promise=api.execute('encrypt','x'.repeat(65536),'synthetic-only'),worker=f.workers[0];assert.equal(worker.url,'https://qa.invalid/app/crypto-worker.js');
  assert.equal(worker.request.operation,'encrypt');assert.equal(worker.request.password,'synthetic-only');
  worker.onmessage({data:{schema_version:1,id:worker.request.id,value:'cipher'}});assert.equal(await promise,'cipher');assert.equal(worker.terminated,1);assert.equal(worker.onmessage,null);
});
test('worker failure, timeout and malformed replies reject without fallback or retry',async()=>{
  for(const mode of ['failure','timeout','mismatch']){const f=await client(),promise=f.box.NowNoteCryptoWorker.execute('decrypt','cipher','synthetic-only'),worker=f.workers[0];
    if(mode==='failure')worker.onerror({preventDefault(){}});else if(mode==='timeout')f.timeout();else worker.onmessage({data:{schema_version:1,id:'foreign',value:'must not be used'}});
    await assert.rejects(promise);assert.equal(f.workers.length,1);assert.equal(worker.terminated,1);
  }
});
test('an external script base cannot start a worker',async()=>{
  const f=await client({script:'https://foreign.invalid/app.js'});await assert.rejects(f.box.NowNoteCryptoWorker.execute('encrypt','text','synthetic-only'));assert.equal(f.workers.length,0);
});
test('account invalidation cancels every pending worker and late results cannot revive it',async()=>{
  const f=await client(),one=f.box.NowNoteCryptoWorker.execute('decrypt','cipher','synthetic-only'),two=f.box.NowNoteCryptoWorker.execute('encrypt','text','synthetic-only');
  const late=f.workers[0].onmessage;f.box.NowNoteCryptoWorker.cancelAll();
  await assert.rejects(one,/cancelled/);await assert.rejects(two,/cancelled/);assert.ok(f.workers.every(worker=>worker.terminated===1));
  late({data:{schema_version:1,id:f.workers[0].request.id,value:'must not be returned'}});assert.equal(f.workers[0].terminated,1);
});
test('the existing protocol delegates only large strings and retains short-value compatibility',async()=>{
  const calls=[],box=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,btoa,atob,NowNoteCryptoWorker:{canRun:value=>value.length>=65536,execute:async(...args)=>{calls.push(args);return 'worker-result';}}});
  vm.runInContext(await fs.readFile(new URL('../vendor/note-protection-protocol.js',import.meta.url),'utf8'),box);
  const api=box.NowNoteProtectionProtocol;assert.ok(await api.encryptContent('x'.repeat(65536),'synthetic-only')==='worker-result');assert.equal(calls[0][0],'encrypt');
  assert.equal(await api.decryptContent('NOW_ENCRYPTED_V1:'+'x'.repeat(65536),'synthetic-only'),'worker-result');assert.equal(calls[1][0],'decrypt');
  const cipher=await api.encryptContent('small synthetic text','synthetic-only');assert.equal(await api.decryptContent(cipher,'synthetic-only'),'small synthetic text');assert.equal(calls.length,2);
});
test('large typed envelope normalization uses the same strict parser off the editor thread',async()=>{
  const calls=[],box=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,btoa,atob,NowNoteCryptoWorker:{canRun:value=>value.length>=65536,
    execute:async(operation,value)=>{calls.push(operation);return operation==='parse'?JSON.stringify(JSON.parse(value)):'synthetic-cipher';}}});
  vm.runInContext(await fs.readFile(new URL('../vendor/note-protection-protocol.js',import.meta.url),'utf8'),box);
  const key={kind:'recording_transcript',id:'7',slot:'transcript'},uuid=()=>webcrypto.randomUUID(),binding={server_instance_id:uuid(),owner_id:'alice',local_id:'memo',transition_id:uuid(),crypto_epoch:2,destination_key:key,revision_ref:null,parent_ref:null};
  await box.NowNoteProtectionProtocol.encryptRepresentation('Synthetic text. '.repeat(6000),{key,output_kind:'linked_text_envelope_v1',output_epoch:2,is_null:false,expected_binding:binding,operation_origin:null},'synthetic-only');
  assert.ok(calls.includes('parse'));assert.ok(calls.includes('encrypt'));
});
test('worker host executes the unchanged protocol and releases request text after an exact crypto round trip',async()=>{
  const replies=[];let closed=0;const box=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,btoa,atob,postMessage:value=>replies.push(structuredClone(value)),close(){closed++;}});
  const protocol=await fs.readFile(new URL('../vendor/note-protection-protocol.js',import.meta.url),'utf8'),host=await fs.readFile(new URL('../vendor/crypto-worker-host.js',import.meta.url),'utf8');
  vm.runInContext(protocol,box);vm.runInContext(host,box);
  const text='Synthetic transcript. '.repeat(5000),request={schema_version:1,id:webcrypto.randomUUID(),operation:'encrypt',value:text,password:'synthetic-only'};
  await box.onmessage({data:request});assert.equal(request.value,'');assert.equal(request.password,'');assert.equal(closed,1);assert.equal(replies.length,1);
  assert.ok(replies[0].value.startsWith('NOW_ENCRYPTED_V1:'));assert.equal(await box.NowNoteProtectionProtocol.decryptContent(replies[0].value,'synthetic-only'),text);
  const secondReplies=[],second=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,btoa,atob,postMessage:value=>secondReplies.push(structuredClone(value)),close(){}});
  vm.runInContext(protocol,second);vm.runInContext(host,second);
  await second.onmessage({data:{schema_version:1,id:webcrypto.randomUUID(),operation:'decrypt',value:replies[0].value,password:'synthetic-only'}});
  assert.ok(secondReplies[0].value===text);
});
test('parse jobs retain strict duplicate/unicode validation and return only verified JSON',async()=>{
  const protocol=await fs.readFile(new URL('../vendor/note-protection-protocol.js',import.meta.url),'utf8'),host=await fs.readFile(new URL('../vendor/crypto-worker-host.js',import.meta.url),'utf8');
  for(const [raw,valid]of [['{"text":"Synthetic 한국어\\r\\n"}',true],['{"a":1,"a":2}',false]]){
    const replies=[],box=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,btoa,atob,postMessage:value=>replies.push(structuredClone(value)),close(){}});
    vm.runInContext(protocol,box);vm.runInContext(host,box);const request={schema_version:1,id:webcrypto.randomUUID(),operation:'parse',value:raw,password:''};await box.onmessage({data:request});
    assert.equal(replies.length,1);if(valid)assert.deepEqual(JSON.parse(replies[0].value),JSON.parse(raw));else assert.match(replies[0].error,/^note_protection:/);
    assert.equal(request.value,'');
  }
});
