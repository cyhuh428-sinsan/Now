const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { TextDecoder } = require("node:util");
const { parseManagedMarkdown } = require("./vault-markdown.cjs");

const MAX_MARKDOWN_BYTES = 5 * 1024 * 1024;
const EXCLUDED_DIRS = new Set([".obsidian", ".trash", "trash", "node_modules"]);
const RESERVED = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i;

function fileHash(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function checkedSegments(relativePath) {
  if (typeof relativePath !== "string" || !relativePath || path.isAbsolute(relativePath) || /^[a-z]:/i.test(relativePath)) {
    throw new Error("Vault path must be relative");
  }
  const segments = relativePath.replace(/\\/g, "/").split("/");
  if (segments.some((part) => !part || part === "." || part === ".." || part.startsWith(".") && part !== "_index.md" || /[<>:"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part) || RESERVED.test(part))) {
    throw new Error("Blocked Vault path component");
  }
  if (!segments.at(-1).toLowerCase().endsWith(".md")) throw new Error("Vault path is not Markdown");
  return segments;
}

function within(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function entryState(rootReal, segments, createParents = false) {
  let current = rootReal;
  for (const [index, part] of segments.entries()) {
    const last = index === segments.length - 1;
    let names;
    try {
      names = await fs.readdir(current);
    } catch (error) {
      if (error.code !== "ENOENT" || !createParents) throw error;
      await fs.mkdir(current);
      names = [];
    }
    const matches = names.filter((name) => name.normalize("NFC").toLowerCase() === part.normalize("NFC").toLowerCase());
    if (matches.length > 1 || matches.length === 1 && matches[0] !== part) throw new Error("Vault filename collision");
    current = path.join(current, part);
    if (!within(rootReal, current)) throw new Error("Vault path escapes root");
    if (!matches.length) {
      if (!last && createParents) await fs.mkdir(current);
      continue;
    }
    const stat = await fs.lstat(current);
    if (stat.isSymbolicLink()) throw new Error("Vault symbolic link is blocked");
    if (last && !stat.isFile() || !last && !stat.isDirectory()) throw new Error("Invalid Vault path type");
  }
  return current;
}

async function readExisting(target) {
  try {
    return await fs.readFile(target);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function prepareBackup(rootReal, backupDir, relativePath, current) {
  if (!current) return null;
  if (typeof backupDir !== "string" || !backupDir) throw new Error("Vault backup directory is required");
  const backupReal = path.resolve(backupDir);
  if (within(rootReal, backupReal)) throw new Error("Vault backup directory must be outside Vault");
  await fs.mkdir(backupReal, { recursive: true });
  const backupPath = path.join(backupReal, `${Date.now()}-${randomUUID()}-${path.basename(relativePath)}`);
  await fs.writeFile(backupPath, current, { flag: "wx" });
  return backupPath;
}

async function scanVault(root) {
  const rootReal = await fs.realpath(root);
  const entries = [];
  const walk = async (dir, parts) => {
    const names = await fs.readdir(dir);
    const seen = new Set();
    for (const name of names.sort()) {
      const lower = name.normalize("NFC").toLowerCase();
      if (seen.has(lower)) throw new Error("Vault filename collision");
      seen.add(lower);
      if (name.startsWith(".") || EXCLUDED_DIRS.has(lower)) continue;
      const absolute = path.join(dir, name);
      if (!within(rootReal, absolute)) throw new Error("Vault path escapes root");
      const stat = await fs.lstat(absolute);
      if (stat.isSymbolicLink()) throw new Error("Vault symbolic link is blocked");
      if (stat.isDirectory()) {
        await walk(absolute, [...parts, name]);
      } else if (stat.isFile() && lower.endsWith(".md")) {
        if (stat.size > MAX_MARKDOWN_BYTES) throw new Error("Vault Markdown file exceeds size limit");
        const buffer = await fs.readFile(absolute);
        const source = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
        const managed = parseManagedMarkdown(source);
        entries.push({
          relativePath: [...parts, name].join("/"), fileHash: fileHash(buffer),
          id: managed?.metadata.id || null, kind: managed?.metadata.kind || null,
          title: managed?.metadata.title || null, tags: managed?.metadata.tags || [],
          body: managed?.body ?? source, extraFrontmatter: managed?.extraFrontmatter || {}, managed: Boolean(managed),
        });
      }
    }
  };
  await walk(rootReal, []);
  return entries;
}

async function writeVaultEntry(root, relativePath, content, expectedHash, options = {}) {
  const segments = checkedSegments(relativePath);
  if (typeof content !== "string") throw new Error("Invalid Vault Markdown content");
  const rootReal = await fs.realpath(root);
  const target = await entryState(rootReal, segments, true);
  const current = await readExisting(target);
  if (current ? fileHash(current) !== expectedHash : expectedHash !== null) throw new Error("Vault file changed since preview");
  const backupPath = await prepareBackup(rootReal, options.backupDir, relativePath, current);
  const temp = path.join(path.dirname(target), `.${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temp, content, { flag: "wx" });
    if (typeof options.beforeRename === "function") await options.beforeRename();
    const latest = await readExisting(await entryState(rootReal, segments));
    if (latest ? fileHash(latest) !== expectedHash : expectedHash !== null) throw new Error("Vault file changed since preview");
    await fs.rename(temp, target);
  } finally {
    await fs.rm(temp, { force: true });
  }
  return { relativePath, fileHash: fileHash(Buffer.from(content)), backupPath };
}

async function moveVaultEntry(root, from, to, expectedHash, options = {}) {
  const fromSegments = checkedSegments(from);
  const toSegments = checkedSegments(to);
  if (from.toLowerCase() === to.toLowerCase()) throw new Error("Vault move target collision");
  const rootReal = await fs.realpath(root);
  const source = await entryState(rootReal, fromSegments);
  const target = await entryState(rootReal, toSegments, true);
  const current = await readExisting(source);
  if (!current || fileHash(current) !== expectedHash) throw new Error("Vault file changed since preview");
  if (await readExisting(target)) throw new Error("Vault move target already exists");
  const backupPath = await prepareBackup(rootReal, options.backupDir, from, current);
  if (fileHash(await fs.readFile(await entryState(rootReal, fromSegments))) !== expectedHash) throw new Error("Vault file changed since preview");
  await entryState(rootReal, toSegments);
  await fs.rename(source, target);
  return { relativePath: to, fileHash: expectedHash, backupPath };
}

module.exports = { fileHash, scanVault, writeVaultEntry, moveVaultEntry };
