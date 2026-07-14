import type { ChatMessage, Conversation } from '../types';
import { makeId } from '../lib/id';
import { partsToPlainText } from '../lib/blocks';
import type { AppState } from './types';

export function nowTime(): string {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function messageText(m: ChatMessage): string {
  return m.rawText || partsToPlainText(m.parts);
}

export function emptyConversation(): Conversation {
  const id = makeId('conv');
  return { id, title: 'New conversation', messages: [], createdAt: Date.now(), updatedAt: Date.now() };
}

/** The conversation every fresh install starts with; also the migration target. */
export const firstConversation = emptyConversation();

export function withConvo(
  state: AppState,
  convoId: string,
  fn: (c: Conversation) => Conversation,
): Pick<AppState, 'conversations'> {
  const current = state.conversations[convoId];
  if (!current) return { conversations: state.conversations };
  return { conversations: { ...state.conversations, [convoId]: fn(current) } };
}

export function appendMessage(c: Conversation, msg: ChatMessage): Conversation {
  return { ...c, messages: [...c.messages, msg], updatedAt: Date.now() };
}

export function patchMessage(
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

export function dropMessage(c: Conversation, msgId: string): Conversation {
  return { ...c, messages: c.messages.filter((m) => m.id !== msgId) };
}

/** Records a tool call, or updates it in place if we've already seen its id. */
export function upsertTool(m: ChatMessage, info: { id: string; name: string; input: string }): Partial<ChatMessage> {
  const existing = m.tools ?? [];
  if (existing.some((t) => t.id === info.id)) {
    return { tools: existing.map((t) => (t.id === info.id ? { ...t, ...info } : t)) };
  }
  return { tools: [...existing, info] };
}

export function resolveTool(m: ChatMessage, info: { id: string; output: string; isError?: boolean }): Partial<ChatMessage> {
  const existing = m.tools ?? [];
  if (!existing.length) return {};
  const target = existing.find((t) => t.id === info.id) ?? [...existing].reverse().find((t) => t.output === undefined);
  if (!target) return {};
  return {
    tools: existing.map((t) => (t.id === target.id ? { ...t, output: info.output, isError: info.isError } : t)),
  };
}
