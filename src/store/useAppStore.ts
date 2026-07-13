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
  Persona,
  SettingsTab,
  ThemeId,
  ToolsEnabled,
} from '../types';
import { DEFAULT_PERSONALITY, MODELS, PERSONA_POOL } from '../lib/config';
import { makeId } from '../lib/id';
import { parseBlocks, partsToPlainText } from '../lib/blocks';
import { streamAssistantTurn, type ApiMessage, type ImageToolResult } from '../lib/anthropic';
import { generateImage, ImageGenError } from '../lib/images';

function nowTime(): string {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function messageToApiText(m: ChatMessage): string {
  const text = m.rawText || partsToPlainText(m.parts);
  return m.personaId && m.role === 'assistant' ? `[${m.displayName}] ${text}` : text;
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
  personalityText: string;
  toolsEnabled: ToolsEnabled;
  apiKey: string;
  imageApiKey: string;

  partyMode: boolean;
  activePersonaIds: string[];

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
  closePanel: () => void;
  setPanelTab: (tab: SettingsTab) => void;

  toggleModelPicker: () => void;
  selectModel: (id: ModelId) => void;
  setTheme: (id: ThemeId) => void;
  toggleTool: (key: keyof ToolsEnabled) => void;
  setPersonality: (text: string) => void;
  setApiKey: (key: string) => void;
  setImageApiKey: (key: string) => void;

  togglePartyMode: () => void;
  addPersona: () => void;
  removePersona: (id: string) => void;

  newConversation: () => void;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  toggleThinking: (msgId: string) => void;

  sendMessage: () => Promise<void>;
  stopStreaming: () => void;
}

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
): Conversation {
  return {
    ...c,
    messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m)),
    updatedAt: Date.now(),
  };
}

/** Records a tool call, or updates it in place if we've already seen its id. */
function upsertTool(m: ChatMessage, info: { id: string; name: string; input: string }): Partial<ChatMessage> {
  const existing = m.tools ?? [];
  if (existing.some((t) => t.id === info.id)) {
    return { tools: existing.map((t) => (t.id === info.id ? { ...t, ...info } : t)) };
  }
  return { tools: [...existing, info] };
}

function resolveTool(
  m: ChatMessage,
  info: { id: string; output: string; isError?: boolean },
): Partial<ChatMessage> {
  const existing = m.tools ?? [];
  if (!existing.length) return {};
  // Server tool results carry the id of their tool_use; fall back to the most
  // recent unresolved call when the id isn't echoed back.
  const target = existing.find((t) => t.id === info.id) ?? [...existing].reverse().find((t) => t.output === undefined);
  if (!target) return {};
  return {
    tools: existing.map((t) =>
      t.id === target.id ? { ...t, output: info.output, isError: info.isError } : t,
    ),
  };
}

// A brand-new install starts with one real, empty conversation.
const firstConversation = emptyConversation();

