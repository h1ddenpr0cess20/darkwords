import { useEffect } from 'react';
import { useAccent } from '../lib/theme';
import { desktopBridge, isDesktopApp, TITLEBAR_BG } from '../lib/desktop';
import styles from './DesktopTitlebar.module.css';

/**
 * The custom title bar for the Electron desktop shell: a frameless-window drag
 * strip carrying the Darkwords mark. It also mirrors the active theme's accent
 * onto the native window-control overlay (Windows/Linux; macOS keeps its
 * traffic lights). Renders nothing in a regular browser.
 */
export function DesktopTitlebar() {
  const { accent } = useAccent();

  useEffect(() => {
    desktopBridge()
      ?.setTitleBarColors({ color: TITLEBAR_BG, symbolColor: accent })
      .catch(() => {});
  }, [accent]);

  if (!isDesktopApp()) return null;

  return (
    <div className={styles.titlebar}>
      <svg width="15" height="15" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
        <path
          d="M4 12 L9.5 28.5 L14.5 15.5 L19 28.5 C22 20.5, 26.5 12.5, 33 5.5"
          fill="none"
          stroke={accent}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>Darkwords</span>
    </div>
  );
}
