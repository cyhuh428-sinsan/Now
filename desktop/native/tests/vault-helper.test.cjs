const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const QA_ROOT = 'D:\\tmp\\nownote-239-vault-qa';
const EXE = path.resolve(process.env.NOWNOTE_NATIVE_TEST_EXE ||
  path.join(__dirname, '..', 'out', 'vault-helper.exe'));
const IS_EXPERIMENT = path.basename(EXE).toLowerCase() === 'vault-helper-experiment.exe';
const EXPERIMENT_ONLY = { skip: !IS_EXPERIMENT };

async function fixture(t) {
  await fs.mkdir(QA_ROOT, { recursive: true });
  const dir = await fs.mkdtemp(path.join(QA_ROOT, 'native-task1-'));
  t.after(async () => {
    if (path.resolve(dir).startsWith(`${path.resolve(QA_ROOT)}${path.sep}`)) {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
  return dir;
}

function request(input, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(EXE, [], { shell: false, windowsHide: true, env });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (exitCode) => {
      try {
        resolve({ exitCode, response: JSON.parse(stdout), stderr });
      } catch (error) {
        reject(new Error(`invalid helper response: ${error.message}; stderr=${stderr}`));
      }
    });
    child.stdin.end(input);
  });
}

function pausedMutation(t, payload, pauseVariable, marker) {
  const child = spawn(EXE, [], {
    shell: false, windowsHide: true,
    env: { ...process.env, [pauseVariable]: '5000' },
  });
  t.after(() => child.kill());
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
  const closed = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${marker} missing: ${stderr}`)), 6000);
    child.stderr.setEncoding('utf8').on('data', (chunk) => {
      stderr += chunk;
      if (stderr.includes(marker)) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  child.stdin.end(JSON.stringify(payload));
  return { child, ready, closed, response: () => JSON.parse(stdout) };
}

const probe = (root) => request(JSON.stringify({ protocol: 1, operation: 'probe', root }));
const operation = (name, root, rootIdentity, extra = {}) => request(JSON.stringify({
  protocol: 1, operation: name, root, rootIdentity, ...extra,
}));
async function identity(root) {
  const result = await probe(root);
  assert.equal(result.response.ok, true);
  return result.response.result.rootIdentity;
}

function assertRejected(result) {
  assert.equal(result.response.ok, false);
  assert.equal(typeof result.response.error.code, 'string');
  assert.ok(result.response.error.code.length > 0);
  assert.equal(typeof result.response.error.message, 'string');
}

function assertTask3Rejected(result) {
  assertRejected(result);
  assert.notEqual(result.response.error.code, 'UNSUPPORTED_OPERATION');
}

test('probe returns stable volume and file identity for local Vault', async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  await fs.mkdir(root);
  const first = await probe(root);
  const second = await probe(root);
  assert.equal(first.response.ok, true);
  assert.deepEqual(first.response.result.rootIdentity, second.response.result.rootIdentity);
  assert.match(first.response.result.rootIdentity.volumeId, /\S/);
  assert.match(first.response.result.rootIdentity.fileId, /\S/);
  assert.match(first.response.result.filesystem, /\S/);
});

test('probe accepts a Korean Vault directory', async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, '한글 보관함');
  await fs.mkdir(root);
  assert.equal((await probe(root)).response.ok, true);
});

test('probe rejects intermediate and final junction without touching target', async (t) => {
  const dir = await fixture(t);
  const outside = path.join(dir, 'outside');
  const link = path.join(dir, 'link');
  await fs.mkdir(outside);
  await fs.mkdir(path.join(outside, 'child'));
  await fs.writeFile(path.join(outside, 'sentinel.txt'), 'unchanged');
  await fs.symlink(outside, link, 'junction');
  assertRejected(await probe(link));
  assertRejected(await probe(path.join(link, 'child')));
  assert.deepEqual((await fs.readdir(outside)).sort(), ['child', 'sentinel.txt']);
  assert.equal(await fs.readFile(path.join(outside, 'sentinel.txt'), 'utf8'), 'unchanged');
});

test('probe rejects UNC and missing root without creating files', async (t) => {
  const dir = await fixture(t);
  const before = await fs.readdir(dir);
  assertRejected(await probe('\\\\localhost\\C$\\vault'));
  assertRejected(await probe(path.join(dir, 'missing')));
  assert.deepEqual(await fs.readdir(dir), before);
});

test('probe rejects malformed and valid oversized JSON', async () => {
  assertRejected(await request('{'));
  const oversized = JSON.stringify({ protocol: 1, operation: 'probe', root: 'D:\\', padding: 'a'.repeat(8 * 1024 * 1024) });
  assert.equal((await request(oversized)).response.error.code, 'REQUEST_TOO_LARGE');
});

test('probe rejects Windows reserved device names before opening a component', async (t) => {
  const dir = await fixture(t);
  const before = await fs.readdir(dir);
  for (const name of ['CON', 'nul.txt', 'PrN', 'AUX.md', 'COM1', 'lpt9.txt']) {
    const result = await probe(path.join(dir, name));
    assert.equal(result.response.error.code, 'INVALID_ROOT', name);
  }
  assert.deepEqual(await fs.readdir(dir), before);
});

test('list reports markdown and empty folders without opening excluded content', async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  await fs.mkdir(path.join(root, '.obsidian'), { recursive: true });
  await fs.mkdir(path.join(root, '빈 폴더'));
  await fs.mkdir(path.join(root, '한글'));
  await fs.writeFile(path.join(root, 'a.md'), 'hello');
  await fs.writeFile(path.join(root, '한글', '_index.md'), 'index');
  await fs.writeFile(path.join(root, '.obsidian', 'secret.md'), 'secret');
  await fs.writeFile(path.join(root, 'image.png'), 'image');
  const result = await operation('list', root, await identity(root));
  assert.equal(result.response.ok, true);
  assert.deepEqual(result.response.result.entries, [
    { relativePath: 'a.md', kind: 'file', size: 5 },
    { relativePath: '빈 폴더', kind: 'directory', size: 0 },
    { relativePath: '한글/_index.md', kind: 'file', size: 5 },
  ]);
  assert.deepEqual(result.response.result.recovery, []);
});

test('read returns exact bytes and SHA-256 for a handle-opened markdown file', async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  await fs.mkdir(root);
  const bytes = Buffer.from('# 한글\r\nbody\0', 'utf8');
  await fs.writeFile(path.join(root, 'note.md'), bytes);
  const result = await operation('read', root, await identity(root), { relativePath: 'note.md' });
  assert.equal(result.response.ok, true);
  assert.equal(result.response.result.contentBase64, bytes.toString('base64'));
  assert.equal(result.response.result.fileHash, crypto.createHash('sha256').update(bytes).digest('hex'));
});

test('list and read reject a stale root identity', async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  await fs.mkdir(root);
  await fs.writeFile(path.join(root, 'note.md'), 'safe');
  const stale = await identity(root);
  stale.fileId = '00'.repeat(16);
  assertRejected(await operation('list', root, stale));
  assertRejected(await operation('read', root, stale, { relativePath: 'note.md' }));
});

test('read rejects malformed and excluded relative paths', async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  await fs.mkdir(path.join(root, '.obsidian'), { recursive: true });
  await fs.writeFile(path.join(root, '.obsidian', 'secret.md'), 'hidden');
  const id = await identity(root);
  for (const relativePath of ['../secret.md', '/secret.md', 'a\\b.md', 'a//b.md',
    '.', '', 'CON.md', '.obsidian/secret.md', 'image.png']) {
    assertRejected(await operation('read', root, id, { relativePath }));
  }
});

test('list excludes oversized and multiply linked markdown; read rejects both', async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  await fs.mkdir(root);
  await fs.writeFile(path.join(root, 'large.md'), Buffer.alloc(5 * 1024 * 1024 + 1));
  await fs.writeFile(path.join(root, 'linked.md'), 'linked');
  await fs.link(path.join(root, 'linked.md'), path.join(dir, 'outside-alias.md'));
  const id = await identity(root);
  const listed = await operation('list', root, id);
  assert.equal(listed.response.ok, true);
  assert.ok(!listed.response.result.entries.some((entry) => ['large.md', 'linked.md'].includes(entry.relativePath)));
  assert.deepEqual(listed.response.result.skipped, [
    { relativePath: 'large.md', reason: 'tooLarge' },
    { relativePath: 'linked.md', reason: 'hardlinkAlias' },
  ]);
  assertRejected(await operation('read', root, id, { relativePath: 'large.md' }));
  assertRejected(await operation('read', root, id, { relativePath: 'linked.md' }));
});

test('list and read never follow an inner junction to an outside sentinel', async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const outside = path.join(dir, 'outside');
  await fs.mkdir(root);
  await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, 'sentinel.md'), 'outside-only');
  await fs.symlink(outside, path.join(root, 'linked'), 'junction');
  const id = await identity(root);
  const listed = await operation('list', root, id);
  assert.equal(listed.response.ok, true);
  assert.ok(!listed.response.result.entries.some((entry) => entry.relativePath.includes('sentinel')));
  assert.deepEqual(listed.response.result.skipped, [
    { relativePath: 'linked', reason: 'reparsePoint' },
  ]);
  const read = await operation('read', root, id, { relativePath: 'linked/sentinel.md' });
  assertRejected(read);
  assert.equal(await fs.readFile(path.join(outside, 'sentinel.md'), 'utf8'), 'outside-only');
  assert.ok(!JSON.stringify(read.response).includes('outside-only'));
});

test('list rejects case-colliding names', async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  await fs.mkdir(root);
  await fs.writeFile(path.join(root, 'a.md'), 'one');
  await fs.writeFile(path.join(root, 'A.md'), 'two');
  const names = await fs.readdir(root);
  if (names.length !== 2) return t.skip('fixture filesystem is case-insensitive');
  assertRejected(await operation('list', root, await identity(root)));
});

test('list then read rejects a replaced parent junction', async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const outside = path.join(dir, 'outside');
  await fs.mkdir(path.join(root, 'folder'), { recursive: true });
  await fs.mkdir(outside);
  await fs.writeFile(path.join(root, 'folder', 'note.md'), 'inside');
  await fs.writeFile(path.join(outside, 'note.md'), 'outside-only');
  const id = await identity(root);
  assert.equal((await operation('list', root, id)).response.ok, true);
  await fs.rename(path.join(root, 'folder'), path.join(root, 'old-folder'));
  await fs.symlink(outside, path.join(root, 'folder'), 'junction');
  const read = await operation('read', root, id, { relativePath: 'folder/note.md' });
  assertRejected(read);
  assert.ok(!JSON.stringify(read.response).includes('outside-only'));
  assert.equal(await fs.readFile(path.join(outside, 'note.md'), 'utf8'), 'outside-only');
});

test('read requires the exact enumerated case for every component', async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  await fs.mkdir(path.join(root, 'Folder'), { recursive: true });
  await fs.writeFile(path.join(root, 'Folder', 'Note.md'), 'inside');
  const id = await identity(root);
  assertRejected(await operation('read', root, id, { relativePath: 'folder/Note.md' }));
  assertRejected(await operation('read', root, id, { relativePath: 'Folder/note.md' }));
  assert.equal((await operation('read', root, id, { relativePath: 'Folder/Note.md' })).response.ok, true);
});

test('list exposes pending recovery but not preserved files', async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  await fs.mkdir(root);
  await fs.writeFile(path.join(root, '.nownote-pending-abc'), 'pending');
  await fs.writeFile(path.join(root, '.nownote-preserved-abc'), 'preserved');
  const listed = await operation('list', root, await identity(root));
  assert.equal(listed.response.ok, true);
  assert.deepEqual(listed.response.result.entries, []);
  assert.deepEqual(listed.response.result.recovery, ['.nownote-pending-abc']);
});

test('list exposes orphan temp files for recovery', async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  await fs.mkdir(root);
  await fs.writeFile(path.join(root, '.nownote-temp-leftover'), 'new bytes');
  const listed = await operation('list', root, await identity(root));
  assert.equal(listed.response.ok, true);
  assert.deepEqual(listed.response.result.entries, []);
  assert.deepEqual(listed.response.result.recovery, ['.nownote-temp-leftover']);
});

test('write refuses orphan temp recovery before mutation', EXPERIMENT_ONLY, async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const backupDir = path.join(dir, 'backups');
  await fs.mkdir(root);
  await fs.mkdir(backupDir);
  await fs.writeFile(path.join(root, '.nownote-temp-leftover'), 'recover me');
  const result = await operation('write', root, await identity(root), {
    relativePath: 'note.md', expectedHash: null,
    contentBase64: Buffer.from('new').toString('base64'), backupDir,
  });
  assert.equal(result.response.error?.code, 'PENDING_RECOVERY');
  assert.equal(await fs.readFile(path.join(root, '.nownote-temp-leftover'), 'utf8'), 'recover me');
  await assert.rejects(fs.stat(path.join(root, 'note.md')), { code: 'ENOENT' });
});

test('normal helper rejects mutation dispatch', { skip: IS_EXPERIMENT }, async () => {
  for (const operationName of ['write', 'move', 'rollback', 'removeEmptyDirs']) {
    const result = await request(JSON.stringify({ protocol: 1, operation: operationName }));
    assert.equal(result.response.error?.code, 'UNSUPPORTED_OPERATION', operationName);
  }
});

test('read accepts exactly 5 MiB and a long Korean path', async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const folder = '가'.repeat(70);
  await fs.mkdir(path.join(root, folder), { recursive: true });
  const bytes = Buffer.alloc(5 * 1024 * 1024, 0x61);
  await fs.writeFile(path.join(root, folder, 'note.md'), bytes);
  const id = await identity(root);
  const listed = await operation('list', root, id);
  assert.equal(listed.response.ok, true);
  assert.ok(listed.response.result.entries.some((entry) =>
    entry.relativePath === `${folder}/note.md` && entry.size === bytes.length));
  const read = await operation('read', root, id, { relativePath: `${folder}/note.md` });
  assert.equal(read.response.ok, true);
  assert.equal(read.response.result.contentBase64, bytes.toString('base64'));
});

test('read refuses a file held open for writing', async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  await fs.mkdir(root);
  const file = path.join(root, 'active.md');
  await fs.writeFile(file, 'before');
  const id = await identity(root);
  const writer = await fs.open(file, 'r+');
  try {
    assertRejected(await operation('read', root, id, { relativePath: 'active.md' }));
  } finally {
    await writer.close();
  }
  assert.equal(await fs.readFile(file, 'utf8'), 'before');
});

test('list skips a directory junction whose name ends in md', async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const outside = path.join(dir, 'outside');
  await fs.mkdir(root);
  await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, 'sentinel.md'), 'outside-only');
  await fs.symlink(outside, path.join(root, 'linked.md'), 'junction');
  const listed = await operation('list', root, await identity(root));
  assert.equal(listed.response.ok, true);
  assert.deepEqual(listed.response.result.entries, []);
  assert.ok(!JSON.stringify(listed.response).includes('outside-only'));
});

test('list reports pending recovery names regardless of case', async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  await fs.mkdir(root);
  await fs.writeFile(path.join(root, '.NOWNOTE-PENDING-abc'), 'pending');
  const listed = await operation('list', root, await identity(root));
  assert.equal(listed.response.ok, true);
  assert.deepEqual(listed.response.result.recovery, ['.NOWNOTE-PENDING-abc']);
});

async function lockDirectory(locked) {
  const script = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class VaultTestLock {
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern IntPtr CreateFile(string name, uint access, uint share, IntPtr security, uint creation, uint flags, IntPtr template);
  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern bool CloseHandle(IntPtr handle);
}
'@
$handle = [VaultTestLock]::CreateFile($env:VAULT_TEST_LOCK_PATH, 0x1, 0, [IntPtr]::Zero, 3, 0x02000000, [IntPtr]::Zero)
if ($handle.ToInt64() -eq -1) { throw 'fixture directory lock failed' }
[Console]::WriteLine('READY')
[Console]::ReadLine() | Out-Null
[VaultTestLock]::CloseHandle($handle) | Out-Null
`;
  const locker = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { windowsHide: true, shell: false, env: { ...process.env, VAULT_TEST_LOCK_PATH: locked } });
  const ready = await new Promise((resolve, reject) => {
    let output = '';
    let errors = '';
    locker.stderr.setEncoding('utf8').on('data', (chunk) => { errors += chunk; });
    locker.stdout.setEncoding('utf8').on('data', (chunk) => {
      output += chunk;
      if (output.includes('READY')) resolve(output);
    });
    locker.once('error', reject);
    locker.once('close', (code) => reject(new Error(`fixture locker exited ${code}: ${output} ${errors}`)));
  });
  assert.match(ready, /READY/);
  return async () => {
    locker.stdin.end('\n');
    await new Promise((resolve) => locker.once('close', resolve));
  };
}

