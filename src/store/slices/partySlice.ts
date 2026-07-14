import { makeId } from '../../lib/id';
import { partyEngine } from '../../lib/party/engine';
import {
  defaultPartyConfig,
  type PartyCharacter,
  type PartyConfig,
  type PartyScenario,
  type PartyStatus,
  type PartyToolKey,
} from '../../lib/party/types';
import { emptyConversation } from '../helpers';
import type { AppState, SliceCreator } from '../types';

/**
 * Party-mode UI state and controls. `partyDraft` is the form being edited;
 * `partyStatus`/`activeParty` mirror the engine, which pushes them into the
 * store via its host.
 */
export interface PartySlice {
  partyDraft: PartyConfig;
  partyStatus: PartyStatus;
  activeParty: PartyConfig | null;

  setPartyUserName: (name: string) => void;
  setPartyScenario: (patch: Partial<PartyScenario>) => void;
  addPartyCharacter: () => void;
  updatePartyCharacter: (id: string, patch: Partial<PartyCharacter>) => void;
  removePartyCharacter: (id: string) => void;
  togglePartyCharacterTool: (id: string, tool: PartyToolKey) => void;
  /**
   * Starts the draft party in a fresh conversation titled after the topic or
   * cast. Characters with neither a name nor a persona are dropped; at least
   * two must remain.
   */
  startParty: () => void;
  pauseParty: () => void;
  /** Resumes a paused party, or restarts a stopped one with its previous config. */
  resumeParty: () => void;
  stopParty: () => void;
  /** Exits party mode entirely, clearing the engine's config. */
  leaveParty: () => void;
}

/** Label colours handed out to new party characters, in order. */
const CHARACTER_COLORS = ['#7EE787', '#E8B54D', '#8FB9FF', '#E88484', '#C99BFF', '#5FD9C4'];

/**
 * Tears down a running party and returns the state patch that goes with it.
 *
 * The engine writes each line into whatever conversation is active at the moment
 * it writes, so a party only holds together while its own conversation stays
 * open. Anything that changes the active conversation ends the party instead of
 * letting its dialogue spill into an unrelated chat.
 */
export function endRunningParty(s: AppState): Partial<AppState> {
  if (s.partyStatus === 'off') return {};
  partyEngine.reset();
  return { promptMode: 'personality' };
}

export const createPartySlice: SliceCreator<PartySlice> = (set, get) => ({
  partyDraft: defaultPartyConfig(),
  partyStatus: 'off',
  activeParty: null,

  setPartyUserName: (name) => set((s) => ({ partyDraft: { ...s.partyDraft, userName: name } })),
  setPartyScenario: (patch) =>
    set((s) => ({ partyDraft: { ...s.partyDraft, scenario: { ...s.partyDraft.scenario, ...patch } } })),

  addPartyCharacter: () =>
    set((s) => {
      const character: PartyCharacter = {
        id: makeId('pc'),
        name: '',
        persona: '',
        color: CHARACTER_COLORS[s.partyDraft.characters.length % CHARACTER_COLORS.length],
        allowedTools: [],
      };
      return { partyDraft: { ...s.partyDraft, characters: [...s.partyDraft.characters, character] } };
    }),

  updatePartyCharacter: (id, patch) =>
    set((s) => ({
      partyDraft: {
        ...s.partyDraft,
        characters: s.partyDraft.characters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      },
    })),

  removePartyCharacter: (id) =>
    set((s) => ({
      partyDraft: { ...s.partyDraft, characters: s.partyDraft.characters.filter((c) => c.id !== id) },
    })),

  togglePartyCharacterTool: (id, tool) =>
    set((s) => ({
      partyDraft: {
        ...s.partyDraft,
        characters: s.partyDraft.characters.map((c) =>
          c.id === id
            ? {
                ...c,
                allowedTools: c.allowedTools.includes(tool)
                  ? c.allowedTools.filter((t) => t !== tool)
                  : [...c.allowedTools, tool],
              }
            : c,
        ),
      },
    })),

  startParty: () => {
    const s = get();
    const draft = s.partyDraft;
    const cast = draft.characters.filter((c) => c.name.trim() || c.persona.trim());
    if (cast.length < 2) return;

    const convo = emptyConversation();
    const scenario = draft.scenario;
    convo.title = scenario.topic.trim()
      ? `Party: ${scenario.topic.trim().slice(0, 48)}`
      : `Party: ${cast.map((c) => c.name || 'Unnamed').join(', ').slice(0, 48)}`;

    set((st) => ({
      conversations: { ...st.conversations, [convo.id]: convo },
      conversationOrder: [convo.id, ...st.conversationOrder],
      activeConvoId: convo.id,
      activePanel: null,
      promptMode: 'party',
    }));

    void partyEngine.start({
      ...draft,
      characters: cast.map((c) => ({ ...c, name: c.name.trim() || c.persona.trim().slice(0, 24) })),
    });
  },

  pauseParty: () => partyEngine.pause(),
  resumeParty: () => {
    if (partyEngine.isRunning()) {
      partyEngine.resume();
      return;
    }
    const config = partyEngine.activeConfig();
    if (config) void partyEngine.start(config);
  },
  stopParty: () => partyEngine.stop(),
  leaveParty: () => {
    partyEngine.reset();
    set({ promptMode: 'personality' });
  },
});
