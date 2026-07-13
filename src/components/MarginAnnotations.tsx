import type { ChatMessage } from '../types';
import { useAppStore } from '../store/useAppStore';
import styles from './MarginAnnotations.module.css';

export function MarginAnnotations({ message }: { message: ChatMessage }) {
  const toggleThinking = useAppStore((s) => s.toggleThinking);

  const tools = message.tools ?? [];
  const images = message.imageGen ?? [];
  if (!message.thinking && tools.length === 0 && images.length === 0) return null;

  return (
    <div className={styles.margin}>
      {message.thinking && (
        <div className={styles.thinking}>
          <button className={styles.thinkingToggle} onClick={() => toggleThinking(message.id)}>
            <span className={styles.thinkingLabel}>reasoning</span>
            <svg
              width="9"
              height="9"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-8)"
              strokeWidth="3"
              className={`${styles.thinkingChevron} ${message.thinkingOpen ? styles.open : ''}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {message.thinkingOpen && <p className={styles.thinkingText}>{message.thinking}</p>}
        </div>
      )}

      {tools.map((tool) => (
        <div key={tool.id} className={styles.tool}>
          <div className={styles.toolHead}>
            <span className={styles.toolDot} />
            <span className={styles.toolName}>{tool.name}</span>
          </div>
          <span className={styles.toolInput}>{tool.input}</span>
          {tool.output && (
            <span className={tool.isError ? styles.toolError : styles.toolOutput}>{tool.output}</span>
          )}
        </div>
      ))}

      {images.map((img, i) => (
        <div key={i} className={styles.imageGen}>
          <img className={styles.imageTile} src={img.src} alt={img.label} loading="lazy" />
          <span className={styles.imageLabel}>{img.label}</span>
        </div>
      ))}
    </div>
  );
}
