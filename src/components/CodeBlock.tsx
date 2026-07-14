import { useState } from 'react';
import { highlightCode } from '../lib/highlight';
import styles from './CodeBlock.module.css';

export function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.lang}>{language ?? 'code'}</span>
        <button className={styles.copy} onClick={copy}>
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre className={styles.pre}>{highlightCode(code)}</pre>
    </div>
  );
}
