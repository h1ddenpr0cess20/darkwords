import Anthropic from '@anthropic-ai/sdk';
import type { Attachment, Effort, McpServer, ModelDef, ToolsEnabled } from '../types';
import type { ClientTool } from './tools/types';

export interface ApiMessage {
  role: 'user' | 'assistant';
  text: string;
  attachments?: Attachment[];
}

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

function dataUrlToBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

function base64ToText(base64: string): string | null {
  try {
    const bin = atob(base64);
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x08\x0e-\x1f]/.test(bin)) return null; // looks binary
    return bin;
  } catch {
    return null;
  }
}

type ContentBlockParam = Anthropic.Beta.BetaContentBlockParam;

function attachmentToBlock(att: Attachment): ContentBlockParam {
  // An attachment with no bytes would be rejected as an empty source, so
  // describe it as text rather than sending it.
  if (!att.dataUrl) {
    return { type: 'text', text: `[attached file: ${att.name} — content unavailable]` };
  }
  const base64 = dataUrlToBase64(att.dataUrl);

  if (att.mimeType.startsWith('image/')) {
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: att.mimeType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
        data: base64,
      },
    };
  }
  if (att.mimeType === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };
  }
  const text = base64ToText(base64);
  return text
    ? { type: 'text', text: `--- file: ${att.name} ---\n${text}\n--- end file ---` }
    : { type: 'text', text: `[attached file: ${att.name} — binary format not supported]` };
}

function toApiContent(m: ApiMessage, includeAttachments: boolean): ContentBlockParam[] {
  const blocks: ContentBlockParam[] = [];
  if (includeAttachments) {
    for (const att of m.attachments ?? []) blocks.push(attachmentToBlock(att));
  }
  if (m.text) blocks.push({ type: 'text', text: m.text });
  // The API rejects an empty content array — never emit one.
  if (blocks.length === 0) blocks.push({ type: 'text', text: '(no content)' });
  return blocks;
}

function buildTools(
  tools: ToolsEnabled,
  model: ModelDef,
  clientTools: ClientTool[],
  mcpServers: McpServer[],
): Anthropic.Beta.BetaToolUnion[] {
  const list: Anthropic.Beta.BetaToolUnion[] = [];

  // Code execution is itself the programmatic-tool-calling surface, so a model
  // without PTC can't run it at all.
  const codeEnabled = tools.code && model.supportsProgrammaticTools;

  if (tools.web) {
    // web_search_20260209 filters results dynamically by running code under the
    // hood. Declared next to an explicit code_execution tool, the model sees two
    // execution environments and writes code for things it should just search.
    // It also needs PTC, which Haiku lacks. Both cases fall back to the basic
    // search tool, which has no hidden executor.
    const useBasicSearch = codeEnabled || !model.supportsProgrammaticTools;
    list.push(
      useBasicSearch
        ? { type: 'web_search_20250305', name: 'web_search' }
        : { type: 'web_search_20260209', name: 'web_search' },
    );
  }

  if (codeEnabled) {
    list.push({ type: 'code_execution_20260521', name: 'code_execution' });
  }

  for (const tool of clientTools) {
    list.push({ name: tool.name, description: tool.description, input_schema: tool.input_schema });
  }

  for (const server of mcpServers.filter((s) => s.enabled)) {
    list.push({ type: 'mcp_toolset', mcp_server_name: server.name });
  }

  return list;
}

/**
 * Tells the model what each enabled tool is *for*. Without this it will happily
 * reach for the code interpreter to answer questions it should search for.
 */
function buildToolInstructions(tools: Anthropic.Beta.BetaToolUnion[]): string {
  const has = (name: string) => tools.some((t) => 'name' in t && t.name === name);
  const lines: string[] = [];

  if (has('web_search')) {
    lines.push(
      'Use web_search whenever the answer depends on current information — recent events, prices, releases, documentation, or anything you are unsure about. Search rather than answering from memory, and never write code to fetch web content.',
    );
  }
  if (has('code_execution')) {
    lines.push(
      'Use code_execution only for computation, data analysis, and file processing — never to look things up or retrieve web pages.',
    );
  }
  if (has('generate_image')) {
    lines.push(
      'Use generate_image when the user asks for an image. You cannot see the images it produces, so do not describe their contents afterwards.',
    );
  }

  return lines.length ? `\n\nTool use:\n${lines.map((l) => `- ${l}`).join('\n')}` : '';
}

