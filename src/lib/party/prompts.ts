/**
 * Prompt templates for party mode — the per-character system prompt, the first-
 * and subsequent-turn user prompts (embedding a rolling transcript window), and
 * the speaker-decision prompt used when three or more characters are present.
 *
 * Ported from Wordmark's `partyPrompts.ts`.
 */

import type { PartyCharacter, PartyDocument, PartyScenario } from './types';

/** Fallback display name for the user when none is configured. */
export const DEFAULT_USER_NAME = 'Observer';

/** How many transcript lines are replayed into each turn's prompt. */
const TRANSCRIPT_WINDOW = 6;

/** A tool a character can call, described to the model in its system prompt. */
export interface PartyToolInfo {
  key: string;
  displayName: string;
  description?: string;
}

/**
 * Builds the system prompt that puts the model fully in character. When no
 * persona is given, the character's name is used as the persona. Party turns
 * don't carry the main chat's tool instructions, so a tool-awareness block is
 * appended when the character has tools.
 */
export function buildCharacterSystemPrompt(character: PartyCharacter, tools: PartyToolInfo[] = []): string {
  const lines = [
    `Assume the personality of ${character.persona || character.name}.`,
    'Roleplay as them and never break character.',
    'Do not speak as anyone else.',
    'Keep responses concise (one to three sentences).',
    'Do not prefix responses with your name.',
  ];

  if (tools.length) {
    const list = tools
      .map((tool) => (tool.description ? `${tool.displayName} — ${tool.description}` : tool.displayName))
      .join('; ');
    lines.push(
      `You have access to these tools: ${list}.`,
    );
    if (tools.some((tool) => tool.key === 'web')) {
      lines.push(
        'When the conversation touches on current events, facts, or anything you are unsure about, search the web before answering.',
      );
    }
  }

  return lines.join(' ');
}

/**
 * Appends the observer's shared documents to a character's system prompt.
 * Returns the prompt unchanged when there are no documents.
 */
export function appendPartyDocumentContext(systemPrompt: string, documents: PartyDocument[]): string {
  if (!documents.length) return systemPrompt;
  const blocks = documents.map((doc) => `--- ${doc.name} ---\n${doc.text}`).join('\n\n');
  return `${systemPrompt}\n\nThe observer has shared the following document(s) for everyone in this conversation. Draw on them when they are relevant:\n\n${blocks}`;
}

/**
 * Returns the participant a message addresses, when it names exactly one (other
 * than `excludeName`). Used to hand the next turn to whoever was called on by
 * name. Returns null when nobody, or more than one participant, is named — that
 * address is ambiguous.
 */
export function findAddressedParticipant(
  text: string,
  participantNames: string[],
  excludeName?: string,
): string | null {
  const lower = text.toLowerCase();
  const excluded = excludeName?.trim().toLowerCase();
  const matches = participantNames.filter((name) => {
    const candidate = name.trim().toLowerCase();
    if (!candidate || candidate === excluded) return false;
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`).test(lower);
  });
  return matches.length === 1 ? matches[0] : null;
}

/** Builds the opening-turn prompt for the first speaker. */
export function buildFirstTurnPrompt(
  speaker: PartyCharacter,
  characters: PartyCharacter[],
  scenario: PartyScenario,
): string {
  const others = characters
    .filter((c) => c.id !== speaker.id)
    .map((c) => c.name)
    .join(', ');
  return `Start a ${scenario.conversationType} about ${scenario.topic || 'anything'} with ${others}. The setting is ${scenario.setting || 'anywhere'}. The mood is ${scenario.mood}. Begin naturally.`;
}

/**
 * Builds a subsequent-turn prompt embedding the recent transcript. When the most
 * recent entry is a user interjection, the speaker is told to address the user
 * directly first.
 */
export function buildTurnPrompt(scenario: PartyScenario, history: string[], userName: string): string {
  const recentHistory = history.slice(-TRANSCRIPT_WINDOW).join('\n');
  const latestEntry = history[history.length - 1] ?? '';
  const userInterjected = latestEntry.startsWith(`${userName}:`);
  const historySection = recentHistory ? `Here are the latest messages:\n\n${recentHistory}\n\n` : '';
  const followUpInstruction = [
    'Stay focused on the topic and respond in character.',
    userInterjected
      ? `The latest message is from ${userName}—address them directly using the name "${userName}" and answer their message before continuing the broader discussion.`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  return `You're the next speaker in a ${scenario.conversationType} about ${scenario.topic || 'anything'}. The setting is ${scenario.setting || 'anywhere'}. The mood is ${scenario.mood}. ${historySection}${followUpInstruction}`;
}

/** Builds the decision prompt asking the model to pick the next speaker. */
export function buildDecisionPrompt(
  scenario: PartyScenario,
  characters: PartyCharacter[],
  history: string[],
): string {
  return `Based on this ${scenario.conversationType} history, reply with the name of the most likely next speaker (matching the participant name exactly) followed by a pipe and your reasoning. Format: <name>|<reason>. If the most recent message directly addresses a participant by name (for example asking them a question), that participant should usually speak next. Otherwise avoid round-robin patterns.\n\nParticipants: ${characters
    .map((c) => c.name)
    .join(', ')}\n\nHistory:\n${history.join('\n')}`;
}
