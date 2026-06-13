import { spawn, spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const EXE_PATH = path.join(ROOT, "dist", "win-unpacked", "NowNote.exe");
const STORE_FILE = "nownote-desktop-store.json";
const STORAGE_KEY = "nownote.web.v1";
const TIMEOUT_MS = 20_000;

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    ws.addEventListener("message", (event) => this.onMessage(event.data));
    ws.addEventListener("close", () => {
      for (const { method, reject } of this.pending.values()) {
        reject(new Error(`${method}: CDP socket closed`));
      }
      this.pending.clear();
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", () => reject(new Error(`CDP socket open failed: ${url}`)), { once: true });
    });
    return new CdpClient(ws);
  }

  onMessage(raw) {
    const message = JSON.parse(String(raw));
    if (!message.id) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.error) {
      pending.reject(new Error(`${pending.method}: ${message.error.message}`));
    } else {
      pending.resolve(message.result || {});
    }
  }

  send(method, params = {}, sessionId = null) {
    const id = this.nextId++;
    const message = { id, method, params };
    if (sessionId) message.sessionId = sessionId;
    this.ws.send(JSON.stringify(message));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { method, resolve, reject });
    });
  }

  close() {
    this.ws.close();
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", resolve);
    server.on("error", reject);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function fetchJson(url, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function waitForJson(url, timeoutMs = TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      return await fetchJson(url, 2_000);
    } catch (error) {
      lastError = error;
      await delay(150);
    }
  }
  throw lastError || new Error(`${url} timed out`);
}

async function waitForPageTarget(debugPort) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const targets = await waitForJson(`http://127.0.0.1:${debugPort}/json`, 2_000);
    const target = targets.find((item) => item.type === "page");
    if (target?.webSocketDebuggerUrl) return target;
    await delay(150);
  }
  throw new Error("Electron page target not found.");
}

async function evaluate(page, expression) {
  const result = await page.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
  }
  return result.result?.value;
}

async function waitForCondition(page, expression, label, timeoutMs = TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(page, expression)) return;
    await delay(150);
  }
  throw new Error(`${label} timed out.`);
}

async function dispatchKey(page, key, options = {}) {
  const normalizedKey = String(key);
  const lowerKey = normalizedKey.toLowerCase();
  const isSingleLetter = /^[a-z]$/.test(lowerKey);
  const code = normalizedKey === "Tab" ? "Tab" : isSingleLetter ? `Key${lowerKey.toUpperCase()}` : normalizedKey;
  const virtualKeyCode = normalizedKey === "Tab" ? 9 : normalizedKey === "Enter" ? 13 : isSingleLetter ? lowerKey.toUpperCase().charCodeAt(0) : 0;
  const modifiers =
    (options.shift ? 8 : 0)
    | (options.ctrl ? 2 : 0)
    | (options.alt ? 1 : 0)
    | (options.meta ? 4 : 0);
  await page.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: normalizedKey,
    code,
    windowsVirtualKeyCode: virtualKeyCode,
    nativeVirtualKeyCode: virtualKeyCode,
    modifiers,
  });
  await page.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: normalizedKey,
    code,
    windowsVirtualKeyCode: virtualKeyCode,
    nativeVirtualKeyCode: virtualKeyCode,
    modifiers,
  });
}

function stopProcess(proc) {
  if (!proc?.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    proc.kill("SIGKILL");
  }
}

