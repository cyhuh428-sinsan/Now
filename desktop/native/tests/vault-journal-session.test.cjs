const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { createVaultJournalSession } = require("../../vault-journal-session.cjs");
const { createVaultNativeClient } = require("../../vault-native-client.cjs");
const { runVaultTransaction, recoveryStatus } = require("../../vault-transaction.cjs");

const QA_ROOT = "D:\\tmp\\nownote-239-vault-qa";
const EXE = path.resolve(__dirname, "..", "out", "vault-journal-experiment.exe");

async function fixture() {
  await assertRealDirectory(path.parse(QA_ROOT).root);
  await assertRealDirectory(path.dirname(QA_ROOT));
  await assertRealDirectory(QA_ROOT);
  const dir = await fs.mkdtemp(path.join(QA_ROOT, "journal-session-"));
  return dir;
}

async function assertRealDirectory(directory) {
  const info = await fs.lstat(directory);
  assert.equal(info.isDirectory() && !info.isSymbolicLink(), true, `Unsafe fixture directory: ${directory}`);
  assert.equal((await fs.realpath(directory)).toLowerCase(), path.resolve(directory).toLowerCase());
}

async function cleanupFixture(root) {
  await assertRealDirectory(QA_ROOT);
  assert.equal(path.dirname(root).toLowerCase(), path.resolve(QA_ROOT).toLowerCase());
  assert.match(path.basename(root), /^journal-session-[A-Za-z0-9]+$/);
  await assertRealDirectory(root);
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    assert.equal(entry.isDirectory(), false, "Fixture cleanup refuses nested directories");
    assert.ok(["nownote-vault-journal.bin", "outside-sentinel.bin"].includes(entry.name));
    await fs.unlink(path.join(root, entry.name));
  }
  await fs.rmdir(root);
}

function record(root, rootIdentity) {
  return {
    operationId: "native-session-1", root, rootIdentity, userDataRootIdentity: rootIdentity,
    itemId: "note-1", steps: [{ operation: "write", relativePath: "Topic/note.md",
      preHash: null, postHash: "a".repeat(64) }], phase: "prepared",
    preStoreHash: "b".repeat(64), createdAt: new Date().toISOString(), artifacts: {},
  };
}

test("native journal binds distinct userData and Vault identities and artifact roots", { timeout: 5000 }, async () => {
  const parent = await fixture();
  const userData = path.join(parent, "userData");
  const vault = path.join(parent, "vault");
  await fs.mkdir(userData);
  await fs.mkdir(vault);
  await fs.mkdir(path.join(userData, "backups"));
  await fs.mkdir(path.join(vault, "Topic"));
  let journal;
  try {
    journal = await createVaultJournalSession({ exePath: EXE, root: userData });
    const client = createVaultNativeClient({
      exePath: path.resolve(__dirname, "..", "out", "vault-helper-experiment.exe"),
      fixtureRoot: QA_ROOT,
    });
    const vaultIdentity = (await client.probe(vault)).rootIdentity;
    const entry = { ...record(vault, vaultIdentity), userDataRootIdentity: journal.rootIdentity };
    await assert.rejects(journal.begin({ ...entry, userDataRootIdentity: vaultIdentity }), /invalid|journal/i);
    await assert.rejects(journal.begin({ ...entry, rootIdentity: journal.rootIdentity }), /invalid|journal/i);
    await assert.rejects(journal.begin({
      ...entry, root: `${QA_ROOT}\\..\\outside`,
    }), /invalid|journal/i);
    await journal.begin(entry);
    await journal.advance(entry.operationId, { phase: "vaultConfirmed", artifacts: {
      backupPath: path.join(userData, "backups", `.nownote-backup-${"a".repeat(32)}`),
      pendingPath: path.join(vault, "Topic", `.nownote-pending-${"b".repeat(32)}`),
    } });
    assert.equal((await journal.read()).artifacts.pendingPath.startsWith(vault), true);
    await assert.rejects(journal.advance(entry.operationId, { artifacts: {
      tempPath: path.join(userData, "backups", `.nownote-temp-${"c".repeat(32)}`),
    } }), /invalid|journal/i);
  } finally {
    if (journal) await journal.kill();
    await fs.rmdir(path.join(userData, "backups"));
    for (const entry of await fs.readdir(userData)) {
      assert.equal(entry, "nownote-vault-journal.bin");
      await fs.unlink(path.join(userData, entry));
    }
    await fs.rmdir(userData);
    await fs.rmdir(path.join(vault, "Topic"));
    await fs.rmdir(vault);
    await fs.rmdir(parent);
  }
});

