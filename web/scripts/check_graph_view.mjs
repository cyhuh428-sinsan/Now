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
  assert(typeof WebSocket === "function", "현재 Node.js 런타임이 WebSocket을 지원하지 않습니다.");

  const browserPath = await findBrowser();
  const { server, port: webPort } = await startStaticServer();
  const debugPort = await freePort();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nownote-graph-check-"));
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
    await waitForCondition(page, "Boolean(document.querySelector('#graphCanvas') && typeof graphModel === 'function')", "그래프 함수 로드");

    const result = await evaluate(page, `
      (() => {
        const now = new Date().toISOString();
        const node = (id, title, content, extra = {}) => ({
          id,
          title,
          content,
          parentId: null,
          level: 1,
          children: [],
          status: "active",
          syncState: "local",
          favorite: false,
          tags: extractTags(content),
          createdAt: now,
          updatedAt: now,
          ...extra,
        });
        state.data = defaultData();
        state.data.tree = [
          node("a", "Alpha", "Alpha links [[Beta]] and mentions Gamma #core", { shared: true }),
          node("b", "Beta", "Beta links [[Alpha]] #core", { shared: true }),
          node("c", "Gamma", "Gamma is mentioned but not linked #idea", { shared: false }),
          node("d", "Delta", "No links here #alone", { shared: false }),
        ];
        state.selectedTreeId = "a";
        state.settings.graph = normalizeGraphSettings({
          mode: "global",
          depth: 2,
          filter: "",
          tag: "",
          group: "topic",
          bookmarks: [],
        });
        renderGraph();
        const global = graphModel();
        const hasCanvasNodes = document.querySelectorAll("#graphCanvas .graph-node").length >= 4;
        const hasEdges = document.querySelectorAll("#graphList .graph-link").length >= 2;
        const suggestionsBefore = unlinkedMentionSuggestions(getSelectedTreeNode()).length;
        applyLinkSuggestion(unlinkedMentionSuggestions(getSelectedTreeNode())[0]);
        const appliedLink = getSelectedTreeNode().content.includes("[[Gamma]]");
        state.settings.graph.mode = "local";
        state.settings.graph.depth = 1;
        renderGraph();
        const local = graphModel();
        state.settings.graph.filter = "Alpha";
        state.settings.graph.tag = "core";
        saveGraphBookmark();
        const bookmarkSaved = state.settings.graph.bookmarks.length === 1 && state.settings.graph.bookmarks[0].tag === "core";
        renderTree();
        elements.propertyStatusSelect.value = "active";
        elements.propertyPrioritySelect.value = "high";
        elements.propertyTypeInput.value = "자료";
        elements.propertyProjectInput.value = "NowNote";
        elements.propertySourceInput.value = "설계서";
        elements.propertyAuthorInput.value = "신산";
        elements.propertyDueInput.value = "2026-06-15";
        updateSelectedNoteProperties();
        const propertiesSaved = getSelectedTreeNode().properties.status === "active"
          && getSelectedTreeNode().properties.priority === "high"
          && getSelectedTreeNode().properties.project === "NowNote";
        openPropertiesView();
        const propertiesRendered = document.querySelectorAll("#propertiesList .properties-row").length >= 1;
        state.settings.properties.search = "NowNote";
        state.settings.properties.status = "active";
        state.settings.properties.priority = "high";
        state.settings.properties.group = "project";
        savePropertyFilter();
        const propertyFilterSaved = state.settings.properties.savedFilters.length === 1
          && state.settings.properties.savedFilters[0].group === "project";
        const missingRendered = document.querySelectorAll("#propertiesMissingList .backlink-item").length >= 1;
        elements.propertyTemplateSelect.value = "meeting";
        createNoteFromPropertyTemplate();
        const templateCreated = getSelectedTreeNode().properties.type === "회의"
          && getSelectedTreeNode().content.includes("## 결정");
        state.selectedTreeId = "a";
        state.data.canvases = [];
        openCanvasView();
        addSelectedNoteCanvasCard();
        addTextCanvasCard();
        const canvas = activeCanvas();
        const noteCard = canvas.cards.find((card) => card.type === "note");
        const textCard = canvas.cards.find((card) => card.type === "text");
        state.selectedCanvasCardIds = [noteCard.id, textCard.id];
        connectSelectedCanvasCards();
        moveSelectedCanvasCard(40, 40);
        adjustCanvasZoom(0.1);
        const movedCanvas = activeCanvas();
        const movedTextCard = movedCanvas.cards.find((card) => card.type === "text");
        const canvasBasics = movedCanvas.cards.length === 2
          && movedCanvas.edges.length === 1
          && movedTextCard.x >= 160
          && movedCanvas.zoom > 1;
        createCanvasDraftFromGraph();
        const graphDraft = activeCanvas().cards.length >= 2
          && document.querySelectorAll("#canvasBoard .canvas-board-card").length >= 2;
        state.data.captures = [];
        openCaptureView();
        elements.captureContentInput.value = "- [ ] 첫 일\\n- [x] 끝난 일";
        elements.captureChecklistToggle.checked = true;
        elements.capturePinToggle.checked = true;
        elements.captureColorSelect.value = "amber";
        elements.captureLabelInput.value = "idea, now";
        elements.captureReminderInput.value = "2026-06-15T09:30";
        pendingCaptureAttachment = normalizeCaptureAttachment({
          name: "sample.png",
          type: "image/png",
          size: 2048,
          dataUrl: "data:image/png;base64,",
        });
        captureSketchDirty = true;
        saveQuickCapture();
        const capture = state.data.captures[0];
        const captureSaved = capture
          && capture.pinned
          && capture.color === "amber"
          && capture.checklist.length === 2
          && capture.labels.includes("idea")
          && capture.reminderAt
          && capture.attachments[0]?.name === "sample.png"
          && capture.sketchData.startsWith("data:image/png");
        toggleCaptureArchive(capture.id);
        elements.captureFilterSelect.value = "archived";
        renderCaptures();
        const captureArchived = state.data.captures[0].archived
          && document.querySelectorAll("#captureList .capture-item").length === 1;
        state.selectedTreeId = "a";
        openCommandPalette();
        const commandPaletteRendered = document.querySelectorAll("#commandPaletteList .command-item").length >= 6;
        executeCommand("template-meeting");
        const commandTemplate = getSelectedTreeNode();
        const commandTemplateCreated = commandTemplate?.properties?.type === "회의"
          && commandTemplate.content.includes("## 결정");
        createUniqueNote();
        const uniqueCreated = /^메모 \\d{8}-\\d{6}$/.test(getSelectedTreeNode().title);
        const randomOpened = openRandomNote() !== false && Boolean(getSelectedTreeNode());
        const splitNode = node("split", "Split Source", "Intro\\n\\n## First\\nOne\\n\\n## Second\\nTwo", { shared: false });
        state.data.tree.push(splitNode);
        state.selectedTreeId = "split";
        renderTree();
        const splitDone = splitSelectedNoteByHeading()
          && getSelectedTreeNode().children.length === 2
          && getSelectedTreeNode().content.trim() === "Intro";
        const mergeDone = mergeSelectedNoteChildren()
          && getSelectedTreeNode().content.includes("## 하위 메모 병합")
          && getSelectedTreeNode().children.length === 2;
        const slashNode = node("slash", "Slash Note", "/template source", { shared: false });
        state.data.tree.push(slashNode);
        state.selectedTreeId = "slash";
        renderTree();
        elements.treeContent.value = "/template source";
        elements.treeContent.setSelectionRange(elements.treeContent.value.length, elements.treeContent.value.length);
        const slashDone = executeSlashCommandFromEditor()
          && getSelectedTreeNode().content.includes("## 출처")
          && getSelectedTreeNode().properties.type === "자료";
        state.data.snapshots = [];
        state.data.importReports = [];
        state.selectedTreeId = "a";
        createRecoverySnapshot("manual");
        const snapshotCreated = state.data.snapshots.length === 1
          && state.data.snapshots[0].summary.tree >= 1;
        const convertedImport = markdownFileToImportNode("obsidian.md", [
          "---",
          "title: Obsidian Imported",
          "status: active",
          "priority: high",
          "type: 자료",
          "project: NowNote",
          "tags: [imported, obsidian]",
          "---",
          "본문 [[Alpha|알파]]",
          "![[image.png]]",
        ].join("\\n"));
        const frontmatterMapped = convertedImport.node.properties.priority === "high"
          && convertedImport.node.properties.project === "NowNote"
          && convertedImport.node.tags.includes("obsidian")
          && convertedImport.node.content.includes("[[Alpha]]")
          && convertedImport.node.content.includes("[첨부: image.png]");
        recordImportReport("Markdown 가져오기", [{ nodes: [convertedImport.node], report: convertedImport.report }]);
        renderRecoveryPanel();
        const reportRendered = document.querySelectorAll("#importReportList .import-report-item").length === 1;
        state.data.tree = [convertedImport.node];
        state.selectedTreeId = convertedImport.node.id;
        const restoreOk = (() => {
          const beforeTitle = getSelectedTreeNode().title;
          const snapshotId = state.data.snapshots[0].id;
          elements.snapshotSelect.value = snapshotId;
          const preserved = state.data.snapshots;
          const reports = state.data.importReports;
          state.data = backupDataShape(state.data.snapshots[0].data);
          state.data.snapshots = preserved;
          state.data.importReports = reports;
          normalizeData();
          return flattenTree(state.data.tree).some((node) => node.title !== beforeTitle);
        })();
        const publicNode = createNode("Public Publish", "공개 본문\\n---\\n두 번째 슬라이드", null, 1);
        publicNode.shared = true;
        const privateNode = createNode("Private Publish", "password: hidden", null, 1);
        privateNode.shared = false;
        const sensitiveNode = createNode("Sensitive Publish", "연락처 test@example.com", null, 1);
        sensitiveNode.shared = true;
        state.data.tree = [publicNode, privateNode, sensitiveNode];
        state.data.publishBundles = [];
        state.selectedPublishBundleId = "";
        renderPublishPanel();
        elements.publishTitleInput.value = "NowNote 공개 묶음";
        elements.publishDescriptionInput.value = "공개 설명";
        elements.publishPermalinkInput.value = "nownote-public";
        savePublishBundle();
        const savedBundle = state.data.publishBundles[0];
        const publishExcluded = publishExclusionReason(privateNode) === "공유 안 함"
          && !buildPublishBundleContent(savedBundle).nodes.some((item) => item.id === privateNode.id);
        const sensitiveWarning = scanPublishSensitiveContent(buildPublishBundleContent(savedBundle).nodes).length === 1
          && document.querySelectorAll("#publishSensitiveList .publish-sensitive-item").length === 1;
        const publicHtml = buildPublicHtmlDocument(buildPublishBundleContent(savedBundle));
        const slidesHtml = buildSlidesHtmlDocument(buildPublishBundleContent(savedBundle));
        const publishHtmlExported = publicHtml.includes("Public Publish")
          && !publicHtml.includes("Private Publish")
          && publicHtml.includes("test@example.com");
        const publishSlidesExported = slidesHtml.includes('class="slide"')
          && (slidesHtml.match(/class="slide"/g) || []).length >= 2
          && typeof exportPublishHtml === "function"
          && typeof exportPublishSlides === "function";
        const staleDate = "2025-01-01T00:00:00.000Z";
        const workspaceA = node("workspace-a", "Workspace Alpha", "## 정리\\nhttps://sinsan.kr\\n[[Workspace Beta]] #ops", {
          updatedAt: now,
          properties: { status: "active", priority: "high", type: "운영", project: "NowNote" },
        });
        const workspaceB = node("workspace-b", "Workspace Beta", "Back to [[Workspace Alpha]]\\n[[Workspace Gamma]]\\n[[Workspace Delta]]\\n[[Workspace Epsilon]]\\n[[Workspace Zeta]]", {
          updatedAt: now,
          properties: { status: "active", priority: "normal", type: "운영", project: "NowNote" },
        });
        const workspaceC = node("workspace-c", "Workspace Old", "오래된 고립 메모", {
          updatedAt: staleDate,
          properties: {},
        });
        const workspaceD = node("workspace-d", "Workspace Delta", "[[Workspace Beta]]", { updatedAt: now });
        const workspaceE = node("workspace-e", "Workspace Epsilon", "[[Workspace Beta]]", { updatedAt: now });
        const workspaceZ = node("workspace-z", "Workspace Zeta", "[[Workspace Beta]]", { updatedAt: now });
        state.data.tree = [workspaceA, workspaceB, workspaceC, workspaceD, workspaceE, workspaceZ];
        state.selectedTreeId = "workspace-a";
        state.search = "ops";
        state.settings.openTreeTabs = ["workspace-a", "workspace-b"];
        state.settings.pinnedTreeTabs = ["workspace-a"];
        state.settings.graph = normalizeGraphSettings({ mode: "local", depth: 2, filter: "Workspace", tag: "ops", group: "tag" });
        state.settings.properties = normalizePropertyViewSettings({ search: "NowNote", status: "active", priority: "high", group: "project" });
        state.settings.workspaces = defaultWorkspaceSettings();
        renderTree();
        renderSettings();
        elements.workspaceNameInput.value = "운영 점검";
        saveCurrentWorkspace();
        state.selectedTreeId = "workspace-c";
        state.search = "";
        state.settings.openTreeTabs = ["workspace-c"];
        state.settings.graph = normalizeGraphSettings({ mode: "global", depth: 1, filter: "", tag: "", group: "topic" });
        elements.workspaceSelect.value = state.settings.workspaces.items[0].id;
        applySelectedWorkspace();
        renderSettings();
        const workspaceSaved = state.settings.workspaces.items.length === 1
          && state.settings.workspaces.items[0].state.graph.tag === "ops";
        const workspaceApplied = state.selectedTreeId === "workspace-a"
          && state.search === "ops"
          && state.settings.openTreeTabs.includes("workspace-b")
          && state.settings.graph.mode === "local"
          && state.settings.properties.group === "project";
        const healthReport = knowledgeHealthReport();
        const workspaceHealth = healthReport.summary.isolated >= 1
          && healthReport.summary.stale >= 1
          && healthReport.summary.hubs >= 1
          && healthReport.summary.missing >= 1
          && document.querySelectorAll("#workspaceHealthList .workspace-health-item").length >= 1;
        const workspaceLinks = externalLinksForText(getSelectedTreeNode().content).includes("https://sinsan.kr")
          && document.querySelectorAll("#workspaceExternalLinks .workspace-link-item").length === 1;
        state.settings.server.ownerId = "alice";
        state.settings.server.deviceId = "web-client";
        state.data.tree = [];
        applyPulledServerNotes([
          {
            owner_id: "alice",
            device_id: "web-client",
            local_id: "alice-root",
            note_type: "tree",
            title: "Alice Shared",
            content: "내 공유 메모",
            parent_local_id: null,
            level: 1,
            tags: "mine",
            source: "web-tree",
            client_updated_at: "2026-06-01T00:00:00",
            deleted_at: null,
            created_at: "2026-06-01T00:00:00",
            updated_at: "2026-06-01T00:00:00",
          },
          {
            owner_id: "bob",
            device_id: "pc",
            local_id: "shared-root",
            note_type: "tree",
            title: "Bob Shared",
            content: "조회만 가능",
            parent_local_id: null,
            level: 1,
            tags: "group",
            source: "web-tree",
            client_updated_at: "2026-06-01T00:00:00",
            deleted_at: null,
            created_at: "2026-06-01T00:00:00",
            updated_at: "2026-06-01T00:00:00",
          },
        ]);
        state.sharedView = "mine";
        renderTreeListOnly();
        const mineSharedView = document.querySelectorAll("#treeList .tree-node").length === 1
          && document.querySelector("#treeList")?.textContent.includes("Alice Shared")
          && !document.querySelector("#treeList")?.textContent.includes("Bob Shared");
        state.sharedView = "group-tree";
        renderTreeListOnly();
        const groupTreeSharedView = document.querySelectorAll("#treeList .tree-node").length === 2
          && document.querySelector("#treeList")?.textContent.includes("Alice Shared")
          && document.querySelector("#treeList")?.textContent.includes("Bob Shared");
        state.sharedView = "member";
        renderTreeListOnly();
        const memberSharedView = document.querySelectorAll("#treeList .member-shared-section").length === 2
          && document.querySelector("#treeList")?.textContent.includes("alice")
          && document.querySelector("#treeList")?.textContent.includes("bob");
        const groupNode = flattenTree(state.data.tree).find((node) => node.groupSharedReadOnly);
        state.selectedTreeId = groupNode.id;
        renderTree();
        const groupSharedReadOnly = groupNode.id === "group:bob:shared-root"
          && groupNode.groupSharedReadOnly
          && groupNode.remoteOwnerId === "bob"
          && elements.treeTitleInput.disabled
          && elements.treeContent.readOnly;
        groupNode.syncState = "pending";
        const groupSharedNotPushed = !buildServerSyncNotes(state.settings.server)
          .some((note) => note.local_id === "shared-root" || note.title === "Bob Shared");
        return {
          globalNodes: global.nodes.length,
          globalEdges: global.edges.length,
          isolatedCount: global.isolated.length,
          hubCount: global.hubs.length,
          localNodes: local.nodes.length,
          hasCanvasNodes,
          hasEdges,
          suggestionsBefore,
          appliedLink,
          bookmarkSaved,
          propertiesSaved,
          propertiesRendered,
          propertyFilterSaved,
          missingRendered,
          templateCreated,
          canvasBasics,
          graphDraft,
          captureSaved,
          captureArchived,
          commandPaletteRendered,
          commandTemplateCreated,
          uniqueCreated,
          randomOpened,
          splitDone,
          mergeDone,
          slashDone,
          snapshotCreated,
          frontmatterMapped,
          reportRendered,
          restoreOk,
          publishExcluded,
          sensitiveWarning,
          publishHtmlExported,
          publishSlidesExported,
          workspaceSaved,
          workspaceApplied,
          workspaceHealth,
          workspaceLinks,
          mineSharedView,
          groupTreeSharedView,
          memberSharedView,
          groupSharedReadOnly,
          groupSharedNotPushed,
        };
      })()
    `);

    assert(result.globalNodes === 4, "전체 그래프 노드 수가 맞지 않습니다.");
    assert(result.globalEdges >= 2, "전체 그래프 연결이 부족합니다.");
    assert(result.isolatedCount >= 1, "고립 메모가 표시되지 않습니다.");
    assert(result.hubCount >= 1, "허브 메모가 표시되지 않습니다.");
    assert(result.localNodes >= 2 && result.localNodes < result.globalNodes, "로컬 그래프 깊이 필터가 동작하지 않습니다.");
    assert(result.hasCanvasNodes, "그래프 캔버스 노드가 렌더링되지 않았습니다.");
    assert(result.hasEdges, "그래프 연결 목록이 렌더링되지 않았습니다.");
    assert(result.suggestionsBefore >= 1, "연결 후보가 표시되지 않습니다.");
    assert(result.appliedLink, "연결 후보가 [[링크]]로 반영되지 않았습니다.");
    assert(result.bookmarkSaved, "그래프 북마크가 저장되지 않았습니다.");
    assert(result.propertiesSaved, "메모 속성이 저장되지 않았습니다.");
    assert(result.propertiesRendered, "속성 목록이 렌더링되지 않았습니다.");
    assert(result.propertyFilterSaved, "속성 필터가 저장되지 않았습니다.");
    assert(result.missingRendered, "누락 속성 목록이 렌더링되지 않았습니다.");
    assert(result.templateCreated, "속성 템플릿 메모가 생성되지 않았습니다.");
    assert(result.canvasBasics, "Canvas 카드/연결/이동/확대가 동작하지 않습니다.");
    assert(result.graphDraft, "그래프 주변 메모 Canvas 초안이 생성되지 않았습니다.");
    assert(result.captureSaved, "빠른 기록 카드가 저장되지 않았습니다.");
    assert(result.captureArchived, "빠른 기록 보관함 흐름이 동작하지 않습니다.");
    assert(result.commandPaletteRendered, "명령 팔레트가 렌더링되지 않았습니다.");
    assert(result.commandTemplateCreated, "명령 팔레트 템플릿 생성이 동작하지 않습니다.");
    assert(result.uniqueCreated, "고유 메모 생성이 동작하지 않습니다.");
    assert(result.randomOpened, "랜덤 메모 열기가 동작하지 않습니다.");
    assert(result.splitDone, "제목 섹션 기준 메모 나누기가 동작하지 않습니다.");
    assert(result.mergeDone, "하위 메모 병합이 동작하지 않습니다.");
    assert(result.slashDone, "Slash command가 동작하지 않습니다.");
    assert(result.snapshotCreated, "복구 스냅샷이 생성되지 않았습니다.");
    assert(result.frontmatterMapped, "Markdown frontmatter와 Obsidian 표기 보정이 동작하지 않습니다.");
    assert(result.reportRendered, "가져오기 진단 목록이 렌더링되지 않았습니다.");
    assert(result.restoreOk, "스냅샷 복구 데이터 적용이 동작하지 않습니다.");
    assert(result.publishExcluded, "공개 제외 문서가 출판 묶음에서 제외되지 않았습니다.");
    assert(result.sensitiveWarning, "출판 전 민감정보 후보가 표시되지 않았습니다.");
    assert(result.publishHtmlExported, "공개 HTML 내보내기 생성이 동작하지 않습니다.");
    assert(result.publishSlidesExported, "발표 HTML 내보내기 생성이 동작하지 않습니다.");
    assert(result.workspaceSaved, "작업공간 저장이 동작하지 않습니다.");
    assert(result.workspaceApplied, "작업공간 복원이 동작하지 않습니다.");
    assert(result.workspaceHealth, "지식 건강 점검이 렌더링되지 않습니다.");
    assert(result.workspaceLinks, "현재 메모 외부 링크 목록이 표시되지 않습니다.");
    assert(result.mineSharedView, "내 공유메모 조회가 내 공유 문서만 표시하지 않습니다.");
    assert(result.groupTreeSharedView, "그룹 지식체계 조회가 그룹 공유 문서를 함께 표시하지 않습니다.");
    assert(result.memberSharedView, "구성원별 공유문서 조회가 소유자별로 묶이지 않습니다.");
    assert(result.groupSharedReadOnly, "그룹 공유 메모가 읽기 전용으로 표시되지 않습니다.");
    assert(result.groupSharedNotPushed, "그룹 공유 읽기 전용 메모가 동기화 업로드 대상에 포함됩니다.");
    console.log("NowNote graph view check passed");
    console.log("- Global and local graph rendering works");
    console.log("- Isolated notes, hub notes, and unlinked mention suggestions work");
    console.log("- Suggested links and graph filter bookmarks work");
    console.log("- Note properties, saved filters, missing checks, and templates work");
    console.log("- Canvas cards, edges, zoom, movement, and graph drafts work");
    console.log("- Quick capture pins, colors, checklists, reminders, attachments, sketches, and archive work");
    console.log("- Command palette, slash commands, templates, unique notes, random notes, merge, and split work");
    console.log("- Recovery snapshots, frontmatter mapping, Obsidian import conversion, and import reports work");
    console.log("- Publish bundles, sensitive checks, public HTML, and slides HTML export work");
    console.log("- Workspaces, knowledge health checks, and external link lists work");
    console.log("- Web group shared views split mine, group tree, and member sections");
    console.log("- Group-shared notes are rendered read-only and excluded from upload");
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
  console.error(`NowNote graph view check failed: ${error.message}`);
  process.exit(1);
});
