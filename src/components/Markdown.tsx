import { Children, isValidElement, memo, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';
import styles from './Markdown.module.css';

const remarkPlugins = [remarkGfm];

const components: Components = {
  code: ({ children }) => <code className={styles.inlineCode}>{children}</code>,
  pre: ({ children }) => {
    const child = Children.toArray(children)[0];
    if (isValidElement(child)) {
      const props = child.props as { className?: string; children?: ReactNode };
      const source = String(props.children ?? '').replace(/\n$/, '');
      const language = /language-(\w+)/.exec(props.className ?? '')?.[1];
      return <CodeBlock code={source} language={language} />;
    }
    return <pre>{children}</pre>;
  },
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
};

/**
 * Renders assistant text as real markdown — bold, italics, inline code, links,
 * tables, quotes and fenced code. react-markdown produces React elements rather
 * than an HTML string, so there is nothing to sanitise.
 */
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className={styles.md}>
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
});
