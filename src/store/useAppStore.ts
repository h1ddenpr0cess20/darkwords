import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { idbStorage } from '../lib/idbStorage';
import { parseBlocks } from '../lib/blocks';
import type { Conversation, GalleryItem } from '../types';
import { conversationOrderForMode, emptyConversation, firstConversation } from './helpers';
import type { AppState } from './types';
import { createUiSlice } from './slices/uiSlice';
import { createSettingsSlice, defaultPersonaSnapshot, loadPersonaForConversation } from './slices/settingsSlice';
import { createTtsSlice } from './slices/ttsSlice';
import { createLibrarySlice } from './slices/librarySlice';
import { createDataSlice } from './slices/dataSlice';
import { createPartySlice, loadPartyForConversation } from './slices/partySlice';
import { createConversationsSlice } from './slices/conversationsSlice';
import { createChatSlice } from './slices/chatSlice';
import './partyHost';

export type { AppState } from './types';

/**
 * The app store: all slices combined, persisted to IndexedDB. `partialize`
 * keeps only durable state — transient flags (streaming, panels, party status)
 * are rebuilt on load, and a party `promptMode` is normalized back to
 * `personality` at save time. Once the store rehydrates, `onRehydrateStorage`
 * re-derives party state from whatever the active conversation last saved
 * (see `partyConfig` on `Conversation`), so a party conversation reopens as a
 * stopped, resumable party rather than an inert transcript — and, when there's
 * no party, restores that conversation's own prompt-mode/persona settings
 * (see `personaSnapshot`) instead of leaving whatever was last active
 * elsewhere. `migrate` upgrades older persisted shapes; bump `version` when
 * the persisted shape changes.
 */
export const useAppStore = create<AppState>()(
  persist(
    (...a) => ({
      ...createUiSlice(...a),
      ...createSettingsSlice(...a),
      ...createTtsSlice(...a),
      ...createLibrarySlice(...a),
      ...createDataSlice(...a),
      ...createPartySlice(...a),
      ...createConversationsSlice(...a),
      ...createChatSlice(...a),
    }),
    {
      name: 'darkwords-store',
      version: 4,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        conversations: s.conversations,
        conversationOrder: s.conversationOrder,
        activeConvoId: s.activeConvoId,
        provider: s.provider,
        lmStudioUrl: s.lmStudioUrl,
        lmStudioModelId: s.lmStudioModelId,
        embeddingModelId: s.embeddingModelId,
        selectedModelId: s.selectedModelId,
        themeId: s.themeId,
        toolsEnabled: s.toolsEnabled,
        apiKey: s.apiKey,
        imageApiKey: s.imageApiKey,
        promptMode: s.promptMode === 'party' ? 'personality' : s.promptMode,
        personalityName: s.personalityName,
        customPrompt: s.customPrompt,
        verbose: s.verbose,
        fontScale: s.fontScale,
        effort: s.effort,
        locationEnabled: s.locationEnabled,
        locationString: s.locationString,
        exportFormat: s.exportFormat,
        exportIncludeThinking: s.exportIncludeThinking,
        ttsEnabled: s.ttsEnabled,
        ttsAutoplay: s.ttsAutoplay,
        ttsVoice: s.ttsVoice,
        ttsInstructions: s.ttsInstructions,
        memoryEnabled: s.memoryEnabled,
        memoryLimit: s.memoryLimit,
        memories: s.memories,
        skills: s.skills,
        mcpServers: s.mcpServers,
        galleryItems: s.galleryItems,
      }),
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Record<string, unknown>;

        if (version < 2) {
          return {
            ...state,
            conversations: { [firstConversation.id]: firstConversation },
            conversationOrder: [firstConversation.id],
            activeConvoId: firstConversation.id,
            galleryItems: [] as GalleryItem[],
          };
        }
        if (version < 4) {
          const aliases: Record<string, string> = {
            opus: 'claude-opus-4-8',
            sonnet: 'claude-sonnet-5',
            haiku: 'claude-haiku-4-5',
          };
          const old = state.selectedModelId;
          if (typeof old === 'string' && aliases[old]) {
            return { ...state, selectedModelId: aliases[old] };
          }
        }
        return state;
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const inMode = conversationOrderForMode(state);
        let convoPatch: Partial<AppState> = {};
        let activeId = state.activeConvoId;
        let conversations = state.conversations;
        /**
         * Messages are persisted wholesale, so a reload mid-stream stores
         * bubbles still flagged `streaming`/`reasoning`. No turn survives a
         * reload, so finalize them here — otherwise they spin forever and
         * stay hidden from actions, exports, and the party transcript.
         */
        const finalized = Object.fromEntries(
          Object.entries(conversations).map(([id, c]): [string, Conversation] => {
            if (!c.messages.some((m) => m.streaming || m.reasoning)) return [id, c];
            return [
              id,
              {
                ...c,
                messages: c.messages.map((m) =>
                  m.streaming || m.reasoning
                    ? { ...m, streaming: false, reasoning: false, parts: m.rawText ? parseBlocks(m.rawText) : m.parts }
                    : m,
                ),
              },
            ];
          }),
        );
        if (Object.entries(finalized).some(([id, c]) => c !== conversations[id])) {
          conversations = finalized;
          convoPatch = { conversations };
        }
        if (!inMode.includes(activeId)) {
          if (inMode.length > 0) {
            activeId = inMode[0];
            convoPatch = { ...convoPatch, activeConvoId: activeId };
          } else {
            const c = { ...emptyConversation(), personaSnapshot: defaultPersonaSnapshot() };
            activeId = c.id;
            conversations = { ...conversations, [c.id]: c };
            convoPatch = {
              conversations,
              conversationOrder: [c.id, ...state.conversationOrder],
              activeConvoId: c.id,
            };
          }
        }
        const active = conversations[activeId];
        if (active && !active.personaSnapshot && !active.partyConfig && active.messages.length === 0) {
          conversations = { ...conversations, [activeId]: { ...active, personaSnapshot: defaultPersonaSnapshot() } };
          convoPatch = { ...convoPatch, conversations };
        }
        const convo = conversations[activeId];
        const resumed = loadPartyForConversation(convo);
        const persona = loadPersonaForConversation(convo);
        const patch = { ...convoPatch, ...persona, ...resumed };
        if (Object.keys(patch).length) useAppStore.setState(patch);
      },
    },
  ),
);
