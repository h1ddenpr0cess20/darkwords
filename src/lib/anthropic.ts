import Anthropic from '@anthropic-ai/sdk';
import type { Attachment, ModelDef, ToolsEnabled } from '../types';

export interface ApiMessage {
  role: 'user' | 'assistant';
  text: string;
  attachments?: Attachment[];
}

/** Outcome of fulfilling a client-side image tool call. */
export type ImageToolResult = { ok: true; dataUrl: string; note?: string } | { ok: false; error: string };

export interface StreamCallbacks {
  onThinkingDelta?: (delta: string) => void;
  onTextDelta?: (delta: string) => void;
  onToolCall?: (info: { id: string; name: string; input: string }) => void;
  onToolResult?: (info: { id: string; output: string; isError?: boolean }) => void;
  /** Fulfils a `generate_image` call against the external image API. */
  onImageRequested?: (prompt: string) => Promise<ImageToolResult>;
  onError?: (message: string) => void;
}

const IMAGE_TOOL_NAME = 'generate_image';
const MAX_TOOL_ROUNDTRIPS = 6;

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

function attachmentToBlock(att: Attachment): ContentBlockParam | null {
  // An attachment with no bytes (e.g. a failed read) would be rejected by the
  // API as an empty source, so describe it as text instead of sending it.
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
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
    };
  }
  const text = base64ToText(base64);
  return text
    ? { type: 'text', text: `--- file: ${att.name} ---\n${text}\n--- end file ---` }
    : { type: 'text', text: `[attached file: ${att.name} — binary format not supported]` };
}

function toApiContent(m: ApiMessage, includeAttachments: boolean): ContentBlockParam[] {
  const blocks: ContentBlockParam[] = [];
  if (includeAttachments) {
    for (const att of m.attachments ?? []) {
      const block = attachmentToBlock(att);
      if (block) blocks.push(block);
    }
  }
  if (m.text) blocks.push({ type: 'text', text: m.text });
  // The API rejects an empty content array — never emit one.
  if (blocks.length === 0) blocks.push({ type: 'text', text: '(no content)' });
  return blocks;
}

function buildTools(
  tools: ToolsEnabled,
  model: ModelDef,
  imageToolAvailable: boolean,
): Anthropic.Beta.BetaToolUnion[] {
  const list: Anthropic.Beta.BetaToolUnion[] = [];

  // Code execution is itself the programmatic-tool-calling surface, so a model
  // without PTC can't run it at all.
  const codeEnabled = tools.code && model.supportsProgrammaticTools;

  if (tools.web) {
    // web_search_20260209 filters results dynamically by running code under the
    // hood. That makes it a poor neighbour: declared next to an explicit
    // code_execution tool the model sees two execution environments and starts
    // writing code for questions it should just search. It also needs PTC, which
    // Haiku lacks. In both cases fall back to the basic search tool, which has
    // no hidden executor.
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
  if (tools.image && imageToolAvailable) {
    list.push({
      name: IMAGE_TOOL_NAME,
      description:
        'Generate an image from a text prompt using an external image model. Use when the user asks for an image, illustration, cover art, or diagram. Write a vivid, self-contained prompt; the image model cannot see the conversation.',
      input_schema: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'A detailed, self-contained description of the image to generate' },
        },
        required: ['prompt'],
      },
    });
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
      'Use the web_search tool whenever the answer depends on current information — recent events, prices, releases, documentation, or anything you are unsure about. Search rather than answering from memory, and never write code to fetch web content.',
    );
  }
  if (has('code_execution')) {
    lines.push(
      'Use the code_execution tool only for computation, data analysis, and file processing — never to look things up or retrieve web pages.',
    );
  }
  if (has(IMAGE_TOOL_NAME)) {
    lines.push(
      'Use the generate_image tool when the user asks for an image. You cannot see the images it produces, so do not describe their contents afterwards.',
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
    const content = block.content as { return_code?: number; error_code?: string; stderr?: string };
    if (content?.error_code) return { output: `failed: ${content.error_code}`, isError: true };
    if (content?.return_code && content.return_code !== 0) {
      return { output: `exit ${content.return_code}`, isError: true };
    }
    return { output: 'executed', isError: false };
  }

  return { output: 'done', isError: false };
}

