import type { Conversation, GalleryItem, McpServer, Memory, Skill } from '../../types';
import { partyEngine } from '../../lib/party/engine';
import { ttsPlayback } from '../../lib/ttsPlayback';
import { emptyConversation } from '../helpers';
import type { SliceCreator } from '../types';

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
          promptMode: s.promptMode,
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

      const order = Array.isArray(data.conversationOrder)
        ? (data.conversationOrder as string[]).filter((id) => conversations[id])
        : Object.keys(conversations);
      if (!order.length) return false;

      set({
        conversations,
        conversationOrder: order,
        activeConvoId: order[0],
        galleryItems: Array.isArray(data.galleryItems) ? (data.galleryItems as GalleryItem[]) : [],
        memories: Array.isArray(data.memories) ? (data.memories as Memory[]) : [],
        skills: Array.isArray(data.skills) ? (data.skills as Skill[]) : [],
        mcpServers: Array.isArray(data.mcpServers) ? (data.mcpServers as McpServer[]) : [],
        ...((data.settings as object) ?? {}),
      });
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
