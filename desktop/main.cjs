const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const { resolveDocumentPath, isRelativeDocumentReference } = require("./document-links.cjs");
const { createVaultService } = require("./vault-service.cjs");
const documentFile=require('./document-file.cjs');

const APP_TITLE = "NowNote";
const launchWorkspace=path.basename(process.execPath).toLowerCase()==='nownotewiki.exe'||process.argv.includes('--wiki')?'wiki':'note';
const APP_INDEX = path.join(__dirname, "app", "index.html");
const APP_HELP = path.join(__dirname, "app", "help.html");
const RENDERER_STORE_KEYS = new Set(["nownote.web.v1", "nownote.web.settings.v1", "nownote.library.v1", "nownote.history.v1"]);

function assertRendererStoreKey(key) {
  if (!RENDERER_STORE_KEYS.has(key)) throw new Error("Desktop storage key is not available to the renderer");
}

if (process.env.NOWNOTE_DESKTOP_USER_DATA_DIR) {
  app.setPath("userData", path.resolve(process.env.NOWNOTE_DESKTOP_USER_DATA_DIR));
}

// 같은 물리 데이터 폴더는 별칭 경로로 실행해도 하나의 소유자만 둔다.
fs.mkdirSync(app.getPath("userData"), { recursive: true });
app.setPath("userData", fs.realpathSync.native(app.getPath("userData")));
let mainWindow = null;
let wikiWindow = null;
let desktopReady = false;
const activationPending = new Set();
let quitting = false;
const primaryInstance = app.requestSingleInstanceLock({workspace:launchWorkspace});
if (!primaryInstance) app.quit();
else app.on("second-instance", (_event,_args,_cwd,data) => activateMainWindow(data?.workspace==='wiki'?'wiki':'note'));
app.on("before-quit", () => { quitting = true; });

function activateMainWindow(workspace=launchWorkspace) {
  if (quitting) return;
  if (!desktopReady) { activationPending.add(workspace); return; }
  const existing=workspace==='wiki'?wikiWindow:mainWindow;
  const window = existing && !existing.isDestroyed() ? existing : createMainWindow(APP_INDEX,workspace);
  if (window.isMinimized()) {
    window.once("restore", () => {
      if (!quitting && !window.isDestroyed()) { window.show(); window.focus(); }
    });
    window.restore();
  }
  window.show();
  window.focus();
  activationPending.delete(workspace);
}

function desktopStorePath() {
  return path.join(app.getPath("userData"), "nownote-desktop-store.json");
}

function assertTrustedStoreFrame(event){
  if(event.senderFrame?.parent||event.senderFrame?.url.split('?')[0]!==pathToFileURL(APP_INDEX).href)
    throw Error('허용되지 않은 저장소 요청입니다.');
}

