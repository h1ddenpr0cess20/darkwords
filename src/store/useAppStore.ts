import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Attachment,
  ChatMessage,
  Conversation,
  GalleryItem,
  ModelDef,
  ModelId,
  PanelId,
  PromptMode,
  SettingsTab,
  ThemeId,
  ToolsEnabled,
} from '../types';
import { MODELS } from '../lib/config';
import { makeId } from '../lib/id';
import { parseBlocks, partsToPlainText } from '../lib/blocks';
import {
  completeOnce,
  streamAssistantTurn,
  type ApiMessage,
  type ImageToolResult,
} from '../lib/anthropic';
import { generateImage, ImageGenError } from '../lib/images';
import { buildSystemPrompt, DEFAULT_PERSONALITY_NAME } from '../lib/prompt';
import { partyEngine, type PartyHost, type TranscriptLine } from '../lib/party/engine';
import {
  defaultPartyConfig,
  type PartyCharacter,
  type PartyConfig,
  type PartyScenario,
  type PartyStatus,
  type PartyToolKey,
} from '../lib/party/types';

function nowTime(): string {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function messageText(m: ChatMessage): string {
  return m.rawText || partsToPlainText(m.parts);
}

interface AppState {
  conversations: Record<string, Conversation>;
  conversationOrder: string[];
  activeConvoId: string;

  activePanel: PanelId;
  panelTab: SettingsTab;
  modelPickerOpen: boolean;

  selectedModelId: ModelId;
  themeId: ThemeId;
  toolsEnabled: ToolsEnabled;
  apiKey: string;
  imageApiKey: string;

  // Prompt composition (Wordmark's prompt modes).
  promptMode: PromptMode;
  personalityName: string;
  customPrompt: string;
  verbose: boolean;

  // Party mode.
  partyDraft: PartyConfig;
  partyStatus: PartyStatus;
  activeParty: PartyConfig | null;

  input: string;
  pendingUploads: Attachment[];
  galleryItems: GalleryItem[];

  isSending: boolean;

  setInput: (text: string) => void;
  addUpload: (att: Attachment) => void;
  removeUpload: (id: string) => void;

  openSettings: () => void;
  openHistory: () => void;
  openGallery: () => void;
  openParty: () => void;
  closePanel: () => void;
  setPanelTab: (tab: SettingsTab) => void;

  toggleModelPicker: () => void;
  selectModel: (id: ModelId) => void;
  setTheme: (id: ThemeId) => void;
  toggleTool: (key: keyof ToolsEnabled) => void;
  setApiKey: (key: string) => void;
  setImageApiKey: (key: string) => void;

  setPromptMode: (mode: PromptMode) => void;
  setPersonalityName: (name: string) => void;
  setCustomPrompt: (text: string) => void;
  toggleVerbose: () => void;
  resetPersonality: () => void;

  setPartyUserName: (name: string) => void;
  setPartyScenario: (patch: Partial<PartyScenario>) => void;
  addPartyCharacter: () => void;
  updatePartyCharacter: (id: string, patch: Partial<PartyCharacter>) => void;
  removePartyCharacter: (id: string) => void;
  togglePartyCharacterTool: (id: string, tool: PartyToolKey) => void;
  startParty: () => void;
  pauseParty: () => void;
  resumeParty: () => void;
  stopParty: () => void;
  leaveParty: () => void;

  newConversation: () => void;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  toggleThinking: (msgId: string) => void;

  sendMessage: () => Promise<void>;
  stopStreaming: () => void;
}

/** Label colours handed out to new party characters, in order. */
const CHARACTER_COLORS = ['#7EE787', '#E8B54D', '#8FB9FF', '#E88484', '#C99BFF', '#5FD9C4'];

function emptyConversation(): Conversation {
  const id = makeId('conv');
  return { id, title: 'New conversation', messages: [], createdAt: Date.now(), updatedAt: Date.now() };
}

function withConvo(
  state: AppState,
  convoId: string,
  fn: (c: Conversation) => Conversation,
): Pick<AppState, 'conversations'> {
  const current = state.conversations[convoId];
  if (!current) return { conversations: state.conversations };
  return { conversations: { ...state.conversations, [convoId]: fn(current) } };
}

function appendMessage(c: Conversation, msg: ChatMessage): Conversation {
  return { ...c, messages: [...c.messages, msg], updatedAt: Date.now() };
}

function patchMessage(
  c: Conversation,
  msgId: string,
  patch: Partial<ChatMessage> | ((m: ChatMessage) => Partial<ChatMessage>),
  /** View-only changes (e.g. expanding reasoning) must not re-sort History. */
  touch = true,
): Conversation {
  return {
    ...c,
    messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m)),
    updatedAt: touch ? Date.now() : c.updatedAt,
  };
}

