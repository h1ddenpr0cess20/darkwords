/**
 * Autoplay bridge between a just-finished assistant turn and voice playback.
 *
 * @remarks
 * Called from the finalize path of a turn (solo chat, regenerate, and party) —
 * the moment a reply stops streaming — mirroring Wordmark's
 * `generateTtsForMessage`. It is deliberately *not* driven from component mount:
 * enabling voice playback must not re-synthesize every message already on
 * screen (that would spend tokens on old replies). Existing messages get only
 * on-demand controls; autoplay speaks new replies as they land.
 */

import type { AppState } from '../store/types';
import { buildTtsInstructions, isSpeakable } from './tts';
import { ttsPlayback } from './ttsPlayback';

/**
 * Enqueues a freshly finalized assistant message for autoplay when voice
 * playback and autoplay are both on, an OpenAI key is set, and the text is
 * worth speaking. A no-op otherwise.
 */
export function autoplayFinalizedMessage(s: AppState, cid: string, msgId: string): void {
  if (!s.ttsEnabled || !s.ttsAutoplay || !s.imageApiKey) return;

  const msg = s.conversations[cid]?.messages.find((m) => m.id === msgId);
  if (msg?.role !== 'assistant' || !isSpeakable(msg.rawText)) return;

  ttsPlayback.enqueue(msgId, {
    apiKey: s.imageApiKey,
    text: msg.rawText,
    voice: s.ttsVoice,
    instructions: buildTtsInstructions({
      instructions: s.ttsInstructions,
      promptMode: s.promptMode,
      personalityName: s.personalityName,
    }),
  });
}
