/**
 * Bridge to the Electron desktop shell (`electron/preload.cjs`).
 *
 * The desktop window is frameless (`titleBarStyle: "hidden"` in
 * `electron/main.cjs`), so the web app renders its own drag strip
 * (see {@link ../components/DesktopTitlebar}) and pushes the active theme's
 * accent to the native window-control overlay on Windows and Linux. In a
 * regular browser the bridge is absent and every helper here is inert.
 */

import { APP_MODE } from './mode';

/** Bridge exposed by `electron/preload.cjs` when running in the desktop app. */
export interface DesktopBridge {
  platform: string;
  setTitleBarColors: (colors: { color: string; symbolColor: string }) => Promise<void>;
  writeText?: (text: string) => Promise<void>;
}

declare global {
  interface Window {
    darkwordsDesktop?: DesktopBridge;
  }
}

/** Height of the custom title bar, shared with `DesktopTitlebar.module.css`. */
export const TITLEBAR_HEIGHT = 36;

/** The desktop window's fixed background, matching `--bg` in tokens.css. */
export const TITLEBAR_BG = APP_MODE === 'light' ? '#f7f7f4' : '#121210';

/** The preload bridge, or `undefined` in a plain browser. */
export function desktopBridge(): DesktopBridge | undefined {
  return typeof window !== 'undefined' ? window.darkwordsDesktop : undefined;
}

/** Whether the app is running inside the Electron desktop shell. */
export function isDesktopApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.darkwordsDesktop) || navigator.userAgent.includes('Electron');
}

export async function copyText(text: string): Promise<boolean> {
  const native = desktopBridge()?.writeText;
  if (native) {
    try {
      await native(text);
      return true;
    } catch {
      return false;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