async function launchApp(userDataDir) {
  const debugPort = await freePort();
  const app = spawn(EXE_PATH, [`--remote-debugging-port=${debugPort}`], {
    env: {
      ...process.env,
      NOWNOTE_DESKTOP_USER_DATA_DIR: userDataDir,
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  app.stderr.on("data", () => {});

  const target = await waitForPageTarget(debugPort);
  const client = await CdpClient.connect(target.webSocketDebuggerUrl);
  const page = { send: (method, params = {}) => client.send(method, params) };
  await page.send("Runtime.enable");
  await waitForCondition(page, "document.readyState === 'complete'", "desktop app load");
  await waitForCondition(page, "Boolean(window.nownoteDesktop?.storage && document.querySelector('#addRootBtn'))", "desktop bridge");
  return { app, client, page };
}

async function verifyEditorTabIndent(page) {
  await evaluate(page, `
    (() => {
      document.querySelector('#addRootBtn').click();
      const title = document.querySelector('#treeTitleInput');
      title.value = 'Desktop Tab indent check';
      title.dispatchEvent(new Event('input', { bubbles: true }));
      const content = document.querySelector('#treeContent');
      content.focus();
      content.value = 'alpha\\nbeta';
      content.dispatchEvent(new Event('input', { bubbles: true }));
      content.setSelectionRange(0, content.value.length);
      return true;
    })()
  `);
  await dispatchKey(page, "Tab");
  const defaultIndented = await evaluate(page, `document.querySelector('#treeContent').value`);
  assert(defaultIndented === "  alpha\n  beta", "Plain Tab did not indent selected editor lines by the default 2 spaces.");

  await evaluate(page, `
    (() => {
      const content = document.querySelector('#treeContent');
      content.focus();
      content.setSelectionRange(0, content.value.length);
      return true;
    })()
  `);
  await dispatchKey(page, "Tab", { shift: true });
  const outdented = await evaluate(page, `document.querySelector('#treeContent').value`);
  assert(outdented === "alpha\nbeta", "Shift+Tab did not outdent selected editor lines.");

  await evaluate(page, `
    (() => {
      const select = document.querySelector('#tabIndentSelect');
      select.value = '4';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      const content = document.querySelector('#treeContent');
      content.focus();
      content.value = 'alpha\\nbeta';
      content.dispatchEvent(new Event('input', { bubbles: true }));
      content.setSelectionRange(0, content.value.length);
      return true;
    })()
  `);
  await dispatchKey(page, "Tab");
  const fourSpaceIndented = await evaluate(page, `document.querySelector('#treeContent').value`);
  assert(fourSpaceIndented === "    alpha\n    beta", "Tab indent setting did not change editor indentation to 4 spaces.");
}

async function verifySearchShortcuts(page) {
  await evaluate(page, `
    (() => {
      document.querySelector('#searchPopoverView')?.classList.add('hidden');
      document.querySelector('#noteFindBar')?.classList.add('hidden');
      document.querySelector('#treeContent')?.focus();
      return true;
    })()
  `);
  await dispatchKey(page, "f", { ctrl: true });
  const ctrlF = await evaluate(page, `
    (() => ({
      searchOpen: !document.querySelector('#searchPopoverView')?.classList.contains('hidden'),
      noteFindOpen: !document.querySelector('#noteFindBar')?.classList.contains('hidden'),
      activeId: document.activeElement?.id || ''
    }))()
  `);
  assert(ctrlF.searchOpen && !ctrlF.noteFindOpen && ctrlF.activeId === "searchPopoverInput", "Ctrl+F did not open the global search popover.");

  await evaluate(page, `
    (() => {
      document.querySelector('#searchPopoverView')?.classList.add('hidden');
      document.querySelector('#noteFindBar')?.classList.add('hidden');
      document.querySelector('#treeContent')?.focus();
      return true;
    })()
  `);
  await dispatchKey(page, "f", { ctrl: true, shift: true });
  const ctrlShiftF = await evaluate(page, `
    (() => ({
      searchOpen: !document.querySelector('#searchPopoverView')?.classList.contains('hidden'),
      noteFindOpen: !document.querySelector('#noteFindBar')?.classList.contains('hidden'),
      activeId: document.activeElement?.id || ''
    }))()
  `);
  assert(!ctrlShiftF.searchOpen && ctrlShiftF.noteFindOpen && ctrlShiftF.activeId === "noteFindInput", "Ctrl+Shift+F did not open the in-note find bar.");
}

async function verifyNoteFindMovement(page) {
  const target = "target-search-position";
  const wrappedLines = Array.from({ length: 90 }, (_, index) =>
    `https://www.example.com/memberRegStep${index}.do?path=very-long-shopping-mall-account-line-${index}-8710-4009-2679-2041-and-extra-wrapped-text`
  ).join("\n");
  await evaluate(page, `
    (() => {
      const content = document.querySelector('#treeContent');
      content.focus();
      content.value = [
        ${JSON.stringify(wrappedLines)},
        ${JSON.stringify(target)}
      ].join('\\n');
      content.scrollTop = 0;
      content.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#noteFindBar')?.classList.add('hidden');
      return true;
    })()
  `);
  await dispatchKey(page, "f", { ctrl: true, shift: true });
  await evaluate(page, `
    (() => {
      const input = document.querySelector('#noteFindInput');
      input.value = ${JSON.stringify(target)};
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
      return true;
    })()
  `);
  await evaluate(page, `document.querySelector('#noteFindNextBtn').click()`);
  const result = await evaluate(page, `
    (() => {
      const content = document.querySelector('#treeContent');
      const computed = window.getComputedStyle(content);
      const mirror = document.createElement('div');
      const marker = document.createElement('span');
      mirror.style.position = 'fixed';
      mirror.style.visibility = 'hidden';
      mirror.style.pointerEvents = 'none';
      mirror.style.left = '-10000px';
      mirror.style.top = '0';
      mirror.style.width = content.clientWidth + 'px';
      mirror.style.boxSizing = computed.boxSizing;
      mirror.style.padding = computed.padding;
      mirror.style.border = computed.border;
      mirror.style.font = computed.font;
      mirror.style.letterSpacing = computed.letterSpacing;
      mirror.style.lineHeight = computed.lineHeight;
      mirror.style.whiteSpace = 'pre-wrap';
      mirror.style.overflowWrap = 'break-word';
      mirror.style.wordBreak = computed.wordBreak;
      mirror.textContent = content.value.slice(0, content.value.indexOf(${JSON.stringify(target)}));
      marker.textContent = '\\u200b';
      mirror.append(marker);
      document.body.append(mirror);
      const targetTop = marker.offsetTop;
      mirror.remove();
      return {
        selectionStart: content.selectionStart,
        expectedStart: content.value.indexOf(${JSON.stringify(target)}),
        scrollTop: content.scrollTop,
        scrollHeight: content.scrollHeight,
        clientHeight: content.clientHeight,
        targetViewportTop: targetTop - content.scrollTop,
        activeId: document.activeElement?.id || ''
      };
    })()
  `);
  assert(result.selectionStart === result.expectedStart, `In-note search did not move the editor selection to the matched text: ${JSON.stringify(result)}`);
  assert(result.scrollTop > 0, `In-note search did not scroll the editor to the matched text: ${JSON.stringify(result)}`);
  assert(result.targetViewportTop > 0 && result.targetViewportTop < result.clientHeight, `In-note search did not bring the matched text into view: ${JSON.stringify(result)}`);
  assert(result.activeId === "treeContent", `In-note search did not focus the editor after moving to the match: ${JSON.stringify(result)}`);
}

async function main() {
  assert(typeof WebSocket === "function", "Current Node.js runtime does not support WebSocket.");
  assert(await exists(EXE_PATH), `Desktop app is missing: ${EXE_PATH}`);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nownote-desktop-storage-"));
  const title = `Desktop storage smoke ${Date.now()}`;
  const body = "Desktop storage persisted after restart.";
  const storePath = path.join(tempDir, STORE_FILE);

  let first = null;
  let second = null;
  try {
    first = await launchApp(tempDir);
    await evaluate(first.page, `
      (() => {
        document.querySelector('#addRootBtn').click();
        const title = document.querySelector('#treeTitleInput');
        title.value = ${JSON.stringify(title)};
        title.dispatchEvent(new Event('input', { bubbles: true }));
        const content = document.querySelector('#treeContent');
        if ('value' in content) {
          content.value = ${JSON.stringify(body)};
        } else {
          content.textContent = ${JSON.stringify(body)};
        }
        content.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()
    `);
    await waitForCondition(first.page, `
      (async () => {
        const info = await window.nownoteDesktop.storage.info();
        return Boolean(info.path && info.keys.includes(${JSON.stringify(STORAGE_KEY)}));
      })()
    `, "desktop store write");
    first.client.close();
    stopProcess(first.app);
    first = null;

    const storeRaw = await fs.readFile(storePath, "utf-8");
    const store = JSON.parse(storeRaw);
    assert(store.values?.[STORAGE_KEY]?.tree?.some((node) => node.title === title), "Saved note was not written to desktop store.");

    second = await launchApp(tempDir);
    await waitForCondition(second.page, `
      (() => {
        const items = Array.from(document.querySelectorAll('#treeList .tree-title')).map((item) => item.textContent || '');
        return items.some((item) => item.includes(${JSON.stringify(title)}));
      })()
    `, "desktop store reload");
    await verifyEditorTabIndent(second.page);
    await verifySearchShortcuts(second.page);
    await verifyNoteFindMovement(second.page);

    console.log("NowNote desktop storage check passed");
    console.log(`- Store path: ${storePath}`);
    console.log(`- Reloaded note: ${title}`);
    console.log("- Editor Tab/Shift+Tab indentation passed");
    console.log("- Ctrl+F and Ctrl+Shift+F shortcuts passed");
    console.log("- In-note search movement passed");
  } finally {
    first?.client?.close();
    second?.client?.close();
    stopProcess(first?.app);
    stopProcess(second?.app);
    await delay(500);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((error) => {
  console.error(`NowNote desktop storage check failed: ${error.message}`);
  process.exit(1);
});
