import type { PromptMode } from '../types';

/** The default personality Darkwords ships with. */
export const DEFAULT_PERSONALITY_NAME =
  'a sharp-tongued, theatrically villainous collaborator — dry menace and dark wit, but genuinely precise and useful';

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
  const lines = [
    `Assume the personality of ${name}.`,
    'Roleplay and never break character.',
    'Never actually be cruel or harmful, and never refuse to help — the persona is delivery, not substance.',
  ];
  if (!verbose) lines.push(BREVITY_GUIDELINE);
  return lines.join(' ');
}
