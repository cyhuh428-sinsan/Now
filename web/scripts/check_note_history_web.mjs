// Run with ego-browser nodejs; requires the disposable run_note_history_qa.py API.
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { checkLegacyRaces } from './note_history_legacy_race_cases.mjs';
const base = globalThis.NOWNOTE_HISTORY_QA_BASE || 'D:/tmp/now-240-stage-e3';
const task = await taskSpace(globalThis.NOWNOTE_HISTORY_QA_TASK || 'NowNote E3 history QA 20261029'), page = task.page('p1');
await page.cdp('Emulation.setDeviceMetricsOverride', {width:1440,height:900,deviceScaleFactor:1,mobile:false});
await page.goto('http://localhost.:8750');
await page.waitForFunction(() => typeof noteHistoryContext === 'function' && Boolean(noteHistory) && (!loadWebSession()?.token || noteHistoryContext().enabled));
if (!await page.evaluate(() => noteHistoryContext().enabled)) {
  await page.fill('#webLoginOwnerInput', 'qa_history_alice');
  await page.fill('#webLoginPasswordInput', 'History-synthetic-only-42!'); await page.click('#webLoginSubmitBtn');
  await page.waitForFunction(() => noteHistoryContext().enabled);
}
const accounts = JSON.parse(await fs.readFile(base + '/synthetic-accounts.json', 'utf8'));
if(await page.evaluate(()=>Boolean(noteHistory.legacyPending()))) {
  await page.evaluate(()=>syncWebNotesToServer(undefined,{skipFormSave:true}));
  assert.equal(await page.evaluate(()=>noteHistory.legacyPending()),null,'resume the previous immutable v1 request before starting another QA note');
}
const results = [];
const record = async value => { results.push(value); console.log(value); await page.evaluate(value => { globalThis.__E3_QA_PHASE__ = value; }, value); };
const seed = await page.evaluate(async () => {
  let currentReads = 0; const original = noteHistoryRequest;
  noteHistoryRequest = (...args) => { if (args[1] === 'current') currentReads++; return original(...args); };
  try {
    const node = createNode('E3 최종 Web', 'first\n', null, 1); node.shared = true;
    state.data.tree.push(node); state.selectedTreeId = node.id; persist(); render(); await noteHistoryCaptureChain;
    return { id: node.id, currentReads, needsBaseline: noteHistory.view(node.id).needsBaseline,
      disk: JSON.parse(localStorage.getItem(NOTE_HISTORY_KEY)).contexts[NowNoteHistory.key(noteHistoryContext())].notes[node.id].draft.content };
  } finally { noteHistoryRequest = original; }
});
assert.equal(seed.disk, 'first\n'); assert.equal(seed.currentReads, 0); assert.equal(seed.needsBaseline, true);
await page.evaluate(() => noteHistoryFlush());
await record('draft durable before baseline network; actual v2 save and offline branch import');
const sendPeer = async content => {
  const item = await page.evaluate(id => noteHistory.view(id), seed.id);
  const response = await fetch('http://127.0.0.1:8750/api/v2/notes/current', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Now-User-Token': accounts.qa_history_alice.token },
    body: JSON.stringify({ schema_version: 1, owner_id: 'qa_history_alice', local_id: seed.id, device_id: 'history-electron', mutation_id: crypto.randomUUID(), crypto_epoch: 0,
      base_head_version: item.base.head_version, base_revision_id: item.base.head_revision_id, expected_inventory_revision_ids: item.base.inventory_revision_ids,
      note: Object.fromEntries(['note_type','title','parent_local_id','level','tags','source','deleted_at'].map(f => [f, item.draft[f]]).concat([['content', content]])) }),
  });
  assert.equal(response.status, 200, await response.text());
};
await sendPeer('clean peer update\n');
await page.evaluate(async () => { await noteHistory.sync(); await noteHistoryController.resume(); });
assert.equal(await page.evaluate(id => findTreeNode(state.data.tree, id).content, seed.id), 'clean peer update\n');
await record('clean managed note receives another device head through v2');
const restoreRef = await page.evaluate(id => noteHistory.view(id).base.head_revision_id, seed.id);
await page.fill('#treeContent', 'local conflict final\n');
await page.evaluate(async id => { await noteHistoryCaptureChain; await noteHistory.seal(id); }, seed.id);
await sendPeer('concurrent peer\n'); await page.evaluate(() => noteHistoryFlush());
assert.equal(await page.evaluate(id => noteHistory.view(id).conflict.code, seed.id), 'version_conflict');
await page.evaluate(id => noteHistoryUI.open(id), seed.id);
await page.selectOption('#noteHistoryDialog [name=after]', JSON.stringify({kind:'note_revision',id:restoreRef}));
await page.click('#noteHistoryDialog [data-action=restore]');
await page.waitForSelector('#noteHistoryDialog [role=alertdialog]');
assert.equal(await page.evaluate(() => document.activeElement.textContent), '취소');
await page.click('#noteHistoryDialog [role=alertdialog] button:last-child');
await page.waitForFunction(() => document.querySelector('#noteHistoryDialog .history-status').textContent.includes('복원 완료'));
assert.equal(await page.evaluate(id => noteHistory.view(id).dirty, seed.id), false);
await page.evaluate(() => noteHistoryFlush());
assert.equal(await page.evaluate(async id => (await noteHistoryRequest(noteHistoryContext(),'current','GET',{local_id:id})).snapshot.note.content, seed.id), 'clean peer update\n');
await record('actual 409 keeps draft; internal confirmation; explicit restore preserves previous state');
assert.equal(await page.evaluate(()=>{const r=document.querySelector('#noteHistoryDialog').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}),true);
await page.screenshot({ path: base + '/final-web-history.png' });
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
assert.equal(await page.evaluate(() => { const d = document.querySelector('#noteHistoryDialog'); return d.scrollWidth <= d.clientWidth + 1; }), true);
await page.screenshot({ path: base + '/final-web-mobile.png' });
await page.click('#noteHistoryDialog [data-action=close]');
await record('desktop and mobile history layout fits');
const lockResult = await page.evaluate(async () => {
  const name = 'nownote.e3.guard.qa.' + crypto.randomUUID();
  const make = () => NowLibrary.guardedWriter({ initial: null, read: () => localStorage.getItem(name),
    write: value => localStorage.setItem(name, value), lock: action => navigator.locks.request(name, action) });
  try {
    const a = make(), b = make(); const values = await Promise.allSettled([a({ pending: 'a' }), b({ pending: 'b' })]);
    return values.map(value => value.status).sort();
  } finally { localStorage.removeItem(name); }
});
assert.deepEqual(lockResult, ['fulfilled', 'rejected']); await record('actual Web Locks stale writer rejection');
const downloadPromise = page.waitForEvent('download', { timeout: 10000 }); await page.evaluate(() => downloadCurrentBackup('e3-final'));
const download = await downloadPromise; const backupPath = base + '/final-history-backup.json'; await download.saveAs(backupPath);
const backup = JSON.parse(await fs.readFile(backupPath, 'utf8'));
assert.ok(backup.history && backup.library && backup.data.worklogs);
await record('actual JSON download includes journal, library and worklogs');
await page.evaluate(() => handleWebLogout()); await page.waitForSelector('#webLoginOwnerInput');
assert.equal(await page.evaluate(() => noteHistory?.export()), null);
await page.fill('#webLoginOwnerInput', 'qa_history_bob'); await page.fill('#webLoginPasswordInput', 'History-synthetic-only-42!'); await page.click('#webLoginSubmitBtn');
await page.waitForFunction(() => noteHistoryContext().enabled);
assert.equal(await page.evaluate(id => noteHistory.view(id), seed.id), null);
await page.evaluate(() => handleWebLogout()); await page.waitForSelector('#webLoginOwnerInput');
await page.fill('#webLoginOwnerInput', 'qa_history_alice'); await page.fill('#webLoginPasswordInput', 'History-synthetic-only-42!'); await page.click('#webLoginSubmitBtn');
await page.waitForFunction(() => noteHistoryContext().enabled && !noteHistory.suspended());
assert.equal(await page.evaluate(id => noteHistory.view(id).draft.content, seed.id), 'clean peer update\n');
await record('logout memory released; Bob isolated; Alice actual reauthentication restores journal');
await page.evaluate(async id=>{state.selectedTreeId=id;render();await noteHistoryUI.open(id);},seed.id);
await page.selectOption('#noteHistoryDialog [name=after]',JSON.stringify({kind:'note_revision',id:restoreRef}));
await page.waitForFunction(()=>document.querySelector('#noteHistoryDialog .history-diff').textContent==='clean peer update\n');
await page.evaluate(()=>{const fetcher=globalThis.fetch;globalThis.__e3TargetFetcher=fetcher;globalThis.fetch=(...args)=>String(args[0]).includes('/api/v2/notes/revision?')?new Promise(resolve=>{globalThis.__e3TargetRelease=()=>resolve(fetcher(...args));}):fetcher(...args);});
await page.click('#noteHistoryDialog [data-action=restore]');
await page.waitForSelector('#noteHistoryDialog [role=alertdialog]');await page.click('#noteHistoryDialog [role=alertdialog] button:last-child');
await page.waitForFunction(()=>typeof globalThis.__e3TargetRelease==='function');
await page.evaluate(async id=>{const node=findTreeNode(state.data.tree,id);node.content='TARGET_GET_FOLLOWUP';markTreeNodeChanged(node);persist();await noteHistoryCaptureChain;},seed.id);
await page.evaluate(()=>{globalThis.__e3TargetRelease();globalThis.fetch=globalThis.__e3TargetFetcher;delete globalThis.__e3TargetRelease;delete globalThis.__e3TargetFetcher;});
await page.waitForFunction(()=>document.querySelector('#noteHistoryDialog .history-status').textContent.includes('복원 완료'));
assert.equal(await page.evaluate(id=>noteHistory.view(id).draft.content,seed.id),'TARGET_GET_FOLLOWUP');
assert.equal(await page.evaluate(id=>findTreeNode(state.data.tree,id).content,seed.id),'TARGET_GET_FOLLOWUP');
await page.click('#noteHistoryDialog [data-action=close]');await page.evaluate(()=>noteHistoryFlush());
await record('actual target revision GET delay retains later asynchronous edit in journal and editor');
for(const result of await checkLegacyRaces({run:expression=>page.evaluate(expression),
  until:expression=>page.waitForFunction(code=>(0,eval)(code),expression),restart:async()=>{
    await page.reload();await page.waitForFunction(()=>typeof noteHistoryContext==='function'&&noteHistoryContext().enabled&&!noteHistory.suspended());
  }}))await record(result);
await fs.writeFile(base + '/final-web-result.json', JSON.stringify({ id: seed.id, results }, null, 2));
console.log(results.join('\n'));
console.log(await page.snapshot());
