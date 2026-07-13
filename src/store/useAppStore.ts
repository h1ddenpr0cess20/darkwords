import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { idbStorage } from '../lib/idbStorage';
import type {
  Attachment,
  ChatMessage,
  Conversation,
  Effort,
  GalleryItem,
  McpServer,
  Memory,
  ModelDef,
  ModelId,
  PanelId,
  PromptMode,
  MessageVariant,
  SettingsTab,
  Skill,
  ThemeId,
  ToolsEnabled,
} from '../types';
import { MODELS } from '../lib/config';
import { makeId } from '../lib/id';
import { parseBlocks, partsToPlainText } from '../lib/blocks';
import { completeOnce, streamAssistantTurn, type ApiMessage } from '../lib/anthropic';
import { buildSystemPrompt, DEFAULT_PERSONALITY_NAME } from '../lib/prompt';
import type { ClientTool } from '../lib/tools/types';
import { imageTool } from '../lib/tools/image';
import { memoryContext, memoryTools } from '../lib/tools/memory';
import { parseSkill, skillsContext, skillTool } from '../lib/tools/skills';
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

  promptMode: PromptMode;
  personalityName: string;
  customPrompt: string;
  verbose: boolean;

  effort: Effort;

  memoryEnabled: boolean;
  memoryLimit: number;
  memories: Memory[];

  skills: Skill[];
  mcpServers: McpServer[];

  partyDraft: PartyConfig;
  partyStatus: PartyStatus;
  activeParty: PartyConfig | null;

  input: string;
  pendingUploads: Attachment[];
  galleryItems: GalleryItem[];

  /** The image currently open full-size, if any. */
  lightbox: { src: string; label: string } | null;

  isSending: boolean;

  setInput: (text: string) => void;
  addUpload: (att: Attachment) => void;
  removeUpload: (id: string) => void;

  openSettings: () => void;
  openHistory: () => void;
  openGallery: () => void;
  openLightbox: (image: { src: string; label: string }) => void;
  closeLightbox: () => void;
  closePanel: () => void;
  setPanelTab: (tab: SettingsTab) => void;

  toggleModelPicker: () => void;
  selectModel: (id: ModelId) => void;
  setTheme: (id: ThemeId) => void;
  toggleTool: (key: keyof ToolsEnabled) => void;
  setApiKey: (key: string) => void;
  setImageApiKey: (key: string) => void;

  setEffort: (effort: Effort) => void;

  toggleMemory: () => void;
  setMemoryLimit: (limit: number) => void;
  addMemory: (text: string) => void;
  removeMemory: (id: string) => void;
  clearMemories: () => void;

  importSkill: (fileName: string, source: string) => void;
  toggleSkill: (id: string) => void;
  removeSkill: (id: string) => void;

  addMcpServer: (server: Omit<McpServer, 'id' | 'enabled'>) => void;
  toggleMcpServer: (id: string) => void;
  removeMcpServer: (id: string) => void;

  exportData: () => string;
  importData: (json: string) => boolean;
  clearAllData: () => void;

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

  regenerateMessage: (msgId: string) => Promise<void>;
  branchFrom: (msgId: string) => void;
  selectVariant: (msgId: string, index: number) => void;

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
  const target = existing.find((t) => t.id === info.id) ?? [...existing].reverse().find((t) => t.output === undefined);
  if (!target) return {};
  return {
    tools: existing.map((t) => (t.id === target.id ? { ...t, output: info.output, isError: info.isError } : t)),
  };
}

const firstConversation = emptyConversation();

let activeController: AbortController | null = null;

/**
 * Tears down a running party and returns the state patch that goes with it.
 *
 * The engine writes each line into whatever conversation is active at the moment
 * it writes, so a party only holds together while its own conversation stays
 * open. Anything that changes the active conversation ends the party instead of
 * letting its dialogue spill into an unrelated chat.
 */
