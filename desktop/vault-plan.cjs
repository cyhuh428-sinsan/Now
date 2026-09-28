const { createHash } = require("node:crypto");

const WINDOWS_RESERVED = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i;
const INVALID_FILENAME = /[<>:"/\\|?*\x00-\x1f]/g;
const DIRECTIONS = new Set(["toVault", "fromVault", "both"]);

function safeFilename(title) {
  const name = String(title ?? "").replace(INVALID_FILENAME, "_").replace(/[. ]+$/g, "").trim();
  const safe = name || "_";
  return WINDOWS_RESERVED.test(safe) ? `_${safe}` : safe;
}

function contentHash({ title = "", body = "", tags = [] }) {
  return createHash("sha256").update(JSON.stringify([title, body, tags])).digest("hex");
}

function mapNowTree(tree) {
  if (!Array.isArray(tree)) throw new Error("Invalid NowNote tree");
  const entries = [];
  const walk = (nodes, parents) => {
    for (const node of nodes) {
      if (!node || typeof node.id !== "string" || !node.id || typeof node.title !== "string") {
        throw new Error("Invalid NowNote tree node");
      }
      const depth = parents.length + 1;
      if (depth > 3) throw new Error("NowNote tree exceeds three levels");
      const kind = ["topic", "category", "note"][depth - 1];
      const segments = [...parents, safeFilename(node.title)];
      const relativePath = depth === 3 ? `${segments.join("/")}.md` : `${segments.join("/")}/_index.md`;
      entries.push({ id: node.id, kind, title: node.title, body: node.content || "", tags: node.tags || [], relativePath, parentId: node.parentId || null, status: node.status || "active" });
      if (Array.isArray(node.children) && node.children.length) walk(node.children, segments);
    }
  };
  walk(tree, []);
  return entries;
}

function canonicalPath(relativePath) {
  return String(relativePath).replace(/\\/g, "/").normalize("NFC").toLocaleLowerCase("en-US");
}

function duplicateKeys(entries, keyFn) {
  const seen = new Map();
  const duplicates = new Set();
  for (const entry of entries) {
    const key = keyFn(entry);
    if (!key) continue;
    if (seen.has(key)) duplicates.add(key);
    seen.set(key, entry);
  }
  return duplicates;
}

function buildSyncPlan({ localNodes, vaultEntries, baselines = {}, direction }) {
  if (!DIRECTIONS.has(direction)) throw new Error("Invalid Vault sync direction");
  if (!Array.isArray(localNodes) || !Array.isArray(vaultEntries)) throw new Error("Invalid Vault plan entries");
  const localIds = duplicateKeys(localNodes, (entry) => entry.id);
  const vaultIds = duplicateKeys(vaultEntries, (entry) => entry.id);
  const allPaths = [...localNodes, ...vaultEntries];
  const localPaths = duplicateKeys(localNodes, (entry) => canonicalPath(entry.relativePath));
  const vaultPaths = duplicateKeys(vaultEntries, (entry) => canonicalPath(entry.relativePath));
  const localById = new Map(localNodes.map((entry) => [entry.id, entry]));
  const vaultById = new Map(vaultEntries.filter((entry) => entry.id).map((entry) => [entry.id, entry]));
  const occupied = new Map();
  for (const entry of allPaths) {
    const key = canonicalPath(entry.relativePath);
    if (entry === localById.get(entry.id)) continue;
    if (!occupied.has(key)) occupied.set(key, []);
    occupied.get(key).push(entry);
  }
  const ids = [...new Set([...localNodes.map((entry) => entry.id), ...vaultEntries.filter((entry) => entry.id).map((entry) => entry.id), ...Object.keys(baselines)])];
  const items = [];
  for (const id of ids) {
    const local = localById.get(id);
    const remote = vaultById.get(id);
    const baseline = baselines[id];
    const paths = { baseline: baseline?.relativePath || null, local: local?.relativePath || null, vault: remote?.relativePath || null };
    let classification;
    let reason = null;
    const localPathKey = local && canonicalPath(local.relativePath);
    const vaultPathKey = remote && canonicalPath(remote.relativePath);
    const blocked = localIds.has(id) || vaultIds.has(id) || (localPathKey && localPaths.has(localPathKey)) || (vaultPathKey && vaultPaths.has(vaultPathKey));
    const targetOccupied = local && occupied.get(localPathKey)?.some((entry) => entry.id !== id);
    if (blocked || targetOccupied || (local && remote && local.kind !== remote.kind)) {
      classification = "conflict";
      reason = blocked ? "duplicateIdentityOrPath" : targetOccupied ? "targetPathOccupied" : "kindMismatch";
    } else if (local?.status === "deleted" || local?.body?.trimStart().startsWith("NOW_ENCRYPTED_V1:")) {
      classification = "skipped";
      reason = "localExcluded";
    } else if (!local || !remote) {
      classification = baseline ? (local ? "missingVault" : "missingLocal") : (local ? "newLocal" : "unlinked");
    } else {
      const localHash = contentHash(local);
      const vaultHash = contentHash(remote);
      const localPathChanged = Boolean(baseline && baseline.relativePath !== local.relativePath);
      const vaultPathChanged = Boolean(baseline && baseline.relativePath !== remote.relativePath);
      if (!baseline) {
        classification = localHash === vaultHash ? "unchanged" : "conflict";
      } else {
        const localChanged = localHash !== baseline.localHash || localPathChanged;
        const vaultChanged = vaultHash !== baseline.vaultHash || vaultPathChanged;
        classification = localChanged && vaultChanged ? "conflict" : localChanged ? "localChanged" : vaultChanged ? "vaultChanged" : "unchanged";
      }
    }
    const defaultAction = (classification === "localChanged" || classification === "newLocal") && direction !== "fromVault" ? "toVault"
      : classification === "vaultChanged" && direction !== "toVault" ? "toNowNote" : "skip";
    items.push({ itemId: id, id, kind: local?.kind || remote?.kind || null, classification, reason, defaultAction, paths, local, vault: remote });
  }
  for (const entry of vaultEntries.filter((candidate) => !candidate.id)) {
    const depth = String(entry.relativePath).split(/[\\/]/).length;
    items.push({ itemId: `unlinked:${entry.relativePath}`, id: null, kind: null, classification: depth > 3 ? "depthExceeded" : "unlinked", reason: null, defaultAction: "skip", paths: { baseline: null, local: null, vault: entry.relativePath }, local: null, vault: entry });
  }
  const counts = Object.fromEntries([...new Set(items.map((item) => item.classification))].map((classification) => [classification, items.filter((item) => item.classification === classification).length]));
  return { items, counts };
}

module.exports = { safeFilename, contentHash, mapNowTree, buildSyncPlan };