function summarizeServerToolResult(block: Anthropic.Beta.BetaContentBlock): { output: string; isError: boolean } {
  if (block.type === 'web_search_tool_result') {
    const content = block.content;
    // On success `content` is a list of results; on failure it's an error object.
    if (Array.isArray(content)) {
      if (!content.length) return { output: 'no results', isError: false };
      const first = content[0] as { title?: string };
      const plural = content.length === 1 ? '' : 's';
      return {
        output: `${content.length} result${plural}${first?.title ? ` — “${first.title}”` : ''}`,
        isError: false,
      };
    }
    return { output: `search failed: ${content.error_code}`, isError: true };
  }

  if (block.type === 'bash_code_execution_tool_result' || block.type === 'code_execution_tool_result') {
    const content = block.content as { return_code?: number; error_code?: string };
    if (content?.error_code) return { output: `failed: ${content.error_code}`, isError: true };
    if (content?.return_code && content.return_code !== 0) {
      return { output: `exit ${content.return_code}`, isError: true };
    }
    return { output: 'executed', isError: false };
  }

  if (block.type === 'mcp_tool_result') {
    return { output: block.is_error ? 'mcp call failed' : 'done', isError: Boolean(block.is_error) };
  }

  return { output: 'done', isError: false };
}

/**
 * One-shot, non-streaming completion with no tools and no thinking. Used for the
 * party engine's speaker-decision request, where we want a short, cheap answer.
 */
export async function completeOnce(opts: {
  apiKey: string;
  model: ModelDef;
  prompt: string;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<string> {
  const { apiKey, model, prompt, maxTokens = 256, signal } = opts;
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const response = await client.messages.create(
    {
      model: model.apiModel,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
      ...(model.supportsThinking ? { thinking: { type: 'disabled' as const } } : {}),
    },
    { signal },
  );

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

export async function streamAssistantTurn(opts: {
  apiKey: string;
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

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({
    role: m.role,
    content: toApiContent(m, tools.files),
  }));

  const activeMcp = mcpServers.filter((s) => s.enabled);
  const toolDefs = buildTools(tools, model, clientTools, mcpServers);
  const useThinking = thinkingEnabled && model.supportsThinking;
  const system = `${systemPrompt}${buildToolInstructions(toolDefs)}`;
  const byName = new Map(clientTools.map((t) => [t.name, t]));

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
        ? {
            // Adaptive thinking is the only supported mode on current models;
            // budget_tokens and temperature are rejected. Thinking text is
            // omitted by default, so opt into summaries explicitly.
            thinking: { type: 'adaptive' as const, display: 'summarized' as const },
            output_config: { effort },
          }
        : {}),
    };

    const stream = client.beta.messages.stream(params, { signal });

    stream.on('thinking', (delta) => callbacks.onThinkingDelta?.(delta));
    stream.on('text', (delta) => callbacks.onTextDelta?.(delta));
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
      }
    });

    let finalMessage: Anthropic.Beta.BetaMessage;
    try {
      finalMessage = await stream.finalMessage();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof Anthropic.APIError) {
        callbacks.onError?.(`${err.status ?? ''} ${err.message}`.trim());
      } else {
        callbacks.onError?.(err instanceof Error ? err.message : String(err));
      }
      return;
    }

    // A server-side tool hit its internal iteration cap. Echo the turn back and
    // re-send so the model can resume; otherwise the answer is silently cut off.
    if (finalMessage.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: finalMessage.content });
      continue;
    }

    if (finalMessage.stop_reason !== 'tool_use') return;

    const calls = finalMessage.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use' && byName.has(b.name),
    );

    // A tool_use we can't service would loop forever — bail rather than spin.
    if (!calls.length) return;

    messages.push({ role: 'assistant', content: finalMessage.content });

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
        if (err instanceof DOMException && err.name === 'AbortError') return;
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

    messages.push({ role: 'user', content: results });
  }

  callbacks.onError?.(`Stopped after ${MAX_TOOL_ROUNDTRIPS} tool rounds without a final answer.`);
}
