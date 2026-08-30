/**
 * NowNote 2.3.6 U7 - 동기화 상태 표시 확인.
 *
 * 로드맵 4번이 요구하는 것을 확인한다.
 *   - 마지막 동기화 시각을 표시한다.
 *   - 동기화 중/성공/실패 상태를 표시한다.
 *   - 실패 시 원인과 다음 조치를 안내한다.
 *
 * 실제 서버가 없는 환경이므로 window.fetch 를 페이지 안에서 몹(mock)으로 바꿔
 * 성공/네트워크 실패/401 실패 상황을 흉내낸다.
 *
 * 확인하는 것:
 *   1. 서버 동기화를 쓰지 않는 모드(로컬 전용)에서 사이드바 표시.
 *   2. 동기화 성공 후 사이드바 표시가 "성공" 상태가 되고, 새로고침(localStorage 재로드) 후에도 유지되는지.
 *   3. 네트워크 실패 시 사이드바(요약)와 설정 화면(전체 문구) 양쪽에 "다음 조치" 안내가 포함되는지.
 *   4. HTTP 401 실패 시 토큰 확인 안내가 포함되는지.
 *   5. HTTP 500 실패 시 재시도 안내가 포함되는지.
 *
 * 하네스 구조는 web/scripts/check_markdown_colors.mjs 와 같다.
 *
 * 실행:
 *   node web/scripts/check_sync_status_indicator.mjs
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
const DEFAULT_TIMEOUT_MS = 20_000;

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

/**
 * 페이지 안에서 돌 준비 코드.
 * 시험용 함수들을 window.__syncCheck 에 붙인다. 앱 코드에는 아무것도 남기지 않는다.
 */
const PAGE_SETUP = String.raw`
(() => {
  function readIndicator() {
    return {
      label: elements.syncStatusBtnLabel ? elements.syncStatusBtnLabel.textContent : "",
      dotClasses: elements.syncStatusDot ? elements.syncStatusDot.className : "",
      title: elements.syncStatusBtn ? (elements.syncStatusBtn.getAttribute("title") || "") : "",
    };
  }

  function readSettingsStatus() {
    return {
      text: elements.serverStatusText.textContent,
      classes: elements.serverStatusText.className,
    };
  }

  function setupServerMode() {
    state.data = defaultData();
    state.settings.server = {
      ...defaultServerSettings(),
      mode: "server",
      url: "http://mock.local",
      token: "",
      userToken: "",
      ownerId: "sync_check_owner",
      deviceId: "sync-check-device",
      autoSync: true,
    };
    persistSettings();
    renderServerSettings();
    return { indicator: readIndicator(), settings: readSettingsStatus() };
  }

  function setupLocalMode() {
    state.settings.server = { ...defaultServerSettings(), mode: "local" };
    persistSettings();
    renderServerSettings();
    return { indicator: readIndicator(), settings: readSettingsStatus() };
  }

  async function runSyncWith(kind) {
    const original = window.fetch;
    window.fetch = async () => {
      if (kind === "success") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ pushed_notes: [], pulled_notes: [], server_time: new Date().toISOString() }),
          text: async () => "",
        };
      }
      if (kind === "network") {
        throw new TypeError("Failed to fetch");
      }
      if (kind === "auth401") {
        return {
          ok: false,
          status: 401,
          text: async () => JSON.stringify({ detail: "invalid token" }),
          json: async () => ({ detail: "invalid token" }),
        };
      }
      if (kind === "server500") {
        return {
          ok: false,
          status: 500,
          text: async () => JSON.stringify({ detail: "internal error" }),
          json: async () => ({ detail: "internal error" }),
        };
      }
      throw new Error("unknown fetch kind: " + kind);
    };
    try {
      await syncWebNotesToServer(t("settings.server.syncing"), { skipFormSave: true, messageKey: "settings.server.syncing" });
    } finally {
      window.fetch = original;
    }
    return {
      indicator: readIndicator(),
      settings: readSettingsStatus(),
      lastStatus: state.settings.server.lastStatus,
      lastMessage: state.settings.server.lastMessage,
      lastSyncedAt: state.settings.server.lastSyncedAt,
    };
  }

  async function simulateReload() {
    await loadSettings();
    applyLanguage();
    return {
      indicator: readIndicator(),
      lastStatus: state.settings.server.lastStatus,
      lastSyncedAt: state.settings.server.lastSyncedAt,
    };
  }

  window.__syncCheck = {
    setupServerMode,
    setupLocalMode,
    runSyncWith,
    simulateReload,
  };
  return true;
})()
`;

