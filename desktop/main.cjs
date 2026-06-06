const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");
const fs = require("fs");
const path = require("path");

const APP_TITLE = "NowNote";
const APP_INDEX = path.join(__dirname, "app", "index.html");
const APP_HELP = path.join(__dirname, "app", "help.html");
const DESKTOP_STORE_VERSION = 1;

if (process.env.NOWNOTE_DESKTOP_USER_DATA_DIR) {
  app.setPath("userData", path.resolve(process.env.NOWNOTE_DESKTOP_USER_DATA_DIR));
}

function desktopStorePath() {
  return path.join(app.getPath("userData"), "nownote-desktop-store.json");
}

function defaultDesktopStore() {
  return {
    version: DESKTOP_STORE_VERSION,
    updatedAt: null,
    values: {},
  };
}

function readDesktopStore() {
  const storePath = desktopStorePath();
  try {
    if (!fs.existsSync(storePath)) {
      return defaultDesktopStore();
    }
    const parsed = JSON.parse(fs.readFileSync(storePath, "utf8"));
    return {
      ...defaultDesktopStore(),
      ...parsed,
      values: parsed && typeof parsed.values === "object" && parsed.values ? parsed.values : {},
    };
  } catch {
    return defaultDesktopStore();
  }
}

function writeDesktopStore(store) {
  const storePath = desktopStorePath();
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function registerDesktopStorageHandlers() {
  ipcMain.handle("nownote:desktop-store-info", () => {
    const store = readDesktopStore();
    return {
      path: desktopStorePath(),
      version: DESKTOP_STORE_VERSION,
      updatedAt: store.updatedAt,
      keys: Object.keys(store.values),
    };
  });

  ipcMain.handle("nownote:desktop-store-read", (_event, key) => {
    const store = readDesktopStore();
    return store.values[key] ?? null;
  });

  ipcMain.handle("nownote:desktop-store-write", (_event, key, value) => {
    const store = readDesktopStore();
    store.values[key] = value;
    store.updatedAt = new Date().toISOString();
    writeDesktopStore(store);
    return { ok: true, path: desktopStorePath(), updatedAt: store.updatedAt };
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

function createMainWindow(startFile = APP_INDEX) {
  const iconPath = path.join(__dirname, "app", "icons", "nownote-icon.svg");
  const window = new BrowserWindow({
    title: APP_TITLE,
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

  window.loadFile(startFile);

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

app.whenReady().then(() => {
  registerDesktopStorageHandlers();
  Menu.setApplicationMenu(createMenu());
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
