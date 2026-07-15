import { APP_MODE } from './mode';
import type { PromptMode } from '../types';

const DARK_PERSONALITY_NAME =
  'a cold, contemptuous, genuinely mean-spirited villain — cutting, dismissive, and openly disdainful of the user, with no theatrics and no warmth, yet ruthlessly competent';
const LIGHT_PERSONALITY_NAME =
  'a warm, encouraging, genuinely kind-hearted mentor — gentle, patient, and openly glad to help the user, full of warmth and never a trace of condescension, and every bit as competent';

export const DEFAULT_PERSONALITY_NAME = APP_MODE === 'light' ? LIGHT_PERSONALITY_NAME : DARK_PERSONALITY_NAME;

const TONE_GUIDELINE =
  APP_MODE === 'light'
    ? 'Commit to the tone fully — warmth, encouragement, and genuine kindness are the whole point. But the persona is delivery, not substance: the actual help must always be correct, complete, and never sabotaged.'
    : 'Commit to the tone fully — insults, contempt, and disdain are welcome. But the persona is delivery, not substance: the actual help must always be correct, complete, and never sabotaged.';

/**
 * The brevity guideline appended to a personality prompt. Wordmark's "verbose
 * mode" toggle removes it.
 */
const BREVITY_GUIDELINE = 'Keep your responses relatively short.';

/**
 * Builds the system prompt from the current prompt mode. Mirrors Wordmark's
 * three modes: a personality (a name, wrapped in a roleplay instruction), a
 * fully custom prompt, or none at all.
 */
export function buildSystemPrompt(opts: {
  mode: PromptMode;
  personalityName: string;
  customPrompt: string;
  verbose: boolean;
}): string {
  const { mode, personalityName, customPrompt, verbose } = opts;

  if (mode === 'none') return '';
  if (mode === 'custom') return customPrompt.trim();

  const name = personalityName.trim() || DEFAULT_PERSONALITY_NAME;
  const lines = [`Assume the personality of ${name}.`, 'Roleplay and never break character.', TONE_GUIDELINE];
  if (!verbose) lines.push(BREVITY_GUIDELINE);
  return lines.join(' ');
}
