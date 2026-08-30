/**
 * NowNote 2.3.6 M8b - Markdown 강조 오버레이 성능 시험대.
 *
 * `<textarea id="treeContent">` 위에 겹친 강조 오버레이가
 * 문서 크기별로 한 글자 입력당 다시 칠하기를 몇 ms 에 끝내는지 잰다.
 *
 * 판정 기준 (docs/NOW_2_3_6_FEATURE_DESIGN.md "1. Markdown 편집기 코어"):
 *   문서 5만 자에서 한 글자 입력당 다시 칠하기 50ms 이하.
 *
 * 함께 확인하는 것:
 *   - 줄 단위 갱신(diff) 과 전체 innerHTML 재작성(rebuild) 의 수치 차이
 *   - textarea 와 오버레이의 줄바꿈 정렬 (탭, 긴 줄, 창 너비 변경)
 *   - 조합(IME) 중에는 다시 칠하지 않는지
 *   - 오버레이를 끄면 textarea 단독 상태로 되돌아가는지
 *
 * 실행:
 *   node web/scripts/check_editor_overlay_perf.mjs
 *   node web/scripts/check_editor_overlay_perf.mjs --iterations 60
 *   node web/scripts/check_editor_overlay_perf.mjs --sizes 10000,50000
 *
 * 하네스 구조는 web/scripts/check_graph_view.mjs 와 같다.
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

// 기준: 5만 자에서 한 글자 입력당 다시 칠하기 50ms 이하.
const BUDGET_MS = 50;
const BUDGET_SIZE = 50_000;
const DEFAULT_SIZES = [10_000, 30_000, 50_000, 100_000];
const DEFAULT_ITERATIONS = 45;

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

function parseArgs(argv) {
  const options = { sizes: DEFAULT_SIZES, iterations: DEFAULT_ITERATIONS };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--sizes") {
      options.sizes = String(argv[index + 1] || "")
        .split(",")
        .map((item) => Number.parseInt(item.trim(), 10))
        .filter((item) => Number.isFinite(item) && item > 0);
      index += 1;
    } else if (arg === "--iterations") {
      options.iterations = Math.max(5, Number.parseInt(argv[index + 1] || "", 10) || DEFAULT_ITERATIONS);
      index += 1;
    }
  }
  assert(options.sizes.length > 0, "--sizes 값을 읽지 못했습니다.");
  return options;
}

/**
 * 페이지 안에서 돌 준비 코드.
 * 시험용 함수들을 window.__overlayBench 에 붙인다. 앱 코드에는 아무것도 남기지 않는다.
 */
