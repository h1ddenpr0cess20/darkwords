import type { CSSProperties } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { THEMES } from '../../../lib/config';
import styles from '../SettingsPanel.module.css';

export function ThemeTab() {
  const themeId = useAppStore((s) => s.themeId);
  const setTheme = useAppStore((s) => s.setTheme);

  return (
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
  );
}