function registerDesktopStorageHandlers() {
  const history=require('./history-session.cjs').createHistorySession(desktopStorePath);
  for(const [route,method]of [['open','open'],['current','current'],['full','full'],['note','note']])ipcMain.handle('nownote:history-'+route,(event,payload)=>{
    assertTrustedStoreFrame(event);assertRendererStoreKey('nownote.history.v1');
    try{return {ok:true,...history[method](event.sender,payload)};}
    catch(error){return {ok:false,message:error.message,committed:error.committed===true};}
  });
  const snapshots=new WeakMap();
  const remember=(sender,key,value)=>{
    if(!snapshots.has(sender))snapshots.set(sender,new Map());
    snapshots.get(sender).set(key,structuredClone(value));
  };
  ipcMain.handle("nownote:desktop-store-info", (event) => {
    assertTrustedStoreFrame(event);
    const store = documentFile.info(desktopStorePath());
    return {
      path: desktopStorePath()+'.sqlite',
      version: 2,
      workspaces:['note','wiki'],
      historySessions:true,
      retainedOriginal:store.retainedOriginal,
      updatedAt: store.updatedAt,
      keys: store.keys,
    };
  });

  ipcMain.handle("nownote:desktop-store-read", (event, key) => {
    assertTrustedStoreFrame(event);
    assertRendererStoreKey(key);
    const value=documentFile.readKey(desktopStorePath(),key);
    remember(event.sender,key,value);return value;
  });
  ipcMain.handle('nownote:desktop-store-read-path',(event,key,segments)=>{
    assertTrustedStoreFrame(event);assertRendererStoreKey(key);
    // A projection is not a full-store write baseline.
    return documentFile.readKeyPath(desktopStorePath(),key,segments);
  });

  function writeFrom(event,key,value,options){
    assertTrustedStoreFrame(event);
    assertRendererStoreKey(key);
    const expected=options&&Object.hasOwn(options,'expectedValue')?options.expectedValue:snapshots.get(event.sender)?.get(key);
    if(expected===undefined)throw Error('저장 기준을 먼저 읽어야 합니다. 원본은 변경하지 않았습니다.');
    const result=documentFile.writeKey(desktopStorePath(),key,value,expected);
    remember(event.sender,key,value);return {ok:true,path:desktopStorePath()+'.sqlite',updatedAt:result.updatedAt};
  }

  ipcMain.handle("nownote:desktop-store-write", writeFrom);
  ipcMain.handle('nownote:desktop-original-read',(event,key)=>{
    assertTrustedStoreFrame(event);assertRendererStoreKey(key);
    return documentFile.readOriginal(desktopStorePath(),key);
  });
  ipcMain.handle('nownote:desktop-original-write',(event,key,value,expected)=>{
    assertTrustedStoreFrame(event);assertRendererStoreKey(key);
    return documentFile.casOriginal(desktopStorePath(),key,value,expected);
  });

  ipcMain.on("nownote:desktop-store-write-sync", (event, key, value, options) => {
    try {
      event.returnValue = writeFrom(event,key,value,options);
    } catch (error) {
      event.returnValue = { ok: false, error: error.message };
    }
  });
}

function registerVaultHandlers() {
  const service = createVaultService({
    storePath: desktopStorePath(),
    backupDir: path.join(app.getPath("userData"), "vault-backups"),
  });
  ipcMain.handle("nownote:vault-choose", async () => {
    const focused = BrowserWindow.getFocusedWindow();
    const options = {
      title: "Obsidian Vault 선택",
      properties: ["openDirectory"],
    };
    const { canceled, filePaths } = focused ? await dialog.showOpenDialog(focused, options) : await dialog.showOpenDialog(options);
    if (canceled || !filePaths?.[0]) return null;
    return service.setVaultPath(filePaths[0]);
  });
  ipcMain.handle("nownote:vault-status", () => service.vaultStatus());
  ipcMain.handle("nownote:vault-preview", (_event, input) => {
    if (!input || !["toVault", "fromVault", "both"].includes(input.direction)) throw new Error("Invalid Vault direction");
    return service.previewVault({ direction: input.direction });
  });
  ipcMain.handle("nownote:vault-apply", (_event, input) => {
    if (!input || typeof input.planId !== "string" || !Array.isArray(input.selections) || input.selections.length > 5000) {
      throw new Error("Invalid Vault selections");
    }
    return service.applyVault({ planId: input.planId, selections: input.selections });
  });
  ipcMain.handle("nownote:vault-recovery-status", () => service.recoveryStatus());
  ipcMain.handle("nownote:vault-confirm-recovery", (_event, input) => {
    if (!input || typeof input.operationId !== "string" || !/^[a-f0-9-]{36}$/i.test(input.operationId)) {
      throw new Error("Invalid Vault recovery operation ID");
    }
    return service.confirmRecovery({ operationId: input.operationId });
  });
}

function loadAppFile(filePath) {
  const [window] = BrowserWindow.getAllWindows();
  if (window) {
    window.loadFile(filePath);
    window.focus();
  } else {
    createMainWindow(filePath);
  }
}

function sendAppCommand(command) {
  const [window] = BrowserWindow.getAllWindows();
  if (!window) return;
  window.webContents.executeJavaScript(
    `window.dispatchEvent(new CustomEvent("nownote:menu-command", { detail: ${JSON.stringify(command)} }))`,
  ).catch(() => {});
  window.focus();
}