test("native journal session holds one lock through a transaction and survives process death", { timeout: 5000 }, async () => {
  const root = await fixture();
  let first;
  let reopened;
  try {
    first = await createVaultJournalSession({ exePath: EXE, root });
    assert.equal(await first.read(), null);
    await first.begin(record(root, first.rootIdentity));
    await assert.rejects(createVaultJournalSession({ exePath: EXE, root }), /locked|mutex|busy/i);
    await first.kill();
    reopened = await createVaultJournalSession({ exePath: EXE, root });
    assert.equal((await reopened.read()).operationId, "native-session-1");
    await assert.rejects(reopened.begin(record(root, reopened.rootIdentity)), /active|recovery/i);
    await assert.rejects(reopened.clear("native-session-1"), /confirmed|commit|recovery/i);
    assert.equal((await reopened.read()).operationId, "native-session-1");
  } finally {
    if (first) await first.kill();
    if (reopened) await reopened.kill();
    await cleanupFixture(root);
  }
});

test("native journal refuses damaged frames without removing recovery evidence", { timeout: 5000 }, async () => {
  const root = await fixture();
  let first;
  try {
    first = await createVaultJournalSession({ exePath: EXE, root });
    await first.begin(record(root, first.rootIdentity));
    await first.kill();
    const journalPath = path.join(root, "nownote-vault-journal.bin");
    await fs.appendFile(journalPath, Buffer.from([1, 2, 3]));
    await assert.rejects(createVaultJournalSession({ exePath: EXE, root }), /corrupt|incomplete|journal/i);
    assert.ok((await fs.stat(journalPath)).size > 3);
  } finally {
    if (first) await first.kill();
    await cleanupFixture(root);
  }
});

test("transaction waits for a durable native journal before mutation and closes only after store commit", { timeout: 5000 }, async () => {
  const root = await fixture();
  let journal;
  try {
    journal = await createVaultJournalSession({ exePath: EXE, root });
    let committed = false;
    const result = await runVaultTransaction({
      journal, record: record(root, journal.rootIdentity),
      mutate: async () => {
        assert.equal((await journal.read()).phase, "prepared");
        await assert.rejects(createVaultJournalSession({ exePath: EXE, root }), /locked|busy/i);
        return { fileHash: "a".repeat(64) };
      },
      verifyVault: async () => true,
      commitStore: async () => { committed = true; return "c".repeat(64); },
    });
    assert.equal(result.recoveryRequired, false);
    assert.equal(committed, true);
    assert.equal(await journal.read(), null);
    const status = await recoveryStatus({ journal, inspectVault: async () => {
      throw new Error("No Vault inspection is needed after clear");
    }, readStore: async () => { throw new Error("No store read is needed after clear"); } });
    assert.equal(status.required, false);
  } finally {
    if (journal) await journal.kill();
    await cleanupFixture(root);
  }
});

test("native journal rejects note bodies and secrets before recording", { timeout: 5000 }, async () => {
  const root = await fixture();
  let journal;
  try {
    journal = await createVaultJournalSession({ exePath: EXE, root });
    await assert.rejects(journal.begin({ ...record(root, journal.rootIdentity), smtp_password: "fixture-secret" }), /invalid|journal/i);
    assert.equal(await journal.read(), null);
  } finally {
    if (journal) await journal.kill();
    await cleanupFixture(root);
  }
});