async function runOnce() {
  assert(typeof WebSocket === "function", "현재 Node.js 런타임이 WebSocket을 지원하지 않습니다.");

  const browserPath = await findBrowser();
  const { server, port: webPort } = await startStaticServer();
  const debugPort = await freePort();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nownote-sync-status-"));
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
    await waitForCondition(
      page,
      "typeof syncWebNotesToServer === 'function' && typeof elements !== 'undefined' && elements.syncStatusBtn",
      "동기화 상태 표시 요소 로드",
    );

    assert(await evaluate(page, PAGE_SETUP), "시험 준비 코드를 붙이지 못했습니다.");

    console.log("NowNote 동기화 상태 표시 확인");
    console.log("");

    // 1) 로컬 전용 모드 - 사이드바가 중립 표시를 하는지
    const local = await evaluate(page, "window.__syncCheck.setupLocalMode()");
    console.log(`[1] 로컬 전용 모드 사이드바 표시: "${local.indicator.label}"`);
    if (!local.indicator.label || local.indicator.label.includes("실패") || local.indicator.label.includes("성공")) {
      failures.push(`로컬 전용 모드에서 사이드바 표시가 중립적이지 않습니다: "${local.indicator.label}"`);
    }

    // 2) 성공 동기화
    await evaluate(page, "window.__syncCheck.setupServerMode()");
    const success = await evaluate(page, "window.__syncCheck.runSyncWith('success')");
    console.log(`[2] 동기화 성공 - 사이드바: "${success.indicator.label}" (점 클래스: ${success.indicator.dotClasses})`);
    console.log(`    설정 화면: "${success.settings.text}" (클래스: ${success.settings.classes})`);
    if (success.lastStatus !== "ok") failures.push(`동기화 성공 후 lastStatus가 ok가 아닙니다: ${success.lastStatus}`);
    if (!success.indicator.dotClasses.includes("ok")) failures.push(`동기화 성공 후 사이드바 점 색이 ok 상태가 아닙니다: ${success.indicator.dotClasses}`);
    if (!success.lastSyncedAt) failures.push("동기화 성공 후 lastSyncedAt이 기록되지 않았습니다.");

    // 2-1) 새로고침(localStorage 재로드) 후에도 유지되는지
    const reloaded = await evaluate(page, "window.__syncCheck.simulateReload()");
    console.log(`[2-1] 새로고침 후 - 사이드바: "${reloaded.indicator.label}" (점 클래스: ${reloaded.indicator.dotClasses})`);
    if (reloaded.lastStatus !== "ok") failures.push(`새로고침 후 lastStatus가 유지되지 않았습니다: ${reloaded.lastStatus}`);
    if (!reloaded.indicator.dotClasses.includes("ok")) failures.push(`새로고침 후 사이드바 점 색이 유지되지 않았습니다: ${reloaded.indicator.dotClasses}`);
    if (!reloaded.lastSyncedAt) failures.push("새로고침 후 lastSyncedAt이 사라졌습니다.");
    console.log("");

    // 3) 네트워크 실패
    await evaluate(page, "window.__syncCheck.setupServerMode()");
    const network = await evaluate(page, "window.__syncCheck.runSyncWith('network')");
    console.log(`[3] 네트워크 실패 - 사이드바 제목(title): "${network.indicator.title}"`);
    console.log(`    설정 화면: "${network.settings.text}"`);
    if (network.lastStatus !== "bad") failures.push(`네트워크 실패 후 lastStatus가 bad가 아닙니다: ${network.lastStatus}`);
    if (!network.indicator.dotClasses.includes("bad")) failures.push(`네트워크 실패 후 사이드바 점 색이 bad 상태가 아닙니다: ${network.indicator.dotClasses}`);
    if (!/네트워크|network/i.test(network.settings.text)) {
      failures.push(`네트워크 실패 안내가 설정 화면 문구에 없습니다: "${network.settings.text}"`);
    }
    if (!/네트워크|network/i.test(network.indicator.title)) {
      failures.push(`네트워크 실패 안내가 사이드바 title에 없습니다: "${network.indicator.title}"`);
    }
    console.log("");

    // 4) 401 실패 - 토큰 확인 안내
    await evaluate(page, "window.__syncCheck.setupServerMode()");
    const auth = await evaluate(page, "window.__syncCheck.runSyncWith('auth401')");
    console.log(`[4] HTTP 401 실패 - 설정 화면: "${auth.settings.text}"`);
    console.log(`    사이드바 제목(title): "${auth.indicator.title}"`);
    if (!/토큰|token/i.test(auth.settings.text)) {
      failures.push(`401 실패 안내에 토큰 확인 문구가 없습니다: "${auth.settings.text}"`);
    }
    if (!/토큰|token/i.test(auth.indicator.title)) {
      failures.push(`401 실패 안내가 사이드바 title에 없습니다: "${auth.indicator.title}"`);
    }
    console.log("");

    // 5) 500 실패 - 재시도 안내
    await evaluate(page, "window.__syncCheck.setupServerMode()");
    const serverError = await evaluate(page, "window.__syncCheck.runSyncWith('server500')");
    console.log(`[5] HTTP 500 실패 - 설정 화면: "${serverError.settings.text}"`);
    if (!/다시 시도|retry|try again/i.test(serverError.settings.text)) {
      failures.push(`500 실패 안내에 재시도 문구가 없습니다: "${serverError.settings.text}"`);
    }
    console.log("");

    if (failures.length > 0) {
      console.log("확인 실패:");
      failures.forEach((item) => console.log(`- ${item}`));
      throw new Error(`동기화 상태 표시 확인 실패 ${failures.length}건`);
    }

    console.log("NowNote sync status indicator check passed");
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
  console.error(`NowNote sync status indicator check failed: ${error.message}`);
  process.exit(1);
});
