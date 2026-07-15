import styles from '../SettingsPanel.module.css';

export function AboutTab() {
  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>DARKWORDS</div>
      <p className={styles.info}>
        A client-side AI chat app for the Anthropic API and local models — a port of{' '}
        <a
          href="https://github.com/h1ddenpr0cess20/Wordmark"
          target="_blank"
          rel="noreferrer noopener"
          className={styles.link}
        >
          Wordmark
        </a>
        's feature set onto Claude, with a new UI.
      </p>

      <div className={styles.sectionLabel} style={{ marginTop: 18 }}>
        STACK
      </div>
      <p className={styles.info}>
        React 19 + TypeScript, built with Vite. Zustand for state, persisted to IndexedDB. The Anthropic SDK is called
        directly from the browser — no backend — pointed at either the Anthropic API or an LM Studio server.
      </p>

      <div className={styles.sectionLabel} style={{ marginTop: 18 }}>
        PRIVACY
      </div>
      <p className={styles.info}>
        Everything — conversations, gallery, memories, skills and API keys — lives only in this browser's IndexedDB.
        Nothing is stored on a server.
      </p>

      <div className={styles.sectionLabel} style={{ marginTop: 18 }}>
        LINKS
      </div>
      <p className={styles.info}>
        <a
          href="https://github.com/h1ddenpr0cess20/darkwords"
          target="_blank"
          rel="noreferrer noopener"
          className={styles.link}
        >
          Source on GitHub
        </a>
        {' · '}
        <a
          href="https://github.com/h1ddenpr0cess20/darkwords/blob/main/LICENSE"
          target="_blank"
          rel="noreferrer noopener"
          className={styles.link}
        >
          MIT License
        </a>
      </p>

      <p className={styles.info} style={{ marginTop: 18 }}>
        Created by Dustin Whyte. The UI was designed with Claude Design and polished with Claude Code.
      </p>
    </div>
  );
}