/**
 * One-shot, non-streaming completion with no tools and no thinking. Used for
 * the party engine's speaker-decision request, where we want a short, cheap
 * answer rather than a conversational turn.
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
      // Thinking would dominate the token budget on what is a one-line answer.
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
  tools: ToolsEnabled;
  /** Whether an image-provider key is configured; gates the image tool. */
  imageToolAvailable: boolean;
  history: ApiMessage[];
  callbacks: StreamCallbacks;
  signal?: AbortSignal;
}): Promise<void> {
  const {
    apiKey,
    model,
    systemPrompt,
    thinkingEnabled,
    tools,
    imageToolAvailable,
    history,
    callbacks,
    signal,
  } = opts;

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({
    role: m.role,
    content: toApiContent(m, tools.files),
  }));

  const toolDefs = buildTools(tools, model, imageToolAvailable);
  const useThinking = thinkingEnabled && model.supportsThinking;
  const system = `${systemPrompt}${buildToolInstructions(toolDefs)}`;

  for (let round = 0; round < MAX_TOOL_ROUNDTRIPS; round++) {
    const params: Anthropic.Beta.MessageCreateParamsStreaming = {
      model: model.apiModel,
      max_tokens: model.maxTokens,
      system,
      messages,
      stream: true,
      ...(toolDefs.length ? { tools: toolDefs } : {}),
      ...(useThinking
        ? {
            // Adaptive thinking is the only supported mode on current models;
            // `budget_tokens` and `temperature` are rejected outright. Thinking
            // text is omitted by default, so opt in to summaries explicitly.
            thinking: { type: 'adaptive' as const, display: 'summarized' as const },
            output_config: { effort: model.effort },
          }
        : {}),
    };

    const stream = client.beta.messages.stream(params, { signal });

    stream.on('thinking', (delta) => callbacks.onThinkingDelta?.(delta));
    stream.on('text', (delta) => callbacks.onTextDelta?.(delta));
    stream.on('contentBlock', (block) => {
      if (block.type === 'server_tool_use') {
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
    // re-send so the model can resume, otherwise the answer is silently cut off.
    if (finalMessage.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: finalMessage.content });
      continue;
    }

    if (finalMessage.stop_reason !== 'tool_use') return;

    const imageCalls = finalMessage.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use' && b.name === IMAGE_TOOL_NAME,
    );

    // `tool_use` with nothing we can service would loop forever — bail out.
    if (imageCalls.length === 0) return;

    messages.push({ role: 'assistant', content: finalMessage.content });

    const resultBlocks: ContentBlockParam[] = [];
    for (const call of imageCalls) {
      const input = call.input as { prompt?: string } | undefined;
      const prompt = input?.prompt ?? '';

      callbacks.onToolCall?.({ id: call.id, name: IMAGE_TOOL_NAME, input: `prompt: “${prompt}”` });

      const result = (await callbacks.onImageRequested?.(prompt)) ?? {
        ok: false as const,
        error: 'Image generation is not available in this client.',
      };

      if (result.ok) {
        callbacks.onToolResult?.({ id: call.id, output: 'image delivered to Gallery' });
        resultBlocks.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: [
            {
              type: 'text',
              text: `Image generated successfully and shown to the user in the Gallery.${
                result.note ? ` The image model revised the prompt to: “${result.note}”.` : ''
              } Do not describe the image as if you can see it; you cannot.`,
            },
          ],
        });
      } else {
        callbacks.onToolResult?.({ id: call.id, output: result.error, isError: true });
        resultBlocks.push({
          type: 'tool_result',
          tool_use_id: call.id,
          is_error: true,
          content: [{ type: 'text', text: `Image generation failed: ${result.error}` }],
        });
      }
    }

    messages.push({ role: 'user', content: resultBlocks });
  }

  callbacks.onError?.(`Stopped after ${MAX_TOOL_ROUNDTRIPS} tool rounds without a final answer.`);
}
