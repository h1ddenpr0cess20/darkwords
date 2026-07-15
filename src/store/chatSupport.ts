import type { Attachment, McpServer, ModelDef, ToolsEnabled } from '../types';
import { makeId } from '../lib/id';
import { buildSystemPrompt } from '../lib/prompt';
import { locationPromptFragment } from '../lib/location';
import { resolveModel } from '../lib/models';
import { resolveEmbeddingModel } from '../lib/rag/embeddings';
import { buildRetrievedContext, indexAttachments, isIndexableAttachment } from '../lib/rag/retrieval';
import type { ClientTool } from '../lib/tools/types';
import { mcpClientTools } from '../lib/tools/mcpClient';
import { imageTool } from '../lib/tools/image';
import { memoryContext, memoryTools } from '../lib/tools/memory';
import { skillsContext, skillTool } from '../lib/tools/skills';
import { patchMessage, upsertTool, resolveTool, withConvo } from './helpers';
import { useAppStore } from './useAppStore';
import type { AppState } from './types';

/** Where a turn's request goes — LM Studio's Anthropic-compat server or Anthropic. */
export function apiTarget(s: AppState): { apiKey: string; baseURL?: string } {
  return s.provider === 'lmstudio' ? { apiKey: 'lmstudio', baseURL: s.lmStudioUrl } : { apiKey: s.apiKey };
}

/** The model the active provider sends turns with. */
export function activeModel(s: AppState): ModelDef {
  return s.provider === 'lmstudio'
    ? resolveModel('lmstudio', s.lmStudioModelId, s.lmStudioModels)
    : resolveModel('anthropic', s.selectedModelId, s.anthropicModels);
}

/**
 * LM Studio has no Anthropic server tools: web search, the code interpreter,
 * and native file blocks are off; attachments go through local RAG instead.
 */
export function effectiveTools(s: AppState): ToolsEnabled {
  if (s.provider !== 'lmstudio') return s.toolsEnabled;
  return { web: false, code: false, files: false, image: s.toolsEnabled.image };
}

/**
 * MCP servers passed to Anthropic's server-side connector. With LM Studio the
 * connector doesn't exist, so servers are instead contacted from the browser
 * and folded into the client tools (see {@link gatherClientTools}).
 */
export function effectiveMcpServers(s: AppState): McpServer[] {
  return s.provider === 'lmstudio' ? [] : s.mcpServers;
}

/** All tools Darkwords runs itself this turn, including browser-side MCP for LM Studio. */
export async function gatherClientTools(
  s: AppState,
  cid: string,
  messageId: string,
  allow?: { image: boolean },
  signal?: AbortSignal,
): Promise<ClientTool[]> {
  const tools = buildClientTools(s, cid, messageId, allow);
  if (s.provider === 'lmstudio' && s.mcpServers.some((m) => m.enabled)) {
    tools.push(...(await mcpClientTools(s.mcpServers, signal)));
  }
  return tools;
}

/**
 * Local RAG for LM Studio turns: makes sure every document attached to the
 * conversation is extracted/chunked/embedded, then returns the retrieved
 * reference block to append to the outgoing user text ('' when there are no
 * documents). Throws when documents exist but no embedding model is available.
 */
export async function prepareLocalDocContext(
  s: AppState,
  convoId: string,
  query: string,
  signal?: AbortSignal,
): Promise<string> {
  if (s.provider !== 'lmstudio') return '';
  const convo = s.conversations[convoId];
  const docs = (convo?.messages.flatMap((m) => m.attachments) ?? []).filter(isIndexableAttachment);
  if (!docs.length) return '';

  const model = resolveEmbeddingModel(s.embeddingModelId, s.embeddingModels);
  if (!model) {
    throw new Error(
      'No embedding model found. Load one in LM Studio (e.g. text-embedding-nomic-embed-text-v1.5) and refresh models in Settings.',
    );
  }
  const target = { baseUrl: s.lmStudioUrl, model };
  await indexAttachments(convoId, docs, target, signal);
  return buildRetrievedContext(convoId, query, target, signal);
}

/**
 * The system prompt plus everything that hangs off it — stored memories and the
 * catalogue of available skills.
 */
export function composeSystemPrompt(s: AppState): string {
  const base = buildSystemPrompt({
    mode: s.promptMode,
    personalityName: s.personalityName,
    customPrompt: s.customPrompt,
    verbose: s.verbose,
  });
  const memories = s.memoryEnabled ? memoryContext(s.memories) : '';
  const location = locationPromptFragment(s.locationEnabled, s.locationString);
  return `${base}${memories}${skillsContext(s.skills)}${location}`;
}

/**
 * The tools Darkwords runs itself for a turn. `allow` narrows them to what a
 * party character was granted; ordinary chat allows everything switched on.
 */
export function buildClientTools(
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
            ...withConvo(st, cid, (c) =>
              patchMessage(c, messageId, (m) => ({
                imageGen: [...(m.imageGen ?? []), { src: dataUrl, label: prompt }],
              })),
            ),
            galleryItems: [
              { id: makeId('g'), label: prompt, kind: 'Generated' as const, src: dataUrl, createdAt: Date.now() },
              ...st.galleryItems,
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
export function streamCallbacks(cid: string, messageId: string) {
  const set = useAppStore.setState;

  return {
    onThinkingDelta: (delta: string) => {
      set((s) =>
        withConvo(s, cid, (c) =>
          patchMessage(c, messageId, (m) => ({ thinking: (m.thinking ?? '') + delta, reasoning: true })),
        ),
      );
    },
    onTextDelta: (delta: string) => {
      set((s) =>
        withConvo(s, cid, (c) =>
          patchMessage(c, messageId, (m) => {
            const rawText = m.rawText + delta;
            return { rawText, parts: [{ type: 'para' as const, text: rawText }], reasoning: false };
          }),
        ),
      );
    },
    onToolCall: (info: { id: string; name: string; input: string }) => {
      set((s) => withConvo(s, cid, (c) => patchMessage(c, messageId, (m) => upsertTool(m, info))));
    },
    onToolResult: (info: { id: string; output: string; isError?: boolean }) => {
      set((s) => withConvo(s, cid, (c) => patchMessage(c, messageId, (m) => resolveTool(m, info))));
    },
    onFileOutput: (file: Attachment) => {
      set((s) =>
        withConvo(s, cid, (c) =>
          patchMessage(c, messageId, (m) => ({ generatedFiles: [...(m.generatedFiles ?? []), file] })),
        ),
      );
    },
    onError: (message: string) => {
      set((s) => withConvo(s, cid, (c) => patchMessage(c, messageId, { error: message })));
    },
  };
}