const PAGE_SETUP = String.raw`
(() => {
  const editor = elements.treeContent;
  const overlay = elements.treeContentOverlay;
  const surface = elements.treeContentSurface;

  // 5만 자급 한국어 Markdown 문서. 제목, 목록, 코드블록, 탭, 아주 긴 줄을 섞는다.
  const TICK = String.fromCharCode(96);
  const FENCE = TICK + TICK + TICK;

  function buildDocument(targetChars) {
    const parts = [];
    let total = 0;
    let index = 0;
    const longSentence = "이 문장은 줄바꿈 규칙과 정렬을 확인하려고 일부러 아주 길게 이어 붙인 한국어 문장입니다. ";
    while (total < targetChars) {
      index += 1;
      const block = [
        "# " + index + "장 회의 기록",
        "",
        // 줄바꿈이 일어나는 긴 제목 줄. 오버레이가 제목에 다른 글자 굵기나 크기를 주면
        // 여기서 줄바꿈 위치가 textarea 와 달라지고 높이 비교에서 바로 드러난다.
        "### " + index + ".0 아주 긴 제목 줄: " + longSentence.repeat(2),
        // 길이를 블록마다 조금씩 바꾼다. 굵기나 크기를 바꾸면 어느 길이에서든 줄바꿈이 밀린다.
        "#### " + index + ".0 long latin heading " + "overlay alignment regression guard ".repeat(3) + "x".repeat(index % 40),
        "## " + index + ".1 안건 정리",
        "오늘 논의한 내용을 정리한다. 결정 사항과 남은 일을 나눠서 적는다.",
        "- [ ] 담당자 배정과 일정 확인",
        "- [x] 지난 회의 후속 작업 마감",
        "\t탭으로 들여쓴 줄이다. 오버레이가 탭 너비를 같게 잡는지 본다.",
        "인라인 코드 " + TICK + "repaintTreeHighlightOverlay()" + TICK + " 와 " + TICK + "state.settings.fontSize" + TICK + " 를 섞는다.",
        FENCE + "bash",
        "node web/scripts/check_editor_overlay_perf.mjs --iterations 60",
        FENCE,
        "긴 줄 시험: " + longSentence.repeat(6),
        "",
      ].join("\n");
      parts.push(block);
      total += block.length + 1;
    }
    return parts.join("\n").slice(0, targetChars);
  }

  function prepareEditor() {
    state.data = defaultData();
    const node = createNode("오버레이 성능 시험", "", null, 1);
    state.data.tree = [node];
    state.selectedTreeId = node.id;
    state.view = "tree";
    state.search = "";
    render();
    return Boolean(editor.offsetParent) && editor.clientWidth > 0;
  }

  function loadDocument(text) {
    editor.value = text;
    setTreeHighlightOverlayEnabled(false);
    setTreeHighlightOverlayEnabled(true);
    syncTreeHighlightOverlayMetrics();
    repaintTreeHighlightOverlay(true);
    void overlay.scrollHeight;
    return { chars: editor.value.length, lines: editor.value.split("\n").length };
  }

  function summarize(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    const at = (ratio) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
    const sum = sorted.reduce((acc, item) => acc + item, 0);
    return {
      samples: sorted.length,
      median: at(0.5),
      p95: at(0.95),
      max: sorted[sorted.length - 1],
      mean: sum / sorted.length,
    };
  }

  // 한 글자 입력을 흉내 낸다.
  // editorMs: textarea 에 글자가 들어가고 다시 배치되는 비용 (오버레이와 무관하게 드는 비용)
  // overlayMs: 오버레이를 다시 칠하고 다시 배치하는 비용 (기준 50ms 를 재는 값)
  function measure(targetChars, iterations, fullRebuild) {
    const text = buildDocument(targetChars);
    setTreeHighlightOverlayFullRebuild(Boolean(fullRebuild));
    loadDocument(text);
    let current = text;
    const editorSamples = [];
    const overlaySamples = [];
    const positions = [
      Math.floor(current.length * 0.02),
      Math.floor(current.length * 0.5),
      current.length,
    ];
    const perPosition = { start: [], middle: [], end: [] };
    const names = ["start", "middle", "end"];
    // 첫 두 번은 워밍업으로 버린다.
    for (let index = 0; index < iterations + 2; index += 1) {
      const slot = index % 3;
      const cursor = Math.min(positions[slot] + index, current.length);
      const letter = "가나다라마바사아자차".charAt(index % 10);
      current = current.slice(0, cursor) + letter + current.slice(cursor);

      const t0 = performance.now();
      editor.value = current;
      void editor.scrollHeight;
      const t1 = performance.now();
      repaintTreeHighlightOverlay(true);
      void overlay.scrollHeight;
      const t2 = performance.now();
      if (index < 2) continue;
      editorSamples.push(t1 - t0);
      overlaySamples.push(t2 - t1);
      perPosition[names[slot]].push(t2 - t1);
    }
    return {
      chars: text.length,
      lines: text.split("\n").length,
      mode: fullRebuild ? "rebuild" : "diff",
      editor: summarize(editorSamples),
      overlay: summarize(overlaySamples),
      byPosition: {
        start: summarize(perPosition.start),
        middle: summarize(perPosition.middle),
        end: summarize(perPosition.end),
      },
      lastChangedLines: treeHighlightOverlayStats.lastChangedLines,
    };
  }

  // 오버레이를 끈 상태에서 같은 입력을 재서 순수 textarea 비용을 얻는다.
  function measureWithoutOverlay(targetChars, iterations) {
    const text = buildDocument(targetChars);
    setTreeHighlightOverlayEnabled(false);
    editor.value = text;
    void editor.scrollHeight;
    let current = text;
    const samples = [];
    for (let index = 0; index < iterations + 2; index += 1) {
      const cursor = Math.floor(current.length / 2) + index;
      current = current.slice(0, cursor) + "가" + current.slice(cursor);
      const t0 = performance.now();
      editor.value = current;
      void editor.scrollHeight;
      const t1 = performance.now();
      if (index < 2) continue;
      samples.push(t1 - t0);
    }
    setTreeHighlightOverlayEnabled(true);
    return summarize(samples);
  }

  function metrics() {
    const editorStyle = getComputedStyle(editor);
    const overlayStyle = getComputedStyle(overlay);
    const lineHeight = parseFloat(overlayStyle.lineHeight) || 0;
    return {
      lineHeight,
      editorScrollHeight: editor.scrollHeight,
      overlayScrollHeight: overlay.scrollHeight,
      editorScrollWidth: editor.scrollWidth,
      overlayScrollWidth: overlay.scrollWidth,
      editorClientWidth: editor.clientWidth,
      overlayClientWidth: overlay.clientWidth,
      fontMatches: editorStyle.fontFamily === overlayStyle.fontFamily
        && editorStyle.fontSize === overlayStyle.fontSize
        && editorStyle.lineHeight === overlayStyle.lineHeight
        && editorStyle.letterSpacing === overlayStyle.letterSpacing
        && editorStyle.tabSize === overlayStyle.tabSize
        && editorStyle.whiteSpace === overlayStyle.whiteSpace
        && editorStyle.wordBreak === overlayStyle.wordBreak
        && editorStyle.paddingLeft === overlayStyle.paddingLeft
        && editorStyle.paddingTop === overlayStyle.paddingTop,
      textMatches: overlay.textContent.replace(/\n$/, "") === editor.value,
    };
  }

  function alignment(targetChars) {
    loadDocument(buildDocument(targetChars));
    syncTreeHighlightOverlayMetrics();
    repaintTreeHighlightOverlay(true);
    const info = metrics();
    // 오버레이는 마지막 줄에도 줄바꿈을 붙이므로 한 줄만큼 더 높다. 그 밖의 차이는 정렬 어긋남이다.
    info.heightDelta = info.overlayScrollHeight - info.editorScrollHeight;
    info.aligned = Math.abs(info.heightDelta) <= Math.ceil(info.lineHeight) + 1;
    return info;
  }

  function scrollSync(scrollTop) {
    editor.scrollTop = scrollTop;
    editor.dispatchEvent(new Event("scroll"));
    syncTreeHighlightOverlayScroll();
    return { editorScrollTop: editor.scrollTop, overlayScrollTop: overlay.scrollTop };
  }

  function nextFrames(count) {
    return new Promise((resolve) => {
      let left = count;
      const tick = () => {
        left -= 1;
        if (left <= 0) resolve(true);
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      setTimeout(() => resolve(false), 800);
    });
  }

  async function compositionCheck() {
    loadDocument(buildDocument(4000));
    const before = treeHighlightOverlayStats.paintCount;
    editor.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    const composing = isEditorComposing(editor);
    editor.value = editor.value + "\n한글 조합 중 입력";
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true }));
    await nextFrames(3);
    const duringPaints = treeHighlightOverlayStats.paintCount - before;
    editor.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    await nextFrames(3);
    const afterPaints = treeHighlightOverlayStats.paintCount - before;
    return {
      composing,
      duringPaints,
      afterPaints,
      textMatches: overlay.textContent.replace(/\n$/, "") === editor.value,
    };
  }

  // Markdown 보기로 넘어가면 textarea 에 hidden 이 붙는다.
  // 오버레이 껍데기까지 함께 숨겨지지 않으면 미리보기 옆에 빈 칸이 남는다.
  function previewToggleCheck() {
    loadDocument(buildDocument(4000));
    const before = getComputedStyle(surface).display;
    elements.previewToggleBtn.click();
    const during = getComputedStyle(surface).display;
    const previewShown = !elements.markdownPreview.classList.contains("hidden");
    elements.previewToggleBtn.click();
    const after = getComputedStyle(surface).display;
    return { before, during, after, previewShown, hidden: during === "none", restored: after === before };
  }

  function disabledCheck() {
    loadDocument(buildDocument(4000));
    setTreeHighlightOverlayEnabled(false);
    const overlayEmpty = overlay.textContent === "" && overlay.classList.contains("hidden");
    const noHighlightClass = !surface.classList.contains("highlight-on");
    const textVisible = getComputedStyle(editor).color !== "rgba(0, 0, 0, 0)";
    const ownValue = Object.getOwnPropertyDescriptor(editor, "value") === undefined;
    editor.value = "되돌린 뒤 입력";
    const plainWorks = editor.value === "되돌린 뒤 입력";
    setTreeHighlightOverlayEnabled(true);
    const reEnabled = isTreeHighlightOverlayEnabled() && surface.classList.contains("highlight-on");
    return { overlayEmpty, noHighlightClass, textVisible, ownValue, plainWorks, reEnabled };
  }

  async function realInputCheck(targetChars, strokes) {
    // 앞선 비교 측정이 남긴 전체 재작성 설정을 되돌리고 실제 동작 방식으로 잰다.
    setTreeHighlightOverlayFullRebuild(false);
    loadDocument(buildDocument(targetChars));
    editor.focus();
    editor.setSelectionRange(Math.floor(editor.value.length / 2), Math.floor(editor.value.length / 2));
    treeHighlightOverlayStats.paintCount = 0;
    return { ready: document.activeElement === editor, strokes };
  }

  function realInputResult() {
    return {
      paintCount: treeHighlightOverlayStats.paintCount,
      lastPaintMs: treeHighlightOverlayStats.lastPaintMs,
      lastChangedLines: treeHighlightOverlayStats.lastChangedLines,
      mode: treeHighlightOverlayStats.lastMode,
      textMatches: overlay.textContent.replace(/\n$/, "") === editor.value,
    };
  }

  window.__overlayBench = {
    buildDocument,
    prepareEditor,
    loadDocument,
    measure,
    measureWithoutOverlay,
    metrics,
    alignment,
    scrollSync,
    compositionCheck,
    previewToggleCheck,
    disabledCheck,
    realInputCheck,
    realInputResult,
    nextFrames,
  };
  return true;
})()
`;

