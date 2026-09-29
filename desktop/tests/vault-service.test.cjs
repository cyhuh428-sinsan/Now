const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { createVaultService } = require("../vault-service.cjs");
const { renderManagedMarkdown } = require("../vault-markdown.cjs");
const { createVaultJournal } = require("../vault-journal.cjs");

const QA_ROOT = process.platform === "win32" ? "D:\\tmp\\nownote-239-vault-qa" : path.join(os.tmpdir(), "nownote-239-vault-qa");

async function fixture(t, tree) {
  await fs.mkdir(QA_ROOT, { recursive: true });
  const dir = await fs.mkdtemp(path.join(QA_ROOT, "vault-service-"));
  const root = path.join(dir, "vault");
  const storePath = path.join(dir, "userData", "nownote-desktop-store.json");
  const backupDir = path.join(dir, "backups");
  await fs.mkdir(root);
  await fs.mkdir(path.dirname(storePath));
  await fs.writeFile(storePath, JSON.stringify({ version: 1, updatedAt: null, values: {
    "nownote.web.v1": { tree }, "nownote.vault.v1": { path: root, baselines: {}, lastSuccessAt: null },
  } }));
  t.after(async () => {
    if (path.resolve(dir).startsWith(`${path.resolve(QA_ROOT)}${path.sep}`)) await fs.rm(dir, { recursive: true, force: true });
  });
  return { dir, root, storePath, backupDir, service: createVaultService({ storePath, backupDir }) };
}

function topic(body = "hello") {
  return { id: "t", title: "Topic", content: body, level: 1, status: "active", children: [], tags: [] };
}

test("fixture transaction journal blocks Vault selection, preview and apply after restart", async (t) => {
  const { dir, root, storePath, backupDir } = await fixture(t, [topic()]);
  const journal = createVaultJournal({ journalPath: path.join(dir, "userData", "vault-operation.json") });
  const operationId = "test-operation";
  journal.begin({
    operationId, root, rootIdentity: { volumeId: "volume", fileId: "file" }, itemId: "t",
    steps: [{ operation: "write", relativePath: "Topic/_index.md", preHash: null, postHash: "a".repeat(64) }],
    phase: "prepared", preStoreHash: "b".repeat(64), createdAt: new Date().toISOString(), artifacts: {},
  });
  const service = createVaultService({ storePath, backupDir, vaultTransaction: { assertClear: () => journal.assertClear() } });
  assert.equal(service.vaultStatus().recoveryRequired, true);
  await assert.rejects(service.setVaultPath(root), /journal|recovery/i);
  await assert.rejects(service.previewVault({ direction: "both" }), /journal|recovery/i);
  await assert.rejects(service.applyVault({ planId: "none", selections: [] }), /journal|recovery/i);
  journal.clear(operationId);
  assert.equal(service.vaultStatus().recoveryRequired, false);
  await assert.rejects(service.previewVault({ direction: "both" }), /fixture|native/i);
  await assert.rejects(service.setVaultPath(root), /fixture|native/i);
  await assert.rejects(service.applyVault({ planId: "none", selections: [] }), /native|fixture|experiment/i);
  assert.throws(() => createVaultService({
    storePath: path.join(path.parse(dir).root, "outside-store.json"), backupDir,
    vaultTransaction: { assertClear: () => {} },
  }), /fixture|QA/i);
});

test("preview is read-only and explicit apply exports a note with a durable baseline", async (t) => {
  const { root, storePath, backupDir, service } = await fixture(t, [topic()]);
  const before = await fs.readFile(storePath);
  const plan = await service.previewVault({ direction: "both" });
  assert.equal(plan.items.find((item) => item.id === "t").classification, "newLocal");
  assert.deepEqual(await fs.readFile(storePath), before);
  assert.deepEqual(await fs.readdir(root), []);
  const result = await service.applyVault({ planId: plan.planId, selections: [{ itemId: "t", action: "toVault" }] });
  assert.equal(result.applied.length, 1);
  assert.match(await fs.readFile(path.join(root, "Topic", "_index.md"), "utf8"), /nownote_id: t/);
  const state = JSON.parse(await fs.readFile(storePath, "utf8"));
  assert.ok(state.values["nownote.vault.v1"].baselines.t);
  assert.ok(service.vaultStatus().lastSuccessAt);
  assert.equal(service.vaultStatus().lastResult.applied, 1);
  assert.equal(createVaultService({ storePath, backupDir }).vaultStatus().path, root);
});

