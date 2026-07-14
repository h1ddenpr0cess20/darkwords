import { useAppStore } from '../../../store/useAppStore';
import { IMAGE_MODEL } from '../../../lib/images';
import styles from '../SettingsPanel.module.css';

export function KeysTab() {
  const apiKey = useAppStore((s) => s.apiKey);
  const setApiKey = useAppStore((s) => s.setApiKey);
  const imageApiKey = useAppStore((s) => s.imageApiKey);
  const setImageApiKey = useAppStore((s) => s.setImageApiKey);

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>ANTHROPIC API KEY</div>
      <input
        type="password"
        className={styles.apiInput}
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="sk-ant-…"
        autoComplete="off"
        spellCheck={false}
      />
      <span className={styles.hint}>Required for chat. Sent only to api.anthropic.com.</span>

      <div className={styles.sectionLabel} style={{ marginTop: 18 }}>
        OPENAI API KEY
      </div>
      <input
        type="password"
        className={styles.apiInput}
        value={imageApiKey}
        onChange={(e) => setImageApiKey(e.target.value)}
        placeholder="sk-…"
        autoComplete="off"
        spellCheck={false}
      />
      <span className={styles.hint}>
        Optional. Powers the image-generation tool via {IMAGE_MODEL}; sent only to api.openai.com.
      </span>

      <span className={styles.hint} style={{ marginTop: 14 }}>
        Both keys are kept in this browser’s storage and used directly from the page. That is fine for local
        single-user use; put the keys behind a backend proxy before deploying this anywhere shared.
      </span>
    </div>
  );
}