function fixed(value, digits = 2) {
  return Number(value).toFixed(digits);
}

function printTable(rows, headers) {
  const widths = headers.map((header, index) => Math.max(
    header.length,
    ...rows.map((row) => String(row[index]).length),
  ));
  const line = (cells) => `| ${cells.map((cell, index) => String(cell).padEnd(widths[index])).join(" | ")} |`;
  console.log(line(headers));
  console.log(`| ${widths.map((width) => "-".repeat(width)).join(" | ")} |`);
  rows.forEach((row) => console.log(line(row)));
}

async function runOnce(options) {
  assert(typeof WebSocket === "function", "현재 Node.js 런타임이 WebSocket을 지원하지 않습니다.");

  const browserPath = await findBrowser();
  const { server, port: webPort } = await startStaticServer();
  const debugPort = await freePort();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nownote-overlay-perf-"));
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
      "Boolean(document.querySelector('#treeContentOverlay') && typeof repaintTreeHighlightOverlay === 'function')",
      "강조 오버레이 로드",
    );

    assert(await evaluate(page, PAGE_SETUP), "시험 준비 코드를 붙이지 못했습니다.");
    assert(await evaluate(page, "window.__overlayBench.prepareEditor()"), "편집기가 화면에 보이지 않습니다.");
    assert(
      await evaluate(page, "isTreeHighlightOverlayEnabled()"),
      "오버레이가 기본으로 켜져 있지 않습니다.",
    );

    console.log("NowNote Markdown 강조 오버레이 성능 시험대");
    console.log(`기준: 문서 ${BUDGET_SIZE.toLocaleString("en-US")}자에서 한 글자 입력당 다시 칠하기 ${BUDGET_MS}ms 이하`);
    console.log(`표본: 크기별 ${options.iterations}회 (워밍업 2회 제외), 입력 위치는 앞·가운데·끝을 번갈아 씀`);
    console.log("");

    // 1) 줄 단위 갱신(현재 방식)
    const diffRows = [];
    const diffResults = [];
    for (const size of options.sizes) {
      const result = await evaluate(page, `window.__overlayBench.measure(${size}, ${options.iterations}, false)`);
      diffResults.push(result);
      diffRows.push([
        result.chars.toLocaleString("en-US"),
        result.lines.toLocaleString("en-US"),
        fixed(result.overlay.median),
        fixed(result.overlay.p95),
        fixed(result.overlay.max),
        fixed(result.editor.median),
        fixed(result.editor.max),
      ]);
    }
    console.log("[1] 오버레이 다시 칠하기 - 줄 단위 갱신 (현재 방식)");
    printTable(diffRows, [
      "문서(자)", "줄 수", "중앙값(ms)", "p95(ms)", "최악(ms)", "textarea 중앙값(ms)", "textarea 최악(ms)",
    ]);
    console.log("");

    // 2) 전체 innerHTML 재작성 (최적화 이전 방식)
    const rebuildRows = [];
    const rebuildResults = [];
    for (const size of options.sizes) {
      const result = await evaluate(page, `window.__overlayBench.measure(${size}, ${options.iterations}, true)`);
      rebuildResults.push(result);
      rebuildRows.push([
        result.chars.toLocaleString("en-US"),
        fixed(result.overlay.median),
        fixed(result.overlay.p95),
        fixed(result.overlay.max),
      ]);
    }
    console.log("[2] 오버레이 다시 칠하기 - 전체 innerHTML 재작성 (최적화 이전)");
    printTable(rebuildRows, ["문서(자)", "중앙값(ms)", "p95(ms)", "최악(ms)"]);
    console.log("");

    // 3) 입력 위치별 (줄 단위 갱신)
    const positionRows = diffResults.map((result) => [
      result.chars.toLocaleString("en-US"),
      fixed(result.byPosition.start.median),
      fixed(result.byPosition.middle.median),
      fixed(result.byPosition.end.median),
    ]);
    console.log("[3] 입력 위치별 중앙값 - 줄 단위 갱신");
    printTable(positionRows, ["문서(자)", "앞(ms)", "가운데(ms)", "끝(ms)"]);
    console.log("");

    // 4) 오버레이를 끈 상태의 textarea 단독 비용
    const withoutRows = [];
    for (const size of options.sizes) {
      const result = await evaluate(page, `window.__overlayBench.measureWithoutOverlay(${size}, ${options.iterations})`);
      withoutRows.push([size.toLocaleString("en-US"), fixed(result.median), fixed(result.max)]);
    }
    console.log("[4] 오버레이를 끈 상태 - textarea 단독 비용");
    printTable(withoutRows, ["문서(자)", "중앙값(ms)", "최악(ms)"]);
    console.log("");

    // 5) 실제 키 입력 경로 (CDP Input.insertText -> input 이벤트 -> rAF 다시 칠하기)
    await evaluate(page, "window.__overlayBench.realInputCheck(50000, 20)");
    const realSamples = [];
    for (let index = 0; index < 20; index += 1) {
      await page.send("Input.insertText", { text: "가" });
      await evaluate(page, "window.__overlayBench.nextFrames(2)");
      const info = await evaluate(page, "window.__overlayBench.realInputResult()");
      if (index >= 2) realSamples.push(info.lastPaintMs);
    }
    const realInfo = await evaluate(page, "window.__overlayBench.realInputResult()");
    const sortedReal = realSamples.slice().sort((a, b) => a - b);
    const realMedian = sortedReal[Math.floor(sortedReal.length / 2)] || 0;
    const realMax = sortedReal[sortedReal.length - 1] || 0;
    console.log("[5] 실제 키 입력 경로 (5만 자, Input.insertText 20회) - 다시 배치 비용은 빠진 JS 작업 시간");
    printTable(
      [[fixed(realMedian), fixed(realMax), String(realInfo.lastChangedLines), realInfo.mode, realInfo.textMatches ? "일치" : "불일치"]],
      ["중앙값(ms)", "최악(ms)", "마지막에 바뀐 줄 수", "방식", "오버레이 글자"],
    );
    if (!realInfo.textMatches) failures.push("실제 키 입력 뒤 오버레이 글자가 textarea 와 다릅니다.");
    console.log("");

    // 6) 정렬 확인 - 창 너비를 바꿔 가며
    const alignRows = [];
    for (const width of [1280, 980, 640]) {
      await page.send("Emulation.setDeviceMetricsOverride", {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await delay(200);
      await evaluate(page, "syncTreeHighlightOverlayMetrics()");
      const info = await evaluate(page, "window.__overlayBench.alignment(50000)");
      alignRows.push([
        String(width),
        info.fontMatches ? "같음" : "다름",
        String(info.editorScrollHeight),
        String(info.overlayScrollHeight),
        String(info.heightDelta),
        fixed(info.lineHeight, 1),
        info.aligned ? "맞음" : "어긋남",
        info.textMatches ? "일치" : "불일치",
      ]);
      if (!info.aligned) failures.push(`창 너비 ${width}px 에서 줄바꿈 정렬이 어긋납니다 (차이 ${info.heightDelta}px).`);
      if (!info.fontMatches) failures.push(`창 너비 ${width}px 에서 글꼴/여백 설정이 다릅니다.`);
      if (!info.textMatches) failures.push(`창 너비 ${width}px 에서 오버레이 글자가 다릅니다.`);
    }
    await page.send("Emulation.clearDeviceMetricsOverride");
    await delay(200);
    await evaluate(page, "syncTreeHighlightOverlayMetrics()");
    console.log("[6] 정렬 확인 - 탭과 긴 줄이 섞인 5만 자 문서, 창 너비 변경");
    printTable(alignRows, [
      "창 너비(px)", "글꼴·여백", "textarea 높이", "오버레이 높이", "차이(px)", "줄 높이(px)", "정렬", "글자",
    ]);
    console.log("");

    // 7) 스크롤 동기화
    const scrollInfo = await evaluate(page, "window.__overlayBench.scrollSync(1500)");
    const scrollOk = scrollInfo.editorScrollTop === scrollInfo.overlayScrollTop;
    console.log(`[7] 스크롤 동기화: textarea ${scrollInfo.editorScrollTop} / 오버레이 ${scrollInfo.overlayScrollTop} -> ${scrollOk ? "같음" : "다름"}`);
    if (!scrollOk) failures.push("스크롤이 함께 움직이지 않습니다.");

    // 8) 조합 중 다시 칠하기 차단
    const composition = await evaluate(page, "window.__overlayBench.compositionCheck()");
    const compositionOk = composition.composing
      && composition.duringPaints === 0
      && composition.afterPaints >= 1
      && composition.textMatches;
    console.log(`[8] 조합 중 다시 칠하기: 조합 인식 ${composition.composing ? "함" : "못함"}, 조합 중 ${composition.duringPaints}회, 조합 끝난 뒤 ${composition.afterPaints}회, 글자 ${composition.textMatches ? "일치" : "불일치"} -> ${compositionOk ? "통과" : "실패"}`);
    if (!compositionOk) failures.push("조합 중 다시 칠하기가 막히지 않거나 조합 뒤 한 번 칠하지 않습니다.");

    // 9) Markdown 보기 전환 시 오버레이 껍데기도 함께 숨는지
    const preview = await evaluate(page, "window.__overlayBench.previewToggleCheck()");
    const previewOk = preview.previewShown === true && preview.hidden && preview.restored;
    console.log(`[9] Markdown 보기 전환: 껍데기 display ${preview.before} -> ${preview.during} -> ${preview.after} -> ${previewOk ? "통과" : "실패"}`);
    if (!previewOk) failures.push("Markdown 보기로 넘어갔을 때 오버레이 껍데기가 숨겨지지 않습니다(:has 미지원 가능성).");

    // 10) 오버레이 끄기 -> 원래 동작으로 복귀
    const disabled = await evaluate(page, "window.__overlayBench.disabledCheck()");
    const disabledOk = disabled.overlayEmpty
      && disabled.noHighlightClass
      && disabled.textVisible
      && disabled.ownValue
      && disabled.plainWorks
      && disabled.reEnabled;
    console.log(`[10] 오버레이 끄기: 오버레이 비움 ${disabled.overlayEmpty}, 강조 해제 ${disabled.noHighlightClass}, 글자 보임 ${disabled.textVisible}, value 가로채기 해제 ${disabled.ownValue}, 값 대입 정상 ${disabled.plainWorks}, 다시 켜기 ${disabled.reEnabled} -> ${disabledOk ? "통과" : "실패"}`);
    if (!disabledOk) failures.push("오버레이를 껐을 때 textarea 단독 상태로 돌아가지 않습니다.");
    console.log("");

    // 판정
    const budgetIndex = options.sizes.indexOf(BUDGET_SIZE);
    if (budgetIndex >= 0) {
      const judged = diffResults[budgetIndex];
      const passed = judged.overlay.median <= BUDGET_MS && judged.overlay.max <= BUDGET_MS;
      console.log("[판정]");
      console.log(`- ${BUDGET_SIZE.toLocaleString("en-US")}자 줄 단위 갱신: 중앙값 ${fixed(judged.overlay.median)}ms, p95 ${fixed(judged.overlay.p95)}ms, 최악 ${fixed(judged.overlay.max)}ms`);
      console.log(`- 기준 ${BUDGET_MS}ms -> ${passed ? "통과 (오버레이 유지)" : "미달 (CodeMirror 전환 검토)"}`);
      if (!passed) failures.push(`${BUDGET_SIZE.toLocaleString("en-US")}자에서 기준 ${BUDGET_MS}ms 를 넘겼습니다.`);
    } else {
      console.log(`[판정] --sizes 에 ${BUDGET_SIZE} 가 없어 기준 판정을 건너뜁니다.`);
    }

    if (failures.length > 0) {
      console.log("");
      console.log("확인 실패:");
      failures.forEach((item) => console.log(`- ${item}`));
      throw new Error(`강조 오버레이 시험 실패 ${failures.length}건`);
    }

    console.log("");
    console.log("NowNote editor overlay perf check passed");
  } finally {
    browserClient?.close();
    stopBrowserProcess(browser);
    server.close();
    await delay(300);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await runOnce(options);
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
  console.error(`NowNote editor overlay perf check failed: ${error.message}`);
  process.exit(1);
});
