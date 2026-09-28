import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createVaultService } = require("../vault-service.cjs");
const { renderManagedMarkdown } = require("../vault-markdown.cjs");

const QA_ROOT = "D:\\tmp\\nownote-239-vault-qa";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function main() {
  await fs.mkdir(QA_ROOT, { recursive: true });
  const dir = await fs.mkdtemp(path.join(QA_ROOT, "vault-roundtrip-"));
  const root = path.join(dir, "vault");
  const storePath = path.join(dir, "userData", "nownote-desktop-store.json");
  const backupDir = path.join(dir, "backups");
  await fs.mkdir(root);
  await fs.mkdir(path.dirname(storePath));
  const tree = [{
    id: "topic", title: "프로젝트", content: "주제 본문", level: 1, status: "active", tags: [], children: [{
      id: "category", title: "기록", content: "분류 본문", parentId: "topic", level: 2, status: "active", tags: [], children: [{
        id: "note", title: "첫 메모", content: "한글 본문\n[[링크]]", parentId: "category", level: 3, status: "active", tags: [], children: [],
      }],
    }],
  }];
  await fs.writeFile(storePath, JSON.stringify({ version: 1, updatedAt: null, values: {
    "nownote.web.v1": { tree }, "nownote.vault.v1": { path: root, baselines: {}, lastSuccessAt: null },
  } }));
  try {
    const service = createVaultService({ storePath, backupDir });
    const before = digest(await fs.readFile(storePath));
    const plan = await service.previewVault({ direction: "both" });
    assert.equal(digest(await fs.readFile(storePath)), before, "Preview changed the desktop store");
    assert.deepEqual(await fs.readdir(root), [], "Preview changed the Vault");
    const applied = await service.applyVault({ planId: plan.planId, selections: [
      { itemId: "topic", action: "toVault" },
      { itemId: "category", action: "toVault" },
      { itemId: "note", action: "toVault" },
    ] });
    assert.deepEqual(applied.failed, [], `Hierarchy export failed: ${JSON.stringify(applied.failed)}`);
    assert.equal(applied.applied.length, 3);
    const topicPath = path.join(root, "프로젝트", "_index.md");
    const categoryPath = path.join(root, "프로젝트", "기록", "_index.md");
    const notePath = path.join(root, "프로젝트", "기록", "첫 메모.md");
    assert.match(await fs.readFile(topicPath, "utf8"), /주제 본문/);
    assert.match(await fs.readFile(categoryPath, "utf8"), /분류 본문/);
    assert.match(await fs.readFile(notePath, "utf8"), /\[\[링크\]\]/);

    const restarted = createVaultService({ storePath, backupDir });
    assert.equal(restarted.vaultStatus().path, root);
    const steady = await restarted.previewVault({ direction: "both" });
    assert.deepEqual(steady.items.filter((item) => item.id).map((item) => item.classification), ["unchanged", "unchanged", "unchanged"]);

    await fs.writeFile(categoryPath, renderManagedMarkdown({ id: "category", kind: "category", title: "기록", body: "Vault에서 변경", tags: [] }));
    const inbound = await restarted.previewVault({ direction: "fromVault" });
    assert.equal(inbound.items.find((item) => item.id === "category").classification, "vaultChanged");
    const imported = await restarted.applyVault({ planId: inbound.planId, selections: [{ itemId: "category", action: "toNowNote" }] });
    assert.equal(imported.applied.length, 1);
    assert.equal(JSON.parse(await fs.readFile(storePath, "utf8")).values["nownote.web.v1"].tree[0].children[0].content, "Vault에서 변경");
    assert.ok(imported.applied[0].backupPath);

    const changedStore = JSON.parse(await fs.readFile(storePath, "utf8"));
    changedStore.values["nownote.web.v1"].tree[0].children[0].children[0].content = "NowNote 변경";
    await fs.writeFile(storePath, JSON.stringify(changedStore));
    await fs.writeFile(notePath, renderManagedMarkdown({ id: "note", kind: "note", title: "첫 메모", body: "Vault 변경", tags: [] }));
    const conflict = await restarted.previewVault({ direction: "both" });
    assert.equal(conflict.items.find((item) => item.id === "note").classification, "conflict");
    assert.equal((await restarted.applyVault({ planId: conflict.planId, selections: [{ itemId: "note", action: "toVault" }] })).applied.length, 1);
    assert.match(await fs.readFile(notePath, "utf8"), /NowNote 변경/);

    const unmanagedDir = path.join(root, "기존 폴더");
    await fs.mkdir(unmanagedDir);
    await fs.writeFile(path.join(unmanagedDir, "_index.md"), "기존 본문");
    const existingIndex = await restarted.previewVault({ direction: "fromVault" });
    const candidate = existingIndex.items.find((item) => item.paths.vault === "기존 폴더/_index.md");
    assert.equal(candidate.classification, "unlinked");
    assert.equal((await restarted.applyVault({ planId: existingIndex.planId, selections: [{ itemId: candidate.itemId, action: "toNowNote" }] })).applied.length, 1);
    assert.match(await fs.readFile(path.join(unmanagedDir, "_index.md"), "utf8"), /기존 본문/);

    await fs.unlink(notePath);
    const missing = await restarted.previewVault({ direction: "both" });
    assert.equal(missing.items.find((item) => item.id === "note").classification, "missingVault");
    assert.equal((await fs.readdir(path.dirname(notePath))).includes("첫 메모.md"), false, "Preview recreated a missing note");

    const backups = await fs.readdir(backupDir);
    assert.ok(backups.some((name) => name.endsWith("첫 메모.md")), "Vault backup missing");
    const recoverable = backups.find((name) => name.endsWith("첫 메모.md"));
    const savedBytes = await fs.readFile(path.join(backupDir, recoverable));
    await fs.writeFile(notePath, savedBytes);
    assert.equal(digest(await fs.readFile(notePath)), digest(savedBytes), "Vault backup did not restore exact bytes");
    console.log("NowNote Vault round-trip check passed: 3-level export, restart, import, conflict, unmarked index, missing file, backup restore");
  } finally {
    if (path.resolve(dir).startsWith(`${path.resolve(QA_ROOT)}${path.sep}`)) {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(`NowNote Vault round-trip check failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
