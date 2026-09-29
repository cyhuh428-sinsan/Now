const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const MAX_BYTES = 128 * 1024;
const FIELDS = new Set([
  "operationId", "root", "rootIdentity", "itemId", "steps", "phase",
  "preStoreHash", "postStoreHash", "createdAt", "artifacts",
]);
const STEP_FIELDS = new Set(["operation", "relativePath", "from", "to", "preHash", "postHash"]);
const ARTIFACT_FIELDS = new Set(["backupPath", "sourceBackupPath", "storeBackupPath", "pendingPath", "preservedPath", "tempPath"]);
const PHASES = new Set(["prepared", "vaultConfirmed", "storeCommitted", "rollingBack", "recoveryRequired"]);
const NEXT_PHASES = {
  prepared: new Set(["prepared", "vaultConfirmed", "rollingBack", "recoveryRequired"]),
  vaultConfirmed: new Set(["vaultConfirmed", "storeCommitted", "rollingBack", "recoveryRequired"]),
  storeCommitted: new Set(["storeCommitted", "recoveryRequired"]),
  rollingBack: new Set(["rollingBack", "recoveryRequired"]),
  recoveryRequired: new Set(["recoveryRequired"]),
};

function boundedString(value, limit = 4096) {
  return typeof value === "string" && value.length > 0 && value.length <= limit && !/[\x00-\x1f\x7f]/.test(value);
}

function relativeVaultPath(value) {
  return boundedString(value, 1024) && !path.isAbsolute(value) && !value.includes("\\") &&
    !value.includes(":") && value.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}

function validHash(value) {
  return value === null || typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function validate(record) {
  if (!record || typeof record !== "object" || Array.isArray(record) ||
      Object.keys(record).some((key) => !FIELDS.has(key)) ||
      !boundedString(record.operationId, 128) || !boundedString(record.root) ||
      !path.isAbsolute(record.root) || !boundedString(record.itemId, 256) ||
      !/^[\p{L}\p{N}_.:-]+$/u.test(record.itemId) ||
      !record.rootIdentity || typeof record.rootIdentity !== "object" ||
      Array.isArray(record.rootIdentity) ||
      Object.keys(record.rootIdentity).some((key) => !["volumeId", "fileId"].includes(key)) ||
      !boundedString(record.rootIdentity.volumeId, 128) ||
      !boundedString(record.rootIdentity.fileId, 128) ||
      !Array.isArray(record.steps) || record.steps.length === 0 || record.steps.length > 8 ||
      !PHASES.has(record.phase) || !validHash(record.preStoreHash) ||
      !boundedString(record.createdAt, 64) ||
      !record.artifacts || typeof record.artifacts !== "object" || Array.isArray(record.artifacts)) {
    throw new Error("Invalid Vault journal record");
  }
  if (record.postStoreHash !== undefined && !validHash(record.postStoreHash)) {
    throw new Error("Invalid Vault journal store hash");
  }
  for (const step of record.steps) {
    const pathsValid = step && typeof step === "object" && (step.operation === "move"
      ? relativeVaultPath(step.from) && relativeVaultPath(step.to) && step.relativePath === undefined
      : relativeVaultPath(step.relativePath) && step.from === undefined && step.to === undefined);
    if (!step || typeof step !== "object" || Array.isArray(step) ||
        Object.keys(step).some((key) => !STEP_FIELDS.has(key)) ||
        !["write", "move", "rollback"].includes(step.operation) ||
        !pathsValid || !validHash(step.preHash) || !validHash(step.postHash) ||
        step.operation === "rollback" && step.postHash !== null ||
        step.operation === "move" && (step.preHash === null || step.postHash === null) ||
        step.operation === "write" && step.postHash === null) {
      throw new Error("Invalid Vault journal step");
    }
  }
  for (const [key, value] of Object.entries(record.artifacts)) {
    if (!ARTIFACT_FIELDS.has(key) || value !== null && (!boundedString(value) || !path.isAbsolute(value))) {
      throw new Error("Invalid Vault journal artifact");
    }
  }
  return record;
}

function bytesFor(record) {
  const bytes = Buffer.from(`${JSON.stringify(validate(record))}\n`, "utf8");
  if (bytes.length > MAX_BYTES) throw new Error("Vault journal is too large");
  return bytes;
}

function writeSynced(filePath, bytes, flag) {
  const fd = fs.openSync(filePath, flag, 0o600);
  try {
    fs.writeFileSync(fd, bytes);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function createVaultJournal({ journalPath }) {
  if (!path.isAbsolute(journalPath)) throw new Error("Vault journal path must be absolute");
  const lockPath = `${journalPath}.lock`;

  function withWriteLock(action) {
    fs.mkdirSync(path.dirname(journalPath), { recursive: true });
    let fd;
    try { fd = fs.openSync(lockPath, "wx", 0o600); }
    catch (error) {
      if (error.code === "EEXIST") throw new Error("Vault journal is locked for recovery");
      throw error;
    }
    try {
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, token: randomUUID() }));
      fs.fsyncSync(fd);
      return action();
    }
    finally {
      fs.closeSync(fd);
      fs.unlinkSync(lockPath);
    }
  }

  function recoverStaleLock() {
    throw new Error("Vault journal lock requires handle-safe recovery");
  }

  function read() {
    let stat;
    try { stat = fs.lstatSync(journalPath); }
    catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
    if (!stat.isFile() || stat.size > MAX_BYTES) throw new Error("Invalid Vault journal file");
    let record;
    try { record = JSON.parse(fs.readFileSync(journalPath, "utf8")); }
    catch { throw new Error("Corrupt Vault journal"); }
    return validate(record);
  }

  function assertClear() {
    try {
      fs.lstatSync(lockPath);
      throw new Error("Vault journal lock requires recovery");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (read() !== null) throw new Error("An active Vault journal requires recovery");
  }

  function begin(record) {
    const bytes = bytesFor(record);
    withWriteLock(() => {
      if (read() !== null) throw new Error("An active Vault journal requires recovery");
      try { writeSynced(journalPath, bytes, "wx"); }
      catch (error) {
        if (error.code === "EEXIST") throw new Error("An active Vault journal requires recovery");
        throw error;
      }
    });
  }

  function advance(operationId, patch) {
    return withWriteLock(() => {
      const existing = read();
      if (!existing || existing.operationId !== operationId) throw new Error("Vault journal operation ID mismatch");
      if (!patch || typeof patch !== "object" || Array.isArray(patch) ||
          Object.keys(patch).some((key) => !["phase", "artifacts", "postStoreHash"].includes(key)) ||
          patch.phase !== undefined && !NEXT_PHASES[existing.phase].has(patch.phase)) {
        throw new Error("Invalid Vault journal update phase or fields");
      }
      const next = { ...existing, ...patch, artifacts: { ...existing.artifacts, ...patch.artifacts } };
      const bytes = bytesFor(next);
      const temp = path.join(path.dirname(journalPath), `.${randomUUID()}.vault-journal.tmp`);
      try {
        writeSynced(temp, bytes, "wx");
        fs.renameSync(temp, journalPath);
      } finally {
        try { fs.unlinkSync(temp); } catch (error) { if (error.code !== "ENOENT") throw error; }
      }
    });
  }

  function clear(operationId) {
    return withWriteLock(() => {
      const existing = read();
      if (!existing || existing.operationId !== operationId) throw new Error("Vault journal operation ID mismatch");
      fs.unlinkSync(journalPath);
    });
  }

  return { read, begin, advance, clear, assertClear, recoverStaleLock };
}

module.exports = { createVaultJournal };
