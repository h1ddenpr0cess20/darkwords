import { useState } from 'react';
import { highlightCode } from '../lib/highlight';
import { copyText } from '../lib/desktop';
import styles from './CodeBlock.module.css';

export function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (await copyText(code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
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
