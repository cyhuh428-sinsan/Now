/**
 * NowNote 2.3.6 U1 - Markdown 편집 화면 문법 강조 확인.
 *
 * 로드맵 8이 요구하는 5가지 강조(제목·목록·링크·인라인 코드·코드블록)와
 * bash 코드블록 최소 강조(명령어/옵션/경로/숫자)가 실제로 칠해지는지 확인한다.
 * 색상 토큰 자체의 기본값·사용자 값 반영은 check_markdown_colors.mjs 가 맡고,
 * 5만 자 성능 예산은 check_editor_overlay_perf.mjs 가 맡는다. 이 파일은 "규칙이
 * 맞는 자리에 맞는 클래스로 칠해지는지" 와 "배경은 배경 레이어, 글자는 오버레이에만
 * 있는지" 를 확인한다.
 *
 * 확인하는 것:
 *   1. 제목/목록/링크/인라인 코드/코드블록 다섯 가지가 오버레이(글자)에 칠해지는지
 *   2. 인라인 코드·코드블록 배경이 오버레이가 아니라 배경 레이어(#treeContentBackdrop)에만
 *      있는지, 오버레이 쪽 조각에는 배경이 전혀 없는지(캐럿/선택 영역 가림 방지 제약)
 *   3. bash 코드블록의 명령어/옵션/경로/숫자 구분이 실제로 나오는지, bash 가 아닌
 *      언어의 코드블록에는 이 구분이 나오지 않는지
 *   4. 코드블록 펜스가 늘거나 줄어들 때(다시 열기/닫기) 그 아래 줄의 강조가 함께
 *      바뀌는지(줄 단위 다시 그리기가 상태 변화를 놓치지 않는지)
 *   5. 배경 레이어가 textarea/오버레이와 같은 자리·크기·줄바꿈으로 정렬되는지
 *
 * 실행:
 *   node web/scripts/check_markdown_highlighting.mjs
 *
 * 하네스 구조는 web/scripts/check_markdown_colors.mjs 와 같다.
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
 * 페이지 안에서 돌 준비 코드. 시험용 함수들을 window.__mdHighlight 에 붙인다.
 */
