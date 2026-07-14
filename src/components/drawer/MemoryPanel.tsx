import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { MAX_MEMORY_CHARS } from '../../lib/tools/memory';
import styles from './SettingsPanel.module.css';

/**
 * Memories the assistant keeps about you. Claude adds them itself via the
 * `remember` tool; they are appended to the system prompt on every turn, and the
 * oldest drop off once the limit is reached.
 */
export function MemoryPanel() {
  const enabled = useAppStore((s) => s.memoryEnabled);
  const toggle = useAppStore((s) => s.toggleMemory);
  const limit = useAppStore((s) => s.memoryLimit);
  const setLimit = useAppStore((s) => s.setMemoryLimit);
  const memories = useAppStore((s) => s.memories);
  const addMemory = useAppStore((s) => s.addMemory);
  const removeMemory = useAppStore((s) => s.removeMemory);
  const clearMemories = useAppStore((s) => s.clearMemories);

  const [draft, setDraft] = useState('');
  const [limitDraft, setLimitDraft] = useState(String(limit));

  /**
   * Resync when the store value changes underneath the draft — e.g. async
   * IndexedDB rehydration landing after mount. Without this, blurring the
   * untouched field would commit the stale pre-hydration default and trim
   * memories the user never asked to lose.
   */
  useEffect(() => {
    setLimitDraft(String(limit));
  }, [limit]);

  const submit = () => {
    if (!draft.trim()) return;
    addMemory(draft);
    setDraft('');
  };

  /**
   * Committing on blur (not per keystroke) matters: setLimit trims stored
   * memories immediately, so applying a half-typed value like "" or "5"
   * while the user is entering "50" would permanently delete memories.
   */
  const commitLimit = () => {
    const parsed = Math.floor(Number(limitDraft));
    if (Number.isFinite(parsed) && parsed >= 1) {
      setLimit(parsed);
      setLimitDraft(String(parsed));
    } else {
      setLimitDraft(String(limit));
    }
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>MEMORY</div>

      <div className={styles.toolRow}>
        <span className={styles.toolText}>
          <span className={styles.toolLabel}>Enable memory</span>
          <span className={styles.toolHint}>Claude can save and recall brief details about you</span>
        </span>
        <button className={`${styles.switch} ${enabled ? styles.on : ''}`} onClick={toggle}>
          <span className={`${styles.switchKnob} ${enabled ? styles.on : ''}`} />
        </button>
      </div>

      <label className={styles.fieldLabel}>Limit — oldest memories drop off beyond this</label>
      <input
        type="number"
        min={1}
        className={styles.apiInput}
        value={limitDraft}
        onChange={(e) => setLimitDraft(e.target.value)}
        onBlur={commitLimit}
        onKeyDown={(e) => e.key === 'Enter' && commitLimit()}
      />

      <label className={styles.fieldLabel}>Add a memory yourself</label>
      <textarea
        className={styles.textarea}
        rows={2}
        maxLength={MAX_MEMORY_CHARS}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="e.g. I write in British English and prefer tabs"
      />
      <div className={styles.partyActions}>
        <button className={styles.secondaryBtn} onClick={clearMemories} disabled={!memories.length}>
          Clear all
        </button>
        <button className={styles.primaryBtn} onClick={submit} disabled={!draft.trim()}>
          Add memory
        </button>
      </div>

      <div className={styles.sectionLabel} style={{ marginTop: 18 }}>
        SAVED ({memories.length}/{limit})
      </div>
      {memories.length === 0 && <p className={styles.info}>Nothing remembered yet.</p>}
      {memories.map((m) => (
        <div key={m.id} className={styles.listRow}>
          <span className={styles.listText}>{m.text}</span>
          <button className={styles.characterRemove} onClick={() => removeMemory(m.id)} title="Forget this">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
