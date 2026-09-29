const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const desktop = path.resolve(__dirname, "..");
const project = path.resolve(desktop, "..");
const read = (relative) => fs.readFileSync(path.join(project, relative), "utf8");

test("preload exposes only bounded Vault commands and main uses the OS folder dialog", () => {
  const preload = read("desktop/preload.cjs");
  const main = read("desktop/main.cjs");
  for (const command of ["choose", "status", "preview", "apply", "recoveryStatus", "confirmRecovery"]) {
    assert.match(preload, new RegExp(`${command}:\\s*\\(`));
  }
  assert.match(main, /nownote:vault-recovery-status/);
  assert.match(main, /nownote:vault-confirm-recovery/);
  assert.match(main, /showOpenDialog/);
  assert.match(main, /openDirectory/);
  assert.match(main, /registerVaultHandlers/);
  assert.doesNotMatch(preload, /vault:\s*\{[^}]*\b(?:readFile|writeFile|deleteFile)\b/s);
});

test("both screen sources contain a desktop-only Vault panel and explicit apply controls", () => {
  for (const file of ["web/index.html", "desktop/app/index.html"]) {
    const html = read(file);
    for (const id of ["vaultSettingsRow", "vaultChooseBtn", "vaultDirectionSelect", "vaultPreviewBtn", "vaultApplyBtn", "vaultItems", "vaultRecoveryPanel", "vaultConfirmRecoveryBtn"]) {
      assert.match(html, new RegExp(`id="${id}"`));
    }
    assert.match(html, /id="vaultSettingsRow"[^>]*hidden/);
  }
  for (const file of ["web/app.js", "desktop/app/app.js"]) {
    const source = read(file);
    assert.match(source, /function renderVaultSettings/);
    assert.match(source, /isDesktopClient\(\).*vault|vault.*isDesktopClient\(\)/s);
    assert.match(source, /vaultConfirmRecoveryBtn/);
  }
});

test("desktop package includes its Vault modules in the installed app", () => {
  const pkg = JSON.parse(read("desktop/package.json"));
  assert.ok(pkg.build.files.includes("vault-*.cjs"));
  assert.ok(pkg.build.files.includes("store-file.cjs"));
});