test('list fails closed when a visible child directory cannot be opened', async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const locked = path.join(root, 'locked');
  await fs.mkdir(locked, { recursive: true });
  const release = await lockDirectory(locked);
  try {
    assertRejected(await operation('list', root, await identity(root)));
  } finally {
    await release();
  }
});

test('read hashes an empty markdown file without reading outside the handle', async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  await fs.mkdir(root);
  await fs.writeFile(path.join(root, 'empty.md'), '');
  const read = await operation('read', root, await identity(root), { relativePath: 'empty.md' });
  assert.equal(read.response.ok, true);
  assert.equal(read.response.result.contentBase64, '');
  assert.equal(read.response.result.fileHash,
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});

test('unsafe index files do not suppress their folder candidates', async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const linked = path.join(root, 'linked');
  const large = path.join(root, 'large');
  await fs.mkdir(linked, { recursive: true });
  await fs.mkdir(large);
  await fs.writeFile(path.join(linked, '_index.md'), 'linked index');
  await fs.link(path.join(linked, '_index.md'), path.join(dir, 'outside-alias.md'));
  await fs.writeFile(path.join(large, '_index.md'), Buffer.alloc(5 * 1024 * 1024 + 1));
  const listed = await operation('list', root, await identity(root));
  assert.equal(listed.response.ok, true);
  assert.deepEqual(listed.response.result.entries, [
    { relativePath: 'large', kind: 'directory', size: 0 },
    { relativePath: 'linked', kind: 'directory', size: 0 },
  ]);
  assert.deepEqual(listed.response.result.skipped, [
    { relativePath: 'large/_index.md', reason: 'tooLarge' },
    { relativePath: 'linked/_index.md', reason: 'hardlinkAlias' },
  ]);
});

