import type { Conversation } from '../../types';
import { makeId } from '../../lib/id';
import { clearDocIndex } from '../../lib/rag/retrieval';
import { emptyConversation, firstConversation, patchMessage, withConvo } from '../helpers';
import { endRunningParty } from './partySlice';
import type { SliceCreator } from '../types';

export interface ConversationsSlice {
  conversations: Record<string, Conversation>;
  conversationOrder: string[];
  activeConvoId: string;

  newConversation: () => void;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  toggleThinking: (msgId: string) => void;
  branchFrom: (msgId: string) => void;
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
      const c = emptyConversation();
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
    set({ ...party, activeConvoId: id, activePanel: null });
  },

  deleteConversation: (id) => {
    clearDocIndex(id);
    const party = get().activeConvoId === id ? endRunningParty(get()) : {};
    set((s) => {
      const conversations = { ...s.conversations };
      delete conversations[id];
      let order = s.conversationOrder.filter((x) => x !== id);
      if (order.length === 0) {
        const c = emptyConversation();
        conversations[c.id] = c;
        order = [c.id];
      }
      return {
        ...party,
        conversations,
        conversationOrder: order,
        activeConvoId: s.activeConvoId === id ? order[0] : s.activeConvoId,
      };
    });
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
