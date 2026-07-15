import { DEFAULT_TTS_VOICE } from '../../lib/tts';
import type { SliceCreator } from '../types';

/**
 * Voice-playback settings (Settings → Voice). All durable and persisted;
 * playback runtime lives in the module-level controller (see
 * `lib/ttsPlayback.ts`), not the store.
 */
export interface TtsSlice {
  /** Master switch — when off, no per-message voice controls are shown. */
  ttsEnabled: boolean;
  /** Speak each finished assistant reply automatically. */
  ttsAutoplay: boolean;
  ttsVoice: string;
  /** Optional voice-direction override; blank derives it from the persona. */
  ttsInstructions: string;

  toggleTts: () => void;
  toggleTtsAutoplay: () => void;
  setTtsVoice: (voice: string) => void;
  setTtsInstructions: (text: string) => void;
}

export const createTtsSlice: SliceCreator<TtsSlice> = (set) => ({
  ttsEnabled: false,
  ttsAutoplay: true,
  ttsVoice: DEFAULT_TTS_VOICE,
  ttsInstructions: '',

  toggleTts: () => set((s) => ({ ttsEnabled: !s.ttsEnabled })),
  toggleTtsAutoplay: () => set((s) => ({ ttsAutoplay: !s.ttsAutoplay })),
  setTtsVoice: (voice) => set({ ttsVoice: voice }),
  setTtsInstructions: (text) => set({ ttsInstructions: text }),
});