test('list stops at the 16 MiB budget before visiting later entries', async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  await fs.mkdir(root);
  let branch = path.join(root, 'a');
  await fs.mkdir(branch);
  for (let depth = 0; depth < 50; depth += 1) {
    branch = path.join(branch, `long-${String(depth).padStart(2, '0')}-${'x'.repeat(208)}`);
    await fs.mkdir(branch);
  }
  for (let index = 0; index < 1700; index += 1) {
    await fs.writeFile(path.join(branch, `note-${String(index).padStart(4, '0')}.md`), 'x');
  }
  const locked = path.join(root, 'zlocked');
  await fs.mkdir(locked);
  const release = await lockDirectory(locked);
  try {
    const listed = await operation('list', root, await identity(root));
    assertRejected(listed);
    assert.equal(listed.response.error.code, 'RESPONSE_TOO_LARGE');
  } finally {
    await release();
  }
});

test('list bounds excluded names across child pre-scan and recursive scan', async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const child = path.join(root, 'a');
  await fs.mkdir(child, { recursive: true });
  const names = Array.from({ length: 4500 }, (_, index) =>
    `.${String(index).padStart(5, '0')}-${'x'.repeat(233)}`);
  for (let start = 0; start < names.length; start += 64) {
    await Promise.all(names.slice(start, start + 64).map((name) =>
      fs.writeFile(path.join(child, name), '')));
  }
  const listed = await operation('list', root, await identity(root));
  assertRejected(listed);
  assert.equal(listed.response.error.code, 'SCAN_NAME_BUDGET_EXCEEDED');
});

test('write creates and updates markdown with backup and preserved original', EXPERIMENT_ONLY, async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const backupDir = path.join(dir, 'backups');
  await fs.mkdir(root);
  await fs.mkdir(backupDir);
  const id = await identity(root);
  const first = await operation('write', root, id, {
    relativePath: 'folder/note.md', expectedHash: null,
    contentBase64: Buffer.from('first').toString('base64'), backupDir,
  });
  assert.equal(first.response.ok, true, JSON.stringify(first.response));
  assert.deepEqual(first.response.result.createdDirs, ['folder']);
  assert.equal(await fs.readFile(path.join(root, 'folder', 'note.md'), 'utf8'), 'first');
  const updated = await operation('write', root, id, {
    relativePath: 'folder/note.md', expectedHash: crypto.createHash('sha256').update('first').digest('hex'),
    contentBase64: Buffer.from('second').toString('base64'), backupDir,
  });
  assert.equal(updated.response.ok, true);
  assert.equal(await fs.readFile(path.join(root, 'folder', 'note.md'), 'utf8'), 'second');
  assert.equal(await fs.readFile(updated.response.result.backupPath, 'utf8'), 'first');
  assert.equal(await fs.readFile(updated.response.result.preservedPath, 'utf8'), 'first');
  await fs.writeFile(path.join(root, 'folder', 'note.md'), 'edited in Obsidian');
  assert.equal(await fs.readFile(path.join(root, 'folder', 'note.md'), 'utf8'), 'edited in Obsidian');
});

