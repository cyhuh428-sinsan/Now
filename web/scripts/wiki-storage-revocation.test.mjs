import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';
const source=await fs.readFile(new URL('../wiki-shell.js',import.meta.url),'utf8');
test('an external storage change immediately revokes selected proof, cancels workers and removes displayed Wiki text without writing storage',()=>{
 const start=source.indexOf('  function externalStorageChanged('),end=source.indexOf('  async function verifyStoredRevision(',start);
 assert.ok(start>0&&end>start,'independent Wiki must revoke remote-window changes');
 let invalidated=0,cancelled=0,closed=0;const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{textContent:'',replaceChildren(){this.textContent='';}});return elements.get(id);};el('#wikiWorkspaceHost').textContent='OLD PLAIN WIKI';
 const box=vm.createContext({frozen:false,generation:0,history:{invalidate(){invalidated++;}},workspace:{view:{close(){closed++;}}},remoteSources:new Map(),
  NowNoteCryptoWorker:{cancelAll(){cancelled++;}},$:el,status:message=>{el('#wikiShellStatus').textContent=message;}});
 vm.runInContext(source.slice(start,end),box);box.externalStorageChanged('nownote.history.v1');
 assert.equal(box.frozen,true);assert.equal(box.generation,1);assert.equal(invalidated,1);assert.equal(cancelled,1);assert.equal(closed,1);assert.equal(el('#wikiWorkspaceHost').textContent,'');
 box.externalStorageChanged('unknown');assert.equal(box.generation,1);
});
test('focus checks actual storage stamp, hides the host while awaiting and never accepts cached preview stamp after a physical change',async()=>{
 const start=source.indexOf('  async function verifyStoredRevision('),end=source.indexOf('  async function refreshSettings(',start);assert.ok(start>0&&end>start,'actual storage freshness must be checked on focus');
 let release,revocations=0;const host={hidden:false,style:{opacity:''}};const box=vm.createContext({storageCheck:null,frozen:false,history:{deferred:()=>true,wikiIndex:()=>({stamp:'cached-old'})},backend:{stamp:()=> 'cached-old'},
  context:()=>({enabled:true}),contextKey:()=> 'same-account',readPath:()=>new Promise(resolve=>{release=resolve;}),$:()=>host,
  externalStorageChanged(){revocations++;box.frozen=true;},HISTORY:'nownote.history.v1'});
 vm.runInContext(source.slice(start,end),box);const pending=box.verifyStoredRevision();assert.equal(host.style.opacity,'0');assert.equal(host.hidden,false,'verification must preserve the workspace layout');
 release({stamp:'physically-protected'});await pending;assert.equal(revocations,1);assert.equal(box.frozen,true);
});
