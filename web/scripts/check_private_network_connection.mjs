/**
 * NowNote 2.3.6 U12 - 사설 네트워크 연결 화면 확인.
 *
 * docs/NOW_2_3_6_PRIVATE_NETWORK_CONNECTION.md 의 판정 절차를 확인한다:
 *   1. /health -> /health/ready -> /api/v1/server 순서로 확인하고, 먼저 실패한 단계에서 멈춘다.
 *   2. 각 단계 실패는 서로 다른 안내 문구를 보인다.
 *   3. 재연결 시 서버 이름이 이전과 다르면 "다른 서버로 보입니다" 경고를 낸다.
 *   4. 정상 연결되면 서버 이름을 저장해 다음 재연결 비교에 쓴다.
 *
 * 하네스 구조는 web/scripts/check_move_node.mjs 와 같다.
 *
 * 실행:
 *   node web/scripts/check_private_network_connection.mjs
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
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nownote-private-net-"));
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
    await waitForCondition(page, "typeof testServerConnection === 'function'", "서버 연결 테스트 함수 로드");

    console.log("NowNote 사설 네트워크 연결 확인");
    console.log("");

    await evaluate(page, `(() => {
      state.settings.server = { ...defaultServerSettings(), mode: "server", url: "http://mock.local" };
      persistSettings();
      renderServerSettings();
      return true;
    })()`);

    // [1] /health 단계에서 실패 - 도달 실패 안내.
    await evaluate(page, `window.__fetchMock = (url) => {
      if (String(url).includes("/health")) return Promise.reject(new TypeError("Failed to fetch"));
      return Promise.reject(new TypeError("unexpected"));
    }; window.fetch = window.__fetchMock; true`);
    await evaluate(page, "testServerConnection()");
    const step1Message = await evaluate(page, "state.settings.server.lastMessage");
    console.log(`[1] /health 실패 안내: ${step1Message}`);
    if (!/도달하지 못했|reach/i.test(step1Message)) failures.push(`1단계(/health) 실패 안내가 아닙니다: ${step1Message}`);

    // [2] /health 통과, /health/ready 실패.
    await evaluate(page, `window.fetch = (url) => {
      const u = String(url);
      if (u.endsWith("/health")) return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: "ok" }) });
      if (u.endsWith("/health/ready")) return Promise.resolve({ ok: false, status: 503 });
      return Promise.reject(new TypeError("unexpected"));
    }; true`);
    await evaluate(page, "testServerConnection()");
    const step2Message = await evaluate(page, "state.settings.server.lastMessage");
    console.log(`[2] /health/ready 실패 안내: ${step2Message}`);
    if (!/준비되지 않았|not ready/i.test(step2Message)) failures.push(`2단계(/health/ready) 실패 안내가 아닙니다: ${step2Message}`);

    // [3] 1·2단계 통과, /api/v1/server 실패.
    await evaluate(page, `window.fetch = (url) => {
      const u = String(url);
      if (u.endsWith("/health")) return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: "ok" }) });
      if (u.endsWith("/health/ready")) return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: "ready" }) });
      if (u.endsWith("/api/v1/server")) return Promise.resolve({ ok: false, status: 500, text: async () => "" });
      return Promise.reject(new TypeError("unexpected"));
    }; true`);
    await evaluate(page, "testServerConnection()");
    const step3Message = await evaluate(page, "state.settings.server.lastMessage");
    console.log(`[3] /api/v1/server 실패 안내: ${step3Message}`);
    if (!/서버 정보를 확인할 수 없|server information/i.test(step3Message)) failures.push(`3단계(/api/v1/server) 실패 안내가 아닙니다: ${step3Message}`);

    // [4] 전부 성공 - 최초 연결이므로 서버 이름을 저장한다.
    await evaluate(page, `window.fetch = (url) => {
      const u = String(url);
      if (u.endsWith("/health")) return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: "ok" }) });
      if (u.endsWith("/health/ready")) return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: "ready" }) });
      if (u.endsWith("/api/v1/server")) return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: "ok", server: "우리집 서버", api_version: "v1", capabilities: {} }) });
      return Promise.reject(new TypeError("unexpected"));
    }; true`);
    await evaluate(page, "testServerConnection()");
    const successState = await evaluate(page, `({
      status: state.settings.server.lastStatus,
      message: state.settings.server.lastMessage,
      knownServerName: state.settings.server.knownServerName,
    })`);
    console.log(`[4] 최초 연결 성공: 상태=${successState.status}, 서버이름=${successState.knownServerName}, 안내=${successState.message}`);
    if (successState.status !== "ok") failures.push(`최초 연결 성공 시 상태가 ok가 아닙니다: ${successState.status}`);
    if (successState.knownServerName !== "우리집 서버") failures.push(`최초 연결 후 서버 이름이 저장되지 않았습니다: ${successState.knownServerName}`);

    // [5] 재연결 시 서버 이름이 다르면 "다른 서버로 보입니다" 경고.
    await evaluate(page, `window.fetch = (url) => {
      const u = String(url);
      if (u.endsWith("/health")) return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: "ok" }) });
      if (u.endsWith("/health/ready")) return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: "ready" }) });
      if (u.endsWith("/api/v1/server")) return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: "ok", server: "다른 서비스", api_version: "v1", capabilities: {} }) });
      return Promise.reject(new TypeError("unexpected"));
    }; true`);
    await evaluate(page, "testServerConnection()");
    const mismatchState = await evaluate(page, `({
      status: state.settings.server.lastStatus,
      message: state.settings.server.lastMessage,
    })`);
    console.log(`[5] 서버 이름 불일치 시 안내: 상태=${mismatchState.status}, 안내=${mismatchState.message}`);
    if (mismatchState.status !== "bad") failures.push(`서버 이름이 바뀌었는데 상태가 bad가 아닙니다: ${mismatchState.status}`);
    if (!/다른 서버로 보입니다|different server/i.test(mismatchState.message)) {
      failures.push(`서버 이름 불일치 안내 문구가 아닙니다: ${mismatchState.message}`);
    }
    if (!mismatchState.message.includes("우리집 서버") || !mismatchState.message.includes("다른 서비스")) {
      failures.push(`불일치 안내에 이전/현재 서버 이름이 함께 나와야 합니다: ${mismatchState.message}`);
    }

    if (failures.length > 0) {
      console.log("");
      console.log("확인 실패:");
      failures.forEach((item) => console.log(`- ${item}`));
      throw new Error(`사설 네트워크 연결 확인 실패 ${failures.length}건`);
    }

    console.log("");
    console.log("NowNote private network connection check passed");
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
  console.error(`NowNote private network connection check failed: ${error.message}`);
  process.exit(1);
});
