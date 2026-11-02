import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const { readStoreFile, compareAndSetStoreValue, updateStoreFile } = require('../../desktop/store-file.cjs');
if (process.argv[2] === '--read') {
  const file = path.resolve(process.argv[3]), root = path.resolve('D:/tmp/now-240-e4b2');
  assert.ok(file.startsWith(root + path.sep));
  const store = readStoreFile(file).store;
  assert.equal(store.values['nownote.web.v1'].tree[0].content,'cipher-only-synthetic');
  assert.equal(store.values['nownote.web.settings.v1'].analysis,'cipher-only-synthetic');
  console.log('isolated Node restart: persisted data/settings bytes PASS');
  process.exit(0);
}
const root = path.resolve('D:/tmp/now-240-e4b2');
await fs.mkdir(root,{ recursive:true });
const dir = await fs.mkdtemp(path.join(root,'storage-'));
assert.ok(path.resolve(dir).startsWith(root + path.sep));
try {
  const file = path.join(dir,'store.json');
  const source = await fs.readFile(new URL('../../desktop/main.cjs',import.meta.url),'utf8');
  const start = source.indexOf('function updateRendererStoreValue('), end = source.indexOf('function registerVaultHandlers(',start);
  assert.ok(start >= 0 && end > start);
  const allowed = new Set(['nownote.web.v1','nownote.web.settings.v1','nownote.history.v1','nownote.library.v1']);
  const box = { compareAndSetStoreValue, updateStoreFile, desktopStorePath: () => file,
    assertRendererStoreKey: k => { if (!allowed.has(k)) throw Error('forbidden key'); } };
  vm.runInNewContext(source.slice(start,end) + '\nglobalThis.write = updateRendererStoreValue;',box);
  const data = { tree:[{ id:'target',content:'synthetic-original' }],other:'preserve-other' };
  const settings = { analysis:'synthetic-original',preference:1 };
  box.write('nownote.web.v1',data);
  box.write('nownote.web.settings.v1',settings);
  const nextData = { ...data,tree:[{ id:'target',content:'cipher-only-synthetic' }] };
  box.write('nownote.web.v1',nextData,{ expectedValue:data });
  assert.throws(() => box.write('nownote.web.v1',data,{ expectedValue:data }));
  assert.equal(readStoreFile(file).store.values['nownote.web.v1'].other,'preserve-other');
  box.write('nownote.web.settings.v1',{ ...settings,analysis:'cipher-only-synthetic' },{ expectedValue:settings });
  assert.throws(() => box.write('nownote.history.v1',{}));
  assert.throws(() => box.write('forbidden',{}, { expectedValue:null }));
  const result = spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--read',file],{ encoding:'utf8',timeout:10000 });
  assert.equal(result.status,0,result.stderr); console.log(result.stdout.trim());
  assert.ok(!(await fs.readFile(file,'utf8')).includes('synthetic-original'));
  assert.deepEqual(await fs.readdir(dir),['store.json']);
  console.log('production renderer store handler: data/settings expected-value CAS, stale rejection, other data preservation, no temp rollback files PASS');
} finally {
  if (!path.resolve(dir).startsWith(root + path.sep)) throw Error('cleanup boundary');
  await fs.rm(dir,{ recursive:true,force:true });
  assert.equal(await fs.stat(dir).then(() => true,() => false),false);
}
