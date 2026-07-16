import type { Conversation, GalleryItem, McpServer, Memory, Skill } from '../../types';
import { partyEngine } from '../../lib/party/engine';
import { ttsPlayback } from '../../lib/ttsPlayback';
import { conversationOrderForMode, emptyConversation } from '../helpers';
import { activateConversation } from './conversationsSlice';
import type { SliceCreator } from '../types';

/**
 * The settings an export carries, mirrored by import. Import copies only these
 * keys — spreading a whole parsed object into the store would let a corrupt or
 * hand-edited file clobber anything, including store actions.
 */
const EXPORTED_SETTING_KEYS = [
  'provider',
  'lmStudioUrl',
  'lmStudioModelId',
  'embeddingModelId',
  'selectedModelId',
  'themeId',
  'toolsEnabled',
  'promptMode',
  'personalityName',
  'customPrompt',
  'verbose',
  'effort',
  'memoryEnabled',
  'memoryLimit',
] as const;

/** Backup and restore for the Data panel. */
export interface DataSlice {
  /**
   * Serializes conversations, gallery, library, and settings to pretty JSON.
   * API keys and MCP auth tokens are deliberately left out of the file.
   */
  exportData: () => string;
  /**
   * Restores an export, replacing current data. Returns false (leaving state
   * untouched) when the JSON is not a usable export.
   */
  importData: (json: string) => boolean;
  /** Wipes everything back to a fresh install, ending any running party. */
  clearAllData: () => void;
}

export const createDataSlice: SliceCreator<DataSlice> = (set, get) => ({
  exportData: () => {
    const s = get();
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        conversations: s.conversations,
        conversationOrder: s.conversationOrder,
        galleryItems: s.galleryItems,
        memories: s.memories,
        skills: s.skills,
        mcpServers: s.mcpServers.map((m) => ({ ...m, authToken: undefined })),
        settings: {
          provider: s.provider,
          lmStudioUrl: s.lmStudioUrl,
          lmStudioModelId: s.lmStudioModelId,
          embeddingModelId: s.embeddingModelId,
          selectedModelId: s.selectedModelId,
          themeId: s.themeId,
          toolsEnabled: s.toolsEnabled,
          /** Normalized like `partialize` — parties are restored via `partyConfig`, and a bare 'party' mode would come back as a phantom party. */
          promptMode: s.promptMode === 'party' ? 'personality' : s.promptMode,
          personalityName: s.personalityName,
          customPrompt: s.customPrompt,
          verbose: s.verbose,
          effort: s.effort,
          memoryEnabled: s.memoryEnabled,
          memoryLimit: s.memoryLimit,
        },
      },
      null,
      2,
    );
  },

  importData: (json) => {
    try {
      const data = JSON.parse(json) as Record<string, unknown>;
      const conversations = data.conversations as Record<string, Conversation> | undefined;
      if (!conversations || typeof conversations !== 'object') return false;

      let order = Array.isArray(data.conversationOrder)
        ? (data.conversationOrder as string[]).filter((id) => conversations[id])
        : Object.keys(conversations);
      if (!order.length) return false;

      let inMode = conversationOrderForMode({ conversations, conversationOrder: order });
      if (inMode.length === 0) {
        const c = emptyConversation();
        conversations[c.id] = c;
        order = [c.id, ...order];
        inMode = [c.id];
      }

      const rawSettings = (data.settings ?? {}) as Record<string, unknown>;
      const settings: Record<string, unknown> = {};
      for (const key of EXPORTED_SETTING_KEYS) {
        if (key in rawSettings) settings[key] = rawSettings[key];
      }
      /** Exports predating the export-side normalization may still carry 'party'. */
      if (settings.promptMode === 'party') settings.promptMode = 'personality';

      set({
        ...settings,
        conversations,
        conversationOrder: order,
        activeConvoId: inMode[0],
        galleryItems: Array.isArray(data.galleryItems) ? (data.galleryItems as GalleryItem[]) : [],
        memories: Array.isArray(data.memories) ? (data.memories as Memory[]) : [],
        skills: Array.isArray(data.skills) ? (data.skills as Skill[]) : [],
        mcpServers: Array.isArray(data.mcpServers) ? (data.mcpServers as McpServer[]) : [],
      });
      /**
       * Make the imported active conversation's own persona/party take
       * effect, exactly as switching to it would — this also unloads any
       * party still in the engine from before the import.
       */
      set(activateConversation(conversations[inMode[0]]));
      return true;
    } catch {
      return false;
    }
  },

  clearAllData: () => {
    partyEngine.reset();
    void ttsPlayback.clearAll();
    const fresh = emptyConversation();
    set({
      conversations: { [fresh.id]: fresh },
      conversationOrder: [fresh.id],
      activeConvoId: fresh.id,
      galleryItems: [],
      memories: [],
      skills: [],
      mcpServers: [],
      input: '',
      pendingUploads: [],
    });
  },
});
