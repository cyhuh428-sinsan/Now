/**
 * NowNote 2.3.6 U6 - 문서 이동 화면 확인.
 *
 * 로드맵 7번이 요구하는 것을 확인한다:
 *   1. 레벨 1(주제) 노드를 다른 레벨 1(주제) 노드 아래로 옮기면 레벨 2(분류)가 되고,
 *      그 자손들의 레벨도 따라 올라간다 (로드맵 예시: WSL 배포·테스트 가이드 -> 개발노트).
 *   2. 3단계를 넘기게 되는 목적지는 후보 목록에 뜨지 않는다.
 *   3. 자기 자신이나 자신의 자손을 목적지로 고를 수 없다.
 *   4. 이동 후 자동으로 그 노드가 선택되고 조상이 펼쳐진다.
 *
 * 하네스 구조는 web/scripts/check_import_export.mjs 와 같다.
 *
 * 실행:
 *   node web/scripts/check_move_node.mjs
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

async function readTreeState(page) {
  return evaluate(
    page,
    `(() => {
      const data = JSON.parse(localStorage.getItem('${STORAGE_KEY}') || '{}');
      return data.tree || [];
    })()`,
  );
}

function flattenState(nodes) {
  const flat = [];
  const walk = (list) => (list || []).forEach((node) => {
    flat.push(node);
    walk(node.children);
  });
  walk(nodes);
  return flat;
}

async function main() {
  assert(typeof WebSocket === "function", "현재 Node.js 런타임이 WebSocket을 지원하지 않습니다.");

  const browserPath = await findBrowser();
  if (process.env.NOWNOTE_DEBUG_MOVE_NODE) console.error(`Browser: ${browserPath}`);
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
    await waitForCondition(page, "Boolean(document.querySelector('#moveNodeBtn'))", "이동 버튼");

    // 로드맵 예시 트리를 만든다: 주제 "개발노트"(그 아래 분류 "도구"), 주제 "WSL 배포·테스트 가이드"
    // (그 아래 메모 "1단계" -> 메모 대신 분류를 하나 더 넣어 자손 깊이 2를 만든다).
    const setup = await evaluate(
      page,
      `(() => {
        const devNotes = createNode('개발노트', '', null, 1);
        const tools = createNode('도구', '', devNotes.id, 2);
        devNotes.children.push(tools);
        state.data.tree.push(devNotes);

        const wsl = createNode('WSL 배포·테스트 가이드', '', null, 1);
        const wslCategory = createNode('설치', '', wsl.id, 2);
        const wslMemo = createNode('설치 절차', '본문', wslCategory.id, 3);
        wslCategory.children.push(wslMemo);
        wsl.children.push(wslCategory);
        state.data.tree.push(wsl);

        persist();
        renderTree();
        return { devNotesId: devNotes.id, toolsId: tools.id, wslId: wsl.id, wslCategoryId: wslCategory.id, wslMemoId: wslMemo.id };
      })()`,
    );

    // [검증 1] 레벨 1(주제) "WSL 배포·테스트 가이드"의 이동 가능한 목적지 후보 확인.
    //   - 자기 자신/자손(wslCategory)은 후보에 없어야 한다.
    //   - "도구"(레벨 2)는 depth(=3, wsl 자신 포함 3단계) + level(2) = 5 > 3 이라 후보에서 빠져야 한다.
    //   - "개발노트"(레벨 1)는 depth(3) + level(1) = 4 > 3 이라 역시 후보에서 빠져야 한다.
    //     (WSL 서브트리 깊이가 3이라 어떤 레벨 1/2 목적지도 3단계를 넘기게 되어 후보가 없어야 한다.)
    const noCandidateCheck = await evaluate(
      page,
      `(() => {
        const wsl = findTreeNode(state.data.tree, '${setup.wslId}');
        const candidates = moveNodeDestinationCandidates(wsl).map((c) => c.id);
        return {
          depth: subtreeDepth(wsl),
          candidates,
          hasSelfOrDescendant: candidates.includes(wsl.id) || candidates.includes('${setup.wslCategoryId}'),
        };
      })()`,
    );
    assert(noCandidateCheck.depth === 3, `WSL 서브트리 깊이가 3이어야 합니다 (실제: ${noCandidateCheck.depth}).`);
    assert(noCandidateCheck.candidates.length === 0, `깊이 3인 서브트리는 목적지 후보가 없어야 합니다 (실제: ${JSON.stringify(noCandidateCheck.candidates)}).`);
    assert(!noCandidateCheck.hasSelfOrDescendant, "자기 자신/자손이 후보에 포함되면 안 됩니다.");

    // [검증 2] 이제 WSL 서브트리를 얕게 만든다(자손 메모를 지워 깊이 1로) - 로드맵 예시처럼
    // 레벨 1 "WSL 배포·테스트 가이드"를 다른 레벨 1 "개발노트" 아래로 옮길 수 있어야 한다.
    await evaluate(
      page,
      `(() => {
        const wsl = findTreeNode(state.data.tree, '${setup.wslId}');
        wsl.children = [];
        persist();
        renderTree();
        return true;
      })()`,
    );

    const candidatesAfterFlatten = await evaluate(
      page,
      `(() => {
        const wsl = findTreeNode(state.data.tree, '${setup.wslId}');
        return moveNodeDestinationCandidates(wsl).map((c) => c.id);
      })()`,
    );
    assert(
      candidatesAfterFlatten.includes(setup.devNotesId) && candidatesAfterFlatten.includes(setup.toolsId),
      `얕아진 WSL 문서는 '개발노트'와 '도구' 모두를 후보로 가져야 합니다 (실제: ${JSON.stringify(candidatesAfterFlatten)}).`,
    );

    // 실제 화면 흐름(로드맵 예시)을 검증한다: WSL 문서를 선택하고 #moveNodeBtn을 눌러
    // 이동 다이얼로그를 연 뒤, "개발노트"를 목적지로 골라 확인을 누른다.
    await evaluate(page, `(() => { selectTreeNode('${setup.wslId}'); return true; })()`);
    await evaluate(page, "document.querySelector('#moveNodeBtn').click(); true");
    await waitForCondition(
      page,
      "!document.querySelector('#moveNodeDialog')?.classList.contains('hidden')",
      "이동 다이얼로그",
    );
    const dialogHadDestination = await evaluate(
      page,
      `(() => {
        const select = document.querySelector('#moveNodeDestinationSelect');
        return Array.from(select.options).some((option) => option.value === '${setup.devNotesId}');
      })()`,
    );
    assert(dialogHadDestination, "이동 다이얼로그의 목적지 목록에 '개발노트'가 있어야 합니다.");
    await evaluate(
      page,
      `(() => {
        const select = document.querySelector('#moveNodeDestinationSelect');
        select.value = '${setup.devNotesId}';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`,
    );
    const previewText = await evaluate(page, "document.querySelector('#moveNodePreview').textContent");
    assert(previewText.includes("개발노트") && previewText.includes("WSL 배포"), `이동 후 위치 미리보기가 새 경로를 보여줘야 합니다 (실제: ${previewText}).`);
    await evaluate(page, "document.querySelector('#moveNodeOkBtn').click(); true");
    await waitForCondition(
      page,
      "document.querySelector('#moveNodeDialog')?.classList.contains('hidden')",
      "이동 다이얼로그 닫힘",
    );

    const moveResult = await evaluate(
      page,
      `(() => {
        const wsl = findTreeNode(state.data.tree, '${setup.wslId}');
        const devNotes = findTreeNode(state.data.tree, '${setup.devNotesId}');
        return {
          level: wsl.level,
          parentId: wsl.parentId,
          selectedId: state.selectedTreeId,
          devNotesExpanded: state.expandedTreeIds.has(devNotes.id),
        };
      })()`,
    );
    assert(moveResult.level === 2, `이동한 노드의 레벨은 2여야 합니다 (실제: ${moveResult.level}).`);
    assert(moveResult.parentId === setup.devNotesId, "이동한 노드의 parentId가 새 부모여야 합니다.");
    assert(moveResult.selectedId === setup.wslId, "이동 후 그 노드가 선택되어야 합니다.");
    assert(moveResult.devNotesExpanded, "이동 후 새 부모가 펼쳐져야 합니다.");

    const treeAfterMove = await readTreeState(page);
    const flatAfterMove = flattenState(treeAfterMove);
    const devNotesAfter = flatAfterMove.find((node) => node.id === setup.devNotesId);
    assert(
      devNotesAfter.children.some((child) => child.id === setup.wslId),
      "'개발노트'의 children에 옮긴 WSL 문서가 있어야 합니다.",
    );
    assert(
      !state_wasTopLevel(treeAfterMove, setup.wslId),
      "이동한 문서는 더 이상 최상위 트리에 있으면 안 됩니다.",
    );

    function state_wasTopLevel(tree, id) {
      return tree.some((node) => node.id === id);
    }

    // [검증 3] 자손을 다시 만들어 레벨 재계산이 자손까지 전파되는지 확인한다.
    const descendantSetup = await evaluate(
      page,
      `(() => {
        const wsl = findTreeNode(state.data.tree, '${setup.wslId}');
        const memo = createNode('설치 절차', '본문', wsl.id, wsl.level + 1);
        wsl.children.push(memo);
        persist();
        renderTree();
        return { memoId: memo.id, memoLevel: memo.level };
      })()`,
    );
    assert(descendantSetup.memoLevel === 3, `새로 만든 자손 메모는 레벨 3이어야 합니다 (실제: ${descendantSetup.memoLevel}).`);

    // 이번엔 wsl(현재 레벨 2, 자손 깊이 2)을 최상위 주제 "도구" 밑으로 옮기면
    // wsl은 레벨 3이 되고 자손 memo는 레벨 4가 되어 3단계 제한을 넘긴다 -> 후보에 없어야 한다.
    const blockedCandidates = await evaluate(
      page,
      `(() => {
        const wsl = findTreeNode(state.data.tree, '${setup.wslId}');
        const tools = findTreeNode(state.data.tree, '${setup.toolsId}');
        const candidates = moveNodeDestinationCandidates(wsl).map((c) => c.id);
        return { depth: subtreeDepth(wsl), hasTools: candidates.includes(tools.id) };
      })()`,
    );
    assert(blockedCandidates.depth === 2, `wsl의 서브트리 깊이는 2여야 합니다 (실제: ${blockedCandidates.depth}).`);
    assert(!blockedCandidates.hasTools, "레벨 2인 '도구' 아래로 옮기면 3단계를 넘기므로 후보에 없어야 합니다.");

    // 자손의 레벨도 부모를 따라 갱신되는지 확인(동일 레벨로 다시 이동시켜 delta=0 케이스가 아닌
    // 다른 레벨 1 목적지로 이동시켜 delta가 적용되는지 본다). 새 레벨 1 주제를 만들어 이동한다.
    const anotherTopicSetup = await evaluate(
      page,
      `(() => {
        const topic = createNode('참고자료', '', null, 1);
        state.data.tree.push(topic);
        persist();
        renderTree();
        return { topicId: topic.id };
      })()`,
    );
    const descendantLevelResult = await evaluate(
      page,
      `(() => {
        const wsl = findTreeNode(state.data.tree, '${setup.wslId}');
        const topic = findTreeNode(state.data.tree, '${anotherTopicSetup.topicId}');
        const ok = moveTreeNodeTo(wsl, topic);
        persist();
        const memo = findTreeNode(state.data.tree, '${descendantSetup.memoId}');
        return { ok, wslLevel: wsl.level, memoLevel: memo.level };
      })()`,
    );
    assert(descendantLevelResult.ok, "두 번째 이동도 성공해야 합니다.");
    assert(descendantLevelResult.wslLevel === 2, `wsl의 레벨은 2여야 합니다 (실제: ${descendantLevelResult.wslLevel}).`);
    assert(
      descendantLevelResult.memoLevel === 3,
      `자손 메모의 레벨도 부모를 따라 3이어야 합니다 (실제: ${descendantLevelResult.memoLevel}).`,
    );

    console.log("NowNote Web move-node check passed");
    console.log(`- Depth-3 subtree has no valid destination candidates (roadmap 3-level guard).`);
    console.log(`- Level 1 topic moved under another level 1 topic became level 2 (roadmap example).`);
    console.log(`- Descendant levels cascade with the moved node.`);
    console.log(`- Move auto-selects the node and expands its new parent.`);
  } finally {
    page?.close();
    browserClient?.close();
    stopBrowserProcess(browser);
    server.close();
  }
}

main().catch((error) => {
  console.error(`NowNote Web move-node check failed: ${error.message}`);
  if (process.env.NOWNOTE_DEBUG_MOVE_NODE) console.error(error.stack);
  process.exit(1);
});
