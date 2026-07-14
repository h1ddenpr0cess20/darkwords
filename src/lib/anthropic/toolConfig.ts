import type Anthropic from '@anthropic-ai/sdk';
import type { McpServer, ModelDef, ToolsEnabled } from '../../types';
import type { ClientTool } from '../tools/types';

/**
 * Assembles the request's tool list: Anthropic server tools (web search, code
 * execution) gated by the model's capabilities, the client tools Darkwords
 * runs itself, and an MCP toolset per enabled server. Models with programmatic
 * tool calling get the newer web-search variant only when code execution is
 * off — the two conflict when combined.
 */
export function buildTools(
  tools: ToolsEnabled,
  model: ModelDef,
  clientTools: ClientTool[],
  mcpServers: McpServer[],
): Anthropic.Beta.BetaToolUnion[] {
  const list: Anthropic.Beta.BetaToolUnion[] = [];

  const codeEnabled = tools.code && model.supportsProgrammaticTools;

  if (tools.web) {
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
export function buildToolInstructions(tools: Anthropic.Beta.BetaToolUnion[]): string {
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

/**
 * One-line summary of a server-tool result block for the message margin —
 * result counts for search, exit status for code execution — since the full
 * payload is far too large to display.
 */
export function summarizeServerToolResult(block: Anthropic.Beta.BetaContentBlock): {
  output: string;
  isError: boolean;
} {
  if (block.type === 'web_search_tool_result') {
    const content = block.content;
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
