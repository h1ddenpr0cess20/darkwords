import { describe, expect, it } from 'vitest';
import type { ChatMessage, Conversation } from '../types';
import type { AppState } from './types';
import { messageText, patchMessage, resolveTool, upsertTool, withConvo } from './helpers';

function msg(over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1',
    role: 'assistant',
    displayName: 'AI',
    time: '1:00 PM',
    attachments: [],
    rawText: '',
    parts: [],
    ...over,
  };
}

function convo(messages: ChatMessage[]): Conversation {
  return { id: 'c1', title: 't', messages, createdAt: 1, updatedAt: 1 };
}

describe('withConvo', () => {
  it('rewrites the target conversation immutably', () => {
    const state = { conversations: { c1: convo([]) } } as unknown as AppState;
    const patch = withConvo(state, 'c1', (c) => ({ ...c, title: 'renamed' }));
    expect(patch.conversations.c1.title).toBe('renamed');
    expect(state.conversations.c1.title).toBe('t');
  });

  it('is a no-op when the conversation was deleted mid-stream', () => {
    const state = { conversations: {} } as unknown as AppState;
    const patch = withConvo(state, 'gone', (c) => ({ ...c, title: 'x' }));
    expect(patch.conversations).toBe(state.conversations);
  });
});

describe('patchMessage', () => {
  it('applies partial and functional patches to the matching message only', () => {
    const c = convo([msg(), msg({ id: 'm2', rawText: 'keep' })]);
    const withPartial = patchMessage(c, 'm1', { rawText: 'new' });
    expect(withPartial.messages[0].rawText).toBe('new');
    expect(withPartial.messages[1].rawText).toBe('keep');

    const withFn = patchMessage(c, 'm2', (m) => ({ rawText: m.rawText + '!' }));
    expect(withFn.messages[1].rawText).toBe('keep!');
  });

  it('leaves updatedAt alone for view-only patches', () => {
    const c = convo([msg()]);
    expect(patchMessage(c, 'm1', { thinkingOpen: true }, false).updatedAt).toBe(1);
    expect(patchMessage(c, 'm1', { rawText: 'x' }).updatedAt).toBeGreaterThan(1);
  });
});

describe('messageText', () => {
  it('prefers rawText and rebuilds from parts otherwise', () => {
    expect(messageText(msg({ rawText: 'raw' }))).toBe('raw');
    expect(messageText(msg({ parts: [{ type: 'para', text: 'from parts' }] }))).toBe('from parts');
  });
});

describe('upsertTool', () => {
  it('appends a new call and updates a repeated id in place', () => {
    const first = upsertTool(msg(), { id: 't1', name: 'search', input: '{}' });
    expect(first.tools).toHaveLength(1);

    const updated = upsertTool(msg({ tools: first.tools }), { id: 't1', name: 'search', input: '{"q":1}' });
    expect(updated.tools).toHaveLength(1);
    expect(updated.tools![0].input).toBe('{"q":1}');
  });
});

describe('resolveTool', () => {
  it('attaches the result to the matching call id', () => {
    const m = msg({ tools: [{ id: 't1', name: 'a', input: '{}' }] });
    const patch = resolveTool(m, { id: 't1', output: 'done' });
    expect(patch.tools![0].output).toBe('done');
  });

  it('falls back to the latest unresolved call when the id is unknown', () => {
    const m = msg({
      tools: [
        { id: 't1', name: 'a', input: '{}', output: 'earlier' },
        { id: 't2', name: 'b', input: '{}' },
      ],
    });
    const patch = resolveTool(m, { id: 'mystery', output: 'late', isError: true });
    expect(patch.tools![1]).toMatchObject({ id: 't2', output: 'late', isError: true });
    expect(patch.tools![0].output).toBe('earlier');
  });

  it('returns an empty patch when there are no calls to resolve', () => {
    expect(resolveTool(msg(), { id: 'x', output: 'y' })).toEqual({});
  });
});
