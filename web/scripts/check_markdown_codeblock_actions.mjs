/**
 * NowNote 2.3.6 U3 - Markdown 보기 모드 코드블록 언어 표시 / 복사 버튼 확인.
 *
 * 확인하는 것:
 *   1. 코드블록에 펜스 언어(예: bash, python)가 화면에 표시되는지
 *   2. 언어가 없는 코드블록은 기본 표시(텍스트)로 대체되는지
 *   3. 복사 버튼을 누르면 클립보드로 코드 텍스트(태그 제외)가 전달되는지
 *   4. 복사 후 버튼 문구가 "복사됨"으로 바뀌고 시간이 지나면 원래 문구로 돌아오는지
 *   5. 코드블록이 가로로 스크롤되는지(overflow-x), 줄이 강제로 꺾이지 않는지
 *   6. 코드블록 배경/글자색이 M9 토큰(--md-code-block-bg / --md-code-block-text)을 그대로 쓰는지
 *
 * 하네스 구조는 web/scripts/check_markdown_colors.mjs 와 같다.
 *
 * 실행:
 *   node web/scripts/check_markdown_codeblock_actions.mjs
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

/**
 * 페이지 안에서 돌 준비 코드.
 * 시험용 함수들을 window.__mdCodeBlocks 에 붙인다. 앱 코드에는 아무것도 남기지 않는다.
 */
const PAGE_SETUP = String.raw`
(() => {
  const preview = elements.markdownPreview;
  const TICK = String.fromCharCode(96);
  const FENCE = TICK + TICK + TICK;
  const LONG_LINE = "echo " + "a".repeat(400);

  const SAMPLE = [
    "언어가 있는 코드블록:",
    "",
    FENCE + "bash",
    "npm install --save-dev now-note",
    LONG_LINE,
    FENCE,
    "",
    "언어가 없는 코드블록:",
    "",
    FENCE,
    "plain block",
    FENCE,
    "",
    "다른 언어 코드블록:",
    "",
    FENCE + "python",
    "print('hi')",
    FENCE,
    "",
  ].join("\n");

  function prepareEditor() {
    state.data = defaultData();
    const node = createNode("코드블록 확인", "", null, 1);
    state.data.tree = [node];
    state.selectedTreeId = node.id;
    state.view = "tree";
    state.search = "";
    render();
    return Boolean(preview.offsetParent !== undefined);
  }

  function previewShown() {
    return !preview.classList.contains("hidden");
  }

  function setPreview(shown) {
    if (previewShown() !== shown) elements.previewToggleBtn.click();
    return previewShown() === shown;
  }

  function renderSample() {
    setPreview(true);
    renderMarkdownPreview(SAMPLE);
    return preview.querySelectorAll(".code-block").length;
  }

  function tokenValue(token) {
    return getComputedStyle(document.documentElement).getPropertyValue(token).trim().toLowerCase();
  }

  function blockInfo() {
    const blocks = Array.from(preview.querySelectorAll(".code-block"));
    return blocks.map((block) => {
      const langEl = block.querySelector(".code-block-lang");
      const btn = block.querySelector(".code-block-copy-btn");
      const codeEl = block.querySelector("pre code");
      const pre = block.querySelector("pre");
      return {
        lang: langEl ? langEl.textContent : null,
        hasCopyBtn: Boolean(btn),
        copyBtnText: btn ? btn.textContent : null,
        codeText: codeEl ? codeEl.textContent : null,
        preOverflowX: pre ? getComputedStyle(pre).overflowX : null,
        preWhiteSpace: pre ? getComputedStyle(pre).whiteSpace : null,
        scrollWidthGtClientWidth: pre ? pre.scrollWidth > pre.clientWidth : null,
        headerBg: block.querySelector(".code-block-header")
          ? getComputedStyle(block.querySelector(".code-block-header")).backgroundColor
          : null,
        preBg: pre ? getComputedStyle(pre).backgroundColor : null,
        preColor: pre ? getComputedStyle(pre).color : null,
      };
    });
  }

  // navigator.clipboard.writeText 를 가짜로 바꿔서 실제로 무엇을 넘겼는지 잡는다.
  let lastCopied = null;
  function stubClipboard() {
    lastCopied = null;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text) => {
          lastCopied = text;
          return Promise.resolve();
        },
      },
    });
  }

  function lastCopiedText() {
    return lastCopied;
  }

  async function clickCopyButton(index) {
    const blocks = Array.from(preview.querySelectorAll(".code-block"));
    const btn = blocks[index]?.querySelector(".code-block-copy-btn");
    if (!btn) return { ok: false };
    const before = btn.textContent;
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    const afterClickText = btn.textContent;
    return { ok: true, before, afterClickText };
  }

  async function copyButtonRevert(index, waitMs) {
    const blocks = Array.from(preview.querySelectorAll(".code-block"));
    const btn = blocks[index]?.querySelector(".code-block-copy-btn");
    if (!btn) return null;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return btn.textContent;
  }

  window.__mdCodeBlocks = {
    prepareEditor,
    setPreview,
    renderSample,
    blockInfo,
    stubClipboard,
    lastCopiedText,
    clickCopyButton,
    copyButtonRevert,
    tokenValue,
  };
  return true;
})();
`;

