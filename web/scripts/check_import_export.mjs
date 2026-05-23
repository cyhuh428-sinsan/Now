import { spawn, spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import { createServer } from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const STORAGE_KEY = "nownote.web.v1";
const DEFAULT_TIMEOUT_MS = 15_000;

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
]);

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.waiters = [];
    this.events = [];

    ws.addEventListener("message", (event) => this.onMessage(event.data));
    ws.addEventListener("close", () => {
      for (const { method, reject } of this.pending.values()) reject(new Error(`${method}: CDP socket closed`));
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
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      } else {
        pending.resolve(message.result || {});
      }
      return;
    }

    if (message.method) {
      this.events.push(message);
      const waiters = this.waiters.splice(0);
      for (const waiter of waiters) {
        if (waiter.method === message.method && waiter.predicate(message.params || {})) {
          clearTimeout(waiter.timer);
          waiter.resolve(message.params || {});
        } else {
          this.waiters.push(waiter);
        }
      }
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

  waitFor(method, predicate = () => true, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const cachedIndex = this.events.findIndex((event) => event.method === method && predicate(event.params || {}));
    if (cachedIndex >= 0) {
      const [event] = this.events.splice(cachedIndex, 1);
      return Promise.resolve(event.params || {});
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((waiter) => waiter.resolve !== resolve);
        reject(new Error(`${method} timed out`));
      }, timeoutMs);
      this.waiters.push({ method, predicate, resolve, reject, timer });
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

function which(command) {
  const lookup = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(lookup, [command], { encoding: "utf-8" });
  if (result.status !== 0) return null;
  return result.stdout.split(/\r?\n/).find(Boolean) || null;
}

async function findBrowser() {
  if (process.env.NOWNOTE_BROWSER_PATH && await exists(process.env.NOWNOTE_BROWSER_PATH)) {
    return process.env.NOWNOTE_BROWSER_PATH;
  }

  const candidates = process.platform === "win32"
    ? [
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      ]
    : process.platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ]
      : [
          which("google-chrome"),
          which("chromium"),
          which("chromium-browser"),
          which("microsoft-edge"),
        ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate && await exists(candidate)) return candidate;
  }
  throw new Error("Chrome 또는 Edge 실행 파일을 찾을 수 없습니다. NOWNOTE_BROWSER_PATH를 지정해 주세요.");
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

async function startStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      const requested = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const relative = requested.replace(/^\/+/, "");
      const filePath = path.resolve(ROOT, relative);

      if (!filePath.startsWith(ROOT)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }

      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      response.writeHead(200, {
        "Content-Type": MIME_TYPES.get(path.extname(filePath)) || "application/octet-stream",
        "Content-Length": stats.size,
      });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  const port = await freePort();
  await new Promise((resolve, reject) => {
    server.listen(port, "127.0.0.1", resolve);
    server.on("error", reject);
  });
  return { server, port };
}

async function fetchJson(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
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

async function waitForJson(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
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

async function waitForPageTarget(debugPort, webPort, targetId = null) {
  const deadline = Date.now() + DEFAULT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const targets = await waitForJson(`http://127.0.0.1:${debugPort}/json`, 2_000);
    const target = targetId
      ? targets.find((item) => item.id === targetId)
      : targets.find((item) => item.type === "page" && item.url.includes(`127.0.0.1:${webPort}`))
      || targets.find((item) => item.type === "page");
    if (target?.webSocketDebuggerUrl) return target;
    await delay(150);
  }
  throw new Error("브라우저 페이지 대상을 찾을 수 없습니다.");
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

async function waitForCondition(page, expression, label, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(page, expression)) return;
    await delay(100);
  }
  throw new Error(`${label} 확인 시간이 초과되었습니다.`);
}

async function setFileInput(page, selector, filePath) {
  const { root } = await page.send("DOM.getDocument", { depth: -1, pierce: true });
  const { nodeId } = await page.send("DOM.querySelector", { nodeId: root.nodeId, selector });
  assert(nodeId, `${selector} 파일 입력을 찾을 수 없습니다.`);
  await page.send("DOM.setFileInputFiles", { nodeId, files: [filePath] });
}