test("a corrupt desktop store is reported as blocking Vault sync", async (t) => {
  const { storePath, service } = await fixture(t, [topic()]);
  await fs.writeFile(storePath, "{invalid json");
  assert.equal(service.vaultStatus().recoveryRequired, true);
  await assert.rejects(service.previewVault({ direction: "both" }));
});

test("desktop-store failure after a Vault write preserves the result for manual recovery", async (t) => {
  const { root, storePath, backupDir } = await fixture(t, [topic()]);
  const service = createVaultService({ storePath, backupDir, beforeStoreCommit: async () => { throw new Error("injected store failure"); } });
  const plan = await service.previewVault({ direction: "toVault" });
  const result = await service.applyVault({ planId: plan.planId, selections: [{ itemId: "t", action: "toVault" }] });
  assert.equal(result.failed.length, 1);
  assert.equal(result.applied.length, 0);
  assert.match(await fs.readFile(path.join(root, "Topic", "_index.md"), "utf8"), /nownote_id: t/);
  assert.equal(service.vaultStatus().recoveryRequired, true);
  const baselines = JSON.parse(await fs.readFile(storePath, "utf8")).values["nownote.vault.v1"].baselines;
  assert.deepEqual(baselines, {});
  await assert.rejects(service.previewVault({ direction: "both" }), /recovery|journal/i);
});

test("uncertain Vault write remains blocked across service restart", async (t) => {
  const { root, storePath, backupDir } = await fixture(t, [topic()]);
  const service = createVaultService({ storePath, backupDir, beforeStoreCommit: async () => {
    throw new Error("injected store failure");
  } });
  const plan = await service.previewVault({ direction: "toVault" });
  const result = await service.applyVault({ planId: plan.planId, selections: [{ itemId: "t", action: "toVault" }] });

  assert.equal(result.applied.length, 0);
  assert.equal(result.failed.length, 1);
  assert.match(await fs.readFile(path.join(root, "Topic", "_index.md"), "utf8"), /nownote_id: t/);
  assert.equal(service.vaultStatus().recoveryRequired, true);

  const restarted = createVaultService({ storePath, backupDir });
  assert.equal(restarted.vaultStatus().recoveryRequired, true);
  await assert.rejects(restarted.previewVault({ direction: "both" }), /recovery|journal/i);
  await assert.rejects(restarted.setVaultPath(root), /recovery|journal/i);
  assert.deepEqual(JSON.parse(await fs.readFile(storePath, "utf8")).values["nownote.vault.v1"].baselines, {});
});

test("manual recovery confirmation rejects mixed state and accepts a verified rollback", async (t) => {
  const { root, storePath, backupDir } = await fixture(t, [topic()]);
  const service = createVaultService({ storePath, backupDir, beforeStoreCommit: async () => {
    throw new Error("injected store failure");
  } });
  const plan = await service.previewVault({ direction: "toVault" });
  await service.applyVault({ planId: plan.planId, selections: [{ itemId: "t", action: "toVault" }] });
  const restarted = createVaultService({ storePath, backupDir });
  const operationId = restarted.vaultStatus().recovery.operationId;

  assert.equal((await restarted.recoveryStatus()).reason, "mixedState");
  await assert.rejects(restarted.confirmRecovery({ operationId }), /recovery state/i);
  await fs.unlink(path.join(root, "Topic", "_index.md"));
  const status = await restarted.recoveryStatus();
  assert.equal(status.beforeMatches, true);
  assert.equal(status.afterMatches, false);
  await restarted.confirmRecovery({ operationId });
  assert.equal(restarted.vaultStatus().recoveryRequired, false);
  assert.ok(await restarted.previewVault({ direction: "both" }));
});

