import type { ReactNode } from 'react';

interface Rule {
  re: RegExp;
  color: string;
  italic?: boolean;
}

const RULES: Rule[] = [
  { re: /\/\/.*$/m, color: 'var(--text-6)', italic: true },
  { re: /(['"`])(?:\\.|(?!\1).)*\1/, color: 'var(--accent-ember)' },
  {
    re: /\b(const|let|var|function|return|await|async|for|of|in|if|else|while|new|class|extends|try|catch|throw|import|export|default)\b/,
    color: 'var(--accent-dusk)',
  },
  { re: /\b(true|false|null|undefined|this)\b/, color: 'var(--persona-orin)' },
  { re: /\b\d+(\.\d+)?\b/, color: 'var(--persona-orin)' },
  { re: /[a-zA-Z_$][\w$]*(?=\s*\()/, color: 'var(--accent-ink)' },
];

/** Regex-rule based highlighter, matching the source prototype's approach. */
export function highlightCode(src: string): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = src;
  let key = 0;

  while (rest.length) {
    let best: { index: number; text: string; rule: Rule } | null = null;
    for (const rule of RULES) {
      const m = rest.match(rule.re);
      if (m && m.index !== undefined && (best === null || m.index < best.index)) {
        best = { index: m.index, text: m[0], rule };
      }
    }
    if (!best) {
      out.push(rest);
      break;
    }
    if (best.index > 0) out.push(rest.slice(0, best.index));
    out.push(
      <span
        key={key++}
        style={{ color: best.rule.color, fontStyle: best.rule.italic ? 'italic' : undefined }}
      >
        {best.text}
      </span>,
    );
    rest = rest.slice(best.index + best.text.length);
  }
  return out;
}
