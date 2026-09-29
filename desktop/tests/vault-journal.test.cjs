const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { createVaultJournal } = require("../vault-journal.cjs");

const QA_ROOT = "D:\\tmp\\nownote-239-vault-qa";

async function fixture(t) {
  await fsp.mkdir(QA_ROOT, { recursive: true });
  const dir = await fsp.mkdtemp(path.join(QA_ROOT, "journal-"));
  t.after(async () => {
    if (path.resolve(dir).startsWith(`${path.resolve(QA_ROOT)}${path.sep}`)) {
      await fsp.rm(dir, { recursive: true, force: true });
    }
  });
  return { dir, journalPath: path.join(dir, "vault-operation.json") };
}

function record(root) {
  return {
    operationId: "9c3d9e5a-0d6f-4a4c-9bfd-61c6b6b0cf3a",
    root,
    rootIdentity: { volumeId: "volume", fileId: "file" },
    itemId: "topic-1",
    steps: [{ operation: "write", relativePath: "Topic/_index.md", preHash: null, postHash: "a".repeat(64) }],
    phase: "prepared",
    preStoreHash: "b".repeat(64),
    createdAt: "2026-09-28T00:00:00.000Z",
    artifacts: {},
  };
}

test("journal persists one operation across service instances and clears only its ID", async (t) => {
  const { dir, journalPath } = await fixture(t);
  const journal = createVaultJournal({ journalPath });
  const entry = record(path.join(dir, "vault"));
  assert.equal(journal.read(), null);
  journal.begin(entry);
  assert.deepEqual(createVaultJournal({ journalPath }).read(), entry);
  assert.throws(() => journal.begin(entry), /existing|active|journal/i);
  assert.throws(() => journal.advance("other", { phase: "vaultConfirmed" }), /operation|id|journal/i);
  journal.advance(entry.operationId, { phase: "vaultConfirmed", artifacts: { backupPath: path.join(dir, "backup.md") } });
  assert.equal(createVaultJournal({ journalPath }).read().phase, "vaultConfirmed");
  assert.throws(() => journal.clear("other"), /operation|id|journal/i);
  journal.clear(entry.operationId);
  assert.equal(journal.read(), null);
});

test("corrupt or directory journal blocks begin and is never treated as absent", async (t) => {
  const { dir, journalPath } = await fixture(t);
  await fsp.writeFile(journalPath, "{not-json");
  const journal = createVaultJournal({ journalPath });
  assert.throws(() => journal.read(), /journal|invalid|corrupt/i);
  assert.throws(() => journal.begin(record(dir)), /journal|existing|invalid/i);
  assert.equal(await fsp.readFile(journalPath, "utf8"), "{not-json");
  const directoryPath = path.join(dir, "journal-directory");
  await fsp.mkdir(directoryPath);
  assert.throws(() => createVaultJournal({ journalPath: directoryPath }).begin(record(dir)));
  assert.equal(fs.statSync(directoryPath).isDirectory(), true);
});

test("journal rejects note bodies and failed writes do not run a Vault mutation", async (t) => {
  const { dir, journalPath } = await fixture(t);
  const journal = createVaultJournal({ journalPath });
  assert.throws(() => journal.begin({ ...record(dir), body: "private note" }), /field|invalid|journal/i);
  assert.throws(() => journal.begin({
    ...record(dir), rootIdentity: { volumeId: "volume", fileId: "file", body: "private note" },
  }), /field|invalid|journal/i);
  assert.equal(journal.read(), null);
  const blockingFile = path.join(dir, "blocking-file");
  await fsp.writeFile(blockingFile, "unchanged");
  const impossible = createVaultJournal({ journalPath: path.join(blockingFile, "child.json") });
  let mutated = false;
  try {
    impossible.begin(record(dir));
    mutated = true;
  } catch {
    // A failed prepare leaves the caller before it can invoke the mutation.
  }
  assert.equal(mutated, false);
  assert.equal(journal.read(), null);
  assert.equal(await fsp.readFile(blockingFile, "utf8"), "unchanged");
});

