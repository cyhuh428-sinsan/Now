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
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-default-apps",
    "--disable-extensions",
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
  assert(typeof WebSocket === "function", "WebSocket 미지원");

  const browserPath = await findBrowser();
  const { server, port: webPort } = await startStaticServer();
  const debugPort = await freePort();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nownote-ime-check-"));
  const appUrl = `http://127.0.0.1:${webPort}/index.html`;
  const browser = spawn(browserPath, browserArgs(debugPort, tempDir, appUrl), {
    env: { ...process.env, NOWNOTE_HEADLESS_CHECK: "1" },
    stdio: ["ignore", "ignore", "pipe"],
  });

  let browserClient = null;
  try {
    browser.stderr.on("data", () => {});
    const target = await waitForPageTarget(debugPort, webPort);
    browserClient = await CdpClient.connect(target.webSocketDebuggerUrl);
    const page = { send: (method, params = {}) => browserClient.send(method, params) };
    await delay(300);
    await page.send("Runtime.enable");
    await waitForCondition(page, "document.readyState === 'complete'", "NowNote Web 로드");
    await waitForCondition(page, "Boolean(document.querySelector('#treeTitleInput') && typeof renderTreeEditor === 'function')", "제목 편집기 로드");

    const result = await evaluate(page, `
      (() => {
        const log = [];
        const input = document.querySelector("#treeTitleInput");
        const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
        // 이 입력칸 인스턴스에만 value 세터를 덧씌워 덮어쓰기를 기록한다.
        Object.defineProperty(input, "value", {
          configurable: true,
          get() { return proto.get.call(this); },
          set(next) { log.push(next); proto.set.call(this, next); },
        });

        const now = new Date().toISOString();
        const node = (id, title, content, extra = {}) => ({
          id, title, content, parentId: null, level: 1, children: [],
          status: "active", syncState: "local", favorite: false,
          tags: [], createdAt: now, updatedAt: now, ...extra,
        });

        const results = {};

        // --- 1) 읽기 전용 노드: 조합 중 input 이 값을 되돌리면 안 된다 ---
        state.data = defaultData();
        state.data.tree = [node("ro", "원래제목", "본문", { groupSharedReadOnly: true })];
        state.selectedTreeId = "ro";
        renderTreeEditor();
        log.length = 0;
        input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
        proto.set.call(input, "원래제목ㄱ");
        input.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true }));
        proto.set.call(input, "원래제목가");
        input.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true }));
        results.readOnlyWritesWhileComposing = log.slice();
        results.readOnlyValueDuringComposition = proto.get.call(input);
        input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "가" }));
        results.readOnlyWritesAfterEnd = log.slice();
        results.readOnlyValueAfterEnd = proto.get.call(input);

        // --- 2) 쓰기 가능 노드: 조합 중에는 저장을 미루고 끝난 뒤 한 번만 저장한다 ---
        state.data = defaultData();
        state.data.tree = [node("rw", "메모", "본문")];
        state.selectedTreeId = "rw";
        renderTreeEditor();
        log.length = 0;
        input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
        proto.set.call(input, "메모ㅅ");
        input.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true }));
        proto.set.call(input, "메모사");
        input.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true }));
        results.editableWritesWhileComposing = log.slice();
        results.editableValueDuringComposition = proto.get.call(input);
        results.editableTitleDuringComposition = state.data.tree[0].title;
        input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "사" }));
        results.editableValueAfterEnd = proto.get.call(input);
        results.editableTitleAfterEnd = state.data.tree[0].title;

        // --- 2b) 조합 중 바깥 렌더는 값 쓰기를 미루고 조합이 끝난 뒤에 적용된다 ---
        state.data = defaultData();
        state.data.tree = [node("rw2b", "메모", "본문")];
        state.selectedTreeId = "rw2b";
        renderTreeEditor();
        log.length = 0;
        input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
        proto.set.call(input, "메모ㅅ");
        input.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true }));
        state.data.tree[0].title = "바깥에서바뀐제목";
        renderTreeEditor();
        results.renderWritesWhileComposing = log.slice();
        results.renderValueDuringComposition = proto.get.call(input);
        input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "사" }));
        results.renderValueAfterEnd = proto.get.call(input);

        // --- 3) 조합 없이 평범하게 입력하면 즉시 저장된다 ---
        state.data = defaultData();
        state.data.tree = [node("rw2", "메모", "본문")];
        state.selectedTreeId = "rw2";
        renderTreeEditor();
        proto.set.call(input, "새제목");
        input.dispatchEvent(new InputEvent("input", { bubbles: true }));
        results.plainTitleSaved = state.data.tree[0].title;

        // --- 4) 조합 중 blur 로 빠져나가도 밀린 처리가 마무리된다 ---
        state.data = defaultData();
        state.data.tree = [node("rw3", "메모", "본문")];
        state.selectedTreeId = "rw3";
        renderTreeEditor();
        input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
        proto.set.call(input, "블러제목");
        input.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true }));
        results.blurTitleBefore = state.data.tree[0].title;
        input.dispatchEvent(new FocusEvent("blur", { bubbles: false }));
        results.blurTitleAfter = state.data.tree[0].title;

        // --- 5) 다섯 입력칸에서 조합 중 Enter 가 명령으로 새지 않는지 ---
        state.data = defaultData();
        state.data.tree = [node("k1", "메모장", "본문 메모 내용")];
        state.selectedTreeId = "k1";
        renderTreeEditor();
        const keyChecks = {};
        const fire = (el, init) => el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
        // 첫 결과가 실제로 열리면 화면이 넘어가 다음 검사가 불가능하므로
        // 클릭만 가로채고 keydown 이 소비됐는지(preventDefault)로 판정한다.
        let clicks = 0;
        const blockClicks = (ev) => { clicks += 1; ev.stopPropagation(); ev.preventDefault(); };
        document.addEventListener("click", blockClicks, true);

        // 빠른 전환
        openQuickSwitch();
        elements.quickInput.value = "메";
        renderQuickResults();
        keyChecks.quickHasResult = Boolean(elements.quickResults.querySelector(".quick-result"));
        clicks = 0;
        keyChecks.quickComposingEnter = fire(elements.quickInput, { key: "Enter", isComposing: true });
        keyChecks.quickComposing229 = fire(elements.quickInput, { key: "Enter", keyCode: 229 });
        keyChecks.quickClicksWhileComposing = clicks;
        keyChecks.quickPlainEnter = fire(elements.quickInput, { key: "Enter" });
        keyChecks.quickClicksAfterPlain = clicks;
        keyChecks.quickComposingArrowDown = fire(elements.quickInput, { key: "ArrowDown", isComposing: true });
        closeQuickSwitch();

        // 명령 팔레트
        openCommandPalette();
        elements.commandPaletteInput.value = "";
        renderCommandPalette();
        keyChecks.paletteHasResult = Boolean(elements.commandPaletteList.querySelector(".command-item"));
        clicks = 0;
        keyChecks.paletteComposingEnter = fire(elements.commandPaletteInput, { key: "Enter", isComposing: true });
        keyChecks.paletteComposing229 = fire(elements.commandPaletteInput, { key: "Enter", keyCode: 229 });
        keyChecks.paletteClicksWhileComposing = clicks;
        keyChecks.palettePlainEnter = fire(elements.commandPaletteInput, { key: "Enter" });
        keyChecks.paletteClicksAfterPlain = clicks;
        keyChecks.paletteComposingArrowDown = fire(elements.commandPaletteInput, { key: "ArrowDown", isComposing: true });
        closeCommandPalette();

        // 본문 찾기
        openNoteFind();
        elements.noteFindInput.value = "본";
        keyChecks.findComposingEnter = fire(elements.noteFindInput, { key: "Enter", isComposing: true });
        keyChecks.findComposing229 = fire(elements.noteFindInput, { key: "Enter", keyCode: 229 });
        keyChecks.findPlainEnter = fire(elements.noteFindInput, { key: "Enter" });
        keyChecks.findComposingEscape = fire(elements.noteFindInput, { key: "Escape", isComposing: true });
        keyChecks.findClosedByEscape = elements.noteFindBar.classList.contains("hidden");

        // 검색 팝오버
        openSearchPopover();
        elements.searchPopoverInput.value = "메";
        renderSearchPopoverResults();
        keyChecks.popoverHasResult = Boolean(firstSearchResult(elements.searchPopoverResults));
        clicks = 0;
        keyChecks.popoverComposingEnter = fire(elements.searchPopoverInput, { key: "Enter", isComposing: true });
        keyChecks.popoverComposing229 = fire(elements.searchPopoverInput, { key: "Enter", keyCode: 229 });
        keyChecks.popoverClicksWhileComposing = clicks;
        keyChecks.popoverPlainEnter = fire(elements.searchPopoverInput, { key: "Enter" });
        keyChecks.popoverClicksAfterPlain = clicks;
        closeSearchPopover();

        // 메인 검색
        state.view = "results";
        state.search = "메";
        elements.searchInput.value = "메";
        renderResults();
        keyChecks.mainHasResult = Boolean(firstSearchResult(elements.resultsList));
        clicks = 0;
        keyChecks.mainComposingEnter = fire(elements.searchInput, { key: "Enter", isComposing: true });
        keyChecks.mainComposing229 = fire(elements.searchInput, { key: "Enter", keyCode: 229 });
        keyChecks.mainClicksWhileComposing = clicks;
        keyChecks.mainPlainEnter = fire(elements.searchInput, { key: "Enter" });
        keyChecks.mainClicksAfterPlain = clicks;

        document.removeEventListener("click", blockClicks, true);
        results.keyChecks = keyChecks;
        delete input.value;
        return results;
      })()
    `);

    console.log(JSON.stringify(result, null, 2));

    // 조합 중에는 어떤 .value 덮어쓰기도 없어야 한다.
    assert(result.readOnlyWritesWhileComposing.length === 0, `읽기 전용 조합 중 value 덮어쓰기 발생: ${JSON.stringify(result.readOnlyWritesWhileComposing)}`);
    assert(result.readOnlyValueDuringComposition === "원래제목가", "조합 중 값이 되돌려졌습니다.");
    assert(result.readOnlyWritesAfterEnd.length === 1 && result.readOnlyWritesAfterEnd[0] === "원래제목", "조합이 끝난 뒤 읽기 전용 복원이 한 번 일어나야 합니다.");
    assert(result.readOnlyValueAfterEnd === "원래제목", "조합이 끝난 뒤 읽기 전용 제목이 복원되지 않았습니다.");

    assert(result.editableWritesWhileComposing.length === 0, `조합 중 value 덮어쓰기 발생: ${JSON.stringify(result.editableWritesWhileComposing)}`);
    assert(result.editableValueDuringComposition === "메모사", "조합 중 값이 바뀌었습니다.");
    assert(result.editableTitleDuringComposition === "메모", "조합 중에 이미 저장되면 안 됩니다.");
    assert(result.editableTitleAfterEnd === "메모사", `조합이 끝난 뒤 제목이 저장되지 않았습니다: ${result.editableTitleAfterEnd}`);

    assert(result.renderWritesWhileComposing.length === 0, `조합 중 렌더가 value 를 덮어썼습니다: ${JSON.stringify(result.renderWritesWhileComposing)}`);
    assert(result.renderValueDuringComposition === "메모ㅅ", "조합 중 렌더가 값을 바꿨습니다.");
    assert(result.renderValueAfterEnd === "바깥에서바뀐제목", `조합이 끝난 뒤 미뤄둔 렌더 값이 적용되지 않았습니다: ${result.renderValueAfterEnd}`);
    assert(result.plainTitleSaved === "새제목", "조합 없는 입력이 저장되지 않았습니다.");
    assert(result.blurTitleBefore === "메모", "조합 중에 이미 저장되면 안 됩니다.");
    assert(result.blurTitleAfter === "블러제목", "조합 중 blur 로 빠져나갈 때 저장되지 않았습니다.");

    const k = result.keyChecks;
    assert(k.quickHasResult && k.paletteHasResult && k.popoverHasResult && k.mainHasResult, "결과 목록이 비어 검사 의미가 없습니다.");
    for (const name of ["quick", "palette", "popover", "main"]) {
      assert(k[`${name}ComposingEnter`] === true, `${name}: 조합 중 Enter 가 소비되었습니다.`);
      assert(k[`${name}Composing229`] === true, `${name}: keyCode 229 Enter 가 소비되었습니다.`);
      assert(k[`${name}PlainEnter`] === false, `${name}: 평범한 Enter 가 동작하지 않습니다.`);
      assert(k[`${name}ClicksWhileComposing`] === 0, `${name}: 조합 중 Enter 가 첫 결과를 눌렀습니다.`);
      assert(k[`${name}ClicksAfterPlain`] === 1, `${name}: 평범한 Enter 가 첫 결과를 누르지 못했습니다.`);
    }
    assert(k.findComposingEnter === true, "본문 찾기: 조합 중 Enter 가 소비되었습니다.");
    assert(k.findComposing229 === true, "본문 찾기: keyCode 229 Enter 가 소비되었습니다.");
    assert(k.findPlainEnter === false, "본문 찾기: 평범한 Enter 가 동작하지 않습니다.");
    assert(k.findComposingEscape === false, "본문 찾기: Escape 가 여전히 동작해야 합니다.");
    assert(k.findClosedByEscape === true, "본문 찾기: Escape 로 닫히지 않았습니다.");
    assert(k.quickComposingArrowDown === false, "빠른 전환: 조합 중 ArrowDown 을 막으면 안 됩니다.");
    assert(k.paletteComposingArrowDown === false, "명령 팔레트: 조합 중 ArrowDown 을 막으면 안 됩니다.");

    console.log("NowNote IME title/enter check passed");
  } finally {
    browserClient?.ws?.close();
    stopBrowserProcess(browser);
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

runOnce().catch((error) => {
  console.error(`IME check failed: ${error.message}`);
  process.exit(1);
});
