const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { mapNowTree, buildSyncPlan, contentHash } = require("./vault-plan.cjs");
const { renderManagedMarkdown } = require("./vault-markdown.cjs");
const { scanVault, writeVaultEntry, moveVaultEntry, removeVaultEntry, removeCreatedDirs } = require("./vault-files.cjs");
const { readStoreFile, updateStoreFile } = require("./store-file.cjs");

const VAULT_KEY = "nownote.vault.v1";
const DATA_KEY = "nownote.web.v1";
const ACTIONS = new Set(["toVault", "toNowNote", "unlink", "skip"]);

function findNode(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findNode(node.children || [], id);
    if (child) return child;
  }
  return null;
}

function vaultState(store) {
  const value = store.values[VAULT_KEY];
  return value && typeof value === "object" ? value : { path: null, baselines: {}, lastSuccessAt: null, lastResult: null };
}

function backupStore(storePath, backupDir) {
  if (!fs.existsSync(storePath)) return null;
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `${Date.now()}-${randomUUID()}-nownote-desktop-store.json`);
  fs.copyFileSync(storePath, backupPath, fs.constants.COPYFILE_EXCL);
  return backupPath;
}

async function restoreVaultWrite(root, relativePath, written, backupDir) {
  if (written.backupPath) {
    const original = await fsp.readFile(written.backupPath, "utf8");
    await writeVaultEntry(root, relativePath, original, written.fileHash, { backupDir });
  } else {
    await removeVaultEntry(root, relativePath, written.fileHash);
  }
  await removeCreatedDirs(written.createdDirs || []);
}