function createMainWindow(startFile = APP_INDEX,workspace=launchWorkspace) {
  const iconPath = path.join(__dirname, "app", "icons", "nownote-icon.svg");
  const window = new BrowserWindow({
    title: workspace==='wiki'?'NowNote Wiki':APP_TITLE,
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: "#0f1724",
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  if(workspace==='wiki')wikiWindow=window;else mainWindow = window;
  window.on("closed", () => { if (mainWindow === window) mainWindow = null;if(wikiWindow===window)wikiWindow=null; });

  window.loadFile(startFile,workspace==='wiki'?{query:{workspace:'wiki'}}:undefined);

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("mailto:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  return window;
}

function createMenu() {
  return Menu.buildFromTemplate([
    {
      label: "파일",
      submenu: [
        { role: "reload", label: "다시 불러오기", accelerator: "Ctrl+R" },
        { type: "separator" },
        { role: "quit", label: "종료" },
      ],
    },
    {
      label: "편집",
      submenu: [
        { role: "undo", label: "실행 취소" },
        { role: "redo", label: "다시 실행" },
        { type: "separator" },
        {
          label: "검색",
          accelerator: "Ctrl+F",
          click: () => sendAppCommand("search"),
        },
        {
          label: "본문 찾기",
          accelerator: "Ctrl+Shift+F",
          click: () => sendAppCommand("noteFind"),
        },
        { type: "separator" },
        { role: "cut", label: "잘라내기" },
        { role: "copy", label: "복사" },
        { role: "paste", label: "붙여넣기" },
        { role: "selectAll", label: "전체 선택" },
      ],
    },
    {
      label: "보기",
      submenu: [
        { role: "zoomIn", label: "확대" },
        { role: "zoomOut", label: "축소" },
        { role: "resetZoom", label: "기본 크기" },
        { type: "separator" },
        { role: "togglefullscreen", label: "전체 화면" },
      ],
    },
    {
      label:'AI 지식 위키',
      submenu:[{label:'NowNote Wiki 열기',click:()=>activateMainWindow('wiki')}],
    },
    {
      label: "도움말",
      submenu: [
        {
          label: "NowNote 도움말",
          accelerator: "F1",
          click: () => loadAppFile(APP_HELP),
        },
        {
          label: "NowNote로 돌아가기",
          click: () => loadAppFile(APP_INDEX),
        },
      ],
    },
  ]);
}

if (primaryInstance) app.whenReady().then(() => {
  // Only the actual Electron single-instance owner can publish a storage marker.
  documentFile.initialize(desktopStorePath(),{syntheticLegacy:process.env.NOWNOTE_SYNTHETIC_MIGRATION==='1'});
  ipcMain.handle('nownote:open-workspace',(event,workspace)=>{
    assertTrustedStoreFrame(event);
    if(!['note','wiki'].includes(workspace))throw Error('Invalid workspace');
    activateMainWindow(workspace);return {opened:true};
  });
  ipcMain.handle("nownote:open-document-file", async (event, input) => {
    if (event.senderFrame?.parent || event.senderFrame?.url.split("?")[0] !== pathToFileURL(APP_INDEX).href) throw new Error("허용되지 않은 문서 요청입니다.");
    const owner = BrowserWindow.fromWebContents(event.sender);
    if (isRelativeDocumentReference(input)) {
      const choice = await dialog.showOpenDialog(owner, {
        title: "상대 링크의 문서 선택: " + input,
        defaultPath: path.basename(input), properties: ["openFile"],
      });
      if (choice.canceled || !choice.filePaths[0]) return { opened: false };
      input = choice.filePaths[0];
    }
    const target = await resolveDocumentPath(input);
    const answer = await dialog.showMessageBox(owner, {
      type: "question", title: "로컬 문서 열기", message: "기본 프로그램으로 이 문서를 열까요?", detail: target,
      buttons: ["취소", "열기"], defaultId: 0, cancelId: 0,
    });
    if (answer.response !== 1) return { opened: false };
    // 확인을 기다리는 동안 경로가 바뀌었으면 다시 확인한다.
    if (await resolveDocumentPath(target) !== target) throw new Error("파일 경로가 변경되었습니다.");
    const error = await shell.openPath(target);
    if (error) throw new Error(error);
    return { opened: true };
  });
  registerDesktopStorageHandlers();
  registerVaultHandlers();
  Menu.setApplicationMenu(createMenu());
  desktopReady = true;
  createMainWindow();
  for(const workspace of activationPending)activateMainWindow(workspace);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}).catch(error=>{dialog.showErrorBox('NowNote 저장소 확인',error.message);app.quit();});

app.on('will-quit',()=>documentFile.closeAll());

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
