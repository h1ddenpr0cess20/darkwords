import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { MessageRow } from './MessageRow';
import styles from './Feed.module.css';

/** How close to the bottom still counts as "following along". */
const PIN_THRESHOLD_PX = 80;

export function Feed() {
  const activeConvoId = useAppStore((s) => s.activeConvoId);
  const convo = useAppStore((s) => s.conversations[s.activeConvoId]);
  const messages = convo?.messages ?? [];
  const ref = useRef<HTMLDivElement>(null);

  const pinnedToBottom = useRef(true);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < PIN_THRESHOLD_PX;
  };

  /** Switching conversations always lands at the bottom, regardless of where the previous one had scrolled to. */
  useEffect(() => {
    pinnedToBottom.current = true;
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeConvoId]);

  /**
   * Keyed on `updatedAt`, not the `messages` array — view-only changes like
   * expanding a message's reasoning trace produce a new array (see
   * `patchMessage`'s `touch` flag) without bumping it, so they no longer yank
   * a pinned view back to the bottom out from under whatever the user just
   * opened to read. Real content — streamed deltas, new messages, tool
   * results — always bumps `updatedAt`, so auto-follow still tracks those.
   */
  useEffect(() => {
    const el = ref.current;
    if (el && pinnedToBottom.current) el.scrollTop = el.scrollHeight;
  }, [convo?.updatedAt]);

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