function dropMessage(c: Conversation, msgId: string): Conversation {
  return { ...c, messages: c.messages.filter((m) => m.id !== msgId) };
}

/** Records a tool call, or updates it in place if we've already seen its id. */
function upsertTool(m: ChatMessage, info: { id: string; name: string; input: string }): Partial<ChatMessage> {
  const existing = m.tools ?? [];
  if (existing.some((t) => t.id === info.id)) {
    return { tools: existing.map((t) => (t.id === info.id ? { ...t, ...info } : t)) };
  }
  return { tools: [...existing, info] };
}

function resolveTool(m: ChatMessage, info: { id: string; output: string; isError?: boolean }): Partial<ChatMessage> {
  const existing = m.tools ?? [];
  if (!existing.length) return {};
  // Server tool results carry their tool_use id; fall back to the most recent
  // unresolved call when the id isn't echoed back.
  const target = existing.find((t) => t.id === info.id) ?? [...existing].reverse().find((t) => t.output === undefined);
  if (!target) return {};
  return {
    tools: existing.map((t) => (t.id === target.id ? { ...t, output: info.output, isError: info.isError } : t)),
  };
}

const firstConversation = emptyConversation();

// An in-flight request isn't app state worth persisting.
let activeController: AbortController | null = null;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      conversations: { [firstConversation.id]: firstConversation },
      conversationOrder: [firstConversation.id],
      activeConvoId: firstConversation.id,

      activePanel: null,
      panelTab: 'model',
      modelPickerOpen: false,

      selectedModelId: 'opus',
      themeId: 'ink',
      toolsEnabled: { web: true, code: true, files: true, image: false },
      apiKey: '',
      imageApiKey: '',

      promptMode: 'personality',
      personalityName: DEFAULT_PERSONALITY_NAME,
      customPrompt: '',
      verbose: false,

      partyDraft: defaultPartyConfig(),
      partyStatus: 'off',
      activeParty: null,

      input: '',
      pendingUploads: [],
      galleryItems: [],

      isSending: false,

      setInput: (text) => set({ input: text }),
      addUpload: (att) => set((s) => ({ pendingUploads: [...s.pendingUploads, att] })),
      removeUpload: (id) => set((s) => ({ pendingUploads: s.pendingUploads.filter((u) => u.id !== id) })),

      openSettings: () => set({ activePanel: 'settings', panelTab: 'model' }),
      openHistory: () => set({ activePanel: 'history' }),
      openGallery: () => set({ activePanel: 'gallery' }),
      // The rail's party button jumps straight to the party setup form.
      openParty: () => set({ activePanel: 'settings', panelTab: 'personality', promptMode: 'party' }),
      closePanel: () => set({ activePanel: null, modelPickerOpen: false }),
      setPanelTab: (tab) => set({ panelTab: tab }),

      toggleModelPicker: () => set((s) => ({ modelPickerOpen: !s.modelPickerOpen })),
      selectModel: (id) => set({ selectedModelId: id, modelPickerOpen: false }),
      setTheme: (id) => set({ themeId: id }),
      toggleTool: (key) => set((s) => ({ toolsEnabled: { ...s.toolsEnabled, [key]: !s.toolsEnabled[key] } })),
      setApiKey: (key) => set({ apiKey: key.trim() }),
      setImageApiKey: (key) => set({ imageApiKey: key.trim() }),

      setPromptMode: (mode) => set({ promptMode: mode }),
      setPersonalityName: (name) => set({ personalityName: name }),
      setCustomPrompt: (text) => set({ customPrompt: text }),
      toggleVerbose: () => set((s) => ({ verbose: !s.verbose })),
      resetPersonality: () => set({ personalityName: DEFAULT_PERSONALITY_NAME, verbose: false }),

      setPartyUserName: (name) => set((s) => ({ partyDraft: { ...s.partyDraft, userName: name } })),
      setPartyScenario: (patch) =>
        set((s) => ({ partyDraft: { ...s.partyDraft, scenario: { ...s.partyDraft.scenario, ...patch } } })),

      addPartyCharacter: () =>
        set((s) => {
          const character: PartyCharacter = {
            id: makeId('pc'),
            name: '',
            persona: '',
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

        // A party always begins in a fresh conversation.
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
        // "Resume" means both un-pausing a live loop and restarting a stopped one.
        if (partyEngine.isRunning()) {
          partyEngine.resume();
          return;
        }
        const config = partyEngine.activeConfig();
        if (config) void partyEngine.start(config);
      },
      stopParty: () => partyEngine.stop(),
      leaveParty: () => {
        partyEngine.reset();
        set({ promptMode: 'personality' });
      },

      newConversation: () =>
        set((s) => {
          const c = emptyConversation();
          return {
            conversations: { ...s.conversations, [c.id]: c },
            conversationOrder: [c.id, ...s.conversationOrder],
            activeConvoId: c.id,
            activePanel: null,
          };
        }),
      selectConversation: (id) => set({ activeConvoId: id, activePanel: null }),

      deleteConversation: (id) =>
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
            conversations,
            conversationOrder: order,
            activeConvoId: s.activeConvoId === id ? order[0] : s.activeConvoId,
          };
        }),

      toggleThinking: (msgId) =>
        set((s) =>
          withConvo(s, s.activeConvoId, (c) =>
            patchMessage(c, msgId, (m) => ({ thinkingOpen: !m.thinkingOpen }), false),
          ),
        ),

      stopStreaming: () => {
        if (get().activeParty) {
          partyEngine.stop();
          return;
        }
        activeController?.abort();
        activeController = null;
      },

      sendMessage: async () => {
        const state = get();
        const text = state.input.trim();
        if ((!text && state.pendingUploads.length === 0) || state.isSending) return;

        // While a party is loaded, the input bar is an interjection channel — the
        // engine owns the turn loop and never falls through to regular chat.
        if (state.activeParty) {
          set({ input: '' });
          partyEngine.queueInterjection(text);
          return;
        }

        const convoId = state.activeConvoId;
        const model = MODELS.find((m) => m.id === state.selectedModelId) ?? MODELS[0];
        const uploads = state.pendingUploads;

        const userMsg: ChatMessage = {
          id: makeId('u'),
          role: 'user',
          displayName: 'You',
          time: nowTime(),
          attachments: uploads,
          parts: text ? [{ type: 'para', text }] : [],
          rawText: text,
        };

        set((s) => {
          const patch = withConvo(s, convoId, (c) => {
            const withMsg = appendMessage(c, userMsg);
            const isFirst = c.messages.length === 0;
            const title = text || uploads[0]?.name || 'New conversation';
            return isFirst ? { ...withMsg, title: title.slice(0, 60) } : withMsg;
          });
          const newGallery: GalleryItem[] = uploads
            .filter((u) => u.mimeType.startsWith('image/') && u.dataUrl)
            .map((u) => ({
              id: makeId('g'),
              label: u.name,
              kind: 'Uploaded' as const,
              src: u.dataUrl,
              createdAt: Date.now(),
            }));
          return {
            ...patch,
            input: '',
            pendingUploads: [],
            galleryItems: [...newGallery, ...s.galleryItems],
          };
        });

        if (!state.apiKey) {
          set((s) =>
            withConvo(s, convoId, (c) =>
              appendMessage(c, {
                id: makeId('a'),
                role: 'assistant',
                displayName: 'Claude',
                time: nowTime(),
                attachments: [],
                rawText: '',
                parts: [
                  { type: 'para', text: 'No Anthropic API key set. Add one in Settings → API Key to start chatting.' },
                ],
                error: 'missing_api_key',
              }),
            ),
          );
          return;
        }

        const controller = new AbortController();
        activeController = controller;
        set({ isSending: true });

        try {
          await runReply(convoId, model, controller.signal);
        } finally {
          if (activeController === controller) activeController = null;
          set({ isSending: false });
        }

        async function runReply(cid: string, mdl: ModelDef, signal: AbortSignal) {
          const assistantId = makeId('a');
          set((s) =>
            withConvo(s, cid, (c) =>
              appendMessage(c, {
                id: assistantId,
                role: 'assistant',
                displayName: 'Claude',
                time: nowTime(),
                attachments: [],
                rawText: '',
                parts: [],
                streaming: true,
              }),
            ),
          );

          const s0 = get();
          const convo = s0.conversations[cid];
          const history: ApiMessage[] = convo.messages
            .filter((m) => m.id !== assistantId && !m.error)
            .map((m) => ({ role: m.role, text: messageText(m), attachments: m.attachments }));

          await streamAssistantTurn({
            apiKey: s0.apiKey,
            model: mdl,
            systemPrompt: buildSystemPrompt({
              mode: s0.promptMode,
              personalityName: s0.personalityName,
              customPrompt: s0.customPrompt,
              verbose: s0.verbose,
            }),
            thinkingEnabled: true,
            tools: s0.toolsEnabled,
            imageToolAvailable: Boolean(s0.imageApiKey),
            history,
            signal,
            callbacks: streamCallbacks(cid, assistantId, signal),
          });

          set((s) =>
            withConvo(s, cid, (c) =>
              patchMessage(c, assistantId, (m) => ({
                streaming: false,
                parts: m.rawText
                  ? parseBlocks(m.rawText)
                  : m.error
                    ? [{ type: 'para', text: `Error: ${m.error}` }]
                    : m.parts,
              })),
            ),
          );
        }
      },
    }),
    {
      name: 'darkwords-store',
      version: 3,
      partialize: (s) => ({
        conversations: s.conversations,
        conversationOrder: s.conversationOrder,
        activeConvoId: s.activeConvoId,
        selectedModelId: s.selectedModelId,
        themeId: s.themeId,
        toolsEnabled: s.toolsEnabled,
        apiKey: s.apiKey,
        imageApiKey: s.imageApiKey,
        promptMode: s.promptMode === 'party' ? 'personality' : s.promptMode,
        personalityName: s.personalityName,
        customPrompt: s.customPrompt,
        verbose: s.verbose,
        galleryItems: s.galleryItems,
      }),
      // Older versions stored mock seed data, hue-based placeholder art, and the
      // hardcoded persona round-robin that party mode replaces.
      migrate: () => ({
        conversations: { [firstConversation.id]: firstConversation },
        conversationOrder: [firstConversation.id],
        activeConvoId: firstConversation.id,
        galleryItems: [] as GalleryItem[],
      }),
    },
  ),
);

