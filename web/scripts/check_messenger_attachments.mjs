/**
 * NowNote 2.3.6 U9 - 메신저 첨부 UX 보강 확인.
 *
 * 로드맵 3번이 요구하는 것을 확인한다.
 *   - 첨부 파일명, 크기, 종류를 명확히 표시한다.
 *   - 이미지 미리보기와 다운로드 버튼을 개선한다.
 *   - 업로드 실패 사유를 사용자가 이해할 수 있게 표시한다.
 *
 * 실제 서버가 없는 환경이므로 window.fetch 를 페이지 안에서 몹(mock)으로 바꿔
 * 첨부 다운로드/미리보기 응답과 업로드 실패 응답(413 file_too_large, 400
 * extension_not_allowed / mime_type_not_allowed)을 흉내낸다.
 *
 * 확인하는 것:
 *   1. 첨부가 있는 메시지를 그리면 파일명 · 크기 · 종류가 보인다.
 *   2. content_type이 image/png면 미리보기(썸네일 <img>, blob URL)가 만들어지고,
 *      같은 첨부를 다시 그려도 네트워크 요청이 한 번만 나간다(objectURL 재사용).
 *   3. 다운로드 클릭이 여전히 동작한다(회귀 없음) - 첨부 요청과 objectURL 생성/해제가 일어난다.
 *   4. 업로드가 413(file_too_large)로 실패하면 한국어 안내("파일이 너무 큽니다"류)가 보인다.
 *   5. 업로드가 400(extension_not_allowed / mime_type_not_allowed)으로 실패하면
 *      각각 다른 한국어 안내가 보인다.
 *
 * 하네스 구조는 web/scripts/check_sync_status_indicator.mjs 와 같다.
 *
 * 실행:
 *   node web/scripts/check_messenger_attachments.mjs
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
 * 시험용 함수들을 window.__attachmentCheck 에 붙인다. 앱 코드에는 아무것도 남기지 않는다.
 */
const PAGE_SETUP = String.raw`
(() => {
  function setupServerMode() {
    state.data = defaultData();
    window.canUseGroupMessenger = () => true;
    state.settings.server = {
      ...defaultServerSettings(),
      mode: "server",
      url: "http://mock.local",
      token: "mock-token",
      userToken: "",
      ownerId: "attachment_check_owner",
      deviceId: "attachment-check-device",
      groupMessengerRooms: [{ id: 1, name: "room" }],
      groupMessengerActiveRoomId: 1,
      groupMessages: [],
    };
    persistSettings();
    return true;
  }

  function renderMessagesWithAttachments(message) {
    const server = state.settings.server;
    server.groupMessages = [message];
    renderGroupMessenger();
    return true;
  }

  function attachmentCardSnapshot(attachmentId) {
    const preview = document.querySelector('.messenger-attachment-preview[data-attachment-id="' + attachmentId + '"]');
    const download = document.querySelector('.messenger-attachment-download[data-attachment-id="' + attachmentId + '"]');
    return {
      hasPreview: Boolean(preview),
      previewHtml: preview ? preview.innerHTML : "",
      name: download ? download.querySelector(".messenger-attachment-name").textContent : "",
      meta: download ? download.querySelector(".messenger-attachment-meta").textContent : "",
    };
  }

  function installFetchMock(handler) {
    window.__attachmentFetchCalls = [];
    window.fetch = async (url, options) => {
      window.__attachmentFetchCalls.push(String(url));
      return handler(String(url), options);
    };
  }

  function installObjectUrlSpy() {
    window.__objectUrlCounts = { created: 0, revoked: 0 };
    const originalCreate = URL.createObjectURL.bind(URL);
    const originalRevoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      window.__objectUrlCounts.created += 1;
      return originalCreate(blob);
    };
    URL.revokeObjectURL = (url) => {
      window.__objectUrlCounts.revoked += 1;
      return originalRevoke(url);
    };
  }

  async function clickDownload(attachmentId) {
    const button = document.querySelector('.messenger-attachment-download[data-attachment-id="' + attachmentId + '"]');
    if (!button) return { clicked: false };
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 250));
    return { clicked: true };
  }

  async function waitForPreviewImage(attachmentId, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const img = document.querySelector('.messenger-attachment-preview[data-attachment-id="' + attachmentId + '"] img');
      if (img) return img.getAttribute("src") || "";
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return null;
  }

  async function attemptUploadFailure(status, detailBody) {
    installFetchMock(async () => ({
      ok: false,
      status,
      text: async () => JSON.stringify({ detail: detailBody }),
      json: async () => ({ detail: detailBody }),
    }));
    pendingMessengerAttachment = new File(["x"], "test.exe", { type: "application/octet-stream" });
    elements.groupMessengerInput.value = "";
    await sendGroupMessage(null);
    const toast = elements.toastRegion.lastElementChild;
    return {
      toastText: toast ? toast.textContent : "",
      toastType: toast ? toast.className : "",
    };
  }

  function testServerResponseErrorReason(reason) {
    return serverResponseError({
      status: 413,
      text: async () => JSON.stringify({ detail: { reason, message: "raw message" } }),
    });
  }

  function testServerResponseErrorLegacyString() {
    return serverResponseError({
      status: 403,
      text: async () => JSON.stringify({ detail: "user inactive" }),
    });
  }

  function testServerResponseErrorUnknownReason() {
    return serverResponseError({
      status: 400,
      text: async () => JSON.stringify({ detail: { reason: "something_else", message: "raw detail message" } }),
    });
  }

  window.__attachmentCheck = {
    setupServerMode,
    renderMessagesWithAttachments,
    attachmentCardSnapshot,
    installFetchMock,
    installObjectUrlSpy,
    clickDownload,
    waitForPreviewImage,
    attemptUploadFailure,
    testServerResponseErrorReason,
    testServerResponseErrorLegacyString,
    testServerResponseErrorUnknownReason,
  };
  return true;
})()
`;

