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
import { emptyConversation, withConvo } from '../helpers';
import type { Conversation } from '../../types';
import type { AppState, SliceCreator } from '../types';

/**
 * Party-mode UI state and controls. `partyDraft` is the form being edited;
 * `partyStatus`/`activeParty` mirror the engine, which pushes them into the
 * store via its host. `partySoloMode` only matters while stopped — see
 * {@link partyOwnsInput}.
 */
export interface PartySlice {
  partyDraft: PartyConfig;
  partyStatus: PartyStatus;
  activeParty: PartyConfig | null;
  /**
   * While a party is stopped, lets the user carry the conversation on as an
   * ordinary one-on-one chat instead of every message resuming the party.
   * Reset to `false` whenever the party leaves the stopped state (see
   * `setStatus` in partyHost.ts) — solo chatting is a per-visit choice, not a
   * durable setting.
   */
  partySoloMode: boolean;

  setPartyUserName: (name: string) => void;
  setPartyScenario: (patch: Partial<PartyScenario>) => void;
  /** Appends a blank character, or a filled-in one when a preset is passed. */
  addPartyCharacter: (preset?: { name: string; persona: string }) => void;
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
  /** Exits party mode entirely, clearing the engine's config and its saved conversation. */
  leaveParty: () => void;
  /** Flips solo mode; only takes effect while the party is stopped (see {@link partyOwnsInput}). */
  togglePartySoloMode: () => void;
}

/** Label colours handed out to new party characters, in order. */
const CHARACTER_COLORS = ['#7EE787', '#E8B54D', '#8FB9FF', '#E88484', '#C99BFF', '#5FD9C4'];

/**
 * Stops a running party and returns the state patch that goes with it.
 *
 * The engine writes each line into whatever conversation is active at the
 * moment it writes, so a party only holds together while its own conversation
 * stays open. Anything that changes the active conversation stops the party
 * instead of letting its dialogue spill into an unrelated chat — its cast and
 * scenario stay saved on that conversation (see `setStatus` in partyHost.ts),
 * so switching back to it, or reloading the page, can resume it.
 */
export function endRunningParty(s: AppState): Partial<AppState> {
  if (s.partyStatus === 'off') return {};
  partyEngine.reset();
  return { promptMode: 'personality' };
}

/**
 * Restores a conversation's saved party as a stopped, resumable one — used
 * when that conversation becomes active, whether by switching to it or by
 * reloading the page. A no-op when it never held a party.
 */
export function loadPartyForConversation(convo: Conversation | undefined): Partial<AppState> {
  if (!convo?.partyConfig) return {};
  partyEngine.hydrate(convo.partyConfig);
  return { promptMode: 'party' };
}

/**
 * Whether a message typed right now should be handed to the party engine as
 * an interjection (true) or sent as an ordinary solo turn (false). A live
 * party — running or paused — always owns the input, since its loop is
 * already driving the conversation. A stopped one only owns it while solo
 * mode is off; flipping that on lets the user carry the same conversation on
 * normally; the transcript is shared either way, so if the party resumes
 * later it picks up whatever was said in between as part of its own history.
 */
export function partyOwnsInput(s: Pick<AppState, 'activeParty' | 'partyStatus' | 'partySoloMode'>): boolean {
  return Boolean(s.activeParty) && !(s.partyStatus === 'stopped' && s.partySoloMode);
}

export const createPartySlice: SliceCreator<PartySlice> = (set, get) => ({
  partyDraft: defaultPartyConfig(),
  partyStatus: 'off',
  activeParty: null,
  partySoloMode: false,

  setPartyUserName: (name) => set((s) => ({ partyDraft: { ...s.partyDraft, userName: name } })),
  setPartyScenario: (patch) =>
    set((s) => ({ partyDraft: { ...s.partyDraft, scenario: { ...s.partyDraft.scenario, ...patch } } })),

  addPartyCharacter: (preset) =>
    set((s) => {
      const character: PartyCharacter = {
        id: makeId('pc'),
        name: preset?.name ?? '',
        persona: preset?.persona ?? '',
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
  /**
   * Unlike stop/pause, leaving is a deliberate abandonment: it also drops the
   * saved config from the conversation, so it won't come back as a resumable
   * party on the next visit or reload.
   */
  leaveParty: () => {
    const cid = get().activeConvoId;
    partyEngine.reset();
    set((s) => ({ promptMode: 'personality', ...withConvo(s, cid, (c) => ({ ...c, partyConfig: undefined })) }));
  },
  togglePartySoloMode: () => set((s) => ({ partySoloMode: !s.partySoloMode })),
});
