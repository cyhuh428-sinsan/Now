const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("nownoteDesktop", {
  platform: process.platform,
  desktopShell: "electron",
});
