import type { ToolsEnabled } from '../types';
import { makeId } from '../lib/id';
import { parseBlocks } from '../lib/blocks';
import { completeOnce, streamAssistantTurn } from '../lib/anthropic';
import { partyEngine, type PartyHost, type TranscriptLine } from '../lib/party/engine';
import { appendMessage, dropMessage, messageText, nowTime, patchMessage, withConvo } from './helpers';
import { activeModel, apiTarget, effectiveMcpServers, effectiveTools, gatherClientTools, streamCallbacks } from './chatSupport';
import { useAppStore } from './useAppStore';

/**
 * Bridges the party engine to the store. Registered once, at module load — the
 * engine never imports the store, so there is no cycle.
 */
const host: PartyHost = {
  createSpeakerMessage(character) {
    const id = makeId('a');
    const cid = useAppStore.getState().activeConvoId;
    useAppStore.setState((s) =>
      withConvo(s, cid, (c) =>
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

  /**
   * Streams one character turn through the ordinary chat pipeline.
   * `streamAssistantTurn` reports API failures via callback rather than
   * throwing, so a turn that errored without producing text is re-thrown here —
   * otherwise the party would loop silently against a dead backend.
   */
  async streamTurn({ messageId, character, systemPrompt, prompt, signal }) {
    const s = useAppStore.getState();
    const cid = s.activeConvoId;
    const model = activeModel(s);
    const enabled = effectiveTools(s);

    const tools: ToolsEnabled = {
      web: enabled.web && character.allowedTools.includes('web'),
      code: enabled.code && character.allowedTools.includes('code'),
      image: enabled.image && character.allowedTools.includes('image'),
      files: enabled.files && character.allowedTools.includes('files'),
    };

    await streamAssistantTurn({
      ...apiTarget(s),
      model,
      systemPrompt,
      thinkingEnabled: true,
      effort: s.effort,
      tools,
      clientTools: await gatherClientTools(s, cid, messageId, { image: tools.image }, signal),
      mcpServers: effectiveMcpServers(s),
      history: [{ role: 'user', text: prompt }],
      signal,
      callbacks: streamCallbacks(cid, messageId),
    });

    const message = useAppStore.getState().conversations[cid]?.messages.find((m) => m.id === messageId);
    if (message?.error && !message.rawText) throw new Error(message.error);
    return message?.rawText ?? '';
  },

  finalizeMessage(messageId) {
    const cid = useAppStore.getState().activeConvoId;
    useAppStore.setState((s) =>
      withConvo(s, cid, (c) =>
        patchMessage(c, messageId, (m) => ({
          streaming: false,
          parts: m.rawText ? parseBlocks(m.rawText) : m.parts,
        })),
      ),
    );
  },

  discardMessage(messageId) {
    const cid = useAppStore.getState().activeConvoId;
    useAppStore.setState((s) => withConvo(s, cid, (c) => dropMessage(c, messageId)));
  },

  recordUserBubble(text) {
    const cid = useAppStore.getState().activeConvoId;
    useAppStore.setState((s) =>
      withConvo(s, cid, (c) =>
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
    return completeOnce({ ...apiTarget(s), model: activeModel(s), prompt, signal });
  },

  setStatus(status, config) {
    useAppStore.setState({ partyStatus: status, activeParty: config });
  },

  onError(message) {
    const s = useAppStore.getState();
    const cid = s.activeConvoId;
    useAppStore.setState((st) =>
      withConvo(st, cid, (c) =>
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
