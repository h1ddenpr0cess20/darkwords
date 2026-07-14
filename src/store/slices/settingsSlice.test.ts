import { describe, expect, it } from 'vitest';
import type { Conversation } from '../../types';
import { currentPersonaSnapshot, loadPersonaForConversation } from './settingsSlice';

function convo(over: Partial<Conversation> = {}): Conversation {
  return { id: 'c1', title: 't', messages: [], createdAt: 1, updatedAt: 1, ...over };
}

const settings = {
  promptMode: 'personality' as const,
  personalityName: 'a grumpy pirate',
  customPrompt: 'be terse',
  verbose: true,
};

describe('currentPersonaSnapshot', () => {
  it('picks the four persona fields off the given state', () => {
    expect(currentPersonaSnapshot(settings)).toEqual(settings);
  });
});

describe('loadPersonaForConversation', () => {
  it('is a no-op for a conversation with no saved snapshot', () => {
    expect(loadPersonaForConversation(undefined)).toEqual({});
    expect(loadPersonaForConversation(convo())).toEqual({});
  });

  it('restores the saved prompt-mode/persona settings', () => {
    const patch = loadPersonaForConversation(convo({ personaSnapshot: settings }));
    expect(patch).toEqual(settings);
  });

  it('defers to a party when the conversation has one, even with a snapshot present', () => {
    const patch = loadPersonaForConversation(
      convo({
        personaSnapshot: settings,
        partyConfig: {
          characters: [
            { id: 'a', name: 'Alice', persona: 'curious', color: '#fff', allowedTools: [] },
            { id: 'b', name: 'Bob', persona: 'gruff', color: '#000', allowedTools: [] },
          ],
          scenario: { topic: '', setting: '', mood: 'friendly', conversationType: 'conversation' },
        },
      }),
    );
    expect(patch).toEqual({});
  });
});