function endRunningParty(): Partial<AppState> {
  if (useAppStore.getState().partyStatus === 'off') return {};
  partyEngine.reset();
  return { promptMode: 'personality' };
}

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

      effort: 'medium',
      memoryEnabled: false,
      memoryLimit: 25,
      memories: [],
      skills: [],
      mcpServers: [],

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
      lightbox: null,

      isSending: false,

      setInput: (text) => set({ input: text }),
      addUpload: (att) => set((s) => ({ pendingUploads: [...s.pendingUploads, att] })),
      removeUpload: (id) => set((s) => ({ pendingUploads: s.pendingUploads.filter((u) => u.id !== id) })),

      openSettings: () => set({ activePanel: 'settings', panelTab: 'model' }),
      openHistory: () => set({ activePanel: 'history' }),
      openGallery: () => set({ activePanel: 'gallery' }),
      openLightbox: (image) => set({ lightbox: image }),
      closeLightbox: () => set({ lightbox: null }),
      closePanel: () => set({ activePanel: null, modelPickerOpen: false }),
      setPanelTab: (tab) => set({ panelTab: tab }),

      toggleModelPicker: () => set((s) => ({ modelPickerOpen: !s.modelPickerOpen })),
      selectModel: (id) => set({ selectedModelId: id, modelPickerOpen: false }),
      setTheme: (id) => set({ themeId: id }),
      toggleTool: (key) => set((s) => ({ toolsEnabled: { ...s.toolsEnabled, [key]: !s.toolsEnabled[key] } })),
      setApiKey: (key) => set({ apiKey: key.trim() }),
      setImageApiKey: (key) => set({ imageApiKey: key.trim() }),

      setEffort: (effort) => set({ effort }),

      toggleMemory: () => set((s) => ({ memoryEnabled: !s.memoryEnabled })),
      setMemoryLimit: (limit) =>
        set((s) => {
          const next = Math.max(1, Math.floor(limit) || 1);
          return { memoryLimit: next, memories: s.memories.slice(-next) };
        }),
      addMemory: (text) =>
        set((s) => {
          const trimmed = text.trim();
          if (!trimmed) return {};
          const memories = [...s.memories, { id: makeId('mem'), text: trimmed, createdAt: Date.now() }];
          return { memories: memories.slice(-s.memoryLimit) };
        }),
      removeMemory: (id) => set((s) => ({ memories: s.memories.filter((m) => m.id !== id) })),
      clearMemories: () => set({ memories: [] }),

      importSkill: (fileName, source) =>
        set((s) => {
          const parsed = parseSkill(fileName, source);
          if (!parsed.content) return {};
          const others = s.skills.filter((sk) => sk.name.toLowerCase() !== parsed.name.toLowerCase());
          return { skills: [...others, { id: makeId('skill'), ...parsed, enabled: true }] };
        }),
      toggleSkill: (id) =>
        set((s) => ({ skills: s.skills.map((sk) => (sk.id === id ? { ...sk, enabled: !sk.enabled } : sk)) })),
      removeSkill: (id) => set((s) => ({ skills: s.skills.filter((sk) => sk.id !== id) })),

      addMcpServer: (server) =>
        set((s) => {
          const name = server.name.trim();
          const url = server.url.trim();
          if (!name || !url) return {};
          const others = s.mcpServers.filter((m) => m.name !== name);
          return {
            mcpServers: [
              ...others,
              { id: makeId('mcp'), name, url, authToken: server.authToken?.trim() || undefined, enabled: true },
            ],
          };
        }),
      toggleMcpServer: (id) =>
        set((s) => ({ mcpServers: s.mcpServers.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)) })),
      removeMcpServer: (id) => set((s) => ({ mcpServers: s.mcpServers.filter((m) => m.id !== id) })),

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

      newConversation: () => {
        const party = endRunningParty();
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
        const party = endRunningParty();
        set({ ...party, activeConvoId: id, activePanel: null });
      },

      deleteConversation: (id) => {
        const party = get().activeConvoId === id ? endRunningParty() : {};
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

      stopStreaming: () => {
        if (get().activeParty) {
          partyEngine.stop();
          return;
        }
        activeController?.abort();
        activeController = null;
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

      regenerateMessage: async (msgId) => {
        const s = get();
        if (s.isSending || s.activeParty) return;

        const cid = s.activeConvoId;
        const convo = s.conversations[cid];
        const index = convo?.messages.findIndex((m) => m.id === msgId) ?? -1;
        const target = index >= 0 ? convo.messages[index] : undefined;
        if (!target || target.role !== 'assistant') return;

        const model = MODELS.find((m) => m.id === s.selectedModelId) ?? MODELS[0];
        if (!s.apiKey) return;

        const snapshot: MessageVariant = {
          rawText: target.rawText,
          parts: target.parts,
          thinking: target.thinking,
          tools: target.tools,
          imageGen: target.imageGen,
        };

        set((st) =>
          withConvo(st, cid, (c) =>
            patchMessage(c, msgId, (m) => ({
              variants: m.variants?.length ? m.variants : [snapshot],
              rawText: '',
              parts: [],
              thinking: undefined,
              tools: undefined,
              imageGen: undefined,
              error: undefined,
              streaming: true,
            })),
          ),
        );

        const history: ApiMessage[] = convo.messages
          .slice(0, index)
          .filter((m) => !m.error)
          .map((m) => ({ role: m.role, text: messageText(m), attachments: m.attachments }));

        const controller = new AbortController();
        activeController = controller;
        set({ isSending: true });

        try {
          const s0 = get();
          await streamAssistantTurn({
            apiKey: s0.apiKey,
            model,
            systemPrompt: composeSystemPrompt(s0),
            thinkingEnabled: true,
            effort: s0.effort,
            tools: s0.toolsEnabled,
            clientTools: buildClientTools(s0, cid, msgId),
            mcpServers: s0.mcpServers,
            history,
            signal: controller.signal,
            callbacks: streamCallbacks(cid, msgId),
          });
        } catch (err) {
          const text = err instanceof Error ? err.message : String(err);
          set((st) => withConvo(st, cid, (c) => patchMessage(c, msgId, (m) => ({ error: m.error ?? text }))));
        } finally {
          if (activeController === controller) activeController = null;
          set({ isSending: false });

          set((st) =>
            withConvo(st, cid, (c) =>
              patchMessage(c, msgId, (m) => {
                const parts = m.rawText ? parseBlocks(m.rawText) : m.parts;
                const fresh: MessageVariant = {
                  rawText: m.rawText,
                  parts,
                  thinking: m.thinking,
                  tools: m.tools,
                  imageGen: m.imageGen,
                };
                const variants = [...(m.variants ?? []), fresh];
                return { streaming: false, parts, variants, variantIndex: variants.length - 1 };
              }),
            ),
          );
        }
      },

      sendMessage: async () => {
        const state = get();
        const text = state.input.trim();
        if ((!text && state.pendingUploads.length === 0) || state.isSending) return;

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
                displayName: 'AI',
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
                displayName: 'AI',
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

          try {
            await streamAssistantTurn({
              apiKey: s0.apiKey,
              model: mdl,
              systemPrompt: composeSystemPrompt(s0),
              thinkingEnabled: true,
              effort: s0.effort,
              tools: s0.toolsEnabled,
              clientTools: buildClientTools(s0, cid, assistantId),
              mcpServers: s0.mcpServers,
              history,
              signal,
              callbacks: streamCallbacks(cid, assistantId),
            });
          } catch (err) {
            const text = err instanceof Error ? err.message : String(err);
            set((s) =>
              withConvo(s, cid, (c) => patchMessage(c, assistantId, (m) => ({ error: m.error ?? text }))),
            );
          } finally {
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
        }
      },
    }),
    {
      name: 'darkwords-store',
      version: 3,
      storage: createJSONStorage(() => idbStorage),
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
        effort: s.effort,
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
        return state;
      },
    },
  ),
);

