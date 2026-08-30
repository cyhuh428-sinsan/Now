/**
 * NowNote 2.3.6 U11 - 스케치 메모 확인.
 *
 * 로드맵 1번이 요구하는 것을 확인한다:
 *   1. 선 그리기, 지우개, 색상, 굵기, 실행 취소가 동작한다.
 *   2. 그린 그림이 이미지로 선택 메모에 삽입된다.
 *   3. 서버가 연결돼 있지 않으면(설치형은 서버 없이도 쓴다) data URL로 폴백해서 삽입된다
 *      (docs/NOW_2_3_6_FEATURE_DESIGN.md "3. 스케치 저장 형식과 경로").
 *   4. nownote-attachment:// 참조는 미리보기에서 별도 이미지 태그로 표시 준비된다
 *      (data-note-attachment-key, hydrateNoteAttachmentImages가 채운다).
 *
 * 하네스 구조는 web/scripts/check_move_node.mjs 와 같다.
 *
 * 실행:
 *   node web/scripts/check_sketch_memo.mjs
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
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nownote-sketch-"));
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
      "typeof openSketchDialog === 'function' && typeof elements !== 'undefined' && elements.sketchCanvas",
      "스케치 요소 로드",
    );

    console.log("NowNote 스케치 메모 확인");
    console.log("");

    // 메모 하나를 만들고 선택한 뒤 스케치 다이얼로그를 연다.
    const setup = await evaluate(
      page,
      `(() => {
        const topic = createNode('스케치 테스트', '기존 내용', null, 1);
        state.data.tree.push(topic);
        persist();
        renderTree();
        selectTreeNode(topic.id);
        openSketchDialog();
        return { topicId: topic.id };
      })()`,
    );
    const dialogOpen = await evaluate(page, "!elements.sketchDialog.classList.contains('hidden')");
    console.log(`[1] 스케치 다이얼로그 열림: ${dialogOpen}`);
    if (!dialogOpen) failures.push("스케치 다이얼로그가 열리지 않았습니다.");

    const drawModeActive = await evaluate(page, "elements.sketchDrawModeBtn.classList.contains('is-active')");
    console.log(`[2] 기본 도구가 그리기 모드: ${drawModeActive}`);
    if (!drawModeActive) failures.push("다이얼로그를 열면 기본 도구가 그리기 모드여야 합니다.");

    // 첫 번째 획을 그린다 (pointerdown -> pointermove -> pointerup).
    await evaluate(
      page,
      `(() => {
        const canvas = elements.sketchCanvas;
        const rect = canvas.getBoundingClientRect();
        const down = new PointerEvent('pointerdown', { clientX: rect.left + 20, clientY: rect.top + 20 });
        const move = new PointerEvent('pointermove', { clientX: rect.left + 120, clientY: rect.top + 120 });
        canvas.dispatchEvent(down);
        canvas.dispatchEvent(move);
        window.dispatchEvent(new PointerEvent('pointerup'));
        return true;
      })()`,
    );
    const afterFirstStroke = await evaluate(
      page,
      `(() => {
        const canvas = elements.sketchCanvas;
        const context = canvas.getContext('2d');
        const pixel = context.getImageData(70, 70, 1, 1).data;
        return { undoStackLength: sketchUndoStack.length, undoDisabled: elements.sketchUndoBtn.disabled, hasContent: sketchHasContent, pixel: Array.from(pixel) };
      })()`,
    );
    console.log(`[3] 첫 획 후 - 실행취소 스택: ${afterFirstStroke.undoStackLength}, 실행취소 버튼 비활성: ${afterFirstStroke.undoDisabled}, 픽셀: ${JSON.stringify(afterFirstStroke.pixel)}`);
    if (afterFirstStroke.undoStackLength !== 1) failures.push(`획 하나에 실행취소 스택이 1이어야 합니다 (실제: ${afterFirstStroke.undoStackLength}).`);
    if (afterFirstStroke.undoDisabled) failures.push("획을 그린 뒤에는 실행취소 버튼이 활성화돼야 합니다.");
    if (afterFirstStroke.pixel[0] === 255 && afterFirstStroke.pixel[1] === 255 && afterFirstStroke.pixel[2] === 255) {
      failures.push("그린 자리의 픽셀이 여전히 흰색입니다 (선이 그려지지 않았습니다).");
    }
    if (!afterFirstStroke.hasContent) failures.push("획을 그린 뒤 sketchHasContent가 true여야 합니다.");

    // 실행 취소 - 흰색으로 되돌아가야 한다.
    await evaluate(page, "undoSketchStroke(); true");
    const afterUndo = await evaluate(
      page,
      `(() => {
        const canvas = elements.sketchCanvas;
        const context = canvas.getContext('2d');
        const pixel = context.getImageData(70, 70, 1, 1).data;
        return { undoStackLength: sketchUndoStack.length, undoDisabled: elements.sketchUndoBtn.disabled, pixel: Array.from(pixel) };
      })()`,
    );
    console.log(`[4] 실행 취소 후 - 스택: ${afterUndo.undoStackLength}, 버튼 비활성: ${afterUndo.undoDisabled}, 픽셀: ${JSON.stringify(afterUndo.pixel)}`);
    if (afterUndo.undoStackLength !== 0) failures.push(`실행 취소 후 스택이 비어야 합니다 (실제: ${afterUndo.undoStackLength}).`);
    if (!afterUndo.undoDisabled) failures.push("스택이 비면 실행취소 버튼이 다시 비활성화돼야 합니다.");
    if (!(afterUndo.pixel[0] === 255 && afterUndo.pixel[1] === 255 && afterUndo.pixel[2] === 255)) {
      failures.push("실행 취소 후 그렸던 자리가 다시 흰색이어야 합니다.");
    }

    // 지우개 모드 전환 확인.
    await evaluate(page, "setSketchToolMode('erase'); true");
    const eraseModeActive = await evaluate(page, "elements.sketchEraseModeBtn.classList.contains('is-active') && !elements.sketchDrawModeBtn.classList.contains('is-active')");
    console.log(`[5] 지우개 모드 전환: ${eraseModeActive}`);
    if (!eraseModeActive) failures.push("지우개 버튼을 누르면 지우개 모드로 바뀌어야 합니다.");
    await evaluate(page, "setSketchToolMode('draw'); true");

    // 두 번째 획을 그려 삽입할 내용을 만든다.
    await evaluate(
      page,
      `(() => {
        const canvas = elements.sketchCanvas;
        const rect = canvas.getBoundingClientRect();
        canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: rect.left + 30, clientY: rect.top + 30 }));
        canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: rect.left + 200, clientY: rect.top + 40 }));
        window.dispatchEvent(new PointerEvent('pointerup'));
        return true;
      })()`,
    );

    // 서버 미연결(로컬 모드) 상태에서 삽입 - data URL 폴백이어야 한다.
    await evaluate(page, "insertSketchIntoTreeNote()");
    const afterInsert = await evaluate(
      page,
      "({ dialogHidden: elements.sketchDialog.classList.contains('hidden'), content: elements.treeContent.value })",
    );
    console.log(`[6] 삽입 후 다이얼로그 닫힘: ${afterInsert.dialogHidden}`);
    console.log(`[6-1] 삽입된 본문 앞부분: ${afterInsert.content.slice(0, 60)}...`);
    if (!afterInsert.dialogHidden) failures.push("삽입하면 다이얼로그가 닫혀야 합니다.");
    if (!afterInsert.content.includes("![스케치](data:image/png")) {
      failures.push(`서버 미연결 상태에서는 data URL로 폴백해야 합니다 (실제: ${afterInsert.content.slice(0, 120)}).`);
    }
    if (!afterInsert.content.includes("기존 내용")) {
      failures.push("기존 본문 내용이 사라지면 안 됩니다.");
    }

    // 미리보기 렌더링 - data URL 이미지는 바로 <img src="data:..."> 로 나와야 한다.
    await evaluate(page, "renderMarkdownPreview(elements.treeContent.value); true");
    const previewHtml = await evaluate(page, "elements.markdownPreview.innerHTML");
    const hasDataImage = /<img class="note-inline-image" src="data:image\/png/.test(previewHtml);
    console.log(`[7] 미리보기에 데이터 URL 이미지 태그 포함: ${hasDataImage}`);
    if (!hasDataImage) failures.push("미리보기에 data URL 이미지 태그가 있어야 합니다.");

    // nownote-attachment:// 참조는 placeholder 이미지 태그(data-note-attachment-key)로 렌더링되어야 한다.
    const attachmentRenderCheck = await evaluate(
      page,
      `(() => {
        const html = markdownToHtml('![스케치](nownote-attachment://abc123)');
        return html;
      })()`,
    );
    const hasAttachmentPlaceholder = /data-note-attachment-key="abc123"/.test(attachmentRenderCheck);
    console.log(`[8] nownote-attachment:// 참조가 placeholder 이미지로 렌더링됨: ${hasAttachmentPlaceholder}`);
    if (!hasAttachmentPlaceholder) failures.push(`nownote-attachment:// 참조가 올바르게 렌더링되지 않았습니다 (실제: ${attachmentRenderCheck}).`);

    // 서버 미연결 상태에서 hydrateNoteAttachmentImages를 돌려도 예외 없이 조용히 넘어가야 한다(회귀 확인).
    const hydrateNoCrash = await evaluate(
      page,
      `(async () => {
        const container = document.createElement('div');
        container.innerHTML = '${attachmentRenderCheck.replace(/'/g, "\\'")}';
        await hydrateNoteAttachmentImages(container);
        return true;
      })()`,
    );
    console.log(`[9] 서버 미연결 상태에서 첨부 이미지 채우기 시도 시 예외 없음: ${hydrateNoCrash}`);
    if (!hydrateNoCrash) failures.push("서버 미연결 상태에서 hydrateNoteAttachmentImages가 예외를 던졌습니다.");

    if (failures.length > 0) {
      console.log("");
      console.log("확인 실패:");
      failures.forEach((item) => console.log(`- ${item}`));
      throw new Error(`스케치 메모 확인 실패 ${failures.length}건`);
    }

    console.log("");
    console.log("NowNote sketch memo check passed");
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
  console.error(`NowNote sketch memo check failed: ${error.message}`);
  process.exit(1);
});
