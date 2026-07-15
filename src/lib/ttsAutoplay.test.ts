import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppState } from '../store/types';
import type { ChatMessage } from '../types';
import { autoplayFinalizedMessage } from './ttsAutoplay';
import { ttsPlayback } from './ttsPlayback';

function assistant(over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1',
    role: 'assistant',
    displayName: 'Assistant',
    time: '',
    attachments: [],
    parts: [],
    rawText: 'Fine. Here is your answer.',
    ...over,
  };
}

/** A minimal state carrying only the fields the helper reads. */
function state(over: Partial<AppState> = {}): AppState {
  return {
    ttsEnabled: true,
    ttsAutoplay: true,
    ttsVoice: 'ash',
    ttsInstructions: '',
    imageApiKey: 'k',
    promptMode: 'none',
    personalityName: '',
    conversations: { c1: { id: 'c1', title: '', messages: [assistant()], createdAt: 1, updatedAt: 1 } },
    ...over,
  } as AppState;
}

afterEach(() => vi.restoreAllMocks());

describe('autoplayFinalizedMessage', () => {
  it('enqueues a speakable new reply when voice + autoplay are on', () => {
    const enqueue = vi.spyOn(ttsPlayback, 'enqueue').mockImplementation(() => {});
    autoplayFinalizedMessage(state(), 'c1', 'm1');
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0][0]).toBe('m1');
    expect(enqueue.mock.calls[0][1]).toMatchObject({ apiKey: 'k', voice: 'ash', text: 'Fine. Here is your answer.' });
  });

  it('does nothing when voice playback is disabled', () => {
    const enqueue = vi.spyOn(ttsPlayback, 'enqueue').mockImplementation(() => {});
    autoplayFinalizedMessage(state({ ttsEnabled: false }), 'c1', 'm1');
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('does nothing when autoplay is off (on-demand only)', () => {
    const enqueue = vi.spyOn(ttsPlayback, 'enqueue').mockImplementation(() => {});
    autoplayFinalizedMessage(state({ ttsAutoplay: false }), 'c1', 'm1');
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('does nothing when no OpenAI key is set', () => {
    const enqueue = vi.spyOn(ttsPlayback, 'enqueue').mockImplementation(() => {});
    autoplayFinalizedMessage(state({ imageApiKey: '' }), 'c1', 'm1');
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('skips a reply that is not worth speaking (code block)', () => {
    const enqueue = vi.spyOn(ttsPlayback, 'enqueue').mockImplementation(() => {});
    const s = state({
      conversations: {
        c1: { id: 'c1', title: '', messages: [assistant({ rawText: '```js\n1\n```' })], createdAt: 1, updatedAt: 1 },
      },
    });
    autoplayFinalizedMessage(s, 'c1', 'm1');
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('skips user messages and unknown ids', () => {
    const enqueue = vi.spyOn(ttsPlayback, 'enqueue').mockImplementation(() => {});
    autoplayFinalizedMessage(state({}), 'c1', 'missing');
    const userState = state({
      conversations: {
        c1: { id: 'c1', title: '', messages: [assistant({ role: 'user' })], createdAt: 1, updatedAt: 1 },
      },
    });
    autoplayFinalizedMessage(userState, 'c1', 'm1');
    expect(enqueue).not.toHaveBeenCalled();
  });
});