test("manual recovery confirmation accepts a fully committed result after interrupted acknowledgement", async (t) => {
  const { root, storePath, backupDir } = await fixture(t, [topic()]);
  const service = createVaultService({ storePath, backupDir, afterStoreCommit: async () => {
    throw new Error("injected acknowledgement failure");
  } });
  const plan = await service.previewVault({ direction: "toVault" });
  const result = await service.applyVault({ planId: plan.planId, selections: [{ itemId: "t", action: "toVault" }] });
  assert.equal(result.recoveryRequired, true);
  const restarted = createVaultService({ storePath, backupDir });
  const status = await restarted.recoveryStatus();
  assert.equal(status.afterMatches, true);
  await restarted.confirmRecovery({ operationId: status.record.operationId });
  assert.equal(restarted.vaultStatus().recoveryRequired, false);
  assert.equal((await restarted.previewVault({ direction: "both" })).items.find((item) => item.id === "t").classification, "unchanged");
  assert.match(await fs.readFile(path.join(root, "Topic", "_index.md"), "utf8"), /nownote_id: t/);
});

test("a completed write reports a temporary cleanup warning without losing its baseline", async (t) => {
  const { root, storePath, service } = await fixture(t, [topic()]);
  const originalRm = fs.rm;
  fs.rm = async (target, options) => {
    if (String(target).endsWith(".tmp")) { const error = new Error("injected cleanup failure"); error.code = "EPERM"; throw error; }
    return originalRm(target, options);
  };
  let result;
  try {
    const plan = await service.previewVault({ direction: "toVault" });
    result = await service.applyVault({ planId: plan.planId, selections: [{ itemId: "t", action: "toVault" }] });
  } finally {
    fs.rm = originalRm;
  }
  assert.equal(result.applied.length, 1);
  assert.equal(result.failed.length, 0);
  assert.ok(result.applied[0].tempCleanupPath);
  assert.match(await fs.readFile(path.join(root, "Topic", "_index.md"), "utf8"), /nownote_id: t/);
  assert.ok(JSON.parse(await fs.readFile(storePath, "utf8")).values["nownote.vault.v1"].baselines.t);
});

test("a successful replacement reports the retained original path", async (t) => {
  const { root, storePath, service } = await fixture(t, [topic()]);
  const first = await service.previewVault({ direction: "toVault" });
  assert.equal((await service.applyVault({ planId: first.planId, selections: [{ itemId: "t", action: "toVault" }] })).applied.length, 1);
  const store = JSON.parse(await fs.readFile(storePath, "utf8"));
  store.values["nownote.web.v1"].tree[0].content = "updated body";
  await fs.writeFile(storePath, JSON.stringify(store));
  const second = await service.previewVault({ direction: "toVault" });
  const result = await service.applyVault({ planId: second.planId, selections: [{ itemId: "t", action: "toVault" }] });
  assert.equal(result.applied.length, 1);
  assert.ok(result.applied[0].preservedPath);
  assert.match(await fs.readFile(result.applied[0].preservedPath, "utf8"), /hello/);
  assert.match(await fs.readFile(path.join(root, "Topic", "_index.md"), "utf8"), /updated body/);
});

