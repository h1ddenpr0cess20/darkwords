import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { MessageRow } from './MessageRow';
import styles from './Feed.module.css';

/** How close to the bottom still counts as "following along". */
const PIN_THRESHOLD_PX = 80;

export function Feed() {
  const messages = useAppStore((s) => s.conversations[s.activeConvoId]?.messages ?? []);
  const ref = useRef<HTMLDivElement>(null);

  // Follow new output only while the reader is already at the bottom. Toggling a
  // reasoning panel rewrites the message array too, and yanking the view away
  // from the panel someone just opened is exactly the wrong response.
  const pinnedToBottom = useRef(true);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < PIN_THRESHOLD_PX;
  };

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
