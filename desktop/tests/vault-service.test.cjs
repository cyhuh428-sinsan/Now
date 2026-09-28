const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createVaultService } = require("../vault-service.cjs");
const { renderManagedMarkdown } = require("../vault-markdown.cjs");

const QA_ROOT = "D:\\tmp\\nownote-239-vault-qa";

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

test("desktop-store failure after a Vault write does not advance the baseline", async (t) => {
  const { root, storePath, backupDir } = await fixture(t, [topic()]);
  const service = createVaultService({ storePath, backupDir, beforeStoreCommit: async () => { throw new Error("injected store failure"); } });
  const plan = await service.previewVault({ direction: "toVault" });
  const result = await service.applyVault({ planId: plan.planId, selections: [{ itemId: "t", action: "toVault" }] });
  assert.equal(result.failed.length, 1);
  assert.equal(result.applied.length, 0);
  assert.match(await fs.readFile(path.join(root, "Topic", "_index.md"), "utf8"), /nownote_id: t/);
  const baselines = JSON.parse(await fs.readFile(storePath, "utf8")).values["nownote.vault.v1"].baselines;
  assert.deepEqual(baselines, {});
  const next = await service.previewVault({ direction: "both" });
  assert.equal(next.items.find((item) => item.id === "t").classification, "unchanged");
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
  assert.equal(accepted.applied.length, 1);
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
