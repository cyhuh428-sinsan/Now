const test = require("node:test");
const assert = require("node:assert/strict");
const { mapNowTree, buildSyncPlan, contentHash } = require("../vault-plan.cjs");

function node(id, title, level, children = [], content = "") {
  return { id, title, level, content, tags: [], status: "active", children };
}

function vault(id, kind, relativePath, body = "") {
  return { id, kind, title: id, relativePath, body, tags: [] };
}

test("maps topic and category bodies to index files and notes to Markdown", () => {
  const entries = mapNowTree([node("t", "한글 주제", 1, [node("c", "분류", 2, [node("n", "메모", 3)])])]);
  assert.deepEqual(entries.map(({ id, kind, relativePath }) => ({ id, kind, relativePath })), [
    { id: "t", kind: "topic", relativePath: "한글 주제/_index.md" },
    { id: "c", kind: "category", relativePath: "한글 주제/분류/_index.md" },
    { id: "n", kind: "note", relativePath: "한글 주제/분류/메모.md" },
  ]);
});

test("unsafe Windows names are sanitized, but resulting case collisions block both items", () => {
  const entries = mapNowTree([node("t", "CON", 1, [node("c", "A:B", 2, [node("one", "Readme", 3), node("two", "README", 3)])])]);
  assert.equal(entries[0].relativePath, "_CON/_index.md");
  assert.equal(entries[1].relativePath, "_CON/A_B/_index.md");
  const plan = buildSyncPlan({ localNodes: entries, vaultEntries: [], baselines: {}, direction: "toVault" });
  assert.equal(plan.items.find((item) => item.id === "one").classification, "conflict");
  assert.equal(plan.items.find((item) => item.id === "two").classification, "conflict");
});

test("duplicate Vault identity and unmanaged index block writes", () => {
  const local = mapNowTree([node("t", "Topic", 1)]);
  const plan = buildSyncPlan({ localNodes: local, vaultEntries: [
    vault("t", "topic", "Topic/_index.md"),
    vault("t", "topic", "Other/_index.md"),
    { relativePath: "Other/_index.md", body: "unmanaged", managed: false },
  ], baselines: {}, direction: "both" });
  assert.equal(plan.items.find((item) => item.id === "t").classification, "conflict");
  assert.ok(plan.items.some((item) => item.classification === "unlinked"));
});

test("root files and folders beyond three levels remain unlinked", () => {
  const plan = buildSyncPlan({ localNodes: [], vaultEntries: [
    { relativePath: "loose.md", body: "text", managed: false },
    { relativePath: "Topic/Category/extra/deep.md", body: "text", managed: false },
  ], baselines: {}, direction: "both" });
  assert.deepEqual(plan.items.map((item) => item.classification), ["unlinked", "depthExceeded"]);
  assert.ok(plan.items.every((item) => item.defaultAction === "skip"));
});

test("first connection needs identical content; divergent content conflicts", () => {
  const local = mapNowTree([node("t", "Topic", 1, [], "same")]);
  const same = vault("t", "topic", "Topic/_index.md", "same");
  same.title = "Topic";
  const initial = buildSyncPlan({ localNodes: local, vaultEntries: [same], baselines: {}, direction: "both" });
  assert.equal(initial.items[0].classification, "unlinkedMatch");
  assert.equal(initial.items[0].defaultAction, "skip");
  same.body = "different";
  const divergent = buildSyncPlan({ localNodes: local, vaultEntries: [same], baselines: {}, direction: "both" });
  assert.equal(divergent.items[0].classification, "conflict");
});

test("last successful hashes identify one-sided changes, simultaneous changes and missing files", () => {
  const local = mapNowTree([node("t", "Topic", 1, [], "local-new")]);
  const oldHash = contentHash({ title: "Topic", body: "old", tags: [] });
  const base = { t: { relativePath: "Topic/_index.md", localHash: oldHash, vaultHash: oldHash } };
  const remote = vault("t", "topic", "Topic/_index.md", "old");
  remote.title = "Topic";
  assert.equal(buildSyncPlan({ localNodes: local, vaultEntries: [remote], baselines: base, direction: "both" }).items[0].classification, "localChanged");
  remote.body = "remote-new";
  assert.equal(buildSyncPlan({ localNodes: local, vaultEntries: [remote], baselines: base, direction: "both" }).items[0].classification, "conflict");
  assert.equal(buildSyncPlan({ localNodes: local, vaultEntries: [], baselines: base, direction: "both" }).items[0].classification, "missingVault");
});

test("path moves are visible and a changed path on both sides conflicts", () => {
  const local = mapNowTree([node("t", "Renamed", 1)]);
  const oldHash = contentHash({ title: "Renamed", body: "", tags: [] });
  const base = { t: { relativePath: "Old/_index.md", localHash: oldHash, vaultHash: oldHash } };
  const original = vault("t", "topic", "Old/_index.md");
  original.title = "Renamed";
  const oneMove = buildSyncPlan({ localNodes: local, vaultEntries: [original], baselines: base, direction: "both" });
  assert.equal(oneMove.items[0].classification, "localChanged");
  assert.deepEqual(oneMove.items[0].paths, { baseline: "Old/_index.md", local: "Renamed/_index.md", vault: "Old/_index.md" });
  original.relativePath = "Another/_index.md";
  assert.equal(buildSyncPlan({ localNodes: local, vaultEntries: [original], baselines: base, direction: "both" }).items[0].classification, "conflict");
});

test("an intentionally linked root import retains distinct local and Vault baseline paths", () => {
  const local = mapNowTree([node("t", "Topic", 1, [node("c", "Category", 2, [node("n", "loose", 3, [], "text")])])]);
  const remote = vault("n", "note", "loose.md", "text");
  remote.title = "loose";
  const hash = contentHash(remote);
  const baselines = { n: { localPath: "Topic/Category/loose.md", vaultPath: "loose.md", localHash: hash, vaultHash: hash } };
  const plan = buildSyncPlan({ localNodes: local, vaultEntries: [remote], baselines, direction: "both" });
  assert.equal(plan.items.find((item) => item.id === "n").classification, "unchanged");
});

test("encrypted content stays excluded from either sync direction", () => {
  const local = mapNowTree([node("t", "Topic", 1, [], "NOW_ENCRYPTED_V1:secret")]);
  assert.equal(buildSyncPlan({ localNodes: local, vaultEntries: [], baselines: {}, direction: "toVault" }).items[0].classification, "skipped");
  const remote = vault("r", "note", "Topic/Category/secret.md", "NOW_ENCRYPTED_V1:secret");
  assert.equal(buildSyncPlan({ localNodes: [], vaultEntries: [remote], baselines: {}, direction: "fromVault" }).items[0].classification, "skipped");
});
