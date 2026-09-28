function recoveryResult(error) {
  return { result: null, recoveryRequired: true, error: error.message };
}

function artifactsFrom(result) {
  const artifacts = {};
  for (const key of ["backupPath", "pendingPath", "preservedPath", "tempPath"]) {
    if (result[key] !== undefined) artifacts[key] = result[key];
  }
  return artifacts;
}

async function runVaultTransaction({ journal, record, mutate, verifyVault, commitStore }) {
  await journal.begin(record);
  let result;
  try {
    result = await mutate();
    await journal.advance(record.operationId, {
      phase: "vaultConfirmed", artifacts: artifactsFrom(result),
    });
    if (!await verifyVault("after")) throw new Error("Vault result cannot be verified");
    const postStoreHash = await commitStore();
    await journal.advance(record.operationId, { phase: "storeCommitted", postStoreHash });
    await journal.clear(record.operationId);
    return { result, recoveryRequired: false };
  } catch (error) {
    return recoveryResult(error);
  }
}

function expectedFiles(steps) {
  const before = new Map();
  const after = new Map();
  for (const step of steps) {
    if (step.operation === "move") {
      if (!before.has(step.from)) before.set(step.from, step.preHash);
      if (!before.has(step.to)) before.set(step.to, null);
      after.set(step.from, null);
      after.set(step.to, step.postHash);
    } else {
      if (!before.has(step.relativePath)) before.set(step.relativePath, step.preHash);
      after.set(step.relativePath, step.postHash);
    }
  }
  return { before, after };
}

function matchesFiles(expected, actual) {
  return [...expected].every(([relativePath, hash]) =>
    Object.hasOwn(actual, relativePath) && actual[relativePath] === hash);
}

async function recoveryStatus({ journal, inspectVault, readStore }) {
  let record;
  try { record = await journal.read(); }
  catch {
    return { required: true, record: null, beforeMatches: false, afterMatches: false, reason: "journalUnreadable" };
  }
  if (!record) {
    try { await journal.assertClear(); }
    catch {
      return { required: true, record: null, beforeMatches: false, afterMatches: false, reason: "journalLocked" };
    }
    return { required: false, record: null, beforeMatches: false, afterMatches: false, reason: null };
  }
  try {
    const [vault, store] = await Promise.all([inspectVault(record), readStore()]);
    const sameRoot = vault.rootIdentity?.volumeId === record.rootIdentity.volumeId &&
      vault.rootIdentity?.fileId === record.rootIdentity.fileId;
    const clean = sameRoot && Array.isArray(vault.recovery) && vault.recovery.length === 0;
    const files = expectedFiles(record.steps);
    const beforeMatches = clean && store.hash === record.preStoreHash &&
      matchesFiles(files.before, vault.files);
    const afterMatches = clean && typeof record.postStoreHash === "string" &&
      store.hash === record.postStoreHash && matchesFiles(files.after, vault.files);
    return { required: true, record, beforeMatches, afterMatches,
      reason: beforeMatches || afterMatches ? "confirmRequired" : "mixedState" };
  } catch {
    return { required: true, record, beforeMatches: false, afterMatches: false, reason: "inspectionFailed" };
  }
}

async function confirmRecovery({ journal, operationId, inspectVault, readStore }) {
  const status = await recoveryStatus({ journal, inspectVault, readStore });
  if (!status.record || status.record.operationId !== operationId ||
      !status.beforeMatches && !status.afterMatches) {
    throw new Error("Vault recovery state does not match a confirmed operation");
  }
  await journal.clear(operationId);
  return { ...status, required: false };
}

module.exports = { runVaultTransaction, recoveryStatus, confirmRecovery };
