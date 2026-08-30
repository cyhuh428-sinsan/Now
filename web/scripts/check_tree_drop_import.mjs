/**
 * 트리 목록에 텍스트 파일을 드래그 앤 드롭하면 현재 선택 위치에 메모가 생기는지 확인한다.
 *
 * 확인하는 것:
 *   1. .txt 파일을 떨어뜨리면 가져오기 대화상자가 뜨고, 선택된 주제가 있으면
 *      기본값이 "current-topic"(주제 아래)으로 미리 골라져 있다.
 *   2. 확인을 누르면 실제로 그 주제 아래에 메모가 생긴다.
 *   3. 크기 상한을 넘는 파일은 가져오지 않고 안내만 띄운다.
 *   4. 지원하지 않는 확장자는 가져오지 않고 안내만 띄운다.
 *
 * 실제 OS 드래그가 아니라 CDP로 합성 drop 이벤트(dataTransfer.files/types만 흉내)를
 * dispatch한다 - 코드가 실제로 읽는 것이 그 두 값뿐이라 충분하다.
 *
 * 하네스 구조는 web/scripts/check_move_node.mjs 와 같다.
 *
 * 실행:
 *   node web/scripts/check_tree_drop_import.mjs
 */
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

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
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
      const filePath = path.resolve(ROOT, requested.replace(/^\/+/, ""));
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

