import { useAppStore } from '../../store/useAppStore';
import { SettingsPanel } from './SettingsPanel';
import { HistoryPanel } from './HistoryPanel';
import { GalleryPanel } from './GalleryPanel';
import styles from './Drawer.module.css';

export function Drawer() {
  const activePanel = useAppStore((s) => s.activePanel);
  const closePanel = useAppStore((s) => s.closePanel);

  if (!activePanel) return null;

  const title = activePanel === 'settings' ? 'Settings' : activePanel === 'history' ? 'Chat History' : 'Media Gallery';

  return (
    <>
      <div className={styles.overlay} onClick={closePanel} />
      <div className={styles.panel}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <div className={styles.headerSpacer} />
          <button className={styles.closeBtn} onClick={closePanel}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {activePanel === 'settings' && <SettingsPanel />}
        {activePanel === 'history' && <HistoryPanel />}
        {activePanel === 'gallery' && <GalleryPanel />}
      </div>
    </>
  );
}
