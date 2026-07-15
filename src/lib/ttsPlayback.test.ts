import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TtsError } from './tts';
import { ttsPlayback, type SpeakOpts } from './ttsPlayback';
import type { StoredAudio } from './audioStorage';

vi.mock('./tts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./tts')>();
  return { ...actual, generateSpeech: vi.fn() };
});

vi.mock('./audioStorage', () => ({
  loadAudio: vi.fn(),
  saveAudio: vi.fn(),
  clearAudio: vi.fn(),
}));

const { generateSpeech } = await import('./tts');
const { loadAudio, saveAudio } = await import('./audioStorage');
const mockGenerate = vi.mocked(generateSpeech);
const mockLoad = vi.mocked(loadAudio);
const mockSave = vi.mocked(saveAudio);

const opts: SpeakOpts = { apiKey: 'k', text: 'hi', voice: 'ash' };

beforeAll(() => {
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:stub', revokeObjectURL: () => {} });
});

beforeEach(() => {
  mockLoad.mockResolvedValue(null);
  mockSave.mockResolvedValue(undefined);
});

afterEach(() => {
  mockGenerate.mockReset();
  mockLoad.mockReset();
  mockSave.mockReset();
  ttsPlayback.onError = null;
});

describe('ttsPlayback', () => {
  it('reports an idle state for an unknown message', () => {
    expect(ttsPlayback.getState('never-seen')).toEqual({ status: 'idle' });
  });

  it('notifies subscribers on state change and stops after unsubscribe', async () => {
    const id = 'sub-1';
    const listener = vi.fn();
    const unsubscribe = ttsPlayback.subscribe(id, listener);

    mockGenerate.mockRejectedValueOnce(new TtsError('boom'));
    await ttsPlayback.toggle(id, opts);

    expect(listener).toHaveBeenCalled();
    listener.mockClear();

    unsubscribe();
    mockGenerate.mockRejectedValueOnce(new TtsError('again'));
    await ttsPlayback.toggle(id, opts);
    expect(listener).not.toHaveBeenCalled();
  });

  it('records the error and calls onError when synthesis fails', async () => {
    const id = 'err-1';
    const onError = vi.fn();
    ttsPlayback.onError = onError;

    mockGenerate.mockRejectedValueOnce(new TtsError('bad key'));
    await ttsPlayback.toggle(id, opts);

    expect(ttsPlayback.getState(id)).toEqual({ status: 'idle', error: 'bad key' });
    expect(onError).toHaveBeenCalledWith('bad key');
  });

  it('does not start a second synthesis while one is already in flight', async () => {
    const id = 'queue-1';
    mockGenerate.mockReturnValue(new Promise(() => {}));

    ttsPlayback.enqueue(id, opts);
    ttsPlayback.enqueue(id, opts);
    await new Promise((r) => setTimeout(r, 0));

    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it('replays a stored clip from IndexedDB instead of re-synthesizing', async () => {
    const id = 'stored-1';
    const stored: StoredAudio = {
      id: `${id}_1`,
      messageId: id,
      voice: 'ash',
      text: 'hi',
      data: new ArrayBuffer(8),
      timestamp: 1,
    };
    mockLoad.mockResolvedValueOnce(stored);

    const data = await ttsPlayback.getAudioData(id, opts);

    expect(data).toBe(stored.data);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('synthesizes and persists when nothing is stored', async () => {
    const id = 'fresh-1';
    const bytes = new ArrayBuffer(16);
    mockLoad.mockResolvedValueOnce(null);
    mockGenerate.mockResolvedValueOnce(bytes);

    const data = await ttsPlayback.getAudioData(id, opts);

    expect(data).toBe(bytes);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith(id, 'ash', 'hi', bytes);
  });
});
