import type { Conversation } from '../../types';
import { makeId } from '../../lib/id';
import { clearDocIndex } from '../../lib/rag/retrieval';
import { emptyConversation, firstConversation, patchMessage, withConvo } from '../helpers';
import { endRunningParty, loadPartyForConversation } from './partySlice';
import { currentPersonaSnapshot, loadPersonaForConversation } from './settingsSlice';
import type { SliceCreator } from '../types';

/**
 * Conversation lifecycle. Anything that changes the active conversation also
 * ends a running party, so party dialogue can't spill into another chat.
 */
export interface ConversationsSlice {
  conversations: Record<string, Conversation>;
  /** Conversation ids, newest first — the History panel's order. */
  conversationOrder: string[];
  activeConvoId: string;

  /** Opens a fresh conversation; reuses the current one if it is still empty. */
  newConversation: () => void;
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

  newConversation: () => {
    const party = endRunningParty(get());
    set((s) => {
      const current = s.conversations[s.activeConvoId];
      if (current && current.messages.length === 0) {
        return { ...party, activePanel: null };
      }
      // party's promptMode patch (if any) hasn't landed in `s` yet — it's still queued in this same update.
      const c = { ...emptyConversation(), personaSnapshot: currentPersonaSnapshot({ ...s, ...party }) };
      return {
        ...party,
        conversations: { ...s.conversations, [c.id]: c },
        conversationOrder: [c.id, ...s.conversationOrder],
        activeConvoId: c.id,
        activePanel: null,
      };
    });
  },

  selectConversation: (id) => {
    const party = endRunningParty(get());
    const convo = get().conversations[id];
    const resumed = loadPartyForConversation(convo);
    const persona = loadPersonaForConversation(convo);
    set({ ...party, ...persona, ...resumed, activeConvoId: id, activePanel: null });
  },

  deleteConversation: (id) => {
    clearDocIndex(id);
    const wasActive = get().activeConvoId === id;
    const party = wasActive ? endRunningParty(get()) : {};

    const s = get();
    const conversations = { ...s.conversations };
    delete conversations[id];
    let order = s.conversationOrder.filter((x) => x !== id);
    if (order.length === 0) {
      const c = emptyConversation();
      conversations[c.id] = c;
      order = [c.id];
    }
    const activeConvoId = wasActive ? order[0] : s.activeConvoId;
    const targetConvo = wasActive ? conversations[activeConvoId] : undefined;
    const resumed = wasActive ? loadPartyForConversation(targetConvo) : {};
    const persona = wasActive ? loadPersonaForConversation(targetConvo) : {};

    set({ ...party, ...persona, ...resumed, conversations, conversationOrder: order, activeConvoId });
  },

  toggleThinking: (msgId) =>
    set((s) =>
      withConvo(s, s.activeConvoId, (c) =>
        patchMessage(c, msgId, (m) => ({ thinkingOpen: !m.thinkingOpen }), false),
      ),
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
            return { ...variant, variantIndex: index };
          },
          false,
        ),
      ),
    ),
});
