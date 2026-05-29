const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("path");

const APP_TITLE = "NowNote";

function createMainWindow() {
  const iconPath = path.join(__dirname, "app", "icons", "nownote-icon.svg");
  const window = new BrowserWindow({
    title: APP_TITLE,
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: "#f6f3ec",
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  window.loadFile(path.join(__dirname, "app", "index.html"));

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
  ]);
}

app.whenReady().then(() => {
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