test('write fails closed on hash mismatch, occupied target, and Vault-internal backup', EXPERIMENT_ONLY, async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  await fs.mkdir(root);
  await fs.writeFile(path.join(root, 'note.md'), 'original');
  const id = await identity(root);
  const base = { relativePath: 'note.md', contentBase64: Buffer.from('new').toString('base64') };
  assertTask3Rejected(await operation('write', root, id, { ...base, expectedHash: null,
    backupDir: path.join(dir, 'backups') }));
  assertTask3Rejected(await operation('write', root, id, { ...base, expectedHash: '0'.repeat(64),
    backupDir: path.join(dir, 'backups') }));
  assertTask3Rejected(await operation('write', root, id, { ...base,
    expectedHash: crypto.createHash('sha256').update('original').digest('hex'), backupDir: root }));
  assert.equal(await fs.readFile(path.join(root, 'note.md'), 'utf8'), 'original');
});

test('move and rollback preserve source bytes and refuse overwrite', EXPERIMENT_ONLY, async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const backupDir = path.join(dir, 'backups');
  await fs.mkdir(root);
  await fs.mkdir(backupDir);
  await fs.writeFile(path.join(root, 'source.md'), 'source');
  await fs.writeFile(path.join(root, 'occupied.md'), 'occupied');
  const id = await identity(root);
  const hash = crypto.createHash('sha256').update('source').digest('hex');
  assertTask3Rejected(await operation('move', root, id, {
    from: 'source.md', to: 'occupied.md', expectedHash: hash, backupDir,
  }));
  assert.equal(await fs.readFile(path.join(root, 'occupied.md'), 'utf8'), 'occupied');
  const moved = await operation('move', root, id, {
    from: 'source.md', to: 'nested/destination.md', expectedHash: hash, backupDir,
  });
  assert.equal(moved.response.ok, true);
  assert.equal(await fs.readFile(path.join(root, 'nested', 'destination.md'), 'utf8'), 'source');
  assert.equal(await fs.readFile(moved.response.result.backupPath, 'utf8'), 'source');
  const removed = await operation('rollback', root, id, {
    relativePath: 'nested/destination.md', expectedHash: hash, backupDir,
  });
  assert.equal(removed.response.ok, true);
  assert.equal(await fs.readFile(removed.response.result.preservedPath, 'utf8'), 'source');
  await assert.rejects(fs.stat(path.join(root, 'nested', 'destination.md')), { code: 'ENOENT' });
  const cleanup = await operation('removeEmptyDirs', root, id, { createdDirs: ['nested'] });
  assert.equal(cleanup.response.ok, true);
  assert.deepEqual(cleanup.response.result.removed, []);
  assert.equal((await fs.stat(path.join(root, 'nested'))).isDirectory(), true);
});

test('moved markdown remains editable by ordinary Windows applications', EXPERIMENT_ONLY, async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const backupDir = path.join(dir, 'backups');
  await fs.mkdir(root);
  await fs.mkdir(backupDir);
  await fs.writeFile(path.join(root, 'source.md'), 'original');
  const moved = await operation('move', root, await identity(root), {
    from: 'source.md', to: 'target.md',
    expectedHash: crypto.createHash('sha256').update('original').digest('hex'), backupDir,
  });
  assert.equal(moved.response.ok, true, JSON.stringify(moved.response));
  await fs.writeFile(path.join(root, 'target.md'), 'edited in Obsidian');
  assert.equal(await fs.readFile(path.join(root, 'target.md'), 'utf8'), 'edited in Obsidian');
});

test('rollback backs up and preserves exact bytes without leaving a visible target', EXPERIMENT_ONLY, async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const backupDir = path.join(dir, 'backups');
  await fs.mkdir(path.join(root, 'nested'), { recursive: true });
  await fs.mkdir(backupDir);
  const target = path.join(root, 'nested', 'note.md');
  await fs.writeFile(target, 'original');
  const id = await identity(root);
  const hash = crypto.createHash('sha256').update('original').digest('hex');
  const rejected = await operation('rollback', root, id, {
    relativePath: 'nested/note.md', expectedHash: '0'.repeat(64), backupDir,
  });
  assertTask3Rejected(rejected);
  assert.equal(await fs.readFile(target, 'utf8'), 'original');
  const rolledBack = await operation('rollback', root, id, {
    relativePath: 'nested/note.md', expectedHash: hash, backupDir,
  });
  assert.equal(rolledBack.response.ok, true, JSON.stringify(rolledBack.response));
  assert.equal(rolledBack.response.result.fileHash, hash);
  assert.equal(await fs.readFile(rolledBack.response.result.backupPath, 'utf8'), 'original');
  assert.equal(await fs.readFile(rolledBack.response.result.preservedPath, 'utf8'), 'original');
  assert.equal((await fs.realpath(path.dirname(rolledBack.response.result.preservedPath))).toLowerCase(),
    (await fs.realpath(root)).toLowerCase());
  await assert.rejects(fs.stat(target), { code: 'ENOENT' });
});

test('rollback reports its preserved path when post-rename path lookup fails', EXPERIMENT_ONLY, async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const backupDir = path.join(dir, 'backups');
  await fs.mkdir(root);
  await fs.mkdir(backupDir);
  await fs.writeFile(path.join(root, 'note.md'), 'original');
  const response = await request(JSON.stringify({
    protocol: 1, operation: 'rollback', root, rootIdentity: await identity(root),
    relativePath: 'note.md',
    expectedHash: crypto.createHash('sha256').update('original').digest('hex'), backupDir,
  }), { ...process.env, NOWNOTE_VAULT_TEST_FAIL_PRESERVED_PATH_LOOKUP: '1' });
  assert.equal(response.response.ok, true, JSON.stringify(response.response));
  assert.equal(await fs.readFile(response.response.result.preservedPath, 'utf8'), 'original');
});

test('move preserves source when target is claimed after parking', EXPERIMENT_ONLY, async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const backupDir = path.join(dir, 'backups');
  await fs.mkdir(root);
  await fs.mkdir(backupDir);
  await fs.writeFile(path.join(root, 'source.md'), 'original');
  const paused = pausedMutation(t, {
    protocol: 1, operation: 'move', root, rootIdentity: await identity(root),
    from: 'source.md', to: 'target.md',
    expectedHash: crypto.createHash('sha256').update('original').digest('hex'), backupDir,
  }, 'NOWNOTE_VAULT_TEST_PAUSE_MOVE_AFTER_PARK_MS', 'VAULT_TEST_MOVE_PARKED_READY');
  await paused.ready;
  await fs.writeFile(path.join(root, 'target.md'), 'external');
  assert.equal(await paused.closed, 0);
  const response = paused.response();
  assert.equal(response.ok, false, JSON.stringify(response));
  assert.equal(response.error.code, 'RENAME_FAILED');
  assert.equal(await fs.readFile(path.join(root, 'source.md'), 'utf8'), 'original');
  assert.equal(await fs.readFile(path.join(root, 'target.md'), 'utf8'), 'external');
  assert.equal(await fs.readFile(response.recovery.backupPath, 'utf8'), 'original');
  assert.equal(await fs.readFile(response.recovery.tempPath, 'utf8'), 'original');
});

