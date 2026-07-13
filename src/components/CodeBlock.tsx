import { highlightCode } from '../lib/highlight';
import styles from './CodeBlock.module.css';

export function CodeBlock({ code }: { code: string }) {
  return <pre className={styles.pre}>{highlightCode(code)}</pre>;
}
