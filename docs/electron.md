# Desktop app (Electron)

Darkwords ships an optional desktop wrapper in
[`electron/main.cjs`](../electron/main.cjs). It is a thin shell — it serves the
built web app (`dist/`) from the privileged `darkwords://app` protocol and loads
it in a `BrowserWindow`. All app logic still lives in the web app; the native
layer only adds desktop integration a plain browser tab cannot provide. It is
wired into the existing `package.json`, so there is no separate project.

The web app runs identically to the browser: requests go straight from the
desktop to `api.anthropic.com` or a local LM Studio server, and every
conversation stays in IndexedDB / local storage inside the window's session.
There is no backend.

## What the desktop shell adds

- **Custom title bar** — the window is frameless (`titleBarStyle: "hidden"`) and
  the web app renders its own title bar
  ([`src/components/DesktopTitlebar.tsx`](../src/components/DesktopTitlebar.tsx)),
  themed with the app's CSS variables and doubling as the window drag region. On
  Windows and Linux it recolors the native window-control overlay to the active
  theme's accent through the [`electron/preload.cjs`](../electron/preload.cjs)
  bridge; macOS keeps its standard traffic lights. In a browser the bridge is
  absent, so the bar never appears.
- **Stable local app origin** — `main.cjs` serves `dist/` through the
  `darkwords://app` protocol with an `index.html` SPA fallback. Keeping this
  origin stable across launches is what lets Chromium retain the app's IndexedDB
  conversations and settings.
- **Anthropic proxy** — the shell forwards the app's same-origin `/anthropic`
  path to `https://api.anthropic.com` (the role Vite/nginx/Vercel play on the
  web), so the Files API used for code-interpreter output downloads works in the
  packaged app despite its lack of CORS preflight support.
- **Downloads** — files save straight to the OS Downloads folder instead of
  prompting a save dialog.
- **External links** — navigation to any other origin opens in the system
  browser; the app window itself never navigates away.
- **Single instance** — a second launch focuses the existing window.

## Run in development

```bash
npm install
npm run electron      # build dist/ and launch the desktop app
```

`npm run electron` rebuilds the web app on every launch. Use
`npm run electron:run` to skip the build and relaunch the existing `dist/`.

## Package a distributable

```bash
npm run electron:dist
# -> release/
```

Produces a `dmg`/`zip` on macOS, an `AppImage` on Linux, and an `nsis`
installer on Windows, per the `build` config in `package.json`. Use
`npm run electron:pack` for an unpacked directory instead of an installer.

Electron is pinned to an exact version (`43.1.1`) so desktop builds are
reproducible.
