import { spawn, spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export function seedTree() {
  state.data.tree = [];
  state.expandedTreeIds = new Set();
  for (let i = 0; i < 35; i++) {
    const root = createNode(`QA topic ${i}`, '', null, 1);
    const child = createNode(`QA category ${i}`, '', root.id, 2);
    root.children.push(child);
    for (let j = 0; j < 5; j++) {
      child.children.push(createNode(`QA note ${i}-${j} long title for overflow verification`, `QA body ${i}-${j}\n` + 'Long synthetic content\n'.repeat(80), child.id, 3));
    }
    state.data.tree.push(root);
    state.expandedTreeIds.add(root.id);
    state.expandedTreeIds.add(child.id);
  }
  state.selectedTreeId = state.data.tree[0].children[0].children[0].id;
  setView('tree');
  const target = state.data.tree[22].children[0].children[2];
  const next = state.data.tree[22].children[0].children[3];
  document.querySelector(`[data-node-id="${target.id}"]`).scrollIntoView({ block: 'center' });
  return { target: target.id, next: next.id };
}

export function readTree() {
  const panel = document.querySelector('#treePanel');
  return { top: panel.scrollTop, listTop: document.querySelector('#treeList').scrollTop,
    selected: state.selectedTreeId, title: document.querySelector('#treeTitleInput').value,
    active: document.activeElement?.className, height: panel.clientHeight };
}

export async function verifyTreeActions(evaluate, click) {
  const run = fn => evaluate(`(${fn.toString()})()`);
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const before = await run(readTree);
  // Force layout while the list is temporarily empty to exercise scroll clamping.
  await run(() => {
    const list = elements.treeList, replace = list.replaceChildren.bind(list);
    list.replaceChildren = (...nodes) => { replace(); void elements.treePanel.offsetHeight; replace(...nodes); };
  });
  await click('.open-tab.active');
  const after = await run(readTree);
  assert(Math.abs(before.top-after.top) < 2 && before.selected === after.selected, 'Tab rerender lost tree scroll');
  const result = await run(() => {
    const selected = getSelectedTreeNode();
    const row = elements.treeList.querySelector(`[data-node-id="${selected.id}"] > .tree-row`);
    const label = row.querySelector('.tree-label-btn');
    const title = label.title === selected.title && label.scrollWidth <= row.clientWidth;
    const style = getComputedStyle(row.parentElement);
    return { title, border: style.borderTopWidth, background: style.backgroundColor,
      rowHeight: row.getBoundingClientRect().height, body: elements.treeContent.value === selected.content };
  });
  assert(result.title && result.body && result.border === '0px' && result.rowHeight <= 40, `Tree layout/content regression: ${JSON.stringify(result)}`);
  // Exercise existing add, reorder, collapse and expand controls on the synthetic category.
  const category = await run(() => state.data.tree[22].children[0].id);
  await click(`[data-node-id="${category}"] > .tree-row .small-btn`);
  const added = await run(() => ({ id: state.selectedTreeId, count: state.data.tree[22].children[0].children.length }));
  assert(added.count === 6, 'Add child failed');
  await click('#moveUpBtn');
  assert(await run(() => state.data.tree[22].children[0].children[4].id === state.selectedTreeId), 'Reorder failed');
  await click(`[data-node-id="${category}"] > .tree-row .tree-toggle`);
  assert(await evaluate(`!document.querySelector('[data-node-id="${added.id}"]')`), 'Collapse failed');
  await click(`[data-node-id="${category}"] > .tree-row .tree-toggle`);
  assert(await evaluate(`Boolean(document.querySelector('[data-node-id="${added.id}"]'))`), 'Expand failed');
  return { tab: { before, after }, layout: result, addReorderCollapse: true };
}

// Run the current Electron source with a disposable store, never the installed app.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const out = path.resolve(process.env.NOWNOTE_TREE_QA_DIR || 'D:/tmp/now-240-stage-a');
  await fs.mkdir(out, { recursive: true });
  const profile = await fs.mkdtemp(path.join(out, 'electron-'));
  const electron = path.join(root, 'desktop/node_modules/electron/dist/electron.exe');
  const listener = net.createServer();
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const env = { ...process.env, NOWNOTE_DESKTOP_USER_DATA_DIR: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  const proc = spawn(electron, [path.join(root, 'desktop'), `--remote-debugging-port=${port}`], {
    env, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true,
  });
  let stderr = '';
  proc.stderr.on('data', data => { stderr += data; });
  let ws;
  proc.on('error', error => { stderr += error.message; });
  try {
    let target;
    for (let n = 0; n < 60; n++) {
      try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(x => x.type === 'page'); } catch {}
      if (target) break;
      await delay(200);
    }
    if (!target) throw new Error(`Isolated Electron debug page unavailable: ${stderr.slice(-2000)}`);
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let serial = 0;
    const pending = new Map();
    ws.onmessage = ({ data }) => { const msg = JSON.parse(data); if (msg.id) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result); } };
    const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
    const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
    await send('Runtime.enable');
    for (let n = 0; n < 60; n++) { if (await evaluate("typeof state !== 'undefined' && Boolean(state.data)")) break; await delay(100); }
    const ids = await evaluate(`(${seedTree.toString()})()`);
    await delay(100);
    const rows = [];
    for (let n = 0; n < 12; n++) {
      const id = n % 3 === 2 ? ids.next : ids.target;
      const before = await evaluate(`(${readTree.toString()})()`);
      const point = await evaluate(`(() => { const r = document.querySelector('[data-node-id="${id}"] > .tree-row .tree-label-btn').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
      await delay(50);
      const after = await evaluate(`(${readTree.toString()})()`);
      rows.push({ before, after, id });
      if (Math.abs(before.top-after.top) > 2 || after.selected !== id) break;
    }
    const shot = await send('Page.captureScreenshot');
    await fs.writeFile(path.join(out, 'electron.png'), Buffer.from(shot.data, 'base64'));
    await fs.writeFile(path.join(out, 'electron-result.json'), JSON.stringify(rows, null, 2));
    console.log(`Electron repeated selection: ${rows.length} clicks, max scroll delta ${Math.max(...rows.map(r => Math.abs(r.before.top-r.after.top)))}`);
    if (rows.some(r => Math.abs(r.before.top-r.after.top) > 2 || r.after.selected !== r.id)) throw new Error('Tree selection lost scroll or selected document');
    const click = async selector => {
      const point = await evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); element.scrollIntoView({block:'nearest'}); const r=element.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    };
    console.log(await verifyTreeActions(evaluate, click));
  } finally {
    ws?.close();
    spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    await delay(300);
    await fs.rm(profile, { recursive: true, force: true });
  }
}