test('move crash after parking exposes source and target recovery bytes', EXPERIMENT_ONLY, async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const backupDir = path.join(dir, 'backups');
  await fs.mkdir(root);
  await fs.mkdir(backupDir);
  await fs.writeFile(path.join(root, 'source.md'), 'original');
  const id = await identity(root);
  const paused = pausedMutation(t, {
    protocol: 1, operation: 'move', root, rootIdentity: id,
    from: 'source.md', to: 'target.md',
    expectedHash: crypto.createHash('sha256').update('original').digest('hex'), backupDir,
  }, 'NOWNOTE_VAULT_TEST_PAUSE_MOVE_AFTER_PARK_MS', 'VAULT_TEST_MOVE_PARKED_READY');
  await paused.ready;
  assert.equal(paused.child.kill('SIGKILL'), true);
  await paused.closed;
  const recovery = (await operation('list', root, id)).response.result.recovery;
  const pending = recovery.find((name) => name.startsWith('.nownote-pending-'));
  const temp = recovery.find((name) => name.startsWith('.nownote-temp-'));
  assert.ok(pending);
  assert.ok(temp);
  assert.equal(await fs.readFile(path.join(root, pending), 'utf8'), 'original');
  assert.equal(await fs.readFile(path.join(root, temp), 'utf8'), 'original');
  await assert.rejects(fs.stat(path.join(root, 'source.md')), { code: 'ENOENT' });
  await assert.rejects(fs.stat(path.join(root, 'target.md')), { code: 'ENOENT' });
  const backups = await fs.readdir(backupDir);
  assert.equal(backups.length, 1);
  assert.equal(await fs.readFile(path.join(backupDir, backups[0]), 'utf8'), 'original');
});

test('rollback crash after parking blocks later mutation', EXPERIMENT_ONLY, async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const backupDir = path.join(dir, 'backups');
  await fs.mkdir(root);
  await fs.mkdir(backupDir);
  await fs.writeFile(path.join(root, 'note.md'), 'original');
  const id = await identity(root);
  const hash = crypto.createHash('sha256').update('original').digest('hex');
  const paused = pausedMutation(t, {
    protocol: 1, operation: 'rollback', root, rootIdentity: id,
    relativePath: 'note.md', expectedHash: hash, backupDir,
  }, 'NOWNOTE_VAULT_TEST_PAUSE_ROLLBACK_AFTER_PARK_MS', 'VAULT_TEST_ROLLBACK_PARKED_READY');
  await paused.ready;
  assert.equal(paused.child.kill('SIGKILL'), true);
  await paused.closed;
  const listed = await operation('list', root, id);
  const pending = listed.response.result.recovery.find((name) => name.startsWith('.nownote-pending-'));
  assert.ok(pending);
  assert.equal(await fs.readFile(path.join(root, pending), 'utf8'), 'original');
  await assert.rejects(fs.stat(path.join(root, 'note.md')), { code: 'ENOENT' });
  const retry = await operation('write', root, id, {
    relativePath: 'next.md', expectedHash: null,
    contentBase64: Buffer.from('next').toString('base64'), backupDir,
  });
  assert.equal(retry.response.error?.code, 'PENDING_RECOVERY');
});

test('a crash after final rename loses the helper response for every mutation', EXPERIMENT_ONLY, async (t) => {
  for (const kind of ['write', 'move', 'rollback']) {
    const dir = await fixture(t);
    const root = path.join(dir, 'vault');
    const backupDir = path.join(dir, 'backups');
    await fs.mkdir(root);
    await fs.mkdir(backupDir);
    await fs.writeFile(path.join(root, 'source.md'), 'original');
    const id = await identity(root);
    const expectedHash = crypto.createHash('sha256').update('original').digest('hex');
    const fields = kind === 'write'
      ? { relativePath: 'source.md', expectedHash, contentBase64: Buffer.from('replacement').toString('base64'), backupDir }
      : kind === 'move'
        ? { from: 'source.md', to: 'target.md', expectedHash, backupDir }
        : { relativePath: 'source.md', expectedHash, backupDir };
    const paused = pausedMutation(t, {
      protocol: 1, operation: kind, root, rootIdentity: id, ...fields,
    }, 'NOWNOTE_VAULT_TEST_PAUSE_AFTER_FINAL_RENAME_MS', 'VAULT_TEST_FINAL_RENAME_READY');
    await paused.ready;
    assert.equal(paused.child.kill('SIGKILL'), true);
    await paused.closed;
    assert.throws(() => paused.response());
    assert.deepEqual((await operation('list', root, id)).response.result.recovery, []);
    const preserved = (await fs.readdir(root)).find((name) => name.startsWith('.nownote-preserved-'));
    assert.ok(preserved, `${kind} must retain its original`);
    assert.equal(await fs.readFile(path.join(root, preserved), 'utf8'), 'original');
    const target = kind === 'move' ? 'target.md' : 'source.md';
    if (kind === 'rollback') {
      await assert.rejects(fs.stat(path.join(root, target)), { code: 'ENOENT' });
    } else {
      assert.equal(await fs.readFile(path.join(root, target), 'utf8'), kind === 'write' ? 'replacement' : 'original');
    }
    const backups = await fs.readdir(backupDir);
    assert.equal(backups.length, 1);
    assert.equal(await fs.readFile(path.join(backupDir, backups[0]), 'utf8'), 'original');
  }
});

test('write refuses a concurrent writer and backup failure without changing source', EXPERIMENT_ONLY, async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const backupDir = path.join(dir, 'backups');
  await fs.mkdir(root);
  await fs.mkdir(backupDir);
  const file = path.join(root, 'note.md');
  await fs.writeFile(file, 'original');
  const id = await identity(root);
  const input = { relativePath: 'note.md',
    expectedHash: crypto.createHash('sha256').update('original').digest('hex'),
    contentBase64: Buffer.from('replacement').toString('base64'), backupDir };
  const writer = await fs.open(file, 'r+');
  try {
    assertTask3Rejected(await operation('write', root, id, input));
  } finally {
    await writer.close();
  }
  assertTask3Rejected(await operation('write', root, id, { ...input,
    backupDir: path.join(dir, 'missing-backup-dir') }));
  assert.equal(await fs.readFile(file, 'utf8'), 'original');
  assert.deepEqual(await fs.readdir(root), ['note.md']);
});

test('pending recovery blocks mutation while preserved copy remains separately visible', EXPERIMENT_ONLY, async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const backupDir = path.join(dir, 'backups');
  await fs.mkdir(root);
  await fs.mkdir(backupDir);
  await fs.writeFile(path.join(root, '.nownote-pending-crash'), 'original');
  await fs.writeFile(path.join(root, '.nownote-preserved-old'), 'older');
  const id = await identity(root);
  const listed = await operation('list', root, id);
  assert.deepEqual(listed.response.result.recovery, ['.nownote-pending-crash']);
  assertTask3Rejected(await operation('write', root, id, { relativePath: 'note.md',
    expectedHash: null, contentBase64: Buffer.from('new').toString('base64'), backupDir }));
  assert.equal(await fs.readFile(path.join(root, '.nownote-pending-crash'), 'utf8'), 'original');
  assert.equal(await fs.readFile(path.join(root, '.nownote-preserved-old'), 'utf8'), 'older');
});

