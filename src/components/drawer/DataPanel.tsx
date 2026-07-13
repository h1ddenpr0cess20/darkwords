import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { storageUsage } from '../../lib/idbStorage';
import styles from './SettingsPanel.module.css';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Everything Darkwords stores lives in this browser. This is where you get it out. */
export function DataPanel() {
  const exportData = useAppStore((s) => s.exportData);
  const importData = useAppStore((s) => s.importData);
  const clearAllData = useAppStore((s) => s.clearAllData);
  const conversations = useAppStore((s) => s.conversationOrder.length);
  const images = useAppStore((s) => s.galleryItems.length);

  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState('');
  const [confirmingClear, setConfirmingClear] = useState(false);

  const [used, setUsed] = useState(0);
  useEffect(() => {
    void storageUsage().then(setUsed);
  }, [conversations, images]);

  const onExport = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `darkwords-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Exported.');
  };

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setStatus(importData(await file.text()) ? 'Imported.' : 'That file was not a Darkwords export.');
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>STORAGE</div>
      <p className={styles.info}>
        {conversations} conversation{conversations === 1 ? '' : 's'}, {images} image{images === 1 ? '' : 's'},{' '}
        {formatBytes(used)} used in this browser. Nothing is stored on a server.
      </p>

      <div className={styles.sectionLabel} style={{ marginTop: 18 }}>
        EXPORT / IMPORT
      </div>
      <p className={styles.info}>
        An export contains your conversations, gallery, memories, skills and settings. API keys are deliberately left
        out.
      </p>

      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
      <div className={styles.partyActions}>
        <button className={styles.secondaryBtn} onClick={() => fileRef.current?.click()}>
          Import
        </button>
        <button className={styles.primaryBtn} onClick={onExport}>
          Export
        </button>
      </div>

      <div className={styles.sectionLabel} style={{ marginTop: 18 }}>
        DANGER ZONE
      </div>
      <p className={styles.info}>
        Deletes every conversation, image, memory, skill and MCP server in this browser. Your API keys are kept.
      </p>
      <div className={styles.partyActions}>
        {confirmingClear ? (
          <>
            <button className={styles.secondaryBtn} onClick={() => setConfirmingClear(false)}>
              Cancel
            </button>
            <button
              className={styles.dangerBtn}
              onClick={() => {
                clearAllData();
                setConfirmingClear(false);
                setStatus('All local data cleared.');
              }}
            >
              Yes, delete everything
            </button>
          </>
        ) : (
          <button className={styles.dangerBtn} onClick={() => setConfirmingClear(true)}>
            Clear all data
          </button>
        )}
      </div>

      {status && <p className={styles.info}>{status}</p>}
    </div>
  );
}
