/**
 * NowNote 2.3.6 M8d - 기본 단축키가 실제 키 입력에서 동작하는지 검사.
 *
 * 왜 진짜 키 입력이어야 하는가:
 *   합성 KeyboardEvent 에는 code 가 비어 있다. 기본 단축키 정의에도 code 가 없으므로
 *   둘을 견주면 우연히 맞는다. 실제 keydown 에는 code 가 늘 실려 오기 때문에
 *   code 를 무조건 견주던 예전 판정은 기본 단축키를 전부 죽여 놓고도 검사에 걸리지 않았다.
 *   그래서 이 검사는 CDP Input.dispatchKeyEvent 로 브라우저가 실제로 만드는 키 입력을 쓴다.
 *
 * 확인하는 것 (docs/NOW_2_3_6_WORK_PLAN.md M8d):
 *   - 기본 단축키(Ctrl+B, Ctrl+I, Ctrl+Shift+7, Ctrl+Shift+P, Ctrl+Shift+F, Escape)가 동작하는지
 *   - 사용자가 다시 잡은 조합(= code 가 실린 조합)이 동작하고 예전 기본값은 더 이상 안 먹는지
 *   - 자판 배열이 바뀌어 key 가 달라져도 다시 잡은 조합이 물리 키 위치로 동작하는지
 *   - 설정 화면의 중복 검사가 기본값 대 다시 잡은 조합 사이에서도 도는지
 *   - Ctrl+Z / Ctrl+Shift+Z 실행 취소가 여전히 동작하는지 (M8c)
 *   - 단축키 기능을 껐을 때 본문 서식 단축키는 죽고 실행 취소는 살아 있는지
 *
 * 실행:
 *   node web/scripts/check_default_shortcuts.mjs
 *
 * 하네스 구조는 web/scripts/check_editor_undo.mjs 와 같다.
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

// CDP 수정자 비트: Alt 1, Ctrl 2, Meta 4, Shift 8.
const MOD = { alt: 1, ctrl: 2, meta: 4, shift: 8 };

function modifierMask({ ctrl = false, shift = false, alt = false } = {}) {
  return (ctrl ? MOD.ctrl : 0) + (shift ? MOD.shift : 0) + (alt ? MOD.alt : 0);
}

// 페이지 안에서 쓰는 공통 준비 코드.
const PAGE_SETUP = `
  const editor = elements.treeContent;
  const now = new Date().toISOString();
  const node = (id, title, content) => ({
    id, title, content, parentId: null, level: 1, children: [],
    status: "active", syncState: "local", favorite: false,
    tags: [], createdAt: now, updatedAt: now,
  });
  // 갓 설치한 상태와 같게, 모든 동작을 기본 조합으로 되돌린다.
  // 기본 정의에는 code 가 없다(번호 목록만 예외). 그것이 이 검사의 핵심이다.
  const resetShortcuts = () => {
    state.settings.shortcuts = {};
    SHORTCUT_ACTIONS.forEach((action) => {
      state.settings.shortcuts[action.id] = { ...action.defaultShortcut };
    });
  };
  const seed = (id, content) => {
    state.data = defaultData();
    state.data.tree = [node(id, "메모", content)];
    state.selectedTreeId = id;
    renderTreeEditor();
    editor.focus();
  };
  const select = (start, end = start) => {
    editor.focus();
    editor.setSelectionRange(start, end);
    editor.dispatchEvent(new Event("select", { bubbles: true }));
  };
  const proto = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
  const rawValue = () => proto.get.call(editor);
  const setRaw = (text) => proto.set.call(editor, text);
  // 한 글자씩 실제 타자처럼 넣는다.
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
  const hidden = (element) => element.classList.contains("hidden");
`;

function pageScript(body) {
  return `(() => {${PAGE_SETUP}${body}})()`;
}

async function runOnce() {
  assert(typeof WebSocket === "function", "WebSocket 미지원");

  const browserPath = await findBrowser();
  const { server, port: webPort } = await startStaticServer();
  const debugPort = await freePort();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nownote-shortcut-check-"));
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
      "Boolean(document.querySelector('#treeContent') && typeof shortcutMatches === 'function')",
      "단축키 판정 로드",
    );

    // 브라우저가 실제로 만드는 키 입력. 합성 KeyboardEvent 와 달리 code 가 늘 실린다.
    const press = async (key, code, virtualKey, modifiers = {}) => {
      const mask = modifierMask(modifiers);
      for (const type of ["keyDown", "keyUp"]) {
        await page.send("Input.dispatchKeyEvent", {
          type,
          key,
          code,
          windowsVirtualKeyCode: virtualKey,
          nativeVirtualKeyCode: virtualKey,
          modifiers: mask,
        });
      }
      await delay(60);
    };
    const ctrl = { ctrl: true };
    const ctrlShift = { ctrl: true, shift: true };
    const ctrlAlt = { ctrl: true, alt: true };

    // --- 0) 판정 함수 자체를 들여다본다. 실제 keydown 서명과 기본 정의 서명이 어떻게 다른지 ---
    report.judgement = await evaluate(page, pageScript(`
      const real = { ctrlKey: true, shiftKey: false, altKey: false, key: "b", code: "KeyB" };
      const korean = { ctrlKey: true, shiftKey: false, altKey: false, key: "ㅂ", code: "KeyB" };
      return {
        // 기본 정의(code 없음)는 code 가 실린 실제 입력과 맞아야 한다.
        defaultAgainstReal: matchesShortcutDefinition(real, { ctrl: true, key: "b" }),
        // 다시 잡은 조합(code 있음)은 물리 키 위치로 맞아야 한다. key 는 보지 않는다.
        recordedAgainstKorean: matchesShortcutDefinition(korean, { ctrl: true, key: "b", code: "KeyB" }),
        recordedAgainstOtherCode: matchesShortcutDefinition(
          { ctrlKey: true, shiftKey: false, altKey: false, key: "b", code: "KeyN" },
          { ctrl: true, key: "b", code: "KeyB" },
        ),
        // 빈 조합은 아무것도 잡지 않는다.
        unsetMatchesNothing: matchesShortcutDefinition(real, {}),
      };
    `));

    // --- 1) 기본 단축키: 본문 편집 (Ctrl+B / Ctrl+I) ---
    await evaluate(page, pageScript(`
      state.settings.enableShortcuts = true;
      resetShortcuts();
      seed("sc-bold", "굵게할것");
      select(0, 4);
      return true;
    `));
    await press("b", "KeyB", 66, ctrl);
    report.bold = await evaluate(page, "elements.treeContent.value");

    await evaluate(page, pageScript(`
      seed("sc-italic", "기울임");
      select(0, 3);
      return true;
    `));
    await press("i", "KeyI", 73, ctrl);
    report.italic = await evaluate(page, "elements.treeContent.value");

    // --- 2) code 가 붙어 있는 기본값: Ctrl+Shift+7 (번호 목록) ---
    // Shift+7 의 key 는 "&" 라서 key 로 견주면 절대 맞지 않는다. code 로 견뎌야 한다.
    await evaluate(page, pageScript(`
      seed("sc-ol", "");
      select(0, 0);
      return true;
    `));
    await press("&", "Digit7", 55, ctrlShift);
    report.orderedList = await evaluate(page, "elements.treeContent.value");

    // --- 3) 기본 단축키: 전역 (Ctrl+Shift+P 명령 팔레트) ---
    await evaluate(page, pageScript(`
      seed("sc-palette", "바탕");
      closePopupLayers();
      return hidden(elements.commandPaletteView);
    `));
    await press("P", "KeyP", 80, ctrlShift);
    report.commandPalette = await evaluate(page, "!elements.commandPaletteView.classList.contains('hidden')");
    // Escape 는 수정자 없는 기본값이다. 함께 확인한다.
    await press("Escape", "Escape", 27, {});
    report.commandPaletteClosedByEscape = await evaluate(
      page,
      "elements.commandPaletteView.classList.contains('hidden')",
    );

    // --- 4) 기본 단축키: 본문 찾기 (Ctrl+Shift+F) ---
    await evaluate(page, pageScript(`
      seed("sc-find", "찾을 말");
      closePopupLayers();
      closeNoteFind();
      return hidden(elements.noteFindBar);
    `));
    await press("F", "KeyF", 70, ctrlShift);
    report.noteFind = await evaluate(page, "!elements.noteFindBar.classList.contains('hidden')");
    await evaluate(page, "closeNoteFind(); true");

    // --- 5) 사용자가 다시 잡은 조합 (code 가 실린 조합) ---
    await evaluate(page, pageScript(`
      resetShortcuts();
      // 설정 화면에서 Ctrl+Alt+J 를 눌러 잡은 것과 같은 모양.
      assignShortcut("bold", { ctrl: true, alt: true, key: "j", code: "KeyJ" });
      seed("sc-rebind", "다시잡기");
      select(0, 4);
      return shortcutForAction("bold");
    `));
    await press("j", "KeyJ", 74, ctrlAlt);
    report.rebound = await evaluate(page, "elements.treeContent.value");

    // 예전 기본값은 더 이상 먹지 않아야 한다.
    await evaluate(page, pageScript(`
      seed("sc-rebind-old", "옛조합");
      select(0, 3);
      return true;
    `));
    await press("b", "KeyB", 66, ctrl);
    report.reboundOldCombo = await evaluate(page, "elements.treeContent.value");

    // --- 6) 자판 배열이 바뀌어도 물리 키 위치로 동작한다 ---
    // Dvorak 에서 KeyJ 자리는 "h" 를 낸다. key 는 달라져도 code 는 그대로다.
    await evaluate(page, pageScript(`
      seed("sc-layout", "자판바꿈");
      select(0, 4);
      return true;
    `));
    await press("h", "KeyJ", 74, ctrlAlt);
    report.layoutSameCode = await evaluate(page, "elements.treeContent.value");

    // 반대로 key 만 같고 물리 키가 다르면 먹지 않아야 한다.
    await evaluate(page, pageScript(`
      seed("sc-layout-other", "다른자리");
      select(0, 4);
      return true;
    `));
    await press("j", "KeyH", 72, ctrlAlt);
    report.layoutOtherCode = await evaluate(page, "elements.treeContent.value");

    // --- 7) 설정 화면의 중복 검사 ---
    // 기본값(code 없음) 대 다시 잡은 조합(code 있음) 사이에서도 겹침을 잡아야 한다.
    report.conflict = await evaluate(page, pageScript(`
      resetShortcuts();
      state.settings.language = "ko";
      applyLanguage();
      assignShortcut("italic", { ctrl: true, key: "b", code: "KeyB" });
      const boldAfter = shortcutForAction("bold");
      return {
        boldLabel: shortcutLabel(boldAfter),
        boldKey: boldAfter.key || "",
        italicLabel: shortcutLabel(shortcutForAction("italic")),
        // 같은 물리 키를 쓰는 두 조합은 겹친 것으로 본다.
        codeVsCode: shortcutConflicts({ ctrl: true, shift: true, key: "&", code: "Digit7" }, { ctrl: true, shift: true, key: "7", code: "Digit7" }),
        // 수정자가 다르면 겹치지 않는다.
        differentModifier: shortcutConflicts({ ctrl: true, key: "b", code: "KeyB" }, { ctrl: true, shift: true, key: "b" }),
      };
    `));

    // 겹쳐서 미지정이 된 굵게는 죽고, 뺏어 간 기울임이 동작해야 한다.
    await evaluate(page, pageScript(`
      seed("sc-conflict", "겹침확인");
      select(0, 4);
      return true;
    `));
    await press("b", "KeyB", 66, ctrl);
    report.conflictWinner = await evaluate(page, "elements.treeContent.value");

    // --- 8) 실행 취소 / 다시 실행 (M8c) 이 여전히 동작한다 ---
    await evaluate(page, pageScript(`
      resetShortcuts();
      seed("sc-undo", "바탕");
      select(rawValue().length);
      typeText("덧붙임");
      editor.focus();
      return rawValue();
    `));
    await press("z", "KeyZ", 90, ctrl);
    report.undo = await evaluate(page, "elements.treeContent.value");
    await press("Z", "KeyZ", 90, ctrlShift);
    report.redo = await evaluate(page, "elements.treeContent.value");

    // --- 9) 단축키 기능을 끄면 서식 단축키는 죽고 실행 취소는 살아 있다 ---
    await evaluate(page, pageScript(`
      resetShortcuts();
      state.settings.enableShortcuts = false;
      seed("sc-off", "꺼둠");
      select(0, 3);
      return true;
    `));
    await press("b", "KeyB", 66, ctrl);
    report.disabledBold = await evaluate(page, "elements.treeContent.value");

    await evaluate(page, pageScript(`
      seed("sc-off-undo", "바탕");
      select(rawValue().length);
      typeText("덧붙임");
      editor.focus();
      return rawValue();
    `));
    await press("z", "KeyZ", 90, ctrl);
    report.disabledUndo = await evaluate(page, "elements.treeContent.value");
    await evaluate(page, "state.settings.enableShortcuts = true");

    console.log(JSON.stringify(report, null, 2));

    // --- 판정 ---
    const judgement = report.judgement;
    assert(judgement.defaultAgainstReal, "기본 정의(code 없음)가 실제 키 입력과 맞지 않습니다.");
    assert(judgement.recordedAgainstKorean, "다시 잡은 조합이 다른 자판의 key 에서 맞지 않습니다.");
    assert(!judgement.recordedAgainstOtherCode, "다시 잡은 조합이 다른 물리 키에서 잘못 맞습니다.");
    assert(!judgement.unsetMatchesNothing, "미지정 조합이 키 입력을 잡았습니다.");

    assert(report.bold === "**굵게할것**", `Ctrl+B 굵게가 동작하지 않습니다: ${report.bold}`);
    assert(report.italic === "*기울임*", `Ctrl+I 기울임이 동작하지 않습니다: ${report.italic}`);
    assert(report.orderedList === "1. ", `Ctrl+Shift+7 번호 목록이 동작하지 않습니다: ${report.orderedList}`);
    assert(report.commandPalette, "Ctrl+Shift+P 명령 팔레트가 열리지 않습니다.");
    assert(report.commandPaletteClosedByEscape, "Escape 로 명령 팔레트가 닫히지 않습니다.");
    assert(report.noteFind, "Ctrl+Shift+F 본문 찾기가 열리지 않습니다.");

    assert(report.rebound === "**다시잡기**", `다시 잡은 Ctrl+Alt+J 가 동작하지 않습니다: ${report.rebound}`);
    assert(report.reboundOldCombo === "옛조합", `다시 잡은 뒤에도 예전 Ctrl+B 가 동작합니다: ${report.reboundOldCombo}`);
    assert(report.layoutSameCode === "**자판바꿈**", `자판을 바꾸니 물리 키 위치로 동작하지 않습니다: ${report.layoutSameCode}`);
    assert(report.layoutOtherCode === "다른자리", `물리 키가 다른데 동작했습니다: ${report.layoutOtherCode}`);

    const conflict = report.conflict;
    assert(conflict.boldKey === "", `겹친 조합을 뺏긴 굵게가 미지정이 되지 않았습니다: ${conflict.boldKey}`);
    assert(conflict.boldLabel === "미지정", `겹친 조합을 뺏긴 굵게 표시가 다릅니다: ${conflict.boldLabel}`);
    assert(conflict.italicLabel === "Ctrl + B", `기울임에 잡힌 조합 표시가 다릅니다: ${conflict.italicLabel}`);
    assert(conflict.codeVsCode, "같은 물리 키를 쓰는 두 조합을 겹침으로 보지 않습니다.");
    assert(!conflict.differentModifier, "수정자가 다른 조합을 겹침으로 봅니다.");
    assert(report.conflictWinner === "*겹침확인*", `겹침을 이긴 쪽이 동작하지 않습니다: ${report.conflictWinner}`);

    assert(report.undo === "바탕", `Ctrl+Z 실행 취소가 동작하지 않습니다: ${report.undo}`);
    assert(report.redo === "바탕덧붙임", `Ctrl+Shift+Z 다시 실행이 동작하지 않습니다: ${report.redo}`);

    assert(report.disabledBold === "꺼둠", `단축키를 껐는데 Ctrl+B 가 동작합니다: ${report.disabledBold}`);
    assert(report.disabledUndo === "바탕", `단축키를 껐을 때 Ctrl+Z 가 동작하지 않습니다: ${report.disabledUndo}`);

    console.log("기본 단축키 검사 통과");
  } finally {
    browserClient?.close();
    stopBrowserProcess(browser);
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

try {
  await runOnce();
} catch (error) {
  console.error(`기본 단축키 검사 실패: ${error.message}`);
  process.exitCode = 1;
}