test('write refuses recovery created after its initial scan', EXPERIMENT_ONLY, async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const backupDir = path.join(dir, 'backups');
  await fs.mkdir(root);
  await fs.mkdir(backupDir);
  const child = spawn(EXE, [], {
    shell: false, windowsHide: true,
    env: { ...process.env, NOWNOTE_VAULT_TEST_PAUSE_AFTER_SCAN_MS: '5000' },
  });
  t.after(() => child.kill());
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
  const closed = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`scan marker missing: ${stderr}`)), 6000);
    child.stderr.setEncoding('utf8').on('data', (chunk) => {
      stderr += chunk;
      if (stderr.includes('VAULT_TEST_SCAN_READY')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  child.stdin.end(JSON.stringify({
    protocol: 1, operation: 'write', root, rootIdentity: await identity(root),
    relativePath: 'note.md', expectedHash: null,
    contentBase64: Buffer.from('new').toString('base64'), backupDir,
  }));
  await ready;
  await fs.writeFile(path.join(root, '.nownote-pending-late'), 'recover me');
  assert.equal(await closed, 0);
  const response = JSON.parse(stdout);
  assert.equal(response.error?.code, 'PENDING_RECOVERY', JSON.stringify(response));
  assert.equal(await fs.readFile(path.join(root, '.nownote-pending-late'), 'utf8'), 'recover me');
  await assert.rejects(fs.stat(path.join(root, 'note.md')), { code: 'ENOENT' });
});

test('two helpers serialize mutation of the same Vault', EXPERIMENT_ONLY, async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const backupDir = path.join(dir, 'backups');
  await fs.mkdir(root);
  await fs.mkdir(backupDir);
  const id = await identity(root);
  const first = spawn(EXE, [], {
    shell: false, windowsHide: true,
    env: { ...process.env, NOWNOTE_VAULT_TEST_PAUSE_AFTER_RECOVERY_MS: '5000' },
  });
  t.after(() => first.kill());
  let firstOut = '';
  let firstErr = '';
  first.stdout.setEncoding('utf8').on('data', (chunk) => { firstOut += chunk; });
  const firstClosed = new Promise((resolve, reject) => {
    first.once('error', reject);
    first.once('close', resolve);
  });
  const firstReady = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`first marker missing: ${firstErr}`)), 6000);
    first.stderr.setEncoding('utf8').on('data', (chunk) => {
      firstErr += chunk;
      if (firstErr.includes('VAULT_TEST_RECOVERY_READY')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  first.stdin.end(JSON.stringify({
    protocol: 1, operation: 'write', root, rootIdentity: id,
    relativePath: 'first.md', expectedHash: null,
    contentBase64: Buffer.from('first').toString('base64'), backupDir,
  }));
  await firstReady;
  const second = spawn(EXE, [], {
    shell: false, windowsHide: true,
    env: { ...process.env, NOWNOTE_VAULT_TEST_NOTIFY_LOCK_WAIT: '1' },
  });
  t.after(() => second.kill());
  let secondOut = '';
  let secondErr = '';
  let secondDone = false;
  second.stdout.setEncoding('utf8').on('data', (chunk) => { secondOut += chunk; });
  const secondClosed = new Promise((resolve, reject) => {
    second.once('error', reject);
    second.once('close', (code) => { secondDone = true; resolve(code); });
  });
  const secondReady = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`second marker missing: ${secondErr}`)), 6000);
    second.stderr.setEncoding('utf8').on('data', (chunk) => {
      secondErr += chunk;
      if (secondErr.includes('VAULT_TEST_LOCK_WAIT')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  second.stdin.end(JSON.stringify({
    protocol: 1, operation: 'write', root, rootIdentity: id,
    relativePath: 'second.md', expectedHash: null,
    contentBase64: Buffer.from('second').toString('base64'), backupDir,
  }));
  await secondReady;
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(secondDone, false, `second helper escaped the Vault lock: ${secondOut}`);
  assert.equal(await firstClosed, 0);
  assert.equal(JSON.parse(firstOut).ok, true, firstOut);
  assert.equal(await secondClosed, 0);
  assert.equal(JSON.parse(secondOut).ok, true, secondOut);
  assert.equal(await fs.readFile(path.join(root, 'first.md'), 'utf8'), 'first');
  assert.equal(await fs.readFile(path.join(root, 'second.md'), 'utf8'), 'second');
});

test('waiting helper rejects recovery after the owner crashes', EXPERIMENT_ONLY, async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const backupDir = path.join(dir, 'backups');
  await fs.mkdir(root);
  await fs.mkdir(backupDir);
  await fs.writeFile(path.join(root, 'first.md'), 'original');
  const id = await identity(root);
  const first = spawn(EXE, [], {
    shell: false, windowsHide: true,
    env: { ...process.env, NOWNOTE_VAULT_TEST_PAUSE_AFTER_PARK_MS: '5000' },
  });
  t.after(() => first.kill());
  let firstErr = '';
  const firstClosed = new Promise((resolve, reject) => {
    first.once('error', reject);
    first.once('close', resolve);
  });
  const parked = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`parking marker missing: ${firstErr}`)), 6000);
    first.stderr.setEncoding('utf8').on('data', (chunk) => {
      firstErr += chunk;
      if (firstErr.includes('VAULT_TEST_PARKED_READY')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  first.stdin.end(JSON.stringify({
    protocol: 1, operation: 'write', root, rootIdentity: id,
    relativePath: 'first.md', expectedHash: crypto.createHash('sha256').update('original').digest('hex'),
    contentBase64: Buffer.from('replacement').toString('base64'), backupDir,
  }));
  await parked;
  const second = spawn(EXE, [], {
    shell: false, windowsHide: true,
    env: { ...process.env, NOWNOTE_VAULT_TEST_NOTIFY_LOCK_WAIT: '1' },
  });
  t.after(() => second.kill());
  let secondOut = '';
  let secondErr = '';
  let secondDone = false;
  second.stdout.setEncoding('utf8').on('data', (chunk) => { secondOut += chunk; });
  const secondClosed = new Promise((resolve, reject) => {
    second.once('error', reject);
    second.once('close', (code) => { secondDone = true; resolve(code); });
  });
  const waiting = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`lock marker missing: ${secondErr}`)), 6000);
    second.stderr.setEncoding('utf8').on('data', (chunk) => {
      secondErr += chunk;
      if (secondErr.includes('VAULT_TEST_LOCK_WAIT')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  second.stdin.end(JSON.stringify({
    protocol: 1, operation: 'write', root, rootIdentity: id,
    relativePath: 'second.md', expectedHash: null,
    contentBase64: Buffer.from('second').toString('base64'), backupDir,
  }));
  await waiting;
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(secondDone, false, `second helper escaped the Vault lock: ${secondOut}`);
  assert.equal(first.kill('SIGKILL'), true);
  await firstClosed;
  assert.equal(await secondClosed, 0);
  const response = JSON.parse(secondOut);
  assert.equal(response.error?.code, 'PENDING_RECOVERY', secondOut);
  await assert.rejects(fs.stat(path.join(root, 'second.md')), { code: 'ENOENT' });
  const recovery = (await operation('list', root, id)).response.result.recovery;
  const pending = recovery.find((name) => name.startsWith('.nownote-pending-'));
  const temp = recovery.find((name) => name.startsWith('.nownote-temp-'));
  assert.ok(pending);
  assert.ok(temp);
  assert.equal(await fs.readFile(path.join(root, pending), 'utf8'), 'original');
  assert.equal(await fs.readFile(path.join(root, temp), 'utf8'), 'replacement');
});

test('removeEmptyDirs preserves existing and newly empty folders', EXPERIMENT_ONLY, async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  await fs.mkdir(path.join(root, 'kept'), { recursive: true });
  await fs.mkdir(path.join(root, 'empty'));
  await fs.mkdir(path.join(root, 'unrelated'));
  await fs.writeFile(path.join(root, 'kept', 'sentinel.md'), 'untouched');
  const id = await identity(root);
  const result = await operation('removeEmptyDirs', root, id, { createdDirs: ['kept', 'empty'] });
  assert.equal(result.response.ok, true);
  assert.deepEqual(result.response.result.removed, []);
  assert.equal(result.response.result.deferred, true);
  assert.equal(await fs.readFile(path.join(root, 'kept', 'sentinel.md'), 'utf8'), 'untouched');
  assert.equal((await fs.stat(path.join(root, 'empty'))).isDirectory(), true);
  assert.equal((await fs.stat(path.join(root, 'unrelated'))).isDirectory(), true);
});

