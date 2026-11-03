import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';
const source=await fs.readFile(new URL('../vendor/wiki-workspace.js',import.meta.url),'utf8');
test('independent Wiki commands await physical freshness before any history or UI action; failure never hydrates',async()=>{
 let release,checks=0,hydrations=0,enabled=true,fail=false;const box=vm.createContext({
  NowWikiServerAccess:{create:()=>({})},NowNoteWikiSources:{create:()=>({})},NowWikiLifecycle:{create:()=>({})},NowWikiSelectedPage:{create:()=>({})},
  createWikiNotebook:()=>({}),createWikiIngestNotebook:()=>({}),createWikiQueryNotebook:()=>({}),createLazyWikiView:value=>value,mountNowWiki:value=>value});
 vm.runInContext(source,box);const workspace=box.NowWikiWorkspace.create({context:()=>({enabled}),history:()=>({ensure:async()=>{hydrations++;}}),
  verifyFresh:async()=>{checks++;if(fail)throw Error('changed physical state');await new Promise(resolve=>{release=resolve;});}});
 const pending=workspace.view.prepare('open',['build']);await new Promise(resolve=>setImmediate(resolve));assert.equal(checks,1);assert.equal(hydrations,0);
 release();await pending;assert.equal(hydrations,1);
 fail=true;await assert.rejects(workspace.view.mount().prepare(),/changed physical/);assert.equal(hydrations,1);
 fail=false;const late=workspace.view.mount().prepare();await new Promise(resolve=>setImmediate(resolve));enabled=false;release();await assert.rejects(late,/확인|변경/);assert.equal(hydrations,1);
});
