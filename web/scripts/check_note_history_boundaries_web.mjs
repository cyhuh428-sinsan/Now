// Run with ego-browser nodejs after check_note_history_web.mjs in the same task.
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
const task = await taskSpace(globalThis.NOWNOTE_HISTORY_QA_TASK || 'NowNote E3 history QA 20261029'), page = task.page('p1');
await page.reload();
await page.waitForFunction(() => Boolean(noteHistory));
if (!await page.evaluate(() => noteHistoryContext().enabled)) {
  await page.fill('#webLoginOwnerInput','qa_history_alice');await page.fill('#webLoginPasswordInput','History-synthetic-only-42!');await page.click('#webLoginSubmitBtn');
}
await page.waitForFunction(() => noteHistoryContext().enabled && !noteHistory.suspended());
const unsupported = await page.evaluate(async () => {
  const original = noteHistory.export(), disk = localStorage.getItem(NOTE_HISTORY_KEY), fetcher = globalThis.fetch;
  let posts = 0;
  globalThis.fetch = (...args) => { if (args[1]?.method === 'POST' && String(args[0]).includes('/api/v1/sync')) posts++; return fetcher(...args); };
  const outcomes = [];
  try {
    for (const value of [{schema_version:99,opaque:'preserve'}, {schema_version:1,contexts:{bad:{notes:[]}}}]) {
      noteHistory.hydrate(value);
      await syncWebNotesToServer(undefined, {skipFormSave:true});
      outcomes.push({unsupported:noteHistory.status().unsupported, candidates:buildServerSyncNotes(state.settings.server).length,
        originalUnchanged:localStorage.getItem(NOTE_HISTORY_KEY)===disk, exportUnchanged:JSON.stringify(noteHistory.export())===JSON.stringify(value)});
    }
    return {posts,outcomes};
  } finally { globalThis.fetch = fetcher; noteHistory.hydrate(original); }
});
assert.equal(unsupported.posts,0);
for (const result of unsupported.outcomes) assert.deepEqual(result,{unsupported:true,candidates:0,originalUnchanged:true,exportUnchanged:true});
await page.evaluate(async () => {
  await noteHistory.sync();
  const node=createNode('E3 late baseline', 'preserved draft', null,1);node.shared=true;
  const original=globalThis.fetch;globalThis.__e3BoundaryOriginal=original;
  globalThis.fetch=(...args)=>String(args[0]).includes('/api/v2/notes/current')&&String(args[0]).includes(node.id)&&args[1]?.method==='GET'?new Promise((_resolve,reject)=>{globalThis.__e3RejectBaseline=reject;}):original(...args);
  state.data.tree.push(node);persist();await noteHistoryCaptureChain;
  globalThis.__e3BoundaryOperation=noteHistory.sync();
});
await page.waitForFunction(() => typeof globalThis.__e3RejectBaseline === 'function');
const beforeLogout = await page.evaluate(() => localStorage.getItem(NOTE_HISTORY_KEY));
await page.evaluate(() => clearWebSession());
await page.evaluate(async () => { globalThis.__e3RejectBaseline(new Error('synthetic late network failure'));await globalThis.__e3BoundaryOperation;globalThis.fetch=globalThis.__e3BoundaryOriginal;delete globalThis.__e3BoundaryOriginal;delete globalThis.__e3RejectBaseline;delete globalThis.__e3BoundaryOperation; });
assert.equal(await page.evaluate(() => localStorage.getItem(NOTE_HISTORY_KEY)),beforeLogout);
assert.equal(await page.evaluate(() => noteHistory.export()),null);
await page.reload();await page.waitForSelector('#webLoginOwnerInput');
await page.fill('#webLoginOwnerInput','qa_history_alice');await page.fill('#webLoginPasswordInput','History-synthetic-only-42!');await page.click('#webLoginSubmitBtn');
await page.waitForFunction(() => noteHistoryContext().enabled&&!noteHistory.suspended());
assert.equal(await page.evaluate(() => Object.values(noteHistory.entries()).some(item=>item.draft.title==='E3 late baseline'&&item.draft.content==='preserved draft')),true);
const scheduled = await page.evaluate(async()=>{
  await noteHistoryFlush();
  const node=createNode('E3 timer','first timer draft',null,1);node.shared=false;state.data.tree.push(node);persist();await noteHistoryCaptureChain;
  const timer=noteHistoryTimers.get(node.id),started=performance.now();node.content='second timer draft';markTreeNodeChanged(node);persist();await noteHistoryCaptureChain;
  return {id:node.id,started,stable:timer===noteHistoryTimers.get(node.id),revisions:noteHistory.view(node.id).revisions.length};
});
assert.equal(scheduled.stable,true);assert.equal(scheduled.revisions,0);
await page.waitForFunction(id=>noteHistory.view(id).revisions.length>0,scheduled.id,{timeout:35000});
const timerResult=await page.evaluate(({id,started})=>({elapsed:performance.now()-started,content:noteHistory.view(id).revisions.at(-1).snapshot.note.content}),scheduled);
assert.equal(timerResult.content,'second timer draft');assert.ok(timerResult.elapsed>=29000&&timerResult.elapsed<35000);
await fs.writeFile((globalThis.NOWNOTE_HISTORY_QA_BASE || 'D:/tmp/now-240-stage-e3')+'/final-web-boundaries.json',JSON.stringify({unsupported,lateBaseline:'actual clearWebSession logout boundary + delayed fetch rejection preserves journal; actual reauthentication recovers draft',timer:timerResult},null,2));
console.log('actual hosted Web: unsupported/malformed v1 POST0 + durable bytes/export preserved; logout late baseline rejection + reauthentication PASS');