test('removeEmptyDirs refuses an in-place reparse before deletion', { skip: 'Automatic empty folder cleanup is deferred' }, async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const empty = path.join(root, 'empty');
  const outside = path.join(dir, 'outside');
  await fs.mkdir(empty, { recursive: true });
  await fs.mkdir(outside);
  const sentinel = path.join(outside, 'sentinel.md');
  await fs.writeFile(sentinel, 'outside-original');
  const attackerExe = path.resolve(__dirname, '..', 'out', 'vault-reparse-attempt.exe');
  const attack = (args) => new Promise((resolve, reject) => {
    const attacker = spawn(attackerExe, args, { shell: false, windowsHide: true });
    let stderr = '';
    attacker.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    attacker.once('error', reject);
    attacker.once('close', (code) => resolve({ code, stderr }));
  });
  const paused = pausedMutation(t, {
    protocol: 1, operation: 'removeEmptyDirs', root, rootIdentity: await identity(root),
    createdDirs: ['empty'],
  }, 'NOWNOTE_VAULT_TEST_PAUSE_REMOVE_BEFORE_OPEN_MS', 'VAULT_TEST_REMOVE_READY');
  await paused.ready;
  const attempt = await attack(['set', empty, outside]);
  try {
    assert.equal(attempt.code, 0, attempt.stderr);
    assert.equal(await paused.closed, 0);
    const response = paused.response();
    assert.equal(response.ok, false, JSON.stringify(response));
    assert.ok(['REPARSE_POINT', 'OPEN_FAILED'].includes(response.error.code));
    assert.equal(await fs.readFile(sentinel, 'utf8'), 'outside-original');
    await assert.rejects(fs.stat(path.join(outside, 'note.md')), { code: 'ENOENT' });
  } finally {
    if (attempt.code === 0) {
      const cleanup = await attack(['delete', empty]);
      assert.equal(cleanup.code, 0, cleanup.stderr);
    }
  }
  assert.equal((await fs.stat(empty)).isDirectory(), true);
});

test('removeEmptyDirs rechecks reparse after opening an empty directory', { skip: 'Automatic empty folder cleanup is deferred' }, async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const empty = path.join(root, 'empty');
  const outside = path.join(dir, 'outside');
  await fs.mkdir(empty, { recursive: true });
  await fs.mkdir(outside);
  const sentinel = path.join(outside, 'sentinel.md');
  await fs.writeFile(sentinel, 'outside-original');
  const attackerExe = path.resolve(__dirname, '..', 'out', 'vault-reparse-attempt.exe');
  const attack = (args) => new Promise((resolve, reject) => {
    const attacker = spawn(attackerExe, args, { shell: false, windowsHide: true });
    let stderr = '';
    attacker.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    attacker.once('error', reject);
    attacker.once('close', (code) => resolve({ code, stderr }));
  });
  const paused = pausedMutation(t, {
    protocol: 1, operation: 'removeEmptyDirs', root, rootIdentity: await identity(root),
    createdDirs: ['empty'],
  }, 'NOWNOTE_VAULT_TEST_PAUSE_REMOVE_AFTER_OPEN_MS', 'VAULT_TEST_REMOVE_OPEN_READY');
  await paused.ready;
  const attempt = await attack(['set', empty, outside]);
  try {
    assert.equal(attempt.code, 0, attempt.stderr);
    assert.equal(await paused.closed, 0);
    const response = paused.response();
    assert.equal(response.ok, false, JSON.stringify(response));
    assert.equal(response.error.code, 'REPARSE_POINT');
    assert.equal(await fs.readFile(sentinel, 'utf8'), 'outside-original');
  } finally {
    if (attempt.code === 0) {
      const cleanup = await attack(['delete', empty]);
      assert.equal(cleanup.code, 0, cleanup.stderr);
    }
  }
  assert.equal((await fs.stat(empty)).isDirectory(), true);
});

test('write keeps an outside sentinel intact during a parent junction swap attempt', {
  skip: path.basename(EXE).toLowerCase() !== 'vault-helper-experiment.exe',
}, async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const parent = path.join(root, 'branch');
  const outside = path.join(dir, 'outside');
  const backupDir = path.join(dir, 'backups');
  await fs.mkdir(parent, { recursive: true });
  await fs.mkdir(outside);
  await fs.mkdir(backupDir);
  const sentinel = path.join(outside, 'sentinel.md');
  await fs.writeFile(sentinel, 'outside-original');
  const input = JSON.stringify({
    protocol: 1, operation: 'write', root, rootIdentity: await identity(root),
    relativePath: 'branch/note.md', expectedHash: null,
    contentBase64: Buffer.from('inside-only').toString('base64'), backupDir,
  });
  const child = spawn(EXE, [], {
    shell: false, windowsHide: true,
    env: { ...process.env, NOWNOTE_VAULT_TEST_PAUSE_AFTER_PARENT_MS: '1500' },
  });
  t.after(() => child.kill());
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
  child.stderr.setEncoding('utf8');
  const closed = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolve(code));
  });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`parent-open marker missing: ${stderr}`)), 5000);
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (stderr.includes('VAULT_TEST_PARENT_READY')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  child.stdin.end(input);
  await ready;
  let swapped = false;
  try {
    await fs.rename(parent, path.join(root, 'moved'));
    swapped = true;
    await fs.symlink(outside, parent, 'junction');
  } catch (error) {
    if (swapped) throw error;
    assert.ok(['EACCES', 'EPERM', 'EBUSY'].includes(error.code), error.message);
  }
  assert.equal(await closed, 0);
  const response = JSON.parse(stdout);
  if (!swapped) assert.equal(response.ok, true, JSON.stringify(response));
  assert.equal(await fs.readFile(sentinel, 'utf8'), 'outside-original');
  await assert.rejects(fs.stat(path.join(outside, 'note.md')), { code: 'ENOENT' });
});