async function runOnce() {
  assert(typeof WebSocket === "function", "현재 Node.js 런타임이 WebSocket을 지원하지 않습니다.");

  const browserPath = await findBrowser();
  const { server, port: webPort } = await startStaticServer();
  const debugPort = await freePort();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nownote-md-codeblock-"));
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
      "typeof renderMarkdownPreview === 'function' && typeof elements !== 'undefined'",
      "Markdown 미리보기 로드",
    );

    assert(await evaluate(page, PAGE_SETUP), "시험 준비 코드를 붙이지 못했습니다.");
    assert(await evaluate(page, "window.__mdCodeBlocks.prepareEditor()"), "편집기가 화면에 보이지 않습니다.");
    await evaluate(page, "window.__mdCodeBlocks.stubClipboard()");

    console.log("NowNote Markdown 보기 모드 코드블록 언어 표시 / 복사 버튼 확인");
    console.log("");

    const blockCount = await evaluate(page, "window.__mdCodeBlocks.renderSample()");
    if (blockCount !== 3) failures.push(`코드블록 3개가 나와야 하는데 ${blockCount}개 나왔습니다.`);

    const info = await evaluate(page, "window.__mdCodeBlocks.blockInfo()");

    console.log("[1] 언어 표시 / 복사 버튼 존재");
    printTable(
      info.map((item, index) => [index, item.lang, item.hasCopyBtn ? "있음" : "없음", item.copyBtnText]),
      ["#", "언어 표시", "복사 버튼", "버튼 글자"],
    );
    if (info[0]?.lang !== "bash") failures.push(`첫 코드블록 언어 표시가 bash가 아닙니다: ${info[0]?.lang}`);
    if (info[2]?.lang !== "python") failures.push(`세 번째 코드블록 언어 표시가 python이 아닙니다: ${info[2]?.lang}`);
    if (!info[1]?.lang || info[1].lang === "") failures.push("언어가 없는 코드블록에 기본 표시가 없습니다.");
    if (info.some((item) => !item.hasCopyBtn)) failures.push("모든 코드블록에 복사 버튼이 있어야 합니다.");

    console.log("");
    console.log("[2] 코드 텍스트가 태그 없이 그대로 보존되는지");
    const codeOk = info[0]?.codeText?.includes("npm install --save-dev now-note")
      && info[0]?.codeText?.includes("a".repeat(400));
    printTable([[codeOk ? "일치" : "불일치"]], ["판정"]);
    if (!codeOk) failures.push("첫 코드블록의 코드 텍스트가 원본과 다릅니다.");

    console.log("");
    console.log("[3] 가로 스크롤 / 줄바꿈 강제 여부 (400자 긴 줄 포함)");
    printTable(
      info.map((item, index) => [index, item.preOverflowX, item.preWhiteSpace, item.scrollWidthGtClientWidth]),
      ["#", "overflow-x", "white-space", "scrollWidth>clientWidth"],
    );
    if (!["auto", "scroll"].includes(info[0]?.preOverflowX)) {
      failures.push(`긴 줄이 있는 코드블록의 overflow-x가 가로 스크롤이 아닙니다: ${info[0]?.preOverflowX}`);
    }
    if (info[0]?.preWhiteSpace === "normal") {
      failures.push("코드블록 줄바꿈이 강제로 꺾이고 있습니다(white-space: normal).");
    }
    if (info[0]?.scrollWidthGtClientWidth !== true) {
      failures.push("400자 긴 줄이 가로 스크롤을 만들지 않았습니다.");
    }

    console.log("");
    console.log("[4] 배경/글자색이 M9 토큰을 그대로 쓰는지");
    const codeBlockBgToken = await evaluate(page, "window.__mdCodeBlocks.tokenValue('--md-code-block-bg')");
    const codeBlockTextToken = await evaluate(page, "window.__mdCodeBlocks.tokenValue('--md-code-block-text')");
    printTable(
      [[codeBlockBgToken, info[0]?.preBg, info[0]?.headerBg]],
      ["토큰(--md-code-block-bg)", "pre 배경", "헤더 배경"],
    );
    const bgHex = hexToRgbLoose(codeBlockBgToken);
    if (bgHex && info[0]?.preBg !== bgHex) {
      failures.push(`pre 배경이 --md-code-block-bg 토큰과 다릅니다: ${info[0]?.preBg} vs ${bgHex}`);
    }
    if (bgHex && info[0]?.headerBg !== bgHex) {
      failures.push(`헤더 배경이 --md-code-block-bg 토큰과 다릅니다: ${info[0]?.headerBg} vs ${bgHex}`);
    }
    void codeBlockTextToken;

    console.log("");
    console.log("[5] 복사 버튼을 누르면 클립보드로 코드 텍스트가 전달되는지");
    const clickResult = await evaluate(page, "window.__mdCodeBlocks.clickCopyButton(0)");
    const copiedText = await evaluate(page, "window.__mdCodeBlocks.lastCopiedText()");
    printTable(
      [[clickResult.before, clickResult.afterClickText, copiedText === info[0]?.codeText ? "일치" : "불일치"]],
      ["누르기 전 글자", "누른 뒤 글자", "클립보드로 전달된 코드"],
    );
    if (!clickResult.ok) failures.push("복사 버튼을 찾지 못했습니다.");
    if (copiedText !== info[0]?.codeText) failures.push("클립보드로 전달된 텍스트가 코드블록 내용과 다릅니다.");
    if (clickResult.afterClickText === clickResult.before) failures.push("복사 후 버튼 문구가 바뀌지 않았습니다.");

    console.log("");
    console.log("[6] 복사 후 버튼 문구가 시간이 지나면 원래대로 돌아오는지");
    const revertedText = await evaluate(page, "window.__mdCodeBlocks.copyButtonRevert(0, 1800)");
    printTable([[clickResult.before, revertedText, clickResult.before === revertedText ? "일치" : "불일치"]], ["원래 글자", "복귀 후 글자", "판정"]);
    if (revertedText !== clickResult.before) failures.push("복사 버튼 문구가 원래대로 돌아오지 않았습니다.");

    console.log("");

    if (failures.length > 0) {
      console.log("확인 실패:");
      failures.forEach((item) => console.log(`- ${item}`));
      throw new Error(`Markdown 코드블록 확인 실패 ${failures.length}건`);
    }

    console.log("NowNote markdown code block actions check passed");
  } finally {
    browserClient?.close();
    stopBrowserProcess(browser);
    server.close();
    await delay(300);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

function hexToRgbLoose(value) {
  const hexMatch = /^#([0-9a-f]{6})$/i.exec(String(value).trim());
  if (hexMatch) {
    const number = Number.parseInt(hexMatch[1], 16);
    return `rgb(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255})`;
  }
  const rgbMatch = /^rgba?\(/i.test(String(value).trim());
  if (rgbMatch) return String(value).trim();
  return null;
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
  console.error(`NowNote markdown code block actions check failed: ${error.message}`);
  process.exit(1);
});