const PAGE_SETUP = String.raw`
(() => {
  const editor = elements.treeContent;
  const overlay = elements.treeContentOverlay;
  const backdrop = elements.treeContentBackdrop;
  const TICK = String.fromCharCode(96);
  const FENCE = TICK + TICK + TICK;

  // 5가지 강조가 모두 나오는 문서. bash 코드블록엔 명령어/옵션/경로/숫자를 섞는다.
  const SAMPLE = [
    "# 첫째 제목",
    "",
    "## 둘째 제목",
    "- 목록 첫째",
    "* 목록 둘째",
    "1. 번호 목록",
    "",
    "본문에 [바깥 링크](https://example.com) 와 " + TICK + "inline_code" + TICK + " 를 섞는다.",
    "",
    FENCE + "bash",
    "npm install --save-dev eslint",
    "node web/scripts/check_markdown_highlighting.mjs 2",
    "cd /var/log && ls -la 3",
    FENCE,
    "",
    FENCE + "python",
    "print('bash 강조는 여기 없어야 한다 --flag /path 42')",
    FENCE,
    "",
  ].join("\n");

  // 정렬 확인용 - 위 구성을 반복해 어느 정도 길이를 만든다.
  function buildAlignDocument(targetChars) {
    const parts = [];
    let total = 0;
    while (total < targetChars) {
      parts.push(SAMPLE);
      total += SAMPLE.length + 1;
    }
    return parts.join("\n").slice(0, targetChars);
  }

  function prepareEditor() {
    state.data = defaultData();
    const node = createNode("강조 규칙 확인", "", null, 1);
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
    void backdrop.scrollHeight;
    return editor.value.length;
  }

  function colorOf(el) {
    return el ? getComputedStyle(el).color : "";
  }

  function bgOf(el) {
    return el ? getComputedStyle(el).backgroundColor : "";
  }

  // --md-list-marker 는 color-mix() 파생값이라 getPropertyValue 로는 계산된 색이 아니라
  // "color-mix(...)" 글자 그대로 나온다. 실제 계산된 색과 비교하려면 화면 밖 조각에
  // 같은 var() 를 걸어 놓고 getComputedStyle 로 읽어야 한다.
  function resolvedVarColor(token) {
    const probe = document.createElement("span");
    probe.style.color = "var(" + token + ")";
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }

  // 1) 다섯 가지 강조가 오버레이(글자)에 나오는지.
  function overlayCategories() {
    loadDocument(SAMPLE);
    const heading = overlay.querySelector(".md-heading");
    const listMarker = overlay.querySelector(".md-list-marker");
    const link = overlay.querySelector(".md-link");
    const inlineCode = overlay.querySelector(".md-code");
    const codeBlock = overlay.querySelector(".md-codeblock-fg");
    return {
      headingFound: Boolean(heading),
      headingText: heading ? heading.textContent : "",
      headingColor: colorOf(heading),
      listMarkerFound: Boolean(listMarker),
      listMarkerText: listMarker ? listMarker.textContent : "",
      listMarkerColor: colorOf(listMarker),
      linkFound: Boolean(link),
      linkText: link ? link.textContent : "",
      linkColor: colorOf(link),
      inlineCodeFound: Boolean(inlineCode),
      inlineCodeText: inlineCode ? inlineCode.textContent : "",
      inlineCodeColor: colorOf(inlineCode),
      codeBlockFound: Boolean(codeBlock),
      codeBlockColor: colorOf(codeBlock),
      tokenHeading: getComputedStyle(document.documentElement).getPropertyValue("--md-heading").trim(),
      tokenListMarker: resolvedVarColor("--md-list-marker"),
      tokenLink: getComputedStyle(document.documentElement).getPropertyValue("--md-link").trim(),
      tokenInlineCode: getComputedStyle(document.documentElement).getPropertyValue("--md-inline-code-text").trim(),
      tokenCodeBlockText: getComputedStyle(document.documentElement).getPropertyValue("--md-code-block-text").trim(),
    };
  }

  // 2) 배경은 배경 레이어에만, 오버레이 쪽 조각에는 배경이 전혀 없는지.
  function backgroundLayering() {
    loadDocument(SAMPLE);
    const overlaySpans = Array.from(overlay.querySelectorAll("span"));
    const overlayNoBackground = overlaySpans.every((span) => {
      const bg = getComputedStyle(span).backgroundColor;
      return bg === "rgba(0, 0, 0, 0)" || bg === "transparent";
    });
    const inlineBg = backdrop.querySelector(".md-inlinecode-bg");
    const blockBg = backdrop.querySelector(".md-codeblock-bg");
    return {
      overlaySpanCount: overlaySpans.length,
      overlayNoBackground,
      inlineBgFound: Boolean(inlineBg),
      inlineBgColor: bgOf(inlineBg),
      blockBgFound: Boolean(blockBg),
      blockBgColor: bgOf(blockBg),
      backdropTextColor: getComputedStyle(backdrop).color,
      tokenInlineCodeBg: getComputedStyle(document.documentElement).getPropertyValue("--md-inline-code-bg").trim(),
      tokenCodeBlockBg: getComputedStyle(document.documentElement).getPropertyValue("--md-code-block-bg").trim(),
    };
  }

  // 3) bash 최소 강조 - 명령어/옵션/경로/숫자 구분, 그리고 bash 가 아닌 언어에는 안 나오는지.
  function bashHighlighting() {
    loadDocument(SAMPLE);
    const options = Array.from(overlay.querySelectorAll(".md-bash-option")).map((el) => el.textContent);
    const paths = Array.from(overlay.querySelectorAll(".md-bash-path")).map((el) => el.textContent);
    const numbers = Array.from(overlay.querySelectorAll(".md-bash-number")).map((el) => el.textContent);
    const optionColor = colorOf(overlay.querySelector(".md-bash-option"));
    const pathColor = colorOf(overlay.querySelector(".md-bash-path"));
    const numberColor = colorOf(overlay.querySelector(".md-bash-number"));
    const plainCodeColor = colorOf(overlay.querySelector(".md-codeblock-fg"));
    // python 코드블록 줄의 글자 - "print(...)" 를 담은 codeblock-fg 안에 bash 하위 클래스가 없어야 한다.
    const codeBlockLines = Array.from(overlay.querySelectorAll(".md-codeblock-fg"));
    const pythonLine = codeBlockLines.find((el) => el.textContent.includes("print("));
    const pythonHasBashTokens = Boolean(pythonLine && pythonLine.querySelector(".md-bash-option, .md-bash-path, .md-bash-number"));
    return {
      options,
      paths,
      numbers,
      optionColor,
      pathColor,
      numberColor,
      plainCodeColor,
      optionDiffersFromPlain: optionColor !== plainCodeColor,
      pathDiffersFromPlain: pathColor !== plainCodeColor,
      numberDiffersFromPlain: numberColor !== plainCodeColor,
      pythonLineFound: Boolean(pythonLine),
      pythonHasBashTokens,
    };
  }

  // 4) 펜스를 여닫을 때 그 아래 줄의 강조가 함께 바뀌는지 (다시 그리기가 상태 변화를 놓치지 않는지).
  function fenceToggle() {
    const before = FENCE + "bash\nls -la\n" + FENCE + "\n평범한 문장입니다.";
    loadDocument(before);
    // 줄 구성: 0) 여는 펜스(bash)  1) ls -la  2) 닫는 펜스  3) 평범한 문장입니다.
    const codeLineBefore = Array.from(overlay.querySelectorAll(".md-line"))[1];
    const codeBefore = Boolean(codeLineBefore && codeLineBefore.querySelector(".md-codeblock-fg"));
    const backdropBefore = Boolean(Array.from(backdrop.querySelectorAll(".md-line"))[1]?.querySelector(".md-codeblock-bg"));

    // 닫는 펜스를 지워 코드블록을 이어지게 만든다 - "평범한 문장입니다." 도 코드블록 안이 돼야 한다.
    const opened = FENCE + "bash\nls -la\n평범한 문장입니다.";
    editor.value = opened;
    repaintTreeHighlightOverlay(true);
    const linesAfterOpen = Array.from(overlay.querySelectorAll(".md-line"));
    const lastLineAfterOpen = linesAfterOpen[linesAfterOpen.length - 1];
    const codeAfterOpen = Boolean(lastLineAfterOpen && lastLineAfterOpen.querySelector(".md-codeblock-fg"));
    const backdropLinesAfterOpen = Array.from(backdrop.querySelectorAll(".md-line"));
    const backdropAfterOpen = Boolean(backdropLinesAfterOpen[backdropLinesAfterOpen.length - 1]?.querySelector(".md-codeblock-bg"));

    // 다시 닫는 펜스를 넣으면 마지막 줄은 다시 평범한 글자로 돌아가야 한다.
    editor.value = before;
    repaintTreeHighlightOverlay(true);
    const linesAfterClose = Array.from(overlay.querySelectorAll(".md-line"));
    const lastLineAfterClose = linesAfterClose[linesAfterClose.length - 1];
    const codeAfterClose = Boolean(lastLineAfterClose && lastLineAfterClose.querySelector(".md-codeblock-fg"));

    return {
      codeBefore,
      backdropBefore,
      codeAfterOpen,
      backdropAfterOpen,
      codeAfterClose,
      textMatches: overlay.textContent.replace(/\n$/, "") === editor.value,
    };
  }

  // 5) 배경 레이어가 textarea/오버레이와 같은 자리·크기로 정렬되는지.
  function alignment(targetChars) {
    loadDocument(buildAlignDocument(targetChars));
    syncTreeHighlightOverlayMetrics();
    repaintTreeHighlightOverlay(true);
    const editorStyle = getComputedStyle(editor);
    const overlayStyle = getComputedStyle(overlay);
    const backdropStyle = getComputedStyle(backdrop);
    const metricKeys = ["fontWeight", "fontSize", "fontFamily", "fontStyle", "letterSpacing", "wordSpacing", "lineHeight", "tabSize", "whiteSpace"];
    return {
      editorScrollHeight: editor.scrollHeight,
      overlayScrollHeight: overlay.scrollHeight,
      backdropScrollHeight: backdrop.scrollHeight,
      overlayDelta: overlay.scrollHeight - editor.scrollHeight,
      backdropDelta: backdrop.scrollHeight - editor.scrollHeight,
      overlayMetricsMatch: metricKeys.every((key) => editorStyle[key] === overlayStyle[key]),
      backdropMetricsMatch: metricKeys.every((key) => editorStyle[key] === backdropStyle[key]),
      overlayTextMatches: overlay.textContent.replace(/\n$/, "") === editor.value,
      backdropTextMatches: backdrop.textContent.replace(/\n$/, "") === editor.value,
    };
  }

  window.__mdHighlight = {
    SAMPLE,
    prepareEditor,
    loadDocument,
    overlayCategories,
    backgroundLayering,
    bashHighlighting,
    fenceToggle,
    alignment,
  };
  return true;
})()
`;

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

