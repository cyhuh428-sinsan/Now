import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
test('independent Wiki entry loads only its core/shell and retains all approved build/use entries',async()=>{
  const html=await fs.readFile(new URL('../wiki.html',import.meta.url),'utf8');
  assert.ok(html.includes('wiki-core.js'));assert.ok(html.includes('wiki-shell.js'));assert.ok(!/src=["'][^"']*\bapp\.js/.test(html));
  for(const mode of ['sources','build','lint','browse','query','graph'])assert.ok(html.includes('data-wiki-view="'+mode+'"'),mode);
  assert.ok(!html.includes('id="treeContent"'));assert.ok(html.includes('id="wikiWorkspaceHost"'));assert.ok(html.includes('autocomplete="one-time-code"'));
  const policy=html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
  assert.ok(policy);assert.ok(policy.includes("script-src 'self'"));assert.ok(!policy.includes("'unsafe-eval'"));
  for(const rule of ["object-src 'none'","base-uri 'none'","form-action 'none'","frame-src 'none'","connect-src 'self' http: https:"])assert.ok(policy.includes(rule));
});

test('offline authentication failure shows the login boundary without opening history or discarding saved data',async()=>{
  const elements=new Map(),session={ownerId:'alice',token:'synthetic',deviceId:'web-client'};let opens=0,clears=0;
  const element=id=>{if(!elements.has(id))elements.set(id,{hidden:true,textContent:'',addEventListener(){},replaceChildren(){}});return elements.get(id);};
  const box=vm.createContext({
    document:{querySelector:element,querySelectorAll:()=>[],documentElement:{dataset:{},style:{setProperty(){},removeProperty(){}}}},
    location:new URL('https://qa.invalid/wiki/'),URL,URLSearchParams,isSecureContext:false,
    localStorage:{getItem:()=>null},sessionStorage:{},navigator:{onLine:false},window:{addEventListener(){}},
    matchMedia:()=>({matches:true,addEventListener(){}}),fetch:async()=>{throw new TypeError('Failed to fetch');},
    NowWebSessionStorage:{create:()=>({load:()=>session,invalidated:()=>false,clear(){clears++;}})},
    NowHistoryPersistence:{create(){opens++;throw Error('history must remain locked');}}
  });
  vm.runInContext(await fs.readFile(new URL('../wiki-shell.js',import.meta.url),'utf8'),box);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(element('#wikiLogin').hidden,false);assert.equal(element('#wikiShell').hidden,true);
  assert.match(element('#wikiLoginStatus').textContent,/연결|확인/);assert.equal(opens,0);assert.equal(clears,0);
});

test('full Wiki consumers load authenticated source availability before Query, Lint and graph verification',async()=>{
  const source=await fs.readFile(new URL('../wiki-shell.js',import.meta.url),'utf8');
  const start=source.indexOf('  async function open(view){'),end=source.indexOf('  function invalidate()',start);
  for(const view of ['browse','sources','build','query','lint','graph']){
    const calls=[],box=vm.createContext({context:()=>({enabled:true}),status(){},history:{ensure:async()=>calls.push('full')},
      loadSources:async()=>calls.push('sources'),workspace:{view:{open:async mode=>calls.push(mode)}},document:{querySelectorAll:()=>[]}});
    vm.runInContext(source.slice(start,end),box);await box.open(view);
    assert.deepEqual(calls,view==='browse'?['browse']:['full','sources',view]);
  }
});

test('a current 401 response revokes the independent workspace and cancels workers without deleting saved data',async()=>{
  const source=await fs.readFile(new URL('../wiki-shell.js',import.meta.url),'utf8'),elements=new Map();let cancelled=0,cleared=0,closed=0,invalidated=0;
  const element=id=>{if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',replaceChildren(){}});return elements.get(id);};
  const box=vm.createContext({URLSearchParams,AbortSignal,generation:0,authenticated:true,history:{invalidate(){invalidated++;}},workspace:{view:{close(){closed++;}}},remoteSources:new Map(),
    context:()=>({enabled:box.authenticated,online:true,url:'https://qa.invalid',headers:{}}),contextKey:()=>String(box.generation),
    fetch:async()=>({ok:false,status:401,json:async()=>({detail:{code:'session_expired'}})}),
    session:{clear(){cleared++;}},NowNoteCryptoWorker:{cancelAll(){cancelled++;}},$:element,document:{documentElement:{dataset:{auth:'unlocked'}}}});
  for(const [start,end]of [['  async function request(','  async function historyRequest('],['  function invalidate()','  async function login(']])vm.runInContext(source.slice(source.indexOf(start),source.indexOf(end)),box);
  await assert.rejects(box.request('/api/v1/wikis'));
  assert.equal(box.authenticated,false);assert.equal(cancelled,1);assert.equal(closed,1);assert.equal(invalidated,1);assert.equal(cleared,1);
  assert.equal(element('#wikiLogin').hidden,false);assert.equal(element('#wikiShell').hidden,true);
});
