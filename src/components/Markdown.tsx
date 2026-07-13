import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';
import styles from './Markdown.module.css';

/**
 * Renders assistant text as real markdown — bold, italics, inline code, links,
 * tables, quotes and fenced code. react-markdown produces React elements rather
 * than an HTML string, so there is nothing to sanitise.
 */
export function Markdown({ text }: { text: string }) {
  return (
    <div className={styles.md}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const source = String(children).replace(/\n$/, '');
            const language = /language-(\w+)/.exec(className ?? '')?.[1];

            const isBlock = Boolean(language) || source.includes('\n');
            if (!isBlock) {
              return (
                <code className={styles.inlineCode} {...props}>
                  {children}
                </code>
              );
            }
            return <CodeBlock code={source} language={language} />;
          },
          pre: ({ children }) => <>{children}</>,
          a: ({ children, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer noopener" className={styles.link}>
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className={styles.tableWrap}>
              <table className={styles.table}>{children}</table>
            </div>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
