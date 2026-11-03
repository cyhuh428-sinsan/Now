import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
async function fixture(scope){
  const handlers=new Map(),deleted=[],added=[],writes=[],matches=[],events=[];
  const own='nownote-shell:'+encodeURIComponent(new URL(scope).pathname)+':',keys=[own+'v-old','other-product', 'nownote-shell:'+encodeURIComponent('/other/')+':v-old'];
  const cache={addAll:async urls=>added.push(...urls),put:async(key,value)=>writes.push(key),match:async key=>{matches.push(key);return 'owned cached shell';}};
  const self={registration:{scope},location:new URL(scope+'sw.js'),addEventListener:(key,fn)=>handlers.set(key,fn),skipWaiting(){},clients:{claim(){}}};
  let networkFails=false;
  const box=vm.createContext({self,URL,caches:{keys:async()=>keys,delete:async key=>deleted.push(key),open:async()=>cache},fetch:async()=>{if(networkFails)throw Error('offline');return {ok:true,clone:()=>({})};}});
  vm.runInContext(await fs.readFile(new URL('../sw.js',import.meta.url),'utf8'),box);
  const run=async(name,request)=>{let response;handlers.get(name)({request,waitUntil:value=>events.push(value),respondWith:value=>{response=value;}});await Promise.all(events.splice(0));return response===undefined?undefined:await response;};
  return {run,deleted,added,writes,matches,own,offline:()=>{networkFails=true;}};
}
test('Wiki and memo service workers cache separate shells and only retire their own scoped versions',async()=>{
  for(const mode of ['wiki','app','nested/wiki']){const f=await fixture('https://qa.invalid/'+mode+'/');await f.run('install');await f.run('activate');
    const wiki=mode.endsWith('wiki');
    assert.deepEqual(f.deleted,[f.own+'v-old']);assert.equal(f.added.includes('./app.js'),!wiki);assert.equal(f.added.includes('./wiki-core.js'),wiki);
  }
});
test('workers never serve API or foreign responses from a shared cache and canonicalize only known shell asset queries',async()=>{
  const f=await fixture('https://qa.invalid/wiki/');
  assert.equal(await f.run('fetch',{method:'GET',url:'https://qa.invalid/api/v1/wikis'}),undefined);
  assert.equal(await f.run('fetch',{method:'GET',url:'https://other.invalid/wiki/wiki-core.js'}),undefined);
  assert.equal(await f.run('fetch',{method:'POST',url:'https://qa.invalid/wiki/wiki-core.js'}),undefined);
  await f.run('fetch',{method:'GET',url:'https://qa.invalid/wiki/wiki-core.js?v=241'});assert.deepEqual(f.writes,['https://qa.invalid/wiki/wiki-core.js']);
  f.offline();assert.equal(await f.run('fetch',{method:'GET',url:'https://qa.invalid/wiki/wiki-core.js?v=241'}),'owned cached shell');assert.deepEqual(f.matches,['https://qa.invalid/wiki/wiki-core.js']);
});

test('network response is cloned before the page can consume its body while cache opening is delayed',async()=>{
  const handlers=new Map(),waits=[];let unlock,consumed=false,stored=false;
  const opened=new Promise(resolve=>{unlock=resolve;}),response={ok:true,type:'basic',url:'https://qa.invalid/wiki/wiki-shell.js',
    clone(){if(consumed)throw Error('response body already consumed');return {copy:true};}};
  const self={registration:{scope:'https://qa.invalid/wiki/'},addEventListener:(name,handler)=>handlers.set(name,handler)};
  const box=vm.createContext({self,URL,fetch:async()=>response,caches:{open:()=>opened}});
  vm.runInContext(await fs.readFile(new URL('../sw.js',import.meta.url),'utf8'),box);
  let result;handlers.get('fetch')({request:{method:'GET',url:response.url},waitUntil:promise=>waits.push(promise),respondWith:promise=>{result=promise;}});
  assert.equal(await result,response);consumed=true;
  unlock({put:async(_key,copy)=>{assert.equal(copy.copy,true);stored=true;}});
  await Promise.all(waits);assert.equal(stored,true);
});
