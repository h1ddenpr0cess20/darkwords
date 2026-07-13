import { useAppStore } from '../../store/useAppStore';
import { partsToPlainText } from '../../lib/blocks';
import { formatRelativeTime } from '../../lib/time';
import styles from './HistoryPanel.module.css';

export function HistoryPanel() {
  const conversations = useAppStore((s) => s.conversations);
  const order = useAppStore((s) => s.conversationOrder);
  const activeConvoId = useAppStore((s) => s.activeConvoId);
  const selectConversation = useAppStore((s) => s.selectConversation);
  const newConversation = useAppStore((s) => s.newConversation);

  return (
    <div className={styles.list}>
      <button className={styles.newBtn} onClick={newConversation}>
        + New conversation
      </button>
      {order.map((id) => {
        const c = conversations[id];
        if (!c) return null;
        const last = c.messages[c.messages.length - 1];
        const snippet = last ? partsToPlainText(last.parts).slice(0, 80) : 'No messages yet';
        return (
          <button
            key={id}
            className={`${styles.item} ${id === activeConvoId ? styles.active : ''}`}
            onClick={() => selectConversation(id)}
          >
            <span className={styles.itemTitle}>{c.title}</span>
            <span className={styles.itemSnippet}>{snippet}</span>
            <span className={styles.itemTime}>{formatRelativeTime(c.updatedAt)}</span>
          </button>
        );
      })}
    </div>
  );
}
