import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage, Conversation } from '../types';

export type ExportFormatKey = 'txt' | 'md' | 'html' | 'json' | 'csv';

export interface ExportFormat {
  key: ExportFormatKey;
  label: string;
  extension: string;
  mime: string;
  build(messages: ExportMessage[], includeThinking: boolean, meta: ExportMeta): string;
}

interface ExportMeta {
  iso: string;
  title: string;
}

interface ExportMessage {
  role: string;
  senderLabel: string;
  content: string;
  reasoning: string[];
  timestamp: string;
}

const FORMAT_ALIASES: Record<string, ExportFormatKey> = {
  txt: 'txt',
  text: 'txt',
  md: 'md',
  markdown: 'md',
  html: 'html',
  htm: 'html',
  json: 'json',
  csv: 'csv',
};

/** Resolves a user-facing name or file extension to a canonical format key, or `null`. */
export function normaliseExportFormat(input: string | null | undefined): ExportFormatKey | null {
  if (!input) return null;
  return FORMAT_ALIASES[input.trim().toLowerCase()] ?? null;
}

/** Turns a conversation's messages into the flat records the format builders consume. */
function normaliseMessages(convo: Conversation): ExportMessage[] {
  return convo.messages
    .filter((m: ChatMessage) => !m.streaming && (m.rawText.trim() || m.thinking?.trim()))
    .map((m) => ({
      role: m.role,
      senderLabel: m.displayName || (m.role === 'user' ? 'You' : 'Assistant'),
      content: m.rawText.trim(),
      reasoning: m.thinking?.trim() ? [m.thinking.trim()] : [],
      timestamp: m.time ?? '',
    }));
}