test("journal updates retain earlier recovery paths and cannot move to an earlier phase", async (t) => {
  const { dir, journalPath } = await fixture(t);
  const journal = createVaultJournal({ journalPath });
  const entry = record(dir);
  journal.begin(entry);
  journal.advance(entry.operationId, { phase: "vaultConfirmed", artifacts: { backupPath: path.join(dir, "backup.md") } });
  journal.advance(entry.operationId, { phase: "vaultConfirmed", artifacts: { preservedPath: path.join(dir, "preserved.md") } });
  assert.deepEqual(journal.read().artifacts, {
    backupPath: path.join(dir, "backup.md"), preservedPath: path.join(dir, "preserved.md"),
  });
  assert.throws(() => journal.advance(entry.operationId, { phase: "prepared" }), /phase|journal|regress/i);
  assert.equal(journal.read().phase, "vaultConfirmed");
});

test("an existing journal lock blocks a second writer and preserves the record", async (t) => {
  const { dir, journalPath } = await fixture(t);
  const journal = createVaultJournal({ journalPath });
  const entry = record(dir);
  journal.begin(entry);
  const lockPath = `${journalPath}.lock`;
  await fsp.writeFile(lockPath, "other writer");
  assert.throws(() => journal.assertClear(), /lock|busy|journal/i);
  assert.throws(() => journal.advance(entry.operationId, { phase: "vaultConfirmed" }), /lock|busy|journal/i);
  assert.throws(() => journal.clear(entry.operationId), /lock|busy|journal/i);
  assert.equal(journal.read().phase, "prepared");
  assert.equal(await fsp.readFile(lockPath, "utf8"), "other writer");
});

test("an orphan journal lock blocks a new sync even when no record exists", async (t) => {
  const { journalPath } = await fixture(t);
  const journal = createVaultJournal({ journalPath });
  await fsp.writeFile(`${journalPath}.lock`, "interrupted writer");
  assert.equal(journal.read(), null);
  assert.throws(() => journal.assertClear(), /lock|busy|journal/i);
});

test("lock recovery remains blocked until handle-safe recovery exists", async (t) => {
  const { journalPath } = await fixture(t);
  const journal = createVaultJournal({ journalPath });
  const lockPath = `${journalPath}.lock`;
  await fsp.writeFile(lockPath, JSON.stringify({ pid: process.pid, token: "live" }));
  assert.throws(() => journal.recoverStaleLock(), /active|running|lock/i);
  assert.equal((await fsp.stat(lockPath)).isFile(), true);
  await fsp.writeFile(lockPath, JSON.stringify({ pid: 2147483647, token: "dead" }));
  assert.throws(() => journal.recoverStaleLock(), /handle|unsafe|recovery/i);
  assert.equal((await fsp.stat(lockPath)).isFile(), true);
  assert.throws(() => journal.assertClear(), /lock|busy|journal/i);
});

test("journal fields cannot contain control characters or traversal paths", async (t) => {
  const { dir, journalPath } = await fixture(t);
  const journal = createVaultJournal({ journalPath });
  assert.throws(() => journal.begin({ ...record(dir), itemId: "note\nprivate body" }), /invalid|journal/i);
  assert.throws(() => journal.begin({
    ...record(dir), steps: [{ operation: "write", relativePath: "../outside.md", preHash: null, postHash: "a".repeat(64) }],
  }), /invalid|journal/i);
  assert.throws(() => journal.begin({
    ...record(dir), steps: [{ operation: "move", relativePath: "note.md", preHash: "a".repeat(64), postHash: "a".repeat(64) }],
  }), /invalid|journal/i);
  assert.throws(() => journal.begin({
    ...record(dir), steps: [{ operation: "rollback", relativePath: "note.md", preHash: "a".repeat(64), postHash: "a".repeat(64) }],
  }), /invalid|journal/i);
  assert.throws(() => journal.begin({ ...record(dir), steps: [null] }), /invalid|journal/i);
  assert.equal(journal.read(), null);
});