// Module-scoped: an in-flight request isn't app state worth persisting.
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
      personalityText: DEFAULT_PERSONALITY,
      toolsEnabled: { web: true, code: true, files: true, image: false },
      apiKey: '',
      imageApiKey: '',

      partyMode: false,
      activePersonaIds: ['nyx', 'cato'],

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
      closePanel: () => set({ activePanel: null, modelPickerOpen: false }),
      setPanelTab: (tab) => set({ panelTab: tab }),

      toggleModelPicker: () => set((s) => ({ modelPickerOpen: !s.modelPickerOpen })),
      selectModel: (id) => set({ selectedModelId: id, modelPickerOpen: false }),
      setTheme: (id) => set({ themeId: id }),
      toggleTool: (key) => set((s) => ({ toolsEnabled: { ...s.toolsEnabled, [key]: !s.toolsEnabled[key] } })),
      setPersonality: (text) => set({ personalityText: text }),
      setApiKey: (key) => set({ apiKey: key.trim() }),
      setImageApiKey: (key) => set({ imageApiKey: key.trim() }),

      togglePartyMode: () => set((s) => ({ partyMode: !s.partyMode })),
      addPersona: () =>
        set((s) => {
          const next = PERSONA_POOL.find((p) => !s.activePersonaIds.includes(p.id));
          return next ? { activePersonaIds: [...s.activePersonaIds, next.id] } : {};
        }),
      removePersona: (id) => set((s) => ({ activePersonaIds: s.activePersonaIds.filter((x) => x !== id) })),

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

          // Never leave the app without a conversation to show.
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
          withConvo(s, s.activeConvoId, (c) => patchMessage(c, msgId, (m) => ({ thinkingOpen: !m.thinkingOpen }))),
        ),

      stopStreaming: () => {
        activeController?.abort();
        activeController = null;
      },

      sendMessage: async () => {
        const state = get();
        const text = state.input.trim();
        if ((!text && state.pendingUploads.length === 0) || state.isSending) return;

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
          // Uploaded images are real media — they belong in the Gallery.
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
                  {
                    type: 'para',
                    text: 'No Anthropic API key set. Add one in Settings → API Key to start chatting.',
                  },
                ],
                error: 'missing_api_key',
              }),
            ),
          );
          return;
        }

        const personas: (Persona | null)[] =
          state.partyMode && state.activePersonaIds.length
            ? state.activePersonaIds
                .map((id) => PERSONA_POOL.find((p) => p.id === id))
                .filter((p): p is Persona => Boolean(p))
            : [null];

        const controller = new AbortController();
        activeController = controller;
        set({ isSending: true });

        try {
          for (const persona of personas) {
            if (controller.signal.aborted) break;
            await runOneReply(convoId, persona, model, controller.signal);
          }
        } finally {
          if (activeController === controller) activeController = null;
          set({ isSending: false });
        }

        async function runOneReply(cid: string, persona: Persona | null, mdl: ModelDef, signal: AbortSignal) {
          const assistantId = makeId('a');
          const displayName = persona?.name ?? 'Claude';
          set((s) =>
            withConvo(s, cid, (c) =>
              appendMessage(c, {
                id: assistantId,
                role: 'assistant',
                displayName,
                personaId: persona?.id,
                nameColor: persona?.color,
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
            .map((m) => ({ role: m.role, text: messageToApiText(m), attachments: m.attachments }));

          const systemPrompt = persona ? `${s0.personalityText}\n\n${persona.systemPrompt}` : s0.personalityText;

          await streamAssistantTurn({
            apiKey: s0.apiKey,
            model: mdl,
            systemPrompt,
            thinkingEnabled: true,
            tools: s0.toolsEnabled,
            imageToolAvailable: Boolean(s0.imageApiKey),
            history,
            signal,
            callbacks: {
              onThinkingDelta: (delta) => {
                set((s) =>
                  withConvo(s, cid, (c) =>
                    patchMessage(c, assistantId, (m) => ({ thinking: (m.thinking ?? '') + delta })),
                  ),
                );
              },
              onTextDelta: (delta) => {
                set((s) =>
                  withConvo(s, cid, (c) =>
                    patchMessage(c, assistantId, (m) => {
                      const rawText = m.rawText + delta;
                      return { rawText, parts: [{ type: 'para', text: rawText }] };
                    }),
                  ),
                );
              },
              onToolCall: (info) => {
                set((s) => withConvo(s, cid, (c) => patchMessage(c, assistantId, (m) => upsertTool(m, info))));
              },
              onToolResult: (info) => {
                set((s) => withConvo(s, cid, (c) => patchMessage(c, assistantId, (m) => resolveTool(m, info))));
              },
              onImageRequested: async (prompt): Promise<ImageToolResult> => {
                try {
                  const { dataUrl, revisedPrompt } = await generateImage({
                    apiKey: get().imageApiKey,
                    prompt,
                    signal,
                  });
                  set((s) => ({
                    ...withConvo(s, cid, (c) =>
                      patchMessage(c, assistantId, (m) => ({
                        imageGen: [...(m.imageGen ?? []), { src: dataUrl, label: prompt }],
                      })),
                    ),
                    galleryItems: [
                      { id: makeId('g'), label: prompt, kind: 'Generated' as const, src: dataUrl, createdAt: Date.now() },
                      ...s.galleryItems,
                    ],
                  }));
                  return { ok: true, dataUrl, note: revisedPrompt };
                } catch (err) {
                  if (err instanceof DOMException && err.name === 'AbortError') {
                    return { ok: false, error: 'Cancelled by the user.' };
                  }
                  const message =
                    err instanceof ImageGenError || err instanceof Error ? err.message : String(err);
                  return { ok: false, error: message };
                }
              },
              onError: (message) => {
                set((s) => withConvo(s, cid, (c) => patchMessage(c, assistantId, { error: message })));
              },
            },
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
      version: 2,
      partialize: (s) => ({
        conversations: s.conversations,
        conversationOrder: s.conversationOrder,
        activeConvoId: s.activeConvoId,
        selectedModelId: s.selectedModelId,
        themeId: s.themeId,
        personalityText: s.personalityText,
        toolsEnabled: s.toolsEnabled,
        apiKey: s.apiKey,
        imageApiKey: s.imageApiKey,
        partyMode: s.partyMode,
        activePersonaIds: s.activePersonaIds,
        galleryItems: s.galleryItems,
      }),
      // v1 stored mock seed data and hue-based placeholder art; drop it.
      migrate: () => ({
        conversations: { [firstConversation.id]: firstConversation },
        conversationOrder: [firstConversation.id],
        activeConvoId: firstConversation.id,
        galleryItems: [] as GalleryItem[],
      }),
    },
  ),
);
