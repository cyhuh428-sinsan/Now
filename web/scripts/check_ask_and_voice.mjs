/**
 * NowNote 2.3.6 U26~U28 - 묻기, 읽어주기, 음성·LLM 설정 확인.
 *
 * docs/NOW_2_3_6_FEATURE_DESIGN.md "4. 묻기와 음성의 화면 위치"가 요구하는 것을 확인한다:
 *   1. LLM이 설정되지 않으면 묻기를 열 수 없다.
 *   2. 질문을 보내면 맥락·이어지는 질문을 포함한 프롬프트가 만들어지고 답이 온다.
 *   3. 답을 메모에 넣기/복사/버리기 할 수 있다.
 *   4. 질문 길이 상한을 넘으면 막는다.
 *   5. provider마다 응답 모양이 다른 것(OpenAI 계열/Gemini/Claude)을 올바르게 해석한다.
 *   6. 읽어주기(TTS) 합성과 보이스 목록 조회가 동작한다.
 *
 * 실제 LLM/TTS 서버를 부르지 않는다. window.fetch 를 목으로 바꾼다.
 *
 * 실행:
 *   node web/scripts/check_ask_and_voice.mjs
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
    "--autoplay-policy=no-user-gesture-required",
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
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nownote-ask-voice-"));
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
    await waitForCondition(page, "typeof openAskPanel === 'function' && typeof elements !== 'undefined' && elements.askPanel", "묻기 요소 로드");

    console.log("NowNote 묻기 / 읽어주기 / 음성·LLM 설정 확인");
    console.log("");

    // 메모 하나를 만들고 선택한다.
    await evaluate(page, `(() => {
      const topic = createNode('묻기 테스트', '이 메모는 예산 계획에 대한 내용입니다.', null, 1);
      state.data.tree.push(topic);
      persist();
      renderTree();
      selectTreeNode(topic.id);
      return true;
    })()`);

    // classList만 보면 안 된다 - CSS 상세도 문제로 .hidden이 붙어도 실제로는 그려지는
    // 버그가 있었다(.server-settings-form label의 display:grid가 .hidden보다 상세도가 높았다).
    // 실제 렌더링 상태(computed display)까지 확인한다.
    const isRendered = (page, selector) => evaluate(page, `getComputedStyle(document.querySelector('${selector}')).display !== 'none'`);

    // [1] LLM 미설정 상태에서는 묻기를 열 수 없다.
    await evaluate(page, `(() => {
      state.settings.llm = defaultLlmSettings();
      renderLlmVoiceSettings();
      openAskPanel();
      return true;
    })()`);
    const blockedWithoutConfig = !(await isRendered(page, "#askPanel"));
    console.log(`[1] LLM 미설정 시 묻기 패널이 열리지 않음: ${blockedWithoutConfig}`);
    if (!blockedWithoutConfig) failures.push("LLM이 설정되지 않았는데 묻기 패널이 화면에 그려졌습니다.");

    // [2] OpenAI provider로 설정하고 묻기를 연다.
    await evaluate(page, `(() => {
      state.settings.llm = { ...defaultLlmSettings(), provider: "openai", apiKey: "test-key" };
      persistSettings();
      renderLlmVoiceSettings();
      openAskPanel();
      return true;
    })()`);
    const openedWithConfig = await isRendered(page, "#askPanel");
    console.log(`[2] LLM 설정 후 묻기 패널 열림: ${openedWithConfig}`);
    if (!openedWithConfig) failures.push("LLM을 설정했는데 묻기 패널이 화면에 그려지지 않았습니다.");

    // [2-1] LLM provider를 Ollama로 바꾸면 Ollama 전용 필드가 보이고 API 키 필드는 숨는다.
    await evaluate(page, `(() => {
      elements.llmProviderSelect.value = "ollama";
      elements.llmProviderSelect.dispatchEvent(new Event("change"));
      return true;
    })()`);
    const ollamaFieldsVisible = await isRendered(page, "#llmOllamaUrlField");
    const apiKeyFieldHiddenForOllama = !(await isRendered(page, "#llmApiKeyField"));
    console.log(`[2-2] Ollama 선택 시 Ollama 필드 표시: ${ollamaFieldsVisible}, API 키 필드 숨김: ${apiKeyFieldHiddenForOllama}`);
    if (!ollamaFieldsVisible) failures.push("Ollama를 선택했는데 Ollama 서버 주소 필드가 보이지 않습니다.");
    if (!apiKeyFieldHiddenForOllama) failures.push("Ollama를 선택했는데 API 키 필드가 여전히 보입니다.");
    await evaluate(page, `(() => {
      elements.llmProviderSelect.value = "openai";
      elements.llmProviderSelect.dispatchEvent(new Event("change"));
      return true;
    })()`);
    const ollamaFieldsHiddenForOpenai = !(await isRendered(page, "#llmOllamaUrlField"));
    console.log(`[2-3] 다시 OpenAI로 바꾸면 Ollama 필드가 숨음: ${ollamaFieldsHiddenForOpenai}`);
    if (!ollamaFieldsHiddenForOpenai) failures.push("OpenAI로 되돌렸는데 Ollama 필드가 여전히 보입니다.");
    await evaluate(page, `(() => { state.settings.llm.apiKey = "test-key"; persistSettings(); return true; })()`);

    // [3] 질문 길이 상한.
    const tooLongResult = await evaluate(page, `(() => {
      elements.askQuestionInput.value = "가".repeat(1001);
      submitAskQuestion();
      return elements.askStatusText.textContent;
    })()`);
    console.log(`[3] 질문 길이 상한 안내: ${tooLongResult}`);
    if (!/너무 깁니다|too long/i.test(tooLongResult)) failures.push(`질문 길이 상한 안내가 아닙니다: ${tooLongResult}`);

    // [4] 질문을 보내면 프롬프트에 맥락과 질문이 실리고, 답이 온다 (OpenAI 응답 모양).
    let lastRequestBody = null;
    await evaluate(page, `window.fetch = (url, options) => {
      window.__lastFetchUrl = String(url);
      window.__lastFetchBody = options?.body;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: "월 30만원으로 시작하세요." } }] }),
      });
    }; true`);
    await evaluate(page, `(() => {
      elements.askQuestionInput.value = "예산을 얼마로 잡을까?";
      return true;
    })()`);
    await evaluate(page, "submitAskQuestion()");
    const afterFirstAsk = await evaluate(page, `({
      url: window.__lastFetchUrl,
      body: window.__lastFetchBody,
      conversationLength: askConversation.length,
      lastAnswer: askConversation[askConversation.length - 1]?.answer,
      turnCount: document.querySelectorAll('.ask-turn-answer').length,
    })`);
    console.log(`[4] 요청 URL: ${afterFirstAsk.url}`);
    console.log(`[4-1] 답변: ${afterFirstAsk.lastAnswer}`);
    if (!afterFirstAsk.url.includes("api.openai.com")) failures.push(`OpenAI 엔드포인트로 요청하지 않았습니다: ${afterFirstAsk.url}`);
    if (!afterFirstAsk.body.includes("예산을 얼마로 잡을까")) failures.push("프롬프트에 질문이 실리지 않았습니다.");
    if (!afterFirstAsk.body.includes("예산 계획")) failures.push("프롬프트에 메모 맥락이 실리지 않았습니다.");
    if (afterFirstAsk.conversationLength !== 1) failures.push(`대화가 1개 쌓여야 합니다 (실제: ${afterFirstAsk.conversationLength}).`);
    if (afterFirstAsk.lastAnswer !== "월 30만원으로 시작하세요.") failures.push(`답변이 올바르게 파싱되지 않았습니다: ${afterFirstAsk.lastAnswer}`);
    if (afterFirstAsk.turnCount !== 1) failures.push(`대화 목록에 답변 1개가 그려져야 합니다 (실제: ${afterFirstAsk.turnCount}).`);

    // [5] 후속 질문에는 앞선 대화가 함께 실린다.
    await evaluate(page, `(() => {
      elements.askQuestionInput.value = "그럼 1년이면 얼마야?";
      return true;
    })()`);
    await evaluate(page, "submitAskQuestion()");
    const afterSecondAsk = await evaluate(page, "window.__lastFetchBody");
    console.log(`[5] 후속 질문 프롬프트에 앞선 대화 포함: ${afterSecondAsk.includes("월 30만원으로 시작하세요")}`);
    if (!afterSecondAsk.includes("월 30만원으로 시작하세요")) failures.push("후속 질문에 앞선 대화가 포함되지 않았습니다.");

    // [6] 답을 메모에 넣으면 본문 끝에 붙는다.
    await evaluate(page, "insertAskAnswerIntoNote(0)");
    const noteContent = await evaluate(page, "elements.treeContent.value");
    console.log(`[6] 삽입 후 본문 끝부분: ...${noteContent.slice(-80).replace(/\n/g, "\\n")}`);
    if (!noteContent.includes("> 묻기 — 예산을 얼마로 잡을까?")) failures.push("삽입된 블록에 머리줄이 없습니다.");
    if (!noteContent.includes("월 30만원으로 시작하세요.")) failures.push("삽입된 블록에 답변이 없습니다.");

    // [7] 버리기로 대화에서 제거된다.
    const beforeDiscard = await evaluate(page, "askConversation.length");
    await evaluate(page, "discardAskAnswer(0)");
    const afterDiscard = await evaluate(page, "askConversation.length");
    console.log(`[7] 버리기 - 대화 개수: ${beforeDiscard} -> ${afterDiscard}`);
    if (afterDiscard !== beforeDiscard - 1) failures.push("버리기가 대화에서 항목을 지우지 않았습니다.");

    // [8] Gemini 응답 모양 해석.
    const geminiParsed = await evaluate(page, `extractLlmChatText("gemini", { candidates: [{ content: { parts: [{ text: "제미나이 답" }] } }] })`);
    console.log(`[8] Gemini 응답 해석: ${geminiParsed}`);
    if (geminiParsed !== "제미나이 답") failures.push(`Gemini 응답 해석이 틀렸습니다: ${geminiParsed}`);

    // [9] Claude 응답 모양 해석.
    const claudeParsed = await evaluate(page, `extractLlmChatText("claude", { content: [{ text: "클로드 답" }] })`);
    console.log(`[9] Claude 응답 해석: ${claudeParsed}`);
    if (claudeParsed !== "클로드 답") failures.push(`Claude 응답 해석이 틀렸습니다: ${claudeParsed}`);

    // [10] LLM 연결 테스트 - 실패 시 상태가 bad.
    await evaluate(page, `window.fetch = () => Promise.resolve({ ok: false, status: 401, text: async () => "" }); true`);
    await evaluate(page, "testLlmConnection()");
    const llmTestState = await evaluate(page, "({ status: state.settings.llm.lastStatus, message: state.settings.llm.lastMessage })");
    console.log(`[10] LLM 연결 테스트 실패 - 상태: ${llmTestState.status}, 안내: ${llmTestState.message}`);
    if (llmTestState.status !== "bad") failures.push(`LLM 연결 실패인데 상태가 bad가 아닙니다: ${llmTestState.status}`);

    // [11] TTS 합성 - 정상 오디오 응답.
    await evaluate(page, `(() => {
      state.settings.voice = { ...defaultVoiceSettings(), ttsBaseUrl: "https://voice.example.com", voiceId: "female-1" };
      persistSettings();
      renderLlmVoiceSettings();
      return true;
    })()`);
    await evaluate(page, `window.fetch = (url) => {
      window.__lastFetchUrl = String(url);
      const bytes = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0]);
      return Promise.resolve({ ok: true, status: 200, blob: async () => new Blob([bytes], { type: "audio/wav" }) });
    }; true`);
    const ttsResult = await evaluate(page, `(async () => {
      const blob = await synthesizeSpeech("안녕하세요");
      return { url: window.__lastFetchUrl, size: blob.size, type: blob.type };
    })()`);
    console.log(`[11] TTS 합성 - URL: ${ttsResult.url}, 크기: ${ttsResult.size}, 종류: ${ttsResult.type}`);
    if (!ttsResult.url.endsWith("/v1/audio/speech")) failures.push(`TTS 요청 경로가 올바르지 않습니다: ${ttsResult.url}`);
    if (ttsResult.size === 0) failures.push("합성된 오디오 크기가 0입니다.");

    // [12] TTS가 JSON(오류)을 돌려주면 예외를 던진다.
    await evaluate(page, `window.fetch = () => Promise.resolve({ ok: true, status: 200, blob: async () => new Blob(['{"error":"x"}'], { type: "application/json" }) }); true`);
    const ttsJsonError = await evaluate(page, `(async () => {
      try { await synthesizeSpeech("안녕"); return "no-error"; } catch (e) { return e.message; }
    })()`);
    console.log(`[12] TTS가 JSON을 돌려줄 때 예외: ${ttsJsonError}`);
    if (ttsJsonError === "no-error") failures.push("TTS가 JSON을 돌려줬는데 예외를 던지지 않았습니다.");

    // [13] 보이스 목록 조회.
    await evaluate(page, `window.fetch = (url) => {
      window.__lastFetchUrl = String(url);
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ voices: [{ id: "female-1", name: "여성 1" }, { id: "male-1", name: "남성 1" }] }) });
    }; true`);
    const voices = await evaluate(page, "loadTtsVoices()");
    console.log(`[13] 보이스 목록: ${JSON.stringify(voices)}`);
    if (voices.length !== 2) failures.push(`보이스 목록이 2개여야 합니다 (실제: ${voices.length}).`);

    // [14] 읽어주기 버튼은 TTS가 설정돼 있으면 활성화된다.
    const readAloudEnabled = await evaluate(page, "!elements.readAloudBtn.disabled");
    console.log(`[14] TTS 설정 후 읽어주기 버튼 활성화: ${readAloudEnabled}`);
    if (!readAloudEnabled) failures.push("TTS를 설정했는데 읽어주기 버튼이 비활성 상태입니다.");

    // [15] 닫기 버튼을 누르면 묻기 패널이 실제로 화면에서 사라진다(computed display).
    await evaluate(page, `(() => { openAskPanel(); document.querySelector('#askCloseBtn').click(); return true; })()`);
    const closedRendered = !(await isRendered(page, "#askPanel"));
    console.log(`[15] 닫기 버튼 클릭 후 묻기 패널이 화면에서 사라짐: ${closedRendered}`);
    if (!closedRendered) failures.push("닫기 버튼을 눌러도 묻기 패널이 화면에 남아 있습니다.");

    if (failures.length > 0) {
      console.log("");
      console.log("확인 실패:");
      failures.forEach((item) => console.log(`- ${item}`));
      throw new Error(`묻기/읽어주기/음성·LLM 설정 확인 실패 ${failures.length}건`);
    }

    console.log("");
    console.log("NowNote ask + voice settings check passed");
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
  console.error(`NowNote ask/voice check failed: ${error.message}`);
  process.exit(1);
});
