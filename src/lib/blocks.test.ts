import { describe, expect, it } from 'vitest';
import { parseBlocks, partsToPlainText } from './blocks';

describe('parseBlocks', () => {
  it('joins consecutive lines into one paragraph and splits on blank lines', () => {
    expect(parseBlocks('line one\nline two\n\nsecond para')).toEqual([
      { type: 'para', text: 'line one line two' },
      { type: 'para', text: 'second para' },
    ]);
  });

  it('parses # headings and bold-only lines as headings', () => {
    expect(parseBlocks('## Title\n**Also a title**')).toEqual([
      { type: 'heading', text: 'Title' },
      { type: 'heading', text: 'Also a title' },
    ]);
  });

  it('parses dashed, starred, and numbered list items into one list', () => {
    expect(parseBlocks('- a\n* b\n2. c')).toEqual([{ type: 'list', items: ['a', 'b', 'c'] }]);
  });

  it('keeps code fences verbatim, without inline cleaning', () => {
    expect(parseBlocks('```\nconst x = **not bold**;\n```')).toEqual([
      { type: 'code', text: 'const x = **not bold**;' },
    ]);
  });

  it('captures an unclosed code fence to the end of input', () => {
    expect(parseBlocks('```\nabc\ndef')).toEqual([{ type: 'code', text: 'abc\ndef' }]);
  });

  it('strips inline bold, italic, and code markers from prose', () => {
    expect(parseBlocks('has **bold** and *italic* and `code`')).toEqual([
      { type: 'para', text: 'has bold and italic and code' },
    ]);
  });

  it('normalizes CRLF input', () => {
    expect(parseBlocks('a\r\n\r\nb')).toEqual([
      { type: 'para', text: 'a' },
      { type: 'para', text: 'b' },
    ]);
  });

  it('returns nothing for whitespace-only input', () => {
    expect(parseBlocks('  \n\n  ')).toEqual([]);
  });
});

describe('partsToPlainText', () => {
  it('serializes every block type', () => {
    expect(
      partsToPlainText([
        { type: 'heading', text: 'H' },
        { type: 'para', text: 'p' },
        { type: 'list', items: ['a', 'b'] },
        { type: 'code', text: 'x = 1' },
      ]),
    ).toBe('H\n\np\n\n- a\n- b\n\n```\nx = 1\n```');
  });
});
