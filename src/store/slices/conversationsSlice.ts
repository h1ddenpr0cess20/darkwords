import type { Conversation } from '../../types';
import { makeId } from '../../lib/id';
import { clearDocIndex } from '../../lib/rag/retrieval';
import { conversationOrderForMode, emptyConversation, firstConversation, patchMessage, withConvo } from '../helpers';
import { endRunningParty, loadPartyForConversation } from './partySlice';
import { currentPersonaSnapshot, defaultPersonaSnapshot, loadPersonaForConversation } from './settingsSlice';
import type { AppState, SliceCreator } from '../types';

/**
 * The state patch that makes `convo`'s own settings take effect as it becomes
 * the active conversation: its saved party restored as a stopped, resumable
 * one when it has one (a party outranks a persona snapshot — the party
 * restore also hydrates the engine), otherwise its own prompt-mode/persona
 * settings, with any party left over from the previous conversation unloaded.
 * Apply only after `activeConvoId` already points at `convo`: hydrating the
 * engine publishes through `setStatus`, which snapshots the party config onto
 * whatever conversation is active at that moment.
 */
export function activateConversation(convo: Conversation | undefined): Partial<AppState> {
  return { ...loadPersonaForConversation(convo), ...loadPartyForConversation(convo) };
}

/**
 * Conversation lifecycle. Anything that changes the active conversation also
 * ends a running party, so party dialogue can't spill into another chat.
 */
export interface ConversationsSlice {
  conversations: Record<string, Conversation>;
  /** Conversation ids, newest first — the History panel's order. */
  conversationOrder: string[];
  activeConvoId: string;

  /**
   * Opens a fresh conversation; reuses the current one if it is still empty.
   * Closes any open drawer panel unless `keepPanel` is set — callers inside
   * the Settings drawer (persona picks) must not yank the drawer away
   * mid-interaction. `persona` chooses the new chat's voice: `current` carries
   * over the active persona (the default), `default` resets to the theme's
   * built-in persona.
   */
  newConversation: (opts?: { keepPanel?: boolean; persona?: 'current' | 'default' }) => void;
  selectConversation: (id: string) => void;
  /** Deletes a conversation and its RAG index, creating a fresh one if none remain. */
  deleteConversation: (id: string) => void;
  /** Expands/collapses a message's reasoning trace (view-only; doesn't re-sort History). */
  toggleThinking: (msgId: string) => void;
  /** Forks a new conversation containing everything up to and including `msgId`. */
  branchFrom: (msgId: string) => void;
  /** Swaps a regenerated message to one of its saved variants. */
  selectVariant: (msgId: string, index: number) => void;
}

export const createConversationsSlice: SliceCreator<ConversationsSlice> = (set, get) => ({
  conversations: { [firstConversation.id]: firstConversation },
  conversationOrder: [firstConversation.id],
  activeConvoId: firstConversation.id,

  newConversation: (opts) => {
    const party = endRunningParty(get());
    const persona = opts?.persona ?? 'current';
    set((s) => {
      const activePanel = opts?.keepPanel ? s.activePanel : null;
      /** `party`'s promptMode patch (if any) hasn't landed in `s` yet — it's still queued in this same update. */
      const snapshot = persona === 'default' ? defaultPersonaSnapshot() : currentPersonaSnapshot({ ...s, ...party });
      const current = s.conversations[s.activeConvoId];
      if (current && current.messages.length === 0) {
        return persona === 'default'
          ? {
              ...party,
              conversations: { ...s.conversations, [current.id]: { ...current, personaSnapshot: snapshot } },
              activePanel,
            }
          : { ...party, activePanel };
      }
      const c = { ...emptyConversation(), personaSnapshot: snapshot };
      return {
        ...party,
        conversations: { ...s.conversations, [c.id]: c },
        conversationOrder: [c.id, ...s.conversationOrder],
        activeConvoId: c.id,
        activePanel,
      };
    });
    const s = get();
    set(activateConversation(s.conversations[s.activeConvoId]));
  },

  selectConversation: (id) => {
    const party = endRunningParty(get());
    set({ ...party, activeConvoId: id, activePanel: null });
    set(activateConversation(get().conversations[id]));
  },

  deleteConversation: (id) => {
    clearDocIndex(id);
    const wasActive = get().activeConvoId === id;
    const party = wasActive ? endRunningParty(get()) : {};

    const s = get();
    const conversations = { ...s.conversations };
    delete conversations[id];
    let order = s.conversationOrder.filter((x) => x !== id);
    let inMode = conversationOrderForMode({ conversations, conversationOrder: order });
    if (inMode.length === 0) {
      const c = emptyConversation();
      conversations[c.id] = c;
      order = [c.id, ...order];
      inMode = [c.id];
    }
    const activeConvoId = wasActive ? inMode[0] : s.activeConvoId;

    set({ ...party, conversations, conversationOrder: order, activeConvoId });
    if (wasActive) set(activateConversation(get().conversations[activeConvoId]));
  },

  toggleThinking: (msgId) =>
    set((s) =>
      withConvo(s, s.activeConvoId, (c) => patchMessage(c, msgId, (m) => ({ thinkingOpen: !m.thinkingOpen }), false)),
    ),

  branchFrom: (msgId) => {
    const s = get();
    const source = s.conversations[s.activeConvoId];
    if (!source) return;
    const cut = source.messages.findIndex((m) => m.id === msgId);
    if (cut < 0) return;

    const branch: Conversation = {
      id: makeId('conv'),
      title: `${source.title} (branch)`.slice(0, 60),
      messages: source.messages.slice(0, cut + 1).map((m) => ({ ...m, id: makeId('m') })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      mode: source.mode,
      personaSnapshot: source.personaSnapshot ?? currentPersonaSnapshot(s),
    };

    set((st) => ({
      conversations: { ...st.conversations, [branch.id]: branch },
      conversationOrder: [branch.id, ...st.conversationOrder],
      activeConvoId: branch.id,
      activePanel: null,
    }));
  },

  selectVariant: (msgId, index) =>
    set((s) =>
      withConvo(s, s.activeConvoId, (c) =>
        patchMessage(
          c,
          msgId,
          (m) => {
            const variant = m.variants?.[index];
            if (!variant) return {};
            /**
             * Every optional field is written explicitly rather than spread:
             * the JSON persistence round-trip drops undefined-valued keys
             * from stored variants, and a bare spread would then leave the
             * previous variant's thinking/tools/imageGen/generatedFiles
             * showing under the swapped-in one.
             */
            return {
              rawText: variant.rawText,
              parts: variant.parts,
              thinking: variant.thinking,
              tools: variant.tools,
              imageGen: variant.imageGen,
              generatedFiles: variant.generatedFiles,
              variantIndex: index,
            };
          },
          false,
        ),
      ),
    ),
});
