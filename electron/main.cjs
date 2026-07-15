const { app, BrowserWindow, ipcMain, protocol, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const DIST_DIR = path.join(__dirname, "..", "dist");
const APP_ORIGIN = "darkwords://app";

const TITLEBAR_HEIGHT = 36;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

// Same-origin path the web app proxies to api.anthropic.com. In the browser
// this is handled by Vite/nginx/Vercel (see vite.config.ts); the packaged app
// serves its own origin, so the shell forwards it to the real endpoint. This
// is what lets the Files API (code-interpreter output downloads) work, since
// api.anthropic.com does not answer CORS preflights for it.
const ANTHROPIC_PROXY_PREFIX = "/anthropic";
const ANTHROPIC_ORIGIN = "https://api.anthropic.com";

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".wasm": "application/wasm",
};

protocol.registerSchemesAsPrivileged([{
  scheme: "darkwords",
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true,
  },
}]);

async function proxyAnthropic(request, pathname) {
  const target = ANTHROPIC_ORIGIN + pathname.slice(ANTHROPIC_PROXY_PREFIX.length) + new URL(request.url).search;
  const headers = new Headers(request.headers);
  headers.delete("origin");
  headers.delete("host");
  const init = { method: request.method, headers, redirect: "manual" };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }
  return fetch(target, init);
}

async function readAppAsset(request) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url).pathname);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  if (pathname === ANTHROPIC_PROXY_PREFIX || pathname.startsWith(`${ANTHROPIC_PROXY_PREFIX}/`)) {
    return proxyAnthropic(request, pathname);
  }

  const relativePath = pathname === "/" ? "index.html" : `.${pathname}`;
  const filePath = path.resolve(DIST_DIR, relativePath);
  if (filePath !== DIST_DIR && !filePath.startsWith(`${DIST_DIR}${path.sep}`)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const data = await fs.promises.readFile(filePath);
    return new Response(data, {
      headers: { "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream" },
    });
  } catch {
    try {
      const data = await fs.promises.readFile(path.join(DIST_DIR, "index.html"));
      return new Response(data, { headers: { "Content-Type": "text/html" } });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }
}

let mainWindow = null;

async function createWindow() {
  if (!fs.existsSync(path.join(DIST_DIR, "index.html"))) {
    throw new Error(`Build not found at ${DIST_DIR}. Run "npm run build" in the project root first.`);
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 420,
    minHeight: 500,
    icon: path.join(__dirname, "icon.png"),
    backgroundColor: "#121210",
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#121210",
      symbolColor: "#ececea",
      height: TITLEBAR_HEIGHT,
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`${APP_ORIGIN}/`)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`${APP_ORIGIN}/`)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === "media");
  });

  mainWindow.webContents.session.on("will-download", (_event, item) => {
    item.setSavePath(path.join(app.getPath("downloads"), item.getFilename()));
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(`${APP_ORIGIN}/`);
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  ipcMain.handle("titlebar:set-colors", (event, colors) => {
    if (process.platform === "darwin") return;
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || !colors || !HEX_COLOR.test(colors.color) || !HEX_COLOR.test(colors.symbolColor)) {
      return;
    }
    try {
      win.setTitleBarOverlay({
        color: colors.color,
        symbolColor: colors.symbolColor,
        height: TITLEBAR_HEIGHT,
      });
    } catch {}
  });

  app.whenReady().then(async () => {
    try {
      protocol.handle("darkwords", request => readAppAsset(request));
      await createWindow();
    } catch (err) {
      console.error(err.message);
      app.quit();
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
