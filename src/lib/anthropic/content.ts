import type Anthropic from '@anthropic-ai/sdk';
import type { Attachment } from '../../types';

export interface ApiMessage {
  role: 'user' | 'assistant';
  text: string;
  attachments?: Attachment[];
}

export type ContentBlockParam = Anthropic.Beta.BetaContentBlockParam;

function dataUrlToBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

function base64ToText(base64: string): string | null {
  try {
    const bin = atob(base64);
    if (/[\x00-\x08\x0e-\x1f]/.test(bin)) return null;
    return bin;
  } catch {
    return null;
  }
}

function attachmentToBlock(att: Attachment): ContentBlockParam {
  if (!att.dataUrl) {
    return { type: 'text', text: `[attached file: ${att.name} — content unavailable]` };
  }
  const base64 = dataUrlToBase64(att.dataUrl);

  if (att.mimeType.startsWith('image/')) {
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: att.mimeType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
        data: base64,
      },
    };
  }
  if (att.mimeType === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };
  }
  const text = base64ToText(base64);
  return text
    ? { type: 'text', text: `--- file: ${att.name} ---\n${text}\n--- end file ---` }
    : { type: 'text', text: `[attached file: ${att.name} — binary format not supported]` };
}

export function toApiContent(m: ApiMessage, includeAttachments: boolean): ContentBlockParam[] {
  const blocks: ContentBlockParam[] = [];
  if (includeAttachments) {
    for (const att of m.attachments ?? []) blocks.push(attachmentToBlock(att));
  }
  if (m.text) blocks.push({ type: 'text', text: m.text });
  if (blocks.length === 0) blocks.push({ type: 'text', text: '(no content)' });
  return blocks;
}
