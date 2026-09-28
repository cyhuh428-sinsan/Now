const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
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
