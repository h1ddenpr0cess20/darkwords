import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { idbStorage } from '../lib/idbStorage';
import type { GalleryItem } from '../types';
import { firstConversation } from './helpers';
import type { AppState } from './types';
import { createUiSlice } from './slices/uiSlice';
import { createSettingsSlice, loadPersonaForConversation } from './slices/settingsSlice';
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
        const convo = state.conversations[state.activeConvoId];
        const resumed = loadPartyForConversation(convo);
        const persona = loadPersonaForConversation(convo);
        const patch = { ...persona, ...resumed };
        if (Object.keys(patch).length) useAppStore.setState(patch);
      },
    },
  ),
);
