import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(path.join(webRoot, "app.js"), "utf8");

function functionSource(name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${nextName}(`, start);
  assert(start >= 0 && end > start, `${name} source not found`);
  return source.slice(start, end);
}

function harness() {
  const selected = { id: "note-1", content: "plain", readOnly: false, unlocked: false };
  const calls = [];
  const context = {
    getSelectedTreeNode: () => selected,
    isEncryptedContent: (content) => content.startsWith("enc:"),
    isEncryptedNodeUnlocked: (node) => node.unlocked,
    isReadOnlyTreeNode: (node) => node.readOnly,
    encryptSelectedNote: () => calls.push("encrypt"),
    lockSelectedNote: () => calls.push("lock"),
    unlockSelectedNote: () => calls.push("unlock"),
    decryptSelectedNote: () => calls.push("decrypt"),
  };
  vm.createContext(context);
  vm.runInContext(functionSource("isContextMenuActionDisabled", "hasTreeContentSelection"), context);
  vm.runInContext(functionSource("runEditorCommand", "runNativeEditCommand"), context);
  return { selected, calls, context };
}

test("security menu follows the selected note's encryption and lock state", () => {
  const { selected, context } = harness();
  const disabled = () => ["encrypt", "lock", "unlock", "decrypt"]
    .map((action) => context.isContextMenuActionDisabled(action));

  assert.deepEqual(disabled(), [false, true, true, true]);
  selected.content = "enc:secret";
  assert.deepEqual(disabled(), [true, true, false, false]);
  selected.unlocked = true;
  assert.deepEqual(disabled(), [true, false, true, false]);
  selected.readOnly = true;
  assert.deepEqual(disabled(), [true, false, true, true]);
});

test("security menu commands invoke the existing note actions", () => {
  const { calls, context } = harness();
  for (const action of ["encrypt", "lock", "unlock", "decrypt"]) {
    context.runEditorCommand(action);
  }
  assert.deepEqual(calls, ["encrypt", "lock", "unlock", "decrypt"]);
});
