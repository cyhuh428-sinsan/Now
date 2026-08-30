/**
 * NowNote 2.3.6 U8 - 업데이트 안내 확인.
 *
 * 로드맵 5번이 요구하는 것을 확인한다.
 *   - 설치형/앱에서 현재 버전을 표시한다.
 *   - 최신 버전 다운로드 링크를 제공한다.
 *   - 자동 업데이트는 제외하고 안내 기능부터 지원한다.
 *
 * 실제 서버가 없는 환경이므로 window.fetch 를 페이지 안에서 몹(mock)으로 바꿔
 * GET /api/v1/app/release 응답(최신/동일/네트워크 오류)을 흉내낸다.
 *
 * 확인하는 것:
 *   1. 서버 미연결 상태(로컬 전용)에서 "업데이트 확인" 버튼이 비활성화되어 있다.
 *   2. 서버 연결 + 더 높은 버전 응답 -> Web 클라이언트에서 "새 버전" 안내와
 *      release_url 다운로드 링크가 보인다.
 *   3. 서버 연결 + 더 높은 버전 응답 -> 설치형(desktop) 클라이언트에서는
 *      windows_installer 링크도 함께 보인다.
 *   4. 같은 버전 응답 -> "최신 버전입니다" 계열 문구가 보이고 다운로드 링크는 없다.
 *   5. 요청 실패(네트워크 오류) -> 오류 안내 문구가 보인다.
 *
 * 하네스 구조는 web/scripts/check_sync_status_indicator.mjs 와 같다.
 *
 * 실행:
 *   node web/scripts/check_app_update_check.mjs
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
 * 시험용 함수들을 window.__updateCheck 에 붙인다. 앱 코드에는 아무것도 남기지 않는다.
 */
const PAGE_SETUP = String.raw`
(() => {
  function readState() {
    return {
      disabled: elements.checkUpdateBtn ? elements.checkUpdateBtn.disabled : null,
      statusText: elements.updateStatusText ? elements.updateStatusText.textContent : "",
      statusClasses: elements.updateStatusText ? elements.updateStatusText.className : "",
      linksHidden: elements.updateDownloadLinks ? elements.updateDownloadLinks.classList.contains("hidden") : null,
      links: elements.updateDownloadLinks
        ? Array.from(elements.updateDownloadLinks.querySelectorAll("a")).map((a) => a.href)
        : [],
    };
  }

  function setupLocalMode() {
    window.nownoteDesktop = undefined;
    state.settings.server = { ...defaultServerSettings(), mode: "local" };
    persistSettings();
    renderServerSettings();
    return readState();
  }

  function setupServerMode(desktop) {
    window.nownoteDesktop = desktop ? { storage: { read: async () => null, write: async () => {} } } : undefined;
    state.settings.server = {
      ...defaultServerSettings(),
      mode: "server",
      url: "http://mock.local",
      token: "",
      userToken: "",
      ownerId: "update_check_owner",
      deviceId: "update-check-device",
      autoSync: true,
    };
    persistSettings();
    renderServerSettings();
    return readState();
  }

  async function runCheckWith(kind, latestVersion) {
    const original = window.fetch;
    window.fetch = async (url) => {
      if (kind === "network") {
        throw new TypeError("Failed to fetch");
      }
      if (kind === "release") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: "ok",
            latest_version: latestVersion,
            release_tag: "v" + latestVersion,
            release_url: "https://github.com/example/now/releases/tag/v" + latestVersion,
            downloads: {
              windows_installer: "https://github.com/example/now/releases/download/v" + latestVersion + "/NowNote-Setup-" + latestVersion + "-x64.exe",
              android_apk: "https://github.com/example/now/releases/download/v" + latestVersion + "/NowNote-" + latestVersion + ".apk",
            },
          }),
          text: async () => "",
        };
      }
      throw new Error("unknown fetch kind: " + kind);
    };
    try {
      await checkAppUpdate();
    } finally {
      window.fetch = original;
    }
    return readState();
  }

  window.__updateCheck = {
    setupLocalMode,
    setupServerMode,
    runCheckWith,
  };
  return true;
})()
`;