/**
 * The system prompt plus everything that hangs off it — stored memories and the
 * catalogue of available skills.
 */
function composeSystemPrompt(s: AppState): string {
  const base = buildSystemPrompt({
    mode: s.promptMode,
    personalityName: s.personalityName,
    customPrompt: s.customPrompt,
    verbose: s.verbose,
  });
  const memories = s.memoryEnabled ? memoryContext(s.memories) : '';
  return `${base}${memories}${skillsContext(s.skills)}`;
}

/**
 * The tools Darkwords runs itself for a turn. `allow` narrows them to what a
 * party character was granted; ordinary chat allows everything switched on.
 */
function buildClientTools(
  s: AppState,
  cid: string,
  messageId: string,
  allow: { image: boolean } = { image: true },
): ClientTool[] {
  const tools: ClientTool[] = [];

  if (s.toolsEnabled.image && s.imageApiKey && allow.image) {
    tools.push(
      imageTool({
        apiKey: s.imageApiKey,
        onImage: (prompt, dataUrl) => {
          useAppStore.setState((st) => ({
            ...withConvo(st as AppState, cid, (c) =>
              patchMessage(c, messageId, (m) => ({
                imageGen: [...(m.imageGen ?? []), { src: dataUrl, label: prompt }],
              })),
            ),
            galleryItems: [
              { id: makeId('g'), label: prompt, kind: 'Generated' as const, src: dataUrl, createdAt: Date.now() },
              ...(st as AppState).galleryItems,
            ],
          }));
        },
      }),
    );
  }

  if (s.memoryEnabled) {
    tools.push(
      ...memoryTools({
        add: (text) => {
          useAppStore.getState().addMemory(text);
          return { ok: true, total: useAppStore.getState().memories.length };
        },
        forget: (keyword) => {
          const needle = keyword.toLowerCase();
          const matches = useAppStore.getState().memories.filter((m) => m.text.toLowerCase().includes(needle));
          for (const m of matches) useAppStore.getState().removeMemory(m.id);
          return { ok: true, removed: matches.map((m) => m.text) };
        },
        list: () => useAppStore.getState().memories,
      }),
    );
  }

  const skills = skillTool(s.skills);
  if (skills) tools.push(skills);

  return tools;
}

/**
 * Streaming callbacks shared by ordinary chat and party turns — both stream into
 * a message bubble and record tool calls and generated images the same way.
 */
function streamCallbacks(cid: string, messageId: string) {
  const set = useAppStore.setState;

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
      effort: s.effort,
      tools,
      clientTools: buildClientTools(s, cid, messageId, { image: tools.image }),
      mcpServers: s.mcpServers,
      history: [{ role: 'user', text: prompt }],
      signal,
      callbacks: streamCallbacks(cid, messageId),
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