test("desktop-store failure after a rename retains a recoverable original", async (t) => {
  const { root, storePath, backupDir } = await fixture(t, [topic()]);
  const initial = createVaultService({ storePath, backupDir });
  const first = await initial.previewVault({ direction: "toVault" });
  assert.equal((await initial.applyVault({ planId: first.planId, selections: [{ itemId: "t", action: "toVault" }] })).applied.length, 1);
  const originalPath = path.join(root, "Topic", "_index.md");
  const original = await fs.readFile(originalPath);
  const store = JSON.parse(await fs.readFile(storePath, "utf8"));
  store.values["nownote.web.v1"].tree[0].title = "Renamed";
  await fs.writeFile(storePath, JSON.stringify(store));
  const service = createVaultService({ storePath, backupDir, beforeStoreCommit: async () => { throw new Error("injected store failure"); } });
  const plan = await service.previewVault({ direction: "toVault" });
  const failed = await service.applyVault({ planId: plan.planId, selections: [{ itemId: "t", action: "toVault" }] });
  assert.equal(failed.failed.length, 1);
  assert.equal(service.vaultStatus().recoveryRequired, true);
  await assert.rejects(service.previewVault({ direction: "both" }), /recovery|journal/i);
  await assert.rejects(fs.readFile(originalPath), { code: "ENOENT" });
  assert.match(await fs.readFile(path.join(root, "Renamed", "_index.md"), "utf8"), /Renamed/);
  const backups = await Promise.all((await fs.readdir(backupDir)).map((name) => fs.readFile(path.join(backupDir, name))));
  assert.ok(backups.some((backup) => backup.equals(original)));
});

test("a file modified after preview is never overwritten or advanced", async (t) => {
  const { root, storePath, service } = await fixture(t, [topic()]);
  const file = path.join(root, "Topic", "_index.md");
  await fs.mkdir(path.dirname(file));
  await fs.writeFile(file, "original unmanaged file");
  const plan = await service.previewVault({ direction: "both" });
  assert.equal(plan.items.find((item) => item.id === "t").classification, "conflict");
  await fs.writeFile(file, "changed outside");
  const result = await service.applyVault({ planId: plan.planId, selections: [{ itemId: "t", action: "toVault" }] });
  assert.equal(result.failed.length, 1);
  assert.equal(await fs.readFile(file, "utf8"), "changed outside");
  assert.deepEqual(JSON.parse(await fs.readFile(storePath, "utf8")).values["nownote.vault.v1"].baselines, {});
});

test("a NowNote edit after preview rejects the stale plan", async (t) => {
  const { root, storePath, service } = await fixture(t, [topic()]);
  const plan = await service.previewVault({ direction: "toVault" });
  const store = JSON.parse(await fs.readFile(storePath, "utf8"));
  store.values["nownote.web.v1"].tree[0].content = "later edit";
  await fs.writeFile(storePath, JSON.stringify(store));
  const result = await service.applyVault({ planId: plan.planId, selections: [{ itemId: "t", action: "toVault" }] });
  assert.equal(result.failed.length, 1);
  assert.deepEqual(await fs.readdir(root), []);
});

test("one selected write can succeed while another fails without advancing its baseline", async (t) => {
  const second = { id: "s", title: "Second", content: "two", level: 1, status: "active", children: [], tags: [] };
  const { root, storePath, service } = await fixture(t, [topic(), second]);
  const plan = await service.previewVault({ direction: "toVault" });
  await fs.mkdir(path.join(root, "Second"));
  await fs.writeFile(path.join(root, "Second", "_index.md"), "external");
  const result = await service.applyVault({ planId: plan.planId, selections: [
    { itemId: "t", action: "toVault" }, { itemId: "s", action: "toVault" },
  ] });
  assert.deepEqual(result.applied.map((item) => item.itemId), ["t"]);
  assert.deepEqual(result.failed.map((item) => item.itemId), ["s"]);
  const baselines = JSON.parse(await fs.readFile(storePath, "utf8")).values["nownote.vault.v1"].baselines;
  assert.ok(baselines.t);
  assert.equal(baselines.s, undefined);
});

