import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
const task=await taskSpace('NowNote Stage D');
let label='p2';
try { label=JSON.parse(await fs.readFile('D:/tmp/now-240-stage-d/hosted-page.json','utf8')).page; } catch {}
const page=task.page(label);
await page.reload();
await page.waitForFunction(()=>Boolean(libraryStore&&libraryUI&&libraryContext().enabled));
const result=await page.evaluate(async()=>{
  await libraryStore.sync();
  const id=await libraryStore.put('saved-queries',null,{name:'guarded writer HTTP QA',filter:{text:'synthetic'}});
  await libraryStore.sync();
  const remote=libraryStore.list('saved-queries').find(r=>r.id===id);
  const testKey='nownote.library.guarded.qa.'+crypto.randomUUID();
  const create=()=>NowLibrary.guardedWriter({initial:null,read:()=>localStorage.getItem(testKey),write:value=>localStorage.setItem(testKey,value),lock:fn=>navigator.locks.request(testKey,fn)});
  const a=create(),b=create();
  const writes=await Promise.allSettled([a({outbox:['first pending']}),b({outbox:['second pending']})]);
  const persisted=JSON.parse(localStorage.getItem(testKey));
  localStorage.removeItem(testKey);
  return {httpSaved:remote.version>0&&!remote.pending,locks:typeof navigator.locks.request==='function',fulfilled:writes.filter(r=>r.status==='fulfilled').length,rejected:writes.filter(r=>r.status==='rejected').length,persisted};
});
assert.equal(result.httpSaved,true);assert.equal(result.locks,true);assert.equal(result.fulfilled,1);assert.equal(result.rejected,1);assert.equal(result.persisted.outbox.length,1);
await fs.writeFile('D:/tmp/now-240-stage-d/final-web-guard.json',JSON.stringify(result,null,2));
console.log('Stage D latest Web writer: actual HTTP save + origin lock/stale-journal rejection PASS');
