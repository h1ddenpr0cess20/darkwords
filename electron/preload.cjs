const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("darkwordsDesktop", {
  platform: process.platform,
  setTitleBarColors: (colors) => ipcRenderer.invoke("titlebar:set-colors", colors),
  writeText: (text) => ipcRenderer.invoke("clipboard:write-text", String(text)),
});