test("unlinked Vault notes require an explicit parent and do not auto-import", async (t) => {
  const category = { id: "c", title: "Category", content: "", level: 2, status: "active", children: [], tags: [] };
  const parent = topic();
  parent.children.push(category);
  const { root, storePath, service } = await fixture(t, [parent]);
  await fs.writeFile(path.join(root, "loose.md"), "new note\n");
  const plan = await service.previewVault({ direction: "fromVault" });
  const unlinked = plan.items.find((item) => item.classification === "unlinked" && item.paths.vault === "loose.md");
  assert.ok(unlinked);
  const rejected = await service.applyVault({ planId: plan.planId, selections: [{ itemId: unlinked.itemId, action: "toNowNote" }] });
  assert.equal(rejected.failed.length, 1);
  const accepted = await service.applyVault({ planId: plan.planId, selections: [{ itemId: unlinked.itemId, action: "toNowNote", targetParentId: "c" }] });
  assert.equal(accepted.applied.length, 1, JSON.stringify(accepted.failed));
  const tree = JSON.parse(await fs.readFile(storePath, "utf8")).values["nownote.web.v1"].tree;
  assert.equal(tree[0].children[0].children[0].content, "new note\n");
  const second = await service.previewVault({ direction: "both" });
  assert.equal(second.items.find((item) => item.id === accepted.applied[0].id).classification, "unchanged");
});

test("a managed Vault-only note retains its existing identity when explicitly imported", async (t) => {
  const category = { id: "c", title: "Category", content: "", level: 2, status: "active", children: [], tags: [] };
  const parent = topic();
  parent.children.push(category);
  const { root, storePath, service } = await fixture(t, [parent]);
  await fs.writeFile(path.join(root, "loose.md"), renderManagedMarkdown({ id: "remote-1", kind: "note", title: "loose", body: "remote", tags: [] }));
  const plan = await service.previewVault({ direction: "fromVault" });
  const result = await service.applyVault({ planId: plan.planId, selections: [{ itemId: "remote-1", action: "toNowNote", targetParentId: "c" }] });
  assert.equal(result.applied[0].id, "remote-1");
  const tree = JSON.parse(await fs.readFile(storePath, "utf8")).values["nownote.web.v1"].tree;
  assert.equal(tree[0].children[0].children[0].id, "remote-1");
  assert.equal((await service.previewVault({ direction: "both" })).items.find((item) => item.id === "remote-1").classification, "unchanged");
});

test("equal first-contact content is shown as unlinked until explicitly confirmed", async (t) => {
  const { root, storePath, service } = await fixture(t, [topic()]);
  await fs.mkdir(path.join(root, "Topic"));
  await fs.writeFile(path.join(root, "Topic", "_index.md"), renderManagedMarkdown({ id: "t", kind: "topic", title: "Topic", body: "hello", tags: [] }));
  const first = await service.previewVault({ direction: "both" });
  assert.equal(first.items.find((item) => item.id === "t").classification, "unlinkedMatch");
  assert.deepEqual(JSON.parse(await fs.readFile(storePath, "utf8")).values["nownote.vault.v1"].baselines, {});
  assert.equal((await service.applyVault({ planId: first.planId, selections: [{ itemId: "t", action: "toVault" }] })).applied.length, 1);
  assert.equal((await service.previewVault({ direction: "both" })).items.find((item) => item.id === "t").classification, "unchanged");
});

test("the selected direction cannot be bypassed and deep files need a target category", async (t) => {
  const category = { id: "c", title: "Category", content: "", level: 2, status: "active", children: [], tags: [] };
  const parent = topic();
  parent.children.push(category);
  const { root, service } = await fixture(t, [parent]);
  await fs.mkdir(path.join(root, "one", "two", "three"), { recursive: true });
  await fs.writeFile(path.join(root, "one", "two", "three", "deep.md"), "deep");
  const plan = await service.previewVault({ direction: "fromVault" });
  const blocked = await service.applyVault({ planId: plan.planId, selections: [{ itemId: "t", action: "toVault" }] });
  assert.match(blocked.failed[0].message, /direction/);
  const deep = plan.items.find((item) => item.paths.vault === "one/two/three/deep.md");
  assert.equal(deep.classification, "depthExceeded");
  const missingParent = await service.applyVault({ planId: plan.planId, selections: [{ itemId: deep.itemId, action: "toNowNote" }] });
  assert.equal(missingParent.failed.length, 1);
  const accepted = await service.applyVault({ planId: plan.planId, selections: [{ itemId: deep.itemId, action: "toNowNote", targetParentId: "c" }] });
  assert.equal(accepted.applied.length, 1, JSON.stringify(accepted.failed));
});