async function waitForPageTarget(debugPort, webPort) {
  const deadline = Date.now() + DEFAULT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const targets = await fetchJson(`http://127.0.0.1:${debugPort}/json`, 2_000).catch(() => []);
    const target = targets.find((item) => item.type === "page" && item.url.includes(`127.0.0.1:${webPort}`))
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
    const detail = result.exceptionDetails.exception?.description
      || result.exceptionDetails.exception?.value
      || result.exceptionDetails.text
      || "Runtime.evaluate failed";
    throw new Error(detail);
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

function browserArgs(debugPort, userDataDir, appUrl) {
  return [
    "--headless=new",
    `--remote-debugging-port=${debugPort}`,
    "--remote-allow-origins=*",
    `--user-data-dir=${userDataDir}`,
    "--window-size=1280,900",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
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

async function runOnce() {
  assert(typeof WebSocket === "function", "현재 Node.js 런타임이 WebSocket을 지원하지 않습니다.");

  const browserPath = await findBrowser();
  const { server, port: webPort } = await startStaticServer();
  const debugPort = await freePort();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nownote-drop-import-"));
  const appUrl = `http://127.0.0.1:${webPort}/index.html`;
  const browser = spawn(browserPath, browserArgs(debugPort, tempDir, appUrl), {
    env: { ...process.env, NOWNOTE_HEADLESS_CHECK: "1" },
    stdio: ["ignore", "ignore", "pipe"],
  });

  let browserClient = null;
  const failures = [];
  try {
    browser.stderr.on("data", () => {});
    const target = await waitForPageTarget(debugPort, webPort);
    browserClient = await CdpClient.connect(target.webSocketDebuggerUrl);
    const page = { send: (method, params = {}) => browserClient.send(method, params) };
    await delay(300);
    await page.send("Runtime.enable");
    await waitForCondition(page, "document.readyState === 'complete'", "NowNote Web 로드");
    await waitForCondition(page, "typeof initializeTreeDropImport === 'function' && elements.treePanel", "드롭 가져오기 초기화");

    console.log("NowNote 트리 드래그 앤 드롭 가져오기 확인");
    console.log("");

    // 주제 하나를 만들고 선택한다.
    const setup = await evaluate(page, `(() => {
      const topic = createNode('드롭 테스트 주제', '', null, 1);
      state.data.tree.push(topic);
      persist();
      renderTree();
      selectTreeNode(topic.id);
      return { topicId: topic.id };
    })()`);

    // [1] .txt 파일을 떨어뜨리면 대화상자가 뜨고 "current-topic"이 기본 선택된다.
    const afterDrop = await evaluate(page, `(() => {
      const file = new File(['드롭으로 들어온 본문'], 'dropped.txt', { type: 'text/plain' });
      const evt = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(evt, 'dataTransfer', { value: { types: ['Files'], files: [file] } });
      elements.treePanel.dispatchEvent(evt);
      return true;
    })()`);
    await waitForCondition(page, "!elements.markdownImportOptionsDialog.classList.contains('hidden')", "가져오기 대화상자 열림");
    const selectedKey = await evaluate(page, `document.querySelector('input[name="markdownImportDestination"]:checked')?.value`);
    console.log(`[1] 드롭 후 대화상자 기본 선택: ${selectedKey}`);
    if (selectedKey !== "current-topic") failures.push(`드롭 시 기본 선택이 "current-topic"이어야 합니다 (실제: ${selectedKey}).`);

    // [2] 확인을 누르면 주제 아래에 메모가 생긴다.
    await evaluate(page, `document.querySelector('#markdownImportOptionsOkBtn').click(); true`);
    await delay(300);
    const nodeCheck = await evaluate(page, `(() => {
      const topic = findTreeNode(state.data.tree, '${setup.topicId}');
      const child = topic.children[0];
      return { childCount: topic.children.length, childTitle: child?.title, childContent: child?.content };
    })()`);
    console.log(`[2] 주제 아래 자식 개수: ${nodeCheck.childCount}, 제목: ${nodeCheck.childTitle}`);
    if (nodeCheck.childCount !== 1) failures.push(`드롭한 파일이 주제 아래에 메모로 들어가지 않았습니다 (자식 수: ${nodeCheck.childCount}).`);
    if (!nodeCheck.childContent?.includes("드롭으로 들어온 본문")) {
      failures.push(`생성된 메모 내용이 드롭한 파일 내용을 담고 있지 않습니다: ${nodeCheck.childContent}`);
    }

    // [3] 크기 상한을 넘는 파일은 가져오지 않고 안내만 띄운다.
    const beforeBigDropCount = await evaluate(page, `findTreeNode(state.data.tree, '${setup.topicId}').children.length`);
    await evaluate(page, `(() => {
      const bigContent = 'x'.repeat(2 * 1024 * 1024 + 10);
      const file = new File([bigContent], 'big.txt', { type: 'text/plain' });
      const evt = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(evt, 'dataTransfer', { value: { types: ['Files'], files: [file] } });
      elements.treePanel.dispatchEvent(evt);
      return true;
    })()`);
    await delay(300);
    const afterBigDropCount = await evaluate(page, `findTreeNode(state.data.tree, '${setup.topicId}').children.length`);
    const toast = await evaluate(page, `elements.toastRegion.lastElementChild?.textContent || ''`);
    console.log(`[3] 큰 파일 드롭 후 자식 개수 변화 없음: ${beforeBigDropCount === afterBigDropCount}, 안내: ${toast}`);
    if (beforeBigDropCount !== afterBigDropCount) failures.push("크기 상한을 넘는 파일이 가져와졌습니다.");
    if (!/너무 큽니다|too large/i.test(toast)) failures.push(`크기 초과 안내 문구가 없습니다: ${toast}`);

    // [4] 지원하지 않는 확장자는 가져오지 않고 안내만 띄운다.
    await evaluate(page, `(() => {
      const file = new File(['본문'], 'image.png', { type: 'image/png' });
      const evt = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(evt, 'dataTransfer', { value: { types: ['Files'], files: [file] } });
      elements.treePanel.dispatchEvent(evt);
      return true;
    })()`);
    await delay(300);
    const afterPngDropCount = await evaluate(page, `findTreeNode(state.data.tree, '${setup.topicId}').children.length`);
    const toast2 = await evaluate(page, `elements.toastRegion.lastElementChild?.textContent || ''`);
    console.log(`[4] 지원하지 않는 확장자 드롭 후 자식 개수 변화 없음: ${afterBigDropCount === afterPngDropCount}, 안내: ${toast2}`);
    if (afterBigDropCount !== afterPngDropCount) failures.push("지원하지 않는 확장자 파일이 가져와졌습니다.");
    if (!/지원하지 않는|Unsupported/i.test(toast2)) failures.push(`지원하지 않는 형식 안내 문구가 없습니다: ${toast2}`);

    if (failures.length > 0) {
      console.log("");
      console.log("확인 실패:");
      failures.forEach((item) => console.log(`- ${item}`));
      throw new Error(`트리 드래그 앤 드롭 가져오기 확인 실패 ${failures.length}건`);
    }

    console.log("");
    console.log("NowNote tree drop import check passed");
  } finally {
    browserClient?.close();
    stopBrowserProcess(browser);
    server.close();
    await delay(300);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await runOnce();
      return;
    } catch (error) {
      lastError = error;
      const transient = /CDP socket closed|Target crashed|fetch failed/i.test(error.message || "");
      if (!transient || attempt === 3) break;
      await delay(500);
    }
  }
  throw lastError;
}

main().catch((error) => {
  console.error(`NowNote tree drop import check failed: ${error.message}`);
  process.exit(1);
});
