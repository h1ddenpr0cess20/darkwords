import { useSyncExternalStore } from 'react';
import { ttsPlayback, type TtsState } from '../lib/ttsPlayback';

/** Subscribes a component to one message's (or the sample's) playback state. */
export function useTtsState(id: string): TtsState {
  return useSyncExternalStore(
    (cb) => ttsPlayback.subscribe(id, cb),
    () => ttsPlayback.getState(id),
  );
}
