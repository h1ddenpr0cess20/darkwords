/**
 * Text-to-speech via OpenAI's Speech API (gpt-4o-mini-tts).
 *
 * Anthropic has no speech endpoint, so voice playback is a client-side feature:
 * finished assistant text is sent straight to OpenAI and the returned audio is
 * played in the browser. It reuses the same OpenAI key as image generation
 * (`imageApiKey`), so no chat provider — Anthropic or LM Studio — is required
 * for it to work.
 */

import type { PromptMode } from '../types';

const OPENAI_SPEECH_URL = 'https://api.openai.com/v1/audio/speech';

/** The OpenAI speech model used for synthesis. */
export const TTS_MODEL = 'gpt-4o-mini-tts';

export interface TtsVoice {
  id: string;
  name: string;
  gender: 'Neutral' | 'Male' | 'Female';
}

/** The gpt-4o-mini-tts voice catalog, grouped like the settings selector. */
export const TTS_VOICES: TtsVoice[] = [
  { id: 'alloy', name: 'Alloy', gender: 'Neutral' },
  { id: 'ash', name: 'Ash', gender: 'Male' },
  { id: 'ballad', name: 'Ballad', gender: 'Male' },
  { id: 'cedar', name: 'Cedar', gender: 'Male' },
  { id: 'coral', name: 'Coral', gender: 'Female' },
  { id: 'echo', name: 'Echo', gender: 'Male' },
  { id: 'fable', name: 'Fable', gender: 'Male' },
  { id: 'marin', name: 'Marin', gender: 'Female' },
  { id: 'nova', name: 'Nova', gender: 'Female' },
  { id: 'onyx', name: 'Onyx', gender: 'Male' },
  { id: 'sage', name: 'Sage', gender: 'Female' },
  { id: 'shimmer', name: 'Shimmer', gender: 'Female' },
  { id: 'verse', name: 'Verse', gender: 'Male' },
];

/** The voice selected when none has been chosen yet. */
export const DEFAULT_TTS_VOICE = 'onyx';

/** The phrase spoken by the "Test voice" control in Settings → Voice. */
export const TTS_TEST_PHRASE = 'This is a test of the text-to-speech feature. How does this voice sound?';

/**
 * Whether text is worth speaking on autoplay. Empty bodies and messages with
 * fenced code blocks read poorly aloud and are skipped — matching Wordmark,
 * which still lets the user voice them by hand from the play button.
 */
export function isSpeakable(text: string): boolean {
  const trimmed = text.trim();
  return trimmed !== '' && !trimmed.includes('```');
}

interface OpenAISpeechError {
  error?: { message?: string };
}

/** Thrown for any synthesis failure worth surfacing to the user. */
export class TtsError extends Error {}

/**
 * Resolves the voice-direction `instructions` sent alongside the text, in order
 * of preference: an explicit user override; otherwise a personality-derived
 * instruction when a personality prompt is active (with a directive to skip
 * code blocks and `*emote*` text, which read poorly aloud); otherwise a generic
 * conversational tone. Mirrors Wordmark's resolution order.
 */
export function buildTtsInstructions(opts: {
  instructions: string;
  promptMode: PromptMode;
  personalityName: string;
}): string {
  const explicit = opts.instructions.trim();
  if (explicit) return explicit;

  const name = opts.personalityName.trim();
  if (opts.promptMode === 'personality' && name) {
    return (
      `Assume the personality of ${name}. Roleplay and never break character. ` +
      'Do not read code blocks that appear between backticks or other non-speech ' +
      'content such as emotes which appear between asterisks in *italics* like that.'
    );
  }

  return 'Speak in a natural, conversational tone.';
}

/**
 * Synthesizes speech for `text`, returning WAV audio bytes.
 *
 * @throws {TtsError} When no key is set, the endpoint is unreachable, or the
 * request fails — with a message suitable for showing to the user.
 */
export async function generateSpeech(opts: {
  apiKey: string;
  text: string;
  voice: string;
  instructions?: string;
  signal?: AbortSignal;
}): Promise<ArrayBuffer> {
  const { apiKey, text, voice, instructions, signal } = opts;

  if (!apiKey) {
    throw new TtsError('No OpenAI API key is set. Add one in Settings → Keys to enable voice playback.');
  }

  let res: Response;
  try {
    res = await fetch(OPENAI_SPEECH_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        input: text,
        voice,
        instructions: instructions || 'Speak in a natural, conversational tone.',
        response_format: 'wav',
      }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new TtsError(`Could not reach the speech API: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status} - ${res.statusText}`;
    try {
      const body = (await res.json()) as OpenAISpeechError;
      detail = body.error?.message ?? detail;
    } catch {}
    throw new TtsError(`Speech synthesis failed: ${detail}`);
  }

  return res.arrayBuffer();
}
