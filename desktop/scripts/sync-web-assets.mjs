import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(desktopRoot, "..");
const webRoot = path.join(repoRoot, "web");
const targetRoot = path.join(desktopRoot, "app");

const files = [
  "index.html",
  "app.js",
  "styles.css",
  "help.html",
  "manifest.webmanifest",
  "sw.js",
  "README.md",
  "runtime_checklist_ko.md",
];

const directories = ["icons"];

function copyFile(relativePath) {
  const source = path.join(webRoot, relativePath);
  const target = path.join(targetRoot, relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing Web asset: ${source}`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function copyDirectory(relativePath) {
  const source = path.join(webRoot, relativePath);
  const target = path.join(targetRoot, relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing Web asset directory: ${source}`);
  }
  fs.cpSync(source, target, { recursive: true });
}

fs.rmSync(targetRoot, { recursive: true, force: true });
fs.mkdirSync(targetRoot, { recursive: true });

for (const file of files) {
  copyFile(file);
}

for (const directory of directories) {
  copyDirectory(directory);
}

console.log(`NowNote assets copied to ${targetRoot}`);
