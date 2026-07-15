import { flushAllWrites } from './idbStorage';

export type AppMode = 'dark' | 'light';

const MODE_STORAGE_KEY = 'darkwords-mode';

const THEME_COLORS: Record<AppMode, string> = { dark: '#121210', light: '#f7f7f4' };

function readStoredMode(): AppMode {
  try {
    return localStorage.getItem(MODE_STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export const APP_MODE: AppMode = readStoredMode();

export async function switchMode(mode: AppMode): Promise<void> {
  if (mode === APP_MODE) return;
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[mode]);
  } catch {}
  await flushAllWrites();
  window.location.reload();
}
