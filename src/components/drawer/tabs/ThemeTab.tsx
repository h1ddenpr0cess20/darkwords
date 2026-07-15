import type { CSSProperties } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { THEMES } from '../../../lib/config';
import { APP_MODE, switchMode, type AppMode } from '../../../lib/mode';
import styles from '../SettingsPanel.module.css';

const MODES: { key: AppMode; label: string }[] = [
  { key: 'dark', label: 'Dark' },
  { key: 'light', label: 'Light' },
];

export function ThemeTab() {
  const themeId = useAppStore((s) => s.themeId);
  const setTheme = useAppStore((s) => s.setTheme);

  return (
    <>
      <div className={styles.section}>
        <div className={styles.sectionLabel}>MODE</div>
        <div className={styles.modeRow}>
          {MODES.map((m) => (
            <button
              key={m.key}
              className={`${styles.modeBtn} ${APP_MODE === m.key ? styles.modeBtnOn : ''}`}
              onClick={() => switchMode(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className={styles.info}>
          Light and dark keep entirely separate chats, settings, and personas — switching reloads into the other.
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>ACCENT THEME</div>
        <div className={styles.themeRow}>
          {THEMES.map((th) => {
            const vars = { borderColor: themeId === th.id ? th.color : undefined } as CSSProperties;
            return (
              <button
                key={th.id}
                className={`${styles.themeBtn} ${themeId === th.id ? styles.selected : ''}`}
                style={vars}
                onClick={() => setTheme(th.id)}
              >
                <span className={styles.themeSwatch} style={{ background: th.color }} />
                <span className={styles.themeLabel}>{th.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