const HTML_COMPONENTS: Components = {
  a: ({ children, ...props }) => (
    <a {...props} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
};

/** Renders markdown to a static HTML string with the same parser the live chat uses. */
function renderMarkdown(text: string): string {
  if (!text) return '';
  return renderToStaticMarkup(
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={HTML_COMPONENTS}>
      {text}
    </ReactMarkdown>,
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Quotes a value for a CSV cell and neutralises spreadsheet formula injection —
 * a leading `= + - @` (non-numeric) is prefixed with an apostrophe so Excel
 * treats it as text.
 */
function csvCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) && !/^-?\d/.test(value) ? `'${value}` : value;
  return `"${guarded.replace(/"/g, '""')}"`;
}

/** Standalone stylesheet inlined into the HTML export, using Darkwords' palette directly. */
const HTML_STYLES = `
* { box-sizing: border-box; }
body {
  margin: 0; padding: 32px 16px;
  background: #121210; color: #ececea;
  font-family: "Inter", system-ui, -apple-system, sans-serif;
  font-size: 16px; line-height: 1.6;
}
.export-container { max-width: 820px; margin: 0 auto; }
.export-header { margin-bottom: 28px; padding-bottom: 16px; border-bottom: 1px solid #262720; }
.export-header h1 { margin: 0 0 4px; font-size: 1.4rem; font-family: "Inter", system-ui, -apple-system, sans-serif; }
.export-header .export-sub { color: #75776d; font-size: 0.85rem; }
.chat { display: flex; flex-direction: column; gap: 20px; }
.message { display: flex; align-items: flex-start; gap: 12px; }
.avatar {
  width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0; margin-top: 2px;
  display: flex; align-items: center; justify-content: center;
  font-weight: 600; font-size: 0.78rem; color: #121210; background: #7ee787;
}
.message.user .avatar { background: #1e1f19; color: #c7c8c2; }
.bubble { min-width: 0; flex: 1; }
.meta { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; }
.sender { font-weight: 600; font-size: 0.85rem; color: #dedfd9; }
.timestamp { font-size: 0.72rem; color: #66685f; }
.content { overflow-wrap: break-word; word-break: break-word; color: #c7c8c2; }
.content > :first-child { margin-top: 0; }
.content > :last-child { margin-bottom: 0; }
.content p { margin: 0 0 12px; }
.content h1, .content h2, .content h3, .content h4 { margin: 16px 0 8px; line-height: 1.3; color: #ececea; }
.content ul, .content ol { margin: 8px 0 14px; padding-left: 24px; }
.content li { margin-bottom: 6px; }
.content li::marker { color: #7ee787; }
.content blockquote {
  margin: 14px 0; padding: 8px 16px; border-left: 3px solid #7ee787;
  background: rgba(126, 231, 135, 0.06); color: #9a9c95; border-radius: 0 8px 8px 0;
}
.content a { color: #7ee787; }
.content pre {
  background: #0e0f0c; color: #dedfd9; border: 1px solid #262720;
  padding: 14px 16px; border-radius: 8px; overflow-x: auto; margin: 10px 0;
}
.content pre code { font-family: "JetBrains Mono", "Menlo", monospace; font-size: 0.85rem; white-space: pre; }
.content code:not(pre code) {
  font-family: "JetBrains Mono", "Menlo", monospace; font-size: 0.85em;
  padding: 0.12em 0.36em; border-radius: 5px; background: #1e1f19; border: 1px solid #2a2b24;
}
.content table { width: 100%; border-collapse: collapse; margin: 10px 0 14px; }
.content th, .content td { border: 1px solid #262720; padding: 8px 12px; text-align: left; vertical-align: top; }
.content thead th { background: #1e1f19; font-weight: 600; }
.content img { max-width: 100%; height: auto; border-radius: 8px; margin: 10px 0; }
.content .empty { color: #66685f; }
details.reasoning { margin-top: 12px; border: 1px solid #262720; border-radius: 8px; background: #15160f; padding: 8px 12px; }
details.reasoning summary { cursor: pointer; font-weight: 600; font-size: 0.8rem; color: #75776d; }
details.reasoning .reasoning-body { margin-top: 8px; font-size: 0.92rem; color: #9a9c95; }
.export-footer { margin-top: 28px; text-align: center; color: #5c5e55; font-size: 0.78rem; }
`;

export const EXPORT_FORMATS: Record<ExportFormatKey, ExportFormat> = {
  txt: {
    key: 'txt',
    label: 'Plain text (.txt)',
    extension: 'txt',
    mime: 'text/plain',
    build(messages, includeThinking, meta) {
      const sections = messages.map((msg) => {
        const lines = [`${msg.senderLabel}:`];
        if (msg.content) lines.push(msg.content);
        if (includeThinking && msg.reasoning.length > 0) {
          lines.push('Reasoning:', msg.reasoning.join('\n\n'));
        }
        return lines.join('\n').trim();
      });
      return [`${meta.title} — exported ${meta.iso}`, ...sections].filter(Boolean).join('\n\n').trim();
    },
  },
  md: {
    key: 'md',
    label: 'Markdown (.md)',
    extension: 'md',
    mime: 'text/markdown',
    build(messages, includeThinking, meta) {
      const sections = messages.map((msg) => {
        const parts = [`### ${msg.senderLabel}`];
        if (msg.timestamp) parts.push(`*${msg.timestamp}*`);
        if (msg.content) parts.push(msg.content);
        if (includeThinking && msg.reasoning.length > 0) {
          parts.push('#### Reasoning', msg.reasoning.join('\n\n'));
        }
        return parts.filter(Boolean).join('\n\n').trim();
      });
      return [`# ${meta.title}\n\n*Exported ${meta.iso}*`, ...sections].filter(Boolean).join('\n\n').trim();
    },
  },
  html: {
    key: 'html',
    label: 'Web page (.html)',
    extension: 'html',
    mime: 'text/html',
    build(messages, includeThinking, meta) {
      const body = messages
        .map((msg) => {
          const roleClass = msg.role === 'user' ? 'user' : 'assistant';
          const initial = escapeHtml((msg.senderLabel || '?').trim().charAt(0).toUpperCase() || '?');
          const timestamp = msg.timestamp ? `<span class="timestamp">${escapeHtml(msg.timestamp)}</span>` : '';
          const content = msg.content ? renderMarkdown(msg.content) : '<p class="empty"><em>No content</em></p>';
          let reasoning = '';
          if (includeThinking && msg.reasoning.length > 0) {
            const inner = msg.reasoning.map(renderMarkdown).join('\n');
            reasoning = `<details class="reasoning"><summary>Reasoning</summary><div class="reasoning-body">${inner}</div></details>`;
          }
          return `        <article class="message ${roleClass}">
          <div class="avatar" aria-hidden="true">${initial}</div>
          <div class="bubble">
            <div class="meta"><span class="sender">${escapeHtml(msg.senderLabel)}</span>${timestamp}</div>
            <div class="content">${content}</div>
            ${reasoning}
          </div>
        </article>`;
        })
        .join('\n');
      return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(meta.title)}</title>
    <style>${HTML_STYLES}</style>
  </head>
  <body>
    <div class="export-container">
      <header class="export-header">
        <h1>${escapeHtml(meta.title)}</h1>
        <div class="export-sub">Exported ${escapeHtml(meta.iso)}</div>
      </header>
      <main class="chat">
${body}
      </main>
      <footer class="export-footer">Exported from Darkwords</footer>
    </div>
  </body>
</html>`;
    },
  },
  json: {
    key: 'json',
    label: 'JSON (.json)',
    extension: 'json',
    mime: 'application/json',
    build(messages, includeThinking, meta) {
      const payload = {
        title: meta.title,
        exportedAt: meta.iso,
        messages: messages.map((msg) => {
          const entry: Record<string, unknown> = {
            role: msg.role,
            sender: msg.senderLabel,
            content: msg.content,
            timestamp: msg.timestamp || undefined,
          };
          if (includeThinking && msg.reasoning.length > 0) entry.reasoning = msg.reasoning;
          return entry;
        }),
      };
      return JSON.stringify(payload, null, 2);
    },
  },
  csv: {
    key: 'csv',
    label: 'Spreadsheet (.csv)',
    extension: 'csv',
    mime: 'text/csv',
    build(messages, includeThinking) {
      const header = ['role', 'sender', 'content', 'reasoning', 'timestamp'];
      const rows = messages.map((msg) => [
        msg.role,
        msg.senderLabel,
        msg.content,
        includeThinking && msg.reasoning.length > 0 ? msg.reasoning.join(' | ') : '',
        msg.timestamp || '',
      ]);
      return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    },
  },
};

/** The ordered list of formats, for building a picker. */
export const EXPORT_FORMAT_LIST: ExportFormat[] = ['md', 'txt', 'html', 'json', 'csv'].map(
  (k) => EXPORT_FORMATS[k as ExportFormatKey],
);

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'conversation';
}

/** Serializes a conversation in the given format and triggers a browser download. */
export function exportConversation(convo: Conversation, formatKey: ExportFormatKey, includeThinking: boolean): boolean {
  const format = EXPORT_FORMATS[formatKey];
  const messages = normaliseMessages(convo);
  if (!format || messages.length === 0) return false;

  const iso = new Date().toISOString();
  const content = format.build(messages, includeThinking, { iso, title: convo.title });

  const blob = new Blob([content], { type: format.mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(convo.title)}-${iso.slice(0, 10)}.${format.extension}`;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
