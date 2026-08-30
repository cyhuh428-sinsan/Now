/**
 * NowNote 2.3.6 M9 - Markdown 색상 토큰 확인.
 *
 * 로드맵 10이 요구하는 것을 토큰 쪽에서만 확인한다. 설정 화면은 다음 작업(U4)이다.
 *
 * 확인하는 것:
 *   1. 밝은 모드 / 어두운 모드 기본값이 styles.css 와 app.js 양쪽에서 같은 값인지
 *   2. 보기 모드(.markdown-preview)와 편집 모드 오버레이(.memo-editor-overlay)가
 *      같은 토큰을 읽는지
 *   3. 사용자 값을 넣으면 두 모드에 함께 반영되는지, 모드별로 따로 담기는지
 *   4. Markdown 색만 바꿨을 때 다른 화면이 따라 바뀌지 않는지
 *   5. 기본값 복원이 되는지
 *   6. 저장소에 색이 아닌 값이 들어 있어도 화면이 깨지지 않는지
 *   7. 오버레이가 색만 칠하는지 (굵기·자간·글꼴·배경을 건드리지 않는지) 와
 *      색을 바꿔도 textarea 와의 줄바꿈 정렬이 그대로인지
 *
 * 7번이 이 작업의 핵심 제약이다. M8b 측정에서 오버레이에 글자 굵기를 주자
 * 5만 자 문서에서 오버레이가 textarea 보다 614px 길어졌다.
 * 색상 토큰을 넣으면서 그 제약을 깨지 않았는지 여기서 다시 잰다.
 *
 * 실행:
 *   node web/scripts/check_markdown_colors.mjs
 *
 * 하네스 구조는 web/scripts/check_editor_overlay_perf.mjs 와 같다.
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

// 정렬 확인용 문서 크기. 5만 자 판정은 check_editor_overlay_perf.mjs 가 맡는다.
// 여기서는 색을 바꾸기 전과 뒤의 정렬이 같은지만 본다.
const ALIGN_DOC_CHARS = 20_000;

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
 * 시험용 함수들을 window.__mdColors 에 붙인다. 앱 코드에는 아무것도 남기지 않는다.
 */
