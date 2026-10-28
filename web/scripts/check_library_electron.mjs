import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { launchApp, evaluate, stopProcess } from '../../desktop/scripts/check-desktop-storage.mjs';
const base = 'D:/tmp/now-240-stage-d';
const accounts = JSON.parse(await fs.readFile(`${base}/synthetic-accounts.json`, 'utf8'));
const seed = JSON.parse(await fs.readFile(`${base}/web-http-seed.json`, 'utf8'));
const alice = accounts.qa_library_alice;
const dir = await fs.mkdtemp(`${base}/electron-`);
const request = async (kind, id, method = 'GET', body) => {
  const r = await fetch(`http://127.0.0.1:8750/api/v1/${kind}${id ? '/' + id : '?owner_id=qa_library_alice&include_deleted=true'}`, { method,
    headers: { 'X-Now-Web-Session': alice.session, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const value = await r.json(); assert.equal(r.status, 200, JSON.stringify(value)); return value;
};
let first, second;
try {
  first = await launchApp(dir);
  const run = code => evaluate(first.page, code);
  await run(`(async () => { while (!libraryStore) await new Promise(r => setTimeout(r, 30)); state.settings.server = normalizeServerSettings({ ...state.settings.server, mode:'server', url:'http://127.0.0.1:8750', ownerId:'qa_library_alice', userToken:${JSON.stringify(alice.token)}, autoSync:false }); persistSettings(); await libraryStore.sync(); })()`);
  const templates = await run(`libraryStore.list('templates')`);
  assert.ok(templates.some(t => t.id === seed.template.id), 'Electron must see actual Web-created template');
  assert.ok((await run(`libraryStore.list('saved-queries')`)).some(q => q.id === seed.query.id));
  await run(`libraryUI.open()`);
  await run(`document.querySelector('#libraryList [data-id="${seed.template.id}"]').click()`);
  await run(`(() => { const e=document.querySelector('#libraryForm [name="content"]'); e.value='Electron 작성 현재본'; e.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#libraryDetail [data-action="save"]').click(); })()`);
  for (let n = 0; n < 100; n++) {
    if (await run(`libraryStore.list('templates').some(r=>r.id==='${seed.template.id}'&&r.version===${seed.template.version + 1}&&!r.pending)`)) break;
    await delay(50);
  }
  assert.equal(await run(`libraryStore.list('templates').find(r=>r.id==='${seed.template.id}').version`), seed.template.version + 1);
  assert.equal((await request('templates')).items.find(r => r.id === seed.template.id).payload.content_template, 'Electron 작성 현재본');
  // Disable the connection, not the scope: this models an offline persisted edit.
  const offline = await run(`(async () => {
    state.settings.server.mode='local'; persistSettings();
    const q=libraryStore.list('saved-queries').find(q=>q.id==='${seed.query.id}');
    q.payload.filter.text='Electron 오프라인 재시작';
    await libraryStore.put('saved-queries',q.id,q.payload);
    return libraryStore.status().outbox.find(o=>o.id===q.id);
  })()`);
  first.client.close(); stopProcess(first.app); first = null;
  await delay(400);
  second = await launchApp(dir);
  const rerun = code => evaluate(second.page, code);
  await rerun(`(async()=>{while(!libraryStore)await new Promise(r=>setTimeout(r,30));})()`);
  const restored = await rerun(`libraryStore.status().outbox.find(o=>o.id==='${seed.query.id}')`);
  assert.equal(restored.body.mutation_id, offline.body.mutation_id);
  assert.equal(restored.body.payload.filter.text, 'Electron 오프라인 재시작');
  await rerun(`(async()=>{state.settings.server.mode='server'; persistSettings(); await libraryStore.sync();})()`);
  assert.equal((await request('saved-queries')).items.find(r => r.id === seed.query.id).payload.filter.text, 'Electron 오프라인 재시작');
  // Recovered uncertain journal + actual replay receipt after a later deletion.
  const replay = await rerun(`(async()=>{const id=await libraryStore.put('templates',null,{name:'replay synthetic',content_template:'old'}); const snap=libraryStore.export(); await libraryStore.sync(); return {id,snap};})()`);
  const remote = (await request('templates')).items.find(r => r.id === replay.id);
  await request('templates', replay.id, 'DELETE', { owner_id: 'qa_library_alice', schema_version: 1, base_version: remote.version, mutation_id: crypto.randomUUID() });
  await rerun(`(async()=>{await libraryStore.import(${JSON.stringify(replay.snap)}); await libraryStore.sync();})()`);
  assert.equal(await rerun(`libraryStore.list('templates').some(r=>r.id==='${replay.id}')`), false);
  assert.ok((await request('templates')).items.find(r => r.id === replay.id).deleted_at);
  // The pending Alice operation may not be dispatched on Bob or another server identity.
  const pendingId = await rerun(`(async()=>{state.settings.server.mode='local';return libraryStore.put('templates',null,{name:'owner isolation pending',content_template:'alice only'});})()`);
  await rerun(`(async()=>{state.settings.server.ownerId='qa_library_bob'; state.settings.server.userToken=${JSON.stringify(accounts.qa_library_bob.token)}; state.settings.server.mode='server'; await libraryStore.sync();})()`);
  assert.equal((await request('templates')).items.some(r => r.id === pendingId), false);
  assert.equal(await rerun(`libraryStore.list('templates').some(r=>r.id==='${pendingId}')`), false);
  await rerun(`(async()=>{state.settings.server.ownerId='qa_library_alice'; state.settings.server.userToken=${JSON.stringify(alice.token)}; state.settings.server.url='http://localhost:8750'; await libraryStore.sync();})()`);
  assert.equal((await request('templates')).items.some(r => r.id === pendingId), false);
  await rerun(`(async()=>{state.settings.server.url='http://127.0.0.1:8750'; await libraryStore.sync();})()`);
  assert.equal((await request('templates')).items.find(r => r.id === pendingId).owner_id, 'qa_library_alice');
  // Plaintext derivation from an encrypted original remains forbidden even when unlocked.
  const blocked = await rerun(`(async()=>{
    const node=createNode('encrypted synthetic','NOW_ENCRYPTED_V1:synthetic',null,1);state.data.tree.push(node);state.selectedTreeId=node.id;
    unlockedEncryptedNotes.set(node.id,{plain:'must not derive'});
    libraryUI.close();await libraryUI.open();document.querySelector('#libraryDialog [data-action="capture"]').click();
    await new Promise(r=>setTimeout(r,30));return {status:document.querySelector('#libraryStatus').textContent,leaked:JSON.stringify(libraryStore.export()).includes('must not derive')};
  })()`);
  assert.equal(blocked.leaked, false);
  assert.ok(blocked.status.includes('암호화 원문'), blocked.status);
  await rerun(`libraryUI.close()`);
  const image = await second.page.send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(`${base}/electron.png`, Buffer.from(image.data, 'base64'));
  const result = { webToElectron: true, electronToServer: true, offlineRestart: true, immutableMutation: true, replayAfterDelete: true, accountAndServerIsolation: true, encryptedSourceBlocked: true };
  await fs.writeFile(`${base}/electron-http.json`, JSON.stringify(result, null, 2));
  console.log('Stage D Electron real HTTP:', result);
} finally {
  first?.client?.close(); second?.client?.close(); stopProcess(first?.app); stopProcess(second?.app);
  await delay(400); await fs.rm(dir, { recursive: true, force: true });
}
