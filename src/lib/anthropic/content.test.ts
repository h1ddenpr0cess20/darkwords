import { describe, expect, it } from 'vitest';
import type { Attachment } from '../../types';
import { toApiContent } from './content';

function att(name: string, mimeType: string, bytes: Uint8Array): Attachment {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return { id: 'att_1', name, mimeType, size: bytes.length, dataUrl: `data:${mimeType};base64,${btoa(bin)}` };
}

describe('toApiContent', () => {
  it('decodes UTF-8 text attachments without mojibake', () => {
    const text = 'café — 日本語';
    const blocks = toApiContent(
      { role: 'user', text: '', attachments: [att('notes.txt', 'text/plain', new TextEncoder().encode(text))] },
      true,
    );
    expect(blocks).toEqual([{ type: 'text', text: `--- file: notes.txt ---\n${text}\n--- end file ---` }]);
  });

  it('keeps Latin-1 text attachments readable as a fallback', () => {
    // 0xE9 = é in Latin-1, invalid as a lone UTF-8 byte.
    const blocks = toApiContent(
      {
        role: 'user',
        text: '',
        attachments: [att('legacy.txt', 'text/plain', new Uint8Array([0x63, 0x61, 0x66, 0xe9]))],
      },
      true,
    );
    expect(blocks).toEqual([{ type: 'text', text: '--- file: legacy.txt ---\ncafé\n--- end file ---' }]);
  });

  it('sends supported image formats as native image blocks', () => {
    const blocks = toApiContent(
      { role: 'user', text: '', attachments: [att('pic.png', 'image/png', new Uint8Array([1, 2, 3]))] },
      true,
    );
    expect(blocks[0]).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/png' } });
  });

  it('degrades unsupported image formats instead of sending an invalid image block', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
    const blocks = toApiContent(
      { role: 'user', text: '', attachments: [att('logo.svg', 'image/svg+xml', new TextEncoder().encode(svg))] },
      true,
    );
    expect(blocks).toEqual([{ type: 'text', text: `--- file: logo.svg ---\n${svg}\n--- end file ---` }]);

    const binary = toApiContent(
      { role: 'user', text: '', attachments: [att('pic.bmp', 'image/bmp', new Uint8Array([0x42, 0x4d, 0x00, 0x01]))] },
      true,
    );
    expect(binary).toEqual([{ type: 'text', text: '[attached file: pic.bmp — binary format not supported]' }]);
  });
});
