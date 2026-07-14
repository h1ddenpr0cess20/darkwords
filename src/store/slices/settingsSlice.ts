import type { Effort, ModelDef, ModelId, PromptMode, Provider, ThemeId, ToolsEnabled } from '../../types';
import { DEFAULT_PERSONALITY_NAME } from '../../lib/prompt';
import {
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_LM_STUDIO_URL,
  fetchAnthropicModels,
  fetchLmStudioModels,
} from '../../lib/models';
import type { SliceCreator } from '../types';

export interface SettingsSlice {
  provider: Provider;
  selectedModelId: ModelId;
  themeId: ThemeId;
  toolsEnabled: ToolsEnabled;
  apiKey: string;
  imageApiKey: string;
  effort: Effort;

  lmStudioUrl: string;
  lmStudioModelId: ModelId;
  /** User-set embedding model for local RAG; blank = auto-detect. */
  embeddingModelId: string;

  /** Fetched model catalogs — not persisted; refreshed from the endpoints. */
  anthropicModels: ModelDef[];
  lmStudioModels: ModelDef[];
  embeddingModels: string[];
  modelsError: string | null;
  modelsLoading: boolean;

  promptMode: PromptMode;
  personalityName: string;
  customPrompt: string;
  verbose: boolean;

  setProvider: (provider: Provider) => void;
  setLmStudioUrl: (url: string) => void;
  setEmbeddingModelId: (id: string) => void;
  refreshModels: () => Promise<void>;

  selectModel: (id: ModelId) => void;
  setTheme: (id: ThemeId) => void;
  toggleTool: (key: keyof ToolsEnabled) => void;
  setApiKey: (key: string) => void;
  setImageApiKey: (key: string) => void;
  setEffort: (effort: Effort) => void;

  setPromptMode: (mode: PromptMode) => void;
  setPersonalityName: (name: string) => void;
  setCustomPrompt: (text: string) => void;
  toggleVerbose: () => void;
  resetPersonality: () => void;
}

export const createSettingsSlice: SliceCreator<SettingsSlice> = (set, get) => ({
  provider: 'anthropic',
  selectedModelId: DEFAULT_ANTHROPIC_MODEL,
  themeId: 'ink',
  toolsEnabled: { web: true, code: true, files: true, image: false },
  apiKey: '',
  imageApiKey: '',
  effort: 'medium',

  lmStudioUrl: DEFAULT_LM_STUDIO_URL,
  lmStudioModelId: '',
  embeddingModelId: '',

  anthropicModels: [],
  lmStudioModels: [],
  embeddingModels: [],
  modelsError: null,
  modelsLoading: false,

  promptMode: 'personality',
  personalityName: DEFAULT_PERSONALITY_NAME,
  customPrompt: '',
  verbose: false,

  setProvider: (provider) => {
    set({ provider, modelsError: null });
    void get().refreshModels();
  },
  setLmStudioUrl: (url) => set({ lmStudioUrl: url.trim().replace(/\/+$/, '') }),
  setEmbeddingModelId: (id) => set({ embeddingModelId: id }),

  refreshModels: async () => {
    const s = get();
    set({ modelsLoading: true, modelsError: null });
    try {
      if (s.provider === 'lmstudio') {
        const catalog = await fetchLmStudioModels(s.lmStudioUrl);
        set((st) => ({
          lmStudioModels: catalog.chat,
          embeddingModels: catalog.embeddings,
          // Auto-select the first model when none is chosen or the choice vanished.
          lmStudioModelId:
            st.lmStudioModelId && catalog.chat.some((m) => m.id === st.lmStudioModelId)
              ? st.lmStudioModelId
              : (catalog.chat[0]?.id ?? ''),
        }));
      } else {
        if (!s.apiKey) {
          set({ modelsError: 'Set an Anthropic API key to load the model list.' });
          return;
        }
        const catalog = await fetchAnthropicModels(s.apiKey);
        set({ anthropicModels: catalog.chat });
      }
    } catch (err) {
      set({ modelsError: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ modelsLoading: false });
    }
  },

  selectModel: (id) =>
    set((s) =>
      s.provider === 'lmstudio'
        ? { lmStudioModelId: id, modelPickerOpen: false }
        : { selectedModelId: id, modelPickerOpen: false },
    ),
  setTheme: (id) => set({ themeId: id }),
  toggleTool: (key) => set((s) => ({ toolsEnabled: { ...s.toolsEnabled, [key]: !s.toolsEnabled[key] } })),
  setApiKey: (key) => set({ apiKey: key.trim() }),
  setImageApiKey: (key) => set({ imageApiKey: key.trim() }),
  setEffort: (effort) => set({ effort }),

  setPromptMode: (mode) => set({ promptMode: mode }),
  setPersonalityName: (name) => set({ personalityName: name }),
  setCustomPrompt: (text) => set({ customPrompt: text }),
  toggleVerbose: () => set((s) => ({ verbose: !s.verbose })),
  resetPersonality: () => set({ personalityName: DEFAULT_PERSONALITY_NAME, verbose: false }),
});
