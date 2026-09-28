const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { scanVault, writeVaultEntry, moveVaultEntry } = require("../vault-files.cjs");

const QA_ROOT = "D:\\tmp\\nownote-239-vault-qa";
const hash = (text) => createHash("sha256").update(text).digest("hex");

async function fixture(t) {
  await fs.mkdir(QA_ROOT, { recursive: true });
  const dir = await fs.mkdtemp(path.join(QA_ROOT, "vault-files-"));
  const root = path.join(dir, "vault");
  const backupDir = path.join(dir, "backups");
  await fs.mkdir(root);
  t.after(async () => {
    if (path.resolve(dir).startsWith(`${path.resolve(QA_ROOT)}${path.sep}`)) {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
  return { dir, root, backupDir };
}

test("scan reads only Markdown and never traverses Obsidian config or attachments", async (t) => {
  const { root } = await fixture(t);
  await fs.mkdir(path.join(root, "Topic", "Category"), { recursive: true });
  await fs.mkdir(path.join(root, ".obsidian"));
  await fs.writeFile(path.join(root, "Topic", "Category", "note.md"), "# 한글\n");
  await fs.writeFile(path.join(root, ".obsidian", "secret.md"), "private");
  await fs.writeFile(path.join(root, "image.png"), "binary");
  const entries = await scanVault(root);
  assert.deepEqual(entries.filter((entry) => entry.fileHash).map((entry) => entry.relativePath), ["Topic/Category/note.md"]);
  assert.equal(entries.find((entry) => entry.relativePath.endsWith("note.md")).body, "# 한글\n");
  assert.ok(entries.some((entry) => entry.relativePath === "Topic/_index.md" && entry.folderCandidate));
  assert.ok(entries.some((entry) => entry.relativePath === "Topic/Category/_index.md" && entry.folderCandidate));
});

test("an empty folder is an unlinked topic candidate, not silently discarded", async (t) => {
  const { root } = await fixture(t);
  await fs.mkdir(path.join(root, "Empty Topic"));
  const entries = await scanVault(root);
  assert.deepEqual(entries.map((entry) => entry.relativePath), ["Empty Topic/_index.md"]);
  assert.equal(entries[0].body, "");
  assert.equal(entries[0].folderCandidate, true);
});

test("invalid or oversized Markdown is excluded without hiding other valid notes", async (t) => {
  const { root } = await fixture(t);
  await fs.writeFile(path.join(root, "good.md"), "good");
  await fs.writeFile(path.join(root, "bad.md"), "---\nnownote_id: x\n---\nbroken");
  await fs.writeFile(path.join(root, "huge.md"), Buffer.alloc(5 * 1024 * 1024 + 1, 65));
  const entries = await scanVault(root);
  assert.equal(entries.find((entry) => entry.relativePath === "good.md").body, "good");
  assert.equal(entries.find((entry) => entry.relativePath === "bad.md").excluded, "invalidMarkdown");
  assert.equal(entries.find((entry) => entry.relativePath === "huge.md").excluded, "tooLarge");
});

test("traversal, absolute paths, hidden directories and symlink escape are rejected", async (t) => {
  const { dir, root, backupDir } = await fixture(t);
  for (const target of ["../outside.md", "C:/outside.md", ".obsidian/secret.md", "Topic/../bad.md"]) {
    await assert.rejects(writeVaultEntry(root, target, "bad", null, { backupDir }), /path|Vault|relative|blocked/i);
  }
  const outside = path.join(dir, "outside");
  await fs.mkdir(outside);
  try {
    await fs.symlink(outside, path.join(root, "link"), "junction");
  } catch (error) {
    if (["EPERM", "EACCES"].includes(error.code)) return t.diagnostic("symlink creation unavailable on this host");
    throw error;
  }
  await assert.rejects(scanVault(root), /symbolic|symlink/i);
  await assert.rejects(writeVaultEntry(root, "link/out.md", "bad", null, { backupDir }), /symbolic|symlink/i);
});

test("a folder switched to a junction after listing is not read outside the Vault", async (t) => {
  const { dir, root } = await fixture(t);
  const inside = path.join(root, "Topic");
  const outside = path.join(dir, "outside");
  await fs.mkdir(inside);
  await fs.mkdir(outside);
  await fs.writeFile(path.join(inside, "memo.md"), "inside");
  await fs.writeFile(path.join(outside, "memo.md"), "outside secret");
  try {
    const entries = await scanVault(root, { beforeRead: async (relativePath) => {
      if (relativePath !== "Topic/memo.md") return;
      await fs.rename(inside, path.join(root, "Topic-old"));
      await fs.symlink(outside, inside, "junction");
    } });
    assert.fail(`Junction swap was accepted: ${JSON.stringify(entries)}`);
  } catch (error) {
    if (["EPERM", "EACCES"].includes(error.code)) return t.diagnostic("junction creation unavailable on this host");
    assert.match(error.message, /Vault|symbolic|symlink|outside|escape/i);
  }
});

test("compare-and-swap write backs up old bytes and refuses stale previews", async (t) => {
  const { root, backupDir } = await fixture(t);
  const file = path.join(root, "memo.md");
  await fs.writeFile(file, "old");
  await assert.rejects(writeVaultEntry(root, "memo.md", "new", hash("other"), { backupDir }), /changed|hash/i);
  assert.equal(await fs.readFile(file, "utf8"), "old");
  const result = await writeVaultEntry(root, "memo.md", "new", hash("old"), { backupDir });
  assert.equal(await fs.readFile(file, "utf8"), "new");
  assert.equal(await fs.readFile(result.backupPath, "utf8"), "old");
  await assert.rejects(writeVaultEntry(root, "memo.md", "again", hash("old"), { backupDir }), /changed|hash/i);
});

test("new writes and moves never overwrite a case-insensitive conflicting name", async (t) => {
  const { root, backupDir } = await fixture(t);
  await fs.writeFile(path.join(root, "Readme.md"), "existing");
  await assert.rejects(writeVaultEntry(root, "README.md", "other", null, { backupDir }), /exists|collision/i);
  await writeVaultEntry(root, "new.md", "new", null, { backupDir });
  await assert.rejects(moveVaultEntry(root, "new.md", "README.md", hash("new"), { backupDir }), /exists|collision/i);
  const moved = await moveVaultEntry(root, "new.md", "moved.md", hash("new"), { backupDir });
  assert.equal(await fs.readFile(path.join(root, "moved.md"), "utf8"), "new");
  assert.equal(await fs.readFile(moved.backupPath, "utf8"), "new");
});

test("a failed write leaves the existing file intact", async (t) => {
  const { root, backupDir } = await fixture(t);
  const file = path.join(root, "stable.md");
  await fs.writeFile(file, "stable");
  await assert.rejects(writeVaultEntry(root, "stable.md", "change", hash("stable"), { backupDir, beforeRename: async () => { throw new Error("injected write failure"); } }), /injected write failure/);
  assert.equal(await fs.readFile(file, "utf8"), "stable");
});
