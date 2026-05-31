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

async function waitForPageTarget(debugPort, webPort) {
  const deadline = Date.now() + DEFAULT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const targets = await waitForJson(`http://127.0.0.1:${debugPort}/json`, 2_000);
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
  if (process.env.NOWNOTE_DEBUG_POLICY_CHECK) console.error(`Browser: ${browserPath}`);
  const { server, port: webPort } = await startStaticServer();
  const debugPort = await freePort();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nownote-policy-check-"));
  const appUrl = `http://127.0.0.1:${webPort}/index.html`;
  const browser = spawn(browserPath, browserArgs(debugPort, tempDir, appUrl), {
    env: { ...process.env, NOWNOTE_HEADLESS_CHECK: "1" },
    stdio: ["ignore", "ignore", "pipe"],
  });

  let browserClient = null;
  let page = null;
  try {
    browser.stderr.on("data", () => {});
    const target = await waitForPageTarget(debugPort, webPort);
    browserClient = await CdpClient.connect(target.webSocketDebuggerUrl);
    page = { send: (method, params = {}) => browserClient.send(method, params) };
    await page.send("Runtime.enable");
    await waitForCondition(page, "document.readyState === 'complete'", "NowNote Web 로드");
    await waitForCondition(page, "Boolean(document.querySelector('#addRootBtn') && typeof buildServerSyncNotes === 'function')", "정책 함수 로드");

    const result = await evaluate(page, `
      (async () => {
        const server = {
          ...defaultServerSettings(),
          mode: "server",
          url: "https://example.invalid",
          ownerId: "policy_user",
          deviceId: "policy_device",
          autoSync: true,
          lastSyncedAt: new Date(Date.now() - 60000).toISOString(),
          conflicts: [],
        };
        state.settings.server = server;
        state.data = defaultData();
        const now = new Date().toISOString();
        const local = {
          id: "local-private",
          title: "Local private",
          content: "private body",
          parentId: null,
          level: 1,
          children: [],
          status: "active",
          syncState: "pending",
          shared: false,
          serverShared: false,
          unsharedAt: null,
          favorite: false,
          tags: [],
          createdAt: now,
          updatedAt: now,
        };
        const shared = {
          ...local,
          id: "shared-note",
          title: "Shared note",
          shared: true,
          serverShared: false,
        };
        const unsharedRemote = {
          ...local,
          id: "unshared-remote",
          title: "Unshared remote",
          shared: false,
          serverShared: true,
          unsharedAt: now,
        };
        const deleted = {
          ...local,
          id: "deleted-local",
          title: "Deleted local",
          status: "deleted",
          syncState: "local",
          deletedAt: now,
        };
        state.data.tree = [local, shared, unsharedRemote];
        state.data.deletedTree = [deleted];
        const syncNotes = buildServerSyncNotes(server);
        const pendingCount = countPendingSyncNotes();
        const localExcluded = !syncNotes.some((note) => note.local_id === "local-private");
        const sharedIncluded = syncNotes.some((note) => note.local_id === "shared-note" && !note.deleted_at);
        const unshareTombstone = syncNotes.some((note) => note.local_id === "unshared-remote" && Boolean(note.deleted_at));
        const deletedExcluded = !syncNotes.some((note) => note.local_id === "deleted-local");
        const pendingOnlyServerTargets = pendingCount === 2;

        const conflictLocal = { ...shared, id: "conflict-note", syncState: "pending", updatedAt: "2026-06-01T00:00:00.000Z" };
        state.data.tree.push(conflictLocal);
        const applied = applyPulledTreeNote({
          local_id: "conflict-note",
          note_type: "tree",
          title: "Server conflict",
          content: "server body",
          parent_local_id: null,
          level: 1,
          tags: "",
          client_updated_at: "2026-05-31T00:00:00.000Z",
          updated_at: "2026-05-31T00:00:00.000Z",
          deleted_at: null,
        });
        const conflictRecorded = applied === false && state.settings.server.conflicts.some((item) => item.localId === "conflict-note");

        const encrypted = {
          ...shared,
          id: "encrypted-note",
          title: "Encrypted",
          content: "NOW_ENCRYPTED_V1:" + btoa(JSON.stringify({ salt: "s", iv: "i", data: "d" })),
        };
        state.data.tree.push(encrypted);
        state.selectedTreeId = "encrypted-note";
        document.querySelector('#serverModeSelect').value = "server";
        document.querySelector('#serverUrlInput').value = "https://example.invalid";
        document.querySelector('#ownerIdInput').value = "policy_user";
        document.querySelector('#deviceIdInput').value = "policy_device";
        await createSelectedNoteAnalysisJob();
        const encryptedAnalysisBlocked = state.settings.server.lastMessageKey === "settings.server.analysis.encryptedNote";

        return {
          localExcluded,
          sharedIncluded,
          unshareTombstone,
          deletedExcluded,
          pendingOnlyServerTargets,
          conflictRecorded,
          encryptedAnalysisBlocked,
        };
      })()
    `);

    const failed = Object.entries(result || {}).filter(([, value]) => value !== true);
    assert(failed.length === 0, `정책 검증 실패: ${failed.map(([key]) => key).join(", ")}`);
    console.log("NowNote desktop client policy check passed");
    console.log("- Private local notes are excluded from server sync");
    console.log("- Shared notes and unshare tombstones are selected correctly");
    console.log("- Deleted local trash items are excluded from pending sync");
    console.log("- Conflicts and encrypted-note analysis guards are active");
  } finally {
    browserClient?.close();
    stopBrowserProcess(browser);
    server.close();
    await delay(300);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((error) => {
  console.error(`NowNote desktop client policy check failed: ${error.message}`);
  if (process.env.NOWNOTE_DEBUG_POLICY_CHECK) console.error(error.stack);
  process.exit(1);
});