/**
 * Streaming callbacks shared by ordinary chat and party turns — both stream into
 * a message bubble and record tool calls and generated images the same way.
 */
function streamCallbacks(cid: string, messageId: string, signal: AbortSignal) {
  const set = useAppStore.setState;
  const get = useAppStore.getState;

  return {
    onThinkingDelta: (delta: string) => {
      set((s) =>
        withConvo(s as AppState, cid, (c) =>
          patchMessage(c, messageId, (m) => ({ thinking: (m.thinking ?? '') + delta })),
        ),
      );
    },
    onTextDelta: (delta: string) => {
      set((s) =>
        withConvo(s as AppState, cid, (c) =>
          patchMessage(c, messageId, (m) => {
            const rawText = m.rawText + delta;
            return { rawText, parts: [{ type: 'para' as const, text: rawText }] };
          }),
        ),
      );
    },
    onToolCall: (info: { id: string; name: string; input: string }) => {
      set((s) => withConvo(s as AppState, cid, (c) => patchMessage(c, messageId, (m) => upsertTool(m, info))));
    },
    onToolResult: (info: { id: string; output: string; isError?: boolean }) => {
      set((s) => withConvo(s as AppState, cid, (c) => patchMessage(c, messageId, (m) => resolveTool(m, info))));
    },
    onImageRequested: async (prompt: string): Promise<ImageToolResult> => {
      try {
        const { dataUrl, revisedPrompt } = await generateImage({ apiKey: get().imageApiKey, prompt, signal });
        set((s) => ({
          ...withConvo(s as AppState, cid, (c) =>
            patchMessage(c, messageId, (m) => ({ imageGen: [...(m.imageGen ?? []), { src: dataUrl, label: prompt }] })),
          ),
          galleryItems: [
            { id: makeId('g'), label: prompt, kind: 'Generated' as const, src: dataUrl, createdAt: Date.now() },
            ...(s as AppState).galleryItems,
          ],
        }));
        return { ok: true, dataUrl, note: revisedPrompt };
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return { ok: false, error: 'Cancelled by the user.' };
        }
        return { ok: false, error: err instanceof ImageGenError || err instanceof Error ? err.message : String(err) };
      }
    },
    onError: (message: string) => {
      set((s) => withConvo(s as AppState, cid, (c) => patchMessage(c, messageId, { error: message })));
    },
  };
}