async function listFiles(directory) {
  try {
    return await fs.readdir(directory);
  } catch {
    return [];
  }
}

async function waitForDownload(downloadDir, beforeFiles, options) {
  const before = new Set(beforeFiles);
  const deadline = Date.now() + DEFAULT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const files = await listFiles(downloadDir);
    const complete = files.filter((name) => !before.has(name) && !name.endsWith(".crdownload"));
    for (const fileName of complete) {
      if (options.extension && !fileName.toLowerCase().endsWith(options.extension)) continue;
      if (options.nameIncludes && !fileName.includes(options.nameIncludes)) continue;
      const filePath = path.join(downloadDir, fileName);
      if (options.contentIncludes) {
        const content = await fs.readFile(filePath, "utf-8");
        if (!content.includes(options.contentIncludes)) continue;
      }
      return filePath;
    }
    await delay(150);
  }
  throw new Error(`${options.label} 다운로드 파일을 찾을 수 없습니다.`);
}

async function confirmDialog(page, label) {
  await waitForCondition(
    page,
    "!document.querySelector('#confirmDialog')?.classList.contains('hidden')",
    `${label} 확인창`,
  );
  await evaluate(page, "document.querySelector('#confirmOkBtn').click(); true");
}

function browserArgs(debugPort, userDataDir, appUrl) {
  return [
    "--headless=new",
    `--remote-debugging-port=${debugPort}`,
    "--remote-allow-origins=*",
    `--user-data-dir=${userDataDir}`,
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-features=Translate,MediaRouter",
    appUrl,
  ];
}