const PAGE_SETUP = String.raw`
(() => {
  const editor = elements.treeContent;
  const overlay = elements.treeContentOverlay;
  const preview = elements.markdownPreview;
  const TICK = String.fromCharCode(96);
  const FENCE = TICK + TICK + TICK;

  // 다섯 가지 색이 모두 나오는 짧은 문서.
  const SAMPLE = [
    "# 색상 토큰 확인 문서",
    "",
    "## 두 번째 제목",
    "본문에 [바깥 링크](https://example.com) 와 " + TICK + "인라인 코드" + TICK + " 를 섞는다.",
    "",
    FENCE + "bash",
    "node web/scripts/check_markdown_colors.mjs",
    FENCE,
    "",
  ].join("\n");

  // 정렬 확인용. 길이가 제각각인 라틴 글자를 섞는다.
  // 오버레이가 굵기나 자간을 건드리면 줄바꿈 위치가 여기서 어긋난다.
  function buildAlignDocument(targetChars) {
    const parts = [];
    let total = 0;
    let index = 0;
    const longSentence = "이 문장은 줄바꿈 규칙과 정렬을 확인하려고 일부러 아주 길게 이어 붙인 한국어 문장입니다. ";
    while (total < targetChars) {
      index += 1;
      const block = [
        "# " + index + "장 제목 줄",
        "#### " + index + ".0 long latin heading " + "overlay alignment regression guard ".repeat(3) + "x".repeat(index % 40),
        "본문 " + longSentence.repeat(2),
        "인라인 코드 " + TICK + "applyMarkdownColors()" + TICK + " 와 " + TICK + "setMarkdownColor(id, value)" + TICK + " 를 섞는다.",
        "\tThe quick brown fox jumps over the lazy dog. " + "iiii WWWW llll MMMM ".repeat(2),
        "",
      ].join("\n");
      parts.push(block);
      total += block.length + 1;
    }
    return parts.join("\n").slice(0, targetChars);
  }

  function prepareEditor() {
    state.data = defaultData();
    const node = createNode("Markdown 색상 확인", "", null, 1);
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
    return editor.value.length;
  }

  function previewShown() {
    return !preview.classList.contains("hidden");
  }

  function setPreview(shown) {
    if (previewShown() !== shown) elements.previewToggleBtn.click();
    return previewShown() === shown;
  }

  function setTheme(theme) {
    state.settings.theme = theme;
    applySettings();
    return document.documentElement.dataset.theme;
  }

  function hexToRgb(hex) {
    const value = String(hex).trim().toLowerCase();
    const parsed = /^#([0-9a-f]{6})$/.exec(value);
    if (!parsed) return "";
    const number = parseInt(parsed[1], 16);
    return "rgb(" + ((number >> 16) & 255) + ", " + ((number >> 8) & 255) + ", " + (number & 255) + ")";
  }

  function tokenValue(token) {
    return getComputedStyle(document.documentElement).getPropertyValue(token).trim().toLowerCase();
  }

  function inlineTokenValue(token) {
    return document.documentElement.style.getPropertyValue(token).trim().toLowerCase();
  }

  // styles.css 기본값과 app.js 표(MARKDOWN_COLOR_TOKENS)가 같은지 본다.
  // 두 곳에 값이 있어야 하는 구조라 갈라지면 설정 화면이 엉뚱한 값을 보여 준다.
  function defaultsMatch(mode) {
    resetMarkdownColors();
    setTheme(mode);
    return MARKDOWN_COLOR_TOKENS.map((item) => ({
      id: item.id,
      token: item.token,
      css: tokenValue(item.token),
      js: item[mode],
      value: markdownColorValue(item.id, mode),
      inline: inlineTokenValue(item.token),
      ok: tokenValue(item.token) === item[mode]
        && markdownColorValue(item.id, mode) === item[mode]
        && inlineTokenValue(item.token) === "",
    }));
  }

  // 보기 모드가 실제로 그 토큰을 칠하는지.
  function previewPaint() {
    setPreview(true);
    // 보기 모드는 저장된 메모 본문에서 그린다. 시험 문서를 그 자리에 직접 그려 넣는다.
    renderMarkdownPreview(SAMPLE);
    const heading = preview.querySelector("h1");
    const link = preview.querySelector("a");
    const inlineCode = Array.from(preview.querySelectorAll("code")).find((node) => node.parentElement.tagName !== "PRE");
    const block = preview.querySelector("pre");
    const blockCode = preview.querySelector("pre code");
    const result = {
      found: Boolean(heading && link && inlineCode && block && blockCode),
      heading: heading ? getComputedStyle(heading).color : "",
      link: link ? getComputedStyle(link).color : "",
      inlineCode: inlineCode ? getComputedStyle(inlineCode).color : "",
      inlineCodeBg: inlineCode ? getComputedStyle(inlineCode).backgroundColor : "",
      codeBlockBg: block ? getComputedStyle(block).backgroundColor : "",
      codeBlockText: blockCode ? getComputedStyle(blockCode).color : "",
    };
    setPreview(false);
    return result;
  }

  // 편집 모드 오버레이가 실제로 그 토큰을 칠하는지.
  function overlayPaint() {
    setPreview(false);
    loadDocument(SAMPLE);
    const heading = overlay.querySelector(".md-heading");
    const code = overlay.querySelector(".md-code");
    return {
      found: Boolean(heading && code),
      heading: heading ? getComputedStyle(heading).color : "",
      inlineCode: code ? getComputedStyle(code).color : "",
      headingBg: heading ? getComputedStyle(heading).backgroundColor : "",
      codeBg: code ? getComputedStyle(code).backgroundColor : "",
    };
  }

  function expectedPaint(mode) {
    return Object.fromEntries(MARKDOWN_COLOR_TOKENS.map((item) => [item.id, hexToRgb(markdownColorValue(item.id, mode))]));
  }

  // Markdown 색만 바꿨을 때 따라 움직이면 안 되는 값들.
  function otherSurfaces() {
    const body = getComputedStyle(document.body);
    const root = getComputedStyle(document.documentElement);
    const button = document.querySelector(".primary-btn");
    return {
      bodyColor: body.color,
      bodyBackground: body.backgroundColor,
      text: root.getPropertyValue("--text").trim(),
      blue: root.getPropertyValue("--blue").trim(),
      panel: root.getPropertyValue("--panel").trim(),
      amber: root.getPropertyValue("--amber").trim(),
      buttonBackground: button ? getComputedStyle(button).backgroundColor : "",
    };
  }

  function applyCustom(mode, colors) {
    return MARKDOWN_COLOR_TOKENS.map((item) => ({
      id: item.id,
      accepted: setMarkdownColor(item.id, colors[item.id], mode),
      changed: isMarkdownColorChanged(item.id, mode),
    }));
  }

  // 오버레이는 색만 칠할 수 있다.
  // 글자 굵기·크기·자간·글꼴을 건드리면 줄바꿈 위치가 textarea 와 달라진다.
  function overlayConstraint() {
    setPreview(false);
    // applySettings() 가 화면을 다시 그리면서 오버레이를 비웠을 수 있다. 다시 채운다.
    loadDocument(SAMPLE);
    const editorStyle = getComputedStyle(editor);
    const overlayStyle = getComputedStyle(overlay);
    const spans = Array.from(overlay.querySelectorAll(".md-heading, .md-code"));
    const metricKeys = ["fontWeight", "fontSize", "fontFamily", "fontStyle", "fontStretch", "letterSpacing", "wordSpacing", "textTransform", "lineHeight"];
    const overlayMatchesEditor = metricKeys.every((key) => editorStyle[key] === overlayStyle[key]);
    const spanReport = spans.slice(0, 8).map((span) => {
      const style = getComputedStyle(span);
      return {
        className: span.className,
        sameMetrics: metricKeys.every((key) => style[key] === overlayStyle[key]),
        background: style.backgroundColor,
        textShadow: style.textShadow,
      };
    });
    return {
      spanCount: spans.length,
      overlayMatchesEditor,
      spansMatchOverlay: spanReport.every((item) => item.sameMetrics),
      spansHaveNoBackground: spanReport.every((item) => item.background === "rgba(0, 0, 0, 0)" || item.background === "transparent"),
      spansHaveNoShadow: spanReport.every((item) => item.textShadow === "none"),
      sample: spanReport.slice(0, 2),
      mismatched: metricKeys.filter((key) => editorStyle[key] !== overlayStyle[key]),
    };
  }

  // 색을 바꾸기 전과 뒤의 줄바꿈 정렬.
  function alignment() {
    setPreview(false);
    loadDocument(buildAlignDocument(${ALIGN_DOC_CHARS}));
    syncTreeHighlightOverlayMetrics();
    repaintTreeHighlightOverlay(true);
    const lineHeight = parseFloat(getComputedStyle(overlay).lineHeight) || 0;
    const delta = overlay.scrollHeight - editor.scrollHeight;
    return {
      lineHeight,
      editorScrollHeight: editor.scrollHeight,
      overlayScrollHeight: overlay.scrollHeight,
      heightDelta: delta,
      // 오버레이는 마지막 줄에도 줄바꿈을 붙이므로 한 줄만큼 더 높다.
      aligned: Math.abs(delta) <= Math.ceil(lineHeight) + 1,
      textMatches: overlay.textContent.replace(/\n$/, "") === editor.value,
    };
  }

  // 저장소에 색이 아닌 값이 들어 있는 상태를 만든다.
  async function brokenStorage() {
    const payload = {
      ...state.settings,
      markdownColors: {
        light: {
          heading: "red; background: url(https://example.com/x.png)",
          link: 12345,
          inlineCode: null,
          inlineCodeBg: "#12",
          codeBlockBg: "rgb(1, 2, 3)",
          codeBlockText: "  #ABCDEF  ",
        },
        dark: "이건 객체가 아니다",
      },
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
    await loadSettings();
    applySettings();
    const stored = state.settings.markdownColors;
    return {
      // 읽을 수 있는 값 하나(#ABCDEF)만 살아남고 나머지는 버려져야 한다.
      lightKeys: Object.keys(stored.light).sort(),
      darkIsObject: Boolean(stored.dark) && typeof stored.dark === "object" && !Array.isArray(stored.dark),
      darkKeys: Object.keys(stored.dark || {}),
      codeBlockText: stored.light.codeBlockText || "",
      headingToken: tokenValue("--md-heading"),
      headingInline: inlineTokenValue("--md-heading"),
      linkToken: tokenValue("--md-link"),
      codeBlockTextToken: tokenValue("--md-code-block-text"),
    };
  }

  function directPoke() {
    // 저장소를 거치지 않고 state 를 직접 망가뜨려도 화면이 깨지지 않아야 한다.
    state.settings.markdownColors = { light: { heading: "javascript:alert(1)" }, dark: null };
    applySettings();
    return {
      headingToken: tokenValue("--md-heading"),
      headingInline: inlineTokenValue("--md-heading"),
      value: markdownColorValue("heading", "light"),
    };
  }

  window.__mdColors = {
    SAMPLE,
    prepareEditor,
    loadDocument,
    setPreview,
    setTheme,
    hexToRgb,
    tokenValue,
    inlineTokenValue,
    defaultsMatch,
    previewPaint,
    overlayPaint,
    expectedPaint,
    otherSurfaces,
    applyCustom,
    overlayConstraint,
    alignment,
    brokenStorage,
    directPoke,
    reset: () => {
      resetMarkdownColors();
      return MARKDOWN_COLOR_TOKENS.every((item) => inlineTokenValue(item.token) === "");
    },
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

const CUSTOM_LIGHT = {
  heading: "#a21caf",
  link: "#0f766e",
  inlineCode: "#be123c",
  inlineCodeBg: "#fef3c7",
  codeBlockBg: "#1c1917",
  codeBlockText: "#fde68a",
};

const CUSTOM_DARK = {
  heading: "#f0abfc",
  link: "#5eead4",
  inlineCode: "#fda4af",
  inlineCodeBg: "#1e1b4b",
  codeBlockBg: "#020617",
  codeBlockText: "#fef08a",
};

async function runOnce() {
  assert(typeof WebSocket === "function", "현재 Node.js 런타임이 WebSocket을 지원하지 않습니다.");

  const browserPath = await findBrowser();
  const { server, port: webPort } = await startStaticServer();
  const debugPort = await freePort();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nownote-md-colors-"));
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
      "typeof MARKDOWN_COLOR_TOKENS !== 'undefined' && typeof applyMarkdownColors === 'function' && typeof resetMarkdownColors === 'function'",
      "Markdown 색상 토큰 로드",
    );

    assert(await evaluate(page, PAGE_SETUP), "시험 준비 코드를 붙이지 못했습니다.");
    assert(await evaluate(page, "window.__mdColors.prepareEditor()"), "편집기가 화면에 보이지 않습니다.");

    console.log("NowNote Markdown 색상 토큰 확인");
    console.log("대상: 보기 모드(.markdown-preview) / 편집 모드 오버레이(.memo-editor-overlay)");
    console.log("");

    // 1) 기본값 - styles.css 와 app.js 표가 같은 값인지
    for (const mode of ["light", "dark"]) {
      const rows = await evaluate(page, `window.__mdColors.defaultsMatch(${JSON.stringify(mode)})`);
      console.log(`[1] ${mode === "light" ? "밝은" : "어두운"} 모드 기본값`);
      printTable(
        rows.map((row) => [row.id, row.token, row.css, row.js, row.inline === "" ? "없음" : row.inline, row.ok ? "같음" : "다름"]),
        ["항목", "토큰", "styles.css", "app.js 표", "인라인 값", "판정"],
      );
      rows.filter((row) => !row.ok).forEach((row) => {
        failures.push(`${mode} 기본값이 갈라졌습니다: ${row.id} (styles.css ${row.css} / app.js ${row.js} / 인라인 ${row.inline || "없음"})`);
      });
      console.log("");
    }

    // 2) 보기 모드와 편집 모드가 같은 토큰을 읽는지 (기본값 상태, 두 테마 모두)
    for (const mode of ["light", "dark"]) {
      await evaluate(page, "window.__mdColors.reset()");
      await evaluate(page, `window.__mdColors.setTheme(${JSON.stringify(mode)})`);
      const expected = await evaluate(page, `window.__mdColors.expectedPaint(${JSON.stringify(mode)})`);
      const previewPaint = await evaluate(page, "window.__mdColors.previewPaint()");
      const overlayPaint = await evaluate(page, "window.__mdColors.overlayPaint()");
      if (!previewPaint.found) failures.push(`${mode}: 보기 모드에서 제목·링크·인라인 코드·코드블록을 모두 찾지 못했습니다.`);
      if (!overlayPaint.found) failures.push(`${mode}: 편집 모드 오버레이에서 제목·인라인 코드 조각을 찾지 못했습니다.`);

      const rows = [
        ["제목", "--md-heading", expected.heading, previewPaint.heading, overlayPaint.heading],
        ["링크", "--md-link", expected.link, previewPaint.link, "-"],
        ["인라인 코드", "--md-inline-code-text", expected.inlineCode, previewPaint.inlineCode, overlayPaint.inlineCode],
        ["인라인 코드 배경", "--md-inline-code-bg", expected.inlineCodeBg, previewPaint.inlineCodeBg, "-"],
        ["코드블록 배경", "--md-code-block-bg", expected.codeBlockBg, previewPaint.codeBlockBg, "-"],
        ["코드블록 글자", "--md-code-block-text", expected.codeBlockText, previewPaint.codeBlockText, "-"],
      ];
      console.log(`[2] ${mode === "light" ? "밝은" : "어두운"} 모드 - 두 모드가 같은 토큰을 읽는지`);
      printTable(
        rows.map((row) => [
          row[0],
          row[1],
          row[2],
          row[3] === row[2] ? "일치" : `다름(${row[3]})`,
          row[4] === "-" ? "해당 없음" : (row[4] === row[2] ? "일치" : `다름(${row[4]})`),
        ]),
        ["항목", "토큰", "토큰 값", "보기 모드", "편집 모드"],
      );
      rows.forEach((row) => {
        if (row[3] !== row[2]) failures.push(`${mode}: 보기 모드 ${row[0]} 색이 토큰과 다릅니다 (${row[3]} != ${row[2]}).`);
        if (row[4] !== "-" && row[4] !== row[2]) failures.push(`${mode}: 편집 모드 ${row[0]} 색이 토큰과 다릅니다 (${row[4]} != ${row[2]}).`);
      });
      console.log("");
    }

    // 3) 사용자 값 반영 - 모드별로 따로 담기는지
    await evaluate(page, "window.__mdColors.reset()");
    const before = await evaluate(page, "window.__mdColors.setTheme('light'), window.__mdColors.otherSurfaces()");
    const alignBefore = await evaluate(page, "window.__mdColors.alignment()");
    const appliedLight = await evaluate(page, `window.__mdColors.applyCustom('light', ${JSON.stringify(CUSTOM_LIGHT)})`);
    const appliedDark = await evaluate(page, `window.__mdColors.applyCustom('dark', ${JSON.stringify(CUSTOM_DARK)})`);
    const rejected = [...appliedLight, ...appliedDark].filter((item) => !item.accepted || !item.changed);
    if (rejected.length > 0) failures.push(`사용자 값이 저장되지 않은 항목이 있습니다: ${rejected.map((item) => item.id).join(", ")}`);

    for (const [mode, custom] of [["light", CUSTOM_LIGHT], ["dark", CUSTOM_DARK]]) {
      await evaluate(page, `window.__mdColors.setTheme(${JSON.stringify(mode)})`);
      const expected = await evaluate(page, `window.__mdColors.expectedPaint(${JSON.stringify(mode)})`);
      const previewPaint = await evaluate(page, "window.__mdColors.previewPaint()");
      const overlayPaint = await evaluate(page, "window.__mdColors.overlayPaint()");
      const wanted = Object.fromEntries(Object.entries(custom).map(([id, hex]) => [id, hexToRgbNode(hex)]));
      const rows = [
        ["제목", wanted.heading, expected.heading, previewPaint.heading, overlayPaint.heading],
        ["링크", wanted.link, expected.link, previewPaint.link, "-"],
        ["인라인 코드", wanted.inlineCode, expected.inlineCode, previewPaint.inlineCode, overlayPaint.inlineCode],
        ["인라인 코드 배경", wanted.inlineCodeBg, expected.inlineCodeBg, previewPaint.inlineCodeBg, "-"],
        ["코드블록 배경", wanted.codeBlockBg, expected.codeBlockBg, previewPaint.codeBlockBg, "-"],
        ["코드블록 글자", wanted.codeBlockText, expected.codeBlockText, previewPaint.codeBlockText, "-"],
      ];
      console.log(`[3] ${mode === "light" ? "밝은" : "어두운"} 모드 - 사용자 값 반영`);
      printTable(
        rows.map((row) => [
          row[0],
          row[1],
          row[3] === row[1] ? "일치" : `다름(${row[3]})`,
          row[4] === "-" ? "해당 없음" : (row[4] === row[1] ? "일치" : `다름(${row[4]})`),
        ]),
        ["항목", "설정한 값", "보기 모드", "편집 모드"],
      );
      rows.forEach((row) => {
        if (row[2] !== row[1]) failures.push(`${mode}: 사용자 값이 토큰에 들어가지 않았습니다 (${row[0]}).`);
        if (row[3] !== row[1]) failures.push(`${mode}: 보기 모드 ${row[0]} 에 사용자 값이 반영되지 않았습니다.`);
        if (row[4] !== "-" && row[4] !== row[1]) failures.push(`${mode}: 편집 모드 ${row[0]} 에 사용자 값이 반영되지 않았습니다.`);
      });
      console.log("");
    }

    // 4) Markdown 색만 바꿨을 때 다른 화면이 따라 바뀌지 않는지
    await evaluate(page, "window.__mdColors.setTheme('light')");
    const after = await evaluate(page, "window.__mdColors.otherSurfaces()");
    const otherRows = Object.keys(before).map((key) => [key, before[key], after[key], before[key] === after[key] ? "그대로" : "바뀜"]);
    console.log("[4] Markdown 색만 바꿨을 때 다른 화면");
    printTable(otherRows, ["대상", "바꾸기 전", "바꾼 뒤", "판정"]);
    otherRows.filter((row) => row[3] === "바뀜").forEach((row) => {
      failures.push(`Markdown 색을 바꿨는데 다른 화면이 따라 바뀌었습니다: ${row[0]} (${row[1]} -> ${row[2]})`);
    });
    console.log("");

    // 5) 오버레이 제약 - 색만 칠하는지, 정렬이 그대로인지
    const constraint = await evaluate(page, "window.__mdColors.overlayConstraint()");
    const alignAfter = await evaluate(page, "window.__mdColors.alignment()");
    console.log("[5] 오버레이 제약 (색만 칠할 수 있다)");
    printTable(
      [[
        String(constraint.spanCount),
        constraint.overlayMatchesEditor ? "같음" : `다름(${constraint.mismatched.join(", ")})`,
        constraint.spansMatchOverlay ? "같음" : "다름",
        constraint.spansHaveNoBackground ? "없음" : "있음",
        constraint.spansHaveNoShadow ? "없음" : "있음",
      ]],
      ["색칠 조각 수", "오버레이 vs textarea 글자 지표", "조각 vs 오버레이 글자 지표", "조각 배경", "조각 그림자"],
    );
    if (constraint.spanCount === 0) failures.push("오버레이에 색칠된 조각이 하나도 없습니다.");
    if (!constraint.overlayMatchesEditor) failures.push(`오버레이 글자 지표가 textarea 와 다릅니다: ${constraint.mismatched.join(", ")}`);
    if (!constraint.spansMatchOverlay) failures.push("색칠 조각이 오버레이와 다른 글자 지표를 갖고 있습니다(굵기·자간·글꼴 변경).");
    if (!constraint.spansHaveNoBackground) failures.push("오버레이 조각에 배경색이 칠해져 있습니다. 오버레이는 글자 색만 칠해야 합니다.");
    if (!constraint.spansHaveNoShadow) failures.push("오버레이 조각에 그림자가 있습니다.");

    console.log("");
    console.log(`[6] 색을 바꿔도 줄바꿈 정렬이 그대로인지 (${ALIGN_DOC_CHARS.toLocaleString("en-US")}자)`);
    printTable(
      [
        ["기본 색", String(alignBefore.editorScrollHeight), String(alignBefore.overlayScrollHeight), String(alignBefore.heightDelta), alignBefore.aligned ? "맞음" : "어긋남", alignBefore.textMatches ? "일치" : "불일치"],
        ["사용자 색", String(alignAfter.editorScrollHeight), String(alignAfter.overlayScrollHeight), String(alignAfter.heightDelta), alignAfter.aligned ? "맞음" : "어긋남", alignAfter.textMatches ? "일치" : "불일치"],
      ],
      ["상태", "textarea 높이", "오버레이 높이", "차이(px)", "정렬", "글자"],
    );
    if (!alignBefore.aligned) failures.push(`기본 색에서 줄바꿈 정렬이 어긋납니다 (차이 ${alignBefore.heightDelta}px).`);
    if (!alignAfter.aligned) failures.push(`사용자 색에서 줄바꿈 정렬이 어긋납니다 (차이 ${alignAfter.heightDelta}px).`);
    if (alignBefore.heightDelta !== alignAfter.heightDelta) {
      failures.push(`색을 바꾸자 정렬이 달라졌습니다 (${alignBefore.heightDelta}px -> ${alignAfter.heightDelta}px).`);
    }
    if (!alignAfter.textMatches) failures.push("사용자 색을 넣은 뒤 오버레이 글자가 textarea 와 다릅니다.");
    console.log("");

    // 7) 기본값 복원
    const resetOk = await evaluate(page, "window.__mdColors.reset()");
    const afterReset = await evaluate(page, "window.__mdColors.defaultsMatch('light')");
    const resetAllOk = resetOk && afterReset.every((row) => row.ok);
    console.log(`[7] 기본값 복원: 인라인 값 지움 ${resetOk ? "예" : "아니오"}, 기본값 복귀 ${afterReset.every((row) => row.ok) ? "예" : "아니오"} -> ${resetAllOk ? "통과" : "실패"}`);
    if (!resetAllOk) failures.push("기본값 복원이 되지 않습니다.");

    // 8) 잘못된 값이 저장돼 있을 때
    const broken = await evaluate(page, "window.__mdColors.brokenStorage()");
    const expectedLightHeading = await evaluate(page, "MARKDOWN_COLOR_TOKENS.find((item) => item.id === 'heading').light");
    const expectedLightLink = await evaluate(page, "MARKDOWN_COLOR_TOKENS.find((item) => item.id === 'link').light");
    const brokenOk = broken.lightKeys.join(",") === "codeBlockText"
      && broken.codeBlockText === "#abcdef"
      && broken.darkIsObject
      && broken.darkKeys.length === 0
      && broken.headingToken === expectedLightHeading
      && broken.headingInline === ""
      && broken.linkToken === expectedLightLink
      && broken.codeBlockTextToken === "#abcdef";
    console.log("[8] 저장소에 색이 아닌 값이 들어 있을 때");
    printTable(
      [[
        broken.lightKeys.join(", ") || "없음",
        broken.codeBlockText || "없음",
        broken.darkIsObject ? `객체(항목 ${broken.darkKeys.length}개)` : "객체 아님",
        broken.headingToken,
        broken.headingInline === "" ? "없음" : broken.headingInline,
        brokenOk ? "통과" : "실패",
      ]],
      ["살아남은 밝은 모드 항목", "정리된 값", "어두운 모드", "제목 토큰", "제목 인라인 값", "판정"],
    );
    if (!brokenOk) failures.push("저장소에 잘못된 값이 있을 때 기본값으로 돌아가지 않습니다.");

    const poke = await evaluate(page, "window.__mdColors.directPoke()");
    const pokeOk = poke.headingToken === expectedLightHeading && poke.headingInline === "" && poke.value === expectedLightHeading;
    console.log(`[9] state 를 직접 망가뜨렸을 때: 제목 토큰 ${poke.headingToken}, 인라인 값 ${poke.headingInline === "" ? "없음" : poke.headingInline} -> ${pokeOk ? "통과" : "실패"}`);
    if (!pokeOk) failures.push("state 에 색이 아닌 값이 들어가면 화면 토큰이 기본값으로 돌아가지 않습니다.");
    console.log("");

    if (failures.length > 0) {
      console.log("확인 실패:");
      failures.forEach((item) => console.log(`- ${item}`));
      throw new Error(`Markdown 색상 토큰 확인 실패 ${failures.length}건`);
    }

    console.log("NowNote markdown colors check passed");
  } finally {
    browserClient?.close();
    stopBrowserProcess(browser);
    server.close();
    await delay(300);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

function hexToRgbNode(hex) {
  const parsed = /^#([0-9a-f]{6})$/.exec(String(hex).trim().toLowerCase());
  if (!parsed) return "";
  const number = Number.parseInt(parsed[1], 16);
  return `rgb(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255})`;
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
  console.error(`NowNote markdown colors check failed: ${error.message}`);
  process.exit(1);
});
