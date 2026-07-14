import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { MessageRow } from './MessageRow';
import styles from './Feed.module.css';

/** How close to the bottom still counts as "following along". */
const PIN_THRESHOLD_PX = 80;

export function Feed() {
  const activeConvoId = useAppStore((s) => s.activeConvoId);
  const messages = useAppStore((s) => s.conversations[s.activeConvoId]?.messages ?? []);
  const ref = useRef<HTMLDivElement>(null);

  const pinnedToBottom = useRef(true);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < PIN_THRESHOLD_PX;
  };

  useEffect(() => {
    pinnedToBottom.current = true;
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeConvoId]);

  useEffect(() => {
    const el = ref.current;
    if (el && pinnedToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className={styles.feed} ref={ref} onScroll={onScroll}>
      <div className={styles.inner}>
        {messages.map((m) => (
          <MessageRow key={m.id} message={m} />
        ))}
      </div>
    </div>
  );
}
