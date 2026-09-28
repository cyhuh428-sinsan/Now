const path = require("node:path");
const { spawn } = require("node:child_process");

const QA_ROOT = "D:\\tmp\\nownote-239-vault-qa";
const EXPERIMENT_EXE = path.resolve(__dirname, "native", "out", "vault-helper-experiment.exe");
const MAX_RESPONSE = 16 * 1024 * 1024;

function isWithin(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function createVaultNativeClient({ exePath, fixtureRoot }) {
  if (path.resolve(exePath).toLowerCase() !== EXPERIMENT_EXE.toLowerCase() ||
      path.resolve(fixtureRoot).toLowerCase() !== QA_ROOT.toLowerCase()) {
    throw new Error("Native mutation client is limited to the QA experiment");
  }

  async function request(operation, root, rootIdentity, fields = {}) {
    if (!isWithin(path.resolve(root), fixtureRoot)) throw new Error("Vault is outside the QA fixture");
    if (fields.backupDir && !isWithin(path.resolve(fields.backupDir), fixtureRoot)) {
      throw new Error("Vault backup is outside the QA fixture");
    }
    const payload = { protocol: 1, operation, root, ...fields };
    if (operation !== "probe") payload.rootIdentity = rootIdentity;
    return new Promise((resolve, reject) => {
      const child = spawn(exePath, [], { shell: false, windowsHide: true });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8").on("data", (chunk) => {
        stdout += chunk;
        if (Buffer.byteLength(stdout) > MAX_RESPONSE) {
          child.kill();
          reject(new Error("Vault helper response is too large"));
        }
      });
      child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk.slice(0, 4096); });
      child.once("error", reject);
      child.once("close", (code) => {
        if (code !== 0 || !stdout.trim()) return reject(new Error("Vault helper exited without a response"));
        let response;
        try { response = JSON.parse(stdout); }
        catch { return reject(new Error("Vault helper returned invalid JSON")); }
        if (!response.ok) {
          const error = new Error(response.error?.message || "Vault helper failed");
          error.code = response.error?.code;
          error.recovery = response.recovery;
          return reject(error);
        }
        resolve(response.result);
      });
      child.stdin.end(JSON.stringify(payload));
    });
  }

  return {
    probe: (root) => request("probe", root),
    list: (root, rootIdentity) => request("list", root, rootIdentity),
    read: (root, rootIdentity, relativePath) => request("read", root, rootIdentity, { relativePath }),
    write: (root, rootIdentity, relativePath, expectedHash, contentBase64, backupDir) =>
      request("write", root, rootIdentity, { relativePath, expectedHash, contentBase64, backupDir }),
    move: (root, rootIdentity, from, to, expectedHash, backupDir) =>
      request("move", root, rootIdentity, { from, to, expectedHash, backupDir }),
    rollback: (root, rootIdentity, relativePath, expectedHash, backupDir) =>
      request("rollback", root, rootIdentity, { relativePath, expectedHash, backupDir }),
  };
}

module.exports = { createVaultNativeClient };
