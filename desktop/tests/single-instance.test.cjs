const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadMain(primary) {
  const events = new Map(), windows = [], ready = [], handlers = [];
  const calls = { locks: 0, quit: 0, external: 0 };
  let profile = 'D:/tmp/single-instance-unit';
  const app = { getPath: () => profile, setPath: (_key, value) => { profile = value; },
    requestSingleInstanceLock: () => { calls.locks++; return primary; }, quit: () => { calls.quit++; },
    whenReady: () => ({ then: fn => ready.push(fn) }), on: (event, fn) => events.set(event, fn) };
  class Window {
    static getAllWindows() { return windows.filter(w => !w.destroyed); }
    constructor() { this.events = new Map(); this.loads = 0; this.visible = true; this.minimized = false; this.focused = false; this.webContents = { setWindowOpenHandler() {} }; windows.push(this); }
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
    ipcMain: { handle: name => handlers.push(name), on: name => handlers.push(name) }, shell: { openExternal: () => { calls.external++; } } };
  const requireMock = name => {
    if (name === 'electron') return electron;
    if (name === 'node:fs') return { mkdirSync() {}, realpathSync: { native: p => path.resolve(p) } };
    if (name === './document-links.cjs') return {};
    if (name === './store-file.cjs') return {};
    if (name === './vault-service.cjs') return { createVaultService: () => ({}) };
    return require(name);
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../main.cjs'), 'utf8'), { require: requireMock, __dirname: path.resolve(__dirname, '..'), process: { env: {}, platform: 'win32' } });
  return { events, windows, ready, handlers, calls };
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
