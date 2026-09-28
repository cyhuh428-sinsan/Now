const fs = require("node:fs");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");

function hashBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function readStoreFile(storePath) {
  let bytes;
  try {
    bytes = fs.readFileSync(storePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { store: { version: 1, updatedAt: null, values: {} }, hash: null };
  }
  const store = JSON.parse(bytes.toString("utf8"));
  if (!store || typeof store !== "object" || !store.values || typeof store.values !== "object" || Array.isArray(store.values)) {
    throw new Error("Invalid NowNote desktop store");
  }
  return { store, hash: hashBytes(bytes) };
}

function writeStoreFile(storePath, store) {
  const dir = path.dirname(storePath);
  fs.mkdirSync(dir, { recursive: true });
  const temp = path.join(dir, `.${randomUUID()}.tmp`);
  const bytes = Buffer.from(`${JSON.stringify(store, null, 2)}\n`, "utf8");
  try {
    fs.writeFileSync(temp, bytes, { flag: "wx" });
    fs.renameSync(temp, storePath);
  } finally {
    try { fs.unlinkSync(temp); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  return hashBytes(bytes);
}

function updateStoreFile(storePath, update, expectedHash) {
  const { store, hash } = readStoreFile(storePath);
  if (expectedHash !== undefined && hash !== expectedHash) throw new Error("NowNote store changed since preview");
  const next = update(store);
  next.updatedAt = new Date().toISOString();
  return { store: next, hash: writeStoreFile(storePath, next) };
}

module.exports = { readStoreFile, writeStoreFile, updateStoreFile };