test("an empty Vault folder can be explicitly imported as a topic and gain an index", async (t) => {
  const { root, storePath, service } = await fixture(t, []);
  await fs.mkdir(path.join(root, "Empty Topic"));
  const preview = await service.previewVault({ direction: "fromVault" });
  const candidate = preview.items.find((item) => item.paths.vault === "Empty Topic/_index.md");
  assert.equal(candidate.classification, "unlinked");
  assert.equal(await fs.readdir(path.join(root, "Empty Topic")).then((names) => names.length), 0);
  const applied = await service.applyVault({ planId: preview.planId, selections: [{ itemId: candidate.itemId, action: "toNowNote" }] });
  assert.equal(applied.applied.length, 1, JSON.stringify(applied.failed));
  const tree = JSON.parse(await fs.readFile(storePath, "utf8")).values["nownote.web.v1"].tree;
  assert.equal(tree[0].title, "Empty Topic");
  assert.match(await fs.readFile(path.join(root, "Empty Topic", "_index.md"), "utf8"), /nownote_kind: topic/);
  const next = await service.previewVault({ direction: "both" });
  assert.equal(next.items.find((item) => item.id === tree[0].id).classification, "unchanged");
});

test("an unmanaged category index imports beneath the selected topic", async (t) => {
  const { root, storePath, service } = await fixture(t, [topic()]);
  await fs.mkdir(path.join(root, "Topic", "Vault Category"), { recursive: true });
  await fs.writeFile(path.join(root, "Topic", "Vault Category", "_index.md"), "분류 본문");
  const preview = await service.previewVault({ direction: "fromVault" });
  const candidate = preview.items.find((item) => item.paths.vault === "Topic/Vault Category/_index.md");
  const applied = await service.applyVault({ planId: preview.planId, selections: [{ itemId: candidate.itemId, action: "toNowNote", targetParentId: "t" }] });
  assert.equal(applied.applied.length, 1, JSON.stringify(applied.failed));
  const tree = JSON.parse(await fs.readFile(storePath, "utf8")).values["nownote.web.v1"].tree;
  assert.equal(tree[0].children[0].title, "Vault Category");
  assert.equal(tree[0].children[0].content, "분류 본문");
  assert.match(await fs.readFile(path.join(root, "Topic", "Vault Category", "_index.md"), "utf8"), /nownote_kind: category/);
});

test("a renamed NowNote topic moves its linked Vault index without leaving a duplicate identity", async (t) => {
  const { root, storePath, service } = await fixture(t, [topic()]);
  const initial = await service.previewVault({ direction: "toVault" });
  assert.equal((await service.applyVault({ planId: initial.planId, selections: [{ itemId: "t", action: "toVault" }] })).applied.length, 1);
  const store = JSON.parse(await fs.readFile(storePath, "utf8"));
  store.values["nownote.web.v1"].tree[0].title = "Renamed";
  await fs.writeFile(storePath, JSON.stringify(store));
  const moved = await service.previewVault({ direction: "both" });
  assert.equal(moved.items.find((item) => item.id === "t").classification, "localChanged");
  const result = await service.applyVault({ planId: moved.planId, selections: [{ itemId: "t", action: "toVault" }] });
  assert.equal(result.applied.length, 1);
  assert.match(await fs.readFile(path.join(root, "Renamed", "_index.md"), "utf8"), /nownote_id: t/);
  assert.deepEqual(await fs.readdir(path.join(root, "Topic")), []);
  assert.equal((await service.previewVault({ direction: "both" })).items.find((item) => item.id === "t").classification, "unchanged");
});