function pngDataUrlBytes() {
  // 1x1 투명 PNG.
  const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  return base64;
}

async function runOnce() {
  assert(typeof WebSocket === "function", "현재 Node.js 런타임이 WebSocket을 지원하지 않습니다.");

  const browserPath = await findBrowser();
  const { server, port: webPort } = await startStaticServer();
  const debugPort = await freePort();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nownote-messenger-attachments-"));
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
      "typeof messengerAttachmentsHtml === 'function' && typeof elements !== 'undefined' && elements.groupMessengerList",
      "메신저 첨부 요소 로드",
    );

    assert(await evaluate(page, PAGE_SETUP), "시험 준비 코드를 붙이지 못했습니다.");
    assert(await evaluate(page, "window.__attachmentCheck.setupServerMode()"), "서버 모드 설정 실패");

    console.log("NowNote 메신저 첨부 UX 확인");
    console.log("");

    // 1) 파일명 · 크기 · 종류 표시 (이미지 첨부)
    const pngBase64 = pngDataUrlBytes();
    await evaluate(page, `window.__attachmentCheck.installFetchMock((url) => {
      if (url.includes("/attachments/img-1")) {
        const bytes = Uint8Array.from(atob("${pngBase64}"), (c) => c.charCodeAt(0));
        return { ok: true, status: 200, blob: async () => new Blob([bytes], { type: "image/png" }) };
      }
      return { ok: false, status: 404, text: async () => "not found" };
    })`);
    await evaluate(page, `window.__attachmentCheck.renderMessagesWithAttachments({
      id: 1,
      sender_owner_id: "attachment_check_owner",
      sender_display_name: "Me",
      created_at: new Date().toISOString(),
      body: "이미지 첨부 테스트",
      attachments: [{ id: "img-1", original_name: "photo.png", content_type: "image/png", size_bytes: 204800 }],
    })`);
    const card1 = await evaluate(page, `window.__attachmentCheck.attachmentCardSnapshot("img-1")`);
    console.log(`[1] 이미지 첨부 카드 - 이름: "${card1.name}" / 메타: "${card1.meta}"`);
    if (!card1.name.includes("photo.png")) failures.push(`첨부 카드에 파일명이 없습니다: "${card1.name}"`);
    if (!/200\s*KB/.test(card1.meta)) failures.push(`첨부 카드에 크기 표시가 없습니다: "${card1.meta}"`);
    if (!/PNG/.test(card1.meta)) failures.push(`첨부 카드에 종류 표시가 없습니다: "${card1.meta}"`);
    if (!card1.hasPreview) failures.push("이미지 첨부에 미리보기 영역이 없습니다.");

    // 2) 이미지 미리보기 - blob URL 생성, 캐시 재사용(네트워크 요청 1회)
    const previewSrc = await evaluate(page, `window.__attachmentCheck.waitForPreviewImage("img-1", 5000)`);
    console.log(`[2] 이미지 미리보기 src: "${previewSrc}"`);
    if (!previewSrc || !previewSrc.startsWith("blob:")) failures.push(`이미지 미리보기가 blob URL이 아닙니다: "${previewSrc}"`);
    const callsAfterFirstRender = await evaluate(page, "window.__attachmentFetchCalls.length");
    // 같은 메시지를 다시 그린다 (첨부 id는 동일).
    await evaluate(page, `window.__attachmentCheck.renderMessagesWithAttachments({
      id: 1,
      sender_owner_id: "attachment_check_owner",
      sender_display_name: "Me",
      created_at: new Date().toISOString(),
      body: "이미지 첨부 테스트",
      attachments: [{ id: "img-1", original_name: "photo.png", content_type: "image/png", size_bytes: 204800 }],
    })`);
    await delay(300);
    const previewSrcAfterRerender = await evaluate(page, `window.__attachmentCheck.waitForPreviewImage("img-1", 3000)`);
    const callsAfterSecondRender = await evaluate(page, "window.__attachmentFetchCalls.length");
    console.log(`[2-1] 다시 그린 뒤 네트워크 요청 수: ${callsAfterFirstRender} -> ${callsAfterSecondRender}`);
    if (callsAfterSecondRender !== callsAfterFirstRender) {
      failures.push(`같은 첨부를 다시 그렸는데 네트워크 요청이 또 나갔습니다 (${callsAfterFirstRender} -> ${callsAfterSecondRender}).`);
    }
    if (previewSrcAfterRerender !== previewSrc) {
      failures.push(`다시 그린 뒤 objectURL이 재사용되지 않았습니다: "${previewSrc}" -> "${previewSrcAfterRerender}"`);
    }
    console.log("");

    // 3) 비이미지 첨부 - 이름 · 크기 · 종류, 다운로드 회귀 확인
    await evaluate(page, `window.__attachmentCheck.installFetchMock((url) => {
      if (url.includes("/attachments/doc-1")) {
        return { ok: true, status: 200, blob: async () => new Blob(["pdf-bytes"], { type: "application/pdf" }) };
      }
      return { ok: false, status: 404, text: async () => "not found" };
    })`);
    await evaluate(page, `window.__attachmentCheck.renderMessagesWithAttachments({
      id: 2,
      sender_owner_id: "attachment_check_owner",
      sender_display_name: "Me",
      created_at: new Date().toISOString(),
      body: "문서 첨부 테스트",
      attachments: [{ id: "doc-1", original_name: "report.pdf", content_type: "application/pdf", size_bytes: 1048576 }],
    })`);
    const card2 = await evaluate(page, `window.__attachmentCheck.attachmentCardSnapshot("doc-1")`);
    console.log(`[3] 문서 첨부 카드 - 이름: "${card2.name}" / 메타: "${card2.meta}" (미리보기 있음: ${card2.hasPreview})`);
    if (!card2.name.includes("report.pdf")) failures.push(`문서 첨부 카드에 파일명이 없습니다: "${card2.name}"`);
    if (!/1\.0\s*MB/.test(card2.meta)) failures.push(`문서 첨부 카드에 크기 표시가 없습니다: "${card2.meta}"`);
    if (!/PDF/.test(card2.meta)) failures.push(`문서 첨부 카드에 종류 표시가 없습니다: "${card2.meta}"`);
    if (card2.hasPreview) failures.push("비이미지 첨부에 미리보기 영역이 잘못 생성되었습니다.");

    await evaluate(page, "window.__attachmentCheck.installObjectUrlSpy()");
    const beforeClickCalls = await evaluate(page, "window.__attachmentFetchCalls.length");
    await evaluate(page, `window.__attachmentCheck.clickDownload("doc-1")`);
    const afterClickCalls = await evaluate(page, "window.__attachmentFetchCalls.length");
    const objectUrlCounts = await evaluate(page, "window.__objectUrlCounts");
    console.log(`[3-1] 다운로드 클릭 - 네트워크 요청: ${beforeClickCalls} -> ${afterClickCalls}, objectURL 생성/해제: ${objectUrlCounts.created}/${objectUrlCounts.revoked}`);
    if (afterClickCalls <= beforeClickCalls) failures.push("다운로드 클릭 시 첨부 요청이 나가지 않았습니다(회귀).");
    if (objectUrlCounts.created < 1 || objectUrlCounts.revoked < 1) {
      failures.push(`다운로드 클릭 시 objectURL 생성/해제가 확인되지 않았습니다: 생성 ${objectUrlCounts.created}, 해제 ${objectUrlCounts.revoked}`);
    }
    console.log("");

    // 4) serverResponseError - 문자열 detail(기존 동작) 유지
    const legacy = await evaluate(page, "window.__attachmentCheck.testServerResponseErrorLegacyString()");
    console.log(`[4] 문자열 detail(기존 동작) - "${legacy}"`);
    if (!/비활성|inactive/i.test(legacy)) {
      failures.push(`문자열 detail 처리(기존 동작)가 바뀌었습니다: "${legacy}"`);
    }

    // 5) serverResponseError - 알려진 reason별 한국어 안내
    const fileTooLarge = await evaluate(page, `window.__attachmentCheck.testServerResponseErrorReason("file_too_large")`);
    console.log(`[5] file_too_large - "${fileTooLarge}"`);
    if (!/너무 큽|too large/i.test(fileTooLarge)) failures.push(`file_too_large 안내 문구가 없습니다: "${fileTooLarge}"`);

    const extNotAllowed = await evaluate(page, `window.__attachmentCheck.testServerResponseErrorReason("extension_not_allowed")`);
    console.log(`[5-1] extension_not_allowed - "${extNotAllowed}"`);
    if (!/형식|extension|type/i.test(extNotAllowed)) failures.push(`extension_not_allowed 안내 문구가 없습니다: "${extNotAllowed}"`);

    const mimeNotAllowed = await evaluate(page, `window.__attachmentCheck.testServerResponseErrorReason("mime_type_not_allowed")`);
    console.log(`[5-2] mime_type_not_allowed - "${mimeNotAllowed}"`);
    if (!/종류|mime|kind/i.test(mimeNotAllowed)) failures.push(`mime_type_not_allowed 안내 문구가 없습니다: "${mimeNotAllowed}"`);

    if (fileTooLarge === extNotAllowed || extNotAllowed === mimeNotAllowed || fileTooLarge === mimeNotAllowed) {
      failures.push("서로 다른 실패 사유인데 안내 문구가 같습니다.");
    }

    // 5-3) 알려지지 않은 reason은 detail.message로 떨어진다(기존 동작 유지).
    const unknownReason = await evaluate(page, "window.__attachmentCheck.testServerResponseErrorUnknownReason()");
    console.log(`[5-3] 알려지지 않은 reason - "${unknownReason}"`);
    if (!unknownReason.includes("raw detail message")) {
      failures.push(`알려지지 않은 reason에서 detail.message로 떨어지지 않았습니다: "${unknownReason}"`);
    }
    console.log("");

    // 6) 업로드 실패 시 sendGroupMessage 가 실제로 한국어 안내를 토스트에 띄우는지
    const failLarge = await evaluate(page, `window.__attachmentCheck.attemptUploadFailure(413, { reason: "file_too_large", message: "file too large" })`);
    console.log(`[6] 업로드 413(file_too_large) - 토스트: "${failLarge.toastText}"`);
    if (!/너무 큽|too large/i.test(failLarge.toastText)) failures.push(`업로드 크기 초과 실패 안내가 토스트에 없습니다: "${failLarge.toastText}"`);
    if (!failLarge.toastType.includes("error")) failures.push(`업로드 실패 토스트가 error 유형이 아닙니다: "${failLarge.toastType}"`);

    const failExt = await evaluate(page, `window.__attachmentCheck.attemptUploadFailure(400, { reason: "extension_not_allowed", message: "file extension not allowed" })`);
    console.log(`[6-1] 업로드 400(extension_not_allowed) - 토스트: "${failExt.toastText}"`);
    if (!/형식|extension|type/i.test(failExt.toastText)) failures.push(`업로드 확장자 실패 안내가 토스트에 없습니다: "${failExt.toastText}"`);

    const failMime = await evaluate(page, `window.__attachmentCheck.attemptUploadFailure(400, { reason: "mime_type_not_allowed", message: "file mime type not allowed" })`);
    console.log(`[6-2] 업로드 400(mime_type_not_allowed) - 토스트: "${failMime.toastText}"`);
    if (!/종류|mime|kind/i.test(failMime.toastText)) failures.push(`업로드 MIME 실패 안내가 토스트에 없습니다: "${failMime.toastText}"`);

    if (failLarge.toastText === failExt.toastText || failExt.toastText === failMime.toastText) {
      failures.push("업로드 실패 사유별 토스트 안내가 서로 구분되지 않습니다.");
    }
    console.log("");

    if (failures.length > 0) {
      console.log("확인 실패:");
      failures.forEach((item) => console.log(`- ${item}`));
      throw new Error(`메신저 첨부 UX 확인 실패 ${failures.length}건`);
    }

    console.log("NowNote messenger attachment UX check passed");
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
  console.error(`NowNote messenger attachment UX check failed: ${error.message}`);
  process.exit(1);
});