/**
 * Bridges the party engine to the store. Registered once, at module load — the
 * engine never imports the store, so there is no cycle.
 */
const host: PartyHost = {
  createSpeakerMessage(character) {
    const id = makeId('a');
    const cid = useAppStore.getState().activeConvoId;
    useAppStore.setState((s) =>
      withConvo(s as AppState, cid, (c) =>
        appendMessage(c, {
          id,
          role: 'assistant',
          displayName: character.name,
          personaId: character.id,
          nameColor: character.color,
          time: nowTime(),
          attachments: [],
          rawText: '',
          parts: [],
          streaming: true,
        }),
      ),
    );
    return id;
  },

  async streamTurn({ messageId, character, systemPrompt, prompt, signal }) {
    const s = useAppStore.getState();
    const cid = s.activeConvoId;
    const model = MODELS.find((m) => m.id === s.selectedModelId) ?? MODELS[0];

    // A character may only use the tools it was granted, and only those the app
    // has switched on globally.
    const tools: ToolsEnabled = {
      web: s.toolsEnabled.web && character.allowedTools.includes('web'),
      code: s.toolsEnabled.code && character.allowedTools.includes('code'),
      image: s.toolsEnabled.image && character.allowedTools.includes('image'),
      files: s.toolsEnabled.files && character.allowedTools.includes('files'),
    };

    await streamAssistantTurn({
      apiKey: s.apiKey,
      model,
      systemPrompt,
      thinkingEnabled: true,
      tools,
      imageToolAvailable: Boolean(s.imageApiKey),
      history: [{ role: 'user', text: prompt }],
      signal,
      callbacks: streamCallbacks(cid, messageId, signal),
    });

    const message = useAppStore.getState().conversations[cid]?.messages.find((m) => m.id === messageId);
    return message?.rawText ?? '';
  },

  finalizeMessage(messageId) {
    const cid = useAppStore.getState().activeConvoId;
    useAppStore.setState((s) =>
      withConvo(s as AppState, cid, (c) =>
        patchMessage(c, messageId, (m) => ({
          streaming: false,
          parts: m.rawText ? parseBlocks(m.rawText) : m.parts,
        })),
      ),
    );
  },

  discardMessage(messageId) {
    const cid = useAppStore.getState().activeConvoId;
    useAppStore.setState((s) => withConvo(s as AppState, cid, (c) => dropMessage(c, messageId)));
  },

  recordUserBubble(text) {
    const cid = useAppStore.getState().activeConvoId;
    useAppStore.setState((s) =>
      withConvo(s as AppState, cid, (c) =>
        appendMessage(c, {
          id: makeId('u'),
          role: 'user',
          displayName: 'You',
          time: nowTime(),
          attachments: [],
          parts: [{ type: 'para', text }],
          rawText: text,
        }),
      ),
    );
  },

  readTranscript(): TranscriptLine[] {
    const s = useAppStore.getState();
    const convo = s.conversations[s.activeConvoId];
    if (!convo) return [];
    return convo.messages
      .filter((m) => !m.error && !m.streaming)
      .map((m) => ({ role: m.role, name: m.displayName, text: messageText(m) }));
  },

  async complete(prompt, signal) {
    const s = useAppStore.getState();
    const model = MODELS.find((m) => m.id === s.selectedModelId) ?? MODELS[0];
    return completeOnce({ apiKey: s.apiKey, model, prompt, signal });
  },

  setStatus(status, config) {
    useAppStore.setState({ partyStatus: status, activeParty: config });
  },

  onError(message) {
    const s = useAppStore.getState();
    const cid = s.activeConvoId;
    useAppStore.setState((st) =>
      withConvo(st as AppState, cid, (c) =>
        appendMessage(c, {
          id: makeId('a'),
          role: 'assistant',
          displayName: 'Darkwords',
          time: nowTime(),
          attachments: [],
          rawText: '',
          parts: [{ type: 'para', text: message }],
          error: message,
        }),
      ),
    );
  },
};

partyEngine.setHost(host);
