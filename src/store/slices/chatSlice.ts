import type { ChatMessage, GalleryItem, ModelDef } from '../../types';
import { makeId } from '../../lib/id';
import { parseBlocks } from '../../lib/blocks';
import { streamAssistantTurn, type ApiMessage } from '../../lib/anthropic';
import { partyEngine } from '../../lib/party/engine';
import { partyOwnsInput } from './partySlice';
import type { MessageVariant } from '../../types';
import { appendMessage, messageText, nowTime, patchMessage, withConvo } from '../helpers';
import {
  activeModel,
  apiTarget,
  composeSystemPrompt,
  effectiveMcpServers,
  effectiveTools,
  gatherClientTools,
  prepareLocalDocContext,
  streamCallbacks,
} from '../chatSupport';
import type { SliceCreator } from '../types';

/** Appends the retrieved-documents block to the last user turn in `history`. */
function appendContextToHistory(history: ApiMessage[], context: string): void {
  if (!context) return;
  const lastUser = [...history].reverse().find((m) => m.role === 'user');
  if (lastUser) lastUser.text = `${lastUser.text}${context}`;
}

/** Sending and streaming: the send pipeline, regeneration, and the stop button. */
export interface ChatSlice {
  isSending: boolean;

  /**
   * Sends the composed input (text + pending uploads) and streams the reply.
   * In party mode the text is handed to the engine as an interjection instead.
   */
  sendMessage: () => Promise<void>;
  /**
   * Re-runs an assistant reply against the history before it. The previous
   * answer is kept as a variant the user can flip back to.
   */
  regenerateMessage: (msgId: string) => Promise<void>;
  /** Aborts the in-flight turn — or stops the party when one is active. */
  stopStreaming: () => void;
}

/** The one in-flight ordinary-chat request; party turns are aborted via the engine. */
let activeController: AbortController | null = null;

export const createChatSlice: SliceCreator<ChatSlice> = (set, get) => ({
  isSending: false,

  stopStreaming: () => {
    if (partyOwnsInput(get())) {
      partyEngine.stop();
      return;
    }
    activeController?.abort();
    activeController = null;
  },

  regenerateMessage: async (msgId) => {
    const s = get();
    if (s.isSending || partyOwnsInput(s)) return;

    const cid = s.activeConvoId;
    const convo = s.conversations[cid];
    const index = convo?.messages.findIndex((m) => m.id === msgId) ?? -1;
    const target = index >= 0 ? convo.messages[index] : undefined;
    if (!target || target.role !== 'assistant') return;

    const model = activeModel(s);
    if (s.provider === 'anthropic' && !s.apiKey) return;

    const snapshot: MessageVariant = {
      rawText: target.rawText,
      parts: target.parts,
      thinking: target.thinking,
      tools: target.tools,
      imageGen: target.imageGen,
      generatedFiles: target.generatedFiles,
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
          generatedFiles: undefined,
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
      const lastUser = [...history].reverse().find((m) => m.role === 'user');
      appendContextToHistory(
        history,
        await prepareLocalDocContext(s0, cid, lastUser?.text ?? '', controller.signal),
      );
      await streamAssistantTurn({
        ...apiTarget(s0),
        model,
        systemPrompt: composeSystemPrompt(s0),
        thinkingEnabled: true,
        effort: s0.effort,
        tools: effectiveTools(s0),
        clientTools: await gatherClientTools(s0, cid, msgId, undefined, controller.signal),
        mcpServers: effectiveMcpServers(s0),
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
              generatedFiles: m.generatedFiles,
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

    if (partyOwnsInput(state)) {
      set({ input: '' });
      partyEngine.queueInterjection(text);
      return;
    }

    const convoId = state.activeConvoId;
    const model = activeModel(state);
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

    if (state.provider === 'anthropic' && !state.apiKey) {
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
              { type: 'para', text: 'No Anthropic API key set. Add one in Settings → Keys to start chatting.' },
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
        appendContextToHistory(history, await prepareLocalDocContext(s0, cid, text, signal));
        await streamAssistantTurn({
          ...apiTarget(s0),
          model: mdl,
          systemPrompt: composeSystemPrompt(s0),
          thinkingEnabled: true,
          effort: s0.effort,
          tools: effectiveTools(s0),
          clientTools: await gatherClientTools(s0, cid, assistantId, undefined, signal),
          mcpServers: effectiveMcpServers(s0),
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
});
