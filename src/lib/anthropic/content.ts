import type Anthropic from '@anthropic-ai/sdk';
import type { Attachment } from '../../types';

/**
 * A conversation turn in the shape the app stores it — plain text plus raw
 * attachments. Converted to API content blocks at request time by
 * {@link toApiContent}.
 */
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

/** Decodes base64 to text, returning null when the bytes look binary. */
function base64ToText(base64: string): string | null {
  try {
    const bin = atob(base64);
    if (/[\x00-\x08\x0e-\x1f]/.test(bin)) return null;
    /**
     * atob yields one char per byte (Latin-1), which garbles any non-ASCII
     * text — decode the bytes as UTF-8, keeping Latin-1 as the fallback for
     * files that aren't valid UTF-8.
     */
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return bin;
    }
  } catch {
    return null;
  }
}

/** The image formats the API accepts as native image blocks. */
const IMAGE_MEDIA_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

/**
 * Converts one attachment to a content block: images and PDFs become native
 * blocks, anything that decodes as text is inlined into a labelled text block,
 * and unreadable binaries degrade to a placeholder line.
 */
function attachmentToBlock(att: Attachment): ContentBlockParam {
  if (!att.dataUrl) {
    return { type: 'text', text: `[attached file: ${att.name} — content unavailable]` };
  }
  const base64 = dataUrlToBase64(att.dataUrl);

  if (IMAGE_MEDIA_TYPES.has(att.mimeType)) {
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: att.mimeType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
        data: base64,
      },
    };
  }
  /**
   * Image formats the API rejects (SVG, BMP, TIFF…) fall through to the
   * generic path — text-decodable ones (SVG) inline as text, the rest degrade
   * to the binary placeholder — instead of failing the whole turn with a 400.
   */
  if (att.mimeType === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };
  }
  const text = base64ToText(base64);
  return text
    ? { type: 'text', text: `--- file: ${att.name} ---\n${text}\n--- end file ---` }
    : { type: 'text', text: `[attached file: ${att.name} — binary format not supported]` };
}

/**
 * Builds the API content blocks for a message. Attachments are dropped when
 * the files tool is disabled, and the result is never empty — the API rejects
 * messages without content.
 */
export function toApiContent(m: ApiMessage, includeAttachments: boolean): ContentBlockParam[] {
  const blocks: ContentBlockParam[] = [];
  if (includeAttachments) {
    for (const att of m.attachments ?? []) blocks.push(attachmentToBlock(att));
  }
  if (m.text) blocks.push({ type: 'text', text: m.text });
  if (blocks.length === 0) blocks.push({ type: 'text', text: '(no content)' });
  return blocks;
}
