import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { MessageRow } from './MessageRow';
import styles from './Feed.module.css';

export function Feed() {
  const messages = useAppStore((s) => s.conversations[s.activeConvoId].messages);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className={styles.feed} ref={ref}>
      <div className={styles.inner}>
        {messages.map((m) => (
          <MessageRow key={m.id} message={m} />
        ))}
      </div>
    </div>
  );
}
