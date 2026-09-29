const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createHash, randomUUID } = require("node:crypto");
const { createVaultJournal } = require("../vault-journal.cjs");
const { createVaultNativeClient } = require("../vault-native-client.cjs");
const { runVaultTransaction, recoveryStatus, confirmRecovery } = require("../vault-transaction.cjs");

const QA_ROOT = "D:\\tmp\\nownote-239-vault-qa";
const EXE = path.resolve(__dirname, "..", "native", "out", "vault-helper-experiment.exe");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function fixture(t) {
  await fs.mkdir(QA_ROOT, { recursive: true });
  const dir = await fs.mkdtemp(path.join(QA_ROOT, "transaction-"));
  const root = path.join(dir, "vault");
  const backupDir = path.join(dir, "backup");
  await fs.mkdir(root);
  await fs.mkdir(backupDir);
  t.after(async () => {
    if (path.resolve(dir).startsWith(`${path.resolve(QA_ROOT)}${path.sep}`)) {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
  return { dir, root, backupDir, journalPath: path.join(dir, "userData", "vault-operation.json") };
}

function record(root, rootIdentity, preHash, postHash) {
  return {
    operationId: randomUUID(), root, rootIdentity, itemId: "note-1",
    steps: [{ operation: "write", relativePath: "note.md", preHash, postHash }],
    phase: "prepared", preStoreHash: hash("store-before"),
    createdAt: new Date().toISOString(), artifacts: {},
  };
}

function killedAfterFinalRename(t, request) {
  return new Promise((resolve, reject) => {
    const child = spawn(EXE, [], {
      windowsHide: true, shell: false,
      env: { ...process.env, NOWNOTE_VAULT_TEST_PAUSE_AFTER_FINAL_RENAME_MS: "5000" },
    });
    t.after(() => child.kill());
    let stderr = "";
    let ready = false;
    const timer = setTimeout(() => { child.kill(); reject(new Error(`No final rename: ${stderr}`)); }, 6000);
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk;
      if (!ready && stderr.includes("VAULT_TEST_FINAL_RENAME_READY")) {
        ready = true;
        clearTimeout(timer);
        child.kill("SIGKILL");
      }
    });
    child.once("error", reject);
    child.once("close", () => {
      clearTimeout(timer);
      if (ready) resolve();
    });
    child.stdin.end(JSON.stringify(request));
  });
}

async function inspectNote(client, entry) {
  const { rootIdentity } = await client.probe(entry.root);
  const listed = await client.list(entry.root, rootIdentity);
  const read = await client.read(entry.root, rootIdentity, "note.md");
  return { rootIdentity, recovery: listed.recovery, files: { "note.md": read.fileHash } };
}

test("native transaction records before mutation and clears after verified store commit", async (t) => {
  const { root, backupDir, journalPath } = await fixture(t);
  const client = createVaultNativeClient({ exePath: EXE, fixtureRoot: QA_ROOT });
  const rootIdentity = (await client.probe(root)).rootIdentity;
  const journal = createVaultJournal({ journalPath });
  const nextHash = hash("new note");
  const entry = record(root, rootIdentity, null, nextHash);
  let committed = false;
  const outcome = await runVaultTransaction({
    journal, record: entry,
    mutate: async () => {
      assert.equal(journal.read().operationId, entry.operationId);
      return client.write(root, rootIdentity, "note.md", null, Buffer.from("new note").toString("base64"), backupDir);
    },
    verifyVault: async () => (await client.read(root, rootIdentity, "note.md")).fileHash === nextHash,
    commitStore: async () => { committed = true; return hash("store-after"); },
  });
  assert.equal(outcome.recoveryRequired, false);
  assert.equal(committed, true);
  assert.equal(journal.read(), null);
  assert.equal(await fs.readFile(path.join(root, "note.md"), "utf8"), "new note");
});

test("helper death after final rename leaves journal and never commits store", async (t) => {
  const { root, backupDir, journalPath } = await fixture(t);
  await fs.writeFile(path.join(root, "note.md"), "original");
  const client = createVaultNativeClient({ exePath: EXE, fixtureRoot: QA_ROOT });
  const rootIdentity = (await client.probe(root)).rootIdentity;
  const journal = createVaultJournal({ journalPath });
  const entry = record(root, rootIdentity, hash("original"), hash("replacement"));
  let committed = false;
  const outcome = await runVaultTransaction({
    journal, record: entry,
    mutate: async () => {
      await killedAfterFinalRename(t, {
        protocol: 1, operation: "write", root, rootIdentity, relativePath: "note.md",
        expectedHash: hash("original"), contentBase64: Buffer.from("replacement").toString("base64"), backupDir,
      });
      throw new Error("helper exited without a response");
    },
    verifyVault: async () => true,
    commitStore: async () => { committed = true; return hash("store-after"); },
  });
  assert.equal(outcome.recoveryRequired, true);
  assert.equal(committed, false);
  assert.equal(createVaultJournal({ journalPath }).read().operationId, entry.operationId);
  assert.equal(await fs.readFile(path.join(root, "note.md"), "utf8"), "replacement");
  const preserved = (await fs.readdir(root)).find((name) => name.startsWith(".nownote-preserved-"));
  assert.equal(await fs.readFile(path.join(root, preserved), "utf8"), "original");
  const restartJournal = createVaultJournal({ journalPath });
  const recovery = {
    journal: restartJournal,
    inspectVault: (current) => inspectNote(client, current),
    readStore: async () => ({ hash: entry.preStoreHash }),
  };
  const mixed = await recoveryStatus(recovery);
  assert.equal(mixed.required, true);
  assert.equal(mixed.beforeMatches, false);
  assert.equal(mixed.afterMatches, false);
  await assert.rejects(confirmRecovery({ ...recovery, operationId: entry.operationId }), /mixed|match|recovery/i);
  assert.equal(restartJournal.read().operationId, entry.operationId);
  await fs.writeFile(path.join(root, "note.md"), "original");
  const restored = await recoveryStatus(recovery);
  assert.equal(restored.beforeMatches, true);
  await confirmRecovery({ ...recovery, operationId: entry.operationId });
  assert.equal(restartJournal.read(), null);
});

test("recovery confirms a fully committed post-state but refuses pending artifacts", async (t) => {
  const { root, journalPath } = await fixture(t);
  await fs.writeFile(path.join(root, "note.md"), "replacement");
  const client = createVaultNativeClient({ exePath: EXE, fixtureRoot: QA_ROOT });
  const rootIdentity = (await client.probe(root)).rootIdentity;
  const journal = createVaultJournal({ journalPath });
  const entry = record(root, rootIdentity, hash("original"), hash("replacement"));
  journal.begin(entry);
  const postStoreHash = hash("store-after");
  journal.advance(entry.operationId, { phase: "vaultConfirmed" });
  journal.advance(entry.operationId, { phase: "storeCommitted", postStoreHash });
  const recovery = {
    journal, inspectVault: (current) => inspectNote(client, current),
    readStore: async () => ({ hash: postStoreHash }),
  };
  assert.equal((await recoveryStatus(recovery)).afterMatches, true);
  await fs.writeFile(path.join(root, ".nownote-pending-interrupted"), "original");
  assert.equal((await recoveryStatus(recovery)).afterMatches, false);
  await assert.rejects(confirmRecovery({ ...recovery, operationId: entry.operationId }), /recovery|match|pending/i);
  await fs.unlink(path.join(root, ".nownote-pending-interrupted"));
  await confirmRecovery({ ...recovery, operationId: entry.operationId });
  assert.equal(journal.read(), null);
});

test("a store error after Vault mutation retains the journal without guessing rollback", async (t) => {
  const { root, backupDir, journalPath } = await fixture(t);
  const client = createVaultNativeClient({ exePath: EXE, fixtureRoot: QA_ROOT });
  const rootIdentity = (await client.probe(root)).rootIdentity;
  const journal = createVaultJournal({ journalPath });
  const entry = record(root, rootIdentity, null, hash("new note"));
  let rolledBack = false;
  const outcome = await runVaultTransaction({
    journal, record: entry,
    mutate: () => client.write(root, rootIdentity, "note.md", null, Buffer.from("new note").toString("base64"), backupDir),
    verifyVault: async () => (await client.read(root, rootIdentity, "note.md")).fileHash === hash("new note"),
    commitStore: async () => { throw new Error("store result unknown"); },
    restoreBefore: async () => { rolledBack = true; },
  });
  assert.equal(outcome.recoveryRequired, true);
  assert.equal(rolledBack, false);
  assert.equal(journal.read().phase, "vaultConfirmed");
  assert.equal(await fs.readFile(path.join(root, "note.md"), "utf8"), "new note");
});

test("journal update failure and an existing journal never permit a second store commit", async (t) => {
  const { root, backupDir, journalPath } = await fixture(t);
  const client = createVaultNativeClient({ exePath: EXE, fixtureRoot: QA_ROOT });
  const rootIdentity = (await client.probe(root)).rootIdentity;
  const realJournal = createVaultJournal({ journalPath });
  const entry = record(root, rootIdentity, null, hash("new note"));
  let committed = false;
  const journal = {
    begin: (value) => realJournal.begin(value),
    advance: () => { throw new Error("journal update blocked"); },
    clear: (id) => realJournal.clear(id),
  };
  const outcome = await runVaultTransaction({
    journal, record: entry,
    mutate: () => client.write(root, rootIdentity, "note.md", null, Buffer.from("new note").toString("base64"), backupDir),
    verifyVault: async () => true,
    commitStore: async () => { committed = true; return hash("store-after"); },
  });
  assert.equal(outcome.recoveryRequired, true);
  assert.equal(committed, false);
  assert.equal(realJournal.read().phase, "prepared");
  let secondMutation = false;
  await assert.rejects(runVaultTransaction({
    journal: realJournal, record: record(root, rootIdentity, null, hash("second")),
    mutate: async () => { secondMutation = true; },
    verifyVault: async () => true,
    commitStore: async () => hash("second"),
  }), /journal|active|existing/i);
  assert.equal(secondMutation, false);
});
