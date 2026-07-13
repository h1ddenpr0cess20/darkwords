import { useState } from 'react';
import type { ChatMessage } from '../types';
import { useAppStore } from '../store/useAppStore';
import styles from './MessageActions.module.css';

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function RegenIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0115-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 01-15 6.7L3 16" />
    </svg>
  );
}

function BranchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="4" r="2" />
      <circle cx="6" cy="20" r="2" />
      <circle cx="18" cy="12" r="2" />
      <path d="M6 6v12" />
      <path d="M6 12h6a4 4 0 004-4V6" />
    </svg>
  );
}

/**
 * Per-message controls, revealed on hover. Regenerating keeps the previous
 * answer as a version you can page back to rather than destroying it.
 */
export function MessageActions({ message }: { message: ChatMessage }) {
  const regenerate = useAppStore((s) => s.regenerateMessage);
  const branch = useAppStore((s) => s.branchFrom);
  const selectVariant = useAppStore((s) => s.selectVariant);
  const isSending = useAppStore((s) => s.isSending);
  const inParty = useAppStore((s) => Boolean(s.activeParty));

  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard is unavailable outside a secure context.
    }
  };

  const isAssistant = message.role === 'assistant';
  const versions = message.variants?.length ?? 0;
  const current = (message.variantIndex ?? 0) + 1;

  return (
    <div className={styles.actions}>
      {message.rawText && (
        <button className={styles.btn} onClick={copy} title="Copy message">
          <CopyIcon />
          {copied && <span className={styles.label}>copied</span>}
        </button>
      )}

      {/* The party engine owns its own turn loop; regenerating a single turn
          out from under it would desynchronise the transcript. */}
      {isAssistant && !inParty && (
        <button
          className={styles.btn}
          onClick={() => void regenerate(message.id)}
          disabled={isSending}
          title="Regenerate this reply"
        >
          <RegenIcon />
        </button>
      )}

      {!inParty && (
        <button className={styles.btn} onClick={() => branch(message.id)} title="Branch a new conversation here">
          <BranchIcon />
        </button>
      )}

      {versions > 1 && (
        <span className={styles.versions}>
          <button
            className={styles.navBtn}
            disabled={current <= 1}
            onClick={() => selectVariant(message.id, (message.variantIndex ?? 0) - 1)}
            title="Previous version"
          >
            ‹
          </button>
          <span className={styles.count}>
            {current}/{versions}
          </span>
          <button
            className={styles.navBtn}
            disabled={current >= versions}
            onClick={() => selectVariant(message.id, (message.variantIndex ?? 0) + 1)}
            title="Next version"
          >
            ›
          </button>
        </span>
      )}
    </div>
  );
}
