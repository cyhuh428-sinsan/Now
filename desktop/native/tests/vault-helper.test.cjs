const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const QA_ROOT = 'D:\\tmp\\nownote-239-vault-qa';
const EXE = path.resolve(__dirname, '..', 'out', 'vault-helper.exe');

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

function request(input) {
  return new Promise((resolve, reject) => {
    const child = spawn(EXE, [], { shell: false, windowsHide: true });
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
