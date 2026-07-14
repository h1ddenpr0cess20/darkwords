import type { ChatMessage } from '../types';
import { useAppStore } from '../store/useAppStore';
import { Markdown } from './Markdown';
import styles from './MarginAnnotations.module.css';

export function MarginAnnotations({ message }: { message: ChatMessage }) {
  const toggleThinking = useAppStore((s) => s.toggleThinking);

  const tools = message.tools ?? [];
  const hasTrace = Boolean(message.thinking) || tools.length > 0;
  if (!hasTrace) return null;

  const label = message.thinking ? 'reasoning' : 'tool calls';

  return (
    <div className={styles.margin}>
      {hasTrace && (
        <div className={styles.thinking}>
          <button className={styles.thinkingToggle} onClick={() => toggleThinking(message.id)}>
            <span className={styles.thinkingLabel}>{label}</span>
            {tools.length > 0 && <span className={styles.toolCount}>{tools.length}</span>}
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

          {message.thinkingOpen && (
            <div className={styles.trace}>
              {message.thinking && (
                <div className={styles.thinkingText}>
                  <Markdown text={message.thinking} />
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}