function createVaultService({ storePath, backupDir, beforeStoreCommit }) {
  if (!path.isAbsolute(storePath) || !path.isAbsolute(backupDir)) throw new Error("Vault service requires absolute data paths");
  let pending = null;

  function vaultStatus() {
    const state = vaultState(readStoreFile(storePath).store);
    return { path: state.path || null, lastSuccessAt: state.lastSuccessAt || null, lastResult: state.lastResult || null };
  }

  async function setVaultPath(candidate) {
    const real = await fsp.realpath(candidate);
    if (!(await fsp.stat(real)).isDirectory()) throw new Error("Vault is not a directory");
    updateStoreFile(storePath, (store) => {
      const old = vaultState(store);
      store.values[VAULT_KEY] = old.path === real ? old : { path: real, baselines: {}, lastSuccessAt: null, lastResult: null };
      return store;
    });
    pending = null;
    return vaultStatus();
  }

  async function previewVault({ direction }) {
    const { store, hash } = readStoreFile(storePath);
    const state = vaultState(store);
    if (!state.path) throw new Error("Vault folder has not been selected");
    const tree = store.values[DATA_KEY]?.tree;
    if (!Array.isArray(tree)) throw new Error("NowNote tree is unavailable");
    const localNodes = mapNowTree(tree);
    const vaultEntries = await scanVault(state.path);
    const plan = buildSyncPlan({ localNodes, vaultEntries, baselines: state.baselines || {}, direction });
    const planId = randomUUID();
    pending = { planId, direction, storeHash: hash, vaultPath: state.path, items: new Map(plan.items.map((item) => [item.itemId, item])), applied: new Set() };
    return { planId, ...plan };
  }

  async function applyVault({ planId, selections }) {
    if (!pending || pending.planId !== planId || !Array.isArray(selections)) throw new Error("Vault comparison expired; compare again");
    const result = { applied: [], skipped: [], failed: [], lastSuccessAt: null };
    const selected = new Set();
    for (const selection of selections) {
      const itemId = selection?.itemId;
      if (typeof itemId !== "string" || selected.has(itemId) || pending.applied.has(itemId) || !pending.items.has(itemId) || !ACTIONS.has(selection.action)) {
        throw new Error("Invalid Vault selection");
      }
      selected.add(itemId);
      if (selection.action === "skip") {
        result.skipped.push({ itemId });
        continue;
      }
      const item = pending.items.get(itemId);
      const undoVault = [];
      try {
        const current = readStoreFile(storePath);
        if (current.hash !== pending.storeHash || vaultState(current.store).path !== pending.vaultPath) {
          throw new Error("NowNote store changed since preview");
        }
        if (selection.action === "toVault" && pending.direction === "fromVault" || selection.action === "toNowNote" && pending.direction === "toVault") {
          throw new Error("Vault action is outside the selected direction");
        }
        const currentVault = await scanVault(pending.vaultPath);
        const source = item.vault && currentVault.find((entry) => entry.relativePath === item.vault.relativePath);
        if (item.vault && (!source || source.fileHash !== item.vault.fileHash)) throw new Error("Vault file changed since preview");
        if (!item.vault && item.local && currentVault.some((entry) => entry.relativePath.toLowerCase() === item.local.relativePath.toLowerCase())) {
          throw new Error("Vault target path changed since preview");
        }
        const nowTree = current.store.values[DATA_KEY]?.tree;
        if (!Array.isArray(nowTree)) throw new Error("NowNote tree is unavailable");
        const local = item.local && mapNowTree(nowTree).find((entry) => entry.id === item.local.id);
        if (item.local && (!local || contentHash(local) !== contentHash(item.local) || local.relativePath !== item.local.relativePath)) {
          throw new Error("NowNote note changed since preview");
        }
        if (item.classification === "skipped" || item.classification === "depthExceeded" && selection.action !== "toNowNote" || item.reason === "duplicateIdentityOrPath" || item.reason === "targetPathOccupied" || item.reason === "kindMismatch") {
          throw new Error("Vault item is blocked by a conflict or exclusion");
        }
        let entryId = item.id;
        let relativePath = item.vault?.relativePath || item.local?.relativePath;
        let nextTree = null;
        let vaultWrite = null;
        if (selection.action === "toVault") {
          if (!local) throw new Error("NowNote source is missing");
          if (item.vault && !item.vault.managed) throw new Error("Unmanaged Vault file cannot be overwritten");
          const markdown = renderManagedMarkdown({ id: local.id, kind: local.kind, title: local.title, body: local.body, tags: local.tags, extraFrontmatter: item.vault?.extraFrontmatter || {} });
          relativePath = local.relativePath;
          if (item.vault && item.vault.relativePath !== relativePath) {
            const moved = await moveVaultEntry(pending.vaultPath, item.vault.relativePath, relativePath, item.vault.fileHash, { backupDir });
            undoVault.push(async () => {
              await moveVaultEntry(pending.vaultPath, relativePath, item.vault.relativePath, item.vault.fileHash, { backupDir });
              await removeCreatedDirs(moved.createdDirs);
            });
          }
          vaultWrite = await writeVaultEntry(pending.vaultPath, relativePath, markdown, item.vault?.fileHash || null, { backupDir });
          undoVault.push(() => restoreVaultWrite(pending.vaultPath, relativePath, vaultWrite, backupDir));
        } else if (selection.action === "toNowNote") {
          if (!source) throw new Error("Vault source is missing");
          nextTree = structuredClone(nowTree);
          if (local) {
            const node = findNode(nextTree, local.id);
            if (!node) throw new Error("NowNote note is missing");
            node.title = source.title || node.title;
            node.content = source.body;
            node.tags = source.tags;
            node.updatedAt = new Date().toISOString();
          } else {
            const isIndex = source.relativePath.endsWith("/_index.md");
            const segments = source.relativePath.split("/");
            const level = isIndex ? segments.length - 1 : 3;
            if (isIndex && level > 2) throw new Error("Vault folder exceeds NowNote hierarchy");
            const parent = selection.targetParentId ? findNode(nextTree, selection.targetParentId) : null;
            if (level > 1 && (!parent || parent.level !== level - 1)) {
              throw new Error(level === 2 ? "A target topic is required for this Vault category" : "A target category is required for this Vault note");
            }
            if (level === 1 && parent) throw new Error("Vault topic cannot have a parent");
            entryId = source.id || randomUUID();
            const title = source.title || (isIndex ? segments.at(-2) : path.basename(source.relativePath, ".md"));
            const created = { id: entryId, title, content: source.body, tags: source.tags, parentId: parent?.id || null, level, children: [], status: "active", syncState: "pending", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            if (parent) {
              parent.children ||= [];
              parent.children.push(created);
            } else {
              nextTree.push(created);
            }
            if (!source.managed) {
              const kind = ["topic", "category", "note"][level - 1];
              const markdown = renderManagedMarkdown({ id: entryId, kind, title, body: source.body, tags: source.tags, extraFrontmatter: source.extraFrontmatter });
              vaultWrite = await writeVaultEntry(pending.vaultPath, source.relativePath, markdown, source.fileHash, { backupDir });
              undoVault.push(() => restoreVaultWrite(pending.vaultPath, source.relativePath, vaultWrite, backupDir));
            }
          }
        } else if (selection.action === "unlink") {
          if (!item.id || !vaultState(current.store).baselines?.[item.id]) throw new Error("Vault link does not exist");
        }
        if (typeof beforeStoreCommit === "function") await beforeStoreCommit(itemId);
        const storeBackupPath = backupStore(storePath, backupDir);
        const saved = updateStoreFile(storePath, (store) => {
          const state = vaultState(store);
          state.baselines ||= {};
          if (selection.action === "unlink") {
            delete state.baselines[entryId];
          } else {
            if (nextTree) store.values[DATA_KEY].tree = nextTree;
            const currentLocal = mapNowTree(store.values[DATA_KEY].tree).find((entry) => entry.id === entryId);
            state.baselines[entryId] = {
              relativePath, localPath: currentLocal.relativePath, vaultPath: relativePath,
              localHash: contentHash(currentLocal), vaultHash: contentHash(currentLocal),
            };
            if (selection.action === "toVault") state.baselines[entryId].vaultHash = contentHash(local);
            state.lastSuccessAt = new Date().toISOString();
          }
          store.values[VAULT_KEY] = state;
          return store;
        }, pending.storeHash);
        pending.storeHash = saved.hash;
        pending.applied.add(itemId);
        result.applied.push({ itemId, id: entryId, relativePath, backupPath: vaultWrite?.backupPath || storeBackupPath, preservedPath: vaultWrite?.preservedPath || null, tempCleanupPath: vaultWrite?.tempCleanupPath || null });
      } catch (error) {
        const rollbackErrors = [];
        for (const undo of undoVault.reverse()) {
          try { await undo(); } catch (rollbackError) { rollbackErrors.push(rollbackError.message); }
        }
        result.failed.push({ itemId, message: rollbackErrors.length ? `${error.message}; rollback incomplete: ${rollbackErrors.join("; ")}` : error.message });
      }
    }
    try {
      const saved = updateStoreFile(storePath, (store) => {
        const state = vaultState(store);
        state.lastResult = {
          at: new Date().toISOString(),
          applied: result.applied.length,
          skipped: result.skipped.length,
          failed: result.failed.length,
        };
        store.values[VAULT_KEY] = state;
        return store;
      }, pending.storeHash);
      pending.storeHash = saved.hash;
    } catch {
      // A concurrent editor owns the current store; the per-item failure is returned without overwriting it.
    }
    result.lastSuccessAt = vaultStatus().lastSuccessAt;
    return result;
  }

  return { setVaultPath, vaultStatus, previewVault, applyVault };
}

module.exports = { createVaultService };