test('write keeps an outside sentinel intact during an in-place reparse attempt', {
  skip: path.basename(EXE).toLowerCase() !== 'vault-helper-experiment.exe',
}, async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const parent = path.join(root, 'branch');
  const outside = path.join(dir, 'outside');
  const backupDir = path.join(dir, 'backups');
  await fs.mkdir(parent, { recursive: true });
  await fs.mkdir(outside);
  await fs.mkdir(backupDir);
  const sentinel = path.join(outside, 'sentinel.md');
  await fs.writeFile(sentinel, 'outside-original');
  const attackerExe = path.resolve(__dirname, '..', 'out', 'vault-reparse-attempt.exe');
  const attack = (args) => new Promise((resolve, reject) => {
    const process = spawn(attackerExe, args, { shell: false, windowsHide: true });
    let stderr = '';
    process.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    process.once('error', reject);
    process.once('close', (code) => resolve({ code, stderr }));
  });
  const child = spawn(EXE, [], {
    shell: false, windowsHide: true,
    env: { ...process.env, NOWNOTE_VAULT_TEST_PAUSE_AFTER_PARENT_MS: '5000' },
  });
  t.after(() => child.kill());
  let stdout = '';
  let stderr = '';
  let helperClosed = false;
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
  child.stderr.setEncoding('utf8');
  const closed = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => { helperClosed = true; resolve(code); });
  });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`parent-open marker missing: ${stderr}`)), 5000);
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (stderr.includes('VAULT_TEST_PARENT_READY')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  child.stdin.end(JSON.stringify({
    protocol: 1, operation: 'write', root, rootIdentity: await identity(root),
    relativePath: 'branch/note.md', expectedHash: null,
    contentBase64: Buffer.from('inside-only').toString('base64'), backupDir,
  }));
  await ready;
  const attempt = await attack(['set', parent, outside]);
  t.diagnostic(`in-place reparse set exit=${attempt.code} ${attempt.stderr.trim()}`);
  let response;
  try {
    assert.equal(attempt.code, 0, `reparse mutation did not occur: ${JSON.stringify(attempt)}`);
    assert.equal(helperClosed, false, 'helper finished before the reparse mutation');
    assert.equal(await closed, 0);
    response = JSON.parse(stdout);
    t.diagnostic(`in-place reparse helper result=${response.ok ? 'ok' : response.error?.code}`);
    assert.ok(response.ok || response.error?.code, JSON.stringify(response));
    assert.equal(await fs.readFile(sentinel, 'utf8'), 'outside-original');
    await assert.rejects(fs.stat(path.join(outside, 'note.md')), { code: 'ENOENT' });
  } finally {
    if (attempt.code === 0) {
      const cleanup = await attack(['delete', parent]);
      assert.equal(cleanup.code, 0, cleanup.stderr);
    }
  }
  if (response.ok) {
    assert.equal(await fs.readFile(path.join(parent, 'note.md'), 'utf8'), 'inside-only');
  } else {
    assert.equal(response.error.code, 'CREATE_FAILED');
    await assert.rejects(fs.stat(path.join(parent, 'note.md')), { code: 'ENOENT' });
  }
});

test('write preserves parked original when another process claims the target name', {
  skip: path.basename(EXE).toLowerCase() !== 'vault-helper-experiment.exe',
}, async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const backupDir = path.join(dir, 'backups');
  const outside = path.join(dir, 'outside');
  await fs.mkdir(root);
  await fs.mkdir(backupDir);
  await fs.mkdir(outside);
  const file = path.join(root, 'note.md');
  const sentinel = path.join(outside, 'sentinel.md');
  await fs.writeFile(file, 'original');
  await fs.writeFile(sentinel, 'outside-original');
  const hash = crypto.createHash('sha256').update('original').digest('hex');
  const child = spawn(EXE, [], {
    shell: false, windowsHide: true,
    env: { ...process.env, NOWNOTE_VAULT_TEST_PAUSE_AFTER_PARK_MS: '1500' },
  });
  t.after(() => child.kill());
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
  child.stderr.setEncoding('utf8');
  const closed = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolve(code));
  });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`parking marker missing: ${stderr}`)), 5000);
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (stderr.includes('VAULT_TEST_PARKED_READY')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  child.stdin.end(JSON.stringify({
    protocol: 1, operation: 'write', root, rootIdentity: await identity(root),
    relativePath: 'note.md', expectedHash: hash,
    contentBase64: Buffer.from('new-content').toString('base64'), backupDir,
  }));
  await ready;
  await fs.writeFile(file, 'external-created', { flag: 'wx' });
  assert.equal(await closed, 0);
  const response = JSON.parse(stdout);
  assert.equal(response.ok, false, JSON.stringify(response));
  assert.equal(response.error.code, 'RENAME_FAILED');
  assert.equal(await fs.readFile(file, 'utf8'), 'external-created');
  assert.equal(await fs.readFile(response.recovery.pendingPath, 'utf8'), 'original');
  assert.equal(await fs.readFile(response.recovery.backupPath, 'utf8'), 'original');
  assert.equal(await fs.readFile(response.recovery.tempPath, 'utf8'), 'new-content');
  assert.equal(await fs.readFile(sentinel, 'utf8'), 'outside-original');
});

test('a crash after parking leaves recoverable bytes and blocks the next write', {
  skip: path.basename(EXE).toLowerCase() !== 'vault-helper-experiment.exe',
}, async (t) => {
  const dir = await fixture(t);
  const root = path.join(dir, 'vault');
  const backupDir = path.join(dir, 'backups');
  await fs.mkdir(root);
  await fs.mkdir(backupDir);
  const file = path.join(root, 'note.md');
  await fs.writeFile(file, 'original');
  const id = await identity(root);
  const hash = crypto.createHash('sha256').update('original').digest('hex');
  const child = spawn(EXE, [], {
    shell: false, windowsHide: true,
    env: { ...process.env, NOWNOTE_VAULT_TEST_PAUSE_AFTER_PARK_MS: '5000' },
  });
  t.after(() => child.kill());
  let stderr = '';
  child.stderr.setEncoding('utf8');
  const closed = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`parking marker missing: ${stderr}`)), 5000);
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (stderr.includes('VAULT_TEST_PARKED_READY')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  child.stdin.end(JSON.stringify({
    protocol: 1, operation: 'write', root, rootIdentity: id,
    relativePath: 'note.md', expectedHash: hash,
    contentBase64: Buffer.from('new-content').toString('base64'), backupDir,
  }));
  await ready;
  assert.equal(child.kill('SIGKILL'), true);
  await closed;
  const listed = await operation('list', root, id);
  assert.equal(listed.response.ok, true, JSON.stringify(listed.response));
  assert.equal(listed.response.result.recovery.length, 2);
  const pendingName = listed.response.result.recovery.find((name) => name.startsWith('.nownote-pending-'));
  const tempName = listed.response.result.recovery.find((name) => name.startsWith('.nownote-temp-'));
  assert.ok(pendingName);
  assert.ok(tempName);
  const pending = path.join(root, pendingName);
  assert.equal(await fs.readFile(pending, 'utf8'), 'original');
  assert.equal(await fs.readFile(path.join(root, tempName), 'utf8'), 'new-content');
  await assert.rejects(fs.stat(file), { code: 'ENOENT' });
  const backups = await fs.readdir(backupDir);
  assert.equal(backups.length, 1);
  assert.equal(await fs.readFile(path.join(backupDir, backups[0]), 'utf8'), 'original');
  const retry = await operation('write', root, id, {
    relativePath: 'note.md', expectedHash: null,
    contentBase64: Buffer.from('retry').toString('base64'), backupDir,
  });
  assertTask3Rejected(retry);
  assert.equal(retry.response.error.code, 'PENDING_RECOVERY');
  assert.equal(await fs.readFile(pending, 'utf8'), 'original');
});