test("native journal rejects a valid-checksum frame that skips transaction phases", { timeout: 5000 }, async () => {
  const root = await fixture();
  let journal;
  let unexpected;
  try {
    journal = await createVaultJournalSession({ exePath: EXE, root });
    await journal.begin(record(root, journal.rootIdentity));
    await journal.kill();
    const body = Buffer.from(JSON.stringify({ sequence: 2, record: {
      ...record(root, journal.rootIdentity), phase: "storeCommitted", postStoreHash: "c".repeat(64),
    } }));
    const frame = Buffer.alloc(4 + 32 + body.length);
    frame.writeUInt32LE(body.length, 0);
    createHash("sha256").update(body).digest().copy(frame, 4);
    body.copy(frame, 36);
    await fs.appendFile(path.join(root, "nownote-vault-journal.bin"), frame);
    await assert.rejects(async () => {
      unexpected = await createVaultJournalSession({ exePath: EXE, root });
    }, /corrupt|journal/i);
  } finally {
    if (journal) await journal.kill();
    if (unexpected) await unexpected.kill();
    await cleanupFixture(root);
  }
});

test("native journal replay rejects a tombstone after only prepared", { timeout: 5000 }, async () => {
  const root = await fixture();
  let journal;
  let unexpected;
  try {
    journal = await createVaultJournalSession({ exePath: EXE, root });
    await journal.begin(record(root, journal.rootIdentity));
    await journal.kill();
    const body = Buffer.from(JSON.stringify({ sequence: 2, record: null }));
    const frame = Buffer.alloc(4 + 32 + body.length);
    frame.writeUInt32LE(body.length, 0);
    createHash("sha256").update(body).digest().copy(frame, 4);
    body.copy(frame, 36);
    await fs.appendFile(path.join(root, "nownote-vault-journal.bin"), frame);
    await assert.rejects(async () => {
      unexpected = await createVaultJournalSession({ exePath: EXE, root });
    }, /corrupt|journal/i);
  } finally {
    if (journal) await journal.kill();
    if (unexpected) await unexpected.kill();
    await cleanupFixture(root);
  }
});

test("native journal refuses store completion without a hash and artifacts outside QA", { timeout: 5000 }, async () => {
  const root = await fixture();
  let journal;
  try {
    journal = await createVaultJournalSession({ exePath: EXE, root });
    await journal.begin(record(root, journal.rootIdentity));
    await assert.rejects(journal.advance("native-session-1", {
      phase: "vaultConfirmed", artifacts: { backupPath: "C:\\outside\\backup.md" },
    }), /invalid|journal/i);
    await assert.rejects(journal.advance("native-session-1", {
      phase: "vaultConfirmed", artifacts: {
        backupPath: path.join(QA_ROOT, "another-fixture", `.nownote-backup-${"a".repeat(32)}`),
      },
    }), /invalid|journal/i);
    await assert.rejects(journal.advance("native-session-1", {
      phase: "vaultConfirmed", postStoreHash: "c".repeat(64),
    }), /invalid|journal/i);
    await journal.advance("native-session-1", { phase: "vaultConfirmed" });
    await assert.rejects(journal.advance("native-session-1", { phase: "storeCommitted" }), /invalid|journal/i);
    assert.equal((await journal.read()).phase, "vaultConfirmed");
  } finally {
    if (journal) await journal.kill();
    await cleanupFixture(root);
  }
});

test("unresponsive journal session exits and releases its mutex", { timeout: 5000 }, async () => {
  const root = await fixture();
  let journal;
  let reopened;
  try {
    journal = await createVaultJournalSession({
      exePath: EXE, root, requestTimeoutMs: 100, testPauseReadMs: 1000,
    });
    await assert.rejects(journal.read(), /timed out|timeout/i);
    reopened = await createVaultJournalSession({ exePath: EXE, root });
    assert.equal(await reopened.read(), null);
  } finally {
    if (journal) await journal.kill();
    if (reopened) await reopened.kill();
    await cleanupFixture(root);
  }
});

