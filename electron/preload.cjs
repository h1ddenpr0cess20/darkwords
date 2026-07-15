const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("darkwordsDesktop", {
  platform: process.platform,
  setTitleBarColors: (colors) => ipcRenderer.invoke("titlebar:set-colors", colors),
});
