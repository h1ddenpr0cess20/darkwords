import Anthropic from '@anthropic-ai/sdk';
import type { Effort, McpServer, ModelDef, ToolsEnabled } from '../../types';
import type { ClientTool } from '../tools/types';
import { toApiContent, type ApiMessage, type ContentBlockParam } from './content';
import { buildTools, buildToolInstructions, summarizeServerToolResult } from './toolConfig';

export type { ApiMessage } from './content';

export interface StreamCallbacks {
  onThinkingDelta?: (delta: string) => void;
  onTextDelta?: (delta: string) => void;
  onToolCall?: (info: { id: string; name: string; input: string }) => void;
  onToolResult?: (info: { id: string; output: string; isError?: boolean }) => void;
  onError?: (message: string) => void;
}

/** Guards against a model that keeps calling tools without ever answering. */
const MAX_TOOL_ROUNDTRIPS = 8;

/** Beta required for Anthropic's MCP connector. */
const MCP_BETA = 'mcp-client-2025-11-20';

/**
 * One-shot, non-streaming completion with no tools and no thinking. Used for the
 * party engine's speaker-decision request, where we want a short, cheap answer.
 */
export async function completeOnce(opts: {
  apiKey: string;
  /** Point at an Anthropic-compatible server (LM Studio) instead of api.anthropic.com. */
  baseURL?: string;
  model: ModelDef;
  prompt: string;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<string> {
  const { apiKey, baseURL, model, prompt, maxTokens = 256, signal } = opts;
  const client = new Anthropic({ apiKey: apiKey || 'none', baseURL, dangerouslyAllowBrowser: true });

  const response = await client.messages.create(
    {
      model: model.apiModel,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
      ...(model.supportsThinking && !baseURL ? { thinking: { type: 'disabled' as const } } : {}),
    },
    { signal },
  );

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

/**
 * Splits a text stream on `<think>…</think>` spans, routing their contents to
 * the thinking callback. Local reasoning models (LM Studio) emit reasoning
 * inline in the text rather than as Anthropic thinking blocks; Anthropic
 * itself never emits the tags, so passing all text through is harmless. A
 * possible partial tag at a delta boundary is held back until the next delta.
 */
function makeThinkTagDemux(onText: (delta: string) => void, onThinking: (delta: string) => void) {
  let buffer = '';
  let inThink = false;

  const process = (flush: boolean) => {
    while (buffer) {
      const tag = inThink ? '</think>' : '<think>';
      const idx = buffer.indexOf(tag);
      if (idx >= 0) {
        const before = buffer.slice(0, idx);
        if (before) (inThink ? onThinking : onText)(before);
        buffer = buffer.slice(idx + tag.length);
        inThink = !inThink;
        continue;
      }
      let keep = 0;
      if (!flush) {
        for (let k = Math.min(tag.length - 1, buffer.length); k > 0; k--) {
          if (tag.startsWith(buffer.slice(-k))) {
            keep = k;
            break;
          }
        }
      }
      const emit = keep ? buffer.slice(0, -keep) : buffer;
      if (emit) (inThink ? onThinking : onText)(emit);
      buffer = keep ? buffer.slice(-keep) : '';
      break;
    }
  };

  return {
    push(delta: string) {
      buffer += delta;
      process(false);
    },
    flush() {
      process(true);
    },
  };
}

/**
 * Runs one batch of client-side tool calls and reports each through the
 * callbacks. Returns the tool_result blocks, or null if the turn was aborted.
 */
async function runClientTools(
  calls: Anthropic.Beta.BetaToolUseBlock[],
  byName: Map<string, ClientTool>,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<ContentBlockParam[] | null> {
  const results: ContentBlockParam[] = [];

  for (const call of calls) {
    const tool = byName.get(call.name)!;
    const input = (call.input ?? {}) as Record<string, unknown>;

    callbacks.onToolCall?.({ id: call.id, name: call.name, input: JSON.stringify(input) });

    let output: string;
    let isError = false;
    try {
      output = await tool.run(input, signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return null;
      isError = true;
      output = `Error: ${err instanceof Error ? err.message : String(err)}`;
    }

    callbacks.onToolResult?.({
      id: call.id,
      output: isError ? output : (tool.summarize?.(input, output) ?? 'done'),
      isError,
    });

    results.push({
      type: 'tool_result',
      tool_use_id: call.id,
      ...(isError ? { is_error: true } : {}),
      content: [{ type: 'text', text: output }],
    });
  }

  return results;
}

export async function streamAssistantTurn(opts: {
  apiKey: string;
  /** Point at an Anthropic-compatible server (LM Studio) instead of api.anthropic.com. */
  baseURL?: string;
  model: ModelDef;
  systemPrompt: string;
  thinkingEnabled: boolean;
  effort: Effort;
  tools: ToolsEnabled;
  /** Tools Darkwords runs itself, in the browser. */
  clientTools: ClientTool[];
  mcpServers: McpServer[];
  history: ApiMessage[];
  callbacks: StreamCallbacks;
  signal?: AbortSignal;
}): Promise<void> {
  const {
    apiKey,
    baseURL,
    model,
    systemPrompt,
    thinkingEnabled,
    effort,
    tools,
    clientTools,
    mcpServers,
    history,
    callbacks,
    signal,
  } = opts;

  const client = new Anthropic({ apiKey: apiKey || 'none', baseURL, dangerouslyAllowBrowser: true });

  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({
    role: m.role,
    content: toApiContent(m, tools.files),
  }));

  const activeMcp = mcpServers.filter((s) => s.enabled);
  const toolDefs = buildTools(tools, model, clientTools, mcpServers);
  const useThinking = thinkingEnabled && model.supportsThinking;
  const system = `${systemPrompt}${buildToolInstructions(toolDefs)}`;
  const byName = new Map(clientTools.map((t) => [t.name, t]));

  let wroteText = false;
  let breakPending = false;

  const emitText = (delta: string) => {
    if (breakPending) {
      callbacks.onTextDelta?.('\n\n');
      breakPending = false;
    }
    wroteText = true;
    callbacks.onTextDelta?.(delta);
  };

  for (let round = 0; round < MAX_TOOL_ROUNDTRIPS; round++) {
    const params: Anthropic.Beta.MessageCreateParamsStreaming = {
      model: model.apiModel,
      max_tokens: model.maxTokens,
      system,
      messages,
      stream: true,
      ...(toolDefs.length ? { tools: toolDefs } : {}),
      ...(activeMcp.length
        ? {
            betas: [MCP_BETA],
            mcp_servers: activeMcp.map((s) => ({
              type: 'url' as const,
              name: s.name,
              url: s.url,
              ...(s.authToken ? { authorization_token: s.authToken } : {}),
            })),
          }
        : {}),
      ...(useThinking
        ? baseURL
          ? { thinking: { type: 'enabled' as const, budget_tokens: Math.floor(model.maxTokens / 2) } }
          : {
              thinking: { type: 'adaptive' as const, display: 'summarized' as const },
              output_config: { effort },
            }
        : {}),
    };

    const stream = client.beta.messages.stream(params, { signal });
    const demux = makeThinkTagDemux(emitText, (delta) => callbacks.onThinkingDelta?.(delta));

    stream.on('thinking', (delta) => callbacks.onThinkingDelta?.(delta));
    stream.on('text', (delta) => demux.push(delta));
    stream.on('contentBlock', (block) => {
      if (block.type === 'server_tool_use' || block.type === 'mcp_tool_use') {
        callbacks.onToolCall?.({
          id: block.id,
          name: block.name,
          input: JSON.stringify(block.input ?? {}),
        });
      } else if (block.type.endsWith('_tool_result')) {
        const { output, isError } = summarizeServerToolResult(block);
        const id = (block as { tool_use_id?: string }).tool_use_id ?? '';
        callbacks.onToolResult?.({ id, output, isError });
      } else {
        return;
      }

      if (wroteText) breakPending = true;
    });

    let finalMessage: Anthropic.Beta.BetaMessage;
    try {
      finalMessage = await stream.finalMessage();
      demux.flush();
    } catch (err) {
      demux.flush();
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof Anthropic.APIError) {
        callbacks.onError?.(`${err.status ?? ''} ${err.message}`.trim());
      } else {
        callbacks.onError?.(err instanceof Error ? err.message : String(err));
      }
      return;
    }

    if (finalMessage.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: finalMessage.content });
      if (wroteText) breakPending = true;
      continue;
    }

    if (finalMessage.stop_reason !== 'tool_use') return;

    const calls = finalMessage.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use' && byName.has(b.name),
    );

    if (!calls.length) return;

    messages.push({ role: 'assistant', content: finalMessage.content });

    const results = await runClientTools(calls, byName, callbacks, signal);
    if (results === null) return;

    messages.push({ role: 'user', content: results });
    if (wroteText) breakPending = true;
  }

  callbacks.onError?.(`Stopped after ${MAX_TOOL_ROUNDTRIPS} tool rounds without a final answer.`);
}
