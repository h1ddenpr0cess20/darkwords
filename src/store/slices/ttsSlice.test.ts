import { describe, expect, it } from 'vitest';
import { DEFAULT_TTS_VOICE } from '../../lib/tts';
import type { AppState } from '../types';
import { createTtsSlice, type TtsSlice } from './ttsSlice';

/**
 * Drives the slice creator with a minimal set/get harness — enough to exercise
 * the reducers without standing up the whole store. `set` supports both the
 * partial and updater-function forms Zustand allows.
 */
function makeSlice() {
  let state = {} as AppState;
  const set = (patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => {
    const next = typeof patch === 'function' ? patch(state) : patch;
    state = { ...state, ...next };
  };
  const get = () => state;
  const slice = createTtsSlice(set as never, get as never, {} as never) as TtsSlice;
  state = { ...state, ...slice };
  return { get: () => state as TtsSlice };
}

describe('createTtsSlice', () => {
  it('starts disabled, autoplaying, on the default voice, with no instructions', () => {
    const { get } = makeSlice();
    expect(get().ttsEnabled).toBe(false);
    expect(get().ttsAutoplay).toBe(true);
    expect(get().ttsVoice).toBe(DEFAULT_TTS_VOICE);
    expect(get().ttsInstructions).toBe('');
  });

  it('toggleTts and toggleTtsAutoplay flip their flags', () => {
    const { get } = makeSlice();
    get().toggleTts();
    expect(get().ttsEnabled).toBe(true);
    get().toggleTts();
    expect(get().ttsEnabled).toBe(false);

    get().toggleTtsAutoplay();
    expect(get().ttsAutoplay).toBe(false);
  });

  it('setTtsVoice and setTtsInstructions store their values', () => {
    const { get } = makeSlice();
    get().setTtsVoice('nova');
    expect(get().ttsVoice).toBe('nova');
    get().setTtsInstructions('be terse');
    expect(get().ttsInstructions).toBe('be terse');
  });
});