const ALIGN_DOC_CHARS = 20_000;

async function runOnce() {
  assert(typeof WebSocket === "function", "현재 Node.js 런타임이 WebSocket을 지원하지 않습니다.");

  const browserPath = await findBrowser();
  const { server, port: webPort } = await startStaticServer();
  const debugPort = await freePort();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nownote-md-highlight-"));
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
      "Boolean(document.querySelector('#treeContentBackdrop') && typeof repaintTreeHighlightOverlay === 'function')",
      "강조 오버레이/배경 레이어 로드",
    );

    assert(await evaluate(page, PAGE_SETUP), "시험 준비 코드를 붙이지 못했습니다.");
    assert(await evaluate(page, "window.__mdHighlight.prepareEditor()"), "편집기가 화면에 보이지 않습니다.");

    console.log("NowNote Markdown 편집 화면 문법 강조 확인");
    console.log("");

    // 1) 다섯 가지 강조
    const categories = await evaluate(page, "window.__mdHighlight.overlayCategories()");
    console.log("[1] 다섯 가지 강조 - 오버레이(글자)");
    printTable(
      [
        ["제목", categories.headingFound ? "있음" : "없음", categories.headingColor, categories.tokenHeading],
        ["목록 표시", categories.listMarkerFound ? "있음" : "없음", categories.listMarkerColor, categories.tokenListMarker],
        ["링크", categories.linkFound ? "있음" : "없음", categories.linkColor, categories.tokenLink],
        ["인라인 코드", categories.inlineCodeFound ? "있음" : "없음", categories.inlineCodeColor, categories.tokenInlineCode],
        ["코드블록", categories.codeBlockFound ? "있음" : "없음", categories.codeBlockColor, categories.tokenCodeBlockText],
      ],
      ["항목", "발견", "칠해진 색", "토큰 값"],
    );
    if (!categories.headingFound) failures.push("제목 강조 조각을 찾지 못했습니다.");
    if (!categories.listMarkerFound) failures.push("목록 표시 강조 조각을 찾지 못했습니다.");
    if (!categories.linkFound) failures.push("링크 강조 조각을 찾지 못했습니다.");
    if (!categories.inlineCodeFound) failures.push("인라인 코드 강조 조각을 찾지 못했습니다.");
    if (!categories.codeBlockFound) failures.push("코드블록 강조 조각을 찾지 못했습니다.");
    if (categories.headingColor !== hexToRgbNode(categories.tokenHeading)) failures.push(`제목 색이 토큰과 다릅니다 (${categories.headingColor}).`);
    if (categories.listMarkerColor !== categories.tokenListMarker && !colorsClose(categories.listMarkerColor, categories.tokenListMarker)) {
      // --md-list-marker 는 color-mix() 파생값이라 rgb() 문자열로 그대로 비교한다.
      failures.push(`목록 표시 색이 토큰과 다릅니다 (${categories.listMarkerColor} vs ${categories.tokenListMarker}).`);
    }
    if (categories.linkColor !== hexToRgbNode(categories.tokenLink)) failures.push(`링크 색이 토큰과 다릅니다 (${categories.linkColor}).`);
    if (categories.inlineCodeColor !== hexToRgbNode(categories.tokenInlineCode)) failures.push(`인라인 코드 색이 토큰과 다릅니다 (${categories.inlineCodeColor}).`);
    if (categories.codeBlockColor !== hexToRgbNode(categories.tokenCodeBlockText)) failures.push(`코드블록 글자 색이 토큰과 다릅니다 (${categories.codeBlockColor}).`);
    console.log("");

    // 2) 배경 레이어링
    const layering = await evaluate(page, "window.__mdHighlight.backgroundLayering()");
    console.log("[2] 배경은 배경 레이어에만 있는지");
    printTable(
      [[
        String(layering.overlaySpanCount),
        layering.overlayNoBackground ? "없음" : "있음",
        layering.inlineBgFound ? "있음" : "없음",
        layering.inlineBgColor,
        layering.blockBgFound ? "있음" : "없음",
        layering.blockBgColor,
        layering.backdropTextColor,
      ]],
      ["오버레이 조각 수", "오버레이 배경", "인라인 코드 배경(배경 레이어)", "색", "코드블록 배경(배경 레이어)", "색", "배경 레이어 글자색"],
    );
    if (!layering.overlayNoBackground) failures.push("오버레이 조각에 배경이 칠해져 있습니다. 오버레이는 글자색만 칠해야 합니다.");
    if (!layering.inlineBgFound) failures.push("배경 레이어에서 인라인 코드 배경 조각을 찾지 못했습니다.");
    if (!layering.blockBgFound) failures.push("배경 레이어에서 코드블록 배경 조각을 찾지 못했습니다.");
    if (layering.inlineBgColor !== hexToRgbNode(layering.tokenInlineCodeBg)) failures.push(`인라인 코드 배경색이 토큰과 다릅니다 (${layering.inlineBgColor}).`);
    if (layering.blockBgColor !== hexToRgbNode(layering.tokenCodeBlockBg)) failures.push(`코드블록 배경색이 토큰과 다릅니다 (${layering.blockBgColor}).`);
    if (layering.backdropTextColor !== "rgba(0, 0, 0, 0)" && layering.backdropTextColor !== "transparent") {
      failures.push(`배경 레이어 글자색이 투명하지 않습니다 (${layering.backdropTextColor}). 실제 글자가 비쳐 보이면 안 됩니다.`);
    }
    console.log("");

    // 3) bash 최소 강조
    const bash = await evaluate(page, "window.__mdHighlight.bashHighlighting()");
    console.log("[3] bash 코드블록 최소 강조");
    printTable(
      [
        ["옵션(-로 시작)", bash.options.join(", ") || "없음", bash.optionDiffersFromPlain ? "다름" : "같음"],
        ["경로(/ 포함)", bash.paths.join(", ") || "없음", bash.pathDiffersFromPlain ? "다름" : "같음"],
        ["숫자", bash.numbers.join(", ") || "없음", bash.numberDiffersFromPlain ? "다름" : "같음"],
      ],
      ["구분", "찾은 토큰", "기본 코드블록 글자색과"],
    );
    console.log(`python 코드블록 줄에 bash 토큰 구분이 없는지: 찾음 ${bash.pythonLineFound ? "예" : "아니오"}, bash 토큰 있음 ${bash.pythonHasBashTokens ? "예" : "아니오"}`);
    if (bash.options.length === 0) failures.push("bash 옵션 토큰을 찾지 못했습니다.");
    if (bash.paths.length === 0) failures.push("bash 경로 토큰을 찾지 못했습니다.");
    if (bash.numbers.length === 0) failures.push("bash 숫자 토큰을 찾지 못했습니다.");
    if (!bash.optionDiffersFromPlain) failures.push("bash 옵션 색이 기본 코드블록 글자색과 같습니다(구분되지 않음).");
    if (!bash.pathDiffersFromPlain) failures.push("bash 경로 색이 기본 코드블록 글자색과 같습니다(구분되지 않음).");
    if (!bash.numberDiffersFromPlain) failures.push("bash 숫자 색이 기본 코드블록 글자색과 같습니다(구분되지 않음).");
    if (!bash.pythonLineFound) failures.push("python 코드블록 줄을 찾지 못했습니다.");
    if (bash.pythonHasBashTokens) failures.push("python 코드블록 줄에 bash 토큰 구분이 들어가 있습니다(언어 구분이 되지 않음).");
    console.log("");

    // 4) 펜스 여닫기
    const fence = await evaluate(page, "window.__mdHighlight.fenceToggle()");
    console.log("[4] 코드블록 펜스를 여닫을 때 아래 줄의 강조");
    printTable(
      [[
        fence.codeBefore ? "코드" : "평문",
        fence.backdropBefore ? "배경 있음" : "배경 없음",
        fence.codeAfterOpen ? "코드" : "평문",
        fence.backdropAfterOpen ? "배경 있음" : "배경 없음",
        fence.codeAfterClose ? "코드" : "평문",
        fence.textMatches ? "일치" : "불일치",
      ]],
      ["닫기 전 3번째 줄", "배경(닫기 전)", "펜스 지운 뒤 마지막 줄", "배경(펜스 지운 뒤)", "펜스 되돌린 뒤 마지막 줄", "오버레이 글자"],
    );
    if (!fence.codeBefore || !fence.backdropBefore) failures.push("펜스를 열기 전 코드블록 줄이 코드로 칠해지지 않았습니다.");
    if (!fence.codeAfterOpen || !fence.backdropAfterOpen) failures.push("닫는 펜스를 지웠는데도 마지막 줄이 코드블록으로 바뀌지 않았습니다(상태 변화를 놓침).");
    if (fence.codeAfterClose) failures.push("펜스를 되돌렸는데도 마지막 줄이 코드블록 강조로 남아 있습니다.");
    if (!fence.textMatches) failures.push("펜스를 여닫은 뒤 오버레이 글자가 textarea 와 다릅니다.");
    console.log("");

    // 5) 정렬
    const alignment = await evaluate(page, `window.__mdHighlight.alignment(${ALIGN_DOC_CHARS})`);
    console.log(`[5] 배경 레이어 정렬 확인 (${ALIGN_DOC_CHARS.toLocaleString("en-US")}자, 5가지 강조 + bash 섞인 문서)`);
    printTable(
      [[
        String(alignment.editorScrollHeight),
        String(alignment.overlayScrollHeight),
        String(alignment.overlayDelta),
        String(alignment.backdropScrollHeight),
        String(alignment.backdropDelta),
        alignment.overlayMetricsMatch ? "같음" : "다름",
        alignment.backdropMetricsMatch ? "같음" : "다름",
      ]],
      ["textarea 높이", "오버레이 높이", "오버레이 차이(px)", "배경 레이어 높이", "배경 레이어 차이(px)", "오버레이 글자 지표", "배경 레이어 글자 지표"],
    );
    const heightBudget = 2; // 마지막 줄 개행만큼의 오차만 허용한다.
    if (Math.abs(alignment.overlayDelta) > heightBudget) failures.push(`오버레이 높이가 textarea 와 어긋납니다 (차이 ${alignment.overlayDelta}px).`);
    if (Math.abs(alignment.backdropDelta) > heightBudget) failures.push(`배경 레이어 높이가 textarea 와 어긋납니다 (차이 ${alignment.backdropDelta}px).`);
    if (!alignment.overlayMetricsMatch) failures.push("오버레이 글자 지표(굵기·크기·자간 등)가 textarea 와 다릅니다.");
    if (!alignment.backdropMetricsMatch) failures.push("배경 레이어 글자 지표(굵기·크기·자간 등)가 textarea 와 다릅니다.");
    if (!alignment.overlayTextMatches) failures.push("오버레이 글자가 textarea 와 다릅니다.");
    if (!alignment.backdropTextMatches) failures.push("배경 레이어 글자가 textarea 와 다릅니다.");
    console.log("");

    if (failures.length > 0) {
      console.log("확인 실패:");
      failures.forEach((item) => console.log(`- ${item}`));
      throw new Error(`Markdown 강조 확인 실패 ${failures.length}건`);
    }

    console.log("NowNote markdown highlighting check passed");
  } finally {
    browserClient?.close();
    stopBrowserProcess(browser);
    server.close();
    await delay(300);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

function hexToRgbNode(hex) {
  const parsed = /^#([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!parsed) return String(hex).trim().toLowerCase();
  const number = Number.parseInt(parsed[1], 16);
  return `rgb(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255})`;
}

// --md-list-marker 같은 color-mix() 파생 토큰은 브라우저가 계산한 rgb() 문자열을 그대로 돌려주므로
// 완전히 같은 문자열이어야 한다. 그래도 부동소수점 반올림 차이를 대비해 채널별로 여유를 둔다.
function colorsClose(a, b) {
  const parse = (value) => {
    const match = /rgba?\(([^)]+)\)/.exec(String(value));
    if (!match) return null;
    return match[1].split(",").map((part) => Number.parseFloat(part.trim()));
  };
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb || pa.length < 3 || pb.length < 3) return false;
  return pa.slice(0, 3).every((value, index) => Math.abs(value - pb[index]) <= 2);
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
  console.error(`NowNote markdown highlighting check failed: ${error.message}`);
  process.exit(1);
});
