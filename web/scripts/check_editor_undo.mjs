/**
 * NowNote 2.3.6 M8c - 본문 편집기 실행 취소 / 다시 실행 스택 검사.
 *
 * 확인하는 것 (docs/NOW_2_3_6_ROADMAP.md 11번, docs/NOW_2_3_6_WORK_PLAN.md M8c):
 *   - 이어 친 글자를 한 항목으로 묶는지, 줄바꿈과 쉼에서 끊는지
 *   - 되돌린 뒤 본문과 커서가 함께 돌아오고 자동 저장이 따라가는지
 *   - 프로그램 편집(마커 삽입 등)이 한 항목으로 남는지
 *   - 한글 조합 중에는 항목을 쌓지 않고 조합이 끝난 뒤 한 항목으로 남는지
 *   - Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y 가 편집기 안에서 동작하는지
 *   - 다른 메모로 옮기면 스택을 비우는지
 *   - 설정한 단계 수(10 / 50 / 100)를 지키는지
 *   - 긴 문서에서 메모리 예산에 걸리면 단계 수를 자동으로 줄이는지
 *   - 강조 오버레이를 껐을 때도 동작하는지
 *   - 5만 자 문서에서 스택이 실제로 얼마를 들고 있는지
 *   - U2 바꾸기 화면: 모두 바꾸기 버튼이 실행 취소 한 항목으로 남는지,
 *     현재 항목 바꾸기가 매치 하나만 바꾸고 다음 매치로 옮기는지,
 *     잠긴(복호화 안 된) 메모에서 바꾸기가 막히는지
 *
 * 실행:
 *   node web/scripts/check_editor_undo.mjs
 *
 * 하네스 구조는 web/scripts/check_ime_composition.mjs 와 같다.
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
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-default-apps",
    "--disable-extensions",
    // 5만 자 문서에서 스택이 실제로 얼마를 들고 있는지 재기 위한 것.
    "--enable-precise-memory-info",
    "--js-flags=--expose-gc",
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

// 페이지 안에서 쓰는 공통 준비 코드. 각 검사 앞에 붙인다.
const PAGE_SETUP = `
  const proto = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
  const editor = elements.treeContent;
  const rawValue = () => proto.get.call(editor);
  const setRaw = (text) => proto.set.call(editor, text);
  // setSelectionRange 만으로는 편집기가 커서 이동을 알 수 없는 브라우저가 있어
  // 사용자가 마우스나 방향키로 옮겼을 때와 같게 select 를 함께 보낸다.
  const moveCursor = (start, end = start) => {
    editor.setSelectionRange(start, end);
    editor.dispatchEvent(new Event("select", { bubbles: true }));
  };
  const now = new Date().toISOString();
  const node = (id, title, content, extra = {}) => ({
    id, title, content, parentId: null, level: 1, children: [],
    status: "active", syncState: "local", favorite: false,
    tags: [], createdAt: now, updatedAt: now, ...extra,
  });
  const seed = (id, content) => {
    state.data = defaultData();
    state.data.tree = [node(id, "메모", content)];
    state.selectedTreeId = id;
    renderTreeEditor();
    moveCursor(rawValue().length);
  };
  // 한 글자씩 실제 타자처럼 넣는다. 값 대입은 세터를 거치지 않는 경로를 쓴다.
  const typeText = (text) => {
    for (const character of Array.from(text)) {
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      const value = rawValue();
      setRaw(\`\${value.slice(0, start)}\${character}\${value.slice(end)}\`);
      editor.setSelectionRange(start + character.length, start + character.length);
      editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }
  };
  const backspace = (times = 1) => {
    for (let index = 0; index < times; index += 1) {
      const start = editor.selectionStart;
      if (start <= 0) return;
      const value = rawValue();
      setRaw(\`\${value.slice(0, start - 1)}\${value.slice(start)}\`);
      editor.setSelectionRange(start - 1, start - 1);
      editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }
  };
  // dispatchEvent 는 preventDefault 가 불리면 false 를 낸다. 단축키를 소비했는지 판정한다.
  const pressKey = (init) => !editor.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }),
  );
  // 한글 조합 한 글자.
  const composeSyllable = (steps) => {
    editor.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    const base = rawValue();
    const at = editor.selectionStart;
    for (const step of steps) {
      setRaw(\`\${base.slice(0, at)}\${step}\${base.slice(at)}\`);
      editor.setSelectionRange(at + step.length, at + step.length);
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true }));
    }
    editor.dispatchEvent(new CompositionEvent("compositionend", {
      bubbles: true,
      data: steps[steps.length - 1],
    }));
  };
`;

function pageScript(body) {
  return `(() => {${PAGE_SETUP}${body}})()`;
}

async function runOnce() {
  assert(typeof WebSocket === "function", "WebSocket 미지원");

  const browserPath = await findBrowser();
  const { server, port: webPort } = await startStaticServer();
  const debugPort = await freePort();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nownote-undo-check-"));
  const appUrl = `http://127.0.0.1:${webPort}/index.html`;
  const browser = spawn(browserPath, browserArgs(debugPort, tempDir, appUrl), {
    env: { ...process.env, NOWNOTE_HEADLESS_CHECK: "1" },
    stdio: ["ignore", "ignore", "pipe"],
  });

  let browserClient = null;
  const report = {};
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
      "Boolean(document.querySelector('#treeContent') && typeof captureTreeEditorHistory === 'function')",
      "실행 취소 스택 로드",
    );

    // --- 0) 설정 항목 (10 / 50 / 100, 기기 저장, 다국어 문구) ---
    report.settings = await evaluate(page, pageScript(`
      const select = elements.undoDepthSelect;
      state.settings.language = "ko";
      applyLanguage();
      renderSettings();
      const ko = {
        title: document.querySelector("#undoDepthSettingTitle").textContent,
        options: Array.from(select.options).map((option) => option.value + ":" + option.textContent),
        value: select.value,
      };
      state.settings.language = "en";
      applyLanguage();
      const en = {
        title: document.querySelector("#undoDepthSettingTitle").textContent,
        options: Array.from(select.options).map((option) => option.textContent),
      };
      state.settings.language = "ko";
      applyLanguage();
      // 고른 값이 기기 저장소에 남는지.
      select.value = "100";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}").undoDepth;
      const applied = state.settings.undoDepth;
      const normalized = normalizeSettings({ undoDepth: 33 }).undoDepth;
      state.settings.undoDepth = 50;
      renderSettings();
      return { ko, en, stored, applied, normalized, rendered: select.value };
    `));

    // --- 1) 이어 친 글자는 한 항목, 되돌리면 본문과 커서와 저장이 함께 돌아온다 ---
    report.typing = await evaluate(page, pageScript(`
      seed("undo-1", "시작");
      moveCursor(2);
      typeText("abcde");
      const afterType = {
        text: rawValue(),
        note: state.data.tree[0].content,
        history: treeEditorHistoryState(),
      };
      undoTreeEditor();
      const afterUndo = {
        text: rawValue(),
        cursor: editor.selectionStart,
        note: state.data.tree[0].content,
        history: treeEditorHistoryState(),
      };
      redoTreeEditor();
      const afterRedo = {
        text: rawValue(),
        cursor: editor.selectionStart,
        note: state.data.tree[0].content,
        history: treeEditorHistoryState(),
      };
      return { afterType, afterUndo, afterRedo };
    `));

    // --- 2) 줄바꿈에서 끊는다. 지우기와 넣기가 뒤바뀌어도 끊는다 ---
    report.boundary = await evaluate(page, pageScript(`
      seed("undo-2", "");
      typeText("ab\\ncd");
      const newline = treeEditorHistoryState().entries;
      seed("undo-2b", "");
      typeText("abcd");
      backspace(2);
      const flip = treeEditorHistoryState().entries;
      undoTreeEditor();
      const afterFirstUndo = rawValue();
      undoTreeEditor();
      const afterSecondUndo = rawValue();
      return { newline, flip, afterFirstUndo, afterSecondUndo };
    `));

    // --- 3) 700ms 넘게 쉬면 새 항목으로 끊는다 ---
    await evaluate(page, pageScript(`seed("undo-3", ""); typeText("ab"); return true;`));
    await delay(900);
    report.idleBreak = await evaluate(page, pageScript(`
      typeText("cd");
      const entries = treeEditorHistoryState().entries;
      undoTreeEditor();
      return { entries, afterUndo: rawValue() };
    `));

    // --- 4) 프로그램 편집은 언제나 한 항목이다 ---
    report.command = await evaluate(page, pageScript(`
      seed("undo-4", "hello");
      moveCursor(0, 5);
      wrapTreeContentSelection("**", "**");
      const afterBold = { text: rawValue(), history: treeEditorHistoryState() };
      undoTreeEditor();
      const afterUndo = {
        text: rawValue(),
        start: editor.selectionStart,
        end: editor.selectionEnd,
        note: state.data.tree[0].content,
      };
      // 타자 뒤에 명령이 오면 두 항목이 되어야 한다.
      seed("undo-4b", "");
      typeText("ab");
      insertChecklistIntoTreeContent();
      const mixed = treeEditorHistoryState().entries;
      return { afterBold, afterUndo, mixed };
    `));

    // --- 5) 다른 메모로 옮기면 스택을 비운다. 같은 메모에서 다시 그려도 유지한다 ---
    report.session = await evaluate(page, pageScript(`
      seed("undo-5", "aaa");
      typeText("bbb");
      const beforeSwitch = treeEditorHistoryState();
      state.data.tree.push(node("undo-5b", "메모2", "zzz"));
      state.selectedTreeId = "undo-5b";
      renderTreeEditor();
      const afterSwitch = treeEditorHistoryState();
      state.selectedTreeId = "undo-5";
      renderTreeEditor();
      const afterReturn = treeEditorHistoryState();

      seed("undo-5c", "abc");
      typeText("XY");
      render();
      const afterRender = treeEditorHistoryState();
      undoTreeEditor();
      const afterRenderUndo = rawValue();
      return { beforeSwitch, afterSwitch, afterReturn, afterRender, afterRenderUndo };
    `));

    // --- 6) 설정한 단계 수를 지킨다 ---
    report.depth = await evaluate(page, pageScript(`
      const measure = (depth) => {
        state.settings.undoDepth = depth;
        seed("undo-depth-" + depth, "");
        for (let index = 0; index < depth + 12; index += 1) {
          applyTreeEditorText("replace", "문서 " + index, { start: 0, end: 0 });
        }
        return treeEditorHistoryState();
      };
      const ten = measure(10);
      const fifty = measure(50);
      const hundred = measure(100);
      state.settings.undoDepth = 50;
      const fallback = normalizeUndoDepth("이상한값");
      return { ten, fifty, hundred, fallback, defaultDepth: TREE_UNDO_DEFAULT_DEPTH };
    `));

    // --- 7) 조합 중에는 쌓지 않고 조합이 끝난 뒤 한 항목으로 남는다 ---
    report.composition = await evaluate(page, pageScript(`
      seed("undo-7", "");
      editor.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
      const steps = ["ㅇ", "아", "안"];
      for (const step of steps) {
        setRaw(step);
        editor.setSelectionRange(step.length, step.length);
        editor.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true }));
      }
      const duringCompose = treeEditorHistoryState();
      const textDuringCompose = rawValue();
      editor.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "안" }));
      const afterCompose = treeEditorHistoryState();
      const noteAfterCompose = state.data.tree[0].content;
      // 이어지는 두 번째 글자는 같은 항목으로 묶인다.
      composeSyllable(["ㄴ", "녀", "녕"]);
      const afterSecond = treeEditorHistoryState();
      const textAfterSecond = rawValue();
      undoTreeEditor();
      const afterUndo = rawValue();
      return {
        duringCompose,
        textDuringCompose,
        afterCompose,
        noteAfterCompose,
        afterSecond,
        textAfterSecond,
        afterUndo,
      };
    `));

    // --- 8) 단축키 ---
    report.shortcut = await evaluate(page, pageScript(`
      const run = (enableShortcuts) => {
        state.settings.enableShortcuts = enableShortcuts;
        seed("undo-8-" + enableShortcuts, "abc");
        typeText("XYZ");
        const typed = rawValue();
        const undoConsumed = pressKey({ key: "z", code: "KeyZ", ctrlKey: true });
        const afterUndo = rawValue();
        const redoConsumed = pressKey({ key: "Z", code: "KeyZ", ctrlKey: true, shiftKey: true });
        const afterRedo = rawValue();
        pressKey({ key: "z", code: "KeyZ", ctrlKey: true });
        const afterSecondUndo = rawValue();
        const altRedoConsumed = pressKey({ key: "y", code: "KeyY", ctrlKey: true });
        const afterAltRedo = rawValue();
        // 조합 중 Ctrl+Z 는 IME 의 것이다. 여기서 되돌리면 안 된다.
        editor.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
        const composingConsumed = pressKey({ key: "z", code: "KeyZ", ctrlKey: true });
        const afterComposingUndo = rawValue();
        editor.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "" }));
        return {
          typed, undoConsumed, afterUndo, redoConsumed, afterRedo,
          afterSecondUndo, altRedoConsumed, afterAltRedo,
          composingConsumed, afterComposingUndo,
        };
      };
      const enabled = run(true);
      const disabled = run(false);
      state.settings.enableShortcuts = true;
      return { enabled, disabled };
    `));

    // --- 9) 오버레이를 껐을 때도 동작한다. 켠 상태에서는 오버레이도 따라온다 ---
    report.overlay = await evaluate(page, `
      (async () => {${PAGE_SETUP}
        const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
        const overlayText = () => elements.treeContentOverlay.textContent.replace(/\\n$/, "");

        setTreeHighlightOverlayEnabled(false);
        const offEnabled = isTreeHighlightOverlayEnabled();
        // 오버레이를 끄면 가로채기가 사라져 value 는 다시 textarea 본래의 것이다.
        const offOwnValue = Object.getOwnPropertyDescriptor(editor, "value") !== undefined;
        seed("undo-9-off", "기본");
        typeText("추가");
        undoTreeEditor();
        const offAfterUndo = rawValue();
        redoTreeEditor();
        const offAfterRedo = rawValue();
        const offHistory = treeEditorHistoryState();

        setTreeHighlightOverlayEnabled(true);
        const onEnabled = isTreeHighlightOverlayEnabled();
        const onOwnValue = Object.getOwnPropertyDescriptor(editor, "value") !== undefined;
        seed("undo-9-on", "# 제목");
        typeText(" 추가");
        await frame();
        undoTreeEditor();
        await frame();
        const onAfterUndo = rawValue();
        const onOverlayAfterUndo = overlayText();
        redoTreeEditor();
        await frame();
        const onAfterRedo = rawValue();
        const onOverlayAfterRedo = overlayText();
        return {
          offEnabled, offOwnValue, offAfterUndo, offAfterRedo, offHistory,
          onEnabled, onOwnValue, onAfterUndo, onOverlayAfterUndo, onAfterRedo, onOverlayAfterRedo,
        };
      })()
    `);

    // --- 10) 5만 자 문서에서 스택이 들고 있는 양 ---
    // 같은 편집을 두 번 돈다. 한 번은 기록하지 않고, 한 번은 기록한다.
    // 두 힙 증가의 차이가 실행 취소 스택이 실제로 붙들고 있는 양이다.
    report.memory = await evaluate(page, pageScript(`
      const big = "가나다라마바사아자차 오늘의 메모 내용입니다. ".repeat(4000).slice(0, 50000);
      state.settings.undoDepth = 50;
      const collect = () => {
        for (let round = 0; round < 6; round += 1) {
          if (typeof window.gc === "function") window.gc();
        }
      };
      const runLoop = (record) => {
        seed("undo-10", big);
        resetTreeEditorHistory("undo-10", rawValue());
        collect();
        const before = performance.memory ? performance.memory.usedJSHeapSize : 0;
        let text = big;
        for (let index = 0; index < 50; index += 1) {
          const at = 200 + index * 900;
          const inserted = "[" + index + "] 새로 쓴 문장 ";
          text = text.slice(0, at) + inserted + text.slice(at);
          setRaw(text);
          editor.setSelectionRange(at + inserted.length, at + inserted.length);
          if (record) captureTreeEditorHistory("command");
        }
        text = "";
        collect();
        const after = performance.memory ? performance.memory.usedJSHeapSize : 0;
        return { before, after, delta: after - before, history: treeEditorHistoryState() };
      };
      // 먼저 기록 없이 한 번 돌려 힙을 데운다.
      const withoutStack = runLoop(false);
      const withStack = runLoop(true);
      // 기록한 쪽에서 끝까지 되돌려 본문이 원래 글자 수로 돌아오는지 본다.
      let steps = 0;
      while (canUndoTreeEditor()) {
        undoTreeEditor();
        steps += 1;
      }
      return {
        documentChars: big.length,
        history: withStack.history,
        withoutStackDelta: withoutStack.delta,
        withStackDelta: withStack.delta,
        stackCost: withStack.delta - withoutStack.delta,
        undoSteps: steps,
        restoredChars: rawValue().length,
        naiveChars: 50 * big.length,
        preciseMemory: Boolean(performance.memory),
      };
    `));

    // --- 11) 긴 편집이 쌓이면 단계 수를 자동으로 줄인다 ---
    report.budget = await evaluate(page, pageScript(`
      state.settings.undoDepth = 100;
      seed("undo-11", "");
      for (let index = 0; index < 6; index += 1) {
        applyTreeEditorText("replace", String(index).repeat(60000), { start: 0, end: 0 });
      }
      const history = treeEditorHistoryState();
      const restored = undoTreeEditor() ? rawValue().slice(0, 1) : "";
      state.settings.undoDepth = 50;
      return { history, restored };
    `));

    // --- 12) 바깥에서 한 항목으로 기록하게 부르는 입구 ---
    report.entryPoint = await evaluate(page, pageScript(`
      seed("undo-12", "하나 둘 하나 둘 하나");
      // U2 의 모두 바꾸기가 이렇게 부른다. 여러 곳을 고쳐도 항목 하나가 된다.
      const recorded = recordTreeEditorEdit("replace", (target) => {
        target.value = rawValue().split("하나").join("ONE");
        target.setSelectionRange(0, 0);
      });
      const afterReplace = {
        recorded,
        text: rawValue(),
        note: state.data.tree[0].content,
        history: treeEditorHistoryState(),
      };
      undoTreeEditor();
      const afterUndo = { text: rawValue(), note: state.data.tree[0].content };
      redoTreeEditor();
      const afterRedo = { text: rawValue(), note: state.data.tree[0].content };
      // 읽기 전용 메모에서는 기록도 편집도 하지 않는다.
      state.data.tree[0].groupSharedReadOnly = true;
      const readOnlyRecorded = recordTreeEditorEdit("replace", (target) => {
        target.value = "바뀌면 안 된다";
      });
      const readOnlyUndo = undoTreeEditor();
      state.data.tree[0].groupSharedReadOnly = false;
      return { afterReplace, afterUndo, afterRedo, readOnlyRecorded, readOnlyUndo };
    `));

    // --- 12b) U2 바꾸기 화면. 실제 버튼을 눌러 모두 바꾸기가 한 항목으로 남는지,
    // 현재 항목 바꾸기가 매치 하나만 바꾸고 다음으로 옮기는지, 잠긴 메모에서 막히는지 본다 ---
    report.replaceUi = await evaluate(page, pageScript(`
      seed("undo-replace-all", "하나 둘 하나 둘 하나");
      openNoteFind();
      elements.noteFindInput.value = "하나";
      elements.noteFindInput.dispatchEvent(new Event("input", { bubbles: true }));
      const toggleShownBefore = elements.noteReplaceRow.classList.contains("hidden");
      elements.noteReplaceToggleBtn.click();
      const toggleShownAfter = elements.noteReplaceRow.classList.contains("hidden");
      elements.noteReplaceInput.value = "ONE";
      elements.noteReplaceInput.dispatchEvent(new Event("input", { bubbles: true }));
      const countLabel = elements.noteReplaceCount.textContent;
      const beforeEntries = treeEditorHistoryState().entries;
      elements.noteReplaceAllBtn.click();
      const afterAll = {
        text: rawValue(),
        note: state.data.tree[0].content,
        history: treeEditorHistoryState(),
      };
      undoTreeEditor();
      const afterAllUndo = { text: rawValue(), note: state.data.tree[0].content };
      redoTreeEditor();
      const afterAllRedo = { text: rawValue(), note: state.data.tree[0].content };
      closeNoteFind();

      // 현재 항목 바꾸기: 매치 하나만 바꾸고 다음 매치로 옮긴다.
      seed("undo-replace-current", "가가가");
      openNoteFind();
      elements.noteFindInput.value = "가";
      elements.noteFindInput.dispatchEvent(new Event("input", { bubbles: true }));
      elements.noteReplaceToggleBtn.click();
      elements.noteReplaceInput.value = "나";
      elements.noteReplaceInput.dispatchEvent(new Event("input", { bubbles: true }));
      elements.noteReplaceCurrentBtn.click();
      const afterCurrent = {
        text: rawValue(),
        note: state.data.tree[0].content,
        history: treeEditorHistoryState(),
        findIndex: Number(elements.noteFindInput.dataset.index || 0),
      };
      undoTreeEditor();
      const afterCurrentUndo = rawValue();
      closeNoteFind();

      // 잠긴(복호화 안 된) 메모: 바꾸기 입력/버튼이 막힌다.
      seed("undo-replace-locked", ENCRYPTED_NOTE_PREFIX + btoa(JSON.stringify({ cipher: "x" })));
      openNoteFind();
      elements.noteFindInput.value = "아무거나";
      elements.noteFindInput.dispatchEvent(new Event("input", { bubbles: true }));
      elements.noteReplaceToggleBtn.click();
      const lockedState = {
        hintHidden: elements.noteReplaceLockedHint.classList.contains("hidden"),
        inputDisabled: elements.noteReplaceInput.disabled,
        currentDisabled: elements.noteReplaceCurrentBtn.disabled,
        allDisabled: elements.noteReplaceAllBtn.disabled,
      };
      const lockedClickIgnored = (() => {
        const before = state.data.tree[0].content;
        elements.noteReplaceAllBtn.click();
        return state.data.tree[0].content === before;
      })();
      closeNoteFind();

      return {
        toggleShownBefore, toggleShownAfter, countLabel, beforeEntries,
        afterAll, afterAllUndo, afterAllRedo,
        afterCurrent, afterCurrentUndo,
        lockedState, lockedClickIgnored,
      };
    `));

    // --- 13) 브라우저가 실제로 보내는 키 이벤트로 확인한다 ---
    // 합성 KeyboardEvent 와 달리 진짜 키 입력에는 code 가 늘 실려 온다.
    // 기본 단축키에는 code 가 없으므로 그것 때문에 어긋나지 않는지 여기서 본다.
    await evaluate(page, pageScript(`
      state.settings.enableShortcuts = true;
      seed("undo-13", "바탕");
      typeText("덧붙임");
      editor.focus();
      return rawValue();
    `));
    const realKey = async (key, code, windowsVirtualKeyCode, modifiers) => {
      for (const type of ["keyDown", "keyUp"]) {
        await page.send("Input.dispatchKeyEvent", {
          type, key, code, windowsVirtualKeyCode, nativeVirtualKeyCode: windowsVirtualKeyCode, modifiers,
        });
      }
      await delay(60);
    };
    await realKey("z", "KeyZ", 90, 2);
    const realKeyUndo = await evaluate(page, "elements.treeContent.value");
    await realKey("Z", "KeyZ", 90, 10);
    const realKeyRedo = await evaluate(page, "elements.treeContent.value");
    await realKey("z", "KeyZ", 90, 2);
    await realKey("y", "KeyY", 89, 2);
    const realKeyAltRedo = await evaluate(page, "elements.treeContent.value");
    report.realKey = { realKeyUndo, realKeyRedo, realKeyAltRedo };

    console.log(JSON.stringify(report, null, 2));

    // --- 판정 ---
    const settings = report.settings;
    assert(settings.ko.title === "실행 취소 단계", `설정 제목이 다릅니다: ${settings.ko.title}`);
    assert(
      settings.ko.options.join("|") === "10:10단계|50:50단계|100:100단계",
      `설정 선택지가 다릅니다: ${settings.ko.options.join("|")}`,
    );
    assert(settings.en.title === "Undo steps", `영어 설정 제목이 다릅니다: ${settings.en.title}`);
    assert(settings.en.options.join("|") === "10 steps|50 steps|100 steps", `영어 선택지가 다릅니다: ${settings.en.options.join("|")}`);
    assert(settings.applied === 100 && settings.stored === 100, `설정이 기기에 저장되지 않았습니다: ${settings.stored}`);
    assert(settings.normalized === 50, `잘못된 저장값이 기본값으로 돌아가지 않았습니다: ${settings.normalized}`);
    assert(settings.rendered === "50", `설정 화면이 저장된 값을 보여 주지 않습니다: ${settings.rendered}`);

    const typing = report.typing;
    assert(typing.afterType.text === "시작abcde", `타자 결과가 다릅니다: ${typing.afterType.text}`);
    assert(typing.afterType.history.entries === 1, `이어 친 다섯 글자가 ${typing.afterType.history.entries}항목이 되었습니다.`);
    assert(typing.afterType.note === "시작abcde", "타자가 저장되지 않았습니다.");
    assert(typing.afterUndo.text === "시작", `실행 취소 결과가 다릅니다: ${typing.afterUndo.text}`);
    assert(typing.afterUndo.cursor === 2, `실행 취소 뒤 커서가 ${typing.afterUndo.cursor} 입니다.`);
    assert(typing.afterUndo.note === "시작", "실행 취소가 저장되지 않았습니다.");
    assert(typing.afterUndo.history.canRedo === true, "실행 취소 뒤 다시 실행이 준비되지 않았습니다.");
    assert(typing.afterRedo.text === "시작abcde", `다시 실행 결과가 다릅니다: ${typing.afterRedo.text}`);
    assert(typing.afterRedo.cursor === 7, `다시 실행 뒤 커서가 ${typing.afterRedo.cursor} 입니다.`);
    assert(typing.afterRedo.note === "시작abcde", "다시 실행이 저장되지 않았습니다.");

    const boundary = report.boundary;
    assert(boundary.newline === 3, `줄바꿈에서 끊기지 않았습니다: ${boundary.newline}항목`);
    assert(boundary.flip === 2, `넣기와 지우기가 한 항목으로 묶였습니다: ${boundary.flip}항목`);
    assert(boundary.afterFirstUndo === "abcd", `지우기 되돌리기 결과가 다릅니다: ${boundary.afterFirstUndo}`);
    assert(boundary.afterSecondUndo === "", `넣기 되돌리기 결과가 다릅니다: ${boundary.afterSecondUndo}`);

    assert(report.idleBreak.entries === 2, `쉰 뒤 이어 친 글자가 같은 항목이 되었습니다: ${report.idleBreak.entries}항목`);
    assert(report.idleBreak.afterUndo === "ab", `쉼 경계 되돌리기 결과가 다릅니다: ${report.idleBreak.afterUndo}`);

    const command = report.command;
    assert(command.afterBold.text === "**hello**", `굵게 결과가 다릅니다: ${command.afterBold.text}`);
    assert(command.afterBold.history.entries === 1, `굵게가 ${command.afterBold.history.entries}항목이 되었습니다.`);
    assert(command.afterUndo.text === "hello", `굵게 되돌리기 결과가 다릅니다: ${command.afterUndo.text}`);
    assert(command.afterUndo.start === 0 && command.afterUndo.end === 5, `굵게 되돌린 뒤 선택 범위가 ${command.afterUndo.start}-${command.afterUndo.end} 입니다.`);
    assert(command.afterUndo.note === "hello", "굵게 되돌리기가 저장되지 않았습니다.");
    assert(command.mixed === 2, `타자와 명령이 한 항목으로 묶였습니다: ${command.mixed}항목`);

    const session = report.session;
    assert(session.beforeSwitch.entries === 1, "타자 기록이 남지 않았습니다.");
    assert(session.afterSwitch.entries === 0 && session.afterSwitch.canUndo === false, "다른 메모로 옮겼는데 스택이 남아 있습니다.");
    assert(session.afterReturn.entries === 0, "돌아왔을 때 이전 메모의 기록이 되살아났습니다.");
    assert(session.afterRender.entries === 1, `같은 메모를 다시 그렸더니 기록이 사라졌습니다: ${session.afterRender.entries}항목`);
    assert(session.afterRenderUndo === "abc", `다시 그린 뒤 되돌리기 결과가 다릅니다: ${session.afterRenderUndo}`);

    const depth = report.depth;
    assert(depth.defaultDepth === 50, `기본 단계 수가 ${depth.defaultDepth} 입니다.`);
    assert(depth.fallback === 50, `잘못된 설정값이 50으로 돌아가지 않았습니다: ${depth.fallback}`);
    assert(depth.ten.entries === 10 && depth.ten.depthLimit === 10, `10단계 설정이 지켜지지 않았습니다: ${depth.ten.entries}`);
    assert(depth.fifty.entries === 50 && depth.fifty.depthLimit === 50, `50단계 설정이 지켜지지 않았습니다: ${depth.fifty.entries}`);
    assert(depth.hundred.entries === 100 && depth.hundred.depthLimit === 100, `100단계 설정이 지켜지지 않았습니다: ${depth.hundred.entries}`);

    const composition = report.composition;
    assert(composition.duringCompose.entries === 0, `조합 중에 ${composition.duringCompose.entries}항목이 쌓였습니다.`);
    assert(composition.textDuringCompose === "안", "조합 중 본문이 바뀌었습니다.");
    assert(composition.afterCompose.entries === 1, `조합이 끝난 뒤 항목이 ${composition.afterCompose.entries}개입니다.`);
    assert(composition.noteAfterCompose === "안", "조합이 끝난 뒤 저장되지 않았습니다.");
    assert(composition.textAfterSecond === "안녕", `두 번째 조합 결과가 다릅니다: ${composition.textAfterSecond}`);
    assert(composition.afterSecond.entries === 1, `이어진 두 글자가 ${composition.afterSecond.entries}항목이 되었습니다.`);
    assert(composition.afterUndo === "", `조합 되돌리기 결과가 다릅니다: ${composition.afterUndo}`);

    for (const [name, result] of Object.entries(report.shortcut)) {
      assert(result.typed === "abcXYZ", `${name}: 타자 결과가 다릅니다: ${result.typed}`);
      assert(result.undoConsumed === true, `${name}: Ctrl+Z 가 소비되지 않았습니다.`);
      assert(result.afterUndo === "abc", `${name}: Ctrl+Z 결과가 다릅니다: ${result.afterUndo}`);
      assert(result.redoConsumed === true, `${name}: Ctrl+Shift+Z 가 소비되지 않았습니다.`);
      assert(result.afterRedo === "abcXYZ", `${name}: Ctrl+Shift+Z 결과가 다릅니다: ${result.afterRedo}`);
      assert(result.altRedoConsumed === true, `${name}: Ctrl+Y 가 소비되지 않았습니다.`);
      assert(result.afterAltRedo === "abcXYZ", `${name}: Ctrl+Y 결과가 다릅니다: ${result.afterAltRedo}`);
      assert(result.composingConsumed === false, `${name}: 조합 중 Ctrl+Z 를 소비했습니다.`);
      assert(result.afterComposingUndo === "abcXYZ", `${name}: 조합 중 Ctrl+Z 가 본문을 되돌렸습니다.`);
    }

    const overlay = report.overlay;
    assert(overlay.offEnabled === false, "오버레이가 꺼지지 않았습니다.");
    assert(overlay.offOwnValue === false, "오버레이를 껐는데 value 가로채기가 남아 있습니다.");
    assert(overlay.offAfterUndo === "기본", `오버레이 끈 상태 실행 취소 결과가 다릅니다: ${overlay.offAfterUndo}`);
    assert(overlay.offAfterRedo === "기본추가", `오버레이 끈 상태 다시 실행 결과가 다릅니다: ${overlay.offAfterRedo}`);
    assert(overlay.offHistory.entries === 1, "오버레이 끈 상태에서 항목이 쌓이지 않았습니다.");
    assert(overlay.onEnabled === true, "오버레이가 다시 켜지지 않았습니다.");
    assert(overlay.onOwnValue === true, "오버레이를 켰는데 value 가로채기가 없습니다.");
    assert(overlay.onAfterUndo === "# 제목", `오버레이 켠 상태 실행 취소 결과가 다릅니다: ${overlay.onAfterUndo}`);
    assert(overlay.onOverlayAfterUndo === "# 제목", `실행 취소 뒤 오버레이가 따라오지 않았습니다: ${overlay.onOverlayAfterUndo}`);
    assert(overlay.onAfterRedo === "# 제목 추가", `오버레이 켠 상태 다시 실행 결과가 다릅니다: ${overlay.onAfterRedo}`);
    assert(overlay.onOverlayAfterRedo === "# 제목 추가", `다시 실행 뒤 오버레이가 따라오지 않았습니다: ${overlay.onOverlayAfterRedo}`);

    const memory = report.memory;
    assert(memory.documentChars === 50_000, `문서 크기가 ${memory.documentChars}자 입니다.`);
    assert(memory.history.entries === 50, `50단계가 쌓이지 않았습니다: ${memory.history.entries}항목`);
    assert(memory.undoSteps === 50, `끝까지 되돌리지 못했습니다: ${memory.undoSteps}단계`);
    assert(memory.restoredChars === 50_000, `끝까지 되돌린 본문이 ${memory.restoredChars}자 입니다.`);
    assert(memory.history.chars * 20 < memory.naiveChars, `기록이 너무 큽니다: ${memory.history.chars}자`);
    if (memory.preciseMemory) {
      // 스택이 붙들고 있는 것은 기준 본문 한 벌(약 100KB)과 조각뿐이다.
      assert(memory.stackCost < 600_000, `5만 자 문서 50단계에서 스택이 ${memory.stackCost}바이트를 붙들고 있습니다.`);
    }

    const budget = report.budget;
    assert(budget.history.depthLimit === 100, "단계 수 설정이 100이 아닙니다.");
    assert(budget.history.entries < 6, `메모리 예산에 걸렸는데 단계 수가 줄지 않았습니다: ${budget.history.entries}항목`);
    assert(budget.history.entries >= 1, "메모리 예산 때문에 기록이 전부 사라졌습니다.");
    assert(budget.history.chars <= budget.history.charBudget, `예산을 넘겼습니다: ${budget.history.chars}자`);
    assert(budget.restored !== "", "예산에 걸린 뒤 되돌리기가 되지 않았습니다.");

    const entryPoint = report.entryPoint;
    assert(entryPoint.afterReplace.recorded === true, "바깥 입구가 항목을 남기지 않았습니다.");
    assert(entryPoint.afterReplace.text === "ONE 둘 ONE 둘 ONE", `모두 바꾸기 결과가 다릅니다: ${entryPoint.afterReplace.text}`);
    assert(entryPoint.afterReplace.note === "ONE 둘 ONE 둘 ONE", "모두 바꾸기가 저장되지 않았습니다.");
    assert(entryPoint.afterReplace.history.entries === 1, `모두 바꾸기가 ${entryPoint.afterReplace.history.entries}항목이 되었습니다.`);
    assert(entryPoint.afterUndo.text === "하나 둘 하나 둘 하나", `모두 바꾸기 되돌리기 결과가 다릅니다: ${entryPoint.afterUndo.text}`);
    assert(entryPoint.afterUndo.note === "하나 둘 하나 둘 하나", "모두 바꾸기 되돌리기가 저장되지 않았습니다.");
    assert(entryPoint.afterRedo.text === "ONE 둘 ONE 둘 ONE", `모두 바꾸기 다시 실행 결과가 다릅니다: ${entryPoint.afterRedo.text}`);
    assert(entryPoint.readOnlyRecorded === false, "읽기 전용 메모에서 바깥 입구가 편집을 남겼습니다.");
    assert(entryPoint.readOnlyUndo === false, "읽기 전용 메모에서 실행 취소가 동작했습니다.");

    const replaceUi = report.replaceUi;
    assert(replaceUi.toggleShownBefore === true, "바꾸기 줄이 처음부터 펼쳐져 있습니다.");
    assert(replaceUi.toggleShownAfter === false, "바꾸기 토글을 눌렀는데 바꾸기 줄이 펼쳐지지 않았습니다.");
    assert(replaceUi.countLabel === "3개 항목을 바꿉니다", `바꾸기 전 변경 개수 표시가 다릅니다: ${replaceUi.countLabel}`);
    assert(replaceUi.afterAll.text === "ONE 둘 ONE 둘 ONE", `모두 바꾸기 버튼 결과가 다릅니다: ${replaceUi.afterAll.text}`);
    assert(replaceUi.afterAll.note === "ONE 둘 ONE 둘 ONE", "모두 바꾸기 버튼이 저장되지 않았습니다.");
    assert(
      replaceUi.afterAll.history.entries === replaceUi.beforeEntries + 1,
      `모두 바꾸기 버튼이 실행 취소 한 항목이 아닙니다: ${replaceUi.beforeEntries} -> ${replaceUi.afterAll.history.entries}`,
    );
    assert(replaceUi.afterAllUndo.text === "하나 둘 하나 둘 하나", `모두 바꾸기 버튼 되돌리기 결과가 다릅니다: ${replaceUi.afterAllUndo.text}`);
    assert(replaceUi.afterAllUndo.note === "하나 둘 하나 둘 하나", "모두 바꾸기 버튼 되돌리기가 저장되지 않았습니다.");
    assert(replaceUi.afterAllRedo.text === "ONE 둘 ONE 둘 ONE", `모두 바꾸기 버튼 다시 실행 결과가 다릅니다: ${replaceUi.afterAllRedo.text}`);

    assert(replaceUi.afterCurrent.text === "나가가", `현재 항목 바꾸기 결과가 다릅니다: ${replaceUi.afterCurrent.text}`);
    assert(replaceUi.afterCurrent.note === "나가가", "현재 항목 바꾸기가 저장되지 않았습니다.");
    assert(replaceUi.afterCurrent.history.entries === 1, `현재 항목 바꾸기가 ${replaceUi.afterCurrent.history.entries}항목이 되었습니다.`);
    assert(replaceUi.afterCurrent.findIndex === 0, `현재 항목 바꾸기 뒤 다음 매치로 옮기지 않았습니다: ${replaceUi.afterCurrent.findIndex}`);
    assert(replaceUi.afterCurrentUndo === "가가가", `현재 항목 바꾸기 되돌리기 결과가 다릅니다: ${replaceUi.afterCurrentUndo}`);

    assert(replaceUi.lockedState.hintHidden === false, "잠긴 메모에서 바꾸기 안내가 보이지 않았습니다.");
    assert(replaceUi.lockedState.inputDisabled === true, "잠긴 메모에서 바꾸기 입력칸이 막히지 않았습니다.");
    assert(replaceUi.lockedState.currentDisabled === true, "잠긴 메모에서 현재 항목 바꾸기 버튼이 막히지 않았습니다.");
    assert(replaceUi.lockedState.allDisabled === true, "잠긴 메모에서 모두 바꾸기 버튼이 막히지 않았습니다.");
    assert(replaceUi.lockedClickIgnored === true, "잠긴 메모에서 모두 바꾸기 버튼을 눌렀는데 본문이 바뀌었습니다.");

    assert(report.realKey.realKeyUndo === "바탕", `진짜 Ctrl+Z 가 되돌리지 못했습니다: ${report.realKey.realKeyUndo}`);
    assert(report.realKey.realKeyRedo === "바탕덧붙임", `진짜 Ctrl+Shift+Z 가 다시 실행하지 못했습니다: ${report.realKey.realKeyRedo}`);
    assert(report.realKey.realKeyAltRedo === "바탕덧붙임", `진짜 Ctrl+Y 가 다시 실행하지 못했습니다: ${report.realKey.realKeyAltRedo}`);

    console.log("");
    console.log(`5만 자 문서 50단계 기록: ${memory.history.chars}자 (전체 사본 방식이면 ${memory.naiveChars}자)`);
    if (memory.preciseMemory) {
      console.log(`5만 자 문서 50단계 힙 증가: 기록 없이 ${(memory.withoutStackDelta / 1024).toFixed(1)}KB, 기록하면 ${(memory.withStackDelta / 1024).toFixed(1)}KB → 스택 몫 ${(memory.stackCost / 1024).toFixed(1)}KB`);
    }
    console.log(`메모리 예산(${budget.history.charBudget}자) 자동 제한: 100단계 설정에서 ${budget.history.entries}단계로 줄었습니다.`);
    console.log("NowNote editor undo/redo check passed");
  } finally {
    browserClient?.ws?.close();
    stopBrowserProcess(browser);
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

runOnce().catch((error) => {
  console.error(`Undo check failed: ${error.message}`);
  process.exit(1);
});