test("native journal cannot replace an earlier recovery artifact", { timeout: 5000 }, async () => {
  const root = await fixture();
  await fs.mkdir(path.join(root, "backups"));
  let journal;
  try {
    journal = await createVaultJournalSession({ exePath: EXE, root });
    await journal.begin(record(root, journal.rootIdentity));
    const original = path.join(root, "backups", `.nownote-backup-${"a".repeat(32)}`);
    const replacement = path.join(root, "backups", `.nownote-backup-${"b".repeat(32)}`);
    await journal.advance("native-session-1", { phase: "vaultConfirmed", artifacts: { backupPath: original } });
    await assert.rejects(journal.advance("native-session-1", {
      artifacts: { backupPath: replacement },
    }), /invalid|journal/i);
    assert.equal((await journal.read()).artifacts.backupPath, original);
  } finally {
    if (journal) await journal.kill();
    await fs.rmdir(path.join(root, "backups"));
    await cleanupFixture(root);
  }
});

test("native journal refuses an artifact through a directory junction", { timeout: 5000 }, async () => {
  const root = await fixture();
  const target = path.join(root, "safe");
  const junction = path.join(root, "redirect");
  await fs.mkdir(target);
  await fs.symlink(target, junction, "junction");
  let journal;
  try {
    journal = await createVaultJournalSession({ exePath: EXE, root });
    await journal.begin(record(root, journal.rootIdentity));
    await assert.rejects(journal.advance("native-session-1", {
      phase: "vaultConfirmed", artifacts: {
        backupPath: path.join(junction, `.nownote-backup-${"a".repeat(32)}`),
      },
    }), /invalid|journal/i);
    assert.equal((await journal.read()).phase, "prepared");
  } finally {
    if (journal) await journal.kill();
    await fs.unlink(junction);
    await fs.rmdir(target);
    await cleanupFixture(root);
  }
});

test("native journal refuses a hard-linked file without changing its source", { timeout: 5000 }, async () => {
  const root = await fixture();
  const source = path.join(root, "outside-sentinel.bin");
  const name = path.join(root, "nownote-vault-journal.bin");
  await fs.writeFile(source, "fixture-sentinel");
  await fs.link(source, name);
  try {
    await assert.rejects(createVaultJournalSession({ exePath: EXE, root }), /journal|unsafe/i);
    assert.equal(await fs.readFile(source, "utf8"), "fixture-sentinel");
  } finally {
    await cleanupFixture(root);
  }
});

test("native journal refuses a file reparse point without following it", { timeout: 5000 }, async () => {
  const root = await fixture();
  const source = path.join(root, "outside-sentinel.bin");
  const name = path.join(root, "nownote-vault-journal.bin");
  await fs.writeFile(source, "fixture-sentinel");
  await fs.symlink(source, name, "file");
  try {
    await assert.rejects(createVaultJournalSession({ exePath: EXE, root }), /journal|unsafe/i);
    assert.equal(await fs.readFile(source, "utf8"), "fixture-sentinel");
  } finally {
    await fs.unlink(name);
    await cleanupFixture(root);
  }
});

test("native journal refuses an oversized existing file without truncating it", { timeout: 5000 }, async () => {
  const root = await fixture();
  const name = path.join(root, "nownote-vault-journal.bin");
  await fs.writeFile(name, Buffer.alloc(128 * 1024 + 1, 65));
  try {
    await assert.rejects(createVaultJournalSession({ exePath: EXE, root }), /journal|corrupt/i);
    assert.equal((await fs.stat(name)).size, 128 * 1024 + 1);
  } finally {
    await cleanupFixture(root);
  }
});
