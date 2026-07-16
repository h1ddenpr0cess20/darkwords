/**
 * Browser-side MCP client for LM Studio turns.
 *
 * Anthropic's MCP connector runs on Anthropic's servers, so it can't be used
 * with a local Anthropic-compatible endpoint. LM Studio's /v1/messages does
 * support function tools, so each enabled MCP server is contacted directly
 * from the browser (Streamable HTTP JSON-RPC), its tools are exposed to the
 * model as function tools, and calls are relayed back to the server.
 *
 * Note the server must allow CORS from this origin for the browser to reach it.
 */

import type { McpServer } from '../../types';
import type { ClientTool } from './types';

const PROTOCOL_VERSION = '2025-03-26';
const TOOL_LIST_TTL_MS = 60_000;

interface McpToolInfo {
  name: string;
  description?: string;
  inputSchema?: { type?: string; properties?: Record<string, unknown>; required?: string[] };
}

interface Session {
  sessionId: string | null;
  tools: McpToolInfo[];
  fetchedAt: number;
}

/** Live session + cached tool list per server id. */
const sessions = new Map<string, Session>();

let rpcId = 0;

/** Parses a Streamable HTTP response body — plain JSON or an SSE stream. */
async function parseRpcResponse(res: Response): Promise<Record<string, unknown> | null> {
  const contentType = res.headers.get('content-type') ?? '';
  const body = await res.text();
  if (!body.trim()) return null;
  if (contentType.includes('text/event-stream')) {
    for (const line of body.split('\n')) {
      if (!line.startsWith('data:')) continue;
      try {
        const msg = JSON.parse(line.slice(5).trim()) as Record<string, unknown>;
        if ('result' in msg || 'error' in msg) return msg;
      } catch {}
    }
    return null;
  }
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** One JSON-RPC exchange with a server, threading the MCP session id through. */
async function rpc(
  server: McpServer,
  sessionId: string | null,
  method: string,
  params: Record<string, unknown> | undefined,
  signal?: AbortSignal,
  notification = false,
): Promise<{ result: unknown; sessionId: string | null }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;
  if (server.authToken) headers.Authorization = `Bearer ${server.authToken}`;

  const res = await fetch(server.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      ...(params ? { params } : {}),
      ...(notification ? {} : { id: ++rpcId }),
    }),
    signal,
  });
  const nextSession = res.headers.get('Mcp-Session-Id') ?? sessionId;
  if (!res.ok) throw new Error(`${server.name}: HTTP ${res.status}`);
  if (notification) return { result: null, sessionId: nextSession };

  const msg = await parseRpcResponse(res);
  if (!msg) throw new Error(`${server.name}: empty MCP response`);
  if (msg.error) {
    const err = msg.error as { message?: string };
    throw new Error(`${server.name}: ${err.message ?? 'MCP error'}`);
  }
  return { result: msg.result, sessionId: nextSession };
}

/** Runs the MCP handshake (initialize → initialized) and lists the server's tools. */
async function connect(server: McpServer, signal?: AbortSignal): Promise<Session> {
  const init = await rpc(
    server,
    null,
    'initialize',
    {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'darkwords', version: '0.1.0' },
    },
    signal,
  );
  await rpc(server, init.sessionId, 'notifications/initialized', undefined, signal, true).catch(() => {});
  const list = await rpc(server, init.sessionId, 'tools/list', {}, signal);
  const tools = ((list.result as { tools?: McpToolInfo[] })?.tools ?? []).filter((t) => t.name);
  return { sessionId: list.sessionId, tools, fetchedAt: Date.now() };
}

/**
 * Anthropic tool names must match ^[a-zA-Z0-9_-]{1,64}$. Sanitizing and
 * truncating can make two different tools collide, and the dispatch map is
 * keyed by name — so collisions get a numeric suffix rather than silently
 * routing both calls to whichever tool registered last.
 */
function toolName(server: McpServer, tool: string, taken: Set<string>): string {
  const base = `${server.name}_${tool}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  let name = base;
  for (let n = 2; taken.has(name); n++) {
    const suffix = `_${n}`;
    name = base.slice(0, 64 - suffix.length) + suffix;
  }
  taken.add(name);
  return name;
}

function contentToText(result: unknown): { text: string; isError: boolean } {
  const r = result as { content?: { type: string; text?: string }[]; isError?: boolean };
  const text = (r?.content ?? [])
    .map((c) => (c.type === 'text' ? (c.text ?? '') : `[${c.type}]`))
    .join('\n')
    .trim();
  return { text: text || 'done', isError: Boolean(r?.isError) };
}

/**
 * Function tools for every enabled MCP server, connecting (and caching the
 * tool lists briefly) as needed. Servers that can't be reached are skipped —
 * a dead server shouldn't block the whole turn.
 */
export async function mcpClientTools(servers: McpServer[], signal?: AbortSignal): Promise<ClientTool[]> {
  const tools: ClientTool[] = [];
  const takenNames = new Set<string>();

  for (const server of servers.filter((s) => s.enabled)) {
    let session = sessions.get(server.id);
    if (!session || Date.now() - session.fetchedAt > TOOL_LIST_TTL_MS) {
      try {
        session = await connect(server, signal);
        sessions.set(server.id, session);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
        console.warn(`MCP server ${server.name} unavailable:`, err);
        sessions.delete(server.id);
        continue;
      }
    }

    for (const info of session.tools) {
      const schema = info.inputSchema;
      tools.push({
        name: toolName(server, info.name, takenNames),
        description: info.description || `${info.name} (via ${server.name})`,
        input_schema: {
          type: 'object',
          properties: (schema?.properties as Record<string, unknown>) ?? {},
          ...(schema?.required?.length ? { required: schema.required } : {}),
        },
        run: async (input, runSignal) => {
          const current = sessions.get(server.id) ?? session!;
          const call = await rpc(
            server,
            current.sessionId,
            'tools/call',
            { name: info.name, arguments: input },
            runSignal,
          );
          const { text, isError } = contentToText(call.result);
          if (isError) throw new Error(text);
          return text;
        },
        summarize: () => `via ${server.name}`,
      });
    }
  }

  return tools;
}

/** Drops a server's cached session (call when its config changes). */
export function resetMcpSession(serverId: string): void {
  sessions.delete(serverId);
}
