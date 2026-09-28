const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { readStoreFile, updateStoreFile } = require("../store-file.cjs");

const QA_ROOT = process.platform === "win32" ? "D:\\tmp\\nownote-239-vault-qa" : path.join(os.tmpdir(), "nownote-239-vault-qa");

test("a corrupt desktop store is not silently replaced with empty data", async (t) => {
  await fs.mkdir(QA_ROOT, { recursive: true });
  const dir = await fs.mkdtemp(path.join(QA_ROOT, "store-file-"));
  t.after(async () => {
    if (path.resolve(dir).startsWith(`${path.resolve(QA_ROOT)}${path.sep}`)) await fs.rm(dir, { recursive: true, force: true });
  });
  const file = path.join(dir, "store.json");
  await fs.writeFile(file, "{broken");
  assert.throws(() => readStoreFile(file));
  assert.throws(() => updateStoreFile(file, (store) => store));
  assert.equal(await fs.readFile(file, "utf8"), "{broken");
});

test("desktop store updates are atomic and reject stale compare-and-swap hashes", async (t) => {
  await fs.mkdir(QA_ROOT, { recursive: true });
  const dir = await fs.mkdtemp(path.join(QA_ROOT, "store-file-"));
  t.after(async () => {
    if (path.resolve(dir).startsWith(`${path.resolve(QA_ROOT)}${path.sep}`)) await fs.rm(dir, { recursive: true, force: true });
  });
  const file = path.join(dir, "store.json");
  const first = updateStoreFile(file, (store) => { store.values["nownote.web.v1"] = { tree: [] }; return store; });
  assert.deepEqual(readStoreFile(file).store.values["nownote.web.v1"], { tree: [] });
  assert.throws(() => updateStoreFile(file, (store) => store, "wrong"), /changed/);
  assert.equal(readStoreFile(file).hash, first.hash);
  assert.deepEqual(await fs.readdir(dir), ["store.json"]);
});
