/**
 * NowNote 2.3.6 U10 - 계층 메모 시각화(지식맵) 확인.
 *
 * 로드맵 2번이 요구하는 것을 확인한다:
 *   1. 주제(레벨1) 하나 + 분류(레벨2) 2개 + 각 분류의 메모(레벨3) 2개씩(총 7개 노드)로
 *      트리를 만들고 지식맵을 열면 그 7개 노드만 그려진다(다른 주제 노드는 안 그려진다).
 *   2. 부모-자식 관계마다 선이 하나씩 있다(엣지 개수 = 노드 수 - 1).
 *   3. 메모 노드를 클릭하면 state.selectedTreeId가 그 노드로 바뀐다.
 *   4. 암호화된 메모는 지도에서 잠금 표시만 보이고 본문이 안 보인다.
 *   5. 주제를 여러 개 만들고 드롭다운을 바꾸면 지도가 그 주제 범위로 다시 그려진다.
 *
 * 하네스 구조는 web/scripts/check_move_node.mjs 와 같다.
 *
 * 실행:
 *   node web/scripts/check_tree_map.mjs
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
  if (process.env.NOWNOTE_DEBUG_TREE_MAP) console.error(`Browser: ${browserPath}`);
  const { server, port: webPort } = await startStaticServer();
  const debugPort = await freePort();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nownote-web-check-"));
  const userDataDir = path.join(tempDir, "profile");

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
    await page.send("Page.navigate", { url: appUrl });
    await waitForCondition(page, "document.readyState === 'complete'", "NowNote Web 로드");
    await waitForCondition(page, "Boolean(document.querySelector('#treeMapBtn'))", "지식맵 버튼");

    // 트리를 만든다:
    //   주제A(레벨1) - 분류A1(레벨2, 메모A1a/A1b) - 분류A2(레벨2, 메모A2a/A2b)  => 7개 노드
    //   주제B(레벨1) - 분류B1(레벨2, 메모B1a 암호화)                            => 범위 제한 확인용, 다른 주제
    const setup = await evaluate(
      page,
      `(() => {
        const topicA = createNode('주제A', '', null, 1);
        const catA1 = createNode('분류A1', '', topicA.id, 2);
        const memoA1a = createNode('메모A1a', '본문A1a', catA1.id, 3);
        const memoA1b = createNode('메모A1b', '본문A1b', catA1.id, 3);
        catA1.children.push(memoA1a, memoA1b);
        const catA2 = createNode('분류A2', '', topicA.id, 2);
        const memoA2a = createNode('메모A2a', '본문A2a', catA2.id, 3);
        const memoA2b = createNode('메모A2b', '본문A2b', catA2.id, 3);
        catA2.children.push(memoA2a, memoA2b);
        topicA.children.push(catA1, catA2);
        state.data.tree.push(topicA);

        const topicB = createNode('주제B', '', null, 1);
        const catB1 = createNode('분류B1', '', topicB.id, 2);
        const memoB1a = createNode('메모B1a', ENCRYPTED_NOTE_PREFIX + btoa(JSON.stringify({ ct: 'x' })), catB1.id, 3);
        catB1.children.push(memoB1a);
        topicB.children.push(catB1);
        state.data.tree.push(topicB);

        persist();
        renderTree();
        return {
          topicAId: topicA.id, catA1Id: catA1.id, catA2Id: catA2.id,
          memoA1aId: memoA1a.id, memoA1bId: memoA1b.id, memoA2aId: memoA2a.id, memoA2bId: memoA2b.id,
          topicBId: topicB.id, catB1Id: catB1.id, memoB1aId: memoB1a.id,
        };
      })()`,
    );

    // [검증 1] 주제A로 지식맵을 열면 주제A 서브트리 7개 노드만 그려진다.
    await evaluate(page, `(() => { state.treeMapTopicId = '${setup.topicAId}'; openTreeMap(); return true; })()`);
    await waitForCondition(
      page,
      "!document.querySelector('#treeMapView')?.classList.contains('hidden')",
      "지식맵 팝오버 열림",
    );

    const scopeCheck = await evaluate(
      page,
      `(() => {
        const nodeButtons = Array.from(document.querySelectorAll('#treeMapCanvas [data-node-id]'));
        const lines = document.querySelectorAll('#treeMapCanvas svg line');
        return {
          nodeCount: nodeButtons.length,
          lineCount: lines.length,
          ids: nodeButtons.map((btn) => btn.dataset.nodeId),
        };
      })()`,
    );
    assert(scopeCheck.nodeCount === 7, `주제A 서브트리는 7개 노드여야 합니다 (실제: ${scopeCheck.nodeCount}).`);
    assert(scopeCheck.lineCount === 6, `엣지 개수는 노드수-1=6개여야 합니다 (실제: ${scopeCheck.lineCount}).`);
    const expectedIds = [
      setup.topicAId, setup.catA1Id, setup.catA2Id,
      setup.memoA1aId, setup.memoA1bId, setup.memoA2aId, setup.memoA2bId,
    ];
    assert(
      expectedIds.every((id) => scopeCheck.ids.includes(id)),
      `주제A의 7개 노드가 모두 그려져야 합니다 (실제: ${JSON.stringify(scopeCheck.ids)}).`,
    );
    assert(
      !scopeCheck.ids.includes(setup.topicBId) && !scopeCheck.ids.includes(setup.catB1Id) && !scopeCheck.ids.includes(setup.memoB1aId),
      "주제B의 노드는 지도에 그려지면 안 됩니다(범위 제한).",
    );

    // [검증 2] 메모 노드를 클릭하면 state.selectedTreeId가 바뀐다.
    await evaluate(
      page,
      `(() => {
        document.querySelector('[data-node-id="${setup.memoA1aId}"]').click();
        return true;
      })()`,
    );
    const selectedAfterClick = await evaluate(page, "state.selectedTreeId");
    assert(
      selectedAfterClick === setup.memoA1aId,
      `메모 클릭 후 state.selectedTreeId가 그 노드여야 합니다 (실제: ${selectedAfterClick}).`,
    );

    // [검증 3] 주제B로 전환하면 암호화된 메모가 잠금 표시만 보이고 본문은 없다.
    await evaluate(
      page,
      `(() => {
        openTreeMap();
        const select = document.querySelector('#treeMapTopicSelect');
        select.value = '${setup.topicBId}';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`,
    );
    const topicBCheck = await evaluate(
      page,
      `(() => {
        const nodeButtons = Array.from(document.querySelectorAll('#treeMapCanvas [data-node-id]'));
        const ids = nodeButtons.map((btn) => btn.dataset.nodeId);
        const encryptedButton = document.querySelector('[data-node-id="${setup.memoB1aId}"]');
        return {
          nodeCount: nodeButtons.length,
          ids,
          hasLock: Boolean(encryptedButton && encryptedButton.querySelector('.tree-map-lock')),
          htmlHasBody: Boolean(encryptedButton) && encryptedButton.textContent.includes('NOW_ENCRYPTED_V1'),
        };
      })()`,
    );
    assert(topicBCheck.nodeCount === 3, `주제B 서브트리는 3개 노드여야 합니다 (실제: ${topicBCheck.nodeCount}).`);
    assert(
      !topicBCheck.ids.includes(setup.topicAId) && !topicBCheck.ids.includes(setup.memoA1aId),
      "주제 전환 후 주제A의 노드는 지도에 남아 있으면 안 됩니다.",
    );
    assert(topicBCheck.hasLock, "암호화된 메모 노드는 잠금 표시가 있어야 합니다.");
    assert(!topicBCheck.htmlHasBody, "암호화된 메모의 본문(암호문)이 지도에 노출되면 안 됩니다.");

    console.log("NowNote Web tree-map check passed");
    console.log("- 주제 하나의 서브트리만 렌더링된다 (범위 제한).");
    console.log("- 부모-자식 관계마다 선이 하나씩 있다 (엣지 = 노드수 - 1).");
    console.log("- 메모 노드 클릭 시 state.selectedTreeId가 바뀐다.");
    console.log("- 주제를 바꾸면 지도가 해당 주제 범위로 다시 그려진다.");
    console.log("- 암호화된 메모는 잠금 표시만 보이고 본문이 노출되지 않는다.");
  } finally {
    page?.close();
    browserClient?.close();
    stopBrowserProcess(browser);
    server.close();
  }
}

main().catch((error) => {
  console.error(`NowNote Web tree-map check failed: ${error.message}`);
  if (process.env.NOWNOTE_DEBUG_TREE_MAP) console.error(error.stack);
  process.exit(1);
});
