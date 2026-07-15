import type {
  Conversation,
  Effort,
  ModelDef,
  ModelId,
  PersonaSnapshot,
  PromptMode,
  Provider,
  ThemeId,
  ToolsEnabled,
} from '../../types';
import { DEFAULT_PERSONALITY_NAME } from '../../lib/prompt';
import { requestLocation } from '../../lib/location';
import type { ExportFormatKey } from '../../lib/conversationExport';
import {
  ANTHROPIC_MODELS,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_LM_STUDIO_URL,
  fetchLmStudioModels,
} from '../../lib/models';
import { withConvo } from '../helpers';
import type { AppState, SliceCreator } from '../types';

/**
 * The prompt-mode/persona settings currently in effect, in the shape saved on
 * a conversation. A party `promptMode` is normalized to `personality`, same
 * as `partialize` does at save time — parties are restored through
 * `partyConfig`, never through a snapshot, and letting `party` into one would
 * resurrect a phantom party mode (Party form shown, no engine config) after
 * the party is left.
 */
export function currentPersonaSnapshot(
  s: Pick<AppState, 'promptMode' | 'personalityName' | 'customPrompt' | 'verbose'>,
): PersonaSnapshot {
  return {
    promptMode: s.promptMode === 'party' ? 'personality' : s.promptMode,
    personalityName: s.personalityName,
    customPrompt: s.customPrompt,
    verbose: s.verbose,
  };
}

/**
 * Restores a conversation's saved prompt-mode/persona settings — used when it
 * becomes active, mirroring `loadPartyForConversation`. A no-op when it never
 * had one (conversations predating this feature) or when a party claims it
 * instead, since that's restored separately and takes priority. A `party`
 * mode in an already-persisted snapshot is coerced away, matching what
 * `currentPersonaSnapshot` now writes.
 */
export function loadPersonaForConversation(convo: Conversation | undefined): Partial<AppState> {
  if (!convo?.personaSnapshot || convo.partyConfig) return {};
  const snapshot = convo.personaSnapshot;
  return { ...snapshot, promptMode: snapshot.promptMode === 'party' ? 'personality' : snapshot.promptMode };
}

/** Patches `activeConvoId`'s saved persona to match settings about to take effect. */
function snapshotPersonaPatch(s: AppState, overrides: Partial<PersonaSnapshot> = {}): Partial<AppState> {
  const snapshot = { ...currentPersonaSnapshot(s), ...overrides };
  return withConvo(s, s.activeConvoId, (c) => ({ ...c, personaSnapshot: snapshot }));
}

/** Provider, model, tools, prompt, and appearance settings. */
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

  /** Anthropic's catalog is hardcoded; LM Studio's is fetched from the server. */
  anthropicModels: ModelDef[];
  lmStudioModels: ModelDef[];
  embeddingModels: string[];
  modelsError: string | null;
  modelsLoading: boolean;

  promptMode: PromptMode;
  personalityName: string;
  customPrompt: string;
  verbose: boolean;

  /** Injects the user's approximate location into the system prompt when on. */
  locationEnabled: boolean;
  locationString: string;
  locationError: string | null;
  locationLoading: boolean;

  /** Remembered picks for the conversation-export menu. */
  exportFormat: ExportFormatKey;
  exportIncludeThinking: boolean;

  setProvider: (provider: Provider) => void;
  setLmStudioUrl: (url: string) => void;
  setEmbeddingModelId: (id: string) => void;
  /**
   * Re-fetches LM Studio's model list (a no-op for Anthropic — its catalog is
   * fixed), auto-selecting the first model when none is chosen or the previous
   * choice disappeared.
   */
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

  /** Turns location on and resolves a fresh fix; clears it back off on failure. */
  enableLocation: () => Promise<void>;
  disableLocation: () => void;
  setExportFormat: (format: ExportFormatKey) => void;
  setExportIncludeThinking: (include: boolean) => void;
}

export const createSettingsSlice: SliceCreator<SettingsSlice> = (set, get) => ({
  provider: 'anthropic',
  selectedModelId: DEFAULT_ANTHROPIC_MODEL,
  themeId: 'ember',
  toolsEnabled: { web: true, code: true, files: true, image: false },
  apiKey: '',
  imageApiKey: '',
  effort: 'medium',

  lmStudioUrl: DEFAULT_LM_STUDIO_URL,
  lmStudioModelId: '',
  embeddingModelId: '',

  anthropicModels: ANTHROPIC_MODELS,
  lmStudioModels: [],
  embeddingModels: [],
  modelsError: null,
  modelsLoading: false,

  promptMode: 'personality',
  personalityName: DEFAULT_PERSONALITY_NAME,
  customPrompt: '',
  verbose: false,

  locationEnabled: false,
  locationString: '',
  locationError: null,
  locationLoading: false,

  exportFormat: 'md',
  exportIncludeThinking: false,

  setProvider: (provider) => {
    set({ provider, modelsError: null });
    void get().refreshModels();
  },
  setLmStudioUrl: (url) => set({ lmStudioUrl: url.trim().replace(/\/+$/, '') }),
  setEmbeddingModelId: (id) => set({ embeddingModelId: id }),

  refreshModels: async () => {
    const s = get();
    if (s.provider !== 'lmstudio') return;
    set({ modelsLoading: true, modelsError: null });
    try {
      const catalog = await fetchLmStudioModels(s.lmStudioUrl);
      set((st) => ({
        lmStudioModels: catalog.chat,
        embeddingModels: catalog.embeddings,
        lmStudioModelId:
          st.lmStudioModelId && catalog.chat.some((m) => m.id === st.lmStudioModelId)
            ? st.lmStudioModelId
            : (catalog.chat[0]?.id ?? ''),
      }));
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

  setPromptMode: (mode) => set((s) => ({ promptMode: mode, ...snapshotPersonaPatch(s, { promptMode: mode }) })),
  setPersonalityName: (name) =>
    set((s) => ({ personalityName: name, ...snapshotPersonaPatch(s, { personalityName: name }) })),
  setCustomPrompt: (text) => set((s) => ({ customPrompt: text, ...snapshotPersonaPatch(s, { customPrompt: text }) })),
  toggleVerbose: () => set((s) => ({ verbose: !s.verbose, ...snapshotPersonaPatch(s, { verbose: !s.verbose }) })),
  resetPersonality: () =>
    set((s) => ({
      personalityName: DEFAULT_PERSONALITY_NAME,
      verbose: false,
      ...snapshotPersonaPatch(s, { personalityName: DEFAULT_PERSONALITY_NAME, verbose: false }),
    })),

  enableLocation: async () => {
    set({ locationLoading: true, locationError: null });
    const result = await requestLocation();
    if (result.ok) {
      set({
        locationEnabled: true,
        locationString: result.fix.locationString,
        locationError: null,
        locationLoading: false,
      });
    } else {
      set({ locationEnabled: false, locationString: '', locationError: result.error, locationLoading: false });
    }
  },
  disableLocation: () =>
    set({ locationEnabled: false, locationString: '', locationError: null, locationLoading: false }),
  setExportFormat: (format) => set({ exportFormat: format }),
  setExportIncludeThinking: (include) => set({ exportIncludeThinking: include }),
});
