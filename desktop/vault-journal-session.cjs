const path = require("node:path");
const { spawn } = require("node:child_process");

const QA_ROOT = "D:\\tmp\\nownote-239-vault-qa";
const EXPERIMENT_EXE = path.resolve(__dirname, "native", "out", "vault-journal-experiment.exe");
const MAX_RESPONSE = 256 * 1024;

function within(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function createVaultJournalSession({ exePath, root, requestTimeoutMs = 30000, testPauseReadMs = 0 }) {
  if (path.resolve(exePath).toLowerCase() !== EXPERIMENT_EXE.toLowerCase() ||
      !within(path.resolve(root), QA_ROOT) ||
      !Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 30000 ||
      !Number.isInteger(testPauseReadMs) || testPauseReadMs < 0 || testPauseReadMs > 5000) {
    throw new Error("Native journal session is limited to the QA fixture");
  }
  const child = spawn(exePath, [], {
    shell: false, windowsHide: true,
    env: testPauseReadMs ? { ...process.env, NOWNOTE_JOURNAL_TEST_PAUSE_READ_MS: String(testPauseReadMs) }
      : process.env,
  });
  let buffer = "";
  let pending = null;
  let exited = false;
  let fatalError = null;
  const closed = new Promise((resolve) => child.once("close", resolve));
  const fail = (error) => {
    exited = true;
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      pending = null;
    }
  };
  child.once("error", fail);
  child.once("close", () => fail(fatalError || new Error("Native journal session exited")));
  child.stdout.setEncoding("utf8").on("data", (chunk) => {
    buffer += chunk;
    if (Buffer.byteLength(buffer) > MAX_RESPONSE) {
      child.kill();
      fail(new Error("Native journal response is too large"));
      return;
    }
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      const current = pending;
      pending = null;
      if (!current) { child.kill(); return; }
      clearTimeout(current.timer);
      let message;
      try { message = JSON.parse(line); }
      catch { current.reject(new Error("Native journal returned invalid JSON")); child.kill(); return; }
      if (!message.ok) {
        const error = new Error(message.error?.message || "Native journal failed");
        error.code = message.error?.code;
        current.reject(error);
      } else current.resolve(message.result);
    }
  });

  async function request(operation, fields = {}) {
    if (exited) throw new Error("Native journal session exited");
    if (pending) throw new Error("Native journal session request already pending");
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        fatalError = new Error("Native journal request timed out");
        child.kill();
      }, requestTimeoutMs);
      pending = { resolve, reject, timer };
      child.stdin.write(`${JSON.stringify({ protocol: 1, operation, ...fields })}\n`, (error) => {
        if (error && pending) {
          fatalError = error;
          child.kill();
        }
      });
    });
  }

  let opened;
  try { opened = await request("open", { root }); }
  catch (error) { child.kill(); await closed; throw error; }
  return {
    rootIdentity: opened.rootIdentity,
    read: async () => (await request("read")).record,
    begin: async (record) => request("begin", { record }),
    advance: async (operationId, patch) => request("advance", { operationId, patch }),
    clear: async (operationId) => request("clear", { operationId }),
    assertClear: async () => request("assertClear"),
    kill: async () => { if (!exited) child.kill(); await closed; },
  };
}

module.exports = { createVaultJournalSession };