async function runOnce() {
  assert(typeof WebSocket === "function", "현재 Node.js 런타임이 WebSocket을 지원하지 않습니다.");

  const browserPath = await findBrowser();
  const { server, port: webPort } = await startStaticServer();
  const debugPort = await freePort();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nownote-update-check-"));
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
      "typeof checkAppUpdate === 'function' && typeof elements !== 'undefined' && elements.checkUpdateBtn",
      "업데이트 확인 요소 로드",
    );

    assert(await evaluate(page, PAGE_SETUP), "시험 준비 코드를 붙이지 못했습니다.");

    console.log("NowNote 업데이트 안내 확인");
    console.log("");

    // 1) 서버 미연결(로컬 전용) - 버튼 비활성화
    const local = await evaluate(page, "window.__updateCheck.setupLocalMode()");
    console.log(`[1] 로컬 전용 모드 - 버튼 disabled: ${local.disabled}, 안내: "${local.statusText}"`);
    if (local.disabled !== true) {
      failures.push(`로컬 전용 모드에서 업데이트 확인 버튼이 비활성화되지 않았습니다: disabled=${local.disabled}`);
    }
    if (!local.statusText) {
      failures.push("로컬 전용 모드에서 안내 문구가 비어 있습니다.");
    }
    console.log("");

    // 2) 서버 연결 + 더 높은 버전 - Web 클라이언트
    await evaluate(page, "window.__updateCheck.setupServerMode(false)");
    const webNewer = await evaluate(page, "window.__updateCheck.runCheckWith('release', '9.9.9')");
    console.log(`[2] Web + 새 버전(9.9.9) - 버튼 disabled: ${webNewer.disabled}, 안내: "${webNewer.statusText}"`);
    console.log(`    다운로드 링크: ${JSON.stringify(webNewer.links)}`);
    if (webNewer.disabled !== false) failures.push("서버 연결 상태에서 업데이트 확인 버튼이 비활성화되어 있습니다.");
    if (!/9\.9\.9/.test(webNewer.statusText)) failures.push(`새 버전 안내에 버전 번호가 없습니다: "${webNewer.statusText}"`);
    if (webNewer.linksHidden !== false) failures.push("새 버전이 있을 때 다운로드 링크 영역이 숨겨져 있습니다.");
    if (!webNewer.links.some((href) => href.includes("/releases/tag/"))) {
      failures.push(`Web 클라이언트에서 release_url 링크가 보이지 않습니다: ${JSON.stringify(webNewer.links)}`);
    }
    if (webNewer.links.some((href) => href.includes("NowNote-Setup"))) {
      failures.push(`Web 클라이언트에서 설치형 전용 installer 링크가 보이면 안 됩니다: ${JSON.stringify(webNewer.links)}`);
    }
    console.log("");

    // 3) 서버 연결 + 더 높은 버전 - 설치형(desktop) 클라이언트
    await evaluate(page, "window.__updateCheck.setupServerMode(true)");
    const desktopNewer = await evaluate(page, "window.__updateCheck.runCheckWith('release', '9.9.9')");
    console.log(`[3] 설치형 + 새 버전(9.9.9) - 안내: "${desktopNewer.statusText}"`);
    console.log(`    다운로드 링크: ${JSON.stringify(desktopNewer.links)}`);
    if (!desktopNewer.links.some((href) => href.includes("NowNote-Setup"))) {
      failures.push(`설치형 클라이언트에서 windows_installer 링크가 보이지 않습니다: ${JSON.stringify(desktopNewer.links)}`);
    }
    if (!desktopNewer.links.some((href) => href.includes("/releases/tag/"))) {
      failures.push(`설치형 클라이언트에서 release_url 링크가 보이지 않습니다: ${JSON.stringify(desktopNewer.links)}`);
    }
    console.log("");

    // 4) 서버 연결 + 같은 버전 - "최신 버전입니다"
    await evaluate(page, "window.__updateCheck.setupServerMode(false)");
    const sameVersion = await evaluate(page, `window.__updateCheck.runCheckWith('release', ${JSON.stringify(await evaluate(page, "APP_VERSION"))})`);
    console.log(`[4] 같은 버전 - 안내: "${sameVersion.statusText}"`);
    if (!/최신|up to date/i.test(sameVersion.statusText)) {
      failures.push(`같은 버전 응답에 "최신 버전" 계열 문구가 없습니다: "${sameVersion.statusText}"`);
    }
    if (sameVersion.linksHidden !== true) {
      failures.push("같은 버전일 때 다운로드 링크 영역이 숨겨지지 않았습니다.");
    }
    console.log("");

    // 5) 요청 실패 - 오류 안내
    await evaluate(page, "window.__updateCheck.setupServerMode(false)");
    const failed = await evaluate(page, "window.__updateCheck.runCheckWith('network')");
    console.log(`[5] 요청 실패 - 안내: "${failed.statusText}"`);
    if (!failed.statusText || /최신|9\.9\.9/i.test(failed.statusText)) {
      failures.push(`요청 실패 안내가 올바르지 않습니다: "${failed.statusText}"`);
    }
    console.log("");

    if (failures.length > 0) {
      console.log("확인 실패:");
      failures.forEach((item) => console.log(`- ${item}`));
      throw new Error(`업데이트 안내 확인 실패 ${failures.length}건`);
    }

    console.log("NowNote app update check passed");
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
  console.error(`NowNote app update check failed: ${error.message}`);
  process.exit(1);
});
