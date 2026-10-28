const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { readStoreFile, updateStoreFile, compareAndSetStoreValue } = require("../store-file.cjs");

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

test("library IPC-equivalent writes reject a second stale client without dropping the first outbox", async (t) => {
  await fs.mkdir(QA_ROOT, { recursive: true });
  const dir = await fs.mkdtemp(path.join(QA_ROOT, "store-library-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "store.json");
  assert.equal(typeof compareAndSetStoreValue, "function");
  const first = { schema_version: 1, outbox: ["first pending"] };
  compareAndSetStoreValue(file, "nownote.library.v1", first, null);
  assert.throws(() => compareAndSetStoreValue(file, "nownote.library.v1", { outbox: ["second pending"] }, null), /다른 실행/);
  assert.deepEqual(readStoreFile(file).store.values["nownote.library.v1"], first);
  assert.deepEqual(await fs.readdir(dir), ["store.json"]);
});

test("two real store writer processes serialize read-modify-write without losing unrelated keys", async (t) => {
  await fs.mkdir(QA_ROOT, { recursive: true });
  const dir = await fs.mkdtemp(path.join(QA_ROOT, "store-processes-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "store.json");
  const code = `const {updateStoreFile}=require(${JSON.stringify(require.resolve('../store-file.cjs'))});for(let i=0;i<30;i++)updateStoreFile(${JSON.stringify(file)},s=>{s.values.count=(s.values.count||0)+1;s.values[process.argv[1]]=true;return s;});`;
  const launch = label => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["-e", code, label], { stdio: ["ignore", "ignore", "pipe"] });
    let errors = ""; child.stderr.on("data", bytes => { errors += bytes; });
    child.on("error", reject); child.on("exit", status => status === 0 ? resolve() : reject(new Error(errors)));
  });
  await Promise.all([launch("first"), launch("second")]);
  const values = readStoreFile(file).store.values;
  assert.equal(values.count, 60); assert.equal(values.first, true); assert.equal(values.second, true);
  assert.deepEqual(await fs.readdir(dir), ["store.json"]);
});
