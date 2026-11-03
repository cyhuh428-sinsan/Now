const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadMain(primary) {
  const events = new Map(), windows = [], ready = [], handlers = [],callbacks=new Map();
  const calls = { locks: 0, quit: 0, external: 0 };
  let profile = 'D:/tmp/single-instance-unit';
  const app = { getPath: () => profile, setPath: (_key, value) => { profile = value; },
    requestSingleInstanceLock: () => { calls.locks++; return primary; }, quit: () => { calls.quit++; },
    whenReady: () => ({ then: fn => {ready.push(fn);return {catch(){}};} }), on: (event, fn) => events.set(event, fn) };
  class Window {
    static getAllWindows() { return windows.filter(w => !w.destroyed); }
    constructor() { this.events = new Map(); this.loads = 0; this.visible = true; this.minimized = false; this.focused = false; this.webContents = { setWindowOpenHandler() {},send(){} }; windows.push(this); }
    loadFile(file) { this.loads++; this.file = file; }
    on(event, fn) { this.events.set(event, fn); }
    once(event, fn) { this.events.set(event, fn); }
    isDestroyed() { return Boolean(this.destroyed); }
    isMinimized() { return this.minimized; }
    restore() { this.minimized = false; }
    show() { this.visible = true; }
    focus() { this.focused = true; }
  }
  const electron = { app, BrowserWindow: Window, Menu: { buildFromTemplate: t => t, setApplicationMenu() {} }, dialog: {},
    ipcMain: { handle: (name,fn) => {handlers.push(name);callbacks.set(name,fn);}, on: name => handlers.push(name) }, shell: { openExternal: () => { calls.external++; } } };
  const requireMock = name => {
    if (name === 'electron') return electron;
    if (name === 'node:fs') return { mkdirSync() {}, realpathSync: { native: p => path.resolve(p) } };
    if (name === './document-links.cjs') return {};
    if (name === './store-file.cjs') return {};
    if (name === './document-file.cjs') return {initialize(){},info:()=>({keys:[],retainedOriginal:false}),closeAll(){}};
    if (name === './history-session.cjs') return {createHistorySession:()=>({})};
    if (name === './app/workspace-navigation.js') return require('../app/workspace-navigation.js');
    if (name === './vault-service.cjs') return { createVaultService: () => ({}) };
    return require(name);
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../main.cjs'), 'utf8'), { require: requireMock, __dirname: path.resolve(__dirname, '..'), process: { env: {}, platform: 'win32',execPath:'C:/NowNote/NowNote.exe',argv:[] } });
  return { events, windows, ready, handlers, calls,callbacks };
}

test('a secondary app never initializes renderer, storage or Vault handlers', () => {
  const h = loadMain(false);
  assert.equal(h.calls.locks, 1);
  assert.equal(h.calls.quit, 1);
  assert.equal(h.ready.length, 0);
  assert.equal(h.windows.length, 0);
  assert.equal(h.handlers.length, 0);
});

test('early second launch is queued and later launches restore/show/focus the existing window without reload', () => {
  const h = loadMain(true);
  assert.equal(h.calls.locks, 1);
  h.events.get('second-instance')();
  assert.equal(h.windows.length, 0);
  h.ready[0]();
  const window = h.windows[0];
  assert.equal(window.loads, 1);
  window.minimized = true; window.visible = false; window.focused = false;
  h.events.get('second-instance')();
  assert.equal(window.minimized, false);
  assert.equal(window.visible, true);
  assert.equal(window.focused, true);
  assert.equal(window.loads, 1);
  assert.equal(h.windows.length, 1);
});

test('second-launch file arguments do not add a new document-opening capability', () => {
  const h = loadMain(true); h.ready[0]();
  const window = h.windows[0]; window.loadFile('existing-help.html');
  h.events.get('second-instance')({}, ['NowNote.exe', 'D:/tmp/argument.md'], 'D:/tmp', {});
  assert.equal(window.file, 'existing-help.html');
  assert.equal(window.loads, 2);
  assert.equal(h.calls.external, 0);
});
test('Wiki launch uses its independent entry and only the two exact top-level product frames can access shared storage',()=>{
  const h=loadMain(true);h.ready[0]();h.events.get('second-instance')({},[],null,{workspace:'wiki'});
  assert.equal(path.basename(h.windows[1].file),'wiki.html');
  const info=h.callbacks.get('nownote:desktop-store-info'),url=require('node:url').pathToFileURL;
  for(const name of ['index.html','wiki.html'])assert.equal(info({sender:{},senderFrame:{url:url(path.resolve(__dirname,'../app',name)).href}}).version,2);
  for(const name of ['help.html','other.html'])assert.throws(()=>info({sender:{},senderFrame:{url:url(path.resolve(__dirname,'../app',name)).href}}));
  assert.throws(()=>info({sender:{},senderFrame:{url:url(path.resolve(__dirname,'../app/wiki.html')).href,parent:{}}}));
});
test('native workspace navigation is bounded and consumed once by the memo frame only',()=>{
  const h=loadMain(true);h.ready[0]();h.events.get('second-instance')({},[],null,{workspace:'wiki'});
  const url=require('node:url').pathToFileURL,frame=(index,name)=>({sender:h.windows[index].webContents,senderFrame:{url:url(path.resolve(__dirname,'../app',name)).href}});
  const request={schema_version:1,action:'settings',local_id:null,owner:'alice',url:'',created_at:Date.now()},open=h.callbacks.get('nownote:open-workspace'),take=h.callbacks.get('nownote:take-workspace-navigation');
  open(frame(1,'wiki.html'),'note',request);assert.throws(()=>take(frame(1,'wiki.html')));
  assert.deepEqual(take(frame(0,'index.html')),request);assert.equal(take(frame(0,'index.html')),null);
  assert.throws(()=>open(frame(1,'wiki.html'),'wiki',request));assert.throws(()=>open(frame(1,'wiki.html'),'note',{...request,token:'synthetic'}));
});