function stopBrowserProcess(browser) {
  if (!browser?.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(browser.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  browser.kill("SIGKILL");
}

async function main() {
  assert(typeof WebSocket === "function", "현재 Node.js 런타임이 WebSocket을 지원하지 않습니다.");

  const browserPath = await findBrowser();
  if (process.env.NOWNOTE_DEBUG_IMPORT_EXPORT) console.error(`Browser: ${browserPath}`);
  const { server, port: webPort } = await startStaticServer();
  const debugPort = await freePort();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nownote-web-check-"));
  const userDataDir = path.join(tempDir, "profile");
  const downloadDir = path.join(tempDir, "downloads");
  const filesDir = path.join(tempDir, "files");
  await fs.mkdir(downloadDir, { recursive: true });
  await fs.mkdir(filesDir, { recursive: true });

  const appUrl = `http://127.0.0.1:${webPort}/index.html`;
  const browser = spawn(browserPath, browserArgs(debugPort, userDataDir, "about:blank"), {
    env: { ...process.env, NOWNOTE_HEADLESS_CHECK: "1" },
    stdio: ["ignore", "ignore", "pipe"],
  });

  let browserClient = null;
  let page = null;

  try {
    browser.stderr.on("data", () => {});

    const version = await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
    browserClient = await CdpClient.connect(version.webSocketDebuggerUrl);
    try {
      await browserClient.send("Browser.setDownloadBehavior", {
        behavior: "allow",
        downloadPath: downloadDir,
        eventsEnabled: true,
      });
    } catch {
      // Older Chromium builds accept the page-scoped fallback after the page client is connected.
    }

    const { targetId } = await browserClient.send("Target.createTarget", { url: "about:blank" });
    await waitForPageTarget(debugPort, webPort, targetId);
    const { sessionId } = await browserClient.send("Target.attachToTarget", { targetId, flatten: true });
    page = {
      send: (method, params = {}) => browserClient.send(method, params, sessionId),
      close: () => {},
    };
    await page.send("Runtime.enable");
    await page.send("Page.enable");
    await page.send("DOM.enable");
    try {
      await page.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir });
    } catch {
      // Browser.setDownloadBehavior is preferred. This fallback is best-effort only.
    }
    await page.send("Page.navigate", { url: appUrl });
    await waitForCondition(page, "document.readyState === 'complete'", "NowNote Web 로드");
    await waitForCondition(page, "Boolean(document.querySelector('#exportMarkdownBtn') && document.querySelector('#importMarkdownInput'))", "Markdown 버튼");

    const markdownPath = path.join(filesDir, "자동점검.md");
    await fs.writeFile(markdownPath, "# 자동 점검 Markdown\n\n가져오기 본문입니다.\n", "utf-8");

    await setFileInput(page, "#importMarkdownInput", markdownPath);
    await confirmDialog(page, "Markdown 가져오기");
    await waitForCondition(
      page,
      `(() => {
        const data = JSON.parse(localStorage.getItem('${STORAGE_KEY}') || '{}');
        const flat = [];
        const walk = (nodes) => (nodes || []).forEach((node) => {
          flat.push(node);
          walk(node.children);
        });
        walk(data.tree);
        return flat.some((node) => node.title === '자동 점검 Markdown' && String(node.content || '').includes('가져오기 본문입니다.'));
      })()`,
      "Markdown 가져오기 결과",
    );

    const beforeMarkdownExport = await listFiles(downloadDir);
    await evaluate(page, "document.querySelector('#exportMarkdownBtn').click(); true");
    const markdownExport = await waitForDownload(downloadDir, beforeMarkdownExport, {
      extension: ".md",
      contentIncludes: "자동 점검 Markdown",
      label: "Markdown 내보내기",
    });

    const beforeJsonExport = await listFiles(downloadDir);
    await evaluate(page, "document.querySelector('#exportBtn').click(); true");
    const jsonExport = await waitForDownload(downloadDir, beforeJsonExport, {
      extension: ".json",
      contentIncludes: "\"app\": \"NowNote Web\"",
      label: "JSON 내보내기",
    });

    const now = new Date().toISOString();
    const backupPath = path.join(filesDir, "nownote-restore-test.json");
    const backup = {
      app: "NowNote Web",
      version: 2,
      exportedAt: now,
      data: {
        daily: {
          "2026-05-23": {
            date: "2026-05-23",
            content: "JSON 복원 일자 메모",
            updatedAt: now,
          },
        },
        archivedDaily: [],
        deletedTree: [],
        tree: [
          {
            id: "json-restore-topic",
            type: "topic",
            title: "JSON 복원 주제",
            content: "JSON 복원 내용",
            tags: [],
            favorite: false,
            updatedAt: now,
            children: [],
          },
        ],
      },
      settings: null,
    };
    await fs.writeFile(backupPath, JSON.stringify(backup, null, 2), "utf-8");

    const beforeJsonImport = await listFiles(downloadDir);
    await setFileInput(page, "#importInput", backupPath);
    await confirmDialog(page, "JSON 가져오기");
    await waitForDownload(downloadDir, beforeJsonImport, {
      extension: ".json",
      nameIncludes: "nownote-before-import",
      contentIncludes: "\"app\": \"NowNote Web\"",
      label: "JSON 가져오기 전 자동 백업",
    });
    await waitForCondition(
      page,
      `(() => {
        const data = JSON.parse(localStorage.getItem('${STORAGE_KEY}') || '{}');
        return data.tree?.[0]?.title === 'JSON 복원 주제'
          && data.tree?.[0]?.content === 'JSON 복원 내용'
          && data.daily?.['2026-05-23']?.content === 'JSON 복원 일자 메모';
      })()`,
      "JSON 복원 결과",
    );

    console.log("NowNote Web import/export check passed");
    console.log(`- Markdown import/export: ${path.basename(markdownExport)}`);
    console.log(`- JSON export: ${path.basename(jsonExport)}`);
    console.log("- JSON import: automatic pre-import backup and restore verified");
  } finally {
    page?.close();
    browserClient?.close();
    stopBrowserProcess(browser);
    server.close();
  }
}

main().catch((error) => {
  console.error(`NowNote Web import/export check failed: ${error.message}`);
  if (process.env.NOWNOTE_DEBUG_IMPORT_EXPORT) console.error(error.stack);
  process.exit(1);
});
