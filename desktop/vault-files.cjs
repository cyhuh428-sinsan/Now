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

async function entryState(rootReal, segments, createParents = false, createdDirs = []) {
  let current = rootReal;
  for (const [index, part] of segments.entries()) {
    const last = index === segments.length - 1;
    let names;
    try {
      names = await fs.readdir(current);
    } catch (error) {
      if (error.code !== "ENOENT" || !createParents) throw error;
      await fs.mkdir(current);
      createdDirs.push(current);
      names = [];
    }
    const matches = names.filter((name) => name.normalize("NFC").toLowerCase() === part.normalize("NFC").toLowerCase());
    if (matches.length > 1 || matches.length === 1 && matches[0] !== part) throw new Error("Vault filename collision");
    current = path.join(current, part);
    if (!within(rootReal, current)) throw new Error("Vault path escapes root");
    if (!matches.length) {
      if (!last && createParents) {
        await fs.mkdir(current);
        createdDirs.push(current);
      }
      continue;
    }
    const stat = await fs.lstat(current);
    if (stat.isSymbolicLink()) throw new Error("Vault symbolic link is blocked");
    if (last && !stat.isFile() || !last && !stat.isDirectory()) throw new Error("Invalid Vault path type");
  }
  return current;
}

async function readCheckedFile(rootReal, target, segments) {
  await entryState(rootReal, segments);
  const real = await fs.realpath(target);
  if (!within(rootReal, real)) throw new Error("Vault path escapes root");
  const handle = await fs.open(target, "r");
  try {
    const opened = await handle.stat();
    const currentReal = await fs.realpath(target);
    const current = await fs.stat(target);
    if (!within(rootReal, currentReal) || opened.dev !== current.dev || opened.ino !== current.ino) {
      throw new Error("Vault file changed while opening");
    }
    const bytes = await handle.readFile();
    const afterReal = await fs.realpath(target);
    if (!within(rootReal, afterReal)) throw new Error("Vault path escapes root");
    return bytes;
  } finally {
    await handle.close();
  }
}

async function readExisting(rootReal, target, segments) {
  try {
    return await readCheckedFile(rootReal, target, segments);
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

async function scanVault(root, options = {}) {
  const rootReal = await fs.realpath(root);
  const entries = [];
  const walk = async (dir, parts) => {
    if (!within(rootReal, await fs.realpath(dir))) throw new Error("Vault directory escapes root");
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
        const childNames = await fs.readdir(absolute);
        if (!childNames.some((child) => child.toLowerCase() === "_index.md")) {
          entries.push({
            relativePath: [...parts, name, "_index.md"].join("/"), fileHash: null,
            id: null, kind: null, title: name, tags: [], body: "", extraFrontmatter: {},
            managed: false, folderCandidate: true,
          });
        }
        await walk(absolute, [...parts, name]);
      } else if (stat.isFile() && lower.endsWith(".md")) {
        const relativePath = [...parts, name].join("/");
        if (stat.size > MAX_MARKDOWN_BYTES) {
          entries.push({ relativePath, id: null, fileHash: null, body: "", managed: false, excluded: "tooLarge" });
          continue;
        }
        if (typeof options.beforeRead === "function") await options.beforeRead(relativePath);
        const buffer = await readCheckedFile(rootReal, absolute, [...parts, name]);
        let source;
        let managed;
        try {
          source = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
          managed = parseManagedMarkdown(source);
        } catch {
          entries.push({ relativePath, id: null, fileHash: fileHash(buffer), body: "", managed: false, excluded: "invalidMarkdown" });
          continue;
        }
        entries.push({
          relativePath, fileHash: fileHash(buffer),
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
  const createdDirs = [];
  const target = await entryState(rootReal, segments, true, createdDirs);
  const current = await readExisting(rootReal, target, segments);
  if (current ? fileHash(current) !== expectedHash : expectedHash !== null) throw new Error("Vault file changed since preview");
  const backupPath = await prepareBackup(rootReal, options.backupDir, relativePath, current);
  const temp = path.join(path.dirname(target), `.${randomUUID()}.tmp`);
  try {
    const tempHandle = await fs.open(temp, "wx");
    try {
      if (!within(rootReal, await fs.realpath(temp))) throw new Error("Vault temporary file escapes root");
      await tempHandle.writeFile(content);
    } finally {
      await tempHandle.close();
    }
    if (typeof options.beforeRename === "function") await options.beforeRename();
    const latest = await readExisting(rootReal, await entryState(rootReal, segments), segments);
    if (latest ? fileHash(latest) !== expectedHash : expectedHash !== null) throw new Error("Vault file changed since preview");
    await fs.rename(temp, target);
  } finally {
    await fs.rm(temp, { force: true });
  }
  return { relativePath, fileHash: fileHash(Buffer.from(content)), backupPath, createdDirs };
}

async function moveVaultEntry(root, from, to, expectedHash, options = {}) {
  const fromSegments = checkedSegments(from);
  const toSegments = checkedSegments(to);
  if (from.toLowerCase() === to.toLowerCase()) throw new Error("Vault move target collision");
  const rootReal = await fs.realpath(root);
  const source = await entryState(rootReal, fromSegments);
  const createdDirs = [];
  const target = await entryState(rootReal, toSegments, true, createdDirs);
  const current = await readExisting(rootReal, source, fromSegments);
  if (!current || fileHash(current) !== expectedHash) throw new Error("Vault file changed since preview");
  if (await readExisting(rootReal, target, toSegments)) throw new Error("Vault move target already exists");
  const backupPath = await prepareBackup(rootReal, options.backupDir, from, current);
  if (fileHash(await readCheckedFile(rootReal, await entryState(rootReal, fromSegments), fromSegments)) !== expectedHash) throw new Error("Vault file changed since preview");
  await entryState(rootReal, toSegments);
  await fs.rename(source, target);
  return { relativePath: to, fileHash: expectedHash, backupPath, createdDirs };
}

async function removeCreatedDirs(createdDirs) {
  for (const dir of [...createdDirs].reverse()) {
    try {
      await fs.rmdir(dir);
    } catch (error) {
      if (!["ENOTEMPTY", "ENOENT"].includes(error.code)) throw error;
    }
  }
}

async function removeVaultEntry(root, relativePath, expectedHash) {
  const rootReal = await fs.realpath(root);
  const target = await entryState(rootReal, checkedSegments(relativePath));
  const current = await readExisting(rootReal, target, checkedSegments(relativePath));
  if (!current || fileHash(current) !== expectedHash) throw new Error("Vault file changed before rollback");
  await fs.unlink(target);
}

module.exports = { fileHash, scanVault, writeVaultEntry, moveVaultEntry, removeVaultEntry, removeCreatedDirs };
