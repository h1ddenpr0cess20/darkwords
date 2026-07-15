import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAccent } from '../lib/theme';
import { EXPORT_FORMAT_LIST, exportConversation, type ExportFormatKey } from '../lib/conversationExport';
import { DownloadIcon } from './icons';
import styles from './ExportMenu.module.css';

/** The header control that exports the active conversation in a chosen format. */
export function ExportMenu() {
  const convo = useAppStore((s) => s.conversations[s.activeConvoId]);
  const format = useAppStore((s) => s.exportFormat);
  const includeThinking = useAppStore((s) => s.exportIncludeThinking);
  const setFormat = useAppStore((s) => s.setExportFormat);
  const setIncludeThinking = useAppStore((s) => s.setExportIncludeThinking);

  const { accent, accentBg } = useAccent();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const cssVars = { '--accent': accent, '--accent-bg': accentBg } as CSSProperties;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (!convo) return null;

  const hasMessages = convo.messages.some((m) => !m.streaming && (m.rawText.trim() || m.thinking?.trim()));

  const onExport = () => {
    const ok = exportConversation(convo, format, includeThinking);
    setStatus(ok ? 'Exported.' : 'Nothing to export yet.');
    if (ok) setOpen(false);
  };

  return (
    <div className={styles.root} ref={rootRef} style={cssVars}>
      <button
        className={styles.trigger}
        onClick={() => {
          setStatus('');
          setOpen((v) => !v);
        }}
        title="Export this conversation"
        disabled={!hasMessages}
      >
        <DownloadIcon size={15} stroke="currentColor" />
      </button>

      {open && (
        <div className={styles.menu}>
          <div className={styles.menuLabel}>FORMAT</div>
          <div className={styles.formats}>
            {EXPORT_FORMAT_LIST.map((f) => (
              <button
                key={f.key}
                className={`${styles.formatOption} ${format === f.key ? styles.selected : ''}`}
                onClick={() => setFormat(f.key as ExportFormatKey)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <label className={styles.checkRow}>
            <input type="checkbox" checked={includeThinking} onChange={(e) => setIncludeThinking(e.target.checked)} />
            <span>Include reasoning</span>
          </label>

          <button className={styles.exportBtn} onClick={onExport}>
            Export conversation
          </button>
          {status && <span className={styles.status}>{status}</span>}
        </div>
      )}
    </div>
  );
}
