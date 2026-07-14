import { useAppStore } from '../../store/useAppStore';
import { SettingsPanel } from './SettingsPanel';
import { HistoryPanel } from './HistoryPanel';
import { GalleryPanel } from './GalleryPanel';
import { CloseIcon } from '../icons';
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
            <CloseIcon size={13} />
          </button>
        </div>

        {activePanel === 'settings' && <SettingsPanel />}
        {activePanel === 'history' && <HistoryPanel />}
        {activePanel === 'gallery' && <GalleryPanel />}
      </div>
    </>
  );
}
