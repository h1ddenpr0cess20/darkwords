/**
 * Party mode: an autonomous multi-character group chat. Several AI personas
 * converse on their own and the user can interject at any time without pausing
 * the loop. Every character shares the model selected in Settings → Model; only
 * the persona, name, label colour, and tool selection differ.
 *
 * Ported from Wordmark's party engine. Wordmark gave each character an optional
 * sampling temperature; Claude Opus 4.8 / Sonnet 5 reject `temperature`
 * outright, so that knob does not exist here — character voice comes from the
 * persona prompt alone.
 */

import type { ToolsEnabled } from '../../types';

/** A tool a character is allowed to reach for. Mirrors the global tool toggles. */
export type PartyToolKey = keyof ToolsEnabled;

/** A single AI persona participating in a party conversation. */
export interface PartyCharacter {
  id: string;
  /** Display name shown on the message label and used in the transcript. */
  name: string;
  /** Persona description injected as this character's system prompt. */
  persona: string;
  /** Accent colour for this character's name label. */
  color: string;
  /** Tools this character may use. Empty means the character runs tool-free. */
  allowedTools: PartyToolKey[];
}

/** A document the observer shared into the party, visible to every character. */
export interface PartyDocument {
  name: string;
  text: string;
}

/** The shared scenario framing the conversation. */
export interface PartyScenario {
  topic: string;
  setting: string;
  mood: string;
  /** Kind of exchange (e.g. "conversation", "debate"); interpolated into prompts. */
  conversationType: string;
}

/** Party configuration: the cast, the scenario, and what the cast calls the user. */
export interface PartyConfig {
  characters: PartyCharacter[];
  scenario: PartyScenario;
  /** What the characters call the user. Defaults to `DEFAULT_USER_NAME`. */
  userName?: string;
  documents?: PartyDocument[];
}

export type PartyStatus = 'off' | 'running' | 'paused' | 'stopped';

export const MOODS = ['friendly', 'serious', 'chaotic', 'thoughtful', 'playful', 'hostile'] as const;

export const CONVERSATION_TYPES = [
  'conversation',
  'debate',
  'argument',
  'meeting',
  'brainstorming',
  'lighthearted',
  'joking',
  'therapy',
] as const;

export function defaultScenario(): PartyScenario {
  return { topic: '', setting: '', mood: 'friendly', conversationType: 'conversation' };
}

export function defaultPartyConfig(): PartyConfig {
  return { characters: [], scenario: defaultScenario() };
}
