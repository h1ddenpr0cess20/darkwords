import type { MouseEvent } from 'react';
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
  const deleteConversation = useAppStore((s) => s.deleteConversation);

  const onDelete = (e: MouseEvent, id: string) => {
    e.stopPropagation();
    deleteConversation(id);
  };

  return (
    <div className={styles.list}>
      <button className={styles.newBtn} onClick={() => newConversation()}>
        + New conversation
      </button>
      {order.map((id) => {
        const c = conversations[id];
        if (!c) return null;
        const last = c.messages[c.messages.length - 1];
        const snippet = last ? partsToPlainText(last.parts).slice(0, 80) : 'No messages yet';
        return (
          // biome-ignore lint/a11y/useSemanticElements: can't be a <button> — it nests the delete button
          <div
            key={id}
            className={`${styles.item} ${id === activeConvoId ? styles.active : ''}`}
            onClick={() => selectConversation(id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && selectConversation(id)}
          >
            <span className={styles.itemTitle}>{c.title}</span>
            <span className={styles.itemSnippet}>{snippet}</span>
            <span className={styles.itemTime}>{formatRelativeTime(c.updatedAt)}</span>
            <button className={styles.deleteBtn} title="Delete conversation" onClick={(e) => onDelete(e, id)}>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H8a2 2 0 01-2-2V6" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
