import type { ContentPart } from '../types';

/**
 * Serializes parsed blocks back to plain text. Used to rebuild API history for
 * messages that predate `rawText` or were composed directly as parts.
 */
export function partsToPlainText(parts: ContentPart[]): string {
  return parts
    .map((p) => {
      if (p.type === 'para') return p.text;
      if (p.type === 'heading') return p.text;
      if (p.type === 'list') return p.items.map((i) => `- ${i}`).join('\n');
      if (p.type === 'code') return '```\n' + p.text + '\n```';
      return '';
    })
    .join('\n\n');
}

/** Strips inline bold/italic/code markers — blocks render as plain text. */
function cleanInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(?<!\*)\*(?!\*)(.+?)\*(?!\*)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

/**
 * Converts raw markdown-ish assistant text into the paragraph/heading/list/code
 * block model the feed renders. Deliberately lightweight — no inline styling,
 * matching the compact plain-text look of the source design.
 */
export function parseBlocks(raw: string): ContentPart[] {
  const parts: ContentPart[] = [];
  const lines = raw.replace(/\r\n/g, '\n').split('\n');

  let i = 0;
  let paraBuf: string[] = [];
  let listBuf: string[] = [];

  const flushPara = () => {
    if (paraBuf.length) {
      const text = cleanInline(paraBuf.join(' '));
      if (text) parts.push({ type: 'para', text });
      paraBuf = [];
    }
  };
  const flushList = () => {
    if (listBuf.length) {
      parts.push({ type: 'list', items: listBuf.map(cleanInline).filter(Boolean) });
      listBuf = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      flushPara();
      flushList();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      parts.push({ type: 'code', text: codeLines.join('\n') });
      continue;
    }

    const headingMatch = line.match(/^#{1,6}\s+(.*)/);
    const boldOnlyMatch = line.match(/^\*\*(.+?)\*\*$/);
    if (headingMatch || boldOnlyMatch) {
      flushPara();
      flushList();
      const text = cleanInline(headingMatch ? headingMatch[1] : boldOnlyMatch![1]);
      if (text) parts.push({ type: 'heading', text });
      i++;
      continue;
    }

    const listMatch = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)/);
    if (listMatch) {
      flushPara();
      listBuf.push(listMatch[1]);
      i++;
      continue;
    }

    if (line.trim() === '') {
      flushPara();
      flushList();
      i++;
      continue;
    }

    flushList();
    paraBuf.push(line.trim());
    i++;
  }
  flushPara();
  flushList();

  return parts;
}
