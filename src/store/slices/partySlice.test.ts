import { beforeEach, describe, expect, it } from 'vitest';
import type { Conversation } from '../../types';
import type { PartyConfig } from '../../lib/party/types';
import type { AppState } from '../types';
import { partyEngine } from '../../lib/party/engine';
import { endRunningParty, loadPartyForConversation } from './partySlice';

function convo(over: Partial<Conversation> = {}): Conversation {
  return { id: 'c1', title: 't', messages: [], createdAt: 1, updatedAt: 1, ...over };
}

function config(over: Partial<PartyConfig> = {}): PartyConfig {
  return {
    characters: [
      { id: 'a', name: 'Alice', persona: 'curious', color: '#fff', allowedTools: [] },
      { id: 'b', name: 'Bob', persona: 'gruff', color: '#000', allowedTools: [] },
    ],
    scenario: { topic: 'space', setting: 'a bar', mood: 'friendly', conversationType: 'conversation' },
    ...over,
  };
}

beforeEach(() => {
  partyEngine.reset();
});

describe('loadPartyForConversation', () => {
  it('is a no-op for a conversation with no saved party', () => {
    expect(loadPartyForConversation(undefined)).toEqual({});
    expect(loadPartyForConversation(convo())).toEqual({});
    expect(partyEngine.activeConfig()).toBeNull();
  });

  it('hydrates the engine as a stopped, resumable party and switches prompt mode', () => {
    const patch = loadPartyForConversation(convo({ partyConfig: config() }));
    expect(patch).toEqual({ promptMode: 'party' });
    expect(partyEngine.activeConfig()?.characters.map((c) => c.name)).toEqual(['Alice', 'Bob']);
    expect(partyEngine.isRunning()).toBe(false);
  });
});

describe('endRunningParty', () => {
  it('does nothing when no party is active', () => {
    expect(endRunningParty({ partyStatus: 'off' } as AppState)).toEqual({});
  });

  it('resets the engine and falls back to the personality prompt', () => {
    loadPartyForConversation(convo({ partyConfig: config() }));
    const patch = endRunningParty({ partyStatus: 'stopped' } as AppState);
    expect(patch).toEqual({ promptMode: 'personality' });
    expect(partyEngine.activeConfig()).toBeNull();
  });
});
