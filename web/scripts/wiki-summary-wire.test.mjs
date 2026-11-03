import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

for(const file of ['../app.js','../../desktop/app/app.js'])test(file+' summary request retains account/auth/cache and detail guard',async()=>{
  const source=await fs.readFile(new URL(file,import.meta.url),'utf8'),start=source.indexOf('async function wikiRead(');
  assert.ok(start>0);const code=source.slice(start,source.indexOf('\n}',start)+2);
  const ctx={enabled:true,online:true,url:'https://example.invalid',owner:'synthetic-owner',headers:{Authorization:'synthetic-only'}};
  let key='account-one',requests=[],release=null;
  const box=vm.createContext({URLSearchParams,AbortSignal,noteHistoryContext:()=>ctx,wikiViewKey:()=>key,
    fetch:async(url,options)=>{requests.push({url:new URL(url),options});return release?await new Promise(resolve=>{release.resolve=()=>resolve({ok:true,json:async()=>({items:[]})});}):{ok:true,json:async()=>({items:[]})};}});
  vm.runInContext(code,box);
  await box.wikiRead('',{summary:true});assert.equal(requests[0].url.searchParams.get('summary'),'true');
  assert.equal(requests[0].url.searchParams.get('include_deleted'),'true');
  assert.equal(requests[0].url.searchParams.get('owner_id'),ctx.owner);assert.equal(requests[0].options.cache,'no-store');
  assert.deepEqual(requests[0].options.headers,ctx.headers);
  await box.wikiRead('/selected-id',{summary:true});assert.equal(requests[1].url.searchParams.has('summary'),false);
  await box.wikiRead('');assert.equal(requests[2].url.searchParams.has('summary'),false,'explicit full operations retain default contract');
  release={};const pending=box.wikiRead('',{summary:true});key='account-two';release.resolve();
  await assert.rejects(pending,/계정·서버가 변경/);
  assert.match(source,/listRemote:async options=>\{const result=await wikiRead\("",options\);return result.items;\}/);
});
